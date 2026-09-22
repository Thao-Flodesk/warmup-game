const socket = io();

const joinScreen = document.getElementById("join-screen");
const waitingScreen = document.getElementById("waiting-screen");
const questionScreen = document.getElementById("question-screen");
const waitingRevealScreen = document.getElementById("waiting-reveal-screen");
const revealScreen = document.getElementById("reveal-screen");
const finalScreen = document.getElementById("final-screen");

const nameForm = document.getElementById("name-form");
const nameInput = document.getElementById("name-input");
const questionNum = document.getElementById("question-num");
const questionEmoji = document.getElementById("question-emoji");
const optionsEl = document.getElementById("options");
const timerEl = document.getElementById("timer");
const resultCard = document.getElementById("result-card");
const finalCard = document.getElementById("final-card");

const ACCENTS = ["accent-0", "accent-1", "accent-2", "accent-3"];
const LETTERS = ["A", "B", "C", "D"];

let myName = sessionStorage.getItem("warmup-name") || "";
let timerInterval = null;

function showScreen(name) {
  joinScreen.classList.toggle("hidden", name !== "join");
  waitingScreen.classList.toggle("hidden", name !== "waiting");
  questionScreen.classList.toggle("hidden", name !== "question");
  waitingRevealScreen.classList.toggle("hidden", name !== "waiting-reveal");
  revealScreen.classList.toggle("hidden", name !== "reveal");
  finalScreen.classList.toggle("hidden", name !== "final");
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
  questionNum.textContent = `Question ${payload.index + 1} of ${payload.total}`;
  questionEmoji.textContent = payload.question.emoji;
  optionsEl.innerHTML = "";
  payload.question.options.forEach((opt, i) => {
    const btn = document.createElement("button");
    btn.className = `option-btn ${ACCENTS[i]}`;
    btn.innerHTML = `<span class="letter">${LETTERS[i]}</span>${opt}`;
    btn.addEventListener("click", () => {
      socket.emit("answer", i);
      [...optionsEl.children].forEach((c, ci) => {
        c.disabled = true;
        c.classList.toggle("picked", ci === i);
      });
      showScreen("waiting-reveal");
    });
    optionsEl.appendChild(btn);
  });
  if (payload.deadline) startTimer(payload.deadline);
}

function renderYourResult(r) {
  showScreen("reveal");
  resultCard.className = `result-card ${r.correct ? "win" : "lose"}`;
  resultCard.innerHTML = `
    <div class="tag">${r.correct ? "Correct" : "Not quite"}</div>
    <div class="big">+${r.points} pts</div>
    <div class="sub">Total: ${r.totalScore.toLocaleString()} pts</div>
    <div class="rank-pill">#${r.rank} of ${r.totalPlayers}</div>
  `;
}

function renderYourFinal(r) {
  showScreen("final");
  finalCard.innerHTML = `
    <div class="tag">Final rank</div>
    <div class="big">#${r.rank} of ${r.totalPlayers}</div>
    <div class="sub">${r.totalScore.toLocaleString()} pts total</div>
  `;
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
  } else if (s.phase === "reveal") {
    showScreen("waiting-reveal");
  } else if (s.phase === "final") {
    showScreen("final");
  }
});

socket.on("question", renderQuestion);
socket.on("your-result", renderYourResult);
socket.on("your-final", renderYourFinal);

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
