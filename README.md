# ⚡ Neon Velocity: Cyber Escape

> A fast-paced cyberpunk multiplayer browser game — **Escapers vs Attackers**.  
> Free to play. No account. No download. Works on desktop and mobile.

---

## 🎮 Game Concept

| Team | Role | Goal |
|------|------|------|
| **Escaper** | Move side-to-side at the bottom | Survive falling attacks using power-ups & strategy |
| **Attacker** | Tap/click the screen | Drop attacks from the exact column tapped — top to bottom |

### Three Modes
| Mode | Description |
|------|-------------|
| **Offline** | Solo play. Escaper vs AI drops (difficulty scales). Attacker vs AI escaper (60s timer). |
| **Online** | 4 Escapers vs 4 Attackers. Algorithm matches players; AI fills gaps. 90s timer. |
| **Local** | Host creates a private room. Two codes generated (one per team). Friends join via code. |

---

## 🚀 Quick Start (Development)

```bash
git clone https://github.com/YOUR_USERNAME/neon-velocity.git
cd neon-velocity
npm install
cp .env.example .env
npm run dev          # starts server + vite dev proxy on :3000
```

Open `http://localhost:3000`

---

## 📦 Production Deployment

### Option A — All-in-one (Railway / Render / Fly.io)

Deploy the whole repo as a Node.js service. The Express server serves the Vite build and handles Socket.IO.

```
Build command:  npm run build
Start command:  npm run start
Port:           3000 (or $PORT)
```

### Option B — Split deployment (Recommended for scale)

**Frontend → Vercel**

1. Push to GitHub.
2. Import repo at vercel.com → Framework: **Vite**.
3. Build command: `npm run build`, Output: `dist`.
4. Add env var: `VITE_SERVER_URL=https://your-backend.railway.app`

**Backend → Railway**

1. New project → Deploy from GitHub.
2. Railway auto-detects `railway.toml`.
3. Set env var: `NODE_ENV=production`.
4. Copy the Railway deployment URL → paste into Vercel's `VITE_SERVER_URL`.

---

## 🔧 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `NODE_ENV` | `development` | `production` enables static serving |
| `VITE_SERVER_URL` | `` (same origin) | Socket.IO server URL for split deployment |

---

## 🗂 Project Structure

```
neon-velocity/
├── server/
│   └── index.ts              # Express + Socket.IO server (matchmaking, rooms, win conditions)
├── src/
│   ├── components/
│   │   ├── Game/
│   │   │   ├── GameContainer.tsx   # Root orchestrator, socket events
│   │   │   └── GameCanvas.tsx      # Canvas render loop + input
│   │   ├── HUD/
│   │   │   └── HUD.tsx             # In-game overlay (score, energy, power-ups)
│   │   ├── Lobby/
│   │   │   └── Lobby.tsx           # All 3 modes, role selection, room codes
│   │   └── UI/
│   │       ├── Splash.tsx          # Cinematic intro screen
│   │       ├── WaitingRoom.tsx     # Pre-game team lobby
│   │       └── GameOver.tsx        # Result screen
│   ├── constants/index.ts          # All tuning values in one place
│   ├── types/index.ts              # Full TypeScript definitions
│   ├── utils/
│   │   ├── engine.ts               # Pure game logic (no React)
│   │   ├── renderer.ts             # All canvas draw calls
│   │   └── audio.ts                # Web Audio API sound engine
│   └── styles/index.css            # Tailwind + animations + neon effects
├── vercel.json                     # Frontend deployment config
├── railway.toml                    # Backend deployment config
└── .env.example
```

---

## ✅ Bugs Fixed vs Original

| Original Bug | Fix |
|---|---|
| Stale closure bomb — `score/level/combo` always 0 inside game loop | All game state moved into a `useRef`; React state only for HUD display via 100ms polling |
| Matchmaking assigns everyone as ATTACKER | Role tracked per queue entry; spliced before iteration |
| Offline mode broken — needs room ID + Sync to play | `join-offline` event auto-creates room and starts game instantly |
| Start button always disabled (offline has no players) | Offline bypasses the waiting room entirely |
| No bot attackers in offline escaper mode | Dedicated bot-attacker spawn logic in engine |
| No win conditions for online mode | Server-authoritative 90s timer + "all escapers hit" detection |
| Power-up pickup uses wrong coordinates (attacker Y=50) | Pickup only runs for ESCAPER role using correct `playerX/Y` |
| `onGameOver(score)` uses stale React score | Engine passes `g.score` directly (lives in ref, never stale) |

---

## 🎨 Tech Stack

- **React 19** + **TypeScript** — UI
- **Vite 6** — bundler
- **Tailwind CSS v4** — styling
- **Motion (Framer)** — animations
- **Socket.IO 4** — real-time multiplayer
- **Web Audio API** — procedural SFX, no audio files needed
- **HTML Canvas** — game rendering at 60fps
- **Express** — server
