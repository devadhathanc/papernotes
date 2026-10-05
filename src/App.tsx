import React from 'react';
import { useNotes } from './state/NotesContext';
import { Sidebar } from './components/layout/Sidebar';
import { TopNav } from './components/layout/TopNav';
import { BlockEditor } from './components/editor/BlockEditor';
import { SearchModal } from './components/modals/SearchModal';
import { CloudSyncModal } from './components/modals/CloudSyncModal';
import { IconPickerModal } from './components/modals/IconPickerModal';

export const App: React.FC = () => {
  const { isZenMode } = useNotes();

  return (
    <div className={`app-root-shell ${isZenMode ? 'zen-mode' : ''}`}>
      <Sidebar />
      <main className="main-stage">
        <TopNav />
        <BlockEditor />
      </main>

      {/* Global Modals */}
      <SearchModal />
      <CloudSyncModal />
      <IconPickerModal />
    </div>
  );
};
