// Judge Mobile Client
const socket = io();

let currentJudge = null;
let currentPin = null;
let state = null;
let selectedScore = null;
let viewingItemId = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadState();
  populateJudgeDropdown();
  checkUrlParamsForAutoLogin();
  setupSocketListeners();
});

// Load state from backend
async function loadState() {
  try {
    const res = await fetch('/api/state');
    state = await res.json();
    renderUI();
  } catch (err) {
    console.error('Error fetching state:', err);
  }
}

// Populate 20 judges dropdown
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

// Check URL Params e.g. /judge.html?judge=1&pin=1001
function checkUrlParamsForAutoLogin() {
  const params = new URLSearchParams(window.location.search);
  const judgeId = params.get('judge') || params.get('id');
  const pin = params.get('pin');

  if (judgeId && pin) {
    performLogin(judgeId, pin);
  }
}

// Login Form Submit
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
      
      // Register with socket
      socket.emit('register', { role: 'judge', judgeId: currentJudge.id });
      renderUI();
    } else {
      showLoginError(data.message || 'පිවිසීම අසාර්ථකයි');
    }
  } catch (err) {
    showLoginError('සම්බන්ධතාව බිඳවැටුණි. නැවත උත්සාහ කරන්න.');
  }
}

function showLoginError(msg) {
  const errBox = document.getElementById('loginError');
  errBox.textContent = msg;
  errBox.classList.remove('hidden');
}

// Render Judge UI
function renderUI() {
  if (!state) return;

  // Active competition
  const activeComp = state.competitions[state.activeCompetition];
  if (activeComp) {
    document.getElementById('headerCompBadge').textContent = activeComp.name;
  }

  // Voting lock state
  const lockBanner = document.getElementById('lockBanner');
  const submitBtn = document.getElementById('submitBtn');
  if (state.votingLocked) {
    lockBanner.classList.remove('hidden');
    submitBtn.disabled = true;
    submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
  } else {
    lockBanner.classList.add('hidden');
    submitBtn.disabled = false;
    submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
  }

  // Active items
  const items = activeComp ? activeComp.items : [];
  if (!viewingItemId || !items.find(i => i.id === viewingItemId)) {
    viewingItemId = state.activeItemId || (items[0] ? items[0].id : null);
  }

  renderItemChips(items);
  renderActiveItem();
}

// Render horizontal item chips
function renderItemChips(items) {
  const container = document.getElementById('itemNavList');
  container.innerHTML = '';

  let scoredCount = 0;
  const compScores = (state.scores && state.scores[state.activeCompetition]) || {};

  items.forEach(item => {
    const itemScores = compScores[item.id] || {};
    const isScored = currentJudge && itemScores[currentJudge.id] !== undefined;
    if (isScored) scoredCount++;

    const isCurrent = item.id === viewingItemId;

    const btn = document.createElement('button');
    btn.className = `flex-shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
      isCurrent 
        ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30' 
        : isScored
          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
          : 'bg-slate-800 text-slate-400 border border-slate-700'
    }`;
    btn.innerHTML = `
      <span>${item.number < 10 ? '#0' + item.number : '#' + item.number}</span>
      ${isScored ? '<i class="fa-solid fa-check text-[10px]"></i>' : ''}
    `;
    btn.onclick = () => {
      viewingItemId = item.id;
      renderActiveItem();
      renderItemChips(items);
    };
    container.appendChild(btn);
  });

  document.getElementById('scoringProgress').textContent = `${scoredCount} / ${items.length} Scored`;
}

// Render active item details & scoring buttons
function renderActiveItem() {
  const activeComp = state.competitions[state.activeCompetition];
  if (!activeComp) return;

  const item = activeComp.items.find(i => i.id === viewingItemId);
  if (!item) return;

  document.getElementById('activeItemBadge').textContent = `No. ${item.number < 10 ? '0' + item.number : item.number}`;
  document.getElementById('activeItemTitle').textContent = item.title;
  document.getElementById('activeItemDesc').textContent = item.description || '';
  document.getElementById('activeItemImage').src = item.imageUrl || '';

  // Check if current judge scored this item already
  const compScores = (state.scores && state.scores[state.activeCompetition]) || {};
  const itemScores = compScores[item.id] || {};
  const existingScore = currentJudge && itemScores[currentJudge.id];

  const tag = document.getElementById('alreadyScoredTag');
  const scoreVal = document.getElementById('currentScoreValue');
  const commentInput = document.getElementById('scoreComment');

  if (existingScore) {
    tag.classList.remove('hidden');
    scoreVal.textContent = existingScore.score;
    commentInput.value = existingScore.comment || '';
    selectScore(existingScore.score, false);
  } else {
    tag.classList.add('hidden');
    commentInput.value = '';
    clearSelectedScore();
  }
}

