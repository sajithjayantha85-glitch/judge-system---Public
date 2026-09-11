// Synchronized Admin Controller Client (100% English + Password Protection)
let socket = null;
try {
  if (typeof io !== 'undefined') {
    socket = io();
  }
} catch (e) {
  console.warn('Socket.io connection warning:', e);
}

let state = {
  activeCompetition: 'flags',
  activeItemNumber: 1,
  votingOpen: false,
  totalItems: { flags: 15, emblems: 15 },
  judges: [],
  scores: { flags: {}, emblems: {} }
};

document.addEventListener('DOMContentLoaded', async () => {
  checkAdminAuthStatus();
  setupLoginForm();
  setupSocketListeners();
});

// Admin Authentication Helpers
function getAdminPassword() {
  return sessionStorage.getItem('adminPassword') || '';
}

function checkAdminAuthStatus() {
  const savedPassword = getAdminPassword();
  const authScreen = document.getElementById('adminAuthScreen');

  if (savedPassword) {
    authScreen.classList.add('hidden');
    loadState();
  } else {
    authScreen.classList.remove('hidden');
  }
}

function setupLoginForm() {
  const form = document.getElementById('adminLoginForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pwd = document.getElementById('adminPasswordInput').value.trim();
    const errBox = document.getElementById('adminLoginError');

    if (!pwd) {
      errBox.textContent = 'Please enter the admin password';
      errBox.classList.remove('hidden');
      return;
    }

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pwd })
      });
      const data = await res.json();

      if (data.success) {
        sessionStorage.setItem('adminPassword', pwd);
        errBox.classList.add('hidden');
        document.getElementById('adminAuthScreen').classList.add('hidden');
        await loadState();
      } else {
        errBox.textContent = data.message || 'Invalid Admin Password';
        errBox.classList.remove('hidden');
      }
    } catch (err) {
      errBox.textContent = 'Connection error. Please try again.';
      errBox.classList.remove('hidden');
    }
  });
}

function adminLogout() {
  sessionStorage.removeItem('adminPassword');
  document.getElementById('adminPasswordInput').value = '';
  document.getElementById('adminAuthScreen').classList.remove('hidden');
}

// Load State from Backend
async function loadState() {
  try {
    const res = await fetch('/api/state');
    state = await res.json();
    renderAdminUI();
  } catch (err) {
    console.error('Failed to load state:', err);
  }
}

