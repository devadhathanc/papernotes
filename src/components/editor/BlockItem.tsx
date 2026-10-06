import React, { useRef, useState, useEffect } from 'react';
import type { Block, BlockType } from '../../domain/Note';
import { AppIcon } from '../../domain/Icon';
import {
  Plus,
  GripVertical,
  MoreHorizontal,
  Copy,
  Check,
  ChevronUp,
  ChevronDown,
  Trash2,
  CopyPlus,
  Type,
  Heading1,
  Heading2,
  Heading3,
  CheckSquare,
  List,
  ListOrdered,
  Quote,
  Code2,
  AlertCircle,
  Minus
} from 'lucide-react';

interface BlockItemProps {
  block: Block;
  index: number;
  totalBlocks: number;
  listNumber?: number;
  isFocused: boolean;
  onUpdate: (updates: Partial<Block>) => void;
  onAddBelow: (type?: BlockType) => void;
  onDelete: () => void;
  onReorder: (fromIdx: number, toIdx: number) => void;
  onConvertType: (type: BlockType) => void;
  onOpenSlashMenu: (rect: DOMRect, query?: string) => void;
  onFocusNext: () => void;
  onFocusPrev: () => void;
}

let activeDraggedIndex: number | null = null;

export const BlockItem: React.FC<BlockItemProps> = ({
  block,
  index,
  totalBlocks,
  listNumber,
  isFocused,
  onUpdate,
  onAddBelow,
  onDelete,
  onReorder,
  onConvertType,
  onOpenSlashMenu,
  onFocusNext,
  onFocusPrev
}) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Close menu on outside click
  useEffect(() => {
    if (!isMenuOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isMenuOpen]);

  // Sync content into editable div without destroying user cursor
  useEffect(() => {
    if (contentRef.current && contentRef.current.innerHTML !== block.content) {
      contentRef.current.innerHTML = block.content;
      if (document.activeElement === contentRef.current) {
        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(contentRef.current);
        range.collapse(false);
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }
  }, [block.content, block.type]);

  // Focus management
  useEffect(() => {
    if (isFocused && contentRef.current) {
      if (document.activeElement !== contentRef.current) {
        contentRef.current.focus();
      }
    }
  }, [isFocused]);

  // Markdown trigger detection
  const handleInput = () => {
    if (!contentRef.current) return;
    const text = contentRef.current.innerText;

    // Check markdown prefixes
    if (text.startsWith('# ')) {
      contentRef.current.innerHTML = text.substring(2);
      onConvertType('heading1');
      return;
    }
    if (text.startsWith('## ')) {
      contentRef.current.innerHTML = text.substring(3);
      onConvertType('heading2');
      return;
    }
    if (text.startsWith('### ')) {
      contentRef.current.innerHTML = text.substring(4);
      onConvertType('heading3');
      return;
    }
    if (text.startsWith('- ') || text.startsWith('* ')) {
      contentRef.current.innerHTML = text.substring(2);
      onConvertType('bullet');
      return;
    }
    if (/^\d+\.\s/.test(text)) {
      contentRef.current.innerHTML = text.replace(/^\d+\.\s/, '');
      onConvertType('numbered');
      return;
    }
    if (text.startsWith('[] ') || text.startsWith('[ ] ')) {
      contentRef.current.innerHTML = text.replace(/^\[\s?\]\s/, '');
      onConvertType('todo');
      return;
    }
    if (text.startsWith('> ')) {
      contentRef.current.innerHTML = text.substring(2);
      onConvertType('quote');
      return;
    }
    if (text.startsWith('---')) {
      contentRef.current.innerHTML = '';
      onConvertType('divider');
      return;
    }

    // Slash command trigger
    const slashIdx = text.lastIndexOf('/');
    if (slashIdx !== -1 && contentRef.current) {
      const query = text.substring(slashIdx + 1).trim();
      if (!query.includes(' ') && query.length <= 15) {
        const rect = contentRef.current.getBoundingClientRect();
        onOpenSlashMenu(rect, query);
      }
    }

    onUpdate({ content: contentRef.current.innerHTML });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // If list/todo has empty content, convert to paragraph
      if (['bullet', 'numbered', 'todo'].includes(block.type) && (!block.content || block.content === '<br>' || block.content.trim() === '')) {
        onConvertType('paragraph');
        return;
      }
      onAddBelow(block.type === 'todo' || block.type === 'bullet' || block.type === 'numbered' ? block.type : 'paragraph');
    } else if (e.key === 'Backspace') {
      const text = contentRef.current?.innerText.trim() || '';
      const sel = window.getSelection();

      if (block.type !== 'paragraph' && (text === '' || sel?.anchorOffset === 0)) {
        e.preventDefault();
        onConvertType('paragraph');
      } else if (text === '' && block.type === 'paragraph' && totalBlocks > 1) {
        e.preventDefault();
        onDelete();
        onFocusPrev();
      }
    } else if (e.key === 'ArrowUp') {
      const sel = window.getSelection();
      if (sel && sel.anchorOffset === 0) {
        e.preventDefault();
        onFocusPrev();
      }
    } else if (e.key === 'ArrowDown') {
      const textLen = contentRef.current?.innerText.length || 0;
      const sel = window.getSelection();
      if (sel && sel.anchorOffset >= textLen) {
        e.preventDefault();
        onFocusNext();
      }
    }
  };

  // Drag and drop / Pan reordering
  const handleDragStart = (e: React.DragEvent) => {
    activeDraggedIndex = index;
    e.dataTransfer.setData('text/plain', String(index));
    e.dataTransfer.effectAllowed = 'move';

    // Use the block component's natural UI directly
    if (rowRef.current && e.dataTransfer.setDragImage) {
      const rect = rowRef.current.getBoundingClientRect();
      e.dataTransfer.setDragImage(rowRef.current, 12, Math.min(18, rect.height / 2));
    }

    requestAnimationFrame(() => {
      setIsDragging(true);
    });
  };

  const handleDragEnd = () => {
    activeDraggedIndex = null;
    setIsDragging(false);
    setIsDragOver(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear drag over if leaving the entire block row container (including left space)
    if (rowRef.current && !rowRef.current.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    setIsDragging(false);

    let fromIdx = activeDraggedIndex;
    if (fromIdx === null) {
      const fromIdxStr = e.dataTransfer.getData('text/plain');
      if (fromIdxStr) fromIdx = parseInt(fromIdxStr, 10);
    }
    activeDraggedIndex = null;

    if (typeof fromIdx === 'number' && !isNaN(fromIdx) && fromIdx !== index) {
      onReorder(fromIdx, index);
    }
  };

  const copyCode = () => {
    if (!contentRef.current) return;
    navigator.clipboard.writeText(contentRef.current.innerText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const getPlaceholder = (type: BlockType): string => {
    switch (type) {
      case 'heading1': return 'Heading 1';
      case 'heading2': return 'Heading 2';
      case 'heading3': return 'Heading 3';
      case 'todo': return 'To-do';
      case 'bullet': return 'List item';
      case 'numbered': return 'List item';
      case 'quote': return 'Empty quote';
      case 'callout': return 'Type a highlight note...';
      case 'code': return '// Type code...';
      case 'divider': return '';
      default: return 'Type "/" for commands...';
    }
  };

  return (
    <div
      ref={rowRef}
      className={`editor-block-row ${block.type} ${block.checked ? 'completed' : ''} ${isDragging ? 'is-dragging' : ''} ${isDragOver ? 'is-drag-over' : ''} ${isMenuOpen ? 'is-menu-open' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Left Catchment Drop Zone: enables drag-and-drop on the left space of each component */}
      <div
        className="block-left-catchment"
        contentEditable={false}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      />

      {/* Pan & Drag Handle Gutter */}
      <div className={`block-gutter ${isMenuOpen ? 'is-menu-open' : ''}`} contentEditable={false}>
        <button
          className="gutter-btn add-btn"
          title="Add block below"
          onClick={() => onAddBelow('paragraph')}
          type="button"
        >
          <Plus size={13} />
        </button>
        <div
          role="button"
          tabIndex={0}
          className="gutter-btn drag-handle"
          title="Drag to pan / reorder"
          draggable={true}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          aria-label="Drag to reorder"
        >
          <GripVertical size={13} />
        </div>
        <button
          className="gutter-btn options-btn"
          title="Block options"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          type="button"
        >
          <MoreHorizontal size={13} />
        </button>

        {/* Quick Context Popover for Pan/Reorder & Actions */}
        {isMenuOpen && (
          <div ref={menuRef} className="block-quick-menu" onClick={e => e.stopPropagation()}>
            <button
              className="quick-menu-item"
              disabled={index === 0}
              onClick={() => {
                onReorder(index, index - 1);
                setIsMenuOpen(false);
              }}
            >
              <ChevronUp size={13} />
              <span>Move up</span>
            </button>
            <button
              className="quick-menu-item"
              disabled={index >= totalBlocks - 1}
              onClick={() => {
                onReorder(index, index + 1);
                setIsMenuOpen(false);
              }}
            >
              <ChevronDown size={13} />
              <span>Move down</span>
            </button>
            <button
              className="quick-menu-item"
              onClick={() => {
                onAddBelow(block.type);
                setIsMenuOpen(false);
              }}
            >
              <CopyPlus size={13} />
              <span>Duplicate below</span>
            </button>
            <div className="quick-menu-divider" />
            <div className="quick-menu-section-label">Convert to</div>
            <div className="quick-menu-convert-grid">
              <button
                type="button"
                className={`quick-convert-chip ${block.type === 'paragraph' ? 'active' : ''}`}
                onClick={() => {
                  onConvertType('paragraph');
                  setIsMenuOpen(false);
                }}
              >
                <Type size={12} />
                <span>Text</span>
              </button>
              <button
                type="button"
                className={`quick-convert-chip ${block.type === 'heading1' ? 'active' : ''}`}
                onClick={() => {
                  onConvertType('heading1');
                  setIsMenuOpen(false);
                }}
              >
                <Heading1 size={12} />
                <span>H1</span>
              </button>
              <button
                type="button"
                className={`quick-convert-chip ${block.type === 'heading2' ? 'active' : ''}`}
                onClick={() => {
                  onConvertType('heading2');
                  setIsMenuOpen(false);
                }}
              >
                <Heading2 size={12} />
                <span>H2</span>
              </button>
              <button
                type="button"
                className={`quick-convert-chip ${block.type === 'heading3' ? 'active' : ''}`}
                onClick={() => {
                  onConvertType('heading3');
                  setIsMenuOpen(false);
                }}
              >
                <Heading3 size={12} />
                <span>H3</span>
              </button>
              <button
                type="button"
                className={`quick-convert-chip ${block.type === 'todo' ? 'active' : ''}`}
                onClick={() => {
                  onConvertType('todo');
                  setIsMenuOpen(false);
                }}
              >
                <CheckSquare size={12} />
                <span>To-do</span>
              </button>
              <button
                type="button"
                className={`quick-convert-chip ${block.type === 'bullet' ? 'active' : ''}`}
                onClick={() => {
                  onConvertType('bullet');
                  setIsMenuOpen(false);
                }}
              >
                <List size={12} />
                <span>Bullet</span>
              </button>
              <button
                type="button"
                className={`quick-convert-chip ${block.type === 'numbered' ? 'active' : ''}`}
                onClick={() => {
                  onConvertType('numbered');
                  setIsMenuOpen(false);
                }}
              >
                <ListOrdered size={12} />
                <span>1. Numbered</span>
              </button>
              <button
                type="button"
                className={`quick-convert-chip ${block.type === 'quote' ? 'active' : ''}`}
                onClick={() => {
                  onConvertType('quote');
                  setIsMenuOpen(false);
                }}
              >
                <Quote size={12} />
                <span>Quote</span>
              </button>
              <button
                type="button"
                className={`quick-convert-chip ${block.type === 'code' ? 'active' : ''}`}
                onClick={() => {
                  onConvertType('code');
                  setIsMenuOpen(false);
                }}
              >
                <Code2 size={12} />
                <span>Code</span>
              </button>
              <button
                type="button"
                className={`quick-convert-chip ${block.type === 'callout' ? 'active' : ''}`}
                onClick={() => {
                  onConvertType('callout');
                  setIsMenuOpen(false);
                }}
              >
                <AlertCircle size={12} />
                <span>Callout</span>
              </button>
              <button
                type="button"
                className={`quick-convert-chip ${block.type === 'divider' ? 'active' : ''}`}
                onClick={() => {
                  onConvertType('divider');
                  setIsMenuOpen(false);
                }}
              >
                <Minus size={12} />
                <span>Divider</span>
              </button>
            </div>
            <div className="quick-menu-divider" />
            <button
              className="quick-menu-item danger"
              onClick={() => {
                onDelete();
                setIsMenuOpen(false);
              }}
            >
              <Trash2 size={13} />
              <span>Delete</span>
            </button>
          </div>
        )}
      </div>

      {/* Todo Checkbox */}
      {block.type === 'todo' && (
        <button
          className={`todo-box ${block.checked ? 'checked' : ''}`}
          onClick={() => onUpdate({ checked: !block.checked })}
          type="button"
          aria-label="Toggle to-do"
        >
          {block.checked && <Check size={11} strokeWidth={3} />}
        </button>
      )}

      {/* Bullet Point */}
      {block.type === 'bullet' && (
        <span className="bullet-prefix" contentEditable={false} aria-hidden="true">
          •
        </span>
      )}

      {/* Numbered List Prefix */}
      {block.type === 'numbered' && (
        <span className="numbered-prefix" contentEditable={false} aria-hidden="true">
          {listNumber || 1}.
        </span>
      )}

      {/* Callout Icon */}
      {block.type === 'callout' && (
        <div className="callout-glyph" contentEditable={false}>
          <AppIcon name={block.calloutIcon || 'lightbulb'} size={16} />
        </div>
      )}

      {/* Code Block Copy Action */}
      {block.type === 'code' && (
        <button
          className="code-copy-action"
          onClick={copyCode}
          type="button"
          title="Copy code"
        >
          {isCopied ? <Check size={12} /> : <Copy size={12} />}
          <span>{isCopied ? 'Copied' : 'Copy'}</span>
        </button>
      )}

      {/* Content Editable Area */}
      {block.type !== 'divider' ? (
        <div
          ref={contentRef}
          className="block-text-content"
          contentEditable
          suppressContentEditableWarning
          spellCheck
          data-placeholder={getPlaceholder(block.type)}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
        />
      ) : (
        <div className="block-divider-line" contentEditable={false} />
      )}
    </div>
  );
};
