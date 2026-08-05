# Team Warm-Up — This or That

Live "this or that" icebreaker for ~30-35 people. Runs on your laptop; everyone joins over the same WiFi by scanning a QR code.

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
7. Click **Next Question** to advance — results update live on the big screen (and on each phone) as people answer.
8. After the last question, the host screen shows a few fun stats (most agreed-on question, closest split, "twins" who matched every answer, the free thinker).
9. Click **Play Again** to reset for next month.

## Customize the questions

Edit `questions.json` — each entry is `{ "prompt": "...", "options": ["A", "B"] }`. You can use more than 2 options per question if you want.

## If people aren't on the same WiFi (remote/hybrid meeting)

The QR code encodes your laptop's local network address, which only works on the same WiFi. For a remote setup you'd need to deploy this to a real host (e.g. Render, Railway, Fly.io) and set the `HOST_URL` environment variable to its public URL before running `npm start`. Ask if you'd like help with that.