function renderAdminUI() {
  if (!state) return;

  const comp = state.activeCompetition;
  const isFlags = comp === 'flags';
  const num = state.activeItemNumber;
  const totalCount = (state.totalItems && state.totalItems[comp]) || 15;
  const formattedNum = num < 10 ? '0' + num : num;

  // 1. Header Tabs & Badges (2 Distinct Colors: Amber Gold for Flags, Cyan Blue for Emblems)
  const tabFlags = document.getElementById('tabFlags');
  const tabEmblems = document.getElementById('tabEmblems');
  const activeCompHeader = document.getElementById('activeCompHeader');
  const tableTitle = document.getElementById('tableTitle');
  const activeBoxFrame = document.getElementById('activeBoxFrame');
  const activeNumberSubtext = document.getElementById('activeNumberSubtext');

  if (isFlags) {
    tabFlags.className = 'px-3.5 py-1.5 rounded-lg text-xs font-black transition-all bg-amber-500 text-slate-950 shadow';
    tabEmblems.className = 'px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all text-slate-400 hover:text-white';
    activeCompHeader.className = 'text-xs font-black uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30 px-3 py-1 rounded-lg';
    activeCompHeader.innerHTML = '<i class="fa-solid fa-flag mr-1"></i> Flag Competition';
    tableTitle.textContent = 'Flag Competition Leaderboard & Results';
    if (activeBoxFrame) activeBoxFrame.className = 'bg-slate-950 border-2 border-amber-500/40 rounded-2xl p-6 text-center my-3 transition-colors';
    if (activeNumberSubtext) {
      activeNumberSubtext.className = 'text-xs text-amber-400 font-bold block mt-1';
      activeNumberSubtext.textContent = `Flag Design #${formattedNum}`;
    }
  } else {
    tabEmblems.className = 'px-3.5 py-1.5 rounded-lg text-xs font-black transition-all bg-cyan-500 text-slate-950 shadow';
    tabFlags.className = 'px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all text-slate-400 hover:text-white';
    activeCompHeader.className = 'text-xs font-black uppercase tracking-wider bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 px-3 py-1 rounded-lg';
    activeCompHeader.innerHTML = '<i class="fa-solid fa-shield-halved mr-1"></i> Emblem Competition';
    tableTitle.textContent = 'Emblem Competition Leaderboard & Results';
    if (activeBoxFrame) activeBoxFrame.className = 'bg-slate-950 border-2 border-cyan-500/40 rounded-2xl p-6 text-center my-3 transition-colors';
    if (activeNumberSubtext) {
      activeNumberSubtext.className = 'text-xs text-cyan-400 font-bold block mt-1';
      activeNumberSubtext.textContent = `Emblem Design #${formattedNum}`;
    }
  }

  // Update CSV export link
  document.getElementById('btnExportCsv').href = `/api/export/csv?competition=${comp}`;

  // 2. Active Number Visual & Total Items Input
  document.getElementById('activeNumberText').textContent = formattedNum;
  document.getElementById('matrixHeader').textContent = `Live Submissions for Design #${formattedNum}`;
  document.getElementById('inputTotalItems').value = totalCount;

  // 3. Number Pills (1 to totalCount)
  const pillsContainer = document.getElementById('numberPills');
  pillsContainer.innerHTML = '';
  const compScores = (state.scores && state.scores[comp]) || {};

  for (let i = 1; i <= totalCount; i++) {
    const isCurrent = i === num;
    const hasScores = compScores[i.toString()] && Object.keys(compScores[i.toString()]).length > 0;
    const btn = document.createElement('button');
    const activeColorClass = isFlags ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30' : 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30';
    btn.className = `flex-shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center space-x-1 ${
      isCurrent 
        ? activeColorClass 
        : hasScores
          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
          : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-white'
    }`;
    btn.innerHTML = `<span>#${i < 10 ? '0' + i : i}</span> ${hasScores ? '<i class="fa-solid fa-check text-[10px]"></i>' : ''}`;
    btn.onclick = () => setNumber(i);
    pillsContainer.appendChild(btn);
  }

  // 4. Big Voting Toggle Button
  const btnVoting = document.getElementById('btnToggleVoting');
  const btnIcon = document.getElementById('btnVotingIcon');
  const btnText = document.getElementById('btnVotingText');

  if (state.votingOpen) {
    btnVoting.className = 'w-full py-4 rounded-2xl font-black text-base transition-all shadow-xl flex items-center justify-center space-x-2.5 bg-red-500 hover:bg-red-600 text-white active:scale-[0.98] animate-pulse';
    btnIcon.className = 'fa-solid fa-stop text-lg';
    btnText.textContent = `Close Voting for Design #${formattedNum}`;
  } else {
    btnVoting.className = 'w-full py-4 rounded-2xl font-black text-base transition-all shadow-xl flex items-center justify-center space-x-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 active:scale-[0.98]';
    btnIcon.className = 'fa-solid fa-play text-lg';
    btnText.textContent = `Open Voting for Design #${formattedNum}`;
  }

  // 5. Render 20 Judges Grid
  renderJudgesGrid();

  // 6. Render Results Table
  renderResultsTable();
}

// 20 Judges Grid for Active Number
function renderJudgesGrid() {
  const container = document.getElementById('judgesGrid');
  container.innerHTML = '';

  const comp = state.activeCompetition;
  const num = state.activeItemNumber.toString();
  const compScores = (state.scores && state.scores[comp]) || {};
  const activeScores = compScores[num] || {};
  const judges = state.judges || [];

  let submittedCount = 0;
  let totalScore = 0;
  let scoresList = [];

  judges.forEach(j => {
    const entry = activeScores[j.id];
    const isSubmitted = entry && typeof entry.score === 'number';

    if (isSubmitted) {
      submittedCount++;
      totalScore += entry.score;
      scoresList.push(entry.score);
    }

    const card = document.createElement('div');
    card.className = `p-2.5 rounded-2xl border text-center transition-all flex flex-col justify-between items-center ${
      isSubmitted 
        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-md shadow-emerald-500/15 scale-105' 
        : 'bg-slate-800/60 border-slate-700/60 text-slate-400'
    }`;

    card.innerHTML = `
      <div class="text-[10px] font-bold uppercase tracking-wider text-slate-400">J${j.id < 10 ? '0' + j.id : j.id}</div>
      <div class="my-1">
        ${isSubmitted 
          ? `<span class="text-xl font-black text-emerald-400">${entry.score}</span><span class="text-[10px] text-slate-400">/10</span>` 
          : `<span class="text-xs text-slate-500 font-semibold italic">Waiting</span>`
        }
      </div>
      <div class="text-[9px]">
        ${isSubmitted ? '<i class="fa-solid fa-circle-check text-emerald-400"></i> Done' : '<span class="w-1.5 h-1.5 rounded-full inline-block bg-slate-600 animate-ping"></span>'}
      </div>
    `;

    container.appendChild(card);
  });

  // Stats
  document.getElementById('matrixRatio').textContent = `${submittedCount} / ${judges.length}`;
  document.getElementById('statTotal').textContent = totalScore;
  const avg = submittedCount > 0 ? (totalScore / submittedCount).toFixed(2) : '0.00';
  document.getElementById('statAvg').textContent = avg;

  if (scoresList.length > 0) {
    document.getElementById('statMinMax').textContent = `${Math.min(...scoresList)} / ${Math.max(...scoresList)}`;
  } else {
    document.getElementById('statMinMax').textContent = `- / -`;
  }
}