// Score selection (1 - 10)
function selectScore(val, triggerVibration = true) {
  selectedScore = val;

  // Haptic feedback if supported on mobile
  if (triggerVibration && window.navigator && window.navigator.vibrate) {
    window.navigator.vibrate(20);
  }

  const buttons = document.querySelectorAll('.score-btn');
  buttons.forEach(btn => {
    const btnVal = parseInt(btn.getAttribute('data-val'), 10);
    btn.classList.remove('selected', 'bg-amber-500', 'bg-emerald-500', 'bg-red-500', 'text-white', 'ring-2', 'ring-white');
    btn.classList.add('bg-slate-800', 'text-slate-200');

    if (btnVal === val) {
      btn.classList.remove('bg-slate-800', 'text-slate-200');
      btn.classList.add('selected', 'text-white', 'ring-2', 'ring-white');

      // Color coding: 1-4 coral/red, 5-7 amber/gold, 8-10 emerald green
      if (val <= 4) {
        btn.classList.add('bg-red-500');
      } else if (val <= 7) {
        btn.classList.add('bg-amber-500');
      } else {
        btn.classList.add('bg-emerald-500');
      }
    }
  });
}

function clearSelectedScore() {
  selectedScore = null;
  const buttons = document.querySelectorAll('.score-btn');
  buttons.forEach(btn => {
    btn.classList.remove('selected', 'bg-amber-500', 'bg-emerald-500', 'bg-red-500', 'text-white', 'ring-2', 'ring-white');
    btn.classList.add('bg-slate-800', 'text-slate-200');
  });
}

// Submit current score
async function submitCurrentScore() {
  if (!currentJudge || !currentPin) {
    alert('කරුණාකර පළමුව පිවිසෙන්න');
    return;
  }
  if (!selectedScore) {
    alert('කරුණාකර 1 සිට 10 දක්වා ලකුණක් තෝරන්න (Please pick a score 1 to 10)');
    return;
  }
  if (state.votingLocked) {
    alert('ලකුණු ලබාදීම අත්හිටුවා ඇත (Voting is currently locked)');
    return;
  }

  const comment = document.getElementById('scoreComment').value;

  try {
    const res = await fetch('/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        judgeId: currentJudge.id,
        pin: currentPin,
        competitionId: state.activeCompetition,
        itemId: viewingItemId,
        score: selectedScore,
        comment
      })
    });
    const data = await res.json();

    if (data.success) {
      showToast(`ලකුණු ${selectedScore}/10 සාර්ථකව සටහන් විය!`);

      // Update local state copy
      if (!state.scores[state.activeCompetition]) {
        state.scores[state.activeCompetition] = {};
      }
      if (!state.scores[state.activeCompetition][viewingItemId]) {
        state.scores[state.activeCompetition][viewingItemId] = {};
      }
      state.scores[state.activeCompetition][viewingItemId][currentJudge.id] = data.submission;

      // Update chips & scored badge
      const activeComp = state.competitions[state.activeCompetition];
      if (activeComp) {
        renderItemChips(activeComp.items);
      }
      document.getElementById('alreadyScoredTag').classList.remove('hidden');
      document.getElementById('currentScoreValue').textContent = selectedScore;
    } else {
      alert(data.message || 'ලකුණු සටහන් කිරීම අසාර්ථකයි');
    }
  } catch (err) {
    alert('සම්බන්ධතා දෝෂයකි');
  }
}

// Image Modal
function openImageModal() {
  const src = document.getElementById('activeItemImage').src;
  if (!src) return;
  document.getElementById('modalImage').src = src;
  document.getElementById('imageModal').classList.remove('hidden');
}

function closeImageModal() {
  document.getElementById('imageModal').classList.add('hidden');
}

// Toast
function showToast(msg) {
  const toast = document.getElementById('toast');
  document.getElementById('toastMsg').textContent = msg;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 3000);
}

// Socket Listeners for Realtime Sync
function setupSocketListeners() {
  socket.on('score-updated', (data) => {
    if (!state) return;
    if (!state.scores[data.competitionId]) state.scores[data.competitionId] = {};
    if (!state.scores[data.competitionId][data.itemId]) state.scores[data.competitionId][data.itemId] = {};
    state.scores[data.competitionId][data.itemId][data.judgeId] = data.submission;

    if (data.competitionId === state.activeCompetition) {
      const activeComp = state.competitions[state.activeCompetition];
      if (activeComp) renderItemChips(activeComp.items);
    }
  });

  socket.on('competition-changed', (data) => {
    state.activeCompetition = data.activeCompetition;
    state.activeItemId = data.activeItemId;
    viewingItemId = data.activeItemId;
    renderUI();
  });

  socket.on('active-item-changed', (data) => {
    state.activeItemId = data.itemId;
    // If broadcast is enabled, automatically shift judge's view
    if (data.broadcast) {
      viewingItemId = data.itemId;
      renderUI();
    }
  });

  socket.on('voting-lock-changed', (data) => {
    state.votingLocked = data.votingLocked;
    renderUI();
  });

  socket.on('scores-reset', (data) => {
    if (data.competitionId === 'all') {
      state.scores = { flags: {}, emblems: {} };
    } else {
      state.scores[data.competitionId] = {};
    }
    renderUI();
  });
}
