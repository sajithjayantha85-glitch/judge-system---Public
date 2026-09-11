// Display / Projector Screen Client
const socket = io();
let state = null;
let currentView = 'live'; // 'live' or 'podium'

document.addEventListener('DOMContentLoaded', async () => {
  await loadState();
  setupSocketListeners();
});

async function loadState() {
  try {
    const res = await fetch('/api/state');
    state = await res.json();
    renderDisplay();
  } catch (err) {
    console.error('Failed to load state:', err);
  }
}

function switchView(view) {
  currentView = view;
  const liveBtn = document.getElementById('viewLiveBtn');
  const podiumBtn = document.getElementById('viewPodiumBtn');
  const liveView = document.getElementById('liveView');
  const podiumView = document.getElementById('podiumView');

  if (view === 'live') {
    liveBtn.className = 'px-4 py-2 rounded-lg text-xs font-bold transition-all bg-amber-500 text-white shadow-md';
    podiumBtn.className = 'px-4 py-2 rounded-lg text-xs font-bold transition-all text-slate-400 hover:text-white';
    liveView.classList.remove('hidden');
    podiumView.classList.add('hidden');
  } else {
    podiumBtn.className = 'px-4 py-2 rounded-lg text-xs font-bold transition-all bg-amber-500 text-white shadow-md';
    liveBtn.className = 'px-4 py-2 rounded-lg text-xs font-bold transition-all text-slate-400 hover:text-white';
    liveView.classList.add('hidden');
    podiumView.classList.remove('hidden');
    renderPodium();
  }
}

function renderDisplay() {
  if (!state) return;

  const comp = state.competitions[state.activeCompetition];
  if (comp) {
    document.getElementById('displayCompTitle').textContent = comp.name;
  }

  renderLiveItem();
  if (currentView === 'podium') {
    renderPodium();
  }
}

function renderLiveItem() {
  const comp = state.competitions[state.activeCompetition];
  if (!comp || comp.items.length === 0) return;

  const item = comp.items.find(i => i.id === state.activeItemId) || comp.items[0];
  if (!item) return;

  document.getElementById('liveItemTitle').textContent = item.title;
  document.getElementById('liveItemDesc').textContent = item.description || '';
  document.getElementById('liveItemNumberBadge').textContent = `${state.activeCompetition === 'flags' ? 'FLAG' : 'EMBLEM'} #${item.number < 10 ? '0' + item.number : item.number}`;
  document.getElementById('liveItemImage').src = item.imageUrl || '';

  // 20 Judges progress
  const compScores = (state.scores && state.scores[state.activeCompetition]) || {};
  const itemScores = compScores[item.id] || {};
  const judges = state.judges || [];

  let submittedCount = 0;
  const dotsContainer = document.getElementById('judgesDots');
  dotsContainer.innerHTML = '';

  judges.forEach(j => {
    const isSubmitted = itemScores[j.id] && typeof itemScores[j.id].score === 'number';
    if (isSubmitted) submittedCount++;

    const dot = document.createElement('div');
    dot.className = `h-7 rounded-lg text-[10px] font-bold flex items-center justify-center transition-all ${
      isSubmitted 
        ? 'bg-emerald-500 text-slate-950 font-black scale-105 shadow-sm shadow-emerald-500/30' 
        : 'bg-slate-800 text-slate-500'
    }`;
    dot.textContent = `J${j.id < 10 ? '0' + j.id : j.id}`;
    dotsContainer.appendChild(dot);
  });

  const ratio = (submittedCount / judges.length) * 100;
  document.getElementById('liveProgressCount').textContent = `${submittedCount} / ${judges.length}`;
  document.getElementById('liveProgressBar').style.width = `${ratio}%`;

  const alertBox = document.getElementById('allDoneAlert');
  if (submittedCount === judges.length && judges.length > 0) {
    alertBox.classList.remove('hidden');
  } else {
    alertBox.classList.add('hidden');
  }
}

