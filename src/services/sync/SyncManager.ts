import type { ISyncProvider } from './ISyncProvider';
import type { IStorageAdapter } from '../storage/IStorageAdapter';
import type { Note } from '../../domain/Note';
import type { SyncState, CloudConfig, SyncStats } from '../../domain/Sync';
import { SupabaseSyncProvider } from './SupabaseSyncProvider';

export class SyncManager {
  private storage: IStorageAdapter;
  private provider: ISyncProvider | null = null;
  private syncState: SyncState = 'local-only';
  private stats: SyncStats = {
    lastSyncedAt: null,
    pushedCount: 0,
    pulledCount: 0,
    error: null
  };
  private onStateChangeListeners: Array<(state: SyncState, stats: SyncStats) => void> = [];
  private onNotesUpdatedListeners: Array<(notes: Note[]) => void> = [];
  private realtimeUnsubscribe: (() => void) | null = null;
  private autoSyncInterval: any = null;

  constructor(storage: IStorageAdapter) {
    this.storage = storage;

    // Track browser online/offline status
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleNetworkChange(true));
      window.addEventListener('offline', () => this.handleNetworkChange(false));
    }
  }

  public subscribe(listener: (state: SyncState, stats: SyncStats) => void): () => void {
    this.onStateChangeListeners.push(listener);
    listener(this.syncState, this.stats);
    return () => {
      this.onStateChangeListeners = this.onStateChangeListeners.filter(l => l !== listener);
    };
  }

  public subscribeNotes(listener: (notes: Note[]) => void): () => void {
    this.onNotesUpdatedListeners.push(listener);
    return () => {
      this.onNotesUpdatedListeners = this.onNotesUpdatedListeners.filter(l => l !== listener);
    };
  }

  private notify() {
    this.onStateChangeListeners.forEach(l => l(this.syncState, this.stats));
  }

  private notifyNotes(notes: Note[]) {
    this.onNotesUpdatedListeners.forEach(l => l(notes));
  }

  private handleNetworkChange(isOnline: boolean) {
    if (!isOnline) {
      this.syncState = 'offline';
      this.notify();
    } else if (this.provider) {
      this.sync();
    }
  }

  public setProvider(provider: ISyncProvider | null) {
    // Clean up existing realtime subscription & timer
    if (this.realtimeUnsubscribe) {
      this.realtimeUnsubscribe();
      this.realtimeUnsubscribe = null;
    }
    if (this.autoSyncInterval) {
      clearInterval(this.autoSyncInterval);
      this.autoSyncInterval = null;
    }

    this.provider = provider;
    if (!provider) {
      this.syncState = 'local-only';
    } else {
      this.syncState = 'synced';

      // Setup Realtime WebSocket subscription if supported
      if (provider.subscribeToRealtime) {
        this.realtimeUnsubscribe = provider.subscribeToRealtime(
          (note) => this.handleRealtimeUpsert(note),
          (id) => this.handleRealtimeDelete(id)
        );
      }

      // Setup automatic periodic background sync every 60s
      this.autoSyncInterval = setInterval(() => {
        if (this.syncState !== 'syncing' && typeof navigator !== 'undefined' && navigator.onLine) {
          this.sync();
        }
      }, 60000);
    }
    this.notify();
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
          // Local is newer, don't overwrite
          return;
        }
      } else {
        if (incomingNote.isDeleted) return;
        updatedList = [incomingNote, ...localNotes];
      }

      await this.storage.saveNotes(updatedList);
      this.notifyNotes(updatedList);
    } catch (e) {
      console.warn('SyncManager: Error handling realtime upsert', e);
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
      console.warn('SyncManager: Error handling realtime delete', e);
    }
  }

  public async initializeWithConfig(config: CloudConfig | null): Promise<boolean> {
    if (!config || !config.enabled || !config.supabaseUrl || !config.supabaseAnonKey) {
      this.setProvider(null);
      return false;
    }

    const provider = new SupabaseSyncProvider(config);
    const test = await provider.testConnection();

    if (test.success) {
      this.setProvider(provider);
      return true;
    } else {
      this.syncState = 'error';
      this.stats.error = test.error;
      this.notify();
      return false;
    }
  }

  /**
   * Bidirectional Sync with Last-Write-Wins (LWW) conflict resolution
   */
  public async sync(): Promise<Note[]> {
    const localNotes = await this.storage.loadNotes();

    if (!this.provider) {
      this.syncState = 'local-only';
      this.notify();
      return localNotes;
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.syncState = 'offline';
      this.notify();
      return localNotes;
    }

    this.syncState = 'syncing';
    this.notify();

    try {
      // 1. Pull remote changes
      const pullResult = await this.provider.pullChanges(this.stats.lastSyncedAt);
      if (pullResult.error) {
        throw new Error(pullResult.error);
      }

      const remoteNotes = pullResult.notes;
      const mergedMap = new Map<string, Note>();

      // Populate local notes first
      localNotes.forEach(note => mergedMap.set(note.id, note));

      let pulledCount = 0;
      let notesToPush: Note[] = [];

      // 2. Resolve conflicts with LWW (Last-Write-Wins based on ISO timestamps)
      remoteNotes.forEach(remote => {
        const local = mergedMap.get(remote.id);
        if (!local) {
          // New note from remote
          mergedMap.set(remote.id, remote);
          pulledCount++;
        } else {
          const remoteTime = new Date(remote.updatedAt).getTime();
          const localTime = new Date(local.updatedAt).getTime();

          if (remoteTime > localTime) {
            // Remote is newer: adopt remote
            mergedMap.set(remote.id, remote);
            pulledCount++;
          }
        }
      });

      // 3. Detect local notes that need to be pushed
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

      // 4. Push newer/local notes to remote
      let pushedCount = 0;
      if (notesToPush.length > 0) {
        const pushResult = await this.provider.pushChanges(notesToPush);
        if (pushResult.error) {
          throw new Error(pushResult.error);
        }
        pushedCount = notesToPush.length;
      }

      // 5. Update local storage with merged state
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
      console.error('Sync failed:', err);
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
