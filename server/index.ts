import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import path from 'path';
import { nanoid } from 'nanoid';
import type { ServerRoom, ServerPlayer, WinResult } from '../src/types/index.js';
import {
  validateName, validateRole, validateCoordinates, validateVelocity,
  validateRoomId, validateTeamCode, validateAbility, validatePowerUpStates,
  checkRateLimit, cleanupRateLimits,
} from './validation.js';

const PORT = parseInt(process.env.PORT ?? '3000', 10);
const MATCH_DURATION_S = 90;
const TEAM_SIZE = 4;

// ── Bot name pool ─────────────────────────────────────────────────────────────

const BOT_NAMES = [
  'GHOST','WRAITH','CIPHER','NEXUS','VOLT','ECHO','FLUX','NOVA',
  'ROGUE','SPECTER','DRIFT','VIPER','AXON','BOLT','HAZE','KITE',
];

const BOT_COLORS = [
  '#ff6b6b','#ffd93d','#6bcb77','#4d96ff','#c77dff',
  '#ff9f1c','#2ec4b6','#e71d36',
];

function makeBotPlayer(role: 'ESCAPER' | 'ATTACKER', idx: number): ServerPlayer {
  return {
    id: `bot-${nanoid(6)}`,
    name: BOT_NAMES[idx % BOT_NAMES.length] ?? `BOT${idx}`,
    role,
    x: 400,
    y: 800,
    vx: 0,
    isBot: true,
    isMuted: true,
    isSpeaking: false,
    color: BOT_COLORS[idx % BOT_COLORS.length] ?? '#ffffff',
    isDefeated: false,
    isShielded: false,
    isFiring: false,
    isHidden: false,
  };
}

// ── Matchmaking queue ─────────────────────────────────────────────────────────

interface QueueEntry {
  socketId: string;
  name: string;
  role: 'ESCAPER' | 'ATTACKER';
  joinedAt: number;
}

const escaperQueue: QueueEntry[] = [];
const attackerQueue: QueueEntry[] = [];

// ── Room store ────────────────────────────────────────────────────────────────

const rooms = new Map<string, ServerRoom>();

// ── Player→room index ─────────────────────────────────────────────────────────

const playerRoom = new Map<string, string>();

// ── Helpers ───────────────────────────────────────────────────────────────────

function getRoomPlayers(room: ServerRoom): ServerPlayer[] {
  return Array.from(room.players.values());
}

function broadcastRoomUpdate(io: Server, room: ServerRoom) {
  io.to(room.id).emit('room-update', {
    players: getRoomPlayers(room),
    gamePhase: room.gamePhase,
  });
}

function getLiveEscapers(room: ServerRoom): ServerPlayer[] {
  return getRoomPlayers(room).filter(p => p.role === 'ESCAPER' && !p.isDefeated);
}

function endRoom(io: Server, room: ServerRoom, result: WinResult) {
  if (room.gamePhase === 'GAMEOVER') return;
  room.gamePhase = 'GAMEOVER';
  if (room.gameTimer) clearInterval(room.gameTimer);
  const scores: Record<string, number> = {};
  room.scores.forEach((v, k) => { scores[k] = v; });
  io.to(room.id).emit('game-end', { result, scores });
}

