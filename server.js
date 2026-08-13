const os = require("os");
const path = require("path");
const fs = require("fs");
const express = require("express");
const QRCode = require("qrcode");
const { Server } = require("socket.io");

const PORT = process.env.PORT || 3000;
const questions = JSON.parse(fs.readFileSync(path.join(__dirname, "questions.json"), "utf8"));

function getLanUrl() {
  if (process.env.HOST_URL) return process.env.HOST_URL;
  if (process.env.RENDER_EXTERNAL_URL) return process.env.RENDER_EXTERNAL_URL;
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) {
        return `http://${net.address}:${PORT}`;
      }
    }
  }
  return `http://localhost:${PORT}`;
}

const app = express();
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "host.html")));
app.get("/play", (req, res) => res.sendFile(path.join(__dirname, "public", "player.html")));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/qr", async (req, res) => {
  const url = `${getLanUrl()}/play`;
  const dataUrl = await QRCode.toDataURL(url, { margin: 1, width: 320 });
  res.json({ url, dataUrl });
});

const server = app.listen(PORT, () => {
  console.log(`Warm-up game running.`);
  console.log(`Host screen:  http://localhost:${PORT}`);
  console.log(`Players join: ${getLanUrl()}/play`);
});

const io = new Server(server);

const QUESTION_SECONDS = 10;
const REVEAL_SECONDS = 5;

// --- game state (single in-memory session, no auth — trusted internal use) ---
let phase = "lobby"; // lobby | question | summary
let questionIndex = -1;
let questionDeadline = 0;
let advanceTimer = null;
let players = {}; // socketId -> { name, answers: { [qIndex]: choiceIndex } }

function tallyForQuestion(qi) {
  const q = questions[qi];
  const groups = q.options.map(() => []);
  Object.values(players).forEach((p) => {
    const choice = p.answers[qi];
    if (choice !== undefined) groups[choice].push(p.name);
  });
  return { qi, prompt: q.prompt, options: q.options, groups };
}

function playerNames() {
  return Object.values(players).map((p) => p.name);
}

function computeSummary() {
  const list = Object.values(players);
  const perQuestion = questions.map((q, qi) => {
    const t = tallyForQuestion(qi);
    const counts = t.groups.map((g) => g.length);
    const total = counts.reduce((a, b) => a + b, 0);
    return { prompt: q.prompt, options: q.options, counts, total };
  });

  let mostAgreed = null;
  let mostDivided = null;
  perQuestion.forEach((s) => {
    if (s.total === 0) return;
    const max = Math.max(...s.counts);
    const share = max / s.total;
    const sorted = [...s.counts].sort((a, b) => b - a);
    const gap = (sorted[0] - (sorted[1] || 0)) / s.total;
    const topOption = s.options[s.counts.indexOf(max)];
    if (!mostAgreed || share > mostAgreed.share) {
      mostAgreed = { prompt: s.prompt, topOption, share, total: s.total };
    }
    if (!mostDivided || gap < mostDivided.gap) {
      mostDivided = { prompt: s.prompt, gap, total: s.total };
    }
  });

  let bestTwins = null;
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      const commonQs = questions
        .map((_, qi) => qi)
        .filter((qi) => a.answers[qi] !== undefined && b.answers[qi] !== undefined);
      if (commonQs.length === 0) continue;
      const matches = commonQs.filter((qi) => a.answers[qi] === b.answers[qi]).length;
      if (matches === commonQs.length && (!bestTwins || commonQs.length > bestTwins.count)) {
        bestTwins = { a: a.name, b: b.name, count: commonQs.length };
      }
    }
  }

  let freeThinker = null;
  list.forEach((p) => {
    let minorityCount = 0;
    let answeredCount = 0;
    questions.forEach((q, qi) => {
      if (p.answers[qi] === undefined) return;
      answeredCount++;
      const counts = perQuestion[qi].counts;
      const max = Math.max(...counts);
      if (counts[p.answers[qi]] < max) minorityCount++;
    });
    if (answeredCount > 0 && minorityCount > (freeThinker ? freeThinker.count : -1)) {
      freeThinker = { name: p.name, count: minorityCount, total: answeredCount };
    }
  });

  return { perQuestion, mostAgreed, mostDivided, bestTwins, freeThinker };
}

function stateForNewClient() {
  if (phase === "question") {
    return { phase, question: tallyForQuestion(questionIndex), total: questions.length, index: questionIndex, deadline: questionDeadline };
  }
  if (phase === "summary") return { phase, summary: computeSummary() };
  return { phase, players: playerNames() };
}

function emitQuestion() {
  questionDeadline = Date.now() + QUESTION_SECONDS * 1000;
  io.emit("question", {
    question: tallyForQuestion(questionIndex),
    total: questions.length,
    index: questionIndex,
    deadline: questionDeadline,
  });
  clearTimeout(advanceTimer);
  advanceTimer = setTimeout(advanceQuestion, (QUESTION_SECONDS + REVEAL_SECONDS) * 1000);
}

function advanceQuestion() {
  clearTimeout(advanceTimer);
  if (questionIndex + 1 >= questions.length) {
    phase = "summary";
    io.emit("summary", computeSummary());
  } else {
    questionIndex++;
    emitQuestion();
  }
}

io.on("connection", (socket) => {
  socket.emit("state", stateForNewClient());

  socket.on("join", (name) => {
    const clean = String(name || "").trim().slice(0, 30) || "Anonymous";
    players[socket.id] = { name: clean, answers: {} };
    io.emit("players-update", playerNames());
    socket.emit("state", stateForNewClient());
  });

  socket.on("answer", (choiceIndex) => {
    const p = players[socket.id];
    if (!p || phase !== "question") return;
    if (Date.now() > questionDeadline + 500) return; // grace period for network latency
    if (p.answers[questionIndex] !== undefined) return;
    p.answers[questionIndex] = choiceIndex;
    io.emit("tally-update", tallyForQuestion(questionIndex));
  });

  socket.on("host-start", () => {
    phase = "question";
    questionIndex = 0;
    emitQuestion();
  });

  socket.on("host-next", () => {
    if (phase !== "question") return;
    advanceQuestion();
  });

  socket.on("host-reset", () => {
    clearTimeout(advanceTimer);
    phase = "lobby";
    questionIndex = -1;
    questionDeadline = 0;
    players = {};
    io.emit("state", stateForNewClient());
  });

  socket.on("disconnect", () => {
    if (phase === "lobby") {
      delete players[socket.id];
      io.emit("players-update", playerNames());
    }
  });
});
