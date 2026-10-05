import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  StyleSheet,
  StatusBar,
  Alert
} from 'react-native';
import type { Note, Block, BlockType, CoverStyle } from './src/domain/Note';
import type { SyncState, CloudConfig, SyncStats } from './src/domain/Sync';
import { AsyncStorageAdapter } from './src/services/storage/AsyncStorageAdapter';
import { MobileSyncManager } from './src/services/sync/SyncManager';

const storage = new AsyncStorageAdapter();
const syncManager = new MobileSyncManager(storage);

function generateId(prefix = 'b'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
}

export default function App() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [syncState, setSyncState] = useState<SyncState>('local-only');
  const [syncStats, setSyncStats] = useState<SyncStats>(syncManager.getStats());

  // Modals
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSlashOpen, setIsSlashOpen] = useState(false);
  const [isCloudOpen, setIsCloudOpen] = useState(false);
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
    storage.setActiveNoteId(id);
    setIsDrawerOpen(false);
  };

  const createNote = () => {
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
    const next = notes.map(n => n.id === activeNoteId ? { ...n, title: text, updatedAt: now } : n);
    persistNotes(next);
  };

  const updateBlockContent = (blockId: string, content: string) => {
    if (!activeNoteId) return;
    const now = new Date().toISOString();
    const next = notes.map(n => {
      if (n.id !== activeNoteId) return n;
      const blocks = n.blocks.map(b => b.id === blockId ? { ...b, content, updatedAt: now } : b);
      return { ...n, blocks, updatedAt: now };
    });
    persistNotes(next);
  };

  const toggleTodo = (blockId: string) => {
    if (!activeNoteId) return;
    const now = new Date().toISOString();
    const next = notes.map(n => {
      if (n.id !== activeNoteId) return n;
      const blocks = n.blocks.map(b => b.id === blockId ? { ...b, checked: !b.checked, updatedAt: now } : b);
      return { ...n, blocks, updatedAt: now };
    });
    persistNotes(next);
  };

  // Reorder Pan function (Move Up / Down)
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
      blocks.forEach((b, i) => b.order = i);
      return { ...n, blocks, updatedAt: now };
    });
    persistNotes(next);
  };

  const addBlock = (type: BlockType = 'paragraph') => {
    if (!activeNoteId) return;
    const now = new Date().toISOString();
    const newBlock: Block = {
      id: generateId('b'),
      type,
      content: '',
      order: activeNote ? activeNote.blocks.length : 0,
      updatedAt: now
    };
    const next = notes.map(n => {
      if (n.id !== activeNoteId) return n;
      return { ...n, blocks: [...n.blocks, newBlock], updatedAt: now };
    });
    persistNotes(next);
    setIsSlashOpen(false);
  };

  const deleteBlock = (blockId: string) => {
    if (!activeNote || activeNote.blocks.length <= 1) return;
    const now = new Date().toISOString();
    const next = notes.map(n => {
      if (n.id !== activeNoteId) return n;
      const blocks = n.blocks.filter(b => b.id !== blockId);
      blocks.forEach((b, i) => b.order = i);
      return { ...n, blocks, updatedAt: now };
    });
    persistNotes(next);
  };

  const toggleCover = () => {
    if (!activeNoteId) return;
    const now = new Date().toISOString();
    const next = notes.map(n => n.id === activeNoteId ? {
      ...n,
      hasCover: !n.hasCover,
      updatedAt: now
    } : n);
    persistNotes(next);
  };

  const changeCoverStyle = (style: CoverStyle) => {
    if (!activeNoteId) return;
    const now = new Date().toISOString();
    const next = notes.map(n => n.id === activeNoteId ? { ...n, coverStyle: style, updatedAt: now } : n);
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
      Alert.alert('Success', 'Connected to Supabase PostgreSQL and synced!');
      setIsCloudOpen(false);
    } else {
      Alert.alert('Error', 'Connection failed. Please check your credentials & table setup.');
    }
    setIsTestingCloud(false);
  };

  const isDark = theme === 'dark';
  const colors = {
    bgApp: isDark ? '#09090b' : '#ffffff',
    bgCard: isDark ? '#141417' : '#f4f4f5',
    bgSubtle: isDark ? '#1c1c21' : '#eaecee',
    textMain: isDark ? '#f4f4f5' : '#09090b',
    textSecondary: isDark ? '#a1a1aa' : '#52525b',
    textMuted: isDark ? '#71717a' : '#9ca3af',
    border: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
    contrast: isDark ? '#ffffff' : '#09090b',
    contrastInv: isDark ? '#000000' : '#ffffff'
  };

  const filteredNotes = notes.filter(n => {
    if (!searchQuery.trim()) return true;
    return (n.title || '').toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgApp }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: colors.bgCard }]}
            onPress={() => setIsDrawerOpen(true)}
          >
            <Text style={[styles.iconText, { color: colors.textMain }]}>☰</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.textMain }]} numberOfLines={1}>
            {activeNote?.title.trim() || 'Untitled Note'}
          </Text>
        </View>

        <View style={styles.headerRight}>
          {/* Cloud Sync Status */}
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: colors.bgCard }]}
            onPress={() => setIsCloudOpen(true)}
          >
            <Text style={{ fontSize: 13, color: syncState === 'synced' ? '#22c55e' : colors.textSecondary }}>
              {syncState === 'synced' ? '☁✓' : '☁'}
            </Text>
          </TouchableOpacity>

          {/* Theme toggle: Icon only */}
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: colors.bgCard }]}
            onPress={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}
          >
            <Text style={{ fontSize: 14, color: colors.textMain }}>{isDark ? '☀' : '☾'}</Text>
          </TouchableOpacity>

          {/* New Page */}
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: colors.contrast }]}
            onPress={createNote}
          >
            <Text style={{ fontSize: 16, color: colors.contrastInv, fontWeight: 'bold' }}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Document Viewport */}
      {activeNote ? (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Cover Banner */}
          {activeNote.hasCover && (
            <View style={[styles.coverBanner, { backgroundColor: colors.bgCard }]}>
              <View style={styles.coverControls}>
                <TouchableOpacity onPress={() => changeCoverStyle('charcoal-mesh')} style={styles.coverStyleBtn}>
                  <Text style={styles.coverStyleText}>Mesh</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => changeCoverStyle('mono-grid')} style={styles.coverStyleBtn}>
                  <Text style={styles.coverStyleText}>Grid</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => changeCoverStyle('slate-gradient')} style={styles.coverStyleBtn}>
                  <Text style={styles.coverStyleText}>Gradient</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={toggleCover} style={[styles.coverStyleBtn, { backgroundColor: '#ef4444' }]}>
                  <Text style={[styles.coverStyleText, { color: '#ffffff' }]}>Remove</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Page Meta Controls */}
          <View style={styles.metaRow}>
            <TouchableOpacity onPress={toggleCover} style={[styles.pillBtn, { borderColor: colors.border }]}>
              <Text style={[styles.pillText, { color: colors.textSecondary }]}>
                {activeNote.hasCover ? 'Remove cover' : '+ Add cover'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Title Input */}
          <TextInput
            style={[styles.titleInput, { color: colors.textMain }]}
            value={activeNote.title}
            onChangeText={updateTitle}
            placeholder="Untitled Note"
            placeholderTextColor={colors.textMuted}
            multiline={false}
          />

          {/* Blocks List */}
          <View style={styles.blocksList}>
            {activeNote.blocks.map((block, idx) => (
              <View key={block.id} style={styles.blockRow}>
                {/* Pan Reorder Actions */}
                <View style={styles.blockGutter}>
                  <TouchableOpacity
                    onPress={() => moveBlock(idx, 'up')}
                    disabled={idx === 0}
                    style={styles.gutterBtn}
                  >
                    <Text style={{ color: idx === 0 ? colors.border : colors.textMuted, fontSize: 11 }}>▲</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => moveBlock(idx, 'down')}
                    disabled={idx === activeNote.blocks.length - 1}
                    style={styles.gutterBtn}
                  >
                    <Text style={{ color: idx === activeNote.blocks.length - 1 ? colors.border : colors.textMuted, fontSize: 11 }}>▼</Text>
                  </TouchableOpacity>
                </View>

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
                    {block.checked && <Text style={{ color: colors.contrastInv, fontSize: 11, fontWeight: 'bold' }}>✓</Text>}
                  </TouchableOpacity>
                )}

                {/* Bullet indicator */}
                {block.type === 'bullet' && (
                  <Text style={[styles.bulletGlyph, { color: colors.textSecondary }]}>•</Text>
                )}

                {/* Block Content Input */}
                <TextInput
                  style={[
                    styles.blockInput,
                    { color: colors.textMain },
                    block.type === 'heading1' && styles.h1,
                    block.type === 'heading2' && styles.h2,
                    block.type === 'heading3' && styles.h3,
                    block.type === 'quote' && [styles.quote, { borderLeftColor: colors.contrast, color: colors.textSecondary }],
                    block.type === 'code' && [styles.code, { backgroundColor: colors.bgCard }],
                    block.type === 'callout' && [styles.callout, { backgroundColor: colors.bgCard, borderColor: colors.border }],
                    block.checked && styles.completed
                  ]}
                  value={block.content}
                  onChangeText={txt => updateBlockContent(block.id, txt)}
                  placeholder={block.type === 'heading1' ? 'Heading 1' : 'Type here...'}
                  placeholderTextColor={colors.textMuted}
                  multiline
                />

                {/* Delete Block */}
                <TouchableOpacity onPress={() => deleteBlock(block.id)} style={styles.deleteBlockBtn}>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>

          {/* Add Block Trigger Button */}
          <TouchableOpacity
            style={[styles.addBlockTrigger, { borderColor: colors.border }]}
            onPress={() => setIsSlashOpen(true)}
          >
            <Text style={[styles.addBlockText, { color: colors.textSecondary }]}>+ Add Block (Slash command)</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <View style={styles.emptyView}>
          <Text style={{ color: colors.textMuted }}>No document selected.</Text>
        </View>
      )}

      {/* Side Drawer Modal */}
      <Modal visible={isDrawerOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.drawerContent, { backgroundColor: colors.bgCard }]}>
            <View style={styles.drawerHeader}>
              <Text style={[styles.drawerTitle, { color: colors.textMain }]}>Pages</Text>
              <TouchableOpacity onPress={() => setIsDrawerOpen(false)}>
                <Text style={{ color: colors.textMuted, fontSize: 18 }}>✕</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={[styles.searchInput, { backgroundColor: colors.bgApp, color: colors.textMain, borderColor: colors.border }]}
              placeholder="Search pages..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />

            <ScrollView style={{ flex: 1 }}>
              {filteredNotes.map(n => (
                <View key={n.id} style={[styles.pageRow, n.id === activeNoteId && { backgroundColor: colors.bgSubtle }]}>
                  <TouchableOpacity style={{ flex: 1 }} onPress={() => selectNote(n.id)}>
                    <Text style={[styles.pageRowTitle, { color: colors.textMain }]}>
                      {n.title.trim() || 'Untitled Note'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => deleteNote(n.id)} style={{ padding: 6 }}>
                    <Text style={{ color: '#ef4444', fontSize: 12 }}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={[styles.newNoteBtn, { backgroundColor: colors.contrast }]}
              onPress={() => {
                createNote();
                setIsDrawerOpen(false);
              }}
            >
              <Text style={{ color: colors.contrastInv, fontWeight: 'bold' }}>+ New Page</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Slash Command / Block Picker Sheet */}
      <Modal visible={isSlashOpen} animationType="fade" transparent>
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setIsSlashOpen(false)}>
          <View style={[styles.sheetContent, { backgroundColor: colors.bgCard }]}>
            <Text style={[styles.sheetTitle, { color: colors.textMuted }]}>INSERT BLOCK</Text>
            {[
              { type: 'paragraph', label: 'Text (Paragraph)' },
              { type: 'heading1', label: 'Heading 1' },
              { type: 'heading2', label: 'Heading 2' },
              { type: 'heading3', label: 'Heading 3' },
              { type: 'todo', label: 'To-do List Item' },
              { type: 'bullet', label: 'Bulleted List' },
              { type: 'code', label: 'Code Block' },
              { type: 'quote', label: 'Quote' },
              { type: 'callout', label: 'Callout Box' }
            ].map(item => (
              <TouchableOpacity
                key={item.type}
                style={[styles.sheetItem, { borderBottomColor: colors.border }]}
                onPress={() => addBlock(item.type as BlockType)}
              >
                <Text style={[styles.sheetItemText, { color: colors.textMain }]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Cloud Sync Setup Modal */}
      <Modal visible={isCloudOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.cloudModalContent, { backgroundColor: colors.bgCard }]}>
            <View style={styles.drawerHeader}>
              <Text style={[styles.drawerTitle, { color: colors.textMain }]}>Cloud Sync (Supabase)</Text>
              <TouchableOpacity onPress={() => setIsCloudOpen(false)}>
                <Text style={{ color: colors.textMuted, fontSize: 18 }}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalDesc, { color: colors.textSecondary }]}>
              Connect your free 500MB Supabase PostgreSQL database to sync seamlessly with the web version.
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
    paddingHorizontal: 14,
    borderBottomWidth: 1
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center'
  },
  iconText: {
    fontSize: 18
  },
  scrollView: {
    flex: 1
  },
  scrollContent: {
    padding: 18,
    paddingBottom: 80
  },
  coverBanner: {
    height: 140,
    borderRadius: 8,
    marginBottom: 16,
    justifyContent: 'flex-end',
    padding: 8
  },
  coverControls: {
    flexDirection: 'row',
    gap: 6,
    alignSelf: 'flex-end'
  },
  coverStyleBtn: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4
  },
  coverStyleText: {
    color: '#ffffff',
    fontSize: 11
  },
  metaRow: {
    flexDirection: 'row',
    marginBottom: 8
  },
  pillBtn: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12
  },
  pillText: {
    fontSize: 12
  },
  titleInput: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 16,
    paddingVertical: 4
  },
  blocksList: {
    gap: 8
  },
  blockRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6
  },
  blockGutter: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
    marginTop: 2
  },
  gutterBtn: {
    paddingHorizontal: 4,
    paddingVertical: 2
  },
  checkbox: {
    width: 18,
    height: 18,
    borderWidth: 1.5,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4
  },
  bulletGlyph: {
    fontSize: 18,
    marginRight: 4,
    lineHeight: 22
  },
  blockInput: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    paddingVertical: 2
  },
  h1: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 8
  },
  h2: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 6
  },
  h3: {
    fontSize: 17,
    fontWeight: '600',
    marginTop: 4
  },
  quote: {
    borderLeftWidth: 3,
    paddingLeft: 10,
    fontStyle: 'italic'
  },
  code: {
    fontFamily: 'monospace',
    padding: 8,
    borderRadius: 6,
    fontSize: 13
  },
  callout: {
    padding: 10,
    borderRadius: 6,
    borderWidth: 1
  },
  completed: {
    textDecorationLine: 'line-through',
    opacity: 0.5
  },
  deleteBlockBtn: {
    padding: 4,
    marginTop: 2
  },
  addBlockTrigger: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 18
  },
  addBlockText: {
    fontSize: 13,
    fontWeight: '500'
  },
  emptyView: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end'
  },
  drawerContent: {
    width: '85%',
    height: '100%',
    padding: 20
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  drawerTitle: {
    fontSize: 18,
    fontWeight: 'bold'
  },
  searchInput: {
    height: 40,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    marginBottom: 12,
    fontSize: 14
  },
  pageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 6
  },
  pageRowTitle: {
    fontSize: 14,
    fontWeight: '500'
  },
  newNoteBtn: {
    height: 44,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10
  },
  sheetContent: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20
  },
  sheetTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 10,
    letterSpacing: 0.5
  },
  sheetItem: {
    paddingVertical: 12,
    borderBottomWidth: 1
  },
  sheetItemText: {
    fontSize: 15,
    fontWeight: '500'
  },
  cloudModalContent: {
    margin: 20,
    borderRadius: 12,
    padding: 20
  },
  modalDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14
  },
  cloudInput: {
    height: 42,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    marginBottom: 10,
    fontSize: 13
  },
  cloudSaveBtn: {
    height: 44,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6
  }
});
