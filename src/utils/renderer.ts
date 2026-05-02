import {
  PLAYER_RADIUS,
  COLOR_ACCENT,
  COLOR_ESCAPER,
  COLOR_ATTACKER,
} from '../constants';
import type { Obstacle, PowerUp, BotState, RemotePlayer, AttackerReticle, TrailPoint, SpeedLine, Particle, FloatingText } from '../types';

function withAlpha(color: string, alpha: number): string {
  const a = Math.max(0, Math.min(1, alpha));

  if (color.startsWith('#')) {
    const hex = color.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      return `rgba(${r}, ${g}, ${b}, ${a})`;
    }
    if (hex.length === 6 || hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${a})`;
    }
  }

  if (color.startsWith('rgb(')) {
    return color.replace(/^rgb\((.+)\)$/, `rgba($1, ${a})`);
  }

  if (color.startsWith('hsl(')) {
    return color.replace(/^hsl\((.+)\)$/, `hsla($1, ${a})`);
  }

  return color;
}

// ── Canvas clear ──────────────────────────────────────────────────────────────

export function clearCanvas(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.clearRect(0, 0, w, h);
}

// ── Speed lines ───────────────────────────────────────────────────────────────

export function drawSpeedLines(ctx: CanvasRenderingContext2D, lines: SpeedLine[]) {
  ctx.save();
  lines.forEach(line => {
    ctx.globalAlpha = line.opacity;
    ctx.strokeStyle = COLOR_ACCENT;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(line.x, line.y);
    ctx.lineTo(line.x, line.y + line.length);
    ctx.stroke();
  });
  ctx.globalAlpha = 1;
  ctx.restore();
}

// ── Particles ─────────────────────────────────────────────────────────────────

export function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[]) {
  ctx.save();
  particles.forEach(p => {
    const alpha = p.life / p.maxLife;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.shadowBlur = 6;
    ctx.shadowColor = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
  ctx.restore();
}

// ── Trails ────────────────────────────────────────────────────────────────────

export function drawTrails(ctx: CanvasRenderingContext2D, trails: TrailPoint[]) {
  ctx.save();
  trails.forEach(t => {
    ctx.globalAlpha = t.life * 0.35;
    ctx.fillStyle = t.color;
    ctx.beginPath();
    ctx.arc(t.x, t.y, PLAYER_RADIUS * 0.5 * t.life, 0, Math.PI * 2);
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
  isFrozen: boolean
) {
  ctx.save();
  ctx.translate(obs.x + obs.width / 2, obs.y + obs.height / 2);
  // Apply obstacle rotation (enhanced physics)
  if (obs.rotation) ctx.rotate(obs.rotation);

  const pulse = Math.sin(frameCount * 0.08) * 0.15 + 0.85;
  const color = isFrozen ? '#9900ff' : obs.color;

  // Outer glow
  ctx.shadowBlur = 18 + pulse * 8;
  ctx.shadowColor = color;

  if (obs.type === 'GATE') {
    // Wide bar — slightly rounded
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.85;
    roundRect(ctx, -obs.width / 2, -obs.height / 2, obs.width, obs.height, 6);
    ctx.fill();

    // Hazard stripes
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#000';
    const stripeW = 24;
    for (let sx = -obs.width / 2; sx < obs.width / 2; sx += stripeW * 2) {
      ctx.fillRect(sx, -obs.height / 2, stripeW, obs.height);
    }

  } else if (obs.type === 'BOSS') {
    // Full-width boss bar
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.9;
    roundRect(ctx, -obs.width / 2, -obs.height / 2, obs.width, obs.height, 4);
    ctx.fill();

    // DANGER text
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = '#000';
    ctx.font = `bold ${Math.min(obs.height * 0.7, 28)}px "JetBrains Mono"`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚠ SYSTEM BREACH ⚠', 0, 0);

  } else {
    // Standard block
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.88;
    roundRect(ctx, -obs.width / 2, -obs.height / 2, obs.width, obs.height, 6);
    ctx.fill();

    // Corner accents
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    const r = 4;
    const hw = obs.width / 2 - r;
    const hh = obs.height / 2 - r;
    drawCornerBrackets(ctx, hw, hh, r + 4);
  }

  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawCornerBrackets(ctx: CanvasRenderingContext2D, hw: number, hh: number, size: number) {
  const corners = [
    [-hw, -hh, 1, 1],
    [hw, -hh, -1, 1],
    [-hw, hh, 1, -1],
    [hw, hh, -1, -1],
  ] as const;
  corners.forEach(([cx, cy, sx, sy]) => {
    ctx.beginPath();
    ctx.moveTo(cx, cy + sy * size);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx + sx * size, cy);
    ctx.stroke();
  });
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

// ── Power-up ──────────────────────────────────────────────────────────────────

const POWERUP_COLORS: Record<string, string> = {
  SHIELD:    '#00f2ff',
  BOOST:     '#ff00ff',
  FIRE:      '#ff6600',
  HIDE:      '#ffffff',
  COIN:      '#ffcc00',
  SLOW:      '#00ffcc',
  MAGNET:    '#ff3333',
  TIME_STOP: '#9900ff',
  RECALL:    '#00ff88',
};

const POWERUP_LABELS: Record<string, string> = {
  SHIELD: 'S', BOOST: '▲', FIRE: '🔥', HIDE: '👁',
  COIN: '$', SLOW: '❄', MAGNET: 'M', TIME_STOP: '⏸', RECALL: '➕',
};

export function drawPowerUp(ctx: CanvasRenderingContext2D, pu: PowerUp, frameCount: number) {
  ctx.save();
  ctx.translate(pu.x, pu.y);

  const color = POWERUP_COLORS[pu.type] ?? '#fff';
  const rot = frameCount * 0.04;
  const pulse = 1 + Math.sin(frameCount * 0.1) * 0.12;
  const r = pu.size * pulse;

  ctx.rotate(rot);

  // Glow halo
  const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.8);
  grd.addColorStop(0, withAlpha(color, 0.27));
  grd.addColorStop(1, 'transparent');
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.8, 0, Math.PI * 2);
  ctx.fill();

  // Hexagon body
  ctx.fillStyle = withAlpha(color, 0.8);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.shadowBlur = 20;
  ctx.shadowColor = color;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3 - Math.PI / 6;
    if (i === 0) ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
    else ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Label
  ctx.rotate(-rot);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${r * 0.9}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(POWERUP_LABELS[pu.type] ?? '?', 0, 0);

  ctx.restore();
}

// ── Escaper player ────────────────────────────────────────────────────────────

interface PlayerPowerStates {
  isShielded: boolean;
  isFiring: boolean;
  isHidden: boolean;
  isSlowed: boolean;
  isMagnetized: boolean;
  isTimeStopped: boolean;
  isBoosted: boolean;
  isExploding?: boolean;
  isSpectating?: boolean;
}

export function drawEscaper(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  vx: number,
  frameCount: number,
  name?: string,
  isSpeaking?: boolean,
  powers?: PlayerPowerStates,
  isDefeated?: boolean
) {
  const isHidden = powers?.isHidden ?? false;
  const isShielded = powers?.isShielded ?? false;
  const isFiring = powers?.isFiring ?? false;
  const isMagnetized = powers?.isMagnetized ?? false;
  const isTimeStopped = powers?.isTimeStopped ?? false;
  const isSlowed = powers?.isSlowed ?? false;
  const isBoosted = powers?.isBoosted ?? false;

  const baseAlpha = isHidden ? 0.3 : (isDefeated ? 0.15 : 1.0);
  const tilt = Math.max(-0.38, Math.min(0.38, vx * 0.035));
  const pulse = Math.sin(frameCount * 0.09) * 0.06 + 0.97;
  const S = PLAYER_RADIUS * pulse; // scale unit

  ctx.save();
  ctx.translate(x, y);
  
  if (isDefeated) {
    // Ghostly effect
    ctx.setLineDash([2, 4]);
  }
  ctx.globalAlpha = baseAlpha;

  // ── Engine exhaust / thrust flame (always on, behind ship) ──────────────
  const exhaustFlicker = 0.7 + Math.sin(frameCount * 0.35) * 0.3;
  const exhaustLen = S * (isBoosted ? 3.2 : 1.6) * exhaustFlicker;
  const exhaustGrad = ctx.createLinearGradient(0, S * 0.6, 0, S * 0.6 + exhaustLen);
  if (isBoosted) {
    exhaustGrad.addColorStop(0, '#ff00ffdd');
    exhaustGrad.addColorStop(0.4, '#ff00ff66');
    exhaustGrad.addColorStop(1, 'transparent');
  } else {
    exhaustGrad.addColorStop(0, withAlpha(color, 0.8));
    exhaustGrad.addColorStop(0.5, withAlpha(color, 0.33));
    exhaustGrad.addColorStop(1, 'transparent');
  }
  ctx.fillStyle = exhaustGrad;
  ctx.shadowBlur = isBoosted ? 28 : 14;
  ctx.shadowColor = isBoosted ? '#ff00ff' : color;
  // Left nozzle
  ctx.beginPath();
  ctx.moveTo(-S * 0.45, S * 0.55);
  ctx.lineTo(-S * 0.18, S * 0.55);
  ctx.lineTo(-S * 0.28, S * 0.55 + exhaustLen * 0.9);
  ctx.closePath();
  ctx.fill();
  // Right nozzle
  ctx.beginPath();
  ctx.moveTo(S * 0.18, S * 0.55);
  ctx.lineTo(S * 0.45, S * 0.55);
  ctx.lineTo(S * 0.28, S * 0.55 + exhaustLen * 0.9);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;

  // Apply tilt after drawing exhaust (so flame tilts with ship)
  ctx.rotate(tilt);

  // ── Boost outer corona ───────────────────────────────────────────────────
  if (isBoosted) {
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const br = S * (2.8 + i * 0.7) + Math.sin(frameCount * 0.2 + i) * 3;
      const bg = ctx.createRadialGradient(0, 0, 0, 0, 0, br);
      bg.addColorStop(0, '#ff00ff22');
      bg.addColorStop(0.6, '#ff00ff11');
      bg.addColorStop(1, 'transparent');
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(0, 0, br, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ── Magnet orbit rings ───────────────────────────────────────────────────
  if (isMagnetized) {
    ctx.save();
    ctx.strokeStyle = '#ff4444';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      const mr = S * (2.4 + i * 0.65) + Math.sin(frameCount * 0.14 + i * 1.2) * 4;
      ctx.globalAlpha = baseAlpha * (0.4 - i * 0.1);
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#ff4444';
      ctx.beginPath();
      ctx.arc(0, 0, mr, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ── Hex shield bubble ────────────────────────────────────────────────────
  if (isShielded) {
    ctx.save();
    const shieldPulse = 0.65 + Math.sin(frameCount * 0.12) * 0.2;
    ctx.globalAlpha = baseAlpha * shieldPulse;
    ctx.shadowBlur = 22;
    ctx.shadowColor = '#00f2ff';
    // Hex shield
    ctx.strokeStyle = '#00f2ff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 6;
      const hr = S * 2.4;
      if (i === 0) ctx.moveTo(Math.cos(a) * hr, Math.sin(a) * hr);
      else ctx.lineTo(Math.cos(a) * hr, Math.sin(a) * hr);
    }
    ctx.closePath();
    ctx.stroke();
    // Facet fill
    ctx.globalAlpha = baseAlpha * 0.08;
    ctx.fillStyle = '#00f2ff';
    ctx.fill();
    ctx.restore();
  }

  // ── Fire destruction aura ────────────────────────────────────────────────
  if (isFiring) {
    ctx.save();
    const flicker = Math.sin(frameCount * 0.28) * 0.15;
    const fg = ctx.createRadialGradient(0, 0, S * 0.3, 0, 0, S * 2.2 + flicker * S);
    fg.addColorStop(0, '#ffaa0099');
    fg.addColorStop(0.45, '#ff440066');
    fg.addColorStop(1, 'transparent');
    ctx.fillStyle = fg;
    ctx.globalAlpha = baseAlpha * 0.85;
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#ff6600';
    ctx.beginPath();
    ctx.arc(0, 0, S * 2.2 + flicker * S, 0, Math.PI * 2);
    ctx.fill();
    // Flame tendrils
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + frameCount * 0.07;
      const len = S * (1.4 + Math.sin(frameCount * 0.22 + i) * 0.4);
      ctx.globalAlpha = baseAlpha * 0.5;
      ctx.strokeStyle = '#ff6600';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * S * 0.9, Math.sin(a) * S * 0.9);
      ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ── Time stop / slow ring ────────────────────────────────────────────────
  if (isSlowed || isTimeStopped) {
    ctx.save();
    ctx.strokeStyle = isTimeStopped ? '#bb44ff' : '#00ffcc';
    ctx.shadowBlur = 10;
    ctx.shadowColor = isTimeStopped ? '#9900ff' : '#00ffcc';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.lineDashOffset = -(frameCount * (isTimeStopped ? 0.5 : 0.8));
    ctx.globalAlpha = baseAlpha * 0.7;
    ctx.beginPath();
    ctx.arc(0, 0, S * 2.6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  // ── Speaking indicator ───────────────────────────────────────────────────
  if (isSpeaking) {
    ctx.save();
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 2.5;
    ctx.shadowBlur = 14;
    ctx.shadowColor = '#00ff88';
    ctx.globalAlpha = baseAlpha * (0.7 + Math.sin(frameCount * 0.25) * 0.3);
    ctx.beginPath();
    ctx.arc(0, 0, S * 1.9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ── SHIP BODY — neon delta-wing fighter ─────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════

  ctx.shadowBlur = 20 + pulse * 8;
  ctx.shadowColor = color;

  // -- Outer body glow halo
  const halo = ctx.createRadialGradient(0, 0, S * 0.2, 0, 0, S * 1.6);
  halo.addColorStop(0, withAlpha(color, 0.33));
  halo.addColorStop(1, 'transparent');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(0, 0, S * 1.6, 0, Math.PI * 2);
  ctx.fill();

  // -- Wings (wide swept delta)
  ctx.fillStyle = withAlpha(color, 0.67);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, -S * 1.0);        // nose tip
  ctx.lineTo(S * 1.4, S * 0.7);   // right wing tip
  ctx.lineTo(S * 0.55, S * 0.35); // right wing inner notch
  ctx.lineTo(S * 0.28, S * 0.65); // right engine pod
  ctx.lineTo(-S * 0.28, S * 0.65);// left engine pod
  ctx.lineTo(-S * 0.55, S * 0.35);// left wing inner notch
  ctx.lineTo(-S * 1.4, S * 0.7);  // left wing tip
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // -- Fuselage center (brighter core strip)
  const fuseGrad = ctx.createLinearGradient(0, -S * 0.9, 0, S * 0.5);
  fuseGrad.addColorStop(0, '#ffffff');
  fuseGrad.addColorStop(0.3, color);
  fuseGrad.addColorStop(1, withAlpha(color, 0.53));
  ctx.fillStyle = fuseGrad;
  ctx.strokeStyle = '#ffffffcc';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, -S * 1.0);
  ctx.lineTo(S * 0.22, -S * 0.1);
  ctx.lineTo(S * 0.18, S * 0.55);
  ctx.lineTo(-S * 0.18, S * 0.55);
  ctx.lineTo(-S * 0.22, -S * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // -- Cockpit canopy
  const cockpitGrad = ctx.createRadialGradient(0, -S * 0.45, 0, 0, -S * 0.35, S * 0.35);
  cockpitGrad.addColorStop(0, '#ffffff');
  cockpitGrad.addColorStop(0.4, withAlpha(color, 0.87));
  cockpitGrad.addColorStop(1, withAlpha(color, 0.27));
  ctx.fillStyle = cockpitGrad;
  ctx.shadowBlur = 12;
  ctx.shadowColor = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(0, -S * 0.38, S * 0.15, S * 0.26, 0, 0, Math.PI * 2);
  ctx.fill();

  // -- Wing accent lines (neon trim)
  ctx.shadowBlur = 8;
  ctx.shadowColor = color;
  ctx.strokeStyle = '#ffffffbb';
  ctx.lineWidth = 1;
  // Right wing stripe
  ctx.beginPath();
  ctx.moveTo(S * 0.28, -S * 0.05);
  ctx.lineTo(S * 1.1, S * 0.6);
  ctx.stroke();
  // Left wing stripe
  ctx.beginPath();
  ctx.moveTo(-S * 0.28, -S * 0.05);
  ctx.lineTo(-S * 1.1, S * 0.6);
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
  ctx.restore();

  // ── Name tag (drawn outside the transform, no tilt) ─────────────────────
  if (name) {
    ctx.save();
    ctx.globalAlpha = isHidden ? 0.15 : 0.85;
    ctx.fillStyle = '#ffffffdd';
    ctx.shadowBlur = 6;
    ctx.shadowColor = color;
    ctx.font = 'bold 10px "JetBrains Mono"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(name, x, y - PLAYER_RADIUS - 10);
    ctx.restore();
  }
}

// ── Attacker player cursor indicator ─────────────────────────────────────────

export function drawAttackerCursor(
  ctx: CanvasRenderingContext2D,
  x: number,
  frameCount: number
) {
  ctx.save();
  ctx.translate(x, 0);
  const pulse = Math.sin(frameCount * 0.12) * 5;
  ctx.strokeStyle = COLOR_ATTACKER;
  ctx.lineWidth = 2;
  ctx.shadowBlur = 16;
  ctx.shadowColor = COLOR_ATTACKER;

  // Vertical dashed drop-line
  ctx.setLineDash([6, 6]);
  ctx.globalAlpha = 0.4 + Math.sin(frameCount * 0.08) * 0.2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 2000);
  ctx.stroke();
  ctx.setLineDash([]);

  // Arrow head at top
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = COLOR_ATTACKER;
  ctx.beginPath();
  ctx.moveTo(0, 10 + pulse);
  ctx.lineTo(-10, 30 + pulse);
  ctx.lineTo(10, 30 + pulse);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

// ── Reticle (attacker target lock) ───────────────────────────────────────────

export function drawReticle(
  ctx: CanvasRenderingContext2D,
  reticle: AttackerReticle,
  frameCount: number
) {
  ctx.save();
  ctx.translate(reticle.x, reticle.y);

  const progress = reticle.lockProgress;
  const r = 44 + Math.sin(frameCount * 0.1) * 4;
  const color = progress >= 1 ? '#ff0055' : COLOR_ACCENT;
  const rot = frameCount * 0.04;

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.shadowBlur = 14;
  ctx.shadowColor = color;

  // Rotating corner brackets
  ctx.save();
  ctx.rotate(rot);
  const bSize = r * 0.45;
  for (let i = 0; i < 4; i++) {
    ctx.save();
    ctx.rotate((i * Math.PI) / 2);
    ctx.beginPath();
    ctx.moveTo(r, -bSize);
    ctx.lineTo(r, -r);
    ctx.lineTo(r - bSize, -r);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();

  // Lock-progress arc
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.75, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
  ctx.stroke();

  // Center crosshair
  ctx.beginPath();
  ctx.moveTo(-12, 0); ctx.lineTo(12, 0);
  ctx.moveTo(0, -12); ctx.lineTo(0, 12);
  ctx.stroke();

  if (progress >= 1) {
    ctx.fillStyle = color;
    ctx.font = 'bold 9px "JetBrains Mono"';
    ctx.textAlign = 'center';
    ctx.shadowBlur = 10;
    ctx.fillText('LOCK', 0, r + 16);
  }

  ctx.restore();
}

// ── Bot / remote player ───────────────────────────────────────────────────────

export function drawBotEscaper(
  ctx: CanvasRenderingContext2D,
  bot: BotState,
  frameCount: number
) {
  drawEscaper(ctx, bot.x, bot.y, bot.color, bot.vx, frameCount, bot.name, false, {
    isShielded: false, isFiring: false, isHidden: false,
    isSlowed: false, isMagnetized: false, isTimeStopped: false, isBoosted: false,
  }, bot.isDefeated);
}

export function drawRemoteEscaper(
  ctx: CanvasRenderingContext2D,
  p: RemotePlayer,
  frameCount: number
) {
  drawEscaper(ctx, p.x, p.y, p.color, p.vx, frameCount, p.name, p.isSpeaking, {
    isShielded: p.isShielded, isFiring: p.isFiring, isHidden: p.isHidden,
    isSlowed: false, isMagnetized: false, isTimeStopped: false, isBoosted: false,
  }, p.isDefeated);
}

export function drawAttackerShip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  vx: number,
  frameCount: number,
  name: string,
  isSpeaking: boolean,
  isHidden: boolean
) {
  if (isHidden) return; // Attacker can also be hidden!

  ctx.save();
  ctx.translate(x, y);

  // Tilt based on horizontal velocity
  const tilt = vx * 0.015;
  ctx.rotate(tilt);

  // Engine glow pulse
  const pulse = Math.sin(frameCount * 0.2) * 2;
  
  // Ship core (inverted delta)
  ctx.fillStyle = color;
  ctx.shadowBlur = 15 + pulse;
  ctx.shadowColor = color;
  
  ctx.beginPath();
  ctx.moveTo(0, 20); // Bottom point
  ctx.lineTo(-18, -15); // Top left
  ctx.lineTo(0, -5); // Top inner indent
  ctx.lineTo(18, -15); // Top right
  ctx.closePath();
  ctx.fill();

  // Engine exhaust at top (since they move downwards conceptually)
  ctx.fillStyle = '#ffffff';
  ctx.shadowBlur = 10;
  ctx.shadowColor = '#ffffff';
  ctx.beginPath();
  ctx.arc(-8, -16, 3 + Math.random() * 2, 0, Math.PI * 2);
  ctx.arc(8, -16, 3 + Math.random() * 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // Name tag above
  ctx.fillStyle = isSpeaking ? '#00ffcc' : 'rgba(255, 255, 255, 0.7)';
  ctx.font = '10px "JetBrains Mono"';
  ctx.textAlign = 'center';
  ctx.shadowBlur = isSpeaking ? 8 : 0;
  ctx.shadowColor = '#00ffcc';
  ctx.fillText(name.toUpperCase(), x, y - 25);
}

export function drawRemoteAttacker(
  ctx: CanvasRenderingContext2D,
  p: RemotePlayer,
  frameCount: number
) {
  drawAttackerShip(ctx, p.x, p.y || 40, p.color || COLOR_ATTACKER, p.vx || 0, frameCount, p.name, p.isSpeaking, p.isHidden);
}

// ── Floating texts ────────────────────────────────────────────────────────────

export function drawFloatingTexts(ctx: CanvasRenderingContext2D, texts: FloatingText[]) {
  ctx.save();
  texts.forEach(t => {
    const alpha = t.life / t.maxLife;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = t.color;
    ctx.shadowBlur = 12;
    ctx.shadowColor = t.color;
    ctx.font = `bold ${t.size}px "JetBrains Mono"`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t.text, t.x, t.y);
  });
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
  ctx.restore();
}

// ── Drop-attack spawn flash ───────────────────────────────────────────────────

export function drawSpawnFlashes(
  ctx: CanvasRenderingContext2D,
  spawns: { x: number; y: number; life: number; color: string }[]
) {
  ctx.save();
  spawns.forEach(s => {
    ctx.globalAlpha = s.life;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 2;
    ctx.shadowBlur = 20;
    ctx.shadowColor = s.color;
    const r = (1 - s.life) * 40 + 10;
    ctx.beginPath();
    ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
  ctx.restore();
}

// ── Glitch overlay ────────────────────────────────────────────────────────────

export function drawGlitch(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  glitchTimer: number,
  w: number,
  h: number
) {
  if (glitchTimer <= 0) return;
  if (Math.random() > 0.55) {
    ctx.save();
    ctx.globalAlpha = Math.random() * 0.25;
    ctx.fillStyle = Math.random() > 0.5 ? '#00f2ff' : '#ff00ff';
    ctx.fillRect(0, Math.random() * h, w, 2 + Math.random() * 5);
    ctx.restore();
  }
  if (Math.random() > 0.85) {
    const sliceY = Math.random() * h;
    const sliceH = 4 + Math.random() * 20;
    const offset = (Math.random() - 0.5) * 22;
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.drawImage(canvas, 0, sliceY, w, sliceH, offset, sliceY, w, sliceH);
    ctx.restore();
  }
}

// ── Chromatic aberration ──────────────────────────────────────────────────────

export function applyAberration(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  amount: number,
  w: number,
  h: number
) {
  if (amount <= 0) return;
  const img = ctx.getImageData(0, 0, w, h);
  const out = ctx.createImageData(w, h);
  const shift = Math.round(amount);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const ir = (y * w + Math.min(x + shift, w - 1)) * 4;
      const ib = (y * w + Math.max(x - shift, 0)) * 4;
      out.data[i]     = img.data[ir];
      out.data[i + 1] = img.data[i + 1];
      out.data[i + 2] = img.data[ib + 2];
      out.data[i + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
}
