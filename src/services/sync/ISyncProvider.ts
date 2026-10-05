import type { Note } from '../../domain/Note';

/**
 * Cloud Sync Provider Interface (SOLID: DIP & OCP)
 * Can be implemented by Supabase, Firebase, or custom backend
 */
export interface ISyncProvider {
  testConnection(): Promise<{ success: boolean; error?: string }>;
  pullChanges(since?: string | null): Promise<{ notes: Note[]; error?: string }>;
  pushChanges(notes: Note[]): Promise<{ success: boolean; error?: string }>;
}
