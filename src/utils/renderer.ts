/**
 * All canvas draw calls.
 *
 * PERFORMANCE RULES:
 * - ctx.shadowBlur is the most expensive canvas property.
 *   Set it ONCE before a batch, reset to 0 after. NEVER inside a forEach loop.
 * - ctx.save/restore has non-zero cost — avoid nesting unnecessarily.
 * - No getImageData / putImageData during gameplay (kills mobile).
 */

import { PLAYER_RADIUS, COLOR_ACCENT, COLOR_ATTACKER } from '../constants';
import type {
  Obstacle, PowerUp, BotState, RemotePlayer,
  AttackerReticle, TrailPoint, SpeedLine, Particle, FloatingText,
} from '../types';

// ── Speed lines ───────────────────────────────────────────────────────────────
export function drawSpeedLines(ctx: CanvasRenderingContext2D, lines: SpeedLine[]) {
  if (!lines.length) return;
  ctx.save();
  ctx.strokeStyle = COLOR_ACCENT;
  ctx.lineWidth   = 1;
  lines.forEach(line => {
    ctx.globalAlpha = line.opacity;
    ctx.beginPath();
    ctx.moveTo(line.x, line.y);
    ctx.lineTo(line.x, line.y + line.length);
    ctx.stroke();
  });
  ctx.globalAlpha = 1;
  ctx.restore();
}

