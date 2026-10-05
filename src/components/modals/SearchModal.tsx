import React, { useState, useEffect } from 'react';
import { useNotes } from '../../state/NotesContext';
import { AppIcon } from '../../domain/Icon';
import { Search, X } from 'lucide-react';

export const SearchModal: React.FC = () => {
  const { notes, isSearchOpen, setIsSearchOpen, selectNote } = useNotes();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      } else if (e.key === 'Escape' && isSearchOpen) {
        setIsSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen, setIsSearchOpen]);

  if (!isSearchOpen) return null;

  const q = query.trim().toLowerCase();
  const filtered = notes.filter(n => {
    if (!q) return true;
    const titleMatch = (n.title || 'Untitled').toLowerCase().includes(q);
    const contentMatch = n.blocks.some(b => b.content.toLowerCase().includes(q));
    return titleMatch || contentMatch;
  });

  const handleSelect = (noteId: string) => {
    selectNote(noteId);
    setIsSearchOpen(false);
  };

  return (
    <div className="modal-backdrop-scrim" onClick={() => setIsSearchOpen(false)}>
      <div className="search-palette-modal" onClick={e => e.stopPropagation()}>
        <div className="search-input-header">
          <Search size={16} className="text-secondary" />
          <input
            type="text"
            className="search-palette-input"
            placeholder="Search pages or content..."
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            autoFocus
          />
          <button
            className="search-close-btn"
            onClick={() => setIsSearchOpen(false)}
            type="button"
          >
            <X size={15} />
          </button>
        </div>

        <div className="search-palette-results">
          {filtered.length === 0 ? (
            <div className="search-no-results">
              No matching pages found for "{query}"
            </div>
          ) : (
            filtered.map((note, idx) => {
              const previewBlock = note.blocks.find(b => b.content.trim().length > 0);
              const previewText = previewBlock
                ? previewBlock.content.replace(/<[^>]*>/g, '')
                : 'Empty page';

              return (
                <div
                  key={note.id}
                  className={`search-result-row ${selectedIndex === idx ? 'selected' : ''}`}
                  onClick={() => handleSelect(note.id)}
                >
                  <div className="search-result-icon">
                    <AppIcon name={note.icon} size={15} />
                  </div>
                  <div className="search-result-body">
                    <div className="search-result-title">{note.title.trim() || 'Untitled Note'}</div>
                    <div className="search-result-snippet">{previewText}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="search-palette-footer">
          <span><kbd className="palette-kbd">↑</kbd> <kbd className="palette-kbd">↓</kbd> Navigate</span>
          <span><kbd className="palette-kbd">↵</kbd> Select</span>
          <span><kbd className="palette-kbd">ESC</kbd> Close</span>
        </div>
      </div>
    </div>
  );
};
