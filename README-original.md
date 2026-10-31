# LearnFlex — Three Pillars Update

This version is based on the four LearnFlex files supplied by the user. Existing role selection, student/teacher experiences, assessments, adaptive rules, revision, concept map, reports, CSV export, and Smart Recovery are preserved.

## Run locally

**Important:** service workers do not work when you double-click `index.html` using a `file://` URL. Serve this folder from localhost to enable offline caching.

### Option A — VS Code
1. Open this extracted folder in VS Code.
2. If you have the Live Server extension, right-click `index.html` and choose **Open with Live Server**.
3. Visit the localhost URL it opens once while online.
4. Refresh once, then disconnect the internet and reload to test the cached app shell.

### Option B — Node.js
From this folder, run a static server you already have installed, for example `npx http-server .` (may require an internet connection the first time). Open the localhost URL and load the app once online.

## Demo accounts
- Student: `LF1001` / `learn123`
- Teacher: `TEACH01` / `teach123`

## Three pillars included in this update

### 1. Offline-first foundation
- Adds `sw.js` and a web app manifest to cache the app shell (`index.html`, `styles.css`, `app.js`, manifest).
- Existing learning data and results continue to save in browser `localStorage`, so they remain available on that browser/device while offline.
- Shows online/offline state in Projector Mode.
- The first visit must happen online while served from localhost/HTTPS for service-worker caching to install.

### 2. Accessibility and regional explanations
- Browser text-to-speech reads the visible page content, with Slow / Normal / Fast controls.
- High-contrast display toggle.
- Reading-friendly font, line spacing and word spacing toggle. This is a basic reading mode, not a clinical dyslexia treatment or formal accessibility certification.
- Topic-specific Teluglish/Hinglish explanation cards are added for the included topics when Telugu or Hindi is selected. Original English lesson content remains alongside them to preserve subject terminology.
- Speech voice availability and pronunciation depend on the browser/device. Offline speech is only available if the device has an installed voice.

### 3. Teacher Projector Mode
- Adds a teacher-only Projector Mode navigation page.
- Choose a topic, move through questions, reveal answers and explanations, and tally class votes on one device.
- Vote counts are saved in this browser.
- This is a single-device teacher-led classroom mode. It does **not** yet provide QR-based joining, live answers from student phones, a local classroom server, Bluetooth/Wi-Fi Direct syncing, or device-to-device mesh networking.

## Honest implementation boundaries
- This is still a browser-only prototype. Login credentials are demo-only; there is no secure backend, cloud sync, server database, or multi-device sync.
- Offline support caches the app shell, not a downloadable content library or an AI model. Existing lesson/question content is bundled in `app.js`, so the supplied topics can be opened offline after caching.
- The adaptive recommendations and Smart Recovery remain explainable rule-based logic, not a trained AI model.
- LocalStorage is tied to one browser profile/device. Clearing browser data can remove progress.
- Do not enter real student personal information or production passwords.
- Before production use, add a secure backend/API, authentication and role-based authorization, data backups, privacy controls, tested conflict-safe sync, and a reviewed content-management workflow.

## Files
- `index.html` — page layout, role selection and accessibility controls
- `styles.css` — existing styling plus accessibility/projector styles
- `app.js` — existing app and added pillar features
- `sw.js` — offline app-shell caching
- `manifest.webmanifest` — installable web app metadata
- `README.md` — setup, features and limitations
