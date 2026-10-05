/**
 * Synchronization Domain Types & Contract Definitions
 */

export type SyncState = 'local-only' | 'syncing' | 'synced' | 'error' | 'offline';

export interface CloudConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  userId?: string;
  enabled: boolean;
  autoSyncIntervalMs?: number;
}

export interface SyncStats {
  lastSyncedAt: string | null;
  pushedCount: number;
  pulledCount: number;
  error?: string | null;
}

export interface SyncPayload {
  notes: any[];
  blocks: any[];
  clientTimestamp: string;
}
