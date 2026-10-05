import React from 'react';
import { useNotes } from '../../state/NotesContext';
import { AppIcon } from '../../domain/Icon';
import { Image as ImageIcon } from 'lucide-react';

export const PageHeader: React.FC = () => {
  const {
    activeNote,
    updateNoteTitle,
    toggleNoteCover,
    setIsIconPickerOpen
  } = useNotes();

  if (!activeNote) return null;

  return (
    <div className="document-page-header">
      <div className="header-meta-actions">
        <button
          className="header-pill-btn"
          onClick={() => setIsIconPickerOpen(true)}
          type="button"
          title="Change document icon"
        >
          <div className="header-icon-glyph">
            <AppIcon name={activeNote.icon} size={15} />
          </div>
          <span>Change icon</span>
        </button>

        {!activeNote.hasCover && (
          <button
            className="header-pill-btn"
            onClick={toggleNoteCover}
            type="button"
            title="Add page cover"
          >
            <ImageIcon size={14} />
            <span>Add cover</span>
          </button>
        )}
      </div>

      {!activeNote.hasCover && (
        <input
          type="text"
          className="document-main-title"
          placeholder="Untitled Note"
          value={activeNote.title}
          onChange={e => updateNoteTitle(e.target.value)}
          spellCheck={false}
        />
      )}
    </div>
  );
};
