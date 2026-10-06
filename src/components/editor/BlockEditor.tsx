import React, { useState, useEffect } from 'react';
import { useNotes } from '../../state/NotesContext';
import { PageCover } from './PageCover';
import { PageHeader } from './PageHeader';
import { BlockItem } from './BlockItem';
import { SlashMenu } from './SlashMenu';
import { LockedScreen } from './LockedScreen';
import type { BlockType } from '../../domain/Note';

export const BlockEditor: React.FC = () => {
  const {
    activeNote,
    isCurrentNoteLocked,
    updateNoteTitle,
    focusedBlockId,
    setFocusedBlockId,
    updateBlock,
    addBlock,
    deleteBlock,
    reorderBlocks,
    convertBlockType,
    setCoverStyle,
    undo,
    redo
  } = useNotes();

  const [slashMenuState, setSlashMenuState] = useState<{
    isOpen: boolean;
    position: { top: number; left: number };
    blockId: string | null;
    query: string;
  }>({
    isOpen: false,
    position: { top: 0, left: 0 },
    blockId: null,
    query: ''
  });

  // Global Keyboard shortcuts: Cmd+Z (Undo), Cmd+Shift+Z / Cmd+Y (Redo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          redo();
        } else {
          e.preventDefault();
          undo();
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  if (!activeNote) {
    return (
      <div className="empty-workspace-state">
        <p>No document selected. Choose a page or create a new one.</p>
      </div>
    );
  }

  if (isCurrentNoteLocked) {
    return <LockedScreen />;
  }

  const handleOpenSlashMenu = (blockId: string, rect: DOMRect, query?: string) => {
    setSlashMenuState({
      isOpen: true,
      position: { top: rect.bottom + 4, left: rect.left },
      blockId,
      query: query || ''
    });
  };

  const handleSelectSlashType = (type: BlockType) => {
    if (slashMenuState.blockId && activeNote) {
      const targetBlock = activeNote.blocks.find(b => b.id === slashMenuState.blockId);
      let cleanedContent = targetBlock ? targetBlock.content : '';

      // Strip the trailing slash and slash query command
      // e.g., "/" -> ""
      // "/heading" -> ""
      // "Intro /bullet" -> "Intro"
      // "<p>Hello /todo</p>" -> "<p>Hello</p>"
      const textOnly = cleanedContent.replace(/<[^>]*>/g, '');
      const lastSlashIdx = textOnly.lastIndexOf('/');
      if (lastSlashIdx !== -1) {
        if (textOnly.trim().startsWith('/') && !textOnly.trim().includes(' ')) {
          cleanedContent = '';
        } else {
          const rawSlashIdx = cleanedContent.lastIndexOf('/');
          if (rawSlashIdx !== -1) {
            cleanedContent = cleanedContent.substring(0, rawSlashIdx).trimEnd();
          }
        }
      }

      convertBlockType(slashMenuState.blockId, type, cleanedContent);
    }
    setSlashMenuState({ isOpen: false, position: { top: 0, left: 0 }, blockId: null, query: '' });
  };

  return (
    <div className="editor-viewport-container">
      <div className="document-container">
        {/* Cover Banner */}
        {activeNote.hasCover && (
          <PageCover
            title={activeNote.title}
            style={activeNote.coverStyle}
            onSelectStyle={setCoverStyle}
            onUpdateTitle={updateNoteTitle}
          />
        )}

        {/* Page Meta & Title */}
        <PageHeader />

        {/* Blocks Canvas */}
        <div className="blocks-canvas">
          {activeNote.blocks.map((block, idx) => {
            let listNumber = 1;
            if (block.type === 'numbered') {
              for (let i = idx - 1; i >= 0; i--) {
                if (activeNote.blocks[i].type === 'numbered') {
                  listNumber++;
                } else {
                  break;
                }
              }
            }

            return (
              <BlockItem
                key={block.id}
                block={block}
                index={idx}
                totalBlocks={activeNote.blocks.length}
                listNumber={listNumber}
                isFocused={focusedBlockId === block.id}
                onUpdate={updates => updateBlock(block.id, updates)}
                onAddBelow={type => addBlock(block.id, type)}
                onDelete={() => deleteBlock(block.id)}
                onReorder={reorderBlocks}
                onConvertType={type => convertBlockType(block.id, type)}
                onOpenSlashMenu={(rect, query) => handleOpenSlashMenu(block.id, rect, query)}
                onFocusNext={() => {
                  if (idx < activeNote.blocks.length - 1) {
                    setFocusedBlockId(activeNote.blocks[idx + 1].id);
                  }
                }}
                onFocusPrev={() => {
                  if (idx > 0) {
                    setFocusedBlockId(activeNote.blocks[idx - 1].id);
                  }
                }}
              />
            );
          })}
        </div>

        {/* Bottom Clickable Area to append block */}
        <div
          className="editor-bottom-catchment"
          onClick={() => {
            const lastBlock = activeNote.blocks[activeNote.blocks.length - 1];
            if (lastBlock && (!lastBlock.content || lastBlock.content.trim() === '')) {
              setFocusedBlockId(lastBlock.id);
            } else {
              addBlock(lastBlock ? lastBlock.id : null, 'paragraph');
            }
          }}
          title="Click to add content"
        />

        {/* Slash Command Popover */}
        {slashMenuState.isOpen && (
          <SlashMenu
            position={slashMenuState.position}
            query={slashMenuState.query}
            onSelect={handleSelectSlashType}
            onClose={() => setSlashMenuState({ isOpen: false, position: { top: 0, left: 0 }, blockId: null, query: '' })}
          />
        )}
      </div>
    </div>
  );
};
