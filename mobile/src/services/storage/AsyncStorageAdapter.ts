import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Note } from '../../domain/Note';
import type { CloudConfig } from '../../domain/Sync';

const STORAGE_KEY_NOTES = '@papernotes_documents_v1';
const STORAGE_KEY_ACTIVE = '@papernotes_active_id_v1';
const STORAGE_KEY_CLOUD = '@papernotes_cloud_config_v1';

export const MOBILE_STARTER_NOTES: Note[] = [
  {
    id: 'welcome-mobile',
    title: 'Welcome to PaperNotes Mobile',
    icon: 'zap',
    hasCover: true,
    coverStyle: 'charcoal-mesh',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
    blocks: [
      {
        id: 'mb-1',
        type: 'heading1',
        content: 'Your Android & Cross-Platform Workspace',
        order: 0,
        updatedAt: new Date().toISOString()
      },
      {
        id: 'mb-2',
        type: 'paragraph',
        content: 'PaperNotes Mobile is built with React Native and shares the same clean monochrome aesthetic, domain invariants, and offline-first storage as the web app.',
        order: 1,
        updatedAt: new Date().toISOString()
      },
      {
        id: 'mb-3',
        type: 'callout',
        content: 'Tap "+ Block" at the bottom or the action buttons on any card to insert headings, to-dos, code snippets, and quotes.',
        order: 2,
        updatedAt: new Date().toISOString()
      },
      {
        id: 'mb-4',
        type: 'heading2',
        content: 'Mobile Features',
        order: 3,
        updatedAt: new Date().toISOString()
      },
      {
        id: 'mb-5',
        type: 'todo',
        content: 'Tap the checkmark box to complete actionable tasks',
        checked: true,
        order: 4,
        updatedAt: new Date().toISOString()
      },
      {
        id: 'mb-6',
        type: 'todo',
        content: 'Use the ▲ and ▼ buttons on each block to reorder and pan content',
        checked: true,
        order: 5,
        updatedAt: new Date().toISOString()
      },
      {
        id: 'mb-7',
        type: 'todo',
        content: 'Sync with Supabase PostgreSQL to seamlessly edit across mobile & desktop',
        checked: false,
        order: 6,
        updatedAt: new Date().toISOString()
      },
      {
        id: 'mb-8',
        type: 'code',
        content: '// 100% Offline-First React Native\nconst isConnected = false;\n// All notes remain instantly editable locally',
        order: 7,
        updatedAt: new Date().toISOString()
      }
    ]
  }
];

export class AsyncStorageAdapter {
  async loadNotes(): Promise<Note[]> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY_NOTES);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
      await this.saveNotes(MOBILE_STARTER_NOTES);
      return MOBILE_STARTER_NOTES;
    } catch (e) {
      console.error('AsyncStorageAdapter: failed to load notes', e);
      return MOBILE_STARTER_NOTES;
    }
  }

  async saveNotes(notes: Note[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY_NOTES, JSON.stringify(notes));
    } catch (e) {
      console.error('AsyncStorageAdapter: failed to save notes', e);
    }
  }

  async getActiveNoteId(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEY_ACTIVE);
    } catch {
      return null;
    }
  }

  async setActiveNoteId(id: string): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY_ACTIVE, id);
    } catch (e) {
      console.error('AsyncStorageAdapter: failed to set active note id', e);
    }
  }

  async getCloudConfig(): Promise<CloudConfig | null> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY_CLOUD);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  async saveCloudConfig(config: CloudConfig): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY_CLOUD, JSON.stringify(config));
    } catch (e) {
      console.error('AsyncStorageAdapter: failed to save cloud config', e);
    }
  }
}