// ── Particles — shadowBlur set ONCE, not per particle ────────────────────────
export function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[]) {
  if (!particles.length) return;
  ctx.save();
  ctx.shadowBlur = 5;                       // set once for the whole batch
  particles.forEach(p => {
    const alpha = p.life / p.maxLife;
    ctx.globalAlpha  = alpha;
    ctx.fillStyle    = p.color;
    ctx.shadowColor  = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(0.5, p.size * alpha), 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.shadowBlur  = 0;
  ctx.globalAlpha = 1;
  ctx.restore();
}

// ── Trails ────────────────────────────────────────────────────────────────────
export function drawTrails(ctx: CanvasRenderingContext2D, trails: TrailPoint[]) {
  if (!trails.length) return;
  ctx.save();
  trails.forEach(t => {
    ctx.globalAlpha = t.life * 0.3;
    ctx.fillStyle   = t.color;
    ctx.beginPath();
    ctx.arc(t.x, t.y, PLAYER_RADIUS * 0.45 * t.life, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
  ctx.restore();
}

// ── Obstacle ──────────────────────────────────────────────────────────────────
export function drawObstacle(
  ctx: CanvasRenderingContext2D,
  obs: Obstacle,
  frameCount: number,
  isFrozen: boolean,
) {
  const color = isFrozen ? '#9900ff' : obs.color;
  const cx    = obs.x + obs.width  / 2;
  const cy    = obs.y + obs.height / 2;

  ctx.save();
  ctx.translate(cx, cy);

  // Glow — one shadowBlur per obstacle
  ctx.shadowBlur  = 14;
  ctx.shadowColor = color;

  if (obs.type === 'BOSS') {
    ctx.fillStyle   = color;
    ctx.globalAlpha = 0.9;
    roundRect(ctx, -obs.width/2, -obs.height/2, obs.width, obs.height, 4);
    ctx.fill();
    // Warning text
    ctx.shadowBlur  = 0;
    ctx.globalAlpha = 0.55;
    ctx.fillStyle   = '#000';
    ctx.font        = `bold ${Math.min(obs.height * 0.65, 26)}px "JetBrains Mono"`;
    ctx.textAlign   = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚠ BREACH ⚠', 0, 0);

  } else if (obs.type === 'GATE') {
    ctx.fillStyle   = color;
    ctx.globalAlpha = 0.82;
    roundRect(ctx, -obs.width/2, -obs.height/2, obs.width, obs.height, 5);
    ctx.fill();
    // Hazard stripes
    ctx.globalAlpha = 0.22;
    ctx.fillStyle   = '#000';
    const sw = 22;
    for (let sx = -obs.width/2; sx < obs.width/2; sx += sw*2) {
      ctx.fillRect(sx, -obs.height/2, sw, obs.height);
    }

  } else {
    // Standard block
    ctx.fillStyle   = color;
    ctx.globalAlpha = 0.88;
    roundRect(ctx, -obs.width/2, -obs.height/2, obs.width, obs.height, 6);
    ctx.fill();
    // Corner brackets
    ctx.shadowBlur  = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth   = 1.5;
    ctx.globalAlpha = 0.5;
    drawCornerBrackets(ctx, obs.width/2 - 4, obs.height/2 - 4, 6);
  }

  ctx.shadowBlur  = 0;
  ctx.globalAlpha = 1;
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function drawCornerBrackets(ctx: CanvasRenderingContext2D, hw: number, hh: number, size: number) {
  ([[-hw,-hh,1,1],[hw,-hh,-1,1],[-hw,hh,1,-1],[hw,hh,-1,-1]] as const).forEach(([cx,cy,sx,sy]) => {
    ctx.beginPath();
    ctx.moveTo(cx, cy + sy*size);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx + sx*size, cy);
    ctx.stroke();
  });
}

// ── Power-up ──────────────────────────────────────────────────────────────────
const PU_COLORS: Record<string, string> = {
  SHIELD:'#00f2ff', BOOST:'#ff00ff', FIRE:'#ff6600', HIDE:'#ffffff',
  COIN:'#ffcc00', SLOW:'#00ffcc', MAGNET:'#ff3333', TIME_STOP:'#9900ff',
};
const PU_LABELS: Record<string, string> = {
  SHIELD:'S', BOOST:'▲', FIRE:'F', HIDE:'👁', COIN:'$', SLOW:'❄', MAGNET:'M', TIME_STOP:'⏸',
};

export function drawPowerUp(ctx: CanvasRenderingContext2D, pu: PowerUp, frameCount: number) {
  const color = PU_COLORS[pu.type] ?? '#fff';
  const pulse = 1 + Math.sin(frameCount * 0.1) * 0.1;
  const r     = pu.size * pulse;
  const rot   = frameCount * 0.04;

  ctx.save();
  ctx.translate(pu.x, pu.y);
  ctx.rotate(rot);

  // Soft glow halo — only one shadowBlur set here
  ctx.shadowBlur  = 18;
  ctx.shadowColor = color;

  // Hexagon
  ctx.fillStyle   = color + 'bb';
  ctx.strokeStyle = color;
  ctx.lineWidth   = 2;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3 - Math.PI / 6;
    if (i === 0) ctx.moveTo(Math.cos(a)*r, Math.sin(a)*r);
    else         ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Label
  ctx.shadowBlur   = 0;
  ctx.rotate(-rot);
  ctx.fillStyle    = '#fff';
  ctx.font         = `bold ${Math.round(r * 0.9)}px Arial`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(PU_LABELS[pu.type] ?? '?', 0, 0);

  ctx.restore();
}

// ── Escaper (local & remote) ──────────────────────────────────────────────────
// Design: a bright diamond core with a layered glow ring.
// Clean, immediately readable at any screen size.

interface PlayerPowerStates {
  isShielded: boolean; isFiring: boolean; isHidden: boolean;
  isSlowed: boolean; isMagnetized: boolean; isTimeStopped: boolean; isBoosted: boolean;
}

export function drawEscaper(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  color: string,
  vx: number,
  frameCount: number,
  name: string,
  isSpeaking: boolean,
  states: PlayerPowerStates,
) {
  const { isShielded, isFiring, isHidden, isSlowed, isMagnetized, isTimeStopped, isBoosted } = states;
  const pulse = 0.92 + Math.sin(frameCount * 0.09) * 0.08;
  const r     = PLAYER_RADIUS * pulse;
  const tilt  = Math.max(-0.4, Math.min(0.4, vx * 0.04));

  ctx.save();
  ctx.translate(x, y);
  if (isHidden) ctx.globalAlpha = 0.25;

  // ── Boost afterburn ──────────────────────────────────────────────────────
  if (isBoosted) {
    ctx.save();
    ctx.shadowBlur  = 30;
    ctx.shadowColor = '#ff00ff';
    ctx.strokeStyle = '#ff00ff44';
    ctx.lineWidth   = 3;
    ctx.beginPath(); ctx.arc(0, 0, r * 2.6, 0, Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, r * 3.4, 0, Math.PI*2); ctx.stroke();
    ctx.restore();
  }

  // ── Magnet rings ─────────────────────────────────────────────────────────
  if (isMagnetized) {
    ctx.save();
    ctx.strokeStyle = '#ff3333';
    ctx.lineWidth   = 1.5;
    ctx.shadowBlur  = 8;
    ctx.shadowColor = '#ff3333';
    for (let i = 0; i < 3; i++) {
      ctx.globalAlpha = isHidden ? 0.08 : (0.4 - i * 0.1);
      const mr = r * (2.1 + i * 0.7) + Math.sin(frameCount * 0.15 + i) * 4;
      ctx.beginPath(); ctx.arc(0, 0, mr, 0, Math.PI*2); ctx.stroke();
    }
    ctx.shadowBlur = 0;
    ctx.restore();
    if (isHidden) ctx.globalAlpha = 0.25;
  }

  // ── Shield ───────────────────────────────────────────────────────────────
  if (isShielded) {
    ctx.save();
    ctx.shadowBlur  = 22;
    ctx.shadowColor = '#00f2ff';
    ctx.strokeStyle = '#00f2ff';
    ctx.lineWidth   = 2.5;
    ctx.globalAlpha = isHidden ? 0.12 : (0.55 + Math.sin(frameCount * 0.1) * 0.2);
    ctx.beginPath(); ctx.arc(0, 0, r * 2.2, 0, Math.PI*2); ctx.stroke();
    // Hex facets
    ctx.lineWidth   = 1;
    ctx.globalAlpha = isHidden ? 0.06 : 0.2;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * r * 2.2, Math.sin(a) * r * 2.2);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    ctx.restore();
    if (isHidden) ctx.globalAlpha = 0.25;
  }

  // ── Fire aura ────────────────────────────────────────────────────────────
  if (isFiring) {
    ctx.save();
    ctx.shadowBlur  = 20;
    ctx.shadowColor = '#ff6600';
    const firePulse = r * 1.7 + Math.sin(frameCount * 0.3) * 4;
    const fg = ctx.createRadialGradient(0, 0, 0, 0, 0, firePulse);
    fg.addColorStop(0, '#ff6600cc');
    fg.addColorStop(0.5, '#ff330055');
    fg.addColorStop(1, 'transparent');
    ctx.fillStyle   = fg;
    ctx.globalAlpha = isHidden ? 0.08 : 0.75;
    ctx.beginPath(); ctx.arc(0, 0, firePulse, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
    if (isHidden) ctx.globalAlpha = 0.25;
  }

  // ── Slow / time-stop ring ─────────────────────────────────────────────────
  if (isSlowed || isTimeStopped) {
    ctx.save();
    ctx.strokeStyle = isTimeStopped ? '#9900ff' : '#00ffcc';
    ctx.lineWidth   = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.rotate(frameCount * 0.03);
    ctx.globalAlpha = 0.5;
    ctx.beginPath(); ctx.arc(0, 0, r * 2.3, 0, Math.PI*2); ctx.stroke();
    ctx.restore();
    if (isHidden) ctx.globalAlpha = 0.25;
  }

  // ── Core body — diamond shape with tilt ──────────────────────────────────
  ctx.rotate(tilt);
  ctx.save();

  ctx.shadowBlur  = 20 + pulse * 8;
  ctx.shadowColor = color;

  // Outer glow layer
  const outerGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.5);
  outerGrad.addColorStop(0, color + '55');
  outerGrad.addColorStop(1, 'transparent');
  ctx.fillStyle   = outerGrad;
  ctx.globalAlpha = isHidden ? 0.12 : 0.8;
  ctx.beginPath(); ctx.arc(0, 0, r * 1.5, 0, Math.PI*2); ctx.fill();

  // Diamond (rotated square)
  ctx.rotate(Math.PI / 4 + frameCount * 0.008); // slow spin
  ctx.fillStyle   = color;
  ctx.globalAlpha = isHidden ? 0.2 : 1;
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.lineTo(r * 0.7, 0);
  ctx.lineTo(0, r);
  ctx.lineTo(-r * 0.7, 0);
  ctx.closePath();
  ctx.fill();

  // Inner bright core
  ctx.fillStyle   = '#ffffff';
  ctx.globalAlpha = isHidden ? 0.1 : 0.75;
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.45);
  ctx.lineTo(r * 0.3, 0);
  ctx.lineTo(0, r * 0.45);
  ctx.lineTo(-r * 0.3, 0);
  ctx.closePath();
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.restore();

  // ── Speaking indicator ───────────────────────────────────────────────────
  if (isSpeaking) {
    ctx.save();
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth   = 3;
    ctx.shadowBlur  = 12;
    ctx.shadowColor = '#00ff88';
    ctx.globalAlpha = 0.8;
    ctx.beginPath(); ctx.arc(0, 0, r * 1.8, 0, Math.PI*2); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  ctx.restore(); // from translate(x,y)

  // ── Name tag ─────────────────────────────────────────────────────────────
  if (name) {
    ctx.save();
    ctx.globalAlpha  = isHidden ? 0.12 : 0.75;
    ctx.fillStyle    = '#fff';
    ctx.font         = 'bold 11px "JetBrains Mono"';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(name, x, y - PLAYER_RADIUS - 6);
    ctx.restore();
  }
}

// ── Bot escaper ───────────────────────────────────────────────────────────────
export function drawBotEscaper(ctx: CanvasRenderingContext2D, bot: BotState, frameCount: number) {
  if (bot.isDefeated) return;
  drawEscaper(ctx, bot.x, bot.y, bot.color, bot.vx, frameCount, bot.name, false, {
    isShielded:false,isFiring:false,isHidden:false,
    isSlowed:false,isMagnetized:false,isTimeStopped:false,isBoosted:false,
  });
}

// ── Remote escaper ────────────────────────────────────────────────────────────
export function drawRemoteEscaper(ctx: CanvasRenderingContext2D, p: RemotePlayer, frameCount: number) {
  if (p.isDefeated) return;
  drawEscaper(ctx, p.x, p.y, p.color, p.vx, frameCount, p.name, p.isSpeaking, {
    isShielded:p.isShielded,isFiring:p.isFiring,isHidden:p.isHidden,
    isSlowed:false,isMagnetized:false,isTimeStopped:false,isBoosted:false,
  });
}

// ── Remote attacker indicator (top of screen) ─────────────────────────────────
export function drawRemoteAttacker(ctx: CanvasRenderingContext2D, p: RemotePlayer, frameCount: number) {
  ctx.save();
  ctx.translate(p.x, 22);
  const pulse = Math.sin(frameCount * 0.1) * 3;
  ctx.shadowBlur  = 12;
  ctx.shadowColor = COLOR_ATTACKER;
  ctx.fillStyle   = COLOR_ATTACKER;
  ctx.beginPath();
  ctx.moveTo(0, 8 + pulse);
  ctx.lineTo(-11, -8);
  ctx.lineTo(11, -8);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur   = 0;
  ctx.fillStyle    = '#fff';
  ctx.globalAlpha  = 0.7;
  ctx.font         = 'bold 8px "JetBrains Mono"';
  ctx.textAlign    = 'center';
  ctx.fillText(p.name.slice(0, 4), 0, -12);
  ctx.restore();
}

// ── Attacker cursor (tap line) ────────────────────────────────────────────────
export function drawAttackerCursor(ctx: CanvasRenderingContext2D, x: number, frameCount: number) {
  ctx.save();
  ctx.translate(x, 0);

  const pulse = 0.4 + Math.sin(frameCount * 0.08) * 0.2;

  // Drop line
  ctx.setLineDash([6, 8]);
  ctx.strokeStyle = COLOR_ATTACKER;
  ctx.lineWidth   = 1.5;
  ctx.globalAlpha = pulse;
  ctx.shadowBlur  = 10;
  ctx.shadowColor = COLOR_ATTACKER;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 3000);
  ctx.stroke();
  ctx.setLineDash([]);

  // Arrowhead
  const ay = 14 + Math.sin(frameCount * 0.1) * 4;
  ctx.globalAlpha = 0.9;
  ctx.fillStyle   = COLOR_ATTACKER;
  ctx.beginPath();
  ctx.moveTo(0, ay);
  ctx.lineTo(-10, ay - 14);
  ctx.lineTo(10,  ay - 14);
  ctx.closePath();
  ctx.fill();

  ctx.shadowBlur  = 0;
  ctx.globalAlpha = 1;
  ctx.restore();
}

// ── Target reticle ────────────────────────────────────────────────────────────
export function drawReticle(ctx: CanvasRenderingContext2D, reticle: AttackerReticle, frameCount: number) {
  ctx.save();
  ctx.translate(reticle.x, reticle.y);

  const progress = reticle.lockProgress;
  const r        = 42 + Math.sin(frameCount * 0.1) * 3;
  const color    = progress >= 1 ? '#ff0055' : COLOR_ACCENT;
  const rot      = frameCount * 0.04;

  ctx.strokeStyle = color;
  ctx.lineWidth   = 2;
  ctx.shadowBlur  = 12;
  ctx.shadowColor = color;

  // Rotating brackets
  ctx.save();
  ctx.rotate(rot);
  const bs = r * 0.42;
  for (let i = 0; i < 4; i++) {
    ctx.save();
    ctx.rotate((i * Math.PI) / 2);
    ctx.beginPath();
    ctx.moveTo(r, -bs); ctx.lineTo(r, -r); ctx.lineTo(r - bs, -r);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();

  // Progress arc
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.72, -Math.PI/2, -Math.PI/2 + Math.PI * 2 * progress);
  ctx.stroke();

  // Crosshair
  ctx.beginPath();
  ctx.moveTo(-11,0); ctx.lineTo(11,0);
  ctx.moveTo(0,-11); ctx.lineTo(0,11);
  ctx.stroke();

  if (progress >= 1) {
    ctx.shadowBlur = 8;
    ctx.fillStyle  = color;
    ctx.font       = 'bold 9px "JetBrains Mono"';
    ctx.textAlign  = 'center';
    ctx.fillText('LOCK', 0, r + 15);
  }

  ctx.shadowBlur = 0;
  ctx.restore();
}

// ── Floating texts ────────────────────────────────────────────────────────────
export function drawFloatingTexts(ctx: CanvasRenderingContext2D, texts: FloatingText[]) {
  if (!texts.length) return;
  ctx.save();
  ctx.shadowBlur = 10;
  texts.forEach(t => {
    ctx.globalAlpha  = t.life / t.maxLife;
    ctx.fillStyle    = t.color;
    ctx.shadowColor  = t.color;
    ctx.font         = `bold ${t.size}px "JetBrains Mono"`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t.text, t.x, t.y);
  });
  ctx.shadowBlur  = 0;
  ctx.globalAlpha = 1;
  ctx.restore();
}

// ── Spawn flashes ─────────────────────────────────────────────────────────────
export function drawSpawnFlashes(
  ctx: CanvasRenderingContext2D,
  spawns: { x: number; y: number; life: number; color: string }[],
) {
  if (!spawns.length) return;
  ctx.save();
  ctx.shadowBlur = 18;
  spawns.forEach(s => {
    ctx.globalAlpha = s.life;
    ctx.strokeStyle = s.color;
    ctx.shadowColor = s.color;
    ctx.lineWidth   = 2;
    const r = (1 - s.life) * 35 + 8;
    ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, Math.PI * 2); ctx.stroke();
  });
  ctx.shadowBlur  = 0;
  ctx.globalAlpha = 1;
  ctx.restore();
}

// ── Glitch overlay — no getImageData/putImageData ─────────────────────────────
export function drawGlitch(
  ctx: CanvasRenderingContext2D,
  _canvas: HTMLCanvasElement,
  glitchTimer: number,
  w: number, h: number,
) {
  if (glitchTimer <= 0) return;
  ctx.save();
  if (Math.random() > 0.5) {
    ctx.globalAlpha = Math.random() * 0.18;
    ctx.fillStyle   = Math.random() > 0.5 ? '#00f2ff' : '#ff00ff';
    ctx.fillRect(0, Math.random() * h, w, 1 + Math.random() * 4);
  }
  ctx.restore();
}
