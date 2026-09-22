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
  console.log(`Emoji quiz running.`);
  console.log(`Host screen:  http://localhost:${PORT}`);
  console.log(`Players join: ${getLanUrl()}/play`);
});

const io = new Server(server);

const QUESTION_SECONDS = 10;
const REVEAL_SECONDS = 8;

// --- game state (single in-memory session, no auth — trusted internal use) ---
let phase = "lobby"; // lobby | question | reveal | final
let questionIndex = -1;
let questionDeadline = 0;
let advanceTimer = null;
let lastRanking = []; // names in previous rank order, for leaderboard delta arrows
let players = {}; // socketId -> { name, totalScore, answers: { [qIndex]: { choice, correct, points, answeredAt } } }

function playerNames() {
  return Object.values(players).map((p) => p.name);
}

function questionForClient(qi) {
  const q = questions[qi];
  return { emoji: q.emoji, options: q.options };
}

function scoreAnswer(correct, answeredAt) {
  if (!correct) return 0;
  const totalMs = QUESTION_SECONDS * 1000;
  const remaining = Math.max(0, questionDeadline - answeredAt);
  const frac = Math.min(1, remaining / totalMs);
  return Math.round(500 + 500 * frac);
}

function computeRevealStats(qi) {
  const q = questions[qi];
  let correctCount = 0;
  let totalAnswered = 0;
  let fastest = null;
  Object.values(players).forEach((p) => {
    const a = p.answers[qi];
    if (!a) return;
    totalAnswered++;
    if (a.correct) {
      correctCount++;
      if (!fastest || a.answeredAt < fastest.answeredAt) fastest = { name: p.name, answeredAt: a.answeredAt };
    }
  });
  return {
    emoji: q.emoji,
    options: q.options,
    correctIndex: q.correct,
    explain: q.explain,
    correctCount,
    totalAnswered,
    fastestName: fastest ? fastest.name : null,
  };
}

function computeFullRanking() {
  return Object.entries(players)
    .map(([sid, p]) => ({ sid, name: p.name, score: p.totalScore || 0 }))
    .sort((a, b) => b.score - a.score);
}

function computeLeaderboard(full) {
  const top = full.slice(0, 5).map((r) => ({ name: r.name, score: r.score }));
  const withDelta = top.map((row, i) => {
    const prevIndex = lastRanking.indexOf(row.name);
    let delta = "new";
    if (prevIndex !== -1) delta = prevIndex === i ? "same" : prevIndex > i ? "up" : "down";
    return { ...row, delta };
  });
  lastRanking = top.map((r) => r.name);
  return withDelta;
}

function emitPersonalResults(eventName) {
  const full = computeFullRanking();
  full.forEach((r, i) => {
    const sock = io.sockets.sockets.get(r.sid);
    if (!sock) return;
    const p = players[r.sid];
    const a = p.answers[questionIndex];
    sock.emit(eventName, {
      correct: a ? a.correct : false,
      points: a ? a.points : 0,
      totalScore: p.totalScore || 0,
      rank: i + 1,
      totalPlayers: full.length,
    });
  });
}

function stateForNewClient() {
  const full = computeFullRanking();
  if (phase === "question") {
    return { phase, question: questionForClient(questionIndex), total: questions.length, index: questionIndex, deadline: questionDeadline };
  }
  if (phase === "reveal") {
    return { phase, reveal: computeRevealStats(questionIndex), leaderboard: computeLeaderboard(full), total: questions.length, index: questionIndex };
  }
  if (phase === "final") {
    return { phase, leaderboard: computeLeaderboard(full) };
  }
  return { phase, players: playerNames() };
}

function emitQuestion() {
  questionDeadline = Date.now() + QUESTION_SECONDS * 1000;
  phase = "question";
  io.emit("question", {
    question: questionForClient(questionIndex),
    total: questions.length,
    index: questionIndex,
    deadline: questionDeadline,
  });
  clearTimeout(advanceTimer);
  advanceTimer = setTimeout(revealCurrent, QUESTION_SECONDS * 1000);
}

function revealCurrent() {
  phase = "reveal";
  const full = computeFullRanking();
  const payload = {
    reveal: computeRevealStats(questionIndex),
    leaderboard: computeLeaderboard(full),
    total: questions.length,
    index: questionIndex,
  };
  io.emit("reveal", payload);
  emitPersonalResults("your-result");
  clearTimeout(advanceTimer);
  advanceTimer = setTimeout(nextQuestionOrFinal, REVEAL_SECONDS * 1000);
}

function nextQuestionOrFinal() {
  clearTimeout(advanceTimer);
  if (questionIndex + 1 >= questions.length) {
    phase = "final";
    const full = computeFullRanking();
    io.emit("final", { leaderboard: computeLeaderboard(full) });
    emitPersonalResults("your-final");
  } else {
    questionIndex++;
    emitQuestion();
  }
}

io.on("connection", (socket) => {
  socket.emit("state", stateForNewClient());

  socket.on("join", (name) => {
    const clean = String(name || "").trim().slice(0, 30) || "Anonymous";
    const reconnectId =
      phase !== "lobby"
        ? Object.keys(players).find((sid) => sid !== socket.id && players[sid].name.toLowerCase() === clean.toLowerCase())
        : null;
    if (reconnectId) {
      // mid-game reload: carry over the existing score/answers instead of starting over
      players[socket.id] = players[reconnectId];
      delete players[reconnectId];
    } else {
      players[socket.id] = { name: clean, totalScore: 0, answers: {} };
    }
    io.emit("players-update", playerNames());
    socket.emit("state", stateForNewClient());
  });

  socket.on("answer", (choiceIndex) => {
    const p = players[socket.id];
    if (!p || phase !== "question") return;
    const answeredAt = Date.now();
    if (answeredAt > questionDeadline + 500) return; // grace period for network latency
    if (p.answers[questionIndex] !== undefined) return;
    const correct = choiceIndex === questions[questionIndex].correct;
    const points = scoreAnswer(correct, answeredAt);
    p.answers[questionIndex] = { choice: choiceIndex, correct, points, answeredAt };
    p.totalScore = (p.totalScore || 0) + points;
    socket.emit("answer-ack", { correct, points });
  });

  socket.on("host-start", () => {
    if (phase !== "lobby") return;
    questionIndex = 0;
    lastRanking = [];
    emitQuestion();
  });

  socket.on("host-next", () => {
    if (phase === "question") revealCurrent();
    else if (phase === "reveal") nextQuestionOrFinal();
  });

  socket.on("host-reset", () => {
    clearTimeout(advanceTimer);
    phase = "lobby";
    questionIndex = -1;
    questionDeadline = 0;
    lastRanking = [];
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
