import React, { useState } from 'react';
import { useNotes } from '../../state/NotesContext';
import { PageCover } from './PageCover';
import { PageHeader } from './PageHeader';
import { BlockItem } from './BlockItem';
import { SlashMenu } from './SlashMenu';
import type { BlockType } from '../../domain/Note';

export const BlockEditor: React.FC = () => {
  const {
    activeNote,
    focusedBlockId,
    setFocusedBlockId,
    updateBlock,
    addBlock,
    deleteBlock,
    reorderBlocks,
    convertBlockType,
    toggleNoteCover,
    setCoverStyle
  } = useNotes();

  const [slashMenuState, setSlashMenuState] = useState<{
    isOpen: boolean;
    position: { top: number; left: number };
    blockId: string | null;
  }>({
    isOpen: false,
    position: { top: 0, left: 0 },
    blockId: null
  });

  if (!activeNote) {
    return (
      <div className="empty-workspace-state">
        <p>No document selected. Choose a page or create a new one.</p>
      </div>
    );
  }

  const handleOpenSlashMenu = (blockId: string, rect: DOMRect) => {
    setSlashMenuState({
      isOpen: true,
      position: { top: rect.bottom + 4, left: rect.left },
      blockId
    });
  };

  const handleSelectSlashType = (type: BlockType) => {
    if (slashMenuState.blockId) {
      convertBlockType(slashMenuState.blockId, type);
    }
    setSlashMenuState({ isOpen: false, position: { top: 0, left: 0 }, blockId: null });
  };

  return (
    <div className="editor-viewport-container">
      <div className="document-container">
        {/* Cover Banner */}
        {activeNote.hasCover && (
          <PageCover
            style={activeNote.coverStyle}
            onRemove={toggleNoteCover}
            onSelectStyle={setCoverStyle}
          />
        )}

        {/* Page Meta & Title */}
        <PageHeader />

        {/* Blocks Canvas */}
        <div className="blocks-canvas">
          {activeNote.blocks.map((block, idx) => (
            <BlockItem
              key={block.id}
              block={block}
              index={idx}
              totalBlocks={activeNote.blocks.length}
              isFocused={focusedBlockId === block.id}
              onUpdate={updates => updateBlock(block.id, updates)}
              onAddBelow={type => addBlock(block.id, type)}
              onDelete={() => deleteBlock(block.id)}
              onReorder={reorderBlocks}
              onConvertType={type => convertBlockType(block.id, type)}
              onOpenSlashMenu={rect => handleOpenSlashMenu(block.id, rect)}
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
          ))}
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
            onSelect={handleSelectSlashType}
            onClose={() => setSlashMenuState({ isOpen: false, position: { top: 0, left: 0 }, blockId: null })}
          />
        )}
      </div>
    </div>
  );
};
