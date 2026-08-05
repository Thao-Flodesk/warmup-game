const socket = io();

const lobbyEl = document.getElementById("lobby");
const questionScreen = document.getElementById("question-screen");
const summaryScreen = document.getElementById("summary-screen");

const qrImg = document.getElementById("qr-img");
const joinUrlEl = document.getElementById("join-url");
const playersCount = document.getElementById("players-count");
const playersList = document.getElementById("players-list");
const startBtn = document.getElementById("start-btn");
const nextBtn = document.getElementById("next-btn");
const resetBtn = document.getElementById("reset-btn");

const questionNum = document.getElementById("question-num");
const questionText = document.getElementById("question-text");
const teamsEl = document.getElementById("teams");
const insightsEl = document.getElementById("insights");
const timerEl = document.getElementById("timer");

const ACCENTS = ["accent-0", "accent-1", "accent-2", "accent-3"];
let timerInterval = null;

const NAME_COLORS = ["#cf4a27", "#464643", "#8d8b3f", "#90875f", "#bf6a66", "#6b954c"];
function colorForName(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return NAME_COLORS[hash % NAME_COLORS.length];
}

function showScreen(name) {
  lobbyEl.classList.toggle("hidden", name !== "lobby");
  questionScreen.classList.toggle("hidden", name !== "question");
  summaryScreen.classList.toggle("hidden", name !== "summary");
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
  renderTally(payload.question);
  if (payload.deadline) startTimer(payload.deadline);
}

function renderTally(q) {
  questionText.textContent = q.prompt;
  const total = q.groups.reduce((a, g) => a + g.length, 0);
  teamsEl.innerHTML = "";
  q.options.forEach((opt, i) => {
    const names = q.groups[i];
    const pct = total ? Math.round((names.length / total) * 100) : 0;
    const col = document.createElement("div");
    col.className = `team-col ${ACCENTS[i % ACCENTS.length]}`;
    col.innerHTML = `
      <div class="team-label">${opt}</div>
      <div class="team-pct">${pct}%</div>
      <div class="team-count">${names.length} ${names.length === 1 ? "person" : "people"}</div>
      <div class="team-names">${names.map((n) => `<span class="name-pill" style="color:${colorForName(n)}">${n}</span>`).join("")}</div>
    `;
    teamsEl.appendChild(col);
  });
}

function renderSummary(s) {
  showScreen("summary");
  clearInterval(timerInterval);
  insightsEl.innerHTML = "";
  const items = [];
  if (s.mostAgreed) {
    items.push({
      emoji: "🏆",
      label: "Most agreed on",
      headline: `${Math.round(s.mostAgreed.share * 100)}% said "${s.mostAgreed.topOption}"`,
      body: `on "${s.mostAgreed.prompt}"`,
    });
  }
  if (s.mostDivided) {
    items.push({
      emoji: "⚖️",
      label: "Most divided",
      headline: "Coin flip",
      body: `"${s.mostDivided.prompt}" split the room`,
    });
  }
  if (s.bestTwins) {
    items.push({
      emoji: "👯",
      label: "Certified twins",
      headline: `${s.bestTwins.a} & ${s.bestTwins.b}`,
      body: `matched on every single question`,
    });
  }
  if (s.freeThinker && s.freeThinker.count > 0) {
    items.push({
      emoji: "🦄",
      label: "Free thinker",
      headline: s.freeThinker.name,
      body: `went rogue ${s.freeThinker.count} time${s.freeThinker.count > 1 ? "s" : ""}`,
    });
  }
  if (items.length === 0) {
    items.push({ emoji: "🤷", label: "Result", headline: "Not enough data", body: "play again to find a pattern!" });
  }
  items.forEach((it, i) => {
    const div = document.createElement("div");
    div.className = `insight-card ${ACCENTS[i % ACCENTS.length]}`;
    div.innerHTML = `
      <div class="insight-emoji">${it.emoji}</div>
      <div class="insight-label">${it.label}</div>
      <div class="insight-headline">${it.headline}</div>
      <div class="insight-body">${it.body}</div>
    `;
    insightsEl.appendChild(div);
  });
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
  } else if (s.phase === "summary") {
    renderSummary(s.summary);
  }
});

socket.on("players-update", renderPlayers);
socket.on("question", renderQuestion);
socket.on("tally-update", renderTally);
socket.on("summary", renderSummary);

startBtn.addEventListener("click", () => socket.emit("host-start"));
nextBtn.addEventListener("click", () => socket.emit("host-next"));
resetBtn.addEventListener("click", () => socket.emit("host-reset"));
