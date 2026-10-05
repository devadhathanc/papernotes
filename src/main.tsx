import React from 'react';
import ReactDOM from 'react-dom/client';
import { NotesProvider } from './state/NotesContext';
import { App } from './App';
import './styles/monochrome.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <NotesProvider>
      <App />
    </NotesProvider>
  </React.StrictMode>
);