// Render Results Table
function renderResultsTable() {
  const thead = document.getElementById('resultsTable').querySelector('thead tr');
  const tbody = document.getElementById('resultsTableBody');

  const comp = state.activeCompetition;
  const isFlags = comp === 'flags';
  const judges = state.judges || [];
  const compScores = (state.scores && state.scores[comp]) || {};
  const totalCount = (state.totalItems && state.totalItems[comp]) || 15;

  // Build header dynamically
  let headerHtml = `
    <th class="p-3 w-14 text-center">Rank</th>
    <th class="p-3 w-36">Design</th>
  `;
  judges.forEach(j => {
    headerHtml += `<th class="p-2 text-center text-[10px] font-bold text-slate-400 whitespace-nowrap">J${j.id < 10 ? '0' + j.id : j.id}</th>`;
  });
  headerHtml += `
    <th class="p-3 w-20 text-center text-amber-400 font-bold">Total</th>
    <th class="p-3 w-24 text-center text-emerald-400 font-bold">Average</th>
  `;
  thead.innerHTML = headerHtml;

  // Calculate scores for all items 1 to totalCount
  const computedList = [];
  for (let num = 1; num <= totalCount; num++) {
    const itemScores = compScores[num.toString()] || {};
    let total = 0;
    let count = 0;
    const scoresPerJudge = judges.map(j => {
      const entry = itemScores[j.id];
      if (entry && typeof entry.score === 'number') {
        total += entry.score;
        count++;
        return entry.score;
      }
      return null;
    });

    const average = count > 0 ? parseFloat((total / count).toFixed(2)) : 0.00;

    computedList.push({
      number: num,
      scoresPerJudge,
      total,
      average,
      count
    });
  }

  // Sort by average descending, then total descending
  computedList.sort((a, b) => b.average - a.average || b.total - a.total);

  tbody.innerHTML = '';
  computedList.forEach((row, index) => {
    const tr = document.createElement('tr');
    tr.className = `hover:bg-slate-800/40 transition-colors ${row.number === state.activeItemNumber ? 'bg-amber-500/10 font-semibold' : ''}`;

    let rankBadge = `<span class="font-bold text-slate-400">#${index + 1}</span>`;
    if (index === 0 && row.count > 0) rankBadge = `<span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500 text-slate-950 font-black text-xs shadow-md shadow-amber-500/30">1</span>`;
    if (index === 1 && row.count > 0) rankBadge = `<span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-300 text-slate-950 font-black text-xs">2</span>`;
    if (index === 2 && row.count > 0) rankBadge = `<span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-700 text-white font-black text-xs">3</span>`;

    let judgeCells = '';
    row.scoresPerJudge.forEach(s => {
      if (s !== null) {
        judgeCells += `<td class="p-2 text-center font-bold text-emerald-400">${s}</td>`;
      } else {
        judgeCells += `<td class="p-2 text-center text-slate-600 font-mono">-</td>`;
      }
    });

    const label = `${isFlags ? 'Flag' : 'Emblem'} #${row.number < 10 ? '0' + row.number : row.number}`;
    const badgeColor = isFlags ? 'text-amber-400 border-amber-500/30' : 'text-cyan-400 border-cyan-500/30';

    tr.innerHTML = `
      <td class="p-3 text-center">${rankBadge}</td>
      <td class="p-3 font-bold text-white flex items-center space-x-2">
        <span class="px-2 py-0.5 rounded bg-slate-800 border ${badgeColor} text-xs font-bold">${label}</span>
      </td>
      ${judgeCells}
      <td class="p-3 text-center font-black text-sm text-amber-400">${row.total}</td>
      <td class="p-3 text-center font-black text-sm text-emerald-400">${row.average.toFixed(2)}</td>
    `;

    tbody.appendChild(tr);
  });
}

