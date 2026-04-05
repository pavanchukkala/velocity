import { useEffect, useRef, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { motion } from 'motion/react';
import { Maximize2, Minimize2 } from 'lucide-react';
import type { Role, RoomMode, RemotePlayer, WinResult, Obstacle } from '../../types';
import { makeInitialGameState, tick, dropAttack, useAbility, receiveObstacle, receiveAbility, markRemotePlayerEliminated, triggerOnlineGameOver } from '../../utils/engine';
import {
  clearCanvas, drawSpeedLines, drawParticles, drawTrails, drawObstacle,
  drawPowerUp, drawEscaper, drawBotEscaper, drawRemoteEscaper, drawRemoteAttacker,
  drawAttackerCursor, drawReticle, drawFloatingTexts, drawSpawnFlashes,
  drawGlitch,
} from '../../utils/renderer';
import { HUD } from '../HUD/HUD';
import { startAmbient } from '../../utils/audio';
import { VIRTUAL_W, VIRTUAL_H } from '../../constants';

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
  isFullscreen, onToggleFullscreen, score, level,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Stable callback refs — updated every render but never change identity
  // This prevents the game loop useEffect from restarting when parent re-renders
  const onGameOverRef    = useRef(onGameOver);
  const onScoreUpdateRef = useRef(onScoreUpdate);
  const onLevelUpdateRef = useRef(onLevelUpdate);
  useEffect(() => { onGameOverRef.current    = onGameOver;    });
  useEffect(() => { onScoreUpdateRef.current = onScoreUpdate; });
  useEffect(() => { onLevelUpdateRef.current = onLevelUpdate; });

  // ── All mutable game state lives here — NEVER in React state inside the loop
  const gRef = useRef(
    makeInitialGameState(
      dimensions.width, dimensions.height,
      role, mode,
      0, // bots count (determined inside engine per mode)
      playerName
    )
  );

  // ── HUD display state (updated via callbacks, not read inside loop)
  const hudRef = useRef({
    score: 0,
    level: 1,
    combo: 0,
    multiplier: 1,
    energy: 20,
    timerSeconds: role === 'ATTACKER' ? 60 : 90,
    shieldActive: false,
    fireActive: false,
    hideActive: false,
    slowActive: false,
    magnetActive: false,
    timeStopActive: false,
    boostActive: false,
    // Timer countdowns (frames remaining) for each power-up
    shieldTimer: 0,
    fireTimer: 0,
    hideTimer: 0,
    slowTimer: 0,
    magnetTimer: 0,
    timeStopTimer: 0,
    boostTimer: 0,
  });

  // ── Keep remote players in sync with g without re-creating the game ─────
  useEffect(() => {
    gRef.current.remotePlayers = remotePlayers.map(p => ({ ...p }));
  }, [remotePlayers]);

  // ── Dimensions change: update player position ──────────────────────────
  useEffect(() => {
    const g = gRef.current;
    g.playerY = dimensions.height - 80;
    if (g.bots.length > 0) {
      g.bots.forEach(b => { b.y = dimensions.height - 80; });
    }
  }, [dimensions]);

  // ── Canvas scale helper (virtual → actual) ────────────────────────────
  const getScale = useCallback(() => ({
    sx: dimensions.width  / VIRTUAL_W,
    sy: dimensions.height / VIRTUAL_H,
  }), [dimensions]);

  // ── Input: keyboard ───────────────────────────────────────────────────
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      gRef.current.keys[e.key] = true;
      // Prevent arrow scroll
      if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key)) {
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => { gRef.current.keys[e.key] = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  // ── Input: touch & mouse ──────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const getCanvasX = (clientX: number) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = dimensions.width / rect.width;
      return (clientX - rect.left) * scaleX;
    };

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const x = getCanvasX(e.touches[0].clientX);
      if (role === 'ESCAPER') {
        gRef.current.touchX = x;
      } else {
        dropAttack(gRef.current, x, dimensions.width);
        if (socket) socket.emit('drop-attack', { roomId, x });
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (role === 'ESCAPER') {
        gRef.current.touchX = getCanvasX(e.touches[0].clientX);
      }
    };

    const onTouchEnd = () => {
      if (role === 'ESCAPER') gRef.current.touchX = null;
    };

    const onMouseDown = (e: MouseEvent) => {
      if (role === 'ATTACKER') {
        const x = getCanvasX(e.clientX);
        dropAttack(gRef.current, x, dimensions.width);
        if (socket) socket.emit('drop-attack', { roomId, x });
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (role === 'ESCAPER') {
        // Optional mouse control for escaper too
        // gRef.current.touchX = getCanvasX(e.clientX);
      }
    };

    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);

    return () => {
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
    };
  }, [role, dimensions.width, socket, roomId]);

  // ── Socket events during gameplay ─────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const onPlayerMoved = ({ id, x, y, vx, isShielded, isFiring, isHidden }: {
      id: string; x: number; y: number; vx: number;
      isShielded: boolean; isFiring: boolean; isHidden: boolean;
    }) => {
      const p = gRef.current.remotePlayers.find(r => r.id === id);
      if (p) { p.x = x; p.y = y; p.vx = vx; p.isShielded = isShielded; p.isFiring = isFiring; p.isHidden = isHidden; }
    };

    const onAttackDropped = ({ obstacle }: { obstacle: Obstacle }) => {
      receiveObstacle(gRef.current, obstacle);
    };

    const onAbilityUsed = ({ ability }: { ability: 'SWARM' | 'EMP' | 'FIREWALL' }) => {
      receiveAbility(gRef.current, ability, dimensions.width);
    };

    const onEscaperEliminated = ({ escaperId }: { escaperId: string }) => {
      markRemotePlayerEliminated(gRef.current, escaperId);
    };

    const onGameEnd = ({ result }: { result: WinResult }) => {
      triggerOnlineGameOver(gRef.current, result, {
        onScoreUpdate: onScoreUpdateRef.current,
        onLevelUpdate: onLevelUpdateRef.current,
        onComboUpdate: () => {},
        onEnergyUpdate: () => {},
        onTimerUpdate: () => {},
        onGameOver: (r, s) => onGameOverRef.current(r, s),
      });
    };

    socket.on('player-moved', onPlayerMoved);
    socket.on('attack-dropped', onAttackDropped);
    socket.on('ability-used', onAbilityUsed);
    socket.on('escaper-eliminated', onEscaperEliminated);
    socket.on('game-end', onGameEnd);

    return () => {
      socket.off('player-moved', onPlayerMoved);
      socket.off('attack-dropped', onAttackDropped);
      socket.off('ability-used', onAbilityUsed);
      socket.off('escaper-eliminated', onEscaperEliminated);
      socket.off('game-end', onGameEnd);
    };
  }, [socket, dimensions.width]); // callbacks removed — accessed via stable refs

  // ── Ability buttons (attacker) ────────────────────────────────────────
  const triggerAbility = useCallback((ability: 'SWARM' | 'EMP' | 'FIREWALL') => {
    const result = useAbility(gRef.current, ability, dimensions.width, dimensions.height, {
      onScoreUpdate: onScoreUpdateRef.current,
      onLevelUpdate: onLevelUpdateRef.current,
      onComboUpdate: () => {},
      onEnergyUpdate: (e) => { hudRef.current.energy = e; },
      onTimerUpdate: () => {},
      onGameOver: (r, s) => onGameOver(r, s),
    });
    if (result && socket) {
      socket.emit('use-ability', { roomId, ability });
    }
  }, [dimensions, socket, roomId]); // callbacks via refs — no longer in deps

  // ── Main game loop ────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    startAmbient();

    let rafId: number;

    const loop = () => {
      const g = gRef.current;
      const w = dimensions.width;
      const h = dimensions.height;

      // ── Logic tick ────────────────────────────────────────────────────
      tick(g, w, h, role, mode, {
        onScoreUpdate: (s) => {
          hudRef.current.score = s;
          onScoreUpdateRef.current(s);
          // Report score to server periodically
          if (g.frameCount % 120 === 0 && socket) {
            socket.emit('score-update', { roomId, score: s });
          }
        },
        onLevelUpdate: (l) => {
          hudRef.current.level = l;
          onLevelUpdateRef.current(l);
        },
        onComboUpdate: (c, m) => {
          hudRef.current.combo = c;
          hudRef.current.multiplier = m;
        },
        onEnergyUpdate: (e) => { hudRef.current.energy = e; },
        onTimerUpdate: (s) => { hudRef.current.timerSeconds = s; },
        onGameOver: (result, finalScore) => onGameOverRef.current(result, finalScore),
        emitMove: (x, y, vx, vy, states) => {
          if (socket && g.frameCount % 3 === 0) {
            socket.emit('player-move', { roomId, x, y, vx, vy, powerUpStates: states });
          }
        },
      });

      // ── Sync HUD powerup states ────────────────────────────────────────
      const pt = g.powerUpTimers;
      hudRef.current.shieldActive   = pt.shield > 0;
      hudRef.current.fireActive     = pt.fire > 0;
      hudRef.current.hideActive     = pt.hide > 0;
      hudRef.current.slowActive     = pt.slow > 0;
      hudRef.current.magnetActive   = pt.magnet > 0;
      hudRef.current.timeStopActive = pt.timeStop > 0;
      hudRef.current.boostActive    = pt.boost > 0;
      // Countdown frames (for HUD progress bars)
      hudRef.current.shieldTimer    = pt.shield;
      hudRef.current.fireTimer      = pt.fire;
      hudRef.current.hideTimer      = pt.hide;
      hudRef.current.slowTimer      = pt.slow;
      hudRef.current.magnetTimer    = pt.magnet;
      hudRef.current.timeStopTimer  = pt.timeStop;
      hudRef.current.boostTimer     = pt.boost;

      // ── Draw ──────────────────────────────────────────────────────────
      ctx.save();

      // Screen shake
      if (g.shake > 1) {
        ctx.translate(
          (Math.random() - 0.5) * g.shake,
          (Math.random() - 0.5) * g.shake
        );
      }

      // Clear with slight trail effect for speed blur
      ctx.fillStyle = 'rgba(5,5,5,0.92)';
      ctx.fillRect(0, 0, w, h);

      // Speed lines
      drawSpeedLines(ctx, g.speedLines);

      // Spawn flashes
      drawSpawnFlashes(ctx, g.spawns);

      // Trails
      drawTrails(ctx, g.trails);

      // Obstacles
      g.obstacles.forEach(obs => drawObstacle(ctx, obs, g.frameCount, pt.timeStop > 0));

      // Power-ups
      if (role === 'ESCAPER') {
        g.powerUps.forEach(pu => drawPowerUp(ctx, pu, g.frameCount));
      }

      // Particles
      drawParticles(ctx, g.particles);

      // Remote players
      g.remotePlayers.forEach(p => {
        if (p.role === 'ESCAPER') drawRemoteEscaper(ctx, p, g.frameCount);
        else drawRemoteAttacker(ctx, p, g.frameCount);
      });

      // Bot escapers (attacker mode)
      g.bots.forEach(bot => drawBotEscaper(ctx, bot, g.frameCount));

      // Local player (escaper)
      if (role === 'ESCAPER') {
        drawEscaper(ctx, g.playerX, g.playerY, g.playerColor, g.playerVx, g.frameCount, 'YOU', false, {
          isShielded:   pt.shield > 0,
          isFiring:     pt.fire > 0,
          isHidden:     pt.hide > 0,
          isSlowed:     pt.slow > 0,
          isMagnetized: pt.magnet > 0,
          isTimeStopped: pt.timeStop > 0,
          isBoosted:    pt.boost > 0,
        });
      }

      // Attacker cursor line
      if (role === 'ATTACKER') {
        drawAttackerCursor(ctx, g.playerX, g.frameCount);
        drawReticle(ctx, g.attackerReticle, g.frameCount);
      }

      // Floating texts
      drawFloatingTexts(ctx, g.floatingTexts);

      // Glitch overlay
      drawGlitch(ctx, canvas, g.glitchTimer, w, h);

      ctx.restore();

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [dimensions, role, mode, roomId, socket]); // callbacks accessed via stable refs — never restart loop on score updates

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        className="game-canvas absolute inset-0 w-full h-full"
        style={{ display: 'block' }}
      />

      {/* React HUD overlay */}
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
