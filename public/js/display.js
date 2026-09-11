// Synchronized Display / Projector Client
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
    console.error('Failed to load display state:', err);
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

  const comp = state.activeCompetition;
  const isFlags = comp === 'flags';
  const num = state.activeItemNumber;
  const formattedNum = num < 10 ? '0' + num : num;

  // Header Title
  document.getElementById('dispCompTitle').textContent = isFlags ? 'කොඩි තේරීමේ තරඟය (Flag Competition)' : 'ලාංඡන තේරීමේ තරඟය (Emblem Competition)';

  // Status Badge
  const statusPill = document.getElementById('dispVotingStatus');
  if (state.votingOpen) {
    statusPill.className = 'inline-flex items-center space-x-2 px-5 py-2 rounded-full text-xs font-black uppercase tracking-wider mb-6 bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse';
    statusPill.innerHTML = '<span class="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span><span>සජීවීව ලකුණු ලබාදීම විවෘතයි (Voting in Progress)</span>';
  } else {
    statusPill.className = 'inline-flex items-center space-x-2 px-5 py-2 rounded-full text-xs font-black uppercase tracking-wider mb-6 bg-slate-800 text-slate-400 border border-slate-700';
    statusPill.innerHTML = '<span class="w-2.5 h-2.5 rounded-full bg-slate-500"></span><span>ලකුණු ලබාදීම විවෘත වන තෙක් රැඳී සිටින්න</span>';
  }

  // Giant Display Number (Replacing Image) with Distinct 2 Colors
  const stageBox = document.getElementById('dispStageBox');
  const compTag = document.getElementById('dispCompTag');
  const itemSubtext = document.getElementById('dispItemSubtext');

  if (isFlags) {
    if (stageBox) stageBox.className = 'relative my-4 w-full max-w-2xl bg-gradient-to-b from-slate-950 to-slate-900 border-4 border-amber-500/60 rounded-3xl py-10 px-8 flex flex-col items-center justify-center shadow-2xl shadow-amber-500/15';
    compTag.className = 'text-xs font-bold text-amber-400 bg-amber-500/15 border border-amber-500/30 px-3.5 py-1 rounded-full uppercase tracking-wider';
    compTag.innerHTML = '<i class="fa-solid fa-flag mr-1"></i> කොඩි තරඟය';
    itemSubtext.className = 'text-base font-extrabold text-amber-400 bg-amber-500/10 px-5 py-1.5 rounded-xl border border-amber-500/20';
  } else {
    if (stageBox) stageBox.className = 'relative my-4 w-full max-w-2xl bg-gradient-to-b from-slate-950 to-slate-900 border-4 border-cyan-500/60 rounded-3xl py-10 px-8 flex flex-col items-center justify-center shadow-2xl shadow-cyan-500/15';
    compTag.className = 'text-xs font-bold text-cyan-400 bg-cyan-500/15 border border-cyan-500/30 px-3.5 py-1 rounded-full uppercase tracking-wider';
    compTag.innerHTML = '<i class="fa-solid fa-shield-halved mr-1"></i> ලාංඡන තරඟය';
    itemSubtext.className = 'text-base font-extrabold text-cyan-400 bg-cyan-500/10 px-5 py-1.5 rounded-xl border border-cyan-500/20';
  }

  document.getElementById('dispGiantNumber').textContent = formattedNum;
  itemSubtext.textContent = `නිර්මාණ අංක ${formattedNum} (${isFlags ? 'Flag' : 'Emblem'} #${formattedNum})`;

  // 20 Judges Submission Progress
  const compScores = (state.scores && state.scores[comp]) || {};
  const activeScores = compScores[num.toString()] || {};
  const judges = state.judges || [];

  let submittedCount = 0;
  const dotsContainer = document.getElementById('dispJudgesDots');
  dotsContainer.innerHTML = '';

  judges.forEach(j => {
    const isSubmitted = activeScores[j.id] && typeof activeScores[j.id].score === 'number';
    if (isSubmitted) submittedCount++;

    const dot = document.createElement('div');
    dot.className = `h-9 rounded-xl text-xs font-black flex items-center justify-center transition-all ${
      isSubmitted 
        ? 'bg-emerald-500 text-slate-950 font-black scale-105 shadow-md shadow-emerald-500/40' 
        : 'bg-slate-900 text-slate-600 border border-slate-800'
    }`;
    dot.textContent = `J${j.id < 10 ? '0' + j.id : j.id}`;
    dotsContainer.appendChild(dot);
  });

  const percentage = judges.length > 0 ? (submittedCount / judges.length) * 100 : 0;
  document.getElementById('dispProgressText').textContent = `${submittedCount} / ${judges.length}`;
  document.getElementById('dispProgressBar').style.width = `${percentage}%`;

  const allDoneAlert = document.getElementById('dispAllDoneAlert');
  if (submittedCount === judges.length && judges.length > 0) {
    allDoneAlert.classList.remove('hidden');
  } else {
    allDoneAlert.classList.add('hidden');
  }

  if (currentView === 'podium') {
    renderPodium();
  }
}

