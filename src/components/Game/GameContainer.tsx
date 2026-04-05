import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { nanoid } from 'nanoid';
import { Lobby } from '../Lobby/Lobby';
import { GameCanvas } from './GameCanvas';
import { GameOver } from '../UI/GameOver';
import { WaitingRoom } from '../UI/WaitingRoom';
import { Splash } from '../UI/Splash';
import type { GamePhase, Role, RoomMode, RemotePlayer, WinResult, LobbyState } from '../../types';
import { VIRTUAL_W, VIRTUAL_H } from '../../constants';
import { playSound, unlockAudio } from '../../utils/audio';

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? '';

export function NeonVelocity() {
  // ── Core game state (React) ────────────────────────────────────────────────
  const [phase, setPhase]         = useState<GamePhase>('SPLASH');
  const [role, setRole]           = useState<Role>('ESCAPER');
  const [mode, setMode]           = useState<RoomMode>('OFFLINE');
  const [roomId, setRoomId]       = useState('');
  const [players, setPlayers]     = useState<RemotePlayer[]>([]);
  const [score, setScore]         = useState(0);
  const [highScore, setHighScore] = useState(() => parseInt(localStorage.getItem('nv_highscore') ?? '0', 10));
  const [level, setLevel]         = useState(1);
  const [winResult, setWinResult] = useState<WinResult | null>(null);
  const [isFullscreen, setIsFullscreen]       = useState(false);
  const [isMatchmaking, setIsMatchmaking]     = useState(false);
  const [serverError, setServerError]         = useState<string | null>(null);
  const [localRoomData, setLocalRoomData]     = useState<{ escaperCode: string; attackerCode: string; roomId: string } | null>(null);

  // ── Lobby form state ───────────────────────────────────────────────────────
  const [lobbyState, setLobbyState] = useState<LobbyState>({
    name: 'Player ' + Math.floor(Math.random() * 9000 + 1000),
    role: 'ESCAPER',
    mode: 'OFFLINE',
    localCode: '',
    localRoomData: null,
  });

  // ── Dimensions ────────────────────────────────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: VIRTUAL_W, height: VIRTUAL_H });

  // ── Socket ref ────────────────────────────────────────────────────────────
  const socketRef = useRef<Socket | null>(null);

  // ── Resize handler ─────────────────────────────────────────────────────────
  useEffect(() => {
    const calc = () => {
      const el = containerRef.current;
      if (!el) return;
      setDimensions({ width: el.clientWidth, height: el.clientHeight });
    };
    calc();
    const ro = new ResizeObserver(calc);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // ── Socket setup (once) ────────────────────────────────────────────────────
  useEffect(() => {
    const socket = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
    });
    socketRef.current = socket;

    socket.on('connect', () => setServerError(null));
    socket.on('connect_error', () => setServerError('Cannot reach game server. Playing offline.'));

    socket.on('room-joined', ({ roomId: rid, role: r, players: ps }: {
      roomId: string; role: Role; players: RemotePlayer[];
    }) => {
      setRoomId(rid);
      setRole(r);
      setPlayers(ps);
      setPhase('WAITING_ROOM');
    });

    socket.on('room-update', ({ players: ps }: { players: RemotePlayer[]; gamePhase: string }) => {
      setPlayers(ps);
    });

    socket.on('match-found', ({ roomId: rid, role: r }: { roomId: string; role: Role }) => {
      setIsMatchmaking(false);
      setRoomId(rid);
      setRole(r);
      setPhase('WAITING_ROOM');
      playSound('start');
    });

    socket.on('local-room-created', (data: { roomId: string; escaperCode: string; attackerCode: string }) => {
      setLocalRoomData(data);
      setLobbyState(prev => ({ ...prev, localRoomData: data }));
    });

    socket.on('game-start', ({ roomId: rid }: { roomId: string }) => {
      setRoomId(rid);
      setPhase('PLAYING');
      playSound('start');
    });

    socket.on('game-end', ({ result, scores }: { result: WinResult; scores: Record<string, number> }) => {
      const myScore = scores[socket.id] ?? score;
      setScore(myScore);
      setWinResult(result);
      setPhase('GAMEOVER');
      if (myScore > highScore) {
        setHighScore(myScore);
        localStorage.setItem('nv_highscore', String(myScore));
      }
    });

    socket.on('error', ({ message }: { message: string }) => {
      setServerError(message);
    });

    return () => { socket.disconnect(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Offline solo start ─────────────────────────────────────────────────────
  const startOffline = useCallback((r: Role) => {
    unlockAudio();
    setRole(r);
    setMode('OFFLINE');
    socketRef.current?.emit('join-offline', { name: lobbyState.name, role: r });
  }, [lobbyState.name]);

  // ── Online matchmaking ─────────────────────────────────────────────────────
  const joinMatchmaking = useCallback((r: Role) => {
    unlockAudio();
    setRole(r);
    setMode('ONLINE');
    setIsMatchmaking(true);
    setPhase('MATCHMAKING');
    socketRef.current?.emit('join-matchmaking', { name: lobbyState.name, role: r });
  }, [lobbyState.name]);

  const cancelMatchmaking = useCallback(() => {
    setIsMatchmaking(false);
    setPhase('LOBBY');
    socketRef.current?.emit('cancel-matchmaking');
  }, []);

  // ── Local room ─────────────────────────────────────────────────────────────
  const createLocalRoom = useCallback((r: Role) => {
    unlockAudio();
    setRole(r);
    setMode('LOCAL');
    socketRef.current?.emit('create-local-room', { name: lobbyState.name, role: r });
  }, [lobbyState.name]);

  const joinLocalRoom = useCallback((code: string) => {
    unlockAudio();
    setMode('LOCAL');
    socketRef.current?.emit('join-local-room', { teamCode: code.trim().toUpperCase(), name: lobbyState.name });
  }, [lobbyState.name]);

  // ── Ready / start ──────────────────────────────────────────────────────────
  const sendReady = useCallback(() => {
    socketRef.current?.emit('player-ready', { roomId });
  }, [roomId]);

  // ── Game over (from canvas) ────────────────────────────────────────────────
  const handleCanvasGameOver = useCallback((result: WinResult, finalScore: number) => {
    setScore(finalScore);
    setWinResult(result);
    setPhase('GAMEOVER');
    if (finalScore > highScoreRef.current) {
      setHighScore(finalScore);
      highScoreRef.current = finalScore;
      localStorage.setItem('nv_highscore', String(finalScore));
    }
    // Report to server if online
    if (mode !== 'OFFLINE' && result === 'PLAYER_HIT') {
      socketRef.current?.emit('game-over-report', { roomId, escaperId: socketRef.current.id });
    }
  }, [mode, roomId]); // removed highScore dep — use ref instead

  // ── Restart ────────────────────────────────────────────────────────────────
  const restart = useCallback(() => {
    setScore(0);
    setLevel(1);
    setWinResult(null);
    if (mode === 'OFFLINE') {
      socketRef.current?.emit('join-offline', { name: lobbyState.name, role });
    } else {
      setPhase('LOBBY');
    }
  }, [mode, lobbyState.name, role]);

  const goLobby = useCallback(() => {
    setScore(0);
    setLevel(1);
    setWinResult(null);
    setLocalRoomData(null);
    setLobbyState(prev => ({ ...prev, localRoomData: null }));
    setPhase('LOBBY');
    if (roomId) socketRef.current?.emit('leave-room', { roomId });
  }, [roomId]);

  // ── Fullscreen ────────────────────────────────────────────────────────────
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // ── Score / level from canvas ──────────────────────────────────────────────
  const handleScoreUpdate = useCallback((s: number) => setScore(s), []);
  const handleLevelUpdate = useCallback((l: number) => setLevel(l), []);

  // Keep a ref copy of highScore so handleCanvasGameOver never needs it as a dep
  const highScoreRef = useRef(highScore);
  useEffect(() => { highScoreRef.current = highScore; }, [highScore]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className="relative w-full h-[100dvh] bg-[#050505] overflow-hidden select-none touch-none font-sans text-white"
    >
      {/* Background layers */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,rgba(0,242,255,0.04)_0%,transparent_70%)]" />
        <div className="cyber-grid absolute inset-0 opacity-30" />
        <div className="scanlines absolute inset-0 z-10" />
      </div>

      {/* ── Splash ── */}
      {phase === 'SPLASH' && (
        <Splash onEnter={() => { unlockAudio(); setPhase('LOBBY'); }} />
      )}

      {/* ── Lobby ── */}
      {phase === 'LOBBY' && (
        <Lobby
          lobbyState={lobbyState}
          setLobbyState={setLobbyState}
          onStartOffline={startOffline}
          onJoinMatchmaking={joinMatchmaking}
          onCreateLocalRoom={createLocalRoom}
          onJoinLocalRoom={joinLocalRoom}
          serverError={serverError}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
        />
      )}

      {/* ── Matchmaking spinner ── */}
      {phase === 'MATCHMAKING' && (
        <MatchmakingScreen
          role={lobbyState.role}
          onCancel={cancelMatchmaking}
        />
      )}

      {/* ── Waiting room ── */}
      {phase === 'WAITING_ROOM' && (
        <WaitingRoom
          players={players}
          role={role}
          mode={mode}
          roomId={roomId}
          localRoomData={localRoomData}
          onReady={sendReady}
          onLeave={goLobby}
        />
      )}

      {/* ── Game canvas ── */}
      {phase === 'PLAYING' && (
        <GameCanvas
          dimensions={dimensions}
          role={role}
          mode={mode}
          roomId={roomId}
          playerName={lobbyState.name}
          socket={socketRef.current}
          remotePlayers={players}
          onGameOver={handleCanvasGameOver}
          onScoreUpdate={handleScoreUpdate}
          onLevelUpdate={handleLevelUpdate}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
          score={score}
          level={level}
        />
      )}

      {/* ── Game over ── */}
      {phase === 'GAMEOVER' && (
        <GameOver
          score={score}
          highScore={highScore}
          level={level}
          role={role}
          winResult={winResult ?? 'PLAYER_HIT'}
          mode={mode}
          onRestart={restart}
          onLobby={goLobby}
        />
      )}
    </div>
  );
}

// ── Matchmaking screen ────────────────────────────────────────────────────────

function MatchmakingScreen({ role, onCancel }: { role: Role; onCancel: () => void }) {
  const [dots, setDots] = useState('.');
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const t1 = setInterval(() => setDots(d => d.length >= 3 ? '.' : d + '.'), 500);
    const t2 = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => { clearInterval(t1); clearInterval(t2); };
  }, []);

  return (
    <div className="absolute inset-0 modal-bg flex flex-col items-center justify-center gap-8 z-50">
      <div className="text-center">
        <div className="text-5xl mb-4">🔍</div>
        <h2 className="text-2xl font-black uppercase tracking-widest text-[#00f2ff] neon-cyan mb-2">
          Finding Match{dots}
        </h2>
        <p className="text-white/40 text-xs uppercase tracking-widest">
          Searching for {role === 'ESCAPER' ? '3 more escapers + 4 attackers' : '4 escapers + 3 more attackers'}
        </p>
        <p className="text-white/20 text-xs mt-2">{elapsed}s elapsed</p>
      </div>

      <div className="flex gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="w-3 h-3 rounded-full"
            style={{
              background: i < 4 ? '#00ff88' : '#ff0055',
              opacity: 0.3 + Math.sin(Date.now() / 300 + i) * 0.3,
              animation: `pulse 0.8s ease-in-out ${i * 0.1}s infinite`,
            }}
          />
        ))}
      </div>

      <p className="text-[10px] text-white/30 uppercase tracking-widest text-center px-8">
        Gaps will be filled with AI opponents if needed.
        <br />You can play in under 15 seconds.
      </p>

      <button
        onClick={onCancel}
        className="px-8 py-3 border border-white/20 text-white/50 text-xs uppercase tracking-widest hover:text-white hover:border-white/40 transition-all rounded-xl"
      >
        Cancel
      </button>
    </div>
  );
}
