import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Note } from '../../domain/Note';
import type { CloudConfig } from '../../domain/Sync';

export class MobileSupabaseSyncProvider {
  private client: SupabaseClient | null = null;

  constructor(config: CloudConfig) {
    if (config.supabaseUrl && config.supabaseAnonKey) {
      try {
        this.client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
          auth: { persistSession: false }
        });
      } catch (err) {
        console.error('Mobile Supabase initialization failed:', err);
      }
    }
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    if (!this.client) {
      return { success: false, error: 'Supabase credentials not configured' };
    }
    try {
      const { error } = await this.client
        .from('papernotes_notes')
        .select('id')
        .limit(1);

      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Connection test failed' };
    }
  }

  async pullChanges(since?: string | null): Promise<{ notes: Note[]; error?: string }> {
    if (!this.client) {
      return { notes: [], error: 'Supabase client not initialized' };
    }

    try {
      let query = this.client
        .from('papernotes_notes')
        .select('*')
        .order('updated_at', { ascending: false });

      if (since) {
        query = query.gt('updated_at', since);
      }

      const { data, error } = await query;
      if (error) {
        return { notes: [], error: error.message };
      }

      const notes: Note[] = (data || []).map((row: any) => ({
        id: row.id,
        title: row.title || '',
        icon: row.icon || 'file-text',
        hasCover: Boolean(row.has_cover),
        coverStyle: row.cover_style || 'charcoal-mesh',
        blocks: Array.isArray(row.blocks) ? row.blocks : [],
        createdAt: row.created_at || new Date().toISOString(),
        updatedAt: row.updated_at || new Date().toISOString(),
        isDeleted: Boolean(row.is_deleted)
      }));

      return { notes };
    } catch (err: any) {
      return { notes: [], error: err.message || 'Failed to pull cloud notes' };
    }
  }

  async pushChanges(notes: Note[]): Promise<{ success: boolean; error?: string }> {
    if (!this.client) {
      return { success: false, error: 'Supabase client not initialized' };
    }

    if (notes.length === 0) {
      return { success: true };
    }

    try {
      const records = notes.map(note => ({
        id: note.id,
        title: note.title,
        icon: note.icon,
        has_cover: note.hasCover,
        cover_style: note.coverStyle || 'charcoal-mesh',
        blocks: note.blocks,
        created_at: note.createdAt,
        updated_at: note.updatedAt,
        is_deleted: Boolean(note.isDeleted)
      }));

      const { error } = await this.client
        .from('papernotes_notes')
        .upsert(records, { onConflict: 'id' });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to push notes' };
    }
  }
}
