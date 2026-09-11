// Admin Dashboard Client
const socket = io();
let state = null;

document.addEventListener('DOMContentLoaded', async () => {
  await loadState();
  setupSocketListeners();
});

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

  // 1. Update Competition Tabs & Title
  const isFlags = state.activeCompetition === 'flags';
  const tabFlags = document.getElementById('tabFlags');
  const tabEmblems = document.getElementById('tabEmblems');
  const tableTitle = document.getElementById('tableTitle');

  if (isFlags) {
    tabFlags.className = 'px-3 py-1.5 rounded-lg text-xs font-bold transition-all bg-amber-500 text-white shadow';
    tabEmblems.className = 'px-3 py-1.5 rounded-lg text-xs font-bold transition-all text-slate-400 hover:text-white';
    tableTitle.textContent = 'කොඩි තරඟයේ සවිස්තරාත්මක ප්‍රතිඵල (Flags Full Leaderboard)';
  } else {
    tabEmblems.className = 'px-3 py-1.5 rounded-lg text-xs font-bold transition-all bg-amber-500 text-white shadow';
    tabFlags.className = 'px-3 py-1.5 rounded-lg text-xs font-bold transition-all text-slate-400 hover:text-white';
    tableTitle.textContent = 'ලාංඡන තරඟයේ සවිස්තරාත්මක ප්‍රතිඵල (Emblems Full Leaderboard)';
  }

  // Update CSV export link
  document.getElementById('btnExportCsv').href = `/api/export/csv?competitionId=${state.activeCompetition}`;

  // 2. Lock & Broadcast buttons
  const lockIcon = document.getElementById('lockIcon');
  const lockText = document.getElementById('lockText');
  const btnLock = document.getElementById('btnToggleLock');
  if (state.votingLocked) {
    lockIcon.className = 'fa-solid fa-lock text-red-400';
    lockText.textContent = 'ලකුණු දීම අත්හිටුවා ඇත (Locked)';
    btnLock.className = 'px-3.5 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 border transition-all bg-red-500/15 text-red-400 border-red-500/30 hover:bg-red-500/25';
  } else {
    lockIcon.className = 'fa-solid fa-lock-open text-emerald-400';
    lockText.textContent = 'ලකුණු දීම සක්‍රියයි (Open)';
    btnLock.className = 'px-3.5 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 border transition-all bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25';
  }

  const broadcastText = document.getElementById('broadcastText');
  const btnBroadcast = document.getElementById('btnToggleBroadcast');
  if (state.broadcastActiveItem) {
    broadcastText.textContent = 'Auto Sync: On';
    btnBroadcast.className = 'px-3.5 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 border transition-all bg-blue-500 text-white border-blue-400 shadow-md shadow-blue-500/20';
  } else {
    broadcastText.textContent = 'Auto Sync: Off';
    btnBroadcast.className = 'px-3.5 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 border transition-all bg-slate-800 text-slate-400 border-slate-700';
  }

  // 3. Render Active Item Selector & Preview
  const comp = state.competitions[state.activeCompetition];
  const select = document.getElementById('activeItemSelect');
  select.innerHTML = '';

  if (comp && comp.items.length > 0) {
    comp.items.forEach(item => {
      const opt = document.createElement('option');
      opt.value = item.id;
      opt.textContent = `${item.title} (${item.description || ''})`;
      if (item.id === state.activeItemId) opt.selected = true;
      select.appendChild(opt);
    });

    const activeItem = comp.items.find(i => i.id === state.activeItemId) || comp.items[0];
    document.getElementById('adminItemTitle').textContent = activeItem.title;
    document.getElementById('adminItemDesc').textContent = activeItem.description || '';
    document.getElementById('adminItemPreview').src = activeItem.imageUrl || '';
  } else {
    document.getElementById('adminItemTitle').textContent = 'නිර්මාණ නැත (No Items)';
    document.getElementById('adminItemDesc').textContent = '';
    document.getElementById('adminItemPreview').src = '';
  }

  // 4. Render 20 Judges Matrix
  renderJudgesMatrix();

  // 5. Render Full Leaderboard Table
  renderLeaderboardTable();
}

