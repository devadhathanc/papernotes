import React from 'react';
import { useNotes } from '../../state/NotesContext';
import { AVAILABLE_ICON_KEYS, AppIcon } from '../../domain/Icon';
import { X } from 'lucide-react';

export const IconPickerModal: React.FC = () => {
  const { isIconPickerOpen, setIsIconPickerOpen, updateNoteIcon, activeNote } = useNotes();

  if (!isIconPickerOpen || !activeNote) return null;

  return (
    <div className="modal-backdrop-scrim" onClick={() => setIsIconPickerOpen(false)}>
      <div className="icon-picker-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header-row compact">
          <span className="modal-title-text">Select Document Icon</span>
          <button
            className="modal-close-btn"
            onClick={() => setIsIconPickerOpen(false)}
            type="button"
          >
            <X size={14} />
          </button>
        </div>

        <div className="icon-picker-vector-grid">
          {AVAILABLE_ICON_KEYS.map(key => {
            const isSelected = activeNote.icon === key;
            return (
              <button
                key={key}
                className={`icon-grid-cell ${isSelected ? 'selected' : ''}`}
                onClick={() => {
                  updateNoteIcon(key);
                  setIsIconPickerOpen(false);
                }}
                title={key}
                type="button"
              >
                <AppIcon name={key} size={18} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
