import type { IStorageAdapter } from './IStorageAdapter';
import type { Note } from '../../domain/Note';
import type { CloudConfig } from '../../domain/Sync';

const STORAGE_KEY_NOTES = 'papernotes_documents_v1';
const STORAGE_KEY_ACTIVE = 'papernotes_active_id_v1';
const STORAGE_KEY_CLOUD = 'papernotes_cloud_config_v1';

export const STARTER_NOTES: Note[] = [
  {
    id: 'welcome-papernotes',
    title: 'Welcome to PaperNotes',
    icon: 'zap',
    hasCover: true,
    coverStyle: 'charcoal-mesh',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
    blocks: [
      {
        id: 'b-1',
        type: 'heading1',
        content: 'Distraction-free, monochrome workspace',
        order: 0,
        updatedAt: new Date().toISOString()
      },
      {
        id: 'b-2',
        type: 'paragraph',
        content: 'Welcome to <strong>PaperNotes</strong> — an ultra-clean, minimal notes app inspired by the speed and tactile feel of Notion. Built with a rich monochrome aesthetic, zero bloat, and total privacy.',
        order: 1,
        updatedAt: new Date().toISOString()
      },
      {
        id: 'b-3',
        type: 'callout',
        content: '<strong>Pro Tip:</strong> Type <code>/</code> anywhere on a new line to summon the command menu, or use markdown shortcuts like <code>#</code>, <code>##</code>, <code>-</code>, and <code>[]</code>.',
        calloutIcon: 'lightbulb',
        order: 2,
        updatedAt: new Date().toISOString()
      },
      {
        id: 'b-4',
        type: 'heading2',
        content: 'Essential Features',
        order: 3,
        updatedAt: new Date().toISOString()
      },
      {
        id: 'b-5',
        type: 'todo',
        content: 'Drag the <code>⋮⋮</code> handle to effortlessly pan and reorder blocks',
        checked: true,
        order: 4,
        updatedAt: new Date().toISOString()
      },
      {
        id: 'b-6',
        type: 'todo',
        content: 'Press <code>⌘K</code> (or Ctrl+K) to instantly search through all your pages',
        checked: true,
        order: 5,
        updatedAt: new Date().toISOString()
      },
      {
        id: 'b-7',
        type: 'todo',
        content: 'Click the Cloud icon in top navigation to sync with your free Supabase PostgreSQL',
        checked: false,
        order: 6,
        updatedAt: new Date().toISOString()
      },
      {
        id: 'b-8',
        type: 'todo',
        content: 'Toggle rich minimalist page covers with multiple monochrome patterns',
        checked: false,
        order: 7,
        updatedAt: new Date().toISOString()
      },
      {
        id: 'b-9',
        type: 'heading2',
        content: 'Architecture & Scalability',
        order: 8,
        updatedAt: new Date().toISOString()
      },
      {
        id: 'b-10',
        type: 'code',
        content: '// Modular Monolith adhering to SOLID principles\ninterface IStorageAdapter {\n  loadNotes(): Promise<Note[]>;\n  saveNotes(notes: Note[]): Promise<void>;\n}',
        order: 9,
        updatedAt: new Date().toISOString()
      },
      {
        id: 'b-11',
        type: 'quote',
        content: '“Simplicity is about subtracting the obvious and adding the meaningful.” — John Maeda',
        order: 10,
        updatedAt: new Date().toISOString()
      }
    ]
  },
  {
    id: 'sprint-roadmap',
    title: 'Weekly Focus & Roadmap',
    icon: 'target',
    hasCover: false,
    coverStyle: 'slate-gradient',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
    version: 1,
    blocks: [
      {
        id: 'sr-1',
        type: 'heading1',
        content: 'Weekly Priorities',
        order: 0,
        updatedAt: new Date().toISOString()
      },
      {
        id: 'sr-2',
        type: 'paragraph',
        content: 'High-impact tasks scheduled for this cycle. Review every morning to maintain flow.',
        order: 1,
        updatedAt: new Date().toISOString()
      },
      {
        id: 'sr-3',
        type: 'todo',
        content: 'Draft product vision & architectural invariants',
        checked: true,
        order: 2,
        updatedAt: new Date().toISOString()
      },
      {
        id: 'sr-4',
        type: 'todo',
        content: 'Cross-platform compatibility for React Native mobile and desktop web',
        checked: true,
        order: 3,
        updatedAt: new Date().toISOString()
      },
      {
        id: 'sr-5',
        type: 'todo',
        content: 'Verify keyboard navigation speed and pan reordering across all blocks',
        checked: false,
        order: 4,
        updatedAt: new Date().toISOString()
      },
      {
        id: 'sr-6',
        type: 'heading2',
        content: 'Key Observations',
        order: 5,
        updatedAt: new Date().toISOString()
      },
      {
        id: 'sr-7',
        type: 'bullet',
        content: 'Monochrome palettes reduce visual fatigue during marathon writing sessions.',
        order: 6,
        updatedAt: new Date().toISOString()
      },
      {
        id: 'sr-8',
        type: 'bullet',
        content: 'Immediate local autosave builds trust with zero latency.',
        order: 7,
        updatedAt: new Date().toISOString()
      }
    ]
  },
  {
    id: 'ideas-garden',
    title: 'Ideas & Brainstorming',
    icon: 'lightbulb',
    hasCover: false,
    coverStyle: 'mono-grid',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
    version: 1,
    blocks: [
      {
        id: 'ib-1',
        type: 'heading1',
        content: 'Digital Garden Notes',
        order: 0,
        updatedAt: new Date().toISOString()
      },
      {
        id: 'ib-2',
        type: 'paragraph',
        content: 'A scratchpad for loose thoughts, emerging patterns, and technical notes.',
        order: 1,
        updatedAt: new Date().toISOString()
      },
      {
        id: 'ib-3',
        type: 'quote',
        content: '“You do not rise to the level of your goals. You fall to the level of your systems.” — James Clear',
        order: 2,
        updatedAt: new Date().toISOString()
      },
      {
        id: 'ib-4',
        type: 'divider',
        content: '',
        order: 3,
        updatedAt: new Date().toISOString()
      },
      {
        id: 'ib-5',
        type: 'heading2',
        content: 'Future Explorations',
        order: 4,
        updatedAt: new Date().toISOString()
      },
      {
        id: 'ib-6',
        type: 'numbered',
        content: 'Multi-device peer-to-peer sync via WebRTC or Supabase Realtime',
        order: 5,
        updatedAt: new Date().toISOString()
      },
      {
        id: 'ib-7',
        type: 'numbered',
        content: 'Offline search indexation with client-side tokenization',
        order: 6,
        updatedAt: new Date().toISOString()
      }
    ]
  }
];

