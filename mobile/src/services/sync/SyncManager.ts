import type { AsyncStorageAdapter } from '../storage/AsyncStorageAdapter';
import type { Note } from '../../domain/Note';
import type { SyncState, CloudConfig, SyncStats } from '../../domain/Sync';
import { MobileSupabaseSyncProvider } from './SupabaseSyncProvider';

export class MobileSyncManager {
  private storage: AsyncStorageAdapter;
  private provider: MobileSupabaseSyncProvider | null = null;
  private syncState: SyncState = 'local-only';
  private stats: SyncStats = {
    lastSyncedAt: null,
    pushedCount: 0,
    pulledCount: 0,
    error: null
  };
  private listeners: Array<(state: SyncState, stats: SyncStats) => void> = [];
  private notesListeners: Array<(notes: Note[]) => void> = [];
  private realtimeUnsubscribe: (() => void) | null = null;
  private autoSyncTimer: any = null;

  constructor(storage: AsyncStorageAdapter) {
    this.storage = storage;
  }

  public subscribe(listener: (state: SyncState, stats: SyncStats) => void): () => void {
    this.listeners.push(listener);
    listener(this.syncState, this.stats);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  public subscribeNotes(listener: (notes: Note[]) => void): () => void {
    this.notesListeners.push(listener);
    return () => {
      this.notesListeners = this.notesListeners.filter(l => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach(l => l(this.syncState, this.stats));
  }

  private notifyNotes(notes: Note[]) {
    this.notesListeners.forEach(l => l(notes));
  }

  public async initializeWithConfig(config: CloudConfig | null): Promise<boolean> {
    if (this.realtimeUnsubscribe) {
      this.realtimeUnsubscribe();
      this.realtimeUnsubscribe = null;
    }
    if (this.autoSyncTimer) {
      clearInterval(this.autoSyncTimer);
      this.autoSyncTimer = null;
    }

    if (!config || !config.enabled || !config.supabaseUrl || !config.supabaseAnonKey) {
      this.provider = null;
      this.syncState = 'local-only';
      this.notify();
      return false;
    }

    const provider = new MobileSupabaseSyncProvider(config);
    const test = await provider.testConnection();

    if (test.success) {
      this.provider = provider;
      this.syncState = 'synced';

      // Connect Supabase Realtime WebSocket subscription
      if (provider.subscribeToRealtime) {
        this.realtimeUnsubscribe = provider.subscribeToRealtime(
          (note) => this.handleRealtimeUpsert(note),
          (id) => this.handleRealtimeDelete(id)
        );
      }

      // Background periodic fallback sync every 60 seconds
      this.autoSyncTimer = setInterval(() => {
        if (this.syncState !== 'syncing') {
          this.sync();
        }
      }, 60000);

      this.notify();
      return true;
    } else {
      this.syncState = 'error';
      this.stats.error = test.error;
      this.notify();
      return false;
    }
  }

  private async handleRealtimeUpsert(incomingNote: Note) {
    try {
      const localNotes = await this.storage.loadNotes();
      const existingIdx = localNotes.findIndex(n => n.id === incomingNote.id);

      let updatedList: Note[];
      if (existingIdx >= 0) {
        const local = localNotes[existingIdx];
        const localTime = new Date(local.updatedAt).getTime();
        const incomingTime = new Date(incomingNote.updatedAt).getTime();

        if (incomingTime >= localTime) {
          updatedList = localNotes.map((n, idx) => idx === existingIdx ? incomingNote : n);
        } else {
          return;
        }
      } else {
        if (incomingNote.isDeleted) return;
        updatedList = [incomingNote, ...localNotes];
      }

      await this.storage.saveNotes(updatedList);
      this.notifyNotes(updatedList);
    } catch (e) {
      console.warn('MobileSyncManager: Error handling realtime upsert', e);
    }
  }

  private async handleRealtimeDelete(deletedId: string) {
    try {
      const localNotes = await this.storage.loadNotes();
      const updatedList = localNotes.map(n =>
        n.id === deletedId ? { ...n, isDeleted: true, updatedAt: new Date().toISOString() } : n
      );
      await this.storage.saveNotes(updatedList);
      this.notifyNotes(updatedList);
    } catch (e) {
      console.warn('MobileSyncManager: Error handling realtime delete', e);
    }
  }

  public async sync(): Promise<Note[]> {
    const localNotes = await this.storage.loadNotes();

    if (!this.provider) {
      this.syncState = 'local-only';
      this.notify();
      return localNotes;
    }

    this.syncState = 'syncing';
    this.notify();

    try {
      const pullResult = await this.provider.pullChanges(this.stats.lastSyncedAt);
      if (pullResult.error) throw new Error(pullResult.error);

      const remoteNotes = pullResult.notes;
      const mergedMap = new Map<string, Note>();
      localNotes.forEach(note => mergedMap.set(note.id, note));

      let pulledCount = 0;
      let notesToPush: Note[] = [];

      remoteNotes.forEach(remote => {
        const local = mergedMap.get(remote.id);
        if (!local) {
          mergedMap.set(remote.id, remote);
          pulledCount++;
        } else {
          const remoteTime = new Date(remote.updatedAt).getTime();
          const localTime = new Date(local.updatedAt).getTime();
          if (remoteTime > localTime) {
            mergedMap.set(remote.id, remote);
            pulledCount++;
          }
        }
      });

      const finalNotes = Array.from(mergedMap.values());
      finalNotes.forEach(note => {
        const remote = remoteNotes.find(r => r.id === note.id);
        if (!remote) {
          notesToPush.push(note);
        } else {
          const remoteTime = new Date(remote.updatedAt).getTime();
          const localTime = new Date(note.updatedAt).getTime();
          if (localTime > remoteTime) {
            notesToPush.push(note);
          }
        }
      });

      let pushedCount = 0;
      if (notesToPush.length > 0) {
        const pushResult = await this.provider.pushChanges(notesToPush);
        if (pushResult.error) throw new Error(pushResult.error);
        pushedCount = notesToPush.length;
      }

      await this.storage.saveNotes(finalNotes);

      this.syncState = 'synced';
      this.stats = {
        lastSyncedAt: new Date().toISOString(),
        pushedCount,
        pulledCount,
        error: null
      };
      this.notify();
      this.notifyNotes(finalNotes);

      return finalNotes;
    } catch (err: any) {
      console.error('Mobile sync failed:', err);
      this.syncState = 'error';
      this.stats.error = err.message || 'Sync failed';
      this.notify();
      return localNotes;
    }
  }

  public getSyncState(): SyncState {
    return this.syncState;
  }

  public getStats(): SyncStats {
    return this.stats;
  }
}
