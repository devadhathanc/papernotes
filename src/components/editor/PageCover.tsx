import React from 'react';
import type { CoverStyle } from '../../domain/Note';
import { Palette, Trash2 } from 'lucide-react';

interface PageCoverProps {
  style?: CoverStyle;
  onRemove: () => void;
  onSelectStyle: (style: CoverStyle) => void;
}

const COVER_STYLES: { id: CoverStyle; label: string }[] = [
  { id: 'charcoal-mesh', label: 'Mesh' },
  { id: 'mono-grid', label: 'Grid' },
  { id: 'slate-gradient', label: 'Gradient' },
  { id: 'minimal-dots', label: 'Dots' }
];

export const PageCover: React.FC<PageCoverProps> = ({
  style = 'charcoal-mesh',
  onRemove,
  onSelectStyle
}) => {
  return (
    <div className={`page-cover-banner cover-style-${style}`}>
      <div className="cover-overlay-pattern" />
      <div className="cover-action-bar">
        <div className="cover-style-picker">
          <Palette size={13} className="text-secondary" />
          {COVER_STYLES.map(s => (
            <button
              key={s.id}
              className={`cover-style-pill ${style === s.id ? 'active' : ''}`}
              onClick={() => onSelectStyle(s.id)}
              type="button"
            >
              {s.label}
            </button>
          ))}
        </div>
        <button
          className="cover-delete-btn"
          onClick={onRemove}
          title="Remove cover"
          type="button"
        >
          <Trash2 size={13} />
          <span>Remove</span>
        </button>
      </div>
    </div>
  );
};
