import React, { useRef } from 'react';
import { useNotes } from '../../state/NotesContext';
import { AppIcon } from '../../domain/Icon';
import {
  PanelLeftClose,
  Search,
  Plus,
  Sun,
  Moon,
  Cloud,
  CloudCheck,
  CloudAlert,
  CloudOff,
  RefreshCw,
  Download,
  Upload,
  X
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const {
    notes,
    activeNoteId,
    theme,
    syncState,
    isSidebarCollapsed,
    selectNote,
    createNote,
    deleteNote,
    toggleTheme,
    toggleSidebar,
    setIsSearchOpen,
    setIsCloudModalOpen,
    exportBackupJson,
    importFile
  } = useNotes();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const getSyncIcon = () => {
    switch (syncState) {
      case 'syncing':
        return <RefreshCw size={15} className="spin text-secondary" />;
      case 'synced':
        return <CloudCheck size={15} className="text-success" />;
      case 'error':
        return <CloudAlert size={15} className="text-danger" />;
      case 'offline':
        return <CloudOff size={15} className="text-muted" />;
      default:
        return <Cloud size={15} className="text-secondary" />;
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      const content = event.target?.result as string;
      if (content) {
        importFile(content, file.name);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <>
      {/* Mobile Backdrop */}
      <div
        className={`mobile-sidebar-backdrop ${!isSidebarCollapsed ? 'visible' : ''}`}
        onClick={toggleSidebar}
      />

      <aside className={`workspace-sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        {/* Workspace Brand Header */}
        <div className="sidebar-brand-row">
          <div className="workspace-brand">
            <div className="brand-dot-box">
              <span className="brand-inner-dot" />
            </div>
            <span className="brand-title">PaperNotes</span>
            <span className="brand-badge">Personal</span>
          </div>

          <button
            className="sidebar-icon-btn"
            onClick={toggleSidebar}
            title="Collapse sidebar (⌘ \)"
            type="button"
          >
            <PanelLeftClose size={16} />
          </button>
        </div>

        {/* Action Controls */}
        <div className="sidebar-action-controls">
          <button
            className="sidebar-control-btn"
            onClick={() => setIsSearchOpen(true)}
            type="button"
          >
            <Search size={14} />
            <span>Search</span>
            <kbd className="sidebar-kbd">⌘ K</kbd>
          </button>

          <button
            className="sidebar-control-btn primary"
            onClick={() => createNote()}
            type="button"
          >
            <Plus size={14} />
            <span>New page</span>
            <kbd className="sidebar-kbd">⌘ N</kbd>
          </button>
        </div>

        {/* Pages Tree Section */}
        <div className="sidebar-pages-section">
          <div className="pages-section-header">
            <span>Pages</span>
            <span className="pages-count">{notes.length}</span>
          </div>

          <div className="sidebar-pages-list">
            {notes.map(note => {
              const isActive = note.id === activeNoteId;
              const title = note.title.trim() || 'Untitled Note';

              return (
                <div
                  key={note.id}
                  className={`page-tree-item ${isActive ? 'active' : ''}`}
                  onClick={() => selectNote(note.id)}
                >
                  <div className="page-item-icon">
                    <AppIcon name={note.icon} size={15} />
                  </div>
                  <span className="page-item-title">{title}</span>

                  <button
                    className="page-item-delete"
                    onClick={e => {
                      e.stopPropagation();
                      deleteNote(note.id);
                    }}
                    title="Delete page"
                    type="button"
                  >
                    <X size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Minimalist Monochrome Footer */}
        <div className="sidebar-minimal-footer">
          <div className="footer-button-cluster">
            {/* Theme Toggle Button - Icon only, no text label */}
            <button
              className="footer-action-btn icon-only"
              onClick={toggleTheme}
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
              type="button"
            >
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>

            {/* Cloud Sync Button */}
            <button
              className="footer-action-btn"
              onClick={() => setIsCloudModalOpen(true)}
              title="Cloud Sync settings"
              type="button"
            >
              {getSyncIcon()}
              <span>Sync</span>
            </button>

            {/* Backup JSON Button */}
            <button
              className="footer-action-btn"
              onClick={exportBackupJson}
              title="Backup workspace JSON"
              type="button"
            >
              <Download size={14} />
              <span>Backup</span>
            </button>

            {/* Import Button */}
            <button
              className="footer-action-btn"
              onClick={() => fileInputRef.current?.click()}
              title="Import .md or .json"
              type="button"
            >
              <Upload size={14} />
              <span>Import</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.md,.txt"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />
          </div>
        </div>
      </aside>
    </>
  );
};
