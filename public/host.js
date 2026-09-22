const socket = io();

const lobbyEl = document.getElementById("lobby");
const questionScreen = document.getElementById("question-screen");
const revealScreen = document.getElementById("reveal-screen");
const leaderboardScreen = document.getElementById("leaderboard-screen");
const finalScreen = document.getElementById("final-screen");

const qrImg = document.getElementById("qr-img");
const joinUrlEl = document.getElementById("join-url");
const playersCount = document.getElementById("players-count");
const playersList = document.getElementById("players-list");
const startBtn = document.getElementById("start-btn");
const nextBtn = document.getElementById("next-btn");
const nextBtn2 = document.getElementById("next-btn-2");
const nextBtn3 = document.getElementById("next-btn-3");
const resetBtn = document.getElementById("reset-btn");

const questionNum = document.getElementById("question-num");
const questionEmoji = document.getElementById("question-emoji");
const optionsEl = document.getElementById("options");
const timerEl = document.getElementById("timer");

const revealNum = document.getElementById("reveal-num");
const revealEmoji = document.getElementById("reveal-emoji");
const revealChart = document.getElementById("reveal-chart");
const revealExplain = document.getElementById("reveal-explain");
const statCorrect = document.getElementById("stat-correct");
const statFastest = document.getElementById("stat-fastest");
const leaderboardList = document.getElementById("leaderboard-list");

const winnerName = document.getElementById("winner-name");
const finalList = document.getElementById("final-list");

const ACCENTS = ["accent-0", "accent-1", "accent-2", "accent-3"];
const LETTERS = ["A", "B", "C", "D"];
let timerInterval = null;

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function showScreen(name) {
  lobbyEl.classList.toggle("hidden", name !== "lobby");
  questionScreen.classList.toggle("hidden", name !== "question");
  revealScreen.classList.toggle("hidden", name !== "reveal");
  leaderboardScreen.classList.toggle("hidden", name !== "leaderboard");
  finalScreen.classList.toggle("hidden", name !== "final");
}

function renderPlayers(names) {
  playersCount.textContent = names.length;
  playersList.innerHTML = "";
  names.forEach((n) => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = n;
    playersList.appendChild(chip);
  });
}

function startTimer(deadline) {
  clearInterval(timerInterval);
  const tick = () => {
    const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    timerEl.textContent = remaining;
    timerEl.classList.toggle("expired", remaining === 0);
    if (remaining === 0) clearInterval(timerInterval);
  };
  tick();
  timerInterval = setInterval(tick, 250);
}

function renderQuestion(payload) {
  showScreen("question");
  questionNum.textContent = `Question ${payload.index + 1} of ${payload.total}`;
  questionEmoji.textContent = payload.question.emoji;
  optionsEl.innerHTML = "";
  payload.question.options.forEach((opt, i) => {
    const div = document.createElement("div");
    div.className = `mc-opt ${ACCENTS[i]}`;
    div.innerHTML = `<span class="letter">${LETTERS[i]}</span>${opt}`;
    optionsEl.appendChild(div);
  });
  if (payload.deadline) startTimer(payload.deadline);
}

function renderLeaderboardRows(container, rows) {
  container.innerHTML = "";
  const arrow = { up: "↑", down: "↓", same: "—", new: "new" };
  rows.forEach((row, i) => {
    const div = document.createElement("div");
    div.className = `board-row ${i === 0 ? "top1" : i === 1 ? "top2" : i === 2 ? "top3" : ""}`;
    div.innerHTML = `
      <div class="rank">${i + 1}</div>
      <div class="board-name">${escapeHtml(row.name)}</div>
      <div class="board-delta">${arrow[row.delta] || ""}</div>
      <div class="board-score">${row.score.toLocaleString()}</div>
    `;
    container.appendChild(div);
  });
  if (rows.length === 0) {
    container.innerHTML = '<div class="board-row">No answers yet</div>';
  }
}

