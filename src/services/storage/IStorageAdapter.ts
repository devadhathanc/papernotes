import type { Note } from '../../domain/Note';
import type { CloudConfig } from '../../domain/Sync';

/**
 * Storage Adapter Interface (ISP & DIP)
 * Enables platform-agnostic persistence:
 * - Web: LocalStorage / IndexedDB
 * - Mobile / React Native: AsyncStorage / SQLite
 */
export interface IStorageAdapter {
  loadNotes(): Promise<Note[]>;
  saveNotes(notes: Note[]): Promise<void>;
  getActiveNoteId(): Promise<string | null>;
  setActiveNoteId(id: string): Promise<void>;
  getCloudConfig(): Promise<CloudConfig | null>;
  saveCloudConfig(config: CloudConfig): Promise<void>;
  getSecurityPinHash(): Promise<string | null>;
  saveSecurityPinHash(hash: string): Promise<void>;
}
