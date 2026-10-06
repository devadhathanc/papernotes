import React from 'react';
import { useNotes } from '../../state/NotesContext';
import {
  PanelLeft,
  FileDown,
  Trash2,
  Maximize2,
  Minimize2,
  Cloud,
  CloudCheck,
  CloudAlert,
  RefreshCw,
  Check,
  Lock,
  Unlock
} from 'lucide-react';

export const TopNav: React.FC = () => {
  const {
    activeNote,
    syncState,
    isSidebarCollapsed,
    isZenMode,
    toggleSidebar,
    toggleZenMode,
    deleteNote,
    toggleLockActiveNote,
    exportMarkdown,
    setIsCloudModalOpen
  } = useNotes();

  const getWordCountAndReadTime = () => {
    if (!activeNote) return { words: 0, time: 1 };
    let full = activeNote.title + ' ';
    activeNote.blocks.forEach(b => {
      full += b.content.replace(/<[^>]*>/g, ' ') + ' ';
    });
    const words = full.trim().split(/\s+/).filter(Boolean).length;
    const time = Math.max(1, Math.ceil(words / 200));
    return { words, time };
  };

  const { words, time } = getWordCountAndReadTime();

  return (
    <header className="workspace-top-nav">
      <div className="top-nav-left-cluster">
        {/* Toggle / Expand Sidebar */}
        <button
          className={`top-nav-icon-btn ${isSidebarCollapsed ? 'visible-always' : 'mobile-only'}`}
          onClick={toggleSidebar}
          title="Open sidebar"
          type="button"
        >
          <PanelLeft size={16} />
        </button>

        {/* Breadcrumb path */}
        <div className="top-nav-breadcrumbs">
          <span className="crumb-root">PaperNotes</span>
          <span className="crumb-divider">/</span>
          <span className="crumb-title">{activeNote?.title.trim() || 'Untitled Note'}</span>
        </div>
      </div>

      <div className="top-nav-right-cluster">
        {/* Autosave badge */}
        <div className="save-status-pill">
          <Check size={11} strokeWidth={3} />
          <span>Saved</span>
        </div>

        {/* Word count & Reading time */}
        <div className="meta-reading-stats">
          <span>{words} {words === 1 ? 'word' : 'words'}</span>
          <span className="stat-separator">•</span>
          <span>{time} min read</span>
        </div>

        {/* Cloud Sync Status Quick Trigger */}
        <button
          className={`top-nav-icon-btn sync-${syncState}`}
          onClick={() => setIsCloudModalOpen(true)}
          title={`Cloud status: ${syncState}`}
          type="button"
        >
          {syncState === 'syncing' && <RefreshCw size={15} className="spin" />}
          {syncState === 'synced' && <CloudCheck size={15} />}
          {syncState === 'error' && <CloudAlert size={15} />}
          {(syncState === 'local-only' || syncState === 'offline') && <Cloud size={15} />}
        </button>

        {/* Lock / Unlock current note */}
        {activeNote && (
          <button
            className={`top-nav-icon-btn ${activeNote.isLocked ? 'active-lock' : ''}`}
            onClick={toggleLockActiveNote}
            title={activeNote.isLocked ? 'Page is locked (click to toggle lock)' : 'Lock this page with PIN'}
            type="button"
          >
            {activeNote.isLocked ? <Lock size={15} style={{ color: '#ef4444' }} /> : <Unlock size={15} />}
          </button>
        )}

        {/* Export Markdown */}
        <button
          className="top-nav-icon-btn"
          onClick={() => exportMarkdown()}
          title="Export note as Markdown (.md)"
          type="button"
        >
          <FileDown size={15} />
        </button>

        {/* Delete current note */}
        <button
          className="top-nav-icon-btn"
          onClick={() => activeNote && deleteNote(activeNote.id)}
          title="Delete current note"
          type="button"
        >
          <Trash2 size={15} />
        </button>

        {/* Zen / Focus Mode */}
        <button
          className="top-nav-icon-btn"
          onClick={toggleZenMode}
          title={isZenMode ? 'Exit Zen Mode' : 'Enter Zen Mode'}
          type="button"
        >
          {isZenMode ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
        </button>
      </div>
    </header>
  );
};
