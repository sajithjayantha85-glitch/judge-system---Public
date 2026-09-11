const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const multer = require('multer');

const defaultData = require('./data/defaultData');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Multer storage for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

// Load state from file or defaultData
let state;
try {
  if (fs.existsSync(STORE_PATH)) {
    state = JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'));
    // Ensure all 20 judges exist
    if (!state.judges || state.judges.length < 20) {
      state.judges = defaultData.judges;
    }
  } else {
    state = JSON.parse(JSON.stringify(defaultData));
    fs.writeFileSync(STORE_PATH, JSON.stringify(state, null, 2), 'utf-8');
  }
} catch (err) {
  console.error('Error loading store, using defaults:', err);
  state = JSON.parse(JSON.stringify(defaultData));
}

// Helper to save state
function saveState() {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save state:', err);
  }
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// API Routes

// Get full system state
app.get('/api/state', (req, res) => {
  res.json({
    activeCompetition: state.activeCompetition,
    activeItemId: state.activeItemId,
    votingLocked: state.votingLocked,
    broadcastActiveItem: state.broadcastActiveItem,
    competitions: state.competitions,
    scores: state.scores,
    judges: state.judges.map(j => ({ id: j.id, name: j.name, active: j.active })) // hide pins from public state
  });
});

// Judge Login / Verification
app.post('/api/judge/login', (req, res) => {
  const { judgeId, pin } = req.body;
  const numericId = parseInt(judgeId, 10);
  const judge = state.judges.find(j => j.id === numericId);

  if (!judge) {
    return res.status(404).json({ success: false, message: 'විනිශ්චයකාර අංකය හමු නොවීය (Judge not found)' });
  }

  if (judge.pin && judge.pin !== pin?.trim()) {
    return res.status(401).json({ success: false, message: 'වැරදි PIN අංකයකි (Invalid PIN)' });
  }

  res.json({
    success: true,
    judge: { id: judge.id, name: judge.name }
  });
});

// Submit Score
app.post('/api/score', (req, res) => {
  const { judgeId, pin, competitionId, itemId, score, comment } = req.body;

  if (state.votingLocked) {
    return res.status(403).json({ success: false, message: 'ලකුණු ලබාදීම අත්හිටුවා ඇත (Voting is currently locked)' });
  }

  const numericJudgeId = parseInt(judgeId, 10);
  const numericScore = parseFloat(score);

  if (isNaN(numericScore) || numericScore < 1 || numericScore > 10) {
    return res.status(400).json({ success: false, message: 'ලකුණු 1 සිට 10 දක්වා පමණක් වලංගු වේ (Score must be 1 to 10)' });
  }

  const judge = state.judges.find(j => j.id === numericJudgeId);
  if (!judge || judge.pin !== pin?.trim()) {
    return res.status(401).json({ success: false, message: 'අවලංගු විනිශ්චයකාර පිවිසුමකි (Unauthorized)' });
  }

  if (!state.scores[competitionId]) {
    state.scores[competitionId] = {};
  }
  if (!state.scores[competitionId][itemId]) {
    state.scores[competitionId][itemId] = {};
  }

  const submission = {
    score: numericScore,
    comment: (comment || '').trim(),
    submittedAt: new Date().toISOString()
  };

  state.scores[competitionId][itemId][numericJudgeId] = submission;
  saveState();

  // Broadcast to all connected clients
  io.emit('score-updated', {
    competitionId,
    itemId,
    judgeId: numericJudgeId,
    submission
  });

  res.json({ success: true, submission });
});

// Admin: Switch Competition
app.post('/api/admin/set-competition', (req, res) => {
  const { competitionId } = req.body;
  if (!state.competitions[competitionId]) {
    return res.status(400).json({ success: false, message: 'අවලංගු තරඟයකි (Invalid competition)' });
  }

  state.activeCompetition = competitionId;
  const items = state.competitions[competitionId].items;
  state.activeItemId = items.length > 0 ? items[0].id : null;
  saveState();

  io.emit('competition-changed', {
    activeCompetition: state.activeCompetition,
    activeItemId: state.activeItemId
  });

  res.json({ success: true, activeCompetition: state.activeCompetition, activeItemId: state.activeItemId });
});

// Admin: Set Active Item
app.post('/api/admin/set-active-item', (req, res) => {
  const { itemId } = req.body;
  state.activeItemId = itemId;
  saveState();

  io.emit('active-item-changed', {
    itemId: state.activeItemId,
    broadcast: state.broadcastActiveItem
  });

  res.json({ success: true, activeItemId: state.activeItemId });
});

// Admin: Toggle Lock
app.post('/api/admin/toggle-lock', (req, res) => {
  state.votingLocked = !state.votingLocked;
  saveState();

  io.emit('voting-lock-changed', { votingLocked: state.votingLocked });
  res.json({ success: true, votingLocked: state.votingLocked });
});

// Admin: Toggle Broadcast Mode
app.post('/api/admin/toggle-broadcast', (req, res) => {
  state.broadcastActiveItem = !state.broadcastActiveItem;
  saveState();

  io.emit('broadcast-mode-changed', { broadcastActiveItem: state.broadcastActiveItem });
  res.json({ success: true, broadcastActiveItem: state.broadcastActiveItem });
});

