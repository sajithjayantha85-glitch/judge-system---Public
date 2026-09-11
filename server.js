const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const defaultData = require('./data/defaultData');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Load state from file or default
let state;
try {
  if (fs.existsSync(STORE_PATH)) {
    state = JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'));
    if (!state.judges || state.judges.length < 20) {
      state.judges = defaultData.judges;
    }
    if (typeof state.activeItemNumber !== 'number') {
      state.activeItemNumber = 1;
    }
    if (typeof state.votingOpen !== 'boolean') {
      state.votingOpen = false;
    }
    if (!state.totalItems) {
      state.totalItems = { flags: 10, emblems: 10 };
    }
  } else {
    state = JSON.parse(JSON.stringify(defaultData));
    fs.writeFileSync(STORE_PATH, JSON.stringify(state, null, 2), 'utf-8');
  }
} catch (err) {
  console.error('Error loading store, using defaults:', err);
  state = JSON.parse(JSON.stringify(defaultData));
}

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

// Public State API
app.get('/api/state', (req, res) => {
  res.json({
    activeCompetition: state.activeCompetition,
    activeItemNumber: state.activeItemNumber,
    votingOpen: state.votingOpen,
    totalItems: state.totalItems,
    scores: state.scores,
    judges: state.judges.map(j => ({ id: j.id, name: j.name })) // exclude PIN
  });
});

// Judge Login / Verification
app.post('/api/judge/login', (req, res) => {
  const { judgeId, pin } = req.body;
  const numericId = parseInt(judgeId, 10);
  const judge = state.judges.find(j => j.id === numericId);

  if (!judge) {
    return res.status(404).json({ success: false, message: 'Judge ID not found' });
  }

  if (judge.pin && judge.pin !== pin?.trim()) {
    return res.status(401).json({ success: false, message: 'Invalid PIN' });
  }

  res.json({ success: true, judge: { id: judge.id, name: judge.name } });
});

// Admin Login / Verification
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  const configuredPassword = state.adminPassword || 'admin2026';

  if (password && password.trim() === configuredPassword) {
    res.json({ success: true, message: 'Authentication successful' });
  } else {
    res.status(401).json({ success: false, message: 'Invalid Admin Password' });
  }
});

// Admin Authorization Middleware
function checkAdminAuth(req, res, next) {
  const configuredPassword = state.adminPassword || 'admin2026';
  const providedPassword = req.headers['x-admin-password'] || req.body.adminPassword;

  if (providedPassword && providedPassword.trim() === configuredPassword) {
    return next();
  }
  return res.status(401).json({ success: false, message: 'Unauthorized: Invalid Admin Password' });
}

// Submit Score (Judge)
app.post('/api/score', (req, res) => {
  const { judgeId, pin, score } = req.body;

  if (!state.votingOpen) {
    return res.status(403).json({ success: false, message: 'Voting is currently closed for this design' });
  }

  const numericJudgeId = parseInt(judgeId, 10);
  const numericScore = parseInt(score, 10);

  if (isNaN(numericScore) || numericScore < 1 || numericScore > 10) {
    return res.status(400).json({ success: false, message: 'Score must be an integer between 1 and 10' });
  }

  const judge = state.judges.find(j => j.id === numericJudgeId);
  if (!judge || judge.pin !== pin?.trim()) {
    return res.status(401).json({ success: false, message: 'Unauthorized: Invalid Judge Credentials' });
  }

  const comp = state.activeCompetition;
  const num = state.activeItemNumber.toString();

  if (!state.scores[comp]) state.scores[comp] = {};
  if (!state.scores[comp][num]) state.scores[comp][num] = {};

  const submission = {
    score: numericScore,
    submittedAt: new Date().toISOString()
  };

  state.scores[comp][num][numericJudgeId] = submission;
  saveState();

  // Instant broadcast
  io.emit('score-updated', {
    competition: comp,
    itemNumber: state.activeItemNumber,
    judgeId: numericJudgeId,
    submission
  });

  res.json({ success: true, submission, itemNumber: state.activeItemNumber });
});

