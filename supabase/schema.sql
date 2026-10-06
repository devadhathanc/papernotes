-- ==============================================================================
-- PaperNotes — Supabase PostgreSQL Schema
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)
-- ==============================================================================

-- 1. Create the main notes table
CREATE TABLE IF NOT EXISTS public.papernotes_notes (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT '',
    icon TEXT NOT NULL DEFAULT 'file-text',
    has_cover BOOLEAN NOT NULL DEFAULT false,
    cover_style TEXT NOT NULL DEFAULT 'charcoal-mesh',
    blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    is_locked BOOLEAN NOT NULL DEFAULT false
);

-- Migration for existing tables:
ALTER TABLE public.papernotes_notes ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT false;

-- 2. Create index on updated_at for fast incremental synchronization
CREATE INDEX IF NOT EXISTS idx_papernotes_notes_updated_at ON public.papernotes_notes (updated_at DESC);

-- 3. Enable Supabase Realtime publication for instant push-based sync across web & mobile
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'papernotes_notes'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.papernotes_notes;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        -- If already in publication or running on managed instance
        NULL;
END $$;

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.papernotes_notes ENABLE ROW LEVEL SECURITY;

-- 4. Create policies (Default: Allows anon access using your Anon public key)
-- Note: You can easily upgrade this to authenticated users by changing to `auth.uid()`
CREATE POLICY "Allow public read access to notes"
    ON public.papernotes_notes
    FOR SELECT
    USING (true);

CREATE POLICY "Allow public insert/update to notes"
    ON public.papernotes_notes
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 5. Optional trigger to automatically bump updated_at on updates
CREATE OR REPLACE FUNCTION update_papernotes_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_papernotes_update_timestamp ON public.papernotes_notes;
CREATE TRIGGER tr_papernotes_update_timestamp
    BEFORE UPDATE ON public.papernotes_notes
    FOR EACH ROW
    EXECUTE FUNCTION update_papernotes_timestamp();