function tryMatchmaking(io: Server) {
  // Fill with bots if needed — allow match with just 1 real player per side
  // but wait up to 15 seconds for more
  const now = Date.now();

  const readyEscapers = escaperQueue.filter(e => (now - e.joinedAt) >= 0);
  const readyAttackers = attackerQueue.filter(e => (now - e.joinedAt) >= 0);

  // Determine how many real players we have
  const realEscapers = readyEscapers.length;
  const realAttackers = readyAttackers.length;

  // Need at least 1 real player from each side, or 1 total if they've waited 15s
  const anyWaited15s = [...readyEscapers, ...readyAttackers].some(e => (now - e.joinedAt) >= 15000);
  const canFill = (realEscapers >= 1 && realAttackers >= 1) || anyWaited15s;

  if (!canFill) return;

  const roomId = 'match-' + nanoid(6);
  const seed = Math.floor(Math.random() * 999999);

  const room: ServerRoom = {
    id: roomId,
    mode: 'ONLINE',
    players: new Map(),
    gamePhase: 'WAITING',
    seed,
    startTime: 0,
    remainingSeconds: MATCH_DURATION_S,
    scores: new Map(),
    eliminatedEscapers: new Set(),
  };

  // Take up to TEAM_SIZE real players per role
  const takenEscapers = escaperQueue.splice(0, Math.min(TEAM_SIZE, escaperQueue.length));
  const takenAttackers = attackerQueue.splice(0, Math.min(TEAM_SIZE, attackerQueue.length));

  let botEscIdx = 0;
  let botAtkIdx = 0;

  // Add real escapers
  takenEscapers.forEach(entry => {
    const pSocket = io.sockets.sockets.get(entry.socketId);
    if (!pSocket) return;
    const p: ServerPlayer = {
      id: entry.socketId,
      name: entry.name,
      role: 'ESCAPER',
      x: 400, y: 800, vx: 0,
      isBot: false, isMuted: false, isSpeaking: false,
      color: BOT_COLORS[botEscIdx % BOT_COLORS.length],
      isDefeated: false, isShielded: false, isFiring: false, isHidden: false,
    };
    room.players.set(entry.socketId, p);
    room.scores.set(entry.socketId, 0);
    playerRoom.set(entry.socketId, roomId);
    pSocket.join(roomId);
    botEscIdx++;
  });

  // Fill escaper slots with bots
  while (room.players.size < TEAM_SIZE || [...room.players.values()].filter(p => p.role === 'ESCAPER').length < TEAM_SIZE) {
    const escaperCount = [...room.players.values()].filter(p => p.role === 'ESCAPER').length;
    if (escaperCount >= TEAM_SIZE) break;
    const bot = makeBotPlayer('ESCAPER', botEscIdx++);
    room.players.set(bot.id, bot);
  }

  // Add real attackers
  takenAttackers.forEach(entry => {
    const pSocket = io.sockets.sockets.get(entry.socketId);
    if (!pSocket) return;
    const p: ServerPlayer = {
      id: entry.socketId,
      name: entry.name,
      role: 'ATTACKER',
      x: 400, y: 50, vx: 0,
      isBot: false, isMuted: false, isSpeaking: false,
      color: BOT_COLORS[botAtkIdx % BOT_COLORS.length],
      isDefeated: false, isShielded: false, isFiring: false, isHidden: false,
    };
    room.players.set(entry.socketId, p);
    room.scores.set(entry.socketId, 0);
    playerRoom.set(entry.socketId, roomId);
    pSocket.join(roomId);
    botAtkIdx++;
  });

  // Fill attacker slots with bots
  while ([...room.players.values()].filter(p => p.role === 'ATTACKER').length < TEAM_SIZE) {
    const bot = makeBotPlayer('ATTACKER', botAtkIdx++);
    room.players.set(bot.id, bot);
  }

  rooms.set(roomId, room);

  // Notify each real player their match was found, with their assigned role
  takenEscapers.forEach(entry => {
    const s = io.sockets.sockets.get(entry.socketId);
    s?.emit('match-found', { roomId, role: 'ESCAPER' });
  });
  takenAttackers.forEach(entry => {
    const s = io.sockets.sockets.get(entry.socketId);
    s?.emit('match-found', { roomId, role: 'ATTACKER' });
  });

  broadcastRoomUpdate(io, room);
}

// ── Server bootstrap ──────────────────────────────────────────────────────────

