import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  StyleSheet,
  StatusBar,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import type { Note, Block, BlockType, CoverStyle } from './src/domain/Note';
import type { SyncState, CloudConfig, SyncStats } from './src/domain/Sync';
import { AsyncStorageAdapter } from './src/services/storage/AsyncStorageAdapter';
import { MobileSyncManager } from './src/services/sync/SyncManager';

const storage = new AsyncStorageAdapter();
const syncManager = new MobileSyncManager(storage);

function generateId(prefix = 'b'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
}

const COVER_PATTERNS: { id: CoverStyle; label: string }[] = [
  { id: 'charcoal-mesh', label: 'Mesh' },
  { id: 'mono-grid', label: 'Grid' },
  { id: 'slate-gradient', label: 'Gradient' },
  { id: 'minimal-dots', label: 'Dots' }
];

const AVAILABLE_PAGE_ICONS = [
  'zap',
  'file-text',
  'book-open',
  'star',
  'bookmark',
  'target',
  'hash',
  'code',
  'check-circle',
  'compass'
] as const;

export default function App() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [syncState, setSyncState] = useState<SyncState>('local-only');
  const [syncStats, setSyncStats] = useState<SyncStats>(syncManager.getStats());

  // Interactive Block States
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [blockMenuBlockId, setBlockMenuBlockId] = useState<string | null>(null);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);

  // Modals
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSlashOpen, setIsSlashOpen] = useState(false);
  const [isCloudOpen, setIsCloudOpen] = useState(false);
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Cloud credentials form
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState('');
  const [isTestingCloud, setIsTestingCloud] = useState(false);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load notes on mount
  useEffect(() => {
    async function init() {
      const loaded = await storage.loadNotes();
      setNotes(loaded);
      const active = await storage.getActiveNoteId();
      if (active && loaded.some(n => n.id === active)) {
        setActiveNoteId(active);
      } else if (loaded.length > 0) {
        setActiveNoteId(loaded[0].id);
      }

      const cfg = await storage.getCloudConfig();
      if (cfg) {
        setSupabaseUrl(cfg.supabaseUrl || '');
        setSupabaseAnonKey(cfg.supabaseAnonKey || '');
        await syncManager.initializeWithConfig(cfg);
        if (cfg.enabled) {
          const synced = await syncManager.sync();
          setNotes(synced);
        }
      }
    }
    init();

    const unsub = syncManager.subscribe((st, stats) => {
      setSyncState(st);
      setSyncStats(stats);
    });
    return () => unsub();
  }, []);

  const persistNotes = useCallback((updatedNotes: Note[]) => {
    setNotes(updatedNotes);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await storage.saveNotes(updatedNotes);
    }, 400);
  }, []);

  const activeNote = useMemo(() => {
    return notes.find(n => n.id === activeNoteId) || null;
  }, [notes, activeNoteId]);

  const selectNote = (id: string) => {
    setActiveNoteId(id);
    setSelectedBlockId(null);
    storage.setActiveNoteId(id);
    setIsDrawerOpen(false);
  };

  const createNote = () => {
    const newNote: Note = {
      id: generateId('note'),
      title: '',
      icon: 'file-text',
      hasCover: true,
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
    const next = [newNote, ...notes];
    persistNotes(next);
    selectNote(newNote.id);
  };

  const deleteNote = (id: string) => {
    if (notes.length <= 1) {
      Alert.alert('Notice', 'Cannot delete the only page');
      return;
    }
    const next = notes.filter(n => n.id !== id);
    persistNotes(next);
    if (activeNoteId === id) {
      selectNote(next[0].id);
    }
  };

  const updateTitle = (text: string) => {
    if (!activeNoteId) return;
    const now = new Date().toISOString();
    const next = notes.map(n => (n.id === activeNoteId ? { ...n, title: text, updatedAt: now } : n));
    persistNotes(next);
  };

  const updateNoteIcon = (iconName: string) => {
    if (!activeNoteId) return;
    const now = new Date().toISOString();
    const next = notes.map(n => (n.id === activeNoteId ? { ...n, icon: iconName, updatedAt: now } : n));
    persistNotes(next);
    setIsIconPickerOpen(false);
  };

  const updateBlockContent = (blockId: string, content: string) => {
    if (!activeNoteId) return;
    const now = new Date().toISOString();
    const next = notes.map(n => {
      if (n.id !== activeNoteId) return n;
      const blocks = n.blocks.map(b => (b.id === blockId ? { ...b, content, updatedAt: now } : b));
      return { ...n, blocks, updatedAt: now };
    });
    persistNotes(next);
  };

  const toggleTodo = (blockId: string) => {
    if (!activeNoteId) return;
    const now = new Date().toISOString();
    const next = notes.map(n => {
      if (n.id !== activeNoteId) return n;
      const blocks = n.blocks.map(b => (b.id === blockId ? { ...b, checked: !b.checked, updatedAt: now } : b));
      return { ...n, blocks, updatedAt: now };
    });
    persistNotes(next);
  };

  // Move block up or down
  const moveBlock = (index: number, direction: 'up' | 'down') => {
    if (!activeNote) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= activeNote.blocks.length) return;

    const now = new Date().toISOString();
    const next = notes.map(n => {
      if (n.id !== activeNoteId) return n;
      const blocks = [...n.blocks];
      const [moved] = blocks.splice(index, 1);
      blocks.splice(targetIndex, 0, moved);
      blocks.forEach((b, i) => (b.order = i));
      return { ...n, blocks, updatedAt: now };
    });
    persistNotes(next);
  };

  // Add block (either at bottom or below selected block)
  const addBlockBelow = (targetBlockId?: string | null, type: BlockType = 'paragraph') => {
    if (!activeNote || !activeNoteId) return;
    const now = new Date().toISOString();
    const newBlock: Block = {
      id: generateId('b'),
      type,
      content: '',
      order: 0,
      updatedAt: now
    };

    let updatedBlocks: Block[] = [];
    if (targetBlockId) {
      const idx = activeNote.blocks.findIndex(b => b.id === targetBlockId);
      if (idx !== -1) {
        updatedBlocks = [...activeNote.blocks];
        updatedBlocks.splice(idx + 1, 0, newBlock);
      } else {
        updatedBlocks = [...activeNote.blocks, newBlock];
      }
    } else {
      updatedBlocks = [...activeNote.blocks, newBlock];
    }

    updatedBlocks.forEach((b, i) => (b.order = i));
    const next = notes.map(n => (n.id === activeNoteId ? { ...n, blocks: updatedBlocks, updatedAt: now } : n));
    persistNotes(next);
    setSelectedBlockId(newBlock.id);
    setIsSlashOpen(false);
  };

  const duplicateBlock = (blockId: string) => {
    if (!activeNote || !activeNoteId) return;
    const idx = activeNote.blocks.findIndex(b => b.id === blockId);
    if (idx === -1) return;

    const target = activeNote.blocks[idx];
    const now = new Date().toISOString();
    const duplicated: Block = {
      ...target,
      id: generateId('b'),
      content: target.content,
      updatedAt: now
    };

    const updatedBlocks = [...activeNote.blocks];
    updatedBlocks.splice(idx + 1, 0, duplicated);
    updatedBlocks.forEach((b, i) => (b.order = i));

    const next = notes.map(n => (n.id === activeNoteId ? { ...n, blocks: updatedBlocks, updatedAt: now } : n));
    persistNotes(next);
    setSelectedBlockId(duplicated.id);
    setBlockMenuBlockId(null);
  };

  const convertBlockType = (blockId: string, type: BlockType) => {
    if (!activeNoteId) return;
    const now = new Date().toISOString();
    const next = notes.map(n => {
      if (n.id !== activeNoteId) return n;
      const blocks = n.blocks.map(b => (b.id === blockId ? { ...b, type, updatedAt: now } : b));
      return { ...n, blocks, updatedAt: now };
    });
    persistNotes(next);
    setBlockMenuBlockId(null);
  };

  const deleteBlock = (blockId: string) => {
    if (!activeNote || activeNote.blocks.length <= 1) return;
    const now = new Date().toISOString();
    const next = notes.map(n => {
      if (n.id !== activeNoteId) return n;
      const blocks = n.blocks.filter(b => b.id !== blockId);
      blocks.forEach((b, i) => (b.order = i));
      return { ...n, blocks, updatedAt: now };
    });
    persistNotes(next);
    if (selectedBlockId === blockId) {
      setSelectedBlockId(null);
    }
    setBlockMenuBlockId(null);
  };

  // Functional Palette: Cycle cover pattern (Mesh -> Grid -> Gradient -> Dots)
  const cycleCoverPattern = () => {
    if (!activeNote || !activeNoteId) return;
    const current = activeNote.coverStyle || 'charcoal-mesh';
    const currentIndex = COVER_PATTERNS.findIndex(p => p.id === current);
    const nextIndex = (currentIndex + 1) % COVER_PATTERNS.length;
    changeCoverStyle(COVER_PATTERNS[nextIndex].id);
  };

  const changeCoverStyle = (style: CoverStyle) => {
    if (!activeNoteId) return;
    const now = new Date().toISOString();
    const next = notes.map(n => (n.id === activeNoteId ? { ...n, coverStyle: style, updatedAt: now } : n));
    persistNotes(next);
  };

  const handleCloudSave = async () => {
    setIsTestingCloud(true);
    const config: CloudConfig = {
      supabaseUrl: supabaseUrl.trim(),
      supabaseAnonKey: supabaseAnonKey.trim(),
      enabled: true
    };
    await storage.saveCloudConfig(config);
    const success = await syncManager.initializeWithConfig(config);
    if (success) {
      const synced = await syncManager.sync();
      setNotes(synced);
      Alert.alert('Connected', 'Synced seamlessly with Supabase PostgreSQL!');
      setIsCloudOpen(false);
    } else {
      Alert.alert('Connection Failed', 'Please verify your Supabase project URL and anon public key.');
    }
    setIsTestingCloud(false);
  };

  // Theme palettes
  const isDark = theme === 'dark';
  const colors = {
    bgApp: isDark ? '#0c0c0e' : '#fcfcfc',
    bgCard: isDark ? '#141417' : '#ffffff',
    bgSubtle: isDark ? '#1b1b20' : '#f4f4f5',
    bgHover: isDark ? '#23232a' : '#e4e4e7',
    textMain: isDark ? '#f4f4f6' : '#111113',
    textSecondary: isDark ? '#a1a1aa' : '#52525b',
    textMuted: isDark ? '#71717a' : '#9ca3af',
    border: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
    contrast: isDark ? '#ffffff' : '#111113',
    contrastInv: isDark ? '#000000' : '#ffffff',
    coverMesh: isDark ? '#18181b' : '#e4e4e7',
    coverGrid: isDark ? '#121214' : '#fafafa',
    coverGradient: isDark ? '#1c1c22' : '#f0f0f2',
    coverDots: isDark ? '#101012' : '#f9f9fb'
  };

  const filteredNotes = notes.filter(n => {
    if (!searchQuery.trim()) return true;
    return (n.title || '').toLowerCase().includes(searchQuery.toLowerCase());
  });

  const activeBlockIndex = activeNote?.blocks.findIndex(b => b.id === (blockMenuBlockId || selectedBlockId)) ?? -1;

  return (
    <SafeAreaProvider>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bgApp }]} edges={['top', 'left', 'right']}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

        {/* Top Header Bar */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
              onPress={() => setIsDrawerOpen(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="menu" size={17} color={colors.textMain} />
            </TouchableOpacity>

            <View style={styles.breadcrumbCluster}>
              <Text style={[styles.breadcrumbRoot, { color: colors.textMuted }]}>PaperNotes</Text>
              <Text style={[styles.breadcrumbDivider, { color: colors.textMuted }]}>/</Text>
              <Text style={[styles.breadcrumbTitle, { color: colors.textMain }]} numberOfLines={1}>
                {activeNote?.title.trim() || 'Untitled Note'}
              </Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            {/* Cloud Sync Status Button */}
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
              onPress={() => setIsCloudOpen(true)}
            >
              <Feather
                name="cloud"
                size={16}
                color={syncState === 'synced' ? '#22c55e' : colors.textSecondary}
              />
            </TouchableOpacity>

            {/* Icon-Only Theme Toggle */}
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
              onPress={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}
            >
              <Feather name={isDark ? 'sun' : 'moon'} size={15} color={colors.textMain} />
            </TouchableOpacity>

            {/* New Page CTA */}
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: colors.contrast, borderColor: colors.contrast }]}
              onPress={createNote}
            >
              <Feather name="plus" size={17} color={colors.contrastInv} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Main Document Scroll View */}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
        >
          {activeNote ? (
            <TouchableWithoutFeedback onPress={() => setSelectedBlockId(null)}>
              <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
              >
                {/* Flexible Cover Banner with Title INSIDE Cover */}
                <View
                  style={[
                    styles.coverBanner,
                    activeNote.coverStyle === 'mono-grid'
                      ? { backgroundColor: colors.coverGrid, borderColor: colors.border }
                      : activeNote.coverStyle === 'slate-gradient'
                      ? { backgroundColor: colors.coverGradient, borderColor: colors.border }
                      : activeNote.coverStyle === 'minimal-dots'
                      ? { backgroundColor: colors.coverDots, borderColor: colors.border }
                      : { backgroundColor: colors.coverMesh, borderColor: colors.border }
                  ]}
                >
                  {/* Top-Right Cover Action Bar: Functional Palette Button + Pills */}
                  <View style={styles.coverTopBar}>
                    <View style={styles.coverPillsRow}>
                      <TouchableOpacity
                        style={styles.coverPaletteBtn}
                        onPress={cycleCoverPattern}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Feather name="sliders" size={13} color="#ffffff" />
                      </TouchableOpacity>

                      {COVER_PATTERNS.map(p => (
                        <TouchableOpacity
                          key={p.id}
                          onPress={() => changeCoverStyle(p.id)}
                          style={[
                            styles.coverPill,
                            (activeNote.coverStyle || 'charcoal-mesh') === p.id && styles.coverPillActive
                          ]}
                        >
                          <Text
                            style={[
                              styles.coverPillText,
                              (activeNote.coverStyle || 'charcoal-mesh') === p.id && styles.coverPillTextActive
                            ]}
                          >
                            {p.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Page Title Directly On Cover (Same size 32px & bold, flexible height) */}
                  <View style={styles.coverTitleWrapper}>
                    <TextInput
                      style={styles.coverTitleInput}
                      value={activeNote.title}
                      onChangeText={updateTitle}
                      placeholder="Untitled Note"
                      placeholderTextColor="rgba(255, 255, 255, 0.45)"
                      multiline
                      scrollEnabled={false}
                    />
                  </View>
                </View>

                {/* Sub-Cover Actions: Change Icon only (No duplicate title below) */}
                <View style={styles.pageMetaRow}>
                  <TouchableOpacity
                    style={[styles.changeIconPill, { backgroundColor: colors.bgSubtle, borderColor: colors.border }]}
                    onPress={() => setIsIconPickerOpen(true)}
                  >
                    <Feather name={(activeNote.icon as any) || 'file-text'} size={14} color={colors.textMain} />
                    <Text style={[styles.changeIconText, { color: colors.textSecondary }]}>Change icon</Text>
                  </TouchableOpacity>

                  <Text style={[styles.readingMetaText, { color: colors.textMuted }]}>
                    {activeNote.blocks.length} blocks
                  </Text>
                </View>

                {/* Blocks Canvas */}
                <View style={styles.blocksCanvas}>
                  {activeNote.blocks.map((block, idx) => {
                    const isSelected = selectedBlockId === block.id;

                    return (
                      <View key={block.id} style={styles.blockWrapper}>
                        {/* Overlay Toolbar pinned to Top-Left on clicking the component */}
                        {isSelected && (
                          <View style={[styles.blockOverlayToolbar, { backgroundColor: colors.contrast }]}>
                            {/* '+' Button: Add block below */}
                            <TouchableOpacity
                              style={styles.overlayToolBtn}
                              onPress={() => addBlockBelow(block.id, 'paragraph')}
                              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                            >
                              <Feather name="plus" size={13} color={colors.contrastInv} />
                            </TouchableOpacity>

                            {/* '⋮⋮' Pan / Move Handle: Long press or tap to reorder */}
                            <TouchableOpacity
                              style={styles.overlayToolBtn}
                              onPress={() => {
                                setBlockMenuBlockId(block.id);
                                setIsMoveModalOpen(true);
                              }}
                              onLongPress={() => {
                                setBlockMenuBlockId(block.id);
                                setIsMoveModalOpen(true);
                              }}
                              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                            >
                              <Feather name="grid" size={12} color={colors.contrastInv} />
                            </TouchableOpacity>

                            {/* '⋯' 3-Dots Button: Block actions menu */}
                            <TouchableOpacity
                              style={styles.overlayToolBtn}
                              onPress={() => setBlockMenuBlockId(block.id)}
                              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                            >
                              <Feather name="more-horizontal" size={13} color={colors.contrastInv} />
                            </TouchableOpacity>
                          </View>
                        )}

                        {/* Block Item Card */}
                        <TouchableOpacity
                          activeOpacity={0.92}
                          onPress={() => setSelectedBlockId(block.id)}
                          onLongPress={() => {
                            setSelectedBlockId(block.id);
                            setBlockMenuBlockId(block.id);
                            setIsMoveModalOpen(true);
                          }}
                          style={[
                            styles.blockCard,
                            isSelected && { borderColor: colors.textSecondary },
                            block.type === 'callout' && [styles.calloutCard, { backgroundColor: colors.bgCard, borderColor: colors.border }],
                            block.type === 'code' && [styles.codeCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]
                          ]}
                        >
                          <View style={styles.blockInnerRow}>
                            {/* Todo Checkbox */}
                            {block.type === 'todo' && (
                              <TouchableOpacity
                                style={[
                                  styles.checkbox,
                                  { borderColor: colors.border },
                                  block.checked && { backgroundColor: colors.contrast, borderColor: colors.contrast }
                                ]}
                                onPress={() => toggleTodo(block.id)}
                              >
                                {block.checked && <Feather name="check" size={11} color={colors.contrastInv} />}
                              </TouchableOpacity>
                            )}

                            {/* Bullet Point */}
                            {block.type === 'bullet' && (
                              <Text style={[styles.bulletDot, { color: colors.textSecondary }]}>•</Text>
                            )}

                            {/* Quote Border */}
                            {block.type === 'quote' && (
                              <View style={[styles.quoteBar, { backgroundColor: colors.contrast }]} />
                            )}

                            {/* Callout Icon */}
                            {block.type === 'callout' && (
                              <View style={styles.calloutIconBox}>
                                <Feather name="info" size={15} color={colors.textMain} />
                              </View>
                            )}

                            {/* Block Content Input */}
                            <TextInput
                              style={[
                                styles.blockInput,
                                { color: colors.textMain },
                                block.type === 'heading1' && styles.h1Text,
                                block.type === 'heading2' && styles.h2Text,
                                block.type === 'heading3' && styles.h3Text,
                                block.type === 'quote' && { fontStyle: 'italic', color: colors.textSecondary },
                                block.type === 'code' && styles.codeFont,
                                block.checked && styles.completedText
                              ]}
                              value={block.content}
                              onChangeText={txt => updateBlockContent(block.id, txt)}
                              onFocus={() => setSelectedBlockId(block.id)}
                              placeholder={
                                block.type === 'heading1'
                                  ? 'Heading 1'
                                  : block.type === 'heading2'
                                  ? 'Heading 2'
                                  : block.type === 'heading3'
                                  ? 'Heading 3'
                                  : 'Type content...'
                              }
                              placeholderTextColor={colors.textMuted}
                              multiline
                            />
                          </View>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>

                {/* Bottom Add Block Trigger */}
                <TouchableOpacity
                  style={[styles.addBlockTrigger, { borderColor: colors.border }]}
                  onPress={() => addBlockBelow(null, 'paragraph')}
                >
                  <Feather name="plus" size={15} color={colors.textSecondary} />
                  <Text style={[styles.addBlockTriggerText, { color: colors.textSecondary }]}>Add block</Text>
                </TouchableOpacity>

                <View style={{ height: 100 }} />
              </ScrollView>
            </TouchableWithoutFeedback>
          ) : (
            <View style={styles.emptyView}>
              <Feather name="file-text" size={36} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>No page selected</Text>
            </View>
          )}

          {/* Bottom Floating Accessory Bar (Notion Quick Inserter) */}
          {activeNote && (
            <View style={[styles.bottomAccessoryBar, { backgroundColor: colors.bgCard, borderTopColor: colors.border }]}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.accessoryItems}>
                <TouchableOpacity
                  style={[styles.accessoryChip, { backgroundColor: colors.bgSubtle }]}
                  onPress={() => addBlockBelow(selectedBlockId, 'paragraph')}
                >
                  <Feather name="type" size={13} color={colors.textMain} />
                  <Text style={[styles.accessoryChipText, { color: colors.textMain }]}>Text</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.accessoryChip, { backgroundColor: colors.bgSubtle }]}
                  onPress={() => addBlockBelow(selectedBlockId, 'heading1')}
                >
                  <Text style={[styles.accessoryChipText, { color: colors.textMain, fontWeight: 'bold' }]}>H1</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.accessoryChip, { backgroundColor: colors.bgSubtle }]}
                  onPress={() => addBlockBelow(selectedBlockId, 'heading2')}
                >
                  <Text style={[styles.accessoryChipText, { color: colors.textMain, fontWeight: 'bold' }]}>H2</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.accessoryChip, { backgroundColor: colors.bgSubtle }]}
                  onPress={() => addBlockBelow(selectedBlockId, 'todo')}
                >
                  <Feather name="check-square" size={13} color={colors.textMain} />
                  <Text style={[styles.accessoryChipText, { color: colors.textMain }]}>To-do</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.accessoryChip, { backgroundColor: colors.bgSubtle }]}
                  onPress={() => addBlockBelow(selectedBlockId, 'bullet')}
                >
                  <Feather name="list" size={13} color={colors.textMain} />
                  <Text style={[styles.accessoryChipText, { color: colors.textMain }]}>Bullet</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.accessoryChip, { backgroundColor: colors.bgSubtle }]}
                  onPress={() => addBlockBelow(selectedBlockId, 'callout')}
                >
                  <Feather name="info" size={13} color={colors.textMain} />
                  <Text style={[styles.accessoryChipText, { color: colors.textMain }]}>Callout</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.accessoryChip, { backgroundColor: colors.bgSubtle }]}
                  onPress={() => addBlockBelow(selectedBlockId, 'code')}
                >
                  <Feather name="code" size={13} color={colors.textMain} />
                  <Text style={[styles.accessoryChipText, { color: colors.textMain }]}>Code</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.accessoryChip, { backgroundColor: colors.bgSubtle }]}
                  onPress={() => addBlockBelow(selectedBlockId, 'quote')}
                >
                  <Feather name="message-square" size={13} color={colors.textMain} />
                  <Text style={[styles.accessoryChipText, { color: colors.textMain }]}>Quote</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          )}
        </KeyboardAvoidingView>

        {/* Pan / Move Reorder Modal Sheet */}
        <Modal visible={isMoveModalOpen} animationType="fade" transparent>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setIsMoveModalOpen(false)}>
            <View style={[styles.bottomSheetCard, { backgroundColor: colors.bgCard }]}>
              <View style={styles.sheetHandleBar} />
              <Text style={[styles.sheetSectionTitle, { color: colors.textMuted }]}>PAN & REORDER BLOCK</Text>

              <View style={styles.moveActionsRow}>
                <TouchableOpacity
                  style={[
                    styles.moveBigBtn,
                    { backgroundColor: colors.bgSubtle },
                    activeBlockIndex <= 0 && { opacity: 0.35 }
                  ]}
                  disabled={activeBlockIndex <= 0}
                  onPress={() => {
                    if (activeBlockIndex > 0) moveBlock(activeBlockIndex, 'up');
                  }}
                >
                  <Feather name="arrow-up" size={18} color={colors.textMain} />
                  <Text style={[styles.moveBigBtnText, { color: colors.textMain }]}>Move Up</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.moveBigBtn,
                    { backgroundColor: colors.bgSubtle },
                    activeBlockIndex >= (activeNote?.blocks.length ?? 0) - 1 && { opacity: 0.35 }
                  ]}
                  disabled={activeBlockIndex >= (activeNote?.blocks.length ?? 0) - 1}
                  onPress={() => {
                    if (activeNote && activeBlockIndex < activeNote.blocks.length - 1) {
                      moveBlock(activeBlockIndex, 'down');
                    }
                  }}
                >
                  <Feather name="arrow-down" size={18} color={colors.textMain} />
                  <Text style={[styles.moveBigBtnText, { color: colors.textMain }]}>Move Down</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.sheetCloseButton, { backgroundColor: colors.contrast }]}
                onPress={() => setIsMoveModalOpen(false)}
              >
                <Text style={{ color: colors.contrastInv, fontWeight: 'bold' }}>Done</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* 3-Dots Block Options Modal */}
        <Modal visible={Boolean(blockMenuBlockId)} animationType="fade" transparent>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setBlockMenuBlockId(null)}>
            <View style={[styles.bottomSheetCard, { backgroundColor: colors.bgCard }]}>
              <View style={styles.sheetHandleBar} />
              <Text style={[styles.sheetSectionTitle, { color: colors.textMuted }]}>BLOCK OPTIONS</Text>

              <TouchableOpacity
                style={styles.sheetActionRow}
                onPress={() => {
                  if (activeBlockIndex > 0) moveBlock(activeBlockIndex, 'up');
                  setBlockMenuBlockId(null);
                }}
                disabled={activeBlockIndex <= 0}
              >
                <Feather name="arrow-up" size={16} color={activeBlockIndex <= 0 ? colors.border : colors.textMain} />
                <Text style={[styles.sheetActionText, { color: activeBlockIndex <= 0 ? colors.border : colors.textMain }]}>
                  Move Up
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.sheetActionRow}
                onPress={() => {
                  if (activeNote && activeBlockIndex < activeNote.blocks.length - 1) {
                    moveBlock(activeBlockIndex, 'down');
                  }
                  setBlockMenuBlockId(null);
                }}
                disabled={activeBlockIndex >= (activeNote?.blocks.length ?? 0) - 1}
              >
                <Feather
                  name="arrow-down"
                  size={16}
                  color={activeBlockIndex >= (activeNote?.blocks.length ?? 0) - 1 ? colors.border : colors.textMain}
                />
                <Text
                  style={[
                    styles.sheetActionText,
                    { color: activeBlockIndex >= (activeNote?.blocks.length ?? 0) - 1 ? colors.border : colors.textMain }
                  ]}
                >
                  Move Down
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.sheetActionRow}
                onPress={() => {
                  if (blockMenuBlockId) duplicateBlock(blockMenuBlockId);
                }}
              >
                <Feather name="copy" size={16} color={colors.textMain} />
                <Text style={[styles.sheetActionText, { color: colors.textMain }]}>Duplicate Below</Text>
              </TouchableOpacity>

              <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />

              <Text style={[styles.subSectionTitle, { color: colors.textMuted }]}>CONVERT TO</Text>
              <View style={styles.convertChipsGrid}>
                {[
                  { type: 'paragraph', label: 'Text' },
                  { type: 'heading1', label: 'H1' },
                  { type: 'heading2', label: 'H2' },
                  { type: 'heading3', label: 'H3' },
                  { type: 'todo', label: 'To-do' },
                  { type: 'bullet', label: 'Bullet' },
                  { type: 'quote', label: 'Quote' },
                  { type: 'code', label: 'Code' },
                  { type: 'callout', label: 'Callout' }
                ].map(item => (
                  <TouchableOpacity
                    key={item.type}
                    style={[styles.convertChip, { backgroundColor: colors.bgSubtle }]}
                    onPress={() => {
                      if (blockMenuBlockId) convertBlockType(blockMenuBlockId, item.type as BlockType);
                    }}
                  >
                    <Text style={[styles.convertChipText, { color: colors.textMain }]}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />

              <TouchableOpacity
                style={[styles.sheetActionRow, { marginTop: 4 }]}
                onPress={() => {
                  if (blockMenuBlockId) deleteBlock(blockMenuBlockId);
                }}
              >
                <Feather name="trash-2" size={16} color="#ef4444" />
                <Text style={[styles.sheetActionText, { color: '#ef4444' }]}>Delete Block</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Icon Picker Modal */}
        <Modal visible={isIconPickerOpen} animationType="fade" transparent>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setIsIconPickerOpen(false)}>
            <View style={[styles.bottomSheetCard, { backgroundColor: colors.bgCard }]}>
              <View style={styles.sheetHandleBar} />
              <Text style={[styles.sheetSectionTitle, { color: colors.textMuted }]}>CHOOSE DOCUMENT ICON</Text>

              <View style={styles.iconGrid}>
                {AVAILABLE_PAGE_ICONS.map(iconKey => (
                  <TouchableOpacity
                    key={iconKey}
                    style={[
                      styles.iconPickBox,
                      { backgroundColor: colors.bgSubtle, borderColor: colors.border },
                      activeNote?.icon === iconKey && { borderColor: colors.contrast, borderWidth: 2 }
                    ]}
                    onPress={() => updateNoteIcon(iconKey)}
                  >
                    <Feather name={iconKey as any} size={22} color={colors.textMain} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Side Drawer (Pages List) */}
        <Modal visible={isDrawerOpen} animationType="slide" transparent>
          <View style={styles.modalBackdrop}>
            <View style={[styles.drawerCard, { backgroundColor: colors.bgCard }]}>
              <View style={[styles.drawerHeader, { borderBottomColor: colors.border }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Feather name="book-open" size={18} color={colors.textMain} />
                  <Text style={[styles.drawerHeading, { color: colors.textMain }]}>Documents</Text>
                </View>
                <TouchableOpacity onPress={() => setIsDrawerOpen(false)}>
                  <Feather name="x" size={20} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <View style={styles.searchBarWrapper}>
                <Feather name="search" size={15} color={colors.textMuted} />
                <TextInput
                  style={[styles.searchBarInput, { color: colors.textMain }]}
                  placeholder="Filter pages..."
                  placeholderTextColor={colors.textMuted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>

              <ScrollView style={{ flex: 1 }}>
                {filteredNotes.map(n => {
                  const isActive = n.id === activeNoteId;
                  return (
                    <View
                      key={n.id}
                      style={[
                        styles.drawerPageRow,
                        isActive && { backgroundColor: colors.bgSubtle }
                      ]}
                    >
                      <TouchableOpacity style={styles.drawerPageTouchable} onPress={() => selectNote(n.id)}>
                        <Feather
                          name={(n.icon as any) || 'file-text'}
                          size={15}
                          color={isActive ? colors.textMain : colors.textSecondary}
                        />
                        <Text
                          style={[
                            styles.drawerPageTitle,
                            { color: isActive ? colors.textMain : colors.textSecondary },
                            isActive && { fontWeight: '700' }
                          ]}
                          numberOfLines={1}
                        >
                          {n.title.trim() || 'Untitled Note'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => deleteNote(n.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={{ padding: 4 }}
                      >
                        <Feather name="trash-2" size={14} color={colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </ScrollView>

              <TouchableOpacity
                style={[styles.newNoteBtn, { backgroundColor: colors.contrast }]}
                onPress={() => {
                  createNote();
                  setIsDrawerOpen(false);
                }}
              >
                <Feather name="plus" size={16} color={colors.contrastInv} />
                <Text style={[styles.newNoteBtnText, { color: colors.contrastInv }]}>New Page</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Cloud Sync Setup Modal */}
        <Modal visible={isCloudOpen} animationType="slide" transparent>
          <View style={styles.modalBackdrop}>
            <View style={[styles.cloudModalCard, { backgroundColor: colors.bgCard }]}>
              <View style={[styles.drawerHeader, { borderBottomColor: colors.border }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Feather name="cloud" size={18} color={colors.textMain} />
                  <Text style={[styles.drawerHeading, { color: colors.textMain }]}>Cloud Sync</Text>
                </View>
                <TouchableOpacity onPress={() => setIsCloudOpen(false)}>
                  <Feather name="x" size={20} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.cloudModalDesc, { color: colors.textSecondary }]}>
                Connect to your free Supabase PostgreSQL database to sync across desktop and mobile.
              </Text>

              <TextInput
                style={[styles.cloudInput, { backgroundColor: colors.bgApp, color: colors.textMain, borderColor: colors.border }]}
                placeholder="Supabase Project URL"
                placeholderTextColor={colors.textMuted}
                value={supabaseUrl}
                onChangeText={setSupabaseUrl}
                autoCapitalize="none"
              />

              <TextInput
                style={[styles.cloudInput, { backgroundColor: colors.bgApp, color: colors.textMain, borderColor: colors.border }]}
                placeholder="Supabase Anon Key"
                placeholderTextColor={colors.textMuted}
                value={supabaseAnonKey}
                onChangeText={setSupabaseAnonKey}
                secureTextEntry
                autoCapitalize="none"
              />

              <TouchableOpacity
                style={[styles.cloudSaveBtn, { backgroundColor: colors.contrast }]}
                onPress={handleCloudSave}
                disabled={isTestingCloud}
              >
                <Text style={{ color: colors.contrastInv, fontWeight: 'bold' }}>
                  {isTestingCloud ? 'Connecting...' : 'Save & Sync'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderBottomWidth: 1
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  breadcrumbCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
    marginRight: 6
  },
  breadcrumbRoot: {
    fontSize: 13,
    fontWeight: '600'
  },
  breadcrumbDivider: {
    fontSize: 13
  },
  breadcrumbTitle: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1
  },
  scrollView: {
    flex: 1
  },
  scrollContent: {
    paddingBottom: 40
  },
  // Cover Banner
  coverBanner: {
    width: '100%',
    minHeight: 175,
    borderBottomWidth: 1,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 20,
    justifyContent: 'space-between'
  },
  coverTopBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    width: '100%'
  },
  coverPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderRadius: 6,
    padding: 3
  },
  coverPaletteBtn: {
    width: 24,
    height: 24,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 2
  },
  coverPill: {
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 4
  },
  coverPillActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)'
  },
  coverPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#a1a1aa'
  },
  coverPillTextActive: {
    color: '#ffffff'
  },
  coverTitleWrapper: {
    width: '100%',
    marginTop: 18
  },
  coverTitleInput: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.6,
    lineHeight: 38,
    color: '#ffffff',
    textShadowColor: 'rgba(0, 0, 0, 0.85)',
    textShadowRadius: 6,
    padding: 0,
    margin: 0
  },
  // Sub-Cover Meta
  pageMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 6
  },
  changeIconPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 10
  },
  changeIconText: {
    fontSize: 12,
    fontWeight: '500'
  },
  readingMetaText: {
    fontSize: 11,
    fontWeight: '500'
  },
  // Blocks Canvas
  blocksCanvas: {
    paddingHorizontal: 14,
    paddingTop: 8,
    gap: 6
  },
  blockWrapper: {
    position: 'relative',
    marginVertical: 2
  },
  // Overlay Toolbar on Top-Left
  blockOverlayToolbar: {
    position: 'absolute',
    top: -14,
    left: 8,
    zIndex: 50,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 6,
    paddingHorizontal: 4,
    paddingVertical: 2,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5
  },
  overlayToolBtn: {
    padding: 3
  },
  blockCard: {
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 7,
    paddingVertical: 6,
    paddingHorizontal: 8
  },
  calloutCard: {
    borderWidth: 1,
    padding: 10
  },
  codeCard: {
    borderWidth: 1,
    padding: 10
  },
  blockInnerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 3
  },
  bulletDot: {
    fontSize: 18,
    lineHeight: 22,
    marginTop: -1
  },
  quoteBar: {
    width: 3,
    alignSelf: 'stretch',
    borderRadius: 2,
    marginRight: 4
  },
  calloutIconBox: {
    marginTop: 2
  },
  blockInput: {
    flex: 1,
    fontSize: 15.5,
    lineHeight: 22,
    padding: 0,
    margin: 0
  },
  h1Text: {
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 29
  },
  h2Text: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 25
  },
  h3Text: {
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 22
  },
  completedText: {
    textDecorationLine: 'line-through',
    opacity: 0.45
  },
  codeFont: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 13.5
  },
  addBlockTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: 14,
    marginTop: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 8
  },
  addBlockTriggerText: {
    fontSize: 13,
    fontWeight: '600'
  },
  // Bottom Floating Bar
  bottomAccessoryBar: {
    height: 46,
    borderTopWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 8
  },
  accessoryItems: {
    alignItems: 'center',
    gap: 6
  },
  accessoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6
  },
  accessoryChipText: {
    fontSize: 12,
    fontWeight: '600'
  },
  // Modals & Bottom Sheets
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end'
  },
  bottomSheetCard: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    paddingBottom: 32
  },
  sheetHandleBar: {
    width: 36,
    height: 4,
    backgroundColor: 'rgba(128, 128, 128, 0.4)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12
  },
  sheetSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 12
  },
  moveActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14
  },
  moveBigBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8
  },
  moveBigBtnText: {
    fontSize: 14,
    fontWeight: '600'
  },
  sheetCloseButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  sheetActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11
  },
  sheetActionText: {
    fontSize: 14,
    fontWeight: '500'
  },
  menuDivider: {
    height: 1,
    marginVertical: 10
  },
  subSectionTitle: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 8
  },
  convertChipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  convertChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6
  },
  convertChipText: {
    fontSize: 12,
    fontWeight: '600'
  },
  // Icon Picker
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
    paddingVertical: 8
  },
  iconPickBox: {
    width: 52,
    height: 52,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  // Drawer
  drawerCard: {
    height: '85%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    marginBottom: 10
  },
  drawerHeading: {
    fontSize: 16,
    fontWeight: '700'
  },
  searchBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 38,
    marginBottom: 10
  },
  searchBarInput: {
    flex: 1,
    fontSize: 13.5
  },
  drawerPageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginVertical: 1
  },
  drawerPageTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1
  },
  drawerPageTitle: {
    fontSize: 13.5
  },
  newNoteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 10
  },
  newNoteBtnText: {
    fontSize: 14,
    fontWeight: '700'
  },
  // Cloud Modal
  cloudModalCard: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    paddingBottom: 32
  },
  cloudModalDesc: {
    fontSize: 12.5,
    lineHeight: 18,
    marginBottom: 14
  },
  cloudInput: {
    height: 42,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 13.5,
    marginBottom: 10
  },
  cloudSaveBtn: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6
  },
  emptyView: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingTop: 80
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '500'
  }
});