// Render Winners Podium (1st, 2nd, 3rd)
function renderPodium() {
  const comp = state.competitions[state.activeCompetition];
  if (!comp) return;

  const compScores = (state.scores && state.scores[state.activeCompetition]) || {};
  const judges = state.judges || [];

  // Compute ranks
  const results = comp.items.map(item => {
    const itemScores = compScores[item.id] || {};
    let total = 0;
    let count = 0;
    judges.forEach(j => {
      if (itemScores[j.id] && typeof itemScores[j.id].score === 'number') {
        total += itemScores[j.id].score;
        count++;
      }
    });
    const avg = count > 0 ? parseFloat((total / count).toFixed(2)) : 0.00;
    return { item, total, avg, count };
  });

  results.sort((a, b) => b.avg - a.avg || b.total - a.total);

  const container = document.getElementById('podiumContainer');
  container.innerHTML = '';

  const first = results[0];
  const second = results[1];
  const third = results[2];

  // 2nd Place (Silver)
  if (second) {
    container.innerHTML += `
      <div class="order-2 md:order-1 bg-slate-900/90 border-2 border-slate-400 rounded-3xl p-5 text-center flex flex-col items-center silver-glow">
        <div class="w-12 h-12 rounded-full bg-slate-300 text-slate-950 font-black text-xl flex items-center justify-center -mt-9 shadow-lg">2</div>
        <img src="${second.item.imageUrl || ''}" class="w-full h-32 object-cover rounded-2xl my-3 border border-slate-700 bg-slate-950">
        <h3 class="font-extrabold text-lg text-white">${second.item.title}</h3>
        <p class="text-xs text-slate-400 mb-2">${second.item.description || ''}</p>
        <div class="text-2xl font-black text-slate-200">${second.avg.toFixed(2)} <span class="text-xs text-slate-400 font-normal">/ 10</span></div>
        <div class="text-[11px] text-slate-400 font-semibold mt-1">මුළු ලකුණු: ${second.total}</div>
      </div>
    `;
  }

  // 1st Place (Gold)
  if (first) {
    container.innerHTML += `
      <div class="order-1 md:order-2 bg-slate-900/90 border-2 border-amber-400 rounded-3xl p-6 text-center flex flex-col items-center gold-glow transform md:-translate-y-4">
        <div class="w-14 h-14 rounded-full bg-amber-400 text-slate-950 font-black text-2xl flex items-center justify-center -mt-11 shadow-xl">
          <i class="fa-solid fa-crown text-xl"></i>
        </div>
        <img src="${first.item.imageUrl || ''}" class="w-full h-40 object-cover rounded-2xl my-3 border-2 border-amber-400/50 bg-slate-950">
        <h3 class="font-extrabold text-xl text-white">${first.item.title}</h3>
        <p class="text-xs text-slate-400 mb-2">${first.item.description || ''}</p>
        <div class="text-3xl font-black text-amber-400">${first.avg.toFixed(2)} <span class="text-xs text-slate-400 font-normal">/ 10</span></div>
        <div class="text-xs text-slate-300 font-semibold mt-1">මුළු ලකුණු: ${first.total}</div>
      </div>
    `;
  }

  // 3rd Place (Bronze)
  if (third) {
    container.innerHTML += `
      <div class="order-3 md:order-3 bg-slate-900/90 border-2 border-amber-700 rounded-3xl p-5 text-center flex flex-col items-center bronze-glow">
        <div class="w-12 h-12 rounded-full bg-amber-700 text-white font-black text-xl flex items-center justify-center -mt-9 shadow-lg">3</div>
        <img src="${third.item.imageUrl || ''}" class="w-full h-28 object-cover rounded-2xl my-3 border border-slate-700 bg-slate-950">
        <h3 class="font-extrabold text-lg text-white">${third.item.title}</h3>
        <p class="text-xs text-slate-400 mb-2">${third.item.description || ''}</p>
        <div class="text-2xl font-black text-amber-500">${third.avg.toFixed(2)} <span class="text-xs text-slate-400 font-normal">/ 10</span></div>
        <div class="text-[11px] text-slate-400 font-semibold mt-1">මුළු ලකුණු: ${third.total}</div>
      </div>
    `;
  }

  // Other ranks
  const otherList = document.getElementById('otherRanksList');
  otherList.innerHTML = '';
  if (results.length > 3) {
    results.slice(3).forEach((r, idx) => {
      const row = document.createElement('div');
      row.className = 'bg-slate-900 border border-slate-800 rounded-2xl px-4 py-2.5 flex items-center justify-between text-xs';
      row.innerHTML = `
        <div class="flex items-center space-x-3">
          <span class="font-bold text-slate-400 w-6">#${idx + 4}</span>
          <img src="${r.item.imageUrl || ''}" class="w-8 h-6 object-cover rounded bg-slate-800">
          <span class="font-bold text-white">${r.item.title}</span>
        </div>
        <div class="font-black text-slate-200">${r.avg.toFixed(2)} <span class="text-[10px] text-slate-500">/ 10</span></div>
      `;
      otherList.appendChild(row);
    });
  }
}

// Fullscreen
function toggleFullScreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    if (document.exitFullscreen) document.exitFullscreen();
  }
}

// Socket listeners
function setupSocketListeners() {
  socket.on('score-updated', (data) => {
    if (!state) return;
    if (!state.scores[data.competitionId]) state.scores[data.competitionId] = {};
    if (!state.scores[data.competitionId][data.itemId]) state.scores[data.competitionId][data.itemId] = {};
    state.scores[data.competitionId][data.itemId][data.judgeId] = data.submission;

    renderDisplay();
  });

  socket.on('active-item-changed', (data) => {
    state.activeItemId = data.itemId;
    renderDisplay();
  });

  socket.on('competition-changed', (data) => {
    state.activeCompetition = data.activeCompetition;
    state.activeItemId = data.activeItemId;
    renderDisplay();
  });

  socket.on('scores-reset', () => loadState());
}