// Admin: Add new Flag or Emblem item
app.post('/api/admin/add-item', upload.single('image'), (req, res) => {
  const { competitionId, title, description, imageUrl } = req.body;
  if (!state.competitions[competitionId]) {
    return res.status(400).json({ success: false, message: 'Invalid competition' });
  }

  const items = state.competitions[competitionId].items;
  const nextNumber = items.length > 0 ? Math.max(...items.map(i => i.number)) + 1 : 1;
  const prefix = competitionId === 'flags' ? 'flag' : 'emblem';
  const id = `${prefix}-${Date.now()}`;

  let finalImageUrl = imageUrl;
  if (req.file) {
    finalImageUrl = `/uploads/${req.file.filename}`;
  }
  if (!finalImageUrl) {
    finalImageUrl = 'https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=600&auto=format&fit=crop&q=80';
  }

  const newItem = {
    id,
    number: nextNumber,
    title: title || `${competitionId === 'flags' ? 'Flag' : 'Emblem'} #${nextNumber < 10 ? '0' + nextNumber : nextNumber}`,
    description: description || `නිර්මාණ අංක ${nextNumber}`,
    imageUrl: finalImageUrl
  };

  items.push(newItem);
  saveState();

  io.emit('item-added', { competitionId, item: newItem });
  res.json({ success: true, item: newItem });
});

// Admin: Delete item
app.post('/api/admin/delete-item', (req, res) => {
  const { competitionId, itemId } = req.body;
  if (!state.competitions[competitionId]) return res.status(400).json({ success: false });

  state.competitions[competitionId].items = state.competitions[competitionId].items.filter(i => i.id !== itemId);
  if (state.scores[competitionId]) {
    delete state.scores[competitionId][itemId];
  }
  saveState();

  io.emit('item-deleted', { competitionId, itemId });
  res.json({ success: true });
});

// Admin: Reset Scores
app.post('/api/admin/reset-scores', (req, res) => {
  const { competitionId } = req.body;
  if (competitionId === 'all') {
    state.scores = { flags: {}, emblems: {} };
  } else if (state.scores[competitionId]) {
    state.scores[competitionId] = {};
  }
  saveState();

  io.emit('scores-reset', { competitionId });
  res.json({ success: true });
});

// Admin: Reset to Factory Defaults
app.post('/api/admin/factory-reset', (req, res) => {
  state = JSON.parse(JSON.stringify(defaultData));
  saveState();
  io.emit('factory-reset', state);
  res.json({ success: true });
});

// Export CSV of Results
app.get('/api/export/csv', (req, res) => {
  const competitionId = req.query.competitionId || state.activeCompetition;
  const comp = state.competitions[competitionId];
  if (!comp) return res.status(404).send('Competition not found');

  const compScores = state.scores[competitionId] || {};
  const judges = state.judges;

  // Header row: Rank, Number, Title, Judge 01 ... Judge 20, Total, Average
  let header = ['Rank', 'Item Number', 'Title'];
  judges.forEach(j => header.push(j.name));
  header.push('Total Score (out of ' + (judges.length * 10) + ')');
  header.push('Average Score (out of 10)');

  // Compute row data
  const rows = comp.items.map(item => {
    const itemScores = compScores[item.id] || {};
    let total = 0;
    let count = 0;
    const judgeScores = judges.map(j => {
      const entry = itemScores[j.id];
      if (entry && typeof entry.score === 'number') {
        total += entry.score;
        count++;
        return entry.score;
      }
      return '-';
    });

    const average = count > 0 ? (total / count).toFixed(2) : '0.00';

    return {
      number: item.number,
      title: item.title,
      judgeScores,
      total,
      average: parseFloat(average)
    };
  });

  // Sort by average descending
  rows.sort((a, b) => b.average - a.average || b.total - a.total);

  // Build CSV content
  let csv = header.join(',') + '\r\n';
  rows.forEach((r, idx) => {
    const line = [
      idx + 1,
      `"${r.number}"`,
      `"${r.title.replace(/"/g, '""')}"`,
      ...r.judgeScores,
      r.total,
      r.average
    ];
    csv += line.join(',') + '\r\n';
  });

  const filename = `${competitionId}-results-${new Date().toISOString().slice(0, 10)}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send('\uFEFF' + csv); // add UTF-8 BOM for clean Excel display
});

// Socket.io Real-time Handlers
io.on('connection', (socket) => {
  // Client can register role
  socket.on('register', (data) => {
    socket.data.role = data.role;
    socket.data.judgeId = data.judgeId;
  });
});

// Start Server
if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(`Judges Competition Server Running!`);
    console.log(`Local Access:   http://localhost:${PORT}`);
    console.log(`Judge Portal:   http://localhost:${PORT}/judge.html`);
    console.log(`Admin Panel:    http://localhost:${PORT}/admin.html`);
    console.log(`Display Screen: http://localhost:${PORT}/display.html`);
    console.log(`QR Cards Sheet: http://localhost:${PORT}/qr-sheet.html`);
    console.log(`=========================================`);
  });
}

module.exports = { app, server };