export class LocalStorageAdapter implements IStorageAdapter {
  async loadNotes(): Promise<Note[]> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_NOTES);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
      // First run: save and return starter notes
      await this.saveNotes(STARTER_NOTES);
      return STARTER_NOTES;
    } catch (e) {
      console.error('LocalStorageAdapter: failed to load notes', e);
      return STARTER_NOTES;
    }
  }

  async saveNotes(notes: Note[]): Promise<void> {
    try {
      localStorage.setItem(STORAGE_KEY_NOTES, JSON.stringify(notes));
    } catch (e) {
      console.error('LocalStorageAdapter: failed to save notes', e);
    }
  }

  async getActiveNoteId(): Promise<string | null> {
    try {
      return localStorage.getItem(STORAGE_KEY_ACTIVE);
    } catch {
      return null;
    }
  }

  async setActiveNoteId(id: string): Promise<void> {
    try {
      localStorage.setItem(STORAGE_KEY_ACTIVE, id);
    } catch (e) {
      console.error('LocalStorageAdapter: failed to set active note id', e);
    }
  }

  async getCloudConfig(): Promise<CloudConfig | null> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_CLOUD);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  async saveCloudConfig(config: CloudConfig): Promise<void> {
    try {
      localStorage.setItem(STORAGE_KEY_CLOUD, JSON.stringify(config));
    } catch (e) {
      console.error('LocalStorageAdapter: failed to save cloud config', e);
    }
  }
}
