/**
 * Server-side input validation & rate limiting.
 * Prevents XSS, injection, teleport hacks, and spam.
 */

import { VIRTUAL_W, VIRTUAL_H, MAX_VX } from '../src/constants/index.js';

// ── Name sanitization ────────────────────────────────────────────────────────

const NAME_MIN = 2;
const NAME_MAX = 18;
const NAME_REGEX = /^[a-zA-Z0-9 _\-]+$/;

export function validateName(raw: unknown): string {
  if (typeof raw !== 'string') return 'Player';
  const trimmed = raw.trim().slice(0, NAME_MAX);
  if (trimmed.length < NAME_MIN) return 'Player';
  if (!NAME_REGEX.test(trimmed)) {
    // Strip non-allowed characters
    const cleaned = trimmed.replace(/[^a-zA-Z0-9 _\-]/g, '').trim();
    return cleaned.length >= NAME_MIN ? cleaned.slice(0, NAME_MAX) : 'Player';
  }
  return trimmed;
}

// ── Role validation ───────────────────────────────────────────────────────────

const VALID_ROLES = new Set(['ESCAPER', 'ATTACKER']);

export function validateRole(raw: unknown): 'ESCAPER' | 'ATTACKER' {
  if (typeof raw !== 'string' || !VALID_ROLES.has(raw)) return 'ESCAPER';
  return raw as 'ESCAPER' | 'ATTACKER';
}

// ── Coordinate validation ─────────────────────────────────────────────────────

export function validateCoordinates(
  x: unknown,
  y: unknown,
  maxW = VIRTUAL_W,
  maxH = VIRTUAL_H
): { x: number; y: number } | null {
  if (typeof x !== 'number' || typeof y !== 'number') return null;
  if (!isFinite(x) || !isFinite(y)) return null;
  return {
    x: Math.max(0, Math.min(x, maxW)),
    y: Math.max(0, Math.min(y, maxH)),
  };
}

export function validateVelocity(
  vx: unknown,
  vy: unknown,
  maxV = MAX_VX * 2 // allow some headroom
): { vx: number; vy: number } | null {
  if (typeof vx !== 'number' || typeof vy !== 'number') return null;
  if (!isFinite(vx) || !isFinite(vy)) return null;
  return {
    vx: Math.max(-maxV, Math.min(vx, maxV)),
    vy: Math.max(-maxV, Math.min(vy, maxV)),
  };
}

// ── Rate limiter ──────────────────────────────────────────────────────────────

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up stale entries every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (now - entry.windowStart > 10_000) {
      rateLimitStore.delete(key);
    }
  }
}, 60_000);

/**
 * Returns true if the action is allowed, false if rate limited.
 * @param socketId - Socket ID
 * @param event - Event name
 * @param maxPerSecond - Maximum allowed calls per second
 */
export function checkRateLimit(
  socketId: string,
  event: string,
  maxPerSecond: number
): boolean {
  const key = `${socketId}:${event}`;
  const now = Date.now();
  let entry = rateLimitStore.get(key);

  if (!entry || now - entry.windowStart > 1000) {
    entry = { count: 1, windowStart: now };
    rateLimitStore.set(key, entry);
    return true;
  }

  entry.count++;
  return entry.count <= maxPerSecond;
}

/**
 * Clean up all rate limit entries for a disconnected socket.
 */
export function cleanupRateLimits(socketId: string): void {
  for (const key of rateLimitStore.keys()) {
    if (key.startsWith(socketId + ':')) {
      rateLimitStore.delete(key);
    }
  }
}

// ── Room ID validation ────────────────────────────────────────────────────────

export function validateRoomId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  if (raw.length < 3 || raw.length > 50) return null;
  return raw;
}

// ── Team code validation ──────────────────────────────────────────────────────

const TEAM_CODE_REGEX = /^(ESC|ATK)-[A-Z0-9]{4}$/;

export function validateTeamCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const upper = raw.trim().toUpperCase();
  if (!TEAM_CODE_REGEX.test(upper)) return null;
  return upper;
}

// ── Ability validation ────────────────────────────────────────────────────────

const VALID_ABILITIES = new Set(['SWARM', 'EMP', 'FIREWALL']);

export function validateAbility(raw: unknown): 'SWARM' | 'EMP' | 'FIREWALL' | null {
  if (typeof raw !== 'string' || !VALID_ABILITIES.has(raw)) return null;
  return raw as 'SWARM' | 'EMP' | 'FIREWALL';
}

// ── Power-up state validation ─────────────────────────────────────────────────

export function validatePowerUpStates(raw: unknown): {
  isShielded: boolean;
  isFiring: boolean;
  isHidden: boolean;
} {
  if (!raw || typeof raw !== 'object') {
    return { isShielded: false, isFiring: false, isHidden: false };
  }
  const obj = raw as Record<string, unknown>;
  return {
    isShielded: obj.isShielded === true,
    isFiring: obj.isFiring === true,
    isHidden: obj.isHidden === true,
  };
}
