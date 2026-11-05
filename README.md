# LearnFlex 

This project is an extension of the LearnFlex files supplied for this task. The original student/teacher role selection, demo logins, dashboards, subjects, assessments, adaptive revision, concept map, progress reports, CSV export, Smart Recovery, language selector, accessibility controls, and projector functionality are retained and extended.

## Run the full project

Requires Node.js 18 or later. No third-party npm packages are required.

1. Extract the ZIP into a folder.
2. Open that extracted folder in VS Code or a terminal.
3. Run:

   ```bash
   npm start
   ```

4. Open **http://localhost:3100** in your computer's browser.
5. For the multi-device classroom test, connect the teacher computer and student devices to the same trusted Wi-Fi/LAN. On the teacher computer, find its local IPv4 address, then open `http://<teacher-computer-ip>:3100` on student devices. Allow Node.js through the local firewall for a private network if prompted.
6. Stop the server with **Ctrl+C** in its terminal.

If port 3100 is already in use, choose another port:

- Windows PowerShell: `$env:PORT=3101; npm start`
- macOS/Linux: `PORT=3101 npm start`

Then open `http://localhost:3101` and use that same port on other devices.

## Demo credentials

- Student: `LF1001` / `learn123`
- Teacher: `TEACH01` / `teach123`
- Additional demo students: `LF1002` and `LF1003`, password `learn123`

These are public demo credentials, not secure user accounts.

## What was added

### 1. Misconception Detective
- A Class 6-style fractions diagnostic question checks the common error of adding denominators.
- Wrong answers can show a rule-based “possible misunderstanding” explanation and a targeted next action.
- Assessment results store the generated misconception signals for teacher-level summaries.
- The teacher Insights page includes aggregated signals from recorded assessments. These signals are hints, not diagnoses or fixed labels.

### 2. One concept, multiple learning paths
- Lesson tabs: Read, Hear it, See it, and Step by step.
- Visual teaching aids for fractions, algebra, photosynthesis, food chains, reading comprehension, and community/civics.
- Telugu-friendly / Hinglish topic cards and a small English–regional-language concept bridge. This is a limited reviewed-style demo glossary, not a full translation of all course material.
- Existing text-to-speech, speech-rate control, high contrast and reading-friendly display retained, with a larger-text option added.

### 3. Classroom Pulse
- Classroom Reality Mode lets teachers choose one shared screen, shared devices, individual devices, or weak internet.
- Manual response tallies work on one device and are saved in the browser.
- A teacher action card highlights the most common incorrect option and suggests a possible reteaching action.
- Live multi-device room: teacher starts a room and shares the code. Logged-in students open **Join classroom**, enter the code, select their answer and confidence, and submit. The teacher sees the joined count and response tally refresh roughly every two seconds. The teacher can send a new question, reveal the answer, and end the room.

### 4. Offline topic packs
- Save a topic pack in browser storage for use on that browser/device.
- Export a topic JSON file for backup or content handoff.
- Service worker caches the app shell for offline reload after the first successful visit on localhost/HTTPS.
- API responses are excluded from service-worker caching so live class state isn't served from a stale cache.

### 5. Shared demo data
- When run using `npm start`, the front end syncs demo state through `/api/sync`; server-sent events notify open browsers about updates.
- Assessment and recovery history are merged across clients for the demo.
- The server stores state in `data/state.json` and active/recent classroom rooms in `data/classroom-sessions.json`.

## Important boundaries (please read before demo day)

- This is a hackathon/demo prototype, **not production-ready for real children’s data**. Demo passwords and front-end role checks are not secure authentication. Do not enter real names, real student IDs, health/disability details, or reusable passwords.
- The local Node server can support multi-device room participation only while it is running and reachable on the same network. This is not a hosted cloud service and will not work across the public internet by itself.
- Offline app-shell cache works on localhost/HTTPS. Browsers may not allow service workers over a plain HTTP LAN IP. The core website and localStorage may still work on LAN, but offline reload on that device requires a secure context and successful initial caching.
- Each device has its own localStorage. Server sync merges the demo state, but this prototype has not had formal multi-user conflict, penetration, load, accessibility-conformance, or student-outcome testing.
- Topic packs downloaded as JSON are data exports; LearnFlex does not currently import arbitrary JSON files into the curriculum. Its bundled topic content works offline once the app shell has been cached.
- Telugu/Hinglish bridge text covers the included topics only. Human review by educators/native speakers and curriculum mapping are still necessary before classroom deployment.
- Recommendation logic is transparent rule-based JavaScript, not a trained AI/ML model. “Possible misconception” is an educational hint based on an answer choice, not a definitive diagnosis.
- There is no QR-code join or Bluetooth/Wi-Fi Direct mesh. Use the room code on the same reachable server/network.

## Folder contents

- `index.html` — role selection, login layout, app shell and accessibility controls
- `styles.css` — responsive styling, learning modes, diagnostics and live-classroom UI
- `app.js` — existing LearnFlex app plus learning modes, diagnostics, local packs and class UI
- `server.js` — dependency-free Node HTTP/API server, shared demo-state sync and classroom rooms
- `start-learnflex.bat` / `start-learnflex.sh` — quick launch helpers
- `package.json` — run/check scripts
- `sw.js` — offline app-shell caching (API requests excluded)
- `manifest.webmanifest` — web app metadata
- `data/seed.json` — initial demo users and topic content
- `data/state.json` — persistent shared demo state (created on first run)
- `data/classroom-sessions.json` — classroom room sessions (created on first run)
- `tests/smoke-test.js` — repeatable server/API smoke test using temporary test data

## Basic checks

```bash
npm run check
npm test
curl http://localhost:3100/api/health
```

For a classroom test, open the app as teacher on one browser/device and a student on another browser/device using the same server address. Start a live room in Classroom Pulse, join with the code on the student device, submit a response, and watch the teacher response count update.
