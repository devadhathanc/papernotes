# PaperNotes 📓

A fast, Notion-like notes app built with **React**, **TypeScript**, and a **clean, rich monochrome UI**.

Designed with **SOLID principles** and a **Modular Monolith architecture**, featuring both a responsive web client and a dedicated cross-platform mobile app in [`mobile/`](mobile/) (React Native / Expo for Android and iOS). Includes offline-first local persistence and cloud sync with **Supabase (PostgreSQL)**.

---

## 🏛️ Architecture

PaperNotes is structured as a **Modular Monolith** with clear boundaries, decoupling business logic from platform-specific UI:

```
papernotes/
├── src/                         # Web Application (React 19 + TypeScript + Vite)
│   ├── domain/                  # Pure domain models (Zero platform dependencies)
│   │   ├── Note.ts              # Note & Block models
│   │   ├── Icon.tsx             # Icon keys & Lucide SVG mappings
│   │   └── Sync.ts              # Cloud config & sync state contracts
│   ├── services/
│   │   ├── storage/             # Storage Layer (DIP / ISP)
│   │   │   ├── IStorageAdapter.ts   # Abstract persistence interface
│   │   │   └── LocalStorageAdapter.ts # Web localStorage
│   │   └── sync/                # Cloud Sync Layer (DIP / OCP)
│   │       ├── ISyncProvider.ts     # Abstract sync provider interface
│   │       ├── SupabaseSyncProvider.ts # Supabase PostgreSQL implementation
│   │       └── SyncManager.ts       # Orchestrates offline-first sync & LWW conflict resolution
│   ├── state/
│   │   └── NotesContext.tsx     # Reactive state provider
│   ├── components/
│   │   ├── layout/              # Responsive layout (Sidebar, TopNav)
│   │   ├── editor/              # BlockEditor, BlockItem, PageCover, PageHeader, SlashMenu
│   │   └── modals/              # SearchModal, CloudSyncModal, IconPickerModal
│   └── styles/
│       └── monochrome.css       # Pure monochrome design system (dark/light, responsive)
├── mobile/                      # Cross-Platform Mobile App (React Native / Expo)
│   ├── App.tsx                  # Native mobile entry with rich monochrome UI
│   ├── src/domain/              # Shared pure domain models
│   ├── src/services/storage/    # AsyncStorage persistence adapter
│   └── src/services/sync/       # Mobile Supabase cloud sync provider
└── supabase/
    └── schema.sql               # PostgreSQL schema & RLS policies
```

### Why a Modular Monolith instead of Microservices?
- **Zero Network Overhead**: Note-taking demands instant sub-millisecond response times. A modular monolith allows pure local-first execution.
- **Cross-Platform Sharing**: The domain models (`domain/`), storage interfaces (`services/storage/`), and sync manager (`services/sync/`) are shared 1:1 with React Native.
- **Simple Deployment & Maintenance**: No orchestration clusters or multi-repo overhead.

---

## ☁️ Cloud Sync (Free PostgreSQL Storage)

### Recommended Free Provider: **Supabase**
- **Free Tier Allowance**: **500MB PostgreSQL database** (stores hundreds of thousands of notes), unlimited API calls within generous limits, zero credit card required.
- **Alternatives**: Firebase Firestore (1GB free), Cloudflare D1 (5M reads/day).

### Supabase Setup (Run Once in Supabase SQL Editor):
Run the SQL script located in [`supabase/schema.sql`](supabase/schema.sql):

```sql
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
CREATE POLICY "Allow public insert/update to notes" ON public.papernotes_notes FOR ALL USING (true) WITH CHECK (true);
```

Then in the PaperNotes app:
1. Click the **Sync** button in the sidebar footer (or top nav cloud icon).
2. Enter your **Supabase Project URL** and **Anon Key**.
3. Toggle **"Enable automatic background sync"** and click **"Save & Test"**.

---

## ⚡ Concurrency & Conflict Resolution Strategy

### Current Model: **Last-Write-Wins (LWW) with Timestamps**
- Every note and block maintains an ISO-8601 `updatedAt` timestamp.
- **Offline Queuing**: Changes made while offline are saved to local storage.
- **Resolution**: When a connection is restored, the `SyncManager` compares local vs remote timestamps. The newer record wins, preventing overwrite of fresher data.
- **Debounced Syncing**: Prevents saturating the network by coalescing rapid typing into batch updates.

### Scaling to Multi-Device Real-Time Collaboration (CRDTs):
If you need multi-cursor simultaneous co-authoring on the same block, the `ISyncProvider` interface is designed so you can swap in a **Yjs / CRDT provider** over Supabase Realtime Channels.

---

## 📱 Mobile & Web Responsiveness

- **Mobile Viewports (< 768px)**:
  - Sidebar automatically converts into a slide-over drawer with a backdrop scrim.
  - Generous 44px tap targets for mobile usability.
  - Page cover scales down gracefully.
- **Block Pan / Reorder**:
  - Drag and drop using the `⋮⋮` pan handle.
  - Dedicated **"Move up"** and **"Move down"** buttons in the block options menu for touchscreens.

---

## 🛠️ Development

### Web App
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build production bundle
npm run build
```

### Mobile App (React Native / Expo)
```bash
cd mobile

# Start Expo development server (Android / iOS / Web)
npm start

# Run directly on Android device or emulator
npm run android

# Run directly on iOS simulator
npm run ios
```
