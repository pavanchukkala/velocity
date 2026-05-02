import { useEffect, useRef, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import type { Role, RoomMode, RemotePlayer, WinResult, Obstacle } from '../../types';
import {
  makeInitialGameState, tick, dropAttack, useAbility,
  receiveObstacle, receiveAbility, markRemotePlayerEliminated, triggerOnlineGameOver,
} from '../../utils/engine';
import {
  drawSpeedLines, drawParticles, drawTrails, drawObstacle,
  drawPowerUp, drawEscaper, drawBotEscaper, drawRemoteEscaper, drawRemoteAttacker,
  drawAttackerCursor, drawReticle, drawFloatingTexts, drawSpawnFlashes,
  drawGlitch,
} from '../../utils/renderer';
import { HUD } from '../HUD/HUD';
import { startAmbient } from '../../utils/audio';

interface Props {
  dimensions: { width: number; height: number };
  role: Role;
  mode: RoomMode;
  roomId: string;
  playerName: string;
  targetTeamSize: number;
  socket: Socket | null;
  remotePlayers: RemotePlayer[];
  isHost: boolean;
  onGameOver: (result: WinResult, score: number) => void;
  onScoreUpdate: (s: number) => void;
  onLevelUpdate: (l: number) => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  score: number;
  level: number;
}

export function GameCanvas({
  dimensions, role, mode, roomId, playerName, targetTeamSize,
  socket, remotePlayers, isHost, onGameOver, onScoreUpdate, onLevelUpdate,
  isFullscreen, onToggleFullscreen,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // ALL changing values stored in refs — loop reads refs, never closes over props
  const dimRef    = useRef(dimensions);
  const socketRef = useRef(socket);
  const roomIdRef = useRef(roomId);
  const cbRef     = useRef({ onGameOver, onScoreUpdate, onLevelUpdate });

  // Update refs on every render — zero cost, no useEffect needed
  dimRef.current    = dimensions;
  socketRef.current = socket;
  roomIdRef.current = roomId;
  cbRef.current     = { onGameOver, onScoreUpdate, onLevelUpdate };
  const isHostRef   = useRef(isHost);
  isHostRef.current = isHost;

  // Game state — created ONCE, never recreated
  const gRef = useRef(
    makeInitialGameState(dimensions.width, dimensions.height, role, mode, targetTeamSize, playerName)
  );

  // HUD ref — loop writes it, HUD React component polls it every 100ms
  const hudRef = useRef({
    score: 0, level: 1, combo: 0, multiplier: 1,
    energy: 20, timerSeconds: role === 'ATTACKER' ? 60 : 90,
    shieldActive: false, fireActive: false, hideActive: false,
    slowActive: false, magnetActive: false, timeStopActive: false, boostActive: false,
    shieldTimer: 0, fireTimer: 0, hideTimer: 0, slowTimer: 0,
    magnetTimer: 0, timeStopTimer: 0, boostTimer: 0,
  });

  // Sync remote players
  useEffect(() => {
    gRef.current.remotePlayers = remotePlayers.map(p => ({ ...p }));
  }, [remotePlayers]);

  // Sync canvas size when dimensions change — update game state but do NOT restart loop
  useEffect(() => {
    const g = gRef.current;
    g.playerY = dimensions.height - 80;
    g.bots.forEach(b => { b.y = dimensions.height - 80; });
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width  = dimensions.width;
      canvas.height = dimensions.height;
    }
  }, [dimensions]);

  // Keyboard — registered once
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      gRef.current.keys[e.key] = true;
      if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key))
        e.preventDefault();
    };
    const up = (e: KeyboardEvent) => { gRef.current.keys[e.key] = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  // Touch / mouse — registered once (role never changes mid-game)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const getXY = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (clientX - rect.left) * (dimRef.current.width / rect.width),
        y: (clientY - rect.top) * (dimRef.current.height / rect.height),
      };
    };

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const { x, y } = getXY(e.touches[0].clientX, e.touches[0].clientY);
      if (role === 'ESCAPER') {
        gRef.current.touchX = x;
        gRef.current.touchY = y;
      } else {
        dropAttack(gRef.current, x, dimRef.current.width);
        socketRef.current?.emit('drop-attack', { roomId: roomIdRef.current, x });
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (role === 'ESCAPER') {
        const { x, y } = getXY(e.touches[0].clientX, e.touches[0].clientY);
        gRef.current.touchX = x;
        gRef.current.touchY = y;
      }
    };
    const onTouchEnd = () => {
      if (role === 'ESCAPER') {
        gRef.current.touchX = null;
        gRef.current.touchY = null;
      }
    };
    const onMouseDown = (e: MouseEvent) => {
      if (role === 'ATTACKER') {
        const { x } = getXY(e.clientX, e.clientY);
        dropAttack(gRef.current, x, dimRef.current.width);
        socketRef.current?.emit('drop-attack', { roomId: roomIdRef.current, x });
      }
    };

    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove',  onTouchMove,  { passive: false });
    canvas.addEventListener('touchend',   onTouchEnd);
    canvas.addEventListener('mousedown',  onMouseDown);
    return () => {
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove',  onTouchMove);
      canvas.removeEventListener('touchend',   onTouchEnd);
      canvas.removeEventListener('mousedown',  onMouseDown);
    };
  }, [role]);

  // Socket — only re-register if socket instance changes
  useEffect(() => {
    if (!socket) return;

    const onPlayerMoved = ({ id, x, y, vx, isShielded, isFiring, isHidden }: {
      id: string; x: number; y: number; vx: number;
      isShielded: boolean; isFiring: boolean; isHidden: boolean;
    }) => {
      const p = gRef.current.remotePlayers.find(r => r.id === id);
      if (p) { p.x = x; p.y = y; p.vx = vx; p.isShielded = isShielded; p.isFiring = isFiring; p.isHidden = isHidden; }
    };

    const onAttackDropped = ({ obstacle }: { obstacle: Obstacle }) =>
      receiveObstacle(gRef.current, obstacle);

    const onAbilityUsed = ({ ability }: { ability: 'SWARM' | 'EMP' | 'FIREWALL' }) =>
      receiveAbility(gRef.current, ability, dimRef.current.width, dimRef.current.height);

    const onEscaperEliminated = ({ escaperId }: { escaperId: string }) =>
      markRemotePlayerEliminated(gRef.current, escaperId);

    const onGameEnd = ({ result }: { result: WinResult }) =>
      triggerOnlineGameOver(gRef.current, result, {
        onScoreUpdate: (s) => cbRef.current.onScoreUpdate(s),
        onLevelUpdate: (l) => cbRef.current.onLevelUpdate(l),
        onComboUpdate: () => {},
        onEnergyUpdate: () => {},
        onTimerUpdate: () => {},
        onGameOver: (r, s) => cbRef.current.onGameOver(r, s),
      });

    socket.on('player-moved',       onPlayerMoved);
    socket.on('attack-dropped',     onAttackDropped);
    socket.on('ability-used',       onAbilityUsed);
    socket.on('escaper-eliminated', onEscaperEliminated);
    socket.on('game-end',           onGameEnd);

    return () => {
      socket.off('player-moved',       onPlayerMoved);
      socket.off('attack-dropped',     onAttackDropped);
      socket.off('ability-used',       onAbilityUsed);
      socket.off('escaper-eliminated', onEscaperEliminated);
      socket.off('game-end',           onGameEnd);
    };
  }, [socket]);

  // Ability buttons (attacker HUD) — stable forever
  const triggerAbility = useCallback((ability: 'SWARM' | 'EMP' | 'FIREWALL') => {
    const result = useAbility(gRef.current, ability, dimRef.current.width, dimRef.current.height, {
      onScoreUpdate: (s) => cbRef.current.onScoreUpdate(s),
      onLevelUpdate: (l) => cbRef.current.onLevelUpdate(l),
      onComboUpdate: () => {},
      onEnergyUpdate: (e) => { hudRef.current.energy = e; },
      onTimerUpdate: () => {},
      onGameOver: (r, s) => cbRef.current.onGameOver(r, s),
    });
    if (result) socketRef.current?.emit('use-ability', { roomId: roomIdRef.current, ability });
  }, []);

  // THE GAME LOOP — empty deps = created ONCE, lives until component unmounts
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    startAmbient();

    // Throttle React state callbacks — onScoreUpdate/onLevelUpdate call setState in parent
    // which causes parent re-render. We only need this for the GameOver screen to show
    // final score. HUD reads hudRef directly so it doesn't need React state at all.
    let lastScoreNotify  = 0;
    let lastLevelNotify  = 0;

    let rafId: number;

    const loop = (timestamp: number) => {
      const g  = gRef.current;
      const w  = dimRef.current.width;
      const h  = dimRef.current.height;
      const pt = g.powerUpTimers;

      // Logic
      tick(g, w, h, role, mode, {
        onScoreUpdate: (s) => {
          hudRef.current.score = s;
          // Notify parent max 2x/sec — just enough for GameOver screen final score
          if (timestamp - lastScoreNotify > 500) {
            lastScoreNotify = timestamp;
            cbRef.current.onScoreUpdate(s);
          }
        },
        onLevelUpdate: (l) => {
          hudRef.current.level = l;
          if (timestamp - lastLevelNotify > 1000) {
            lastLevelNotify = timestamp;
            cbRef.current.onLevelUpdate(l);
          }
        },
        onComboUpdate: (c, m) => {
          hudRef.current.combo = c;
          hudRef.current.multiplier = m;
        },
        onEnergyUpdate: (e) => { hudRef.current.energy = e; },
        onTimerUpdate:  (s) => { hudRef.current.timerSeconds = s; },
        onGameOver: (result, finalScore) => {
          // Fire immediately with accurate final score
          hudRef.current.score = finalScore;
          cbRef.current.onScoreUpdate(finalScore);
          cbRef.current.onGameOver(result, finalScore);
        },
        emitMove: (x, y, vx, vy, states) => {
          if (g.frameCount % 3 === 0)
            socketRef.current?.emit('player-move', {
              roomId: roomIdRef.current, x, y, vx, vy, powerUpStates: states,
            });
        },
        emitBotMove: (botId, x, y, vx, vy) => {
          if (g.frameCount % 4 === 0 && isHostRef.current)
            socketRef.current?.emit('bot-move', {
              roomId: roomIdRef.current, botId, x, y, vx, vy,
            });
        },
        emitBotDrop: (botId, x) => {
          if (isHostRef.current)
            socketRef.current?.emit('bot-drop', {
              roomId: roomIdRef.current, botId, x,
            });
        },
      });

      // Sync HUD power-up state
      hudRef.current.shieldActive   = pt.shield    > 0;
      hudRef.current.fireActive     = pt.fire      > 0;
      hudRef.current.hideActive     = pt.hide      > 0;
      hudRef.current.slowActive     = pt.slow      > 0;
      hudRef.current.magnetActive   = pt.magnet    > 0;
      hudRef.current.timeStopActive = pt.timeStop  > 0;
      hudRef.current.boostActive    = pt.boost     > 0;
      hudRef.current.shieldTimer    = pt.shield;
      hudRef.current.fireTimer      = pt.fire;
      hudRef.current.hideTimer      = pt.hide;
      hudRef.current.slowTimer      = pt.slow;
      hudRef.current.magnetTimer    = pt.magnet;
      hudRef.current.timeStopTimer  = pt.timeStop;
      hudRef.current.boostTimer     = pt.boost;

      // Draw
      ctx.save();
      if (g.shake > 1)
        ctx.translate((Math.random() - 0.5) * g.shake, (Math.random() - 0.5) * g.shake);

      ctx.fillStyle = 'rgba(5,5,5,0.92)';
      ctx.fillRect(0, 0, w, h);

      drawSpeedLines(ctx, g.speedLines);
      drawSpawnFlashes(ctx, g.spawns);
      drawTrails(ctx, g.trails);
      g.obstacles.forEach(obs => drawObstacle(ctx, obs, g.frameCount, pt.timeStop > 0));
      if (role === 'ESCAPER') g.powerUps.forEach(pu => drawPowerUp(ctx, pu, g.frameCount));
      drawParticles(ctx, g.particles);
      g.remotePlayers.forEach(p => {
        // Filter out self to prevent ghost duplicate
        if (p.id === socketRef.current?.id) return;
        if (p.role === 'ESCAPER') drawRemoteEscaper(ctx, p, g.frameCount);
        else drawRemoteAttacker(ctx, p, g.frameCount);
      });
      g.bots.forEach(bot => drawBotEscaper(ctx, bot, g.frameCount));

      if (role === 'ESCAPER') {
        drawEscaper(ctx, g.playerX, g.playerY, g.playerColor, g.playerVx, g.frameCount, 'YOU', false, {
          isShielded: pt.shield > 0, isFiring: pt.fire > 0, isHidden: pt.hide > 0,
          isSlowed: pt.slow > 0, isMagnetized: pt.magnet > 0,
          isTimeStopped: pt.timeStop > 0, isBoosted: pt.boost > 0,
        }, g.isDefeated);
      }
      if (role === 'ATTACKER') {
        // Attacker view: no cursor line or reticle (removed — visual clutter)
      }

      drawFloatingTexts(ctx, g.floatingTexts);
      drawGlitch(ctx, canvas, g.glitchTimer, w, h);
      ctx.restore();

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, []); // EMPTY — loop never restarts. All runtime values via refs.

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        className="game-canvas absolute inset-0 w-full h-full"
        style={{ display: 'block' }}
      />
      <HUD
        hudRef={hudRef}
        role={role}
        mode={mode}
        onTriggerAbility={triggerAbility}
        isFullscreen={isFullscreen}
        onToggleFullscreen={onToggleFullscreen}
      />
    </div>
  );
}