// Render the 20 Judges Matrix for the Active Item
function renderJudgesMatrix() {
  const container = document.getElementById('judgesMatrix');
  container.innerHTML = '';

  const compScores = (state.scores && state.scores[state.activeCompetition]) || {};
  const activeScores = compScores[state.activeItemId] || {};
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
        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-sm shadow-emerald-500/10' 
        : 'bg-slate-800/60 border-slate-700/60 text-slate-400'
    }`;

    card.innerHTML = `
      <div class="text-[10px] font-bold uppercase tracking-wider text-slate-400">J${j.id < 10 ? '0' + j.id : j.id}</div>
      <div class="my-1">
        ${isSubmitted 
          ? `<span class="text-lg font-black text-emerald-400">${entry.score}</span><span class="text-[10px] text-slate-400">/10</span>` 
          : `<span class="text-xs text-slate-500 font-semibold italic">Pending</span>`
        }
      </div>
      <div class="text-[9px] truncate max-w-full">
        ${isSubmitted ? '<i class="fa-solid fa-circle-check text-emerald-400"></i> Done' : '<span class="w-1.5 h-1.5 rounded-full inline-block bg-slate-600"></span> Waiting'}
      </div>
    `;

    container.appendChild(card);
  });

  // Update stats summary
  document.getElementById('submissionRatio').textContent = `${submittedCount} / ${judges.length}`;
  document.getElementById('statActiveTotal').textContent = totalScore;
  const avg = submittedCount > 0 ? (totalScore / submittedCount).toFixed(2) : '0.00';
  document.getElementById('statActiveAvg').textContent = avg;

  if (scoresList.length > 0) {
    const min = Math.min(...scoresList);
    const max = Math.max(...scoresList);
    document.getElementById('statActiveRange').textContent = `${min} / ${max}`;
  } else {
    document.getElementById('statActiveRange').textContent = `- / -`;
  }
}

// Render Leaderboard & Scores Table with columns for Judge 1 through 20
function renderLeaderboardTable() {
  const table = document.getElementById('resultsTable');
  const thead = table.querySelector('thead tr');
  const tbody = document.getElementById('resultsTableBody');

  const comp = state.competitions[state.activeCompetition];
  const judges = state.judges || [];
  const compScores = (state.scores && state.scores[state.activeCompetition]) || {};

  // Build headers dynamically: Rank, Design, J01...J20, Total, Avg, Action
  let headerHtml = `
    <th class="p-3 w-12 text-center">Rank</th>
    <th class="p-3 w-40">Design</th>
  `;
  judges.forEach(j => {
    headerHtml += `<th class="p-2 text-center text-[10px] font-bold text-slate-400 whitespace-nowrap">J${j.id < 10 ? '0' + j.id : j.id}</th>`;
  });
  headerHtml += `
    <th class="p-3 w-20 text-center text-amber-400 font-bold">Total</th>
    <th class="p-3 w-20 text-center text-emerald-400 font-bold">Average</th>
    <th class="p-3 w-16 text-center text-slate-400">Action</th>
  `;
  thead.innerHTML = headerHtml;

  // Build Rows
  tbody.innerHTML = '';
  if (!comp || comp.items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${judges.length + 5}" class="p-6 text-center text-slate-500 italic">නිර්මාණ ඇතුළත් කර නැත (No items available)</td></tr>`;
    return;
  }

  // Calculate scores and ranks
  const computedItems = comp.items.map(item => {
    const itemScores = compScores[item.id] || {};
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

    return {
      item,
      scoresPerJudge,
      total,
      average,
      count
    };
  });

  // Sort by average descending, then total descending
  computedItems.sort((a, b) => b.average - a.average || b.total - a.total);

  computedItems.forEach((row, index) => {
    const tr = document.createElement('tr');
    tr.className = `hover:bg-slate-800/40 transition-colors ${row.item.id === state.activeItemId ? 'bg-amber-500/10' : ''}`;

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

    tr.innerHTML = `
      <td class="p-3 text-center">${rankBadge}</td>
      <td class="p-3 font-semibold text-white flex items-center space-x-2.5">
        <img src="${row.item.imageUrl || ''}" class="w-10 h-7 object-cover rounded-lg bg-slate-800 flex-shrink-0 border border-slate-700">
        <div class="truncate">
          <div class="text-xs font-bold leading-tight">${row.item.title}</div>
          <div class="text-[10px] text-slate-400 truncate">${row.item.description || ''}</div>
        </div>
      </td>
      ${judgeCells}
      <td class="p-3 text-center font-black text-sm text-amber-400">${row.total}</td>
      <td class="p-3 text-center font-black text-sm text-emerald-400">${row.average.toFixed(2)}</td>
      <td class="p-3 text-center">
        <button onclick="deleteItem('${row.item.id}')" class="text-slate-500 hover:text-red-400 p-1 transition-colors" title="Delete Design">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

// Switch Competition
async function switchCompetition(competitionId) {
  try {
    const res = await fetch('/api/admin/set-competition', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ competitionId })
    });
    const data = await res.json();
    if (data.success) {
      state.activeCompetition = data.activeCompetition;
      state.activeItemId = data.activeItemId;
      renderAdminUI();
    }
  } catch (err) {
    alert('තරඟය මාරු කිරීමේ දෝෂයකි');
  }
}

// Change Active Item
async function changeActiveItem(itemId) {
  try {
    const res = await fetch('/api/admin/set-active-item', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId })
    });
    const data = await res.json();
    if (data.success) {
      state.activeItemId = itemId;
      renderAdminUI();
    }
  } catch (err) {
    alert('අයිතමය මාරු කිරීමේ දෝෂයකි');
  }
}

// Navigate Prev/Next Item
function navigateItem(delta) {
  const comp = state.competitions[state.activeCompetition];
  if (!comp || comp.items.length === 0) return;
  const currIdx = comp.items.findIndex(i => i.id === state.activeItemId);
  const nextIdx = currIdx + delta;
  if (nextIdx >= 0 && nextIdx < comp.items.length) {
    changeActiveItem(comp.items[nextIdx].id);
  }
}

// Toggle Lock
async function toggleVotingLock() {
  try {
    const res = await fetch('/api/admin/toggle-lock', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      state.votingLocked = data.votingLocked;
      renderAdminUI();
    }
  } catch (err) {
    alert('දෝෂයකි');
  }
}

// Toggle Broadcast
async function toggleBroadcast() {
  try {
    const res = await fetch('/api/admin/toggle-broadcast', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      state.broadcastActiveItem = data.broadcastActiveItem;
      renderAdminUI();
    }
  } catch (err) {
    alert('දෝෂයකි');
  }
}

// Reset Scores with confirmation
async function confirmResetScores() {
  const compName = state.activeCompetition === 'flags' ? 'කොඩි (Flags)' : 'ලාංඡන (Emblems)';
  if (confirm(`ඔබට ${compName} තරඟයේ සියලු ලකුණු Reset කිරීමට අවශ්‍ය බව තහවුරු කරන්නද? (Are you sure?)`)) {
    try {
      const res = await fetch('/api/admin/reset-scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ competitionId: state.activeCompetition })
      });
      const data = await res.json();
      if (data.success) {
        state.scores[state.activeCompetition] = {};
        renderAdminUI();
      }
    } catch (err) {
      alert('Reset කිරීමේ දෝෂයකි');
    }
  }
}

// Delete item
async function deleteItem(itemId) {
  if (confirm('මෙම නිර්මාණය ඉවත් කිරීමට අවශ්‍ය බව තහවුරු කරන්නද?')) {
    try {
      const res = await fetch('/api/admin/delete-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ competitionId: state.activeCompetition, itemId })
      });
      const data = await res.json();
      if (data.success) {
        await loadState();
      }
    } catch (err) {
      alert('ඉවත් කිරීමේ දෝෂයකි');
    }
  }
}

// Modal handling
function openAddItemModal() {
  document.getElementById('addItemModal').classList.remove('hidden');
}

function closeAddItemModal() {
  document.getElementById('addItemModal').classList.add('hidden');
  document.getElementById('addItemForm').reset();
}

document.getElementById('addItemForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData();
  formData.append('competitionId', state.activeCompetition);
  formData.append('title', document.getElementById('newTitle').value);
  formData.append('description', document.getElementById('newDesc').value);
  formData.append('imageUrl', document.getElementById('newImageUrl').value);

  const fileInput = document.getElementById('newImageFile');
  if (fileInput.files.length > 0) {
    formData.append('image', fileInput.files[0]);
  }

  try {
    const res = await fetch('/api/admin/add-item', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (data.success) {
      closeAddItemModal();
      await loadState();
    } else {
      alert(data.message || 'නිර්මාණය එක් කිරීම අසාර්ථකයි');
    }
  } catch (err) {
    alert('දෝෂයකි');
  }
});

// Socket listeners
function setupSocketListeners() {
  socket.on('score-updated', (data) => {
    if (!state) return;
    if (!state.scores[data.competitionId]) state.scores[data.competitionId] = {};
    if (!state.scores[data.competitionId][data.itemId]) state.scores[data.competitionId][data.itemId] = {};
    state.scores[data.competitionId][data.itemId][data.judgeId] = data.submission;

    if (data.competitionId === state.activeCompetition) {
      renderJudgesMatrix();
      renderLeaderboardTable();
    }
  });

  socket.on('competition-changed', (data) => {
    state.activeCompetition = data.activeCompetition;
    state.activeItemId = data.activeItemId;
    renderAdminUI();
  });

  socket.on('active-item-changed', (data) => {
    state.activeItemId = data.itemId;
    renderAdminUI();
  });

  socket.on('voting-lock-changed', (data) => {
    state.votingLocked = data.votingLocked;
    renderAdminUI();
  });

  socket.on('broadcast-mode-changed', (data) => {
    state.broadcastActiveItem = data.broadcastActiveItem;
    renderAdminUI();
  });

  socket.on('item-added', () => loadState());
  socket.on('item-deleted', () => loadState());
  socket.on('scores-reset', () => loadState());
}
