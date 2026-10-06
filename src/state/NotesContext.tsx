import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import type { Note, Block, BlockType, CoverStyle } from '../domain/Note';
import type { SyncState, CloudConfig, SyncStats } from '../domain/Sync';
import { LocalStorageAdapter } from '../services/storage/LocalStorageAdapter';
import { SyncManager } from '../services/sync/SyncManager';
import { hashPin, verifyPin } from '../utils/crypto';

interface NotesContextType {
  notes: Note[];
  activeNote: Note | null;
  activeNoteId: string | null;
  syncState: SyncState;
  syncStats: SyncStats;
  cloudConfig: CloudConfig | null;
  theme: 'dark' | 'light';
  isSidebarCollapsed: boolean;
  isZenMode: boolean;
  isSearchOpen: boolean;
  isCloudModalOpen: boolean;
  isIconPickerOpen: boolean;
  focusedBlockId: string | null;

  // Page Lock & PIN Security
  unlockedNoteIds: string[];
  isCurrentNoteLocked: boolean;
  toggleLockActiveNote: () => void;
  unlockNote: (noteId: string, pin: string) => Promise<boolean>;
  relockNote: (noteId: string) => void;
  changeSecurityPin: (currentPin: string, newPin: string) => Promise<{ success: boolean; error?: string }>;

  // Actions
  selectNote: (id: string) => void;
  createNote: () => Note;
  deleteNote: (id: string) => void;
  updateNoteTitle: (title: string) => void;
  updateNoteIcon: (icon: string) => void;
  toggleNoteCover: () => void;
  setCoverStyle: (style: CoverStyle) => void;
  
  // Block Actions (including pan & reorder!)
  updateBlock: (blockId: string, updates: Partial<Block>) => void;
  addBlock: (afterBlockId: string | null, type?: BlockType) => string;
  deleteBlock: (blockId: string) => void;
  reorderBlocks: (fromIndex: number, toIndex: number) => void;
  convertBlockType: (blockId: string, type: BlockType) => void;
  toggleTodo: (blockId: string) => void;
  setFocusedBlockId: (id: string | null) => void;

  // UI State toggles
  toggleTheme: () => void;
  toggleSidebar: () => void;
  toggleZenMode: () => void;
  setIsSearchOpen: (open: boolean) => void;
  setIsCloudModalOpen: (open: boolean) => void;
  setIsIconPickerOpen: (open: boolean) => void;

  // Cloud & Backup
  syncNow: () => Promise<void>;
  updateCloudConfig: (config: CloudConfig) => Promise<boolean>;
  exportMarkdown: (noteId?: string) => void;
  exportBackupJson: () => void;
  importFile: (content: string, filename: string) => boolean;
}

const NotesContext = createContext<NotesContextType | null>(null);

const storageAdapter = new LocalStorageAdapter();
const syncManager = new SyncManager(storageAdapter);

function generateId(prefix = 'b'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
}

