export type SyncState = 'local-only' | 'syncing' | 'synced' | 'error' | 'offline';

export interface CloudConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  userId?: string;
  enabled: boolean;
}

export interface SyncStats {
  lastSyncedAt: string | null;
  pushedCount: number;
  pulledCount: number;
  error?: string | null;
}