function renderReveal(payload) {
  clearInterval(timerInterval);
  showScreen("reveal");
  const r = payload.reveal;
  revealNum.textContent = `Question ${payload.index + 1} of ${payload.total} — Answer`;
  revealEmoji.textContent = r.emoji;
  const maxCount = Math.max(1, ...r.counts);
  revealChart.innerHTML = "";
  r.options.forEach((opt, i) => {
    const isCorrect = i === r.correctIndex;
    const count = r.counts[i];
    const pct = Math.round((count / maxCount) * 100);
    const row = document.createElement("div");
    row.className = `chart-row ${ACCENTS[i]} ${isCorrect ? "correct" : ""}`;
    row.innerHTML = `
      <div class="chart-letter">${LETTERS[i]}</div>
      <div class="chart-label">${opt}</div>
      <div class="chart-track"><div class="chart-fill" style="transform: scaleX(${pct / 100})"></div></div>
      <div class="chart-count">${count}</div>
    `;
    revealChart.appendChild(row);
  });
  revealExplain.innerHTML = `<b>${r.options[r.correctIndex]}</b> — ${r.explain}`;
  statCorrect.textContent = `${r.correctCount}/${r.totalAnswered}`;
  statFastest.textContent = r.fastestName || "—";
}

function renderLeaderboardScreen(payload) {
  showScreen("leaderboard");
  renderLeaderboardRows(leaderboardList, payload.leaderboard);
}

const FIREWORK_COLORS = ["#cf4a27", "#6b954c", "#e0ca52", "#aea579"];

function launchFireworks() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:1000;";
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");

  const DURATION_MS = 3000;
  const BURST_COUNT = 4;
  const BURST_GAP_MS = DURATION_MS / BURST_COUNT;
  const PARTICLE_LIFE_MS = 900;
  const startTime = performance.now();

  let particles = [];

  function burst() {
    const x = canvas.width * (0.2 + Math.random() * 0.6);
    const y = canvas.height * (0.15 + Math.random() * 0.35);
    const color = FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)];
    for (let i = 0; i < 44; i++) {
      const angle = (Math.PI * 2 * i) / 44 + Math.random() * 0.2;
      const speed = 2.5 + Math.random() * 3;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        born: performance.now(),
        color,
        size: 2.5 + Math.random() * 2,
      });
    }
  }

  for (let b = 0; b < BURST_COUNT; b++) {
    setTimeout(burst, b * BURST_GAP_MS);
  }

  function tick(now) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.045;
      const alpha = Math.max(0, 1 - (now - p.born) / PARTICLE_LIFE_MS);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    particles = particles.filter((p) => now - p.born < PARTICLE_LIFE_MS);
    if (now - startTime < DURATION_MS + PARTICLE_LIFE_MS) {
      requestAnimationFrame(tick);
    } else {
      canvas.remove();
    }
  }
  requestAnimationFrame(tick);
}

function renderFinal(payload) {
  showScreen("final");
  winnerName.textContent = payload.leaderboard[0] ? payload.leaderboard[0].name : "—";
  launchFireworks();
  finalList.innerHTML = "";
  payload.leaderboard.forEach((row, i) => {
    const div = document.createElement("div");
    div.className = `board-row ${i === 0 ? "top1" : i === 1 ? "top2" : i === 2 ? "top3" : ""}`;
    div.innerHTML = `
      <div class="rank">${i + 1}</div>
      <div class="board-name">${escapeHtml(row.name)}</div>
      <div class="board-score">${row.score.toLocaleString()}</div>
    `;
    finalList.appendChild(div);
  });
  if (payload.leaderboard.length === 0) {
    finalList.innerHTML = '<div class="board-row">No answers yet</div>';
  }
}

fetch("/api/qr")
  .then((r) => r.json())
  .then(({ url, dataUrl }) => {
    qrImg.src = dataUrl;
    qrImg.classList.remove("hidden");
    joinUrlEl.textContent = url;
  });

socket.on("state", (s) => {
  if (s.phase === "lobby") {
    showScreen("lobby");
    renderPlayers(s.players || []);
  } else if (s.phase === "question") {
    renderQuestion({ question: s.question, total: s.total, index: s.index, deadline: s.deadline });
  } else if (s.phase === "reveal") {
    renderReveal({ reveal: s.reveal, total: s.total, index: s.index });
  } else if (s.phase === "leaderboard") {
    renderLeaderboardScreen({ leaderboard: s.leaderboard });
  } else if (s.phase === "final") {
    renderFinal({ leaderboard: s.leaderboard });
  }
});

socket.on("players-update", renderPlayers);
socket.on("question", renderQuestion);
socket.on("reveal", renderReveal);
socket.on("leaderboard", renderLeaderboardScreen);
socket.on("final", renderFinal);

startBtn.addEventListener("click", () => socket.emit("host-start"));
nextBtn.addEventListener("click", () => socket.emit("host-next"));
nextBtn2.addEventListener("click", () => socket.emit("host-next"));
nextBtn3.addEventListener("click", () => socket.emit("host-next"));
resetBtn.addEventListener("click", () => socket.emit("host-reset"));
