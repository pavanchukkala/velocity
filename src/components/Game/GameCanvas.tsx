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
  drawAttackerCursor, drawReticle, drawFloatingTexts, drawSpawnFlashes, drawGlitch,
} from '../../utils/renderer';
import { HUD } from '../HUD/HUD';
import { startAmbient } from '../../utils/audio';

interface Props {
  dimensions: { width: number; height: number };
  role: Role;
  mode: RoomMode;
  roomId: string;
  playerName: string;
  socket: Socket | null;
  remotePlayers: RemotePlayer[];
  onGameOver: (result: WinResult, score: number) => void;
  onScoreUpdate: (s: number) => void;
  onLevelUpdate: (l: number) => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  score: number;
  level: number;
}

export function GameCanvas({
  dimensions, role, mode, roomId, playerName,
  socket, remotePlayers, onGameOver, onScoreUpdate, onLevelUpdate,
  isFullscreen, onToggleFullscreen,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // ── Game state — lives in a ref, never stale, never triggers re-renders ──
  const gRef = useRef(
    makeInitialGameState(dimensions.width, dimensions.height, role, mode, 0, playerName)
  );

  // ── HUD state — polled every 100ms by HUD component ─────────────────────
  const hudRef = useRef({
    score: 0, level: 1, combo: 0, multiplier: 1,
    energy: 20, timerSeconds: role === 'ATTACKER' ? 60 : 90,
    shieldActive: false, fireActive: false, hideActive: false,
    slowActive: false, magnetActive: false, timeStopActive: false, boostActive: false,
  });

  // ── FREEZE FIX: Callback refs — loop reads .current, so it NEVER has ────
  // stale values AND the loop useEffect never needs to restart when these
  // callbacks change (e.g. when highScore updates and onGameOver recreates).
  const onGameOverRef  = useRef(onGameOver);
  const onScoreRef     = useRef(onScoreUpdate);
  const onLevelRef     = useRef(onLevelUpdate);
  const socketRef      = useRef(socket);
  const roomIdRef      = useRef(roomId);
  const dimensionsRef  = useRef(dimensions);
  const roleRef        = useRef(role);
  const modeRef        = useRef(mode);

  // Sync all refs on every render — effectively zero cost
  useEffect(() => { onGameOverRef.current  = onGameOver; },   [onGameOver]);
  useEffect(() => { onScoreRef.current     = onScoreUpdate; }, [onScoreUpdate]);
  useEffect(() => { onLevelRef.current     = onLevelUpdate; }, [onLevelUpdate]);
  useEffect(() => { socketRef.current      = socket; },       [socket]);
  useEffect(() => { roomIdRef.current      = roomId; },       [roomId]);
  useEffect(() => { dimensionsRef.current  = dimensions; },   [dimensions]);
  useEffect(() => { roleRef.current        = role; },         [role]);
  useEffect(() => { modeRef.current        = mode; },         [mode]);

  // ── GHOST DOT FIX: filter OWN socket ID from remotePlayers ──────────────
  // The server includes the current player in room-update. Without this
  // filter, the player renders twice — once as local + once as remote ghost.
  useEffect(() => {
    const myId = socket?.id;
    gRef.current.remotePlayers = remotePlayers
      .filter(p => p.id !== myId)
      .map(p => ({ ...p }));
  }, [remotePlayers, socket]);

  // ── Canvas dimensions → player Y ────────────────────────────────────────
  useEffect(() => {
    gRef.current.playerY = dimensions.height - 80;
    gRef.current.bots.forEach(b => { b.y = dimensions.height - 80; });
  }, [dimensions]);

  // ── Keyboard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const dn = (e: KeyboardEvent) => {
      gRef.current.keys[e.key] = true;
      if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key)) e.preventDefault();
    };
    const up = (e: KeyboardEvent) => { gRef.current.keys[e.key] = false; };
    window.addEventListener('keydown', dn);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', dn); window.removeEventListener('keyup', up); };
  }, []); // empty — reads from gRef

  // ── Touch & mouse — empty deps, reads from refs ──────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const toX = (clientX: number) => {
      const rect = canvas.getBoundingClientRect();
      return (clientX - rect.left) * (dimensionsRef.current.width / rect.width);
    };

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const x = toX(e.touches[0].clientX);
      if (roleRef.current === 'ESCAPER') {
        gRef.current.touchX = x;
      } else {
        dropAttack(gRef.current, x, dimensionsRef.current.width);
        socketRef.current?.emit('drop-attack', { roomId: roomIdRef.current, x });
      }
    };
    const onTouchMove  = (e: TouchEvent) => {
      e.preventDefault();
      if (roleRef.current === 'ESCAPER') gRef.current.touchX = toX(e.touches[0].clientX);
    };
    const onTouchEnd   = () => { if (roleRef.current === 'ESCAPER') gRef.current.touchX = null; };
    const onMouseDown  = (e: MouseEvent) => {
      if (roleRef.current === 'ATTACKER') {
        const x = toX(e.clientX);
        dropAttack(gRef.current, x, dimensionsRef.current.width);
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
  }, []); // empty — reads from refs

  // ── Socket events ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const onPlayerMoved = ({ id, x, y, vx, isShielded, isFiring, isHidden }: {
      id: string; x: number; y: number; vx: number;
      isShielded: boolean; isFiring: boolean; isHidden: boolean;
    }) => {
      const p = gRef.current.remotePlayers.find(r => r.id === id);
      if (p) { p.x = x; p.y = y; p.vx = vx; p.isShielded = isShielded; p.isFiring = isFiring; p.isHidden = isHidden; }
    };
    const onAttackDropped     = ({ obstacle }: { obstacle: Obstacle }) => receiveObstacle(gRef.current, obstacle);
    const onAbilityUsed       = ({ ability }: { ability: 'SWARM'|'EMP'|'FIREWALL' }) =>
      receiveAbility(gRef.current, ability, dimensionsRef.current.width);
    const onEscaperEliminated = ({ escaperId }: { escaperId: string }) =>
      markRemotePlayerEliminated(gRef.current, escaperId);
    const onGameEnd = ({ result }: { result: WinResult }) =>
      triggerOnlineGameOver(gRef.current, result, {
        onScoreUpdate:  s => onScoreRef.current(s),
        onLevelUpdate:  l => onLevelRef.current(l),
        onComboUpdate:  () => {},
        onEnergyUpdate: () => {},
        onTimerUpdate:  () => {},
        onGameOver:     (r, s) => onGameOverRef.current(r, s),
      });

    socket.on('player-moved',         onPlayerMoved);
    socket.on('attack-dropped',       onAttackDropped);
    socket.on('ability-used',         onAbilityUsed);
    socket.on('escaper-eliminated',   onEscaperEliminated);
    socket.on('game-end',             onGameEnd);
    return () => {
      socket.off('player-moved',       onPlayerMoved);
      socket.off('attack-dropped',     onAttackDropped);
      socket.off('ability-used',       onAbilityUsed);
      socket.off('escaper-eliminated', onEscaperEliminated);
      socket.off('game-end',           onGameEnd);
    };
  }, [socket]);

  // ── Ability trigger ──────────────────────────────────────────────────────
  const triggerAbility = useCallback((ability: 'SWARM'|'EMP'|'FIREWALL') => {
    const result = useAbility(
      gRef.current, ability,
      dimensionsRef.current.width, dimensionsRef.current.height,
      {
        onScoreUpdate:  s => onScoreRef.current(s),
        onLevelUpdate:  l => onLevelRef.current(l),
        onComboUpdate:  () => {},
        onEnergyUpdate: e => { hudRef.current.energy = e; },
        onTimerUpdate:  () => {},
        onGameOver:     (r, s) => onGameOverRef.current(r, s),
      }
    );
    if (result) socketRef.current?.emit('use-ability', { roomId: roomIdRef.current, ability });
  }, []); // empty — reads from refs

  // ── MAIN LOOP — empty deps = runs once, NEVER restarts ──────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    startAmbient();
    let rafId: number;

    const loop = () => {
      const g   = gRef.current;
      const w   = dimensionsRef.current.width;
      const h   = dimensionsRef.current.height;
      const r   = roleRef.current;
      const m   = modeRef.current;
      const rid = roomIdRef.current;
      const skt = socketRef.current;
      const pt  = g.powerUpTimers;

      // ── Logic tick ──────────────────────────────────────────────────
      tick(g, w, h, r, m, {
        onScoreUpdate: s => {
          hudRef.current.score = s;
          onScoreRef.current(s);
          if (g.frameCount % 120 === 0 && skt)
            skt.emit('score-update', { roomId: rid, score: s });
        },
        onLevelUpdate:  l => { hudRef.current.level = l; onLevelRef.current(l); },
        onComboUpdate:  (c, mx) => { hudRef.current.combo = c; hudRef.current.multiplier = mx; },
        onEnergyUpdate: e => { hudRef.current.energy = e; },
        onTimerUpdate:  s => { hudRef.current.timerSeconds = s; },
        onGameOver:     (result, finalScore) => onGameOverRef.current(result, finalScore),
        emitMove: (x, y, vx, vy, states) => {
          if (skt && g.frameCount % 3 === 0)
            skt.emit('player-move', { roomId: rid, x, y, vx, vy, powerUpStates: states });
        },
      });

      // Sync HUD power-up booleans
      hudRef.current.shieldActive   = pt.shield   > 0;
      hudRef.current.fireActive     = pt.fire     > 0;
      hudRef.current.hideActive     = pt.hide     > 0;
      hudRef.current.slowActive     = pt.slow     > 0;
      hudRef.current.magnetActive   = pt.magnet   > 0;
      hudRef.current.timeStopActive = pt.timeStop > 0;
      hudRef.current.boostActive    = pt.boost    > 0;

      // Also pass power-up timer values for progress bars
      hudRef.current.shieldTimer   = pt.shield;
      hudRef.current.fireTimer     = pt.fire;
      hudRef.current.hideTimer     = pt.hide;
      hudRef.current.slowTimer     = pt.slow;
      hudRef.current.magnetTimer   = pt.magnet;
      hudRef.current.timeStopTimer = pt.timeStop;
      hudRef.current.boostTimer    = pt.boost;

      // ── Draw ────────────────────────────────────────────────────────
      ctx.save();
      if (g.shake > 1) ctx.translate((Math.random()-0.5)*g.shake, (Math.random()-0.5)*g.shake);

      ctx.fillStyle = 'rgba(5,5,5,0.88)';
      ctx.fillRect(0, 0, w, h);

      drawSpeedLines(ctx, g.speedLines);
      drawSpawnFlashes(ctx, g.spawns);
      drawTrails(ctx, g.trails);
      g.obstacles.forEach(obs => drawObstacle(ctx, obs, g.frameCount, pt.timeStop > 0));
      if (r === 'ESCAPER') g.powerUps.forEach(pu => drawPowerUp(ctx, pu, g.frameCount));
      drawParticles(ctx, g.particles);

      g.remotePlayers.forEach(p => {
        if (p.role === 'ESCAPER') drawRemoteEscaper(ctx, p, g.frameCount);
        else drawRemoteAttacker(ctx, p, g.frameCount);
      });

      g.bots.forEach(bot => drawBotEscaper(ctx, bot, g.frameCount));

      if (r === 'ESCAPER') {
        drawEscaper(ctx, g.playerX, g.playerY, g.playerColor, g.playerVx, g.frameCount, 'YOU', false, {
          isShielded:    pt.shield   > 0,
          isFiring:      pt.fire     > 0,
          isHidden:      pt.hide     > 0,
          isSlowed:      pt.slow     > 0,
          isMagnetized:  pt.magnet   > 0,
          isTimeStopped: pt.timeStop > 0,
          isBoosted:     pt.boost    > 0,
        });
      }

      if (r === 'ATTACKER') {
        drawAttackerCursor(ctx, g.playerX, g.frameCount);
        drawReticle(ctx, g.attackerReticle, g.frameCount);
      }

      drawFloatingTexts(ctx, g.floatingTexts);
      drawGlitch(ctx, canvas, g.glitchTimer, w, h);

      ctx.restore();
      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, []); // ← EMPTY: runs once, reads everything from refs. This is intentional.

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        className="game-canvas absolute inset-0 w-full h-full"
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
