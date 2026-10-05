import React, { useState, useEffect } from 'react';
import { useNotes } from '../../state/NotesContext';
import {
  Cloud,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Copy,
  Check,
  X,
  ExternalLink,
  Database
} from 'lucide-react';

const SQL_SCHEMA = `-- Run in Supabase SQL Editor:
CREATE TABLE IF NOT EXISTS public.papernotes_notes (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT '',
    icon TEXT NOT NULL DEFAULT 'file-text',
    has_cover BOOLEAN NOT NULL DEFAULT false,
    cover_style TEXT NOT NULL DEFAULT 'charcoal-mesh',
    blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    is_deleted BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_papernotes_notes_updated_at ON public.papernotes_notes (updated_at DESC);
ALTER TABLE public.papernotes_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to notes" ON public.papernotes_notes FOR SELECT USING (true);
CREATE POLICY "Allow public insert/update to notes" ON public.papernotes_notes FOR ALL USING (true) WITH CHECK (true);`;

export const CloudSyncModal: React.FC = () => {
  const {
    cloudConfig,
    syncState,
    syncStats,
    isCloudModalOpen,
    setIsCloudModalOpen,
    updateCloudConfig,
    syncNow
  } = useNotes();

  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'idle' | 'success' | 'error'; text: string }>({
    type: 'idle',
    text: ''
  });
  const [isTesting, setIsTesting] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  useEffect(() => {
    if (cloudConfig) {
      setSupabaseUrl(cloudConfig.supabaseUrl || '');
      setSupabaseAnonKey(cloudConfig.supabaseAnonKey || '');
      setEnabled(Boolean(cloudConfig.enabled));
    }
  }, [cloudConfig, isCloudModalOpen]);

  if (!isCloudModalOpen) return null;

  const handleSaveAndTest = async () => {
    setIsTesting(true);
    setStatusMessage({ type: 'idle', text: '' });

    const config = {
      supabaseUrl: supabaseUrl.trim(),
      supabaseAnonKey: supabaseAnonKey.trim(),
      enabled
    };

    const success = await updateCloudConfig(config);
    setIsTesting(false);

    if (success) {
      setStatusMessage({ type: 'success', text: 'Connected to Supabase PostgreSQL successfully!' });
    } else {
      setStatusMessage({
        type: 'error',
        text: 'Connection failed. Please ensure the table "papernotes_notes" exists using the SQL script below.'
      });
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SQL_SCHEMA);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  return (
    <div className="modal-backdrop-scrim" onClick={() => setIsCloudModalOpen(false)}>
      <div className="cloud-sync-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header-row">
          <div className="modal-header-title">
            <div className="header-icon-badge">
              <Cloud size={16} />
            </div>
            <div>
              <h3>Cloud Sync &amp; PostgreSQL</h3>
              <p className="modal-subtitle">Sync notes seamlessly across web &amp; mobile using free cloud storage</p>
            </div>
          </div>
          <button
            className="modal-close-btn"
            onClick={() => setIsCloudModalOpen(false)}
            type="button"
          >
            <X size={15} />
          </button>
        </div>

        {/* Cloud recommendation card */}
        <div className="cloud-free-tier-notice">
          <div className="notice-icon">
            <Database size={16} />
          </div>
          <div className="notice-content">
            <strong>Recommended Free Provider: Supabase</strong>
            <p>
              Supabase provides <strong>500MB free PostgreSQL database</strong> (plenty for thousands of text notes),
              instant real-time REST API, and zero credit card requirement.
            </p>
            <a
              href="https://supabase.com"
              target="_blank"
              rel="noopener noreferrer"
              className="free-link"
            >
              <span>Visit Supabase Free Tier</span>
              <ExternalLink size={12} />
            </a>
          </div>
        </div>

        {/* Credentials Form */}
        <div className="cloud-form">
          <div className="form-group">
            <label>Supabase Project URL</label>
            <input
              type="text"
              placeholder="https://your-project-id.supabase.co"
              value={supabaseUrl}
              onChange={e => setSupabaseUrl(e.target.value)}
              className="cloud-input"
            />
          </div>

          <div className="form-group">
            <label>Supabase Anon (Public) Key</label>
            <input
              type="password"
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
              value={supabaseAnonKey}
              onChange={e => setSupabaseAnonKey(e.target.value)}
              className="cloud-input"
            />
          </div>

          <div className="form-toggle-row">
            <label className="toggle-switch-label">
              <input
                type="checkbox"
                checked={enabled}
                onChange={e => setEnabled(e.target.checked)}
                className="toggle-checkbox"
              />
              <span className="toggle-slider" />
              <span className="toggle-text">Enable automatic background sync</span>
            </label>
          </div>

          {/* Status Message */}
          {statusMessage.text && (
            <div className={`status-banner ${statusMessage.type}`}>
              {statusMessage.type === 'success' ? (
                <CheckCircle2 size={15} />
              ) : (
                <AlertCircle size={15} />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* Sync Stats Info */}
          {syncStats.lastSyncedAt && (
            <div className="sync-stats-bar">
              <span>Last synced: {new Date(syncStats.lastSyncedAt).toLocaleTimeString()}</span>
              <span>•</span>
              <span>State: <strong>{syncState}</strong></span>
            </div>
          )}

          {/* Actions */}
          <div className="form-action-row">
            <button
              className="btn secondary"
              onClick={() => syncNow()}
              disabled={!enabled || isTesting}
              type="button"
            >
              <RefreshCw size={13} className={syncState === 'syncing' ? 'spin' : ''} />
              <span>Sync Now</span>
            </button>

            <button
              className="btn primary"
              onClick={handleSaveAndTest}
              disabled={isTesting}
              type="button"
            >
              {isTesting ? <RefreshCw size={13} className="spin" /> : <Check size={13} />}
              <span>{isTesting ? 'Connecting...' : 'Save & Test'}</span>
            </button>
          </div>
        </div>

        {/* PostgreSQL Schema Setup */}
        <div className="sql-schema-section">
          <div className="sql-section-header">
            <span>Supabase SQL Setup (Run once)</span>
            <button
              className="copy-sql-btn"
              onClick={handleCopySql}
              type="button"
            >
              {copiedSql ? <Check size={12} /> : <Copy size={12} />}
              <span>{copiedSql ? 'Copied SQL' : 'Copy SQL Script'}</span>
            </button>
          </div>
          <pre className="sql-code-block">{SQL_SCHEMA}</pre>
        </div>
      </div>
    </div>
  );
};
