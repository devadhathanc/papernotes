# PaperNotes Mobile (React Native / Expo) 📱

The dedicated cross-platform mobile version of **PaperNotes**, built with **React Native** and **Expo**. It shares domain models, storage abstraction patterns, and Supabase PostgreSQL cloud sync with the web version.

---

## 🚀 Quick Start

### 1. Run on Android Device / Emulator (Expo Go)
Run from the root or inside `/mobile`:

```bash
# From root directory:
npm run mobile:start

# Or inside /mobile:
cd mobile
npm start
```

- **Physical Android Phone**: Install the free **Expo Go** app from Google Play Store and scan the QR code displayed in the terminal.
- **Android Emulator**: Press `a` in the terminal to launch the Android emulator.
- **iOS Simulator**: Press `i` in the terminal to launch iOS simulator.
- **Web Mobile View**: Press `w` in the terminal.

---

## 📦 Building a Native Android APK

To generate a standalone `.apk` or `.aab` (without Expo Go):

1. **Install EAS CLI** (if not already installed):
   ```bash
   npm install -g eas-cli
   ```

2. **Configure Build profile**:
   ```bash
   cd mobile
   npx eas build:configure
   ```

3. **Build Android APK**:
   ```bash
   npx eas build --platform android --profile preview
   ```

---

## 🏛️ Mobile Architecture

```
mobile/
├── App.tsx                      # Native UI (Header, Side Drawer, BlockEditor, Modals)
├── app.json                     # Expo configuration (name, slug, splash, orientation)
├── package.json
└── src/
    ├── domain/
    │   ├── Note.ts              # Shared domain models (Note, Block, BlockType, CoverStyle)
    │   └── Sync.ts              # Shared sync state and cloud config contracts
    └── services/
        ├── storage/
        │   └── AsyncStorageAdapter.ts # Native persistent storage via AsyncStorage
        └── sync/
            ├── SupabaseSyncProvider.ts # Native Supabase PostgreSQL sync
            └── SyncManager.ts         # Last-Write-Wins (LWW) conflict resolution
```

---

## ☁️ Cross-Platform Cloud Sync with Web

Because both the Web app and Mobile app communicate with the same **Supabase PostgreSQL database**, any page created, edited, or reordered on your Android phone will instantly reflect on your desktop web app upon syncing!
