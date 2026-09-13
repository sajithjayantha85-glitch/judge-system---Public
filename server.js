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
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const comp = req.body.competition || 'item';
    const num = req.body.itemNumber || '0';
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    cb(null, `${comp}-${num}-${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

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
      state.totalItems = { flags: 15, emblems: 15, stamps: 15 };
    }
    if (!state.totalItems.stamps) {
      state.totalItems.stamps = 15;
    }
    if (!state.scores) {
      state.scores = { flags: {}, emblems: {}, stamps: {} };
    }
    if (!state.scores.stamps) {
      state.scores.stamps = {};
    }
    if (!state.images) {
      state.images = { flags: {}, emblems: {}, stamps: {} };
    }
    if (!state.images.flags) state.images.flags = {};
    if (!state.images.emblems) state.images.emblems = {};
    if (!state.images.stamps) state.images.stamps = {};
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

// Live connected judges tracking
const connectedJudgeSockets = new Map(); // socket.id -> judgeId

function getOnlineJudgeIds() {
  return Array.from(new Set(connectedJudgeSockets.values()));
}

function broadcastJudgeAttendance() {
  io.emit('judges-online-update', { onlineJudges: getOnlineJudgeIds() });
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Public State API
app.get('/api/state', (req, res) => {
  // Validate that local /uploads/ files actually exist on disk
  const validatedImages = { flags: {}, emblems: {}, stamps: {} };
  if (state.images) {
    for (const comp of ['flags', 'emblems', 'stamps']) {
      const compImgs = state.images[comp] || {};
      for (const [num, url] of Object.entries(compImgs)) {
        if (!url) continue;
        if (url.startsWith('/uploads/')) {
          const filePath = path.join(__dirname, 'public', url.replace(/^\//, ''));
          if (fs.existsSync(filePath)) {
            validatedImages[comp][num] = url;
          }
        } else {
          validatedImages[comp][num] = url;
        }
      }
    }
  }

  res.json({
    activeCompetition: state.activeCompetition,
    activeItemNumber: state.activeItemNumber,
    votingOpen: state.votingOpen,
    totalItems: state.totalItems,
    scores: state.scores,
    images: validatedImages,
    onlineJudges: getOnlineJudgeIds(),
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

  if (competition && (competition === 'flags' || competition === 'emblems' || competition === 'stamps')) {
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

// Admin: Update total number of items (flags/emblems/stamps) (Protected)
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
    state.scores = { flags: {}, emblems: {}, stamps: {} };
  } else if (state.scores[competition]) {
    state.scores[competition] = {};
  }
  saveState();

  io.emit('scores-reset', { competition });
  res.json({ success: true });
});

// Admin: Upload Artwork Image for a Design Number (Protected)
app.post('/api/admin/upload-image', checkAdminAuth, upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file uploaded' });
    }
    const { competition, itemNumber } = req.body;
    const num = parseInt(itemNumber, 10);
    if (!competition || isNaN(num) || num < 1) {
      return res.status(400).json({ success: false, message: 'Invalid competition or item number' });
    }

    if (!state.images) state.images = { flags: {}, emblems: {}, stamps: {} };
    if (!state.images[competition]) state.images[competition] = {};

    // Remove previous file if exists
    const oldImageUrl = state.images[competition][num.toString()];
    if (oldImageUrl) {
      const oldFilePath = path.join(__dirname, 'public', oldImageUrl.replace(/^\//, ''));
      if (fs.existsSync(oldFilePath)) {
        try { fs.unlinkSync(oldFilePath); } catch (e) { /* ignore */ }
      }
    }

    const relativeUrl = `/uploads/${req.file.filename}`;
    state.images[competition][num.toString()] = relativeUrl;
    saveState();

    // Broadcast update to display, judge phones, and admin
    io.emit('item-image-updated', {
      competition,
      itemNumber: num,
      imageUrl: relativeUrl
    });

    res.json({ success: true, imageUrl: relativeUrl, competition, itemNumber: num });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Admin: Remove Artwork Image for a Design Number (Protected)
app.post('/api/admin/remove-image', checkAdminAuth, (req, res) => {
  try {
    const { competition, itemNumber } = req.body;
    const num = parseInt(itemNumber, 10);
    if (!competition || isNaN(num) || num < 1) {
      return res.status(400).json({ success: false, message: 'Invalid competition or item number' });
    }

    if (state.images && state.images[competition] && state.images[competition][num.toString()]) {
      const oldImageUrl = state.images[competition][num.toString()];
      const oldFilePath = path.join(__dirname, 'public', oldImageUrl.replace(/^\//, ''));
      if (fs.existsSync(oldFilePath)) {
        try { fs.unlinkSync(oldFilePath); } catch (e) { /* ignore */ }
      }
      delete state.images[competition][num.toString()];
      saveState();
    }

    io.emit('item-image-updated', {
      competition,
      itemNumber: num,
      imageUrl: null
    });

    res.json({ success: true, competition, itemNumber: num });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Admin: Set Direct Image URL for a Design Number (Protected)
app.post('/api/admin/set-image-url', checkAdminAuth, (req, res) => {
  try {
    const { competition, itemNumber, imageUrl } = req.body;
    const num = parseInt(itemNumber, 10);
    if (!competition || isNaN(num) || num < 1 || !imageUrl) {
      return res.status(400).json({ success: false, message: 'Invalid parameters or image URL' });
    }

    if (!state.images) state.images = { flags: {}, emblems: {}, stamps: {} };
    if (!state.images[competition]) state.images[competition] = {};

    const cleanUrl = imageUrl.trim();
    state.images[competition][num.toString()] = cleanUrl;
    saveState();

    io.emit('item-image-updated', {
      competition,
      itemNumber: num,
      imageUrl: cleanUrl
    });

    res.json({ success: true, imageUrl: cleanUrl, competition, itemNumber: num });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Admin: Batch Sync Artworks from Client IndexedDB / Backup (Protected)
app.post('/api/admin/sync-images', checkAdminAuth, (req, res) => {
  try {
    const { artworks } = req.body;
    if (!Array.isArray(artworks)) {
      return res.status(400).json({ success: false, message: 'Invalid artworks array' });
    }

    if (!state.images) state.images = { flags: {}, emblems: {}, stamps: {} };

    let restoredCount = 0;
    if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

    artworks.forEach(item => {
      const { competition, itemNumber, dataUrl, url } = item;
      const num = parseInt(itemNumber, 10);
      if (!competition || isNaN(num) || num < 1) return;
      if (!state.images[competition]) state.images[competition] = {};

      let finalUrl = url;
      if (dataUrl && dataUrl.startsWith('data:image/')) {
        try {
          const matches = dataUrl.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
          if (matches) {
            let ext = matches[1].toLowerCase();
            if (ext === 'jpeg') ext = 'jpg';
            else if (ext.includes('svg')) ext = 'svg';
            else if (!['png', 'jpg', 'webp', 'gif'].includes(ext)) ext = 'png';

            const base64Data = matches[2];
            const filename = `${competition}-${num}-synced-${Date.now()}.${ext}`;
            const filePath = path.join(UPLOADS_DIR, filename);
            fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
            finalUrl = `/uploads/${filename}`;
          } else {
            finalUrl = dataUrl;
          }
        } catch (e) {
          console.error('Error writing synced image file:', e);
          finalUrl = dataUrl;
        }
      } else if (!finalUrl && dataUrl) {
        finalUrl = dataUrl;
      }

      if (finalUrl) {
        state.images[competition][num.toString()] = finalUrl;
        restoredCount++;
      }
    });

    saveState();

    io.emit('images-synced', { images: state.images });

    const currentActiveImg = (state.images[state.activeCompetition] || {})[state.activeItemNumber.toString()] || null;
    io.emit('item-image-updated', {
      competition: state.activeCompetition,
      itemNumber: state.activeItemNumber,
      imageUrl: currentActiveImg
    });

    res.json({ success: true, restoredCount, images: state.images });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Admin: Export All Artworks with Base64 Payload for Backup Pack (Protected)
app.get('/api/admin/export-images', checkAdminAuth, (req, res) => {
  try {
    const exportData = [];
    const competitions = ['flags', 'emblems', 'stamps'];

    competitions.forEach(comp => {
      const compImages = (state.images && state.images[comp]) || {};
      for (const [numStr, imgUrl] of Object.entries(compImages)) {
        if (!imgUrl) continue;
        let dataUrl = null;
        if (imgUrl.startsWith('data:image/')) {
          dataUrl = imgUrl;
        } else if (imgUrl.startsWith('/uploads/')) {
          const filePath = path.join(__dirname, 'public', imgUrl.replace(/^\//, ''));
          if (fs.existsSync(filePath)) {
            const ext = path.extname(filePath).replace('.', '').toLowerCase() || 'png';
            const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
            const fileBuf = fs.readFileSync(filePath);
            dataUrl = `data:${mime};base64,${fileBuf.toString('base64')}`;
          }
        }
        exportData.push({
          competition: comp,
          itemNumber: parseInt(numStr, 10),
          url: imgUrl,
          dataUrl: dataUrl || imgUrl,
          exportedAt: new Date().toISOString()
        });
      }
    });

    res.json({
      success: true,
      system: 'Department of Examinations, Sri Lanka Judging System',
      version: '2.0',
      exportedAt: new Date().toISOString(),
      totalArtworks: exportData.length,
      artworks: exportData
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Export CSV of Results
app.get('/api/export/csv', (req, res) => {
  const competition = req.query.competition || state.activeCompetition;
  const compScores = state.scores[competition] || {};
  const judges = state.judges;
  const totalCount = (state.totalItems && state.totalItems[competition]) || 15;

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
    let compLabel = 'Flag';
    if (competition === 'emblems') compLabel = 'Emblem';
    else if (competition === 'stamps') compLabel = 'Stamp';

    const label = `${compLabel} #${r.number < 10 ? '0' + r.number : r.number}`;
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
  socket.on('register', (data) => {
    socket.data.role = data.role;
    if (data.role === 'judge' && data.judgeId) {
      const numId = parseInt(data.judgeId, 10);
      socket.data.judgeId = numId;
      connectedJudgeSockets.set(socket.id, numId);
      broadcastJudgeAttendance();
    }
  });

  socket.on('disconnect', () => {
    if (connectedJudgeSockets.has(socket.id)) {
      connectedJudgeSockets.delete(socket.id);
      broadcastJudgeAttendance();
    }
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
