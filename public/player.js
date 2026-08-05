const socket = io();

const joinScreen = document.getElementById("join-screen");
const waitingScreen = document.getElementById("waiting-screen");
const questionScreen = document.getElementById("question-screen");
const summaryScreen = document.getElementById("summary-screen");

const nameForm = document.getElementById("name-form");
const nameInput = document.getElementById("name-input");
const questionNum = document.getElementById("question-num");
const questionText = document.getElementById("question-text");
const optionsEl = document.getElementById("options");
const liveResults = document.getElementById("live-results");
const timerEl = document.getElementById("timer");

const ACCENTS = ["accent-0", "accent-1", "accent-2", "accent-3"];

let myName = sessionStorage.getItem("warmup-name") || "";
let currentQuestionIndex = -1;
let hasAnsweredCurrent = false;
let timerInterval = null;

function showScreen(name) {
  joinScreen.classList.toggle("hidden", name !== "join");
  waitingScreen.classList.toggle("hidden", name !== "waiting");
  questionScreen.classList.toggle("hidden", name !== "question");
  summaryScreen.classList.toggle("hidden", name !== "summary");
}

function startTimer(deadline) {
  clearInterval(timerInterval);
  const tick = () => {
    const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    timerEl.textContent = remaining;
    timerEl.classList.toggle("expired", remaining === 0);
    if (remaining === 0) {
      clearInterval(timerInterval);
      [...optionsEl.children].forEach((c) => (c.disabled = true));
    }
  };
  tick();
  timerInterval = setInterval(tick, 250);
}

function renderQuestion(payload) {
  showScreen("question");
  currentQuestionIndex = payload.index;
  hasAnsweredCurrent = false;
  liveResults.classList.add("hidden");
  questionNum.textContent = `Question ${payload.index + 1} of ${payload.total}`;
  questionText.textContent = payload.question.prompt;
  optionsEl.innerHTML = "";
  payload.question.options.forEach((opt, i) => {
    const btn = document.createElement("button");
    btn.className = `option-btn ${ACCENTS[i % ACCENTS.length]}`;
    btn.textContent = opt;
    btn.addEventListener("click", () => {
      socket.emit("answer", i);
      hasAnsweredCurrent = true;
      [...optionsEl.children].forEach((c, ci) => {
        c.disabled = true;
        c.classList.toggle("picked", ci === i);
      });
      liveResults.classList.remove("hidden");
    });
    optionsEl.appendChild(btn);
  });
  if (payload.deadline) startTimer(payload.deadline);
}

function renderTally(q) {
  if (q.qi !== currentQuestionIndex || !hasAnsweredCurrent) return;
  const total = q.groups.reduce((a, g) => a + g.length, 0);
  liveResults.innerHTML = "";
  q.options.forEach((opt, i) => {
    const count = q.groups[i].length;
    const pct = total ? Math.round((count / total) * 100) : 0;
    const col = document.createElement("div");
    col.className = `result-col ${ACCENTS[i % ACCENTS.length]}`;
    col.innerHTML = `
      <div class="result-pct">${pct}%</div>
      <div class="result-count">${count} · ${opt}</div>
    `;
    liveResults.appendChild(col);
  });
}

socket.on("state", (s) => {
  if (!myName) {
    showScreen("join");
    return;
  }
  if (s.phase === "lobby") {
    showScreen("waiting");
  } else if (s.phase === "question") {
    renderQuestion({ question: s.question, total: s.total, index: s.index, deadline: s.deadline });
  } else if (s.phase === "summary") {
    showScreen("summary");
  }
});

socket.on("question", renderQuestion);
socket.on("tally-update", renderTally);
socket.on("summary", () => showScreen("summary"));

nameForm.addEventListener("submit", (e) => {
  e.preventDefault();
  myName = nameInput.value.trim();
  if (!myName) return;
  sessionStorage.setItem("warmup-name", myName);
  socket.emit("join", myName);
  showScreen("waiting");
});

if (myName) {
  socket.emit("join", myName);
}