// Controller Actions (Protected with Admin Password)
async function setCompetition(competition) {
  try {
    const res = await fetch('/api/admin/set-round', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-password': getAdminPassword()
      },
      body: JSON.stringify({ competition, itemNumber: 1, votingOpen: false })
    });
    const data = await res.json();
    if (data.success) {
      state.activeCompetition = data.activeCompetition;
      state.activeItemNumber = data.activeItemNumber;
      state.votingOpen = data.votingOpen;
      renderAdminUI();
    } else {
      alert(data.message || 'Action unauthorized');
    }
  } catch (err) {
    alert('Connection error. Please try again.');
  }
}

async function setNumber(itemNumber) {
  try {
    const res = await fetch('/api/admin/set-round', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-password': getAdminPassword()
      },
      body: JSON.stringify({ itemNumber, votingOpen: false })
    });
    const data = await res.json();
    if (data.success) {
      state.activeItemNumber = data.activeItemNumber;
      state.votingOpen = data.votingOpen;
      renderAdminUI();
    } else {
      alert(data.message || 'Action unauthorized');
    }
  } catch (err) {
    alert('Connection error. Please try again.');
  }
}

function navigateNumber(delta) {
  const comp = state.activeCompetition;
  const totalCount = (state.totalItems && state.totalItems[comp]) || 15;
  const nextNum = state.activeItemNumber + delta;
  if (nextNum >= 1 && nextNum <= totalCount) {
    setNumber(nextNum);
  }
}

async function toggleVoting() {
  const newStatus = !state.votingOpen;
  try {
    const res = await fetch('/api/admin/set-round', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-password': getAdminPassword()
      },
      body: JSON.stringify({ votingOpen: newStatus })
    });
    const data = await res.json();
    if (data.success) {
      state.votingOpen = data.votingOpen;
      renderAdminUI();
    } else {
      alert(data.message || 'Action unauthorized');
    }
  } catch (err) {
    alert('Connection error. Please try again.');
  }
}

async function updateTotalItems(count) {
  try {
    const res = await fetch('/api/admin/set-total-items', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-password': getAdminPassword()
      },
      body: JSON.stringify({ competition: state.activeCompetition, count })
    });
    const data = await res.json();
    if (data.success) {
      state.totalItems = data.totalItems;
      renderAdminUI();
    } else {
      alert(data.message || 'Action unauthorized');
    }
  } catch (err) {
    alert('Connection error. Please try again.');
  }
}

async function confirmResetScores() {
  const compName = state.activeCompetition === 'flags' ? 'Flag Competition' : 'Emblem Competition';
  if (confirm(`Are you sure you want to reset all scores for ${compName}? This cannot be undone.`)) {
    try {
      const res = await fetch('/api/admin/reset-scores', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': getAdminPassword()
        },
        body: JSON.stringify({ competition: state.activeCompetition })
      });
      const data = await res.json();
      if (data.success) {
        state.scores[state.activeCompetition] = {};
        renderAdminUI();
      } else {
        alert(data.message || 'Action unauthorized');
      }
    } catch (err) {
      alert('Connection error. Please try again.');
    }
  }
}

// Socket Listeners
function setupSocketListeners() {
  if (!socket) return;

  socket.on('round-changed', (data) => {
    if (!state) return;
    state.activeCompetition = data.activeCompetition;
    state.activeItemNumber = data.activeItemNumber;
    state.votingOpen = data.votingOpen;
    renderAdminUI();
  });

  socket.on('score-updated', (data) => {
    if (!state) return;
    if (!state.scores[data.competition]) state.scores[data.competition] = {};
    if (!state.scores[data.competition][data.itemNumber.toString()]) state.scores[data.competition][data.itemNumber.toString()] = {};
    state.scores[data.competition][data.itemNumber.toString()][data.judgeId] = data.submission;

    if (data.competition === state.activeCompetition) {
      renderJudgesGrid();
      renderResultsTable();
    }
  });

  socket.on('total-items-changed', (data) => {
    state.totalItems = data.totalItems;
    renderAdminUI();
  });

  socket.on('scores-reset', () => loadState());
}

// Explicitly bind all actions to window
window.setCompetition = setCompetition;
window.setNumber = setNumber;
window.navigateNumber = navigateNumber;
window.toggleVoting = toggleVoting;
window.updateTotalItems = updateTotalItems;
window.confirmResetScores = confirmResetScores;
window.adminLogout = adminLogout;
