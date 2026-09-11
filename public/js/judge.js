// Ultra-Simplified Synchronized Judge Client (100% English)
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
  select.innerHTML = '<option value="">-- Select Judge --</option>';
  if (!state || !state.judges) return;

  state.judges.forEach(j => {
    const opt = document.createElement('option');
    opt.value = j.id;
    opt.textContent = `${j.name} (Judge ID: ${j.id})`;
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
    showLoginError('Please select your Judge ID and enter your PIN');
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
      showLoginError(data.message || 'Authentication failed. Please check PIN.');
    }
  } catch (err) {
    showLoginError('Connection error. Please try again.');
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
  const formattedNum = num < 10 ? '0' + num : num;

  // Badges & Labels with Distinct Colors
  const compNameBadge = document.getElementById('compNameBadge');
  const votingOpenCard = document.getElementById('votingOpenCard');
  const activeBoxJudge = document.getElementById('activeBoxJudge');
  const compLabel = isFlags ? 'Flag Competition (15 Flags)' : 'Emblem Competition (15 Emblems)';
  
  if (isFlags) {
    compNameBadge.className = 'text-xs font-black px-3 py-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30';
    compNameBadge.innerHTML = '<i class="fa-solid fa-flag mr-1"></i> Flag Competition';
    votingOpenCard.className = 'hidden bg-slate-900 border-2 border-amber-500/50 rounded-3xl p-6 shadow-2xl text-center flex flex-col items-center';
    if (activeBoxJudge) activeBoxJudge.className = 'my-4 w-full bg-slate-950 border-2 border-amber-500/50 rounded-2xl py-5 px-6 flex flex-col items-center justify-center shadow-inner';
  } else {
    compNameBadge.className = 'text-xs font-black px-3 py-1 rounded-full bg-cyan-500/15 text-cyan-400 border border-cyan-500/30';
    compNameBadge.innerHTML = '<i class="fa-solid fa-shield-halved mr-1"></i> Emblem Competition';
    votingOpenCard.className = 'hidden bg-slate-900 border-2 border-cyan-500/50 rounded-3xl p-6 shadow-2xl text-center flex flex-col items-center';
    if (activeBoxJudge) activeBoxJudge.className = 'my-4 w-full bg-slate-950 border-2 border-cyan-500/50 rounded-2xl py-5 px-6 flex flex-col items-center justify-center shadow-inner';
  }

  document.getElementById('activeCompLabel').textContent = compLabel;

  const numText = `Design #${formattedNum}`;
  document.getElementById('activeNumberDigits').textContent = formattedNum;
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
    document.getElementById('doneItemTitle').textContent = `Score Recorded for Design #${formattedNum}!`;
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
      alert(data.message || 'Score submission failed');
    }
  } catch (err) {
    alert('Connection error. Please try again.');
  }
}

// Socket Listeners
function setupSocketListeners() {
  socket.on('round-changed', (data) => {
    if (!state) return;
    state.activeCompetition = data.activeCompetition;
    state.activeItemNumber = data.activeItemNumber;
    state.votingOpen = data.votingOpen;
    renderJudgeView();
  });

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
