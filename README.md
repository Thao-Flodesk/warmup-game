# Team Warm-Up — Emoji Quiz

Live multiple-choice speed quiz for ~30-35 people. Runs on your laptop; everyone joins over the same WiFi by scanning a QR code, races to answer emoji-clue questions, and climbs a live leaderboard.

## Run it (day of the meeting)

1. Make sure your laptop is on the **same WiFi** as everyone joining (usually the office network).
2. Install dependencies once:
   ```bash
   npm install
   ```
3. Start the game:
   ```bash
   npm start
   ```
4. Open `http://localhost:3000` on your laptop and **project/share that screen** — this is the host view with the QR code.
5. Everyone scans the QR code, types their name, and waits.
6. Click **Start Game** on the host screen once people have joined.
7. Each question runs on its own: 10s to answer (no live counts shown — it's a real race), then 8s revealing the correct answer, explanation, and updated leaderboard. It all advances automatically — no clicking needed. Use **Skip ahead** if you want to move faster.
8. After the last question, the host screen shows the final leaderboard and crowns a champion.
9. Click **Play Again** to reset for next month.

## Scoring

Correct answers score **1,000 pts** if answered instantly, sliding down to **500 pts** right at the 10s buzzer — so speed matters, but a correct-but-slower answer is never worthless. Wrong answers score **0**.

## Customize the questions

Edit `questions.json` — each entry is `{ "emoji": "...", "options": ["A", "B", "C", "D"], "correct": 0-3, "explain": "..." }`.

## Running it from someone else's laptop

Any laptop can host — it just needs this project's files and Node.js installed, and it needs to be on the same WiFi as everyone joining. The QR code auto-detects whatever local network address that laptop has, so no config changes are needed.

## Deploying to the cloud (so any laptop/browser works, no Node install needed)

This app is deploy-ready for [Render](https://render.com)'s free web service tier — real WebSocket support, no credit card required. One caveat: free instances spin down after 15 minutes of inactivity, so **open the URL a minute or two before the meeting starts** to wake it up (cold start takes ~30-60s).

1. **Push this project to GitHub** (one-time setup):
   ```bash
   git remote add origin https://github.com/<your-username>/team-warmup-poll.git
   git branch -M main
   git push -u origin main
   ```
   (Create the empty repo first at [github.com/new](https://github.com/new) — don't initialize it with a README.)
2. **Sign up / log in at [render.com](https://render.com)** (free, GitHub login works).
3. Click **New +** → **Web Service**, connect the `team-warmup-poll` GitHub repo.
4. Confirm these settings (Render should auto-detect most of it):
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free
5. Click **Create Web Service**. Render gives you a public URL like `https://team-warmup-poll.onrender.com` — the app automatically uses this for the QR code once deployed (via Render's `RENDER_EXTERNAL_URL`, no config needed).
6. Anyone can now open that URL to host, and players can join over cellular data too, not just the same WiFi.

To update the deployed version later, just `git push` — Render redeploys automatically on every push to `main`.
