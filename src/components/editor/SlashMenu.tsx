import React, { useEffect, useState, useRef } from 'react';
import type { BlockType } from '../../domain/Note';
import {
  Type,
  Heading1,
  Heading2,
  Heading3,
  CheckSquare,
  List,
  ListOrdered,
  Quote,
  AlertCircle,
  Code2,
  Minus
} from 'lucide-react';

interface SlashMenuItem {
  type: BlockType;
  title: string;
  description: string;
  icon: React.ReactNode;
}

const SLASH_ITEMS: SlashMenuItem[] = [
  {
    type: 'paragraph',
    title: 'Text',
    description: 'Plain body text',
    icon: <Type size={16} />
  },
  {
    type: 'heading1',
    title: 'Heading 1',
    description: 'Large section heading',
    icon: <Heading1 size={16} />
  },
  {
    type: 'heading2',
    title: 'Heading 2',
    description: 'Medium section heading',
    icon: <Heading2 size={16} />
  },
  {
    type: 'heading3',
    title: 'Heading 3',
    description: 'Small subsection heading',
    icon: <Heading3 size={16} />
  },
  {
    type: 'todo',
    title: 'To-do list',
    description: 'Checkable action items',
    icon: <CheckSquare size={16} />
  },
  {
    type: 'bullet',
    title: 'Bulleted list',
    description: 'Unordered point list',
    icon: <List size={16} />
  },
  {
    type: 'numbered',
    title: 'Numbered list',
    description: 'Sequential ordered list',
    icon: <ListOrdered size={16} />
  },
  {
    type: 'quote',
    title: 'Quote',
    description: 'Capture a citation or thought',
    icon: <Quote size={16} />
  },
  {
    type: 'callout',
    title: 'Callout',
    description: 'Highlighted callout box',
    icon: <AlertCircle size={16} />
  },
  {
    type: 'code',
    title: 'Code block',
    description: 'Monospace snippet',
    icon: <Code2 size={16} />
  },
  {
    type: 'divider',
    title: 'Divider',
    description: 'Visual separation line',
    icon: <Minus size={16} />
  }
];

interface SlashMenuProps {
  position: { top: number; left: number };
  query?: string;
  onSelect: (type: BlockType) => void;
  onClose: () => void;
}

export const SlashMenu: React.FC<SlashMenuProps> = ({ position, query = '', onSelect, onClose }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  const cleanQuery = query.toLowerCase().trim();
  const filteredItems = cleanQuery
    ? SLASH_ITEMS.filter(
        item =>
          item.title.toLowerCase().includes(cleanQuery) ||
          item.type.toLowerCase().includes(cleanQuery) ||
          item.description.toLowerCase().includes(cleanQuery)
      )
    : SLASH_ITEMS;

  useEffect(() => {
    setSelectedIndex(0);
  }, [cleanQuery]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (filteredItems.length === 0) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filteredItems.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredItems.length) % filteredItems.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          onSelect(filteredItems[selectedIndex].type);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, filteredItems, onSelect, onClose]);

  // Adjust position so it doesn't render off-screen
  const menuTop = Math.min(position.top, window.innerHeight - 360);
  const menuLeft = Math.min(position.left, window.innerWidth - 300);

  return (
    <div
      ref={menuRef}
      className="slash-command-palette"
      style={{ top: `${menuTop}px`, left: `${menuLeft}px` }}
    >
      <div className="slash-palette-header">
        <span>{cleanQuery ? `Matching "${cleanQuery}"` : 'Basic blocks'}</span>
        <span className="slash-esc-hint">ESC</span>
      </div>
      <div className="slash-palette-items">
        {filteredItems.length === 0 ? (
          <div style={{ padding: '12px 14px', fontSize: '12px', color: 'var(--text-muted)' }}>
            No matching blocks found
          </div>
        ) : (
          filteredItems.map((item, idx) => (
            <button
              key={item.type}
              className={`slash-palette-item ${selectedIndex === idx ? 'active' : ''}`}
              onClick={() => onSelect(item.type)}
              type="button"
            >
              <div className="slash-item-glyph">{item.icon}</div>
              <div className="slash-item-details">
                <span className="slash-item-title">{item.title}</span>
                <span className="slash-item-desc">{item.description}</span>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
};