// Render Winners Podium
function renderPodium() {
  const comp = state.activeCompetition;
  const isFlags = comp === 'flags';
  const totalCount = (state.totalItems && state.totalItems[comp]) || 10;
  const compScores = (state.scores && state.scores[comp]) || {};
  const judges = state.judges || [];

  const results = [];
  for (let i = 1; i <= totalCount; i++) {
    const itemScores = compScores[i.toString()] || {};
    let total = 0;
    let count = 0;
    judges.forEach(j => {
      if (itemScores[j.id] && typeof itemScores[j.id].score === 'number') {
        total += itemScores[j.id].score;
        count++;
      }
    });
    const avg = count > 0 ? parseFloat((total / count).toFixed(2)) : 0.00;
    results.push({ number: i, total, avg, count });
  }

  results.sort((a, b) => b.avg - a.avg || b.total - a.total);

  const container = document.getElementById('podiumContainer');
  container.innerHTML = '';

  const first = results[0];
  const second = results[1];
  const third = results[2];

  // 2nd Place (Silver)
  if (second) {
    const label = `${isFlags ? 'Flag' : 'Emblem'} #${second.number < 10 ? '0' + second.number : second.number}`;
    container.innerHTML += `
      <div class="order-2 md:order-1 bg-slate-900/90 border-2 border-slate-400 rounded-3xl p-6 text-center flex flex-col items-center silver-glow">
        <div class="w-12 h-12 rounded-full bg-slate-300 text-slate-950 font-black text-xl flex items-center justify-center -mt-10 shadow-lg">2</div>
        <div class="my-5">
          <span class="text-xs text-slate-400 font-bold block uppercase tracking-wider">දෙවන ස්ථානය (2nd)</span>
          <h3 class="text-3xl font-black text-white mt-1">${label}</h3>
        </div>
        <div class="text-3xl font-black text-slate-200">${second.avg.toFixed(2)} <span class="text-xs text-slate-400 font-normal">/ 10</span></div>
        <div class="text-xs text-slate-400 font-semibold mt-1">මුළු ලකුණු: ${second.total}</div>
      </div>
    `;
  }

  // 1st Place (Gold)
  if (first) {
    const label = `${isFlags ? 'Flag' : 'Emblem'} #${first.number < 10 ? '0' + first.number : first.number}`;
    container.innerHTML += `
      <div class="order-1 md:order-2 bg-slate-900/90 border-2 border-amber-400 rounded-3xl p-8 text-center flex flex-col items-center gold-glow transform md:-translate-y-4">
        <div class="w-16 h-16 rounded-full bg-amber-400 text-slate-950 font-black text-2xl flex items-center justify-center -mt-14 shadow-2xl">
          <i class="fa-solid fa-crown text-2xl"></i>
        </div>
        <div class="my-6">
          <span class="text-xs text-amber-400 font-bold block uppercase tracking-wider">ප්‍රථම ස්ථානය (Winner)</span>
          <h3 class="text-4xl font-black text-white mt-1">${label}</h3>
        </div>
        <div class="text-4xl font-black text-amber-400">${first.avg.toFixed(2)} <span class="text-xs text-slate-400 font-normal">/ 10</span></div>
        <div class="text-sm text-slate-300 font-semibold mt-1">මුළු ලකුණු: ${first.total}</div>
      </div>
    `;
  }

  // 3rd Place (Bronze)
  if (third) {
    const label = `${isFlags ? 'Flag' : 'Emblem'} #${third.number < 10 ? '0' + third.number : third.number}`;
    container.innerHTML += `
      <div class="order-3 md:order-3 bg-slate-900/90 border-2 border-amber-700 rounded-3xl p-6 text-center flex flex-col items-center bronze-glow">
        <div class="w-12 h-12 rounded-full bg-amber-700 text-white font-black text-xl flex items-center justify-center -mt-10 shadow-lg">3</div>
        <div class="my-5">
          <span class="text-xs text-amber-600 font-bold block uppercase tracking-wider">තෙවන ස්ථානය (3rd)</span>
          <h3 class="text-3xl font-black text-white mt-1">${label}</h3>
        </div>
        <div class="text-3xl font-black text-amber-500">${third.avg.toFixed(2)} <span class="text-xs text-slate-400 font-normal">/ 10</span></div>
        <div class="text-xs text-slate-400 font-semibold mt-1">මුළු ලකුණු: ${third.total}</div>
      </div>
    `;
  }

  // Other ranks
  const otherList = document.getElementById('otherRanksList');
  otherList.innerHTML = '';
  if (results.length > 3) {
    results.slice(3).forEach((r, idx) => {
      const label = `${isFlags ? 'Flag' : 'Emblem'} #${r.number < 10 ? '0' + r.number : r.number}`;
      const row = document.createElement('div');
      row.className = 'bg-slate-900 border border-slate-800 rounded-2xl px-5 py-3 flex items-center justify-between text-xs';
      row.innerHTML = `
        <div class="flex items-center space-x-4">
          <span class="font-bold text-slate-400 w-6">#${idx + 4}</span>
          <span class="font-bold text-white text-sm">${label}</span>
        </div>
        <div class="font-black text-slate-200 text-sm">${r.avg.toFixed(2)} <span class="text-[10px] text-slate-500">/ 10</span></div>
      `;
      otherList.appendChild(row);
    });
  }
}

function toggleFullScreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    if (document.exitFullscreen) document.exitFullscreen();
  }
}

// Socket Listeners
function setupSocketListeners() {
  socket.on('round-changed', (data) => {
    if (!state) return;
    state.activeCompetition = data.activeCompetition;
    state.activeItemNumber = data.activeItemNumber;
    state.votingOpen = data.votingOpen;
    renderDisplay();
  });

  socket.on('score-updated', (data) => {
    if (!state) return;
    if (!state.scores[data.competition]) state.scores[data.competition] = {};
    if (!state.scores[data.competition][data.itemNumber.toString()]) state.scores[data.competition][data.itemNumber.toString()] = {};
    state.scores[data.competition][data.itemNumber.toString()][data.judgeId] = data.submission;

    if (data.competition === state.activeCompetition) {
      renderDisplay();
    }
  });

  socket.on('total-items-changed', (data) => {
    state.totalItems = data.totalItems;
    renderDisplay();
  });

  socket.on('scores-reset', () => loadState());
}
