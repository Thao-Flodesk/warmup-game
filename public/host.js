const socket = io();

const lobbyEl = document.getElementById("lobby");
const questionScreen = document.getElementById("question-screen");
const revealScreen = document.getElementById("reveal-screen");
const finalScreen = document.getElementById("final-screen");

const qrImg = document.getElementById("qr-img");
const joinUrlEl = document.getElementById("join-url");
const playersCount = document.getElementById("players-count");
const playersList = document.getElementById("players-list");
const startBtn = document.getElementById("start-btn");
const nextBtn = document.getElementById("next-btn");
const nextBtn2 = document.getElementById("next-btn-2");
const resetBtn = document.getElementById("reset-btn");

const questionNum = document.getElementById("question-num");
const questionEmoji = document.getElementById("question-emoji");
const optionsEl = document.getElementById("options");
const timerEl = document.getElementById("timer");

const revealNum = document.getElementById("reveal-num");
const revealEmoji = document.getElementById("reveal-emoji");
const revealOptions = document.getElementById("reveal-options");
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

function renderLeaderboard(container, rows) {
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
  revealOptions.innerHTML = "";
  r.options.forEach((opt, i) => {
    const div = document.createElement("div");
    const isCorrect = i === r.correctIndex;
    div.className = `mc-opt ${ACCENTS[i]} ${isCorrect ? "correct" : "dim"}`;
    div.innerHTML = `<span class="letter">${LETTERS[i]}</span>${opt}`;
    revealOptions.appendChild(div);
  });
  revealExplain.innerHTML = `<b>${r.options[r.correctIndex]}</b> — ${r.explain}`;
  statCorrect.textContent = `${r.correctCount}/${r.totalAnswered}`;
  statFastest.textContent = r.fastestName || "—";
  renderLeaderboard(leaderboardList, payload.leaderboard);
}

function renderFinal(payload) {
  showScreen("final");
  winnerName.textContent = payload.leaderboard[0] ? payload.leaderboard[0].name : "—";
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
    renderReveal({ reveal: s.reveal, leaderboard: s.leaderboard, total: s.total, index: s.index });
  } else if (s.phase === "final") {
    renderFinal({ leaderboard: s.leaderboard });
  }
});

socket.on("players-update", renderPlayers);
socket.on("question", renderQuestion);
socket.on("reveal", renderReveal);
socket.on("final", renderFinal);

startBtn.addEventListener("click", () => socket.emit("host-start"));
nextBtn.addEventListener("click", () => socket.emit("host-next"));
nextBtn2.addEventListener("click", () => socket.emit("host-next"));
resetBtn.addEventListener("click", () => socket.emit("host-reset"));