async function main() {
  const app = express();
  const httpServer = createServer(app);

  const io = new Server(httpServer, {
    cors: {
      origin: process.env.ALLOWED_ORIGINS?.split(',') ?? [
        'http://localhost:3000',
        'http://localhost:5173',
        'https://velocity-coral-rho.vercel.app',
      ],
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 30000,
    pingInterval: 10000,
  });

  // ── Static files in production ─────────────────────────────────────────────
  if (process.env.NODE_ENV === 'production') {
    const dist = path.join(process.cwd(), 'dist');
    app.use(express.static(dist));
    app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  } else {
    // In dev, Vite handles the frontend
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  }

  // ── Socket.IO events ───────────────────────────────────────────────────────
  io.on('connection', (socket: Socket) => {
    console.log('[+]', socket.id);

    // ── Offline room ────────────────────────────────────────────────────────
    socket.on('join-offline', (data: { name: string; role: 'ESCAPER' | 'ATTACKER' }) => {
      if (!checkRateLimit(socket.id, 'join-offline', 2)) return;
      const name = validateName(data?.name);
      const role = validateRole(data?.role);
      const roomId = 'offline-' + socket.id;
      const room: ServerRoom = {
        id: roomId,
        mode: 'OFFLINE',
        players: new Map(),
        gamePhase: 'PLAYING', // starts immediately
        seed: Math.floor(Math.random() * 999999),
        startTime: Date.now(),
        remainingSeconds: role === 'ATTACKER' ? 60 : 0,
        scores: new Map(),
        eliminatedEscapers: new Set(),
      };
      const p: ServerPlayer = {
        id: socket.id, name, role,
        x: 400, y: 800, vx: 0,
        isBot: false, isMuted: false, isSpeaking: false,
        color: '#00ff88', isDefeated: false, isShielded: false, isFiring: false, isHidden: false,
      };
      room.players.set(socket.id, p);
      room.scores.set(socket.id, 0);
      rooms.set(roomId, room);
      playerRoom.set(socket.id, roomId);
      socket.join(roomId);
      socket.emit('room-joined', { roomId, role, players: getRoomPlayers(room) });
      socket.emit('game-start', { roomId, seed: room.seed });
    });

    // ── Matchmaking ─────────────────────────────────────────────────────────
    socket.on('join-matchmaking', (data: { name: string; role: 'ESCAPER' | 'ATTACKER' }) => {
      if (!checkRateLimit(socket.id, 'join-matchmaking', 2)) return;
      const name = validateName(data?.name);
      const role = validateRole(data?.role);
      // Remove any existing entry for this socket
      const escIdx = escaperQueue.findIndex(e => e.socketId === socket.id);
      if (escIdx !== -1) escaperQueue.splice(escIdx, 1);
      const atkIdx = attackerQueue.findIndex(e => e.socketId === socket.id);
      if (atkIdx !== -1) attackerQueue.splice(atkIdx, 1);

      const entry: QueueEntry = { socketId: socket.id, name, role, joinedAt: Date.now() };
      if (role === 'ESCAPER') escaperQueue.push(entry);
      else attackerQueue.push(entry);

      tryMatchmaking(io);
    });

    socket.on('cancel-matchmaking', () => {
      const escIdx = escaperQueue.findIndex(e => e.socketId === socket.id);
      if (escIdx !== -1) escaperQueue.splice(escIdx, 1);
      const atkIdx = attackerQueue.findIndex(e => e.socketId === socket.id);
      if (atkIdx !== -1) attackerQueue.splice(atkIdx, 1);
    });

    // ── Local room creation ─────────────────────────────────────────────────
    socket.on('create-local-room', (data: { name: string; role: 'ESCAPER' | 'ATTACKER' }) => {
      if (!checkRateLimit(socket.id, 'create-local-room', 2)) return;
      const name = validateName(data?.name);
      const role = validateRole(data?.role);
      const roomId = 'local-' + nanoid(5);
      const escaperCode = 'ESC-' + nanoid(4).toUpperCase();
      const attackerCode = 'ATK-' + nanoid(4).toUpperCase();

      const room: ServerRoom = {
        id: roomId,
        mode: 'LOCAL',
        players: new Map(),
        gamePhase: 'WAITING',
        seed: Math.floor(Math.random() * 999999),
        startTime: 0,
        escaperCode,
        attackerCode,
        remainingSeconds: MATCH_DURATION_S,
        scores: new Map(),
        eliminatedEscapers: new Set(),
      };

      const creator: ServerPlayer = {
        id: socket.id, name, role,
        x: 400, y: role === 'ESCAPER' ? 800 : 50, vx: 0,
        isBot: false, isMuted: false, isSpeaking: false,
        color: role === 'ESCAPER' ? '#00ff88' : '#ff0055',
        isDefeated: false, isShielded: false, isFiring: false, isHidden: false,
      };
      room.players.set(socket.id, creator);
      room.scores.set(socket.id, 0);
      rooms.set(roomId, room);
      playerRoom.set(socket.id, roomId);
      socket.join(roomId);

      socket.emit('local-room-created', { roomId, escaperCode, attackerCode });
      socket.emit('room-joined', { roomId, role, players: getRoomPlayers(room) });
      broadcastRoomUpdate(io, room);
    });

    // ── Join local room via code ─────────────────────────────────────────────
    socket.on('join-local-room', (data: { teamCode: string; name: string }) => {
      if (!checkRateLimit(socket.id, 'join-local-room', 3)) return;
      const name = validateName(data?.name);
      const teamCode = validateTeamCode(data?.teamCode);
      if (!teamCode) {
        socket.emit('error', { message: 'Invalid team code format.' });
        return;
      }

      let foundRoom: ServerRoom | null = null;
      let role: 'ESCAPER' | 'ATTACKER' = 'ESCAPER';

      for (const [, room] of rooms) {
        if (room.mode !== 'LOCAL') continue;
        if (room.escaperCode === teamCode) { foundRoom = room; role = 'ESCAPER'; break; }
        if (room.attackerCode === teamCode) { foundRoom = room; role = 'ATTACKER'; break; }
      }

      if (!foundRoom) {
        socket.emit('error', { message: 'Invalid team code. Check with your room host.' });
        return;
      }

      if (foundRoom.gamePhase !== 'WAITING') {
        socket.emit('error', { message: 'That match has already started.' });
        return;
      }

      // Enforce max players per team
      const teamCount = getRoomPlayers(foundRoom).filter(p => p.role === role && !p.isBot).length;
      if (teamCount >= TEAM_SIZE) {
        socket.emit('error', { message: `Team ${role} is full.` });
        return;
      }

      const p: ServerPlayer = {
        id: socket.id, name, role,
        x: 400, y: role === 'ESCAPER' ? 800 : 50, vx: 0,
        isBot: false, isMuted: false, isSpeaking: false,
        color: BOT_COLORS[foundRoom.players.size % BOT_COLORS.length],
        isDefeated: false, isShielded: false, isFiring: false, isHidden: false,
      };
      foundRoom.players.set(socket.id, p);
      foundRoom.scores.set(socket.id, 0);
      playerRoom.set(socket.id, foundRoom.id);
      socket.join(foundRoom.id);

      socket.emit('room-joined', { roomId: foundRoom.id, role, players: getRoomPlayers(foundRoom) });
      broadcastRoomUpdate(io, foundRoom);
    });

    // ── Player ready / start ────────────────────────────────────────────────
    socket.on('player-ready', (data: { roomId: string }) => {
      if (!checkRateLimit(socket.id, 'player-ready', 2)) return;
      const roomId = validateRoomId(data?.roomId);
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room || room.gamePhase !== 'WAITING') return;

      // For local/online rooms, host can start whenever
      const p = room.players.get(socket.id);
      if (!p) return;

      room.gamePhase = 'PLAYING';
      room.startTime = Date.now();

      // Start server-side game timer (online/local only)
      if (room.mode !== 'OFFLINE') {
        room.gameTimer = setInterval(() => {
          room.remainingSeconds--;
          io.to(room.id).emit('timer-tick', { seconds: room.remainingSeconds });

          if (room.remainingSeconds <= 0) {
            clearInterval(room.gameTimer!);
            // If any escaper alive → escapers win
            const liveEscapers = getLiveEscapers(room);
            endRoom(io, room, liveEscapers.length > 0 ? 'ESCAPERS_WIN' : 'ATTACKERS_WIN');
          }
        }, 1000);
      }

      io.to(roomId).emit('game-start', { roomId, seed: room.seed });
    });

    // ── Player movement ─────────────────────────────────────────────────────
    socket.on('player-move', (data: {
      roomId: string;
      x: number; y: number; vx: number; vy: number;
      powerUpStates: { isShielded: boolean; isFiring: boolean; isHidden: boolean };
    }) => {
      // Rate limit: ~20 updates/second max
      if (!checkRateLimit(socket.id, 'player-move', 25)) return;
      const roomId = validateRoomId(data?.roomId);
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room || room.gamePhase !== 'PLAYING') return;
      const p = room.players.get(socket.id);
      if (!p) return;

      // Validate coordinates and velocity
      const coords = validateCoordinates(data?.x, data?.y, 1200, 1400);
      if (!coords) return;
      const vel = validateVelocity(data?.vx, data?.vy);
      if (!vel) return;
      const powerUpStates = validatePowerUpStates(data?.powerUpStates);

      p.x = coords.x; p.y = coords.y; p.vx = vel.vx;
      p.isShielded = powerUpStates.isShielded;
      p.isFiring   = powerUpStates.isFiring;
      p.isHidden   = powerUpStates.isHidden;

      // Broadcast to everyone else in room (not back to sender)
      socket.to(roomId).emit('player-moved', {
        id: socket.id, x: coords.x, y: coords.y, vx: vel.vx, vy: vel.vy,
        isShielded: p.isShielded, isFiring: p.isFiring, isHidden: p.isHidden,
      });
    });

    // ── Attacker drops obstacle ─────────────────────────────────────────────
    socket.on('drop-attack', (data: { roomId: string; x: number }) => {
      // Rate limit: max 10 drops per second
      if (!checkRateLimit(socket.id, 'drop-attack', 10)) return;
      const roomId = validateRoomId(data?.roomId);
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room || room.gamePhase !== 'PLAYING') return;
      const p = room.players.get(socket.id);
      if (!p || p.role !== 'ATTACKER') return;

      const x = typeof data?.x === 'number' && isFinite(data.x)
        ? Math.max(20, Math.min(data.x, 1200)) : 400;

      const obs = {
        id: nanoid(8),
        x: x - 20,
        y: -50,
        width: 40,
        height: 36,
        color: '#ff0055',
        type: 'BLOCK' as const,
        vx: 0,
        nearMissTriggered: false,
        spawnedBy: socket.id,
      };
      // Broadcast to all in room
      io.to(roomId).emit('attack-dropped', { obstacle: obs });
    });

    // ── Attacker uses ability ───────────────────────────────────────────────
    socket.on('use-ability', (data: { roomId: string; ability: 'SWARM' | 'EMP' | 'FIREWALL' }) => {
      if (!checkRateLimit(socket.id, 'use-ability', 3)) return;
      const roomId = validateRoomId(data?.roomId);
      if (!roomId) return;
      const ability = validateAbility(data?.ability);
      if (!ability) return;
      const room = rooms.get(roomId);
      if (!room || room.gamePhase !== 'PLAYING') return;
      const p = room.players.get(socket.id);
      if (!p || p.role !== 'ATTACKER') return;

      io.to(roomId).emit('ability-used', { ability, fromId: socket.id });
    });

    // ── Escaper eliminated ──────────────────────────────────────────────────
    socket.on('game-over-report', (data: { roomId: string; escaperId: string }) => {
      if (!checkRateLimit(socket.id, 'game-over-report', 5)) return;
      const roomId = validateRoomId(data?.roomId);
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room || room.gamePhase !== 'PLAYING') return;

      // Validate: escaperId must be a real player in this room
      const escaperId = typeof data?.escaperId === 'string' ? data.escaperId : null;
      if (!escaperId) return;

      // Authoritative elimination — mark the player
      const p = room.players.get(escaperId);
      if (p && p.role === 'ESCAPER' && !p.isDefeated) {
        p.isDefeated = true;
        room.eliminatedEscapers.add(escaperId);

        const liveEscapers = getLiveEscapers(room);
        io.to(roomId).emit('escaper-eliminated', {
          escaperId,
          remaining: liveEscapers.length,
        });

        if (liveEscapers.length === 0) {
          clearInterval(room.gameTimer!);
          endRoom(io, room, 'ATTACKERS_WIN');
        }
      }
    });

    // ── Score update ────────────────────────────────────────────────────────
    // NOTE: Client-submitted scores are logged but NOT trusted.
    // Server should calculate scores authoritatively in future phases.
    socket.on('score-update', (data: { roomId: string; score: number }) => {
      if (!checkRateLimit(socket.id, 'score-update', 3)) return;
      const roomId = validateRoomId(data?.roomId);
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room) return;
      const score = typeof data?.score === 'number' && isFinite(data.score)
        ? Math.max(0, Math.min(data.score, 999_999_999)) : 0;
      room.scores.set(socket.id, score);
    });

    // ── Voice chat ──────────────────────────────────────────────────────────
    socket.on('voice-signal', (data: { roomId: string; to: string; signal: unknown }) => {
      if (!checkRateLimit(socket.id, 'voice-signal', 30)) return;
      const roomId = validateRoomId(data?.roomId);
      if (!roomId) return;
      // Validate 'to' is in the same room
      const room = rooms.get(roomId);
      if (!room) return;
      const to = typeof data?.to === 'string' ? data.to : null;
      if (!to || !room.players.has(to)) return;
      io.to(to).emit('voice-signal', { from: socket.id, signal: data.signal });
    });

    socket.on('voice-state', (data: { roomId: string; isMuted: boolean; isSpeaking: boolean }) => {
      if (!checkRateLimit(socket.id, 'voice-state', 5)) return;
      const roomId = validateRoomId(data?.roomId);
      if (!roomId) return;
      const room = rooms.get(roomId);
      const p = room?.players.get(socket.id);
      if (p) {
        p.isMuted = data?.isMuted === true;
        p.isSpeaking = data?.isSpeaking === true;
        broadcastRoomUpdate(io, room!);
      }
    });

    // ── Leave room ──────────────────────────────────────────────────────────
    socket.on('leave-room', ({ roomId }: { roomId: string }) => {
      handleLeave(io, socket, roomId);
    });

    // ── Disconnect ──────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      console.log('[-]', socket.id);
      const roomId = playerRoom.get(socket.id);
      if (roomId) handleLeave(io, socket, roomId);

      // Remove from matchmaking queue
      const ei = escaperQueue.findIndex(e => e.socketId === socket.id);
      if (ei !== -1) escaperQueue.splice(ei, 1);
      const ai = attackerQueue.findIndex(e => e.socketId === socket.id);
      if (ai !== -1) attackerQueue.splice(ai, 1);

      // Cleanup rate limit entries
      cleanupRateLimits(socket.id);
    });
  });

  // ── Periodic matchmaking check (every 5s) ─────────────────────────────────
  setInterval(() => tryMatchmaking(io), 5000);

  // ── Room garbage collection (every 60s) ────────────────────────────────────
  setInterval(() => {
    const now = Date.now();
    for (const [id, room] of rooms) {
      const isStale = room.gamePhase === 'GAMEOVER' && (now - room.startTime > 300_000);
      const isEmpty = room.players.size === 0;
      const isAbandoned = room.startTime > 0 && (now - room.startTime > 600_000);
      if (isStale || isEmpty || isAbandoned) {
        if (room.gameTimer) clearInterval(room.gameTimer);
        rooms.delete(id);
        console.log(`[GC] Cleaned up room ${id}`);
      }
    }
  }, 60_000);

  // ── Start ──────────────────────────────────────────────────────────────────
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🎮 Neon Velocity server → http://localhost:${PORT}`);
  });
}

function handleLeave(io: Server, socket: Socket, roomId: string) {
  const room = rooms.get(roomId);
  if (!room) return;
  room.players.delete(socket.id);
  room.scores.delete(socket.id);
  playerRoom.delete(socket.id);
  socket.leave(roomId);

  if (room.players.size === 0) {
    clearInterval(room.gameTimer!);
    rooms.delete(roomId);
  } else {
    broadcastRoomUpdate(io, room);
    // If all real escapers left an active match
    if (room.gamePhase === 'PLAYING' && getLiveEscapers(room).filter(p => !p.isBot).length === 0) {
      endRoom(io, room, 'ATTACKERS_WIN');
    }
  }
}

main().catch(err => {
  console.error('Fatal server error:', err);
  process.exit(1);
});