// Admin: Set Active Round & Voting Status (Protected)
app.post('/api/admin/set-round', checkAdminAuth, (req, res) => {
  const { competition, itemNumber, votingOpen } = req.body;

  if (competition && (competition === 'flags' || competition === 'emblems')) {
    state.activeCompetition = competition;
  }
  if (typeof itemNumber === 'number' && itemNumber >= 1) {
    state.activeItemNumber = itemNumber;
  }
  if (typeof votingOpen === 'boolean') {
    state.votingOpen = votingOpen;
  }

  saveState();

  io.emit('round-changed', {
    activeCompetition: state.activeCompetition,
    activeItemNumber: state.activeItemNumber,
    votingOpen: state.votingOpen
  });

  res.json({
    success: true,
    activeCompetition: state.activeCompetition,
    activeItemNumber: state.activeItemNumber,
    votingOpen: state.votingOpen
  });
});

// Admin: Update total number of items (flags/emblems) (Protected)
app.post('/api/admin/set-total-items', checkAdminAuth, (req, res) => {
  const { competition, count } = req.body;
  const num = parseInt(count, 10);
  if (state.totalItems[competition] && num > 0) {
    state.totalItems[competition] = num;
    saveState();
    io.emit('total-items-changed', { totalItems: state.totalItems });
    res.json({ success: true, totalItems: state.totalItems });
  } else {
    res.status(400).json({ success: false, message: 'Invalid count' });
  }
});

// Admin: Reset Scores (Protected)
app.post('/api/admin/reset-scores', checkAdminAuth, (req, res) => {
  const { competition } = req.body;
  if (competition === 'all') {
    state.scores = { flags: {}, emblems: {} };
  } else if (state.scores[competition]) {
    state.scores[competition] = {};
  }
  saveState();

  io.emit('scores-reset', { competition });
  res.json({ success: true });
});

// Export CSV of Results
app.get('/api/export/csv', (req, res) => {
  const competition = req.query.competition || state.activeCompetition;
  const compScores = state.scores[competition] || {};
  const judges = state.judges;
  const totalCount = (state.totalItems && state.totalItems[competition]) || 10;

  let header = ['Rank', 'Design Number'];
  judges.forEach(j => header.push(j.name));
  header.push(`Total (out of ${judges.length * 10})`);
  header.push('Average (out of 10.00)');

  const rows = [];
  for (let num = 1; num <= totalCount; num++) {
    const itemScores = compScores[num.toString()] || {};
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
    rows.push({
      number: num,
      judgeScores,
      total,
      average: parseFloat(average)
    });
  }

  // Sort by average descending
  rows.sort((a, b) => b.average - a.average || b.total - a.total);

  let csv = header.join(',') + '\r\n';
  rows.forEach((r, idx) => {
    const label = `${competition === 'flags' ? 'Flag' : 'Emblem'} #${r.number < 10 ? '0' + r.number : r.number}`;
    const line = [
      idx + 1,
      `"${label}"`,
      ...r.judgeScores,
      r.total,
      r.average.toFixed(2)
    ];
    csv += line.join(',') + '\r\n';
  });

  const filename = `${competition}-results-${new Date().toISOString().slice(0, 10)}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send('\uFEFF' + csv);
});

// Socket connection
io.on('connection', (socket) => {
  // Client can register
  socket.on('register', (data) => {
    socket.data.role = data.role;
    socket.data.judgeId = data.judgeId;
  });
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(`Live Synchronized Judging Server Running!`);
    console.log(`URL:            http://localhost:${PORT}`);
    console.log(`Judge Portal:   http://localhost:${PORT}/judge.html`);
    console.log(`Admin Panel:    http://localhost:${PORT}/admin.html`);
    console.log(`Projector View: http://localhost:${PORT}/display.html`);
    console.log(`QR Cards:       http://localhost:${PORT}/qr-sheet.html`);
    console.log(`=========================================`);
  });
}

module.exports = { app, server };
