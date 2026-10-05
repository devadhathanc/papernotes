import React, { useRef, useEffect } from 'react';
import type { CoverStyle } from '../../domain/Note';
import { Palette } from 'lucide-react';

interface PageCoverProps {
  title?: string;
  style?: CoverStyle;
  onSelectStyle: (style: CoverStyle) => void;
  onUpdateTitle?: (title: string) => void;
}

const COVER_STYLES: { id: CoverStyle; label: string }[] = [
  { id: 'charcoal-mesh', label: 'Mesh' },
  { id: 'mono-grid', label: 'Grid' },
  { id: 'slate-gradient', label: 'Gradient' },
  { id: 'minimal-dots', label: 'Dots' }
];

export const PageCover: React.FC<PageCoverProps> = ({
  title = '',
  style = 'charcoal-mesh',
  onSelectStyle,
  onUpdateTitle
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea so cover flexibly expands with the title
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [title]);

  // Functional Palette: clicking cycles to next cover style
  const handleCycleStyle = () => {
    const currentIndex = COVER_STYLES.findIndex(s => s.id === style);
    const nextIndex = (currentIndex + 1) % COVER_STYLES.length;
    onSelectStyle(COVER_STYLES[nextIndex].id);
  };

  return (
    <div className={`page-cover-banner cover-style-${style}`}>
      <div className="cover-overlay-pattern" />

      {/* Top Row: Pattern controls with functional Palette cycle button & pills */}
      <div className="cover-top-controls">
        <div className="cover-action-bar">
          <div className="cover-style-picker">
            <button
              className="cover-palette-btn"
              onClick={handleCycleStyle}
              type="button"
              title="Cycle cover pattern (Mesh, Grid, Gradient, Dots)"
              aria-label="Cycle cover pattern"
            >
              <Palette size={13} />
            </button>
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
        </div>
      </div>

      {/* Flexible Page Title on the Cover */}
      <div className="cover-title-area">
        <textarea
          ref={textareaRef}
          className="cover-title-input"
          placeholder="Untitled Note"
          value={title}
          onChange={e => onUpdateTitle?.(e.target.value)}
          rows={1}
          maxLength={140}
          spellCheck={false}
        />
      </div>
    </div>
  );
};
