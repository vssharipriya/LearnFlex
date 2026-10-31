'use strict';

// LearnFlex Saathi demo server: static app + shared demo state + classroom rooms.
// This is intended for a hackathon/demo network, not production student data.
const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const DATA_DIR = process.env.LEARNFLEX_DATA_DIR ? path.resolve(process.env.LEARNFLEX_DATA_DIR) : path.join(ROOT, 'data');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'classroom-sessions.json');
const PORT = Number(process.env.PORT || 3100);
const HOST = process.env.HOST || '0.0.0.0';
const MAX_BODY = 4 * 1024 * 1024;
const clients = new Set();

fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(STATE_FILE)) fs.copyFileSync(path.join(ROOT, 'data', 'seed.json'), STATE_FILE);
if (!fs.existsSync(SESSIONS_FILE)) fs.writeFileSync(SESSIONS_FILE, '{}', 'utf8');
let state = readJSON(STATE_FILE, {});
let sessions = readJSON(SESSIONS_FILE, {});

function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return structuredClone(fallback); }
}
function persistState() { fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8'); }
function persistSessions() { fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2), 'utf8'); }
function json(res, code, value) {
  const body = JSON.stringify(value);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}
function broadcast(type, data = {}) {
  const packet = `event: update\ndata: ${JSON.stringify({ type, ...data })}\n\n`;
  for (const res of clients) { try { res.write(packet); } catch { clients.delete(res); } }
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''; let tooLarge = false;
    req.on('data', chunk => { body += chunk; if (body.length > MAX_BODY) { tooLarge = true; reject(new Error('Request body is too large.')); req.destroy(); } });
    req.on('end', () => { if (tooLarge) return; if (!body) return resolve({}); try { resolve(JSON.parse(body)); } catch { reject(new Error('Request body must be valid JSON.')); } });
    req.on('error', reject);
  });
}
function mergeById(current = [], incoming = [], key = 'id') {
  const map = new Map();
  for (const item of [...current, ...incoming]) {
    if (!item || item[key] === undefined) continue;
    const id = String(item[key]); map.set(id, { ...(map.get(id) || {}), ...item });
  }
  return [...map.values()];
}
function mergeTopics(current = [], incoming = []) {
  const map = new Map();
  for (const topic of [...current, ...incoming]) {
    if (!topic || !topic.id) continue;
    const old = map.get(topic.id) || {};
    map.set(topic.id, { ...old, ...topic, questions: mergeById(old.questions || [], topic.questions || [], 'id') });
  }
  return [...map.values()];
}
function mergeProgress(current = {}, incoming = {}) {
  const out = { ...current };
  for (const [uid, p] of Object.entries(incoming)) {
    const old = out[uid] || {};
    const topics = { ...(old.topics || {}) };
    for (const [tid, t] of Object.entries((p && p.topics) || {})) {
      const oldTopic = topics[tid] || {};
      const oldTime = oldTopic.lastAt ? new Date(oldTopic.lastAt).getTime() : 0;
      const newTime = t.lastAt ? new Date(t.lastAt).getTime() : 0;
      topics[tid] = newTime >= oldTime ? { ...oldTopic, ...t } : { ...t, ...oldTopic };
    }
    out[uid] = { ...old, ...p, topics, activityDays: [...new Set([...(old.activityDays || []), ...((p && p.activityDays) || [])])].sort().slice(-400) };
  }
  return out;
}
function mergeState(current, incoming) {
  const next = { ...current, ...incoming };
  next.users = mergeById(current.users || [], incoming.users || [], 'id');
  next.topics = mergeTopics(current.topics || [], incoming.topics || []);
  next.results = mergeById(current.results || [], incoming.results || [], 'id').sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
  next.recoveries = mergeById(current.recoveries || [], incoming.recoveries || [], 'id').sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
  next.progress = mergeProgress(current.progress || {}, incoming.progress || {});
  next.preferences = { ...(current.preferences || {}), ...(incoming.preferences || {}) };
  return next;
}
function cleanCode(code) { return String(code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, ''); }
function findSession(code) { const cleaned = cleanCode(code); return Object.values(sessions).find(s => cleanCode(s.code) === cleaned); }
function saveRoom(session) { sessions[session.code] = session; persistSessions(); broadcast('classroom', { code: session.code, updatedAt: new Date().toISOString() }); }
function publicSession(session, { teacher = false, studentId = '' } = {}) {
  if (!session) return null;
  const copy = { ...session, participants: (session.participants || []).map(p => ({ studentId: p.studentId, studentName: p.studentName, joinedAt: p.joinedAt })) };
  const q = session.currentQuestion || {};
  copy.currentQuestion = { topicId: q.topicId, topicTitle: q.topicTitle, questionIndex: q.questionIndex, question: q.question, options: q.options || [] };
  if (teacher || session.revealed) { copy.currentQuestion.answer = q.answer; copy.currentQuestion.explain = q.explain; }
  if (teacher) copy.answers = session.answers || [];
  else copy.answers = (session.answers || []).filter(a => a.studentId === studentId).map(a => ({ studentId: a.studentId, answerIndex: a.answerIndex, confidence: a.confidence, questionIndex: a.questionIndex, submittedAt: a.submittedAt }));
  return copy;
}
function requireRoom(code, res) {
  const session = findSession(code);
  if (!session) { json(res, 404, { error: 'Room code not found. Ask the teacher to confirm the code.' }); return null; }
  return session;
}
function writeRoomQuestion(session, data) {
  const options = Array.isArray(data.options) ? data.options.slice(0, 8).map(String) : [];
  if (!data.question || options.length < 2 || !Number.isInteger(Number(data.answer)) || Number(data.answer) < 0 || Number(data.answer) >= options.length) throw new Error('Question data is incomplete.');
  session.currentQuestion = { topicId: String(data.topicId || ''), topicTitle: String(data.topicTitle || ''), questionIndex: Number(data.questionIndex || 0), question: String(data.question).slice(0, 1200), options, answer: Number(data.answer), explain: String(data.explain || '').slice(0, 1600) };
  session.revealed = false;
  session.answers = [];
}
async function handleAPI(req, res, url) {
  const pathname = url.pathname;
  if (req.method === 'GET' && pathname === '/api/health') return json(res, 200, { ok: true, service: 'LearnFlex Saathi', backend: true, multiDeviceClassroom: true, port: PORT, time: new Date().toISOString() });
  if (req.method === 'GET' && pathname === '/api/state') return json(res, 200, { state });
  if (req.method === 'POST' && pathname === '/api/sync') {
    const body = await readBody(req); const incoming = body.state;
    if (!incoming || !Array.isArray(incoming.users) || !Array.isArray(incoming.topics)) return json(res, 400, { error: 'State payload is incomplete.' });
    state = mergeState(state, incoming); persistState(); broadcast('state', { changedAt: new Date().toISOString() });
    return json(res, 200, { ok: true, state });
  }
  if (req.method === 'GET' && pathname === '/api/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.write(`event: ready\ndata: ${JSON.stringify({ ok: true })}\n\n`); clients.add(res);
    const heartbeat = setInterval(() => { try { res.write(': keep-alive\n\n'); } catch { clearInterval(heartbeat); clients.delete(res); } }, 20000);
    req.on('close', () => { clearInterval(heartbeat); clients.delete(res); }); return;
  }

  const roomBase = '/api/classroom/sessions';
  if (req.method === 'POST' && pathname === roomBase) {
    const body = await readBody(req);
    const code = String(crypto.randomInt(100000, 999999));
    const session = { code, id: crypto.randomUUID(), teacherId: String(body.teacherId || ''), teacherName: String(body.teacherName || 'Teacher'), mode: String(body.mode || 'shared-screen'), active: true, createdAt: new Date().toISOString(), revealed: false, participants: [], answers: [], currentQuestion: {} };
    try { writeRoomQuestion(session, body); } catch (e) { return json(res, 400, { error: e.message }); }
    saveRoom(session); return json(res, 201, { ok: true, session: publicSession(session, { teacher: true }) });
  }
  const roomMatch = pathname.match(/^\/api\/classroom\/sessions\/([^/]+)(?:\/(join|answers|next|reveal|end))?$/);
  if (roomMatch) {
    const code = decodeURIComponent(roomMatch[1]);
    if (req.method === 'GET' && !roomMatch[2]) {
      const session = requireRoom(code, res); if (!session) return;
      const teacher = url.searchParams.get('view') === 'teacher'; const studentId = url.searchParams.get('studentId') || '';
      return json(res, 200, { session: publicSession(session, { teacher, studentId }) });
    }
    if (req.method !== 'POST' || !roomMatch[2]) return json(res, 405, { error: 'Method not allowed.' });
    const session = requireRoom(code, res); if (!session) return;
    const action = roomMatch[2], body = await readBody(req);
    if (action === 'join') {
      if (!session.active) return json(res, 409, { error: 'This classroom room has ended.' });
      const studentId = String(body.studentId || '').trim(); const studentName = String(body.studentName || '').trim();
      if (!studentId || !studentName) return json(res, 400, { error: 'Student identity is missing. Log in again.' });
      let participant = session.participants.find(p => p.studentId === studentId);
      if (!participant) { participant = { studentId, studentName, joinedAt: new Date().toISOString() }; session.participants.push(participant); }
      else participant.studentName = studentName;
      saveRoom(session); return json(res, 200, { ok: true, session: publicSession(session, { studentId }) });
    }
    if (action === 'answers') {
      if (!session.active) return json(res, 409, { error: 'This classroom room has ended.' });
      const studentId = String(body.studentId || '').trim();
      if (!(session.participants || []).some(p => p.studentId === studentId)) return json(res, 403, { error: 'Join the room before submitting your answer.' });
      const q = session.currentQuestion, answerIndex = Number(body.answerIndex), confidence = String(body.confidence || '');
      if (!Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex >= q.options.length || !['high', 'medium', 'low'].includes(confidence)) return json(res, 400, { error: 'Choose a valid answer and confidence level.' });
      const already = session.answers.find(a => a.studentId === studentId && a.questionIndex === q.questionIndex);
      if (already) return json(res, 409, { error: 'Your answer is already saved for this question.' });
      session.answers.push({ studentId, studentName: String(body.studentName || ''), answerIndex, confidence, questionIndex: q.questionIndex, submittedAt: new Date().toISOString() });
      saveRoom(session); return json(res, 200, { ok: true, session: publicSession(session, { studentId }) });
    }
    if (action === 'next') {
      if (!session.active) return json(res, 409, { error: 'This classroom room has ended.' });
      if (body.teacherId && String(body.teacherId) !== session.teacherId) return json(res, 403, { error: 'Only the room’s teacher can change the question.' });
      try { writeRoomQuestion(session, body); } catch (e) { return json(res, 400, { error: e.message }); }
      saveRoom(session); return json(res, 200, { ok: true, session: publicSession(session, { teacher: true }) });
    }
    if (action === 'reveal') {
      if (body.teacherId && String(body.teacherId) !== session.teacherId) return json(res, 403, { error: 'Only the room’s teacher can reveal the answer.' });
      session.revealed = Boolean(body.revealed); saveRoom(session); return json(res, 200, { ok: true, session: publicSession(session, { teacher: true }) });
    }
    if (action === 'end') {
      if (body.teacherId && String(body.teacherId) !== session.teacherId) return json(res, 403, { error: 'Only the room’s teacher can end this room.' });
      session.active = false; session.endedAt = new Date().toISOString(); saveRoom(session); return json(res, 200, { ok: true, session: publicSession(session, { teacher: true }) });
    }
  }
  return json(res, 404, { error: 'API endpoint not found.' });
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
function serveStatic(req, res, url) {
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { return json(res, 400, { error: 'Invalid path.' }); }
  if (pathname === '/') pathname = '/index.html';
  if (pathname.includes('..') || pathname.startsWith('/data/') || pathname === '/server.js' || pathname === '/package.json' || pathname.startsWith('/.')) return json(res, 404, { error: 'Not found.' });
  const file = path.join(ROOT, pathname.slice(1));
  if (!file.startsWith(ROOT + path.sep) && file !== path.join(ROOT, 'index.html')) return json(res, 403, { error: 'Forbidden.' });
  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) return json(res, 404, { error: 'File not found.' });
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', ...(ext === '.html' ? { 'Cache-Control': 'no-cache' } : { 'Cache-Control': 'public, max-age=300' }) });
    fs.createReadStream(file).pipe(res);
  });
}
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (url.pathname.startsWith('/api/')) return await handleAPI(req, res, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'Method not allowed.' });
    if (req.method === 'HEAD') { const fake = new http.ServerResponse(req); return serveStatic(req, res, url); }
    return serveStatic(req, res, url);
  } catch (err) {
    console.error('Request error:', err);
    if (!res.headersSent) json(res, 500, { error: 'An unexpected server error occurred.' }); else res.end();
  }
});
server.listen(PORT, HOST, () => {
  console.log(`LearnFlex Saathi is running at http://localhost:${PORT}`);
  const addresses = Object.values(os.networkInterfaces()).flat().filter(x => x && !x.internal && (x.family === 'IPv4' || x.family === 4)).map(x => x.address);
  addresses.forEach(address => console.log(`Same-Wi-Fi student device URL: http://${address}:${PORT}`));
  console.log('Demo accounts only. Do not enter real student data or production passwords.');
});
process.on('SIGINT', () => { for (const res of clients) { try { res.end(); } catch {} } server.close(() => process.exit(0)); });
