// Ultra-Simplified Synchronized Judge Client
const socket = io();

let currentJudge = null;
let currentPin = null;
let state = null;

document.addEventListener('DOMContentLoaded', async () => {
  await loadState();
  populateJudgeDropdown();
  checkUrlParamsForAutoLogin();
  setupSocketListeners();
});

async function loadState() {
  try {
    const res = await fetch('/api/state');
    state = await res.json();
    renderJudgeView();
  } catch (err) {
    console.error('Failed to load state:', err);
  }
}

function populateJudgeDropdown() {
  const select = document.getElementById('judgeSelect');
  select.innerHTML = '<option value="">-- තෝරන්න (Select Judge) --</option>';
  if (!state || !state.judges) return;

  state.judges.forEach(j => {
    const opt = document.createElement('option');
    opt.value = j.id;
    opt.textContent = `${j.name} (විනිශ්චයකාර ${j.id})`;
    select.appendChild(opt);
  });
}

function checkUrlParamsForAutoLogin() {
  const params = new URLSearchParams(window.location.search);
  const judgeId = params.get('judge') || params.get('id');
  const pin = params.get('pin');

  if (judgeId && pin) {
    performLogin(judgeId, pin);
  }
}

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const judgeId = document.getElementById('judgeSelect').value;
  const pin = document.getElementById('pinInput').value;
  if (!judgeId || !pin) {
    showLoginError('කරුණාකර විනිශ්චයකාර අංකය සහ PIN ඇතුළත් කරන්න');
    return;
  }
  await performLogin(judgeId, pin);
});

async function performLogin(judgeId, pin) {
  try {
    const res = await fetch('/api/judge/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ judgeId, pin })
    });
    const data = await res.json();

    if (data.success) {
      currentJudge = data.judge;
      currentPin = pin;
      document.getElementById('authScreen').classList.add('hidden');
      document.getElementById('headerJudgeName').textContent = currentJudge.name;
      socket.emit('register', { role: 'judge', judgeId: currentJudge.id });
      renderJudgeView();
    } else {
      showLoginError(data.message || 'පිවිසීම අසාර්ථකයි');
    }
  } catch (err) {
    showLoginError('සම්බන්ධතා දෝෂයකි. නැවත උත්සාහ කරන්න.');
  }
}

function showLoginError(msg) {
  const errBox = document.getElementById('loginError');
  errBox.textContent = msg;
  errBox.classList.remove('hidden');
}

// Render dynamic state on judge phone
function renderJudgeView() {
  if (!state || !currentJudge) return;

  const comp = state.activeCompetition;
  const num = state.activeItemNumber;
  const isFlags = comp === 'flags';

  // Badges & Labels
  const compLabel = isFlags ? 'කොඩි තේරීමේ තරඟය' : 'ලාංඡන තේරීමේ තරඟය';
  document.getElementById('compNameBadge').textContent = isFlags ? 'කොඩි තරඟය' : 'ලාංඡන තරඟය';
  document.getElementById('activeCompLabel').textContent = compLabel;

  const numText = `අංක ${num < 10 ? '0' + num : num}`;
  document.getElementById('activeItemNumberDisplay').textContent = numText;

  // Check if judge already scored this active item
  const compScores = (state.scores && state.scores[comp]) || {};
  const itemScores = compScores[num.toString()] || {};
  const existingScore = itemScores[currentJudge.id];

  const cardOpen = document.getElementById('votingOpenCard');
  const cardDone = document.getElementById('scoreDoneCard');
  const cardClosed = document.getElementById('votingClosedCard');

  cardOpen.classList.add('hidden');
  cardDone.classList.add('hidden');
  cardClosed.classList.add('hidden');

  if (existingScore && typeof existingScore.score === 'number') {
    // 1. Judge has already scored this item
    document.getElementById('doneItemTitle').textContent = `${numText} සඳහා ලකුණු සටහන් විය!`;
    document.getElementById('submittedScoreValue').textContent = existingScore.score;
    cardDone.classList.remove('hidden');
  } else if (state.votingOpen) {
    // 2. Voting is currently open and judge hasn't scored yet
    cardOpen.classList.remove('hidden');
  } else {
    // 3. Voting is closed / waiting for admin
    cardClosed.classList.remove('hidden');
  }
}

// 1-Click Score Submission
async function submitScore(val) {
  if (!currentJudge || !currentPin) return;

  // Haptic vibration feedback on mobile
  if (window.navigator && window.navigator.vibrate) {
    window.navigator.vibrate(40);
  }

  try {
    const res = await fetch('/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        judgeId: currentJudge.id,
        pin: currentPin,
        score: val
      })
    });
    const data = await res.json();

    if (data.success) {
      // Update local state copy
      const comp = state.activeCompetition;
      const num = state.activeItemNumber.toString();
      if (!state.scores[comp]) state.scores[comp] = {};
      if (!state.scores[comp][num]) state.scores[comp][num] = {};
      state.scores[comp][num][currentJudge.id] = data.submission;

      renderJudgeView();
    } else {
      alert(data.message || 'ලකුණු සටහන් කිරීම අසාර්ථකයි');
    }
  } catch (err) {
    alert('සම්බන්ධතා දෝෂයකි');
  }
}

// Socket Listeners
function setupSocketListeners() {
  // Live round or voting status change by Admin
  socket.on('round-changed', (data) => {
    if (!state) return;
    state.activeCompetition = data.activeCompetition;
    state.activeItemNumber = data.activeItemNumber;
    state.votingOpen = data.votingOpen;
    renderJudgeView();
  });

  // Score updated
  socket.on('score-updated', (data) => {
    if (!state) return;
    if (!state.scores[data.competition]) state.scores[data.competition] = {};
    if (!state.scores[data.competition][data.itemNumber.toString()]) state.scores[data.competition][data.itemNumber.toString()] = {};
    state.scores[data.competition][data.itemNumber.toString()][data.judgeId] = data.submission;

    if (currentJudge && data.judgeId === currentJudge.id) {
      renderJudgeView();
    }
  });

  socket.on('scores-reset', () => loadState());
}