export const NotesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [allNotes, setAllNotes] = useState<Note[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<SyncState>('local-only');
  const [syncStats, setSyncStats] = useState<SyncStats>(syncManager.getStats());
  const [cloudConfig, setCloudConfig] = useState<CloudConfig | null>(null);

  // Security PIN & Document Locking
  const [unlockedNoteIds, setUnlockedNoteIds] = useState<string[]>([]);
  const [securityPinHash, setSecurityPinHash] = useState<string | null>(null);

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('papernotes_theme_v1') as 'dark' | 'light') || 'dark';
    }
    return 'dark';
  });

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('papernotes_sidebar_collapsed_v1') === 'true';
    }
    return false;
  });

  const [isZenMode, setIsZenMode] = useState<boolean>(false);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [isCloudModalOpen, setIsCloudModalOpen] = useState<boolean>(false);
  const [isIconPickerOpen, setIsIconPickerOpen] = useState<boolean>(false);
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Filtered active notes list (excludes deleted notes)
  const notes = useMemo(() => allNotes.filter(n => !n.isDeleted), [allNotes]);

  // Initialize data on mount
  useEffect(() => {
    async function init() {
      const loadedNotes = await storageAdapter.loadNotes();
      setAllNotes(loadedNotes);

      const activeList = loadedNotes.filter(n => !n.isDeleted);
      const savedActiveId = await storageAdapter.getActiveNoteId();
      if (savedActiveId && activeList.some(n => n.id === savedActiveId)) {
        setActiveNoteId(savedActiveId);
      } else if (activeList.length > 0) {
        setActiveNoteId(activeList[0].id);
      }

      // Initialize PIN hash (default to '123' if not set)
      let pinHash = await storageAdapter.getSecurityPinHash();
      if (!pinHash) {
        pinHash = await hashPin('123');
        await storageAdapter.saveSecurityPinHash(pinHash);
      }
      setSecurityPinHash(pinHash);

      const cfg = await storageAdapter.getCloudConfig();
      if (cfg) {
        setCloudConfig(cfg);
        await syncManager.initializeWithConfig(cfg);
        if (cfg.enabled) {
          const synced = await syncManager.sync();
          setAllNotes(synced);
        }
      }
    }

    init();

    // Subscribe to sync manager state updates
    const unsubscribeState = syncManager.subscribe((state, stats) => {
      setSyncState(state);
      setSyncStats(stats);
    });

    // Subscribe to real-time note updates (from Supabase Realtime WebSocket)
    const unsubscribeNotes = syncManager.subscribeNotes((syncedNotes) => {
      setAllNotes(syncedNotes);
    });

    return () => {
      unsubscribeState();
      unsubscribeNotes();
    };
  }, []);

  // Update theme data attribute
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('papernotes_theme_v1', theme);
  }, [theme]);

  // Persist notes with debounce
  const persistNotes = useCallback((updatedNotes: Note[]) => {
    setAllNotes(updatedNotes);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(async () => {
      await storageAdapter.saveNotes(updatedNotes);
      // Auto-sync in background if cloud is enabled
      if (cloudConfig?.enabled) {
        syncManager.sync();
      }
    }, 400);
  }, [cloudConfig]);

  const activeNote = useMemo(() => {
    return notes.find(n => n.id === activeNoteId) || null;
  }, [notes, activeNoteId]);

  const isCurrentNoteLocked = useMemo(() => {
    if (!activeNote) return false;
    return Boolean(activeNote.isLocked && !unlockedNoteIds.includes(activeNote.id));
  }, [activeNote, unlockedNoteIds]);

  const selectNote = useCallback((id: string) => {
    setActiveNoteId(id);
    storageAdapter.setActiveNoteId(id);
  }, []);

  const createNote = useCallback((): Note => {
    const newNote: Note = {
      id: generateId('note'),
      title: '',
      icon: 'file-text',
      hasCover: false,
      coverStyle: 'charcoal-mesh',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      blocks: [
        {
          id: generateId('b'),
          type: 'paragraph',
          content: '',
          order: 0,
          updatedAt: new Date().toISOString()
        }
      ]
    };

    const next = [newNote, ...allNotes];
    persistNotes(next);
    selectNote(newNote.id);
    return newNote;
  }, [allNotes, persistNotes, selectNote]);

  const deleteNote = useCallback((id: string) => {
    const now = new Date().toISOString();
    const next = allNotes.map(n => (n.id === id ? { ...n, isDeleted: true, updatedAt: now } : n));
    setAllNotes(next);

    // Save immediately so deletion persists on reload
    storageAdapter.saveNotes(next);
    if (cloudConfig?.enabled) {
      syncManager.sync();
    }

    const remaining = next.filter(n => !n.isDeleted);
    if (remaining.length === 0) {
      createNote();
    } else if (activeNoteId === id) {
      selectNote(remaining[0].id);
    }
  }, [allNotes, activeNoteId, cloudConfig, createNote, selectNote]);

  // Page Lock & PIN Security actions
  const toggleLockActiveNote = useCallback(() => {
    if (!activeNoteId) return;
    const target = allNotes.find(n => n.id === activeNoteId);
    if (!target) return;
    const willLock = !target.isLocked;
    const now = new Date().toISOString();
    const next = allNotes.map(n => n.id === activeNoteId ? { ...n, isLocked: willLock, updatedAt: now } : n);
    persistNotes(next);

    if (willLock) {
      setUnlockedNoteIds(prev => prev.filter(id => id !== activeNoteId));
    }
  }, [activeNoteId, allNotes, persistNotes]);

  const unlockNote = useCallback(async (noteId: string, pin: string): Promise<boolean> => {
    const hash = securityPinHash || (await hashPin('123'));
    const isValid = await verifyPin(pin, hash);
    if (isValid) {
      setUnlockedNoteIds(prev => (prev.includes(noteId) ? prev : [...prev, noteId]));
      return true;
    }
    return false;
  }, [securityPinHash]);

  const relockNote = useCallback((noteId: string) => {
    setUnlockedNoteIds(prev => prev.filter(id => id !== noteId));
  }, []);

  const changeSecurityPin = useCallback(async (currentPin: string, newPin: string): Promise<{ success: boolean; error?: string }> => {
    if (!/^\d{3}$/.test(newPin)) {
      return { success: false, error: 'New PIN must be exactly 3 digits (0-9)' };
    }
    const currentHash = securityPinHash || (await hashPin('123'));
    const isValid = await verifyPin(currentPin, currentHash);
    if (!isValid) {
      return { success: false, error: 'Current PIN is incorrect' };
    }
    const newHash = await hashPin(newPin);
    await storageAdapter.saveSecurityPinHash(newHash);
    setSecurityPinHash(newHash);
    return { success: true };
  }, [securityPinHash]);

  const updateNoteTitle = useCallback((title: string) => {
    if (!activeNoteId) return;
    const now = new Date().toISOString();
    const next = allNotes.map(n => n.id === activeNoteId ? { ...n, title, updatedAt: now } : n);
    persistNotes(next);
  }, [activeNoteId, allNotes, persistNotes]);

  const updateNoteIcon = useCallback((icon: string) => {
    if (!activeNoteId) return;
    const now = new Date().toISOString();
    const next = allNotes.map(n => n.id === activeNoteId ? { ...n, icon, updatedAt: now } : n);
    persistNotes(next);
  }, [activeNoteId, allNotes, persistNotes]);

  const toggleNoteCover = useCallback(() => {
    if (!activeNoteId) return;
    const now = new Date().toISOString();
    const next = allNotes.map(n => n.id === activeNoteId ? {
      ...n,
      hasCover: !n.hasCover,
      coverStyle: n.coverStyle || 'charcoal-mesh',
      updatedAt: now
    } : n);
    persistNotes(next);
  }, [activeNoteId, allNotes, persistNotes]);

  const setCoverStyle = useCallback((coverStyle: CoverStyle) => {
    if (!activeNoteId) return;
    const now = new Date().toISOString();
    const next = allNotes.map(n => n.id === activeNoteId ? { ...n, coverStyle, updatedAt: now } : n);
    persistNotes(next);
  }, [activeNoteId, allNotes, persistNotes]);

  // Block updates
  const updateBlock = useCallback((blockId: string, updates: Partial<Block>) => {
    if (!activeNoteId) return;
    const now = new Date().toISOString();
    const next = allNotes.map(n => {
      if (n.id !== activeNoteId) return n;
      const updatedBlocks = n.blocks.map(b => b.id === blockId ? { ...b, ...updates, updatedAt: now } : b);
      return { ...n, blocks: updatedBlocks, updatedAt: now };
    });
    persistNotes(next);
  }, [activeNoteId, allNotes, persistNotes]);

  const addBlock = useCallback((afterBlockId: string | null, type: BlockType = 'paragraph'): string => {
    if (!activeNoteId) return '';
    const newId = generateId('b');
    const now = new Date().toISOString();

    const newBlock: Block = {
      id: newId,
      type,
      content: '',
      order: 0,
      updatedAt: now
    };

    const next = allNotes.map(n => {
      if (n.id !== activeNoteId) return n;
      const blocks = [...n.blocks];
      const targetIdx = afterBlockId ? blocks.findIndex(b => b.id === afterBlockId) : -1;

      if (targetIdx !== -1) {
        blocks.splice(targetIdx + 1, 0, newBlock);
      } else {
        blocks.push(newBlock);
      }

      // Re-index orders
      blocks.forEach((b, i) => b.order = i);
      return { ...n, blocks, updatedAt: now };
    });

    persistNotes(next);
    setFocusedBlockId(newId);
    return newId;
  }, [activeNoteId, allNotes, persistNotes]);

  const deleteBlock = useCallback((blockId: string) => {
    if (!activeNoteId) return;
    const now = new Date().toISOString();

    const next = allNotes.map(n => {
      if (n.id !== activeNoteId) return n;
      if (n.blocks.length <= 1) return n; // Keep at least one block

      const blocks = n.blocks.filter(b => b.id !== blockId);
      blocks.forEach((b, i) => b.order = i);
      return { ...n, blocks, updatedAt: now };
    });

    persistNotes(next);
  }, [activeNoteId, allNotes, persistNotes]);

  // Reorder / Pan Blocks feature!
  const reorderBlocks = useCallback((fromIndex: number, toIndex: number) => {
    if (!activeNoteId) return;
    if (fromIndex === toIndex) return;

    const now = new Date().toISOString();
    const next = allNotes.map(n => {
      if (n.id !== activeNoteId) return n;
      const blocks = [...n.blocks];
      const [moved] = blocks.splice(fromIndex, 1);
      blocks.splice(toIndex, 0, moved);
      blocks.forEach((b, i) => b.order = i);
      return { ...n, blocks, updatedAt: now };
    });

    persistNotes(next);
  }, [activeNoteId, allNotes, persistNotes]);

  const convertBlockType = useCallback((blockId: string, type: BlockType) => {
    if (!activeNoteId) return;
    const now = new Date().toISOString();
    const next = allNotes.map(n => {
      if (n.id !== activeNoteId) return n;
      const blocks = n.blocks.map(b => {
        if (b.id !== blockId) return b;
        return {
          ...b,
          type,
          checked: type === 'todo' ? (b.checked ?? false) : undefined,
          calloutIcon: type === 'callout' ? (b.calloutIcon ?? 'lightbulb') : undefined,
          updatedAt: now
        };
      });
      return { ...n, blocks, updatedAt: now };
    });
    persistNotes(next);
  }, [activeNoteId, allNotes, persistNotes]);

  const toggleTodo = useCallback((blockId: string) => {
    if (!activeNoteId) return;
    const now = new Date().toISOString();
    const next = allNotes.map(n => {
      if (n.id !== activeNoteId) return n;
      const blocks = n.blocks.map(b => b.id === blockId ? { ...b, checked: !b.checked, updatedAt: now } : b);
      return { ...n, blocks, updatedAt: now };
    });
    persistNotes(next);
  }, [activeNoteId, allNotes, persistNotes]);

  // UI state toggles
  const toggleTheme = useCallback(() => {
    setTheme(t => (t === 'dark' ? 'light' : 'dark'));
  }, []);

  const toggleSidebar = useCallback(() => {
    setIsSidebarCollapsed(c => {
      const next = !c;
      localStorage.setItem('papernotes_sidebar_collapsed_v1', String(next));
      return next;
    });
  }, []);

  const toggleZenMode = useCallback(() => {
    setIsZenMode(z => !z);
  }, []);

  // Cloud Sync Actions
  const syncNow = useCallback(async () => {
    const syncedNotes = await syncManager.sync();
    setAllNotes(syncedNotes);
  }, []);

  const updateCloudConfig = useCallback(async (config: CloudConfig): Promise<boolean> => {
    setCloudConfig(config);
    await storageAdapter.saveCloudConfig(config);
    const success = await syncManager.initializeWithConfig(config);
    if (success && config.enabled) {
      const synced = await syncManager.sync();
      setAllNotes(synced);
    }
    return success;
  }, []);

  // Export & Import
  const exportMarkdown = useCallback((noteId?: string) => {
    const target = notes.find(n => n.id === (noteId || activeNoteId));
    if (!target) return;

    let md = `# ${target.title || 'Untitled Note'}\n\n`;
    target.blocks.forEach((b, i) => {
      const rawText = b.content.replace(/<[^>]*>/g, '');
      switch (b.type) {
        case 'heading1': md += `# ${rawText}\n\n`; break;
        case 'heading2': md += `## ${rawText}\n\n`; break;
        case 'heading3': md += `### ${rawText}\n\n`; break;
        case 'bullet': md += `- ${rawText}\n`; break;
        case 'numbered': md += `${i + 1}. ${rawText}\n`; break;
        case 'todo': md += `- [${b.checked ? 'x' : ' '}] ${rawText}\n`; break;
        case 'quote': md += `> ${rawText}\n\n`; break;
        case 'code': md += `\`\`\`\n${rawText}\n\`\`\`\n\n`; break;
        case 'divider': md += `---\n\n`; break;
        default: md += `${rawText}\n\n`;
      }
    });

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(target.title || 'untitled').toLowerCase().replace(/\s+/g, '-')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [notes, activeNoteId]);

  const exportBackupJson = useCallback(() => {
    const dataStr = JSON.stringify(notes, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `papernotes-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [notes]);

  const importFile = useCallback((content: string, filename: string): boolean => {
    try {
      if (filename.endsWith('.json')) {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const next = [...parsed, ...allNotes];
          persistNotes(next);
          selectNote(parsed[0].id);
          return true;
        }
      } else {
        const lines = content.split('\n');
        const title = lines[0].replace(/^#+\s*/, '') || filename.replace(/\.[^/.]+$/, '');
        const blocks: Block[] = lines.slice(1).map((l, idx) => ({
          id: generateId('b'),
          type: (l.startsWith('## ') ? 'heading2' : l.startsWith('# ') ? 'heading1' : 'paragraph') as BlockType,
          content: l.replace(/^#+\s*/, ''),
          order: idx,
          updatedAt: new Date().toISOString()
        })).filter(b => b.content.trim().length > 0);

        const newNote: Note = {
          id: generateId('note'),
          title,
          icon: 'file-text',
          hasCover: false,
          coverStyle: 'charcoal-mesh',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          blocks: blocks.length > 0 ? blocks : [{ id: generateId('b'), type: 'paragraph', content: '', order: 0, updatedAt: new Date().toISOString() }]
        };

        const next = [newNote, ...allNotes];
        persistNotes(next);
        selectNote(newNote.id);
        return true;
      }
      return false;
    } catch (e) {
      console.error('Import failed', e);
      return false;
    }
  }, [allNotes, persistNotes, selectNote]);

  const value = useMemo(() => ({
    notes,
    activeNote,
    activeNoteId,
    syncState,
    syncStats,
    cloudConfig,
    theme,
    isSidebarCollapsed,
    isZenMode,
    isSearchOpen,
    isCloudModalOpen,
    isIconPickerOpen,
    focusedBlockId,

    // Page Lock & PIN Security
    unlockedNoteIds,
    isCurrentNoteLocked,
    toggleLockActiveNote,
    unlockNote,
    relockNote,
    changeSecurityPin,

    selectNote,
    createNote,
    deleteNote,
    updateNoteTitle,
    updateNoteIcon,
    toggleNoteCover,
    setCoverStyle,
    updateBlock,
    addBlock,
    deleteBlock,
    reorderBlocks,
    convertBlockType,
    toggleTodo,
    setFocusedBlockId,

    toggleTheme,
    toggleSidebar,
    toggleZenMode,
    setIsSearchOpen,
    setIsCloudModalOpen,
    setIsIconPickerOpen,

    syncNow,
    updateCloudConfig,
    exportMarkdown,
    exportBackupJson,
    importFile
  }), [
    notes,
    activeNote,
    activeNoteId,
    syncState,
    syncStats,
    cloudConfig,
    theme,
    isSidebarCollapsed,
    isZenMode,
    isSearchOpen,
    isCloudModalOpen,
    isIconPickerOpen,
    focusedBlockId,
    unlockedNoteIds,
    isCurrentNoteLocked,
    toggleLockActiveNote,
    unlockNote,
    relockNote,
    changeSecurityPin,
    selectNote,
    createNote,
    deleteNote,
    updateNoteTitle,
    updateNoteIcon,
    toggleNoteCover,
    setCoverStyle,
    updateBlock,
    addBlock,
    deleteBlock,
    reorderBlocks,
    convertBlockType,
    toggleTodo,
    toggleTheme,
    toggleSidebar,
    toggleZenMode,
    syncNow,
    updateCloudConfig,
    exportMarkdown,
    exportBackupJson,
    importFile
  ]);

  return <NotesContext.Provider value={value}>{children}</NotesContext.Provider>;
};

export const useNotes = () => {
  const ctx = useContext(NotesContext);
  if (!ctx) {
    throw new Error('useNotes must be used within a NotesProvider');
  }
  return ctx;
};
