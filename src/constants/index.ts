// ─── Virtual Canvas ───────────────────────────────────────────────────────────
export const VIRTUAL_W = 800;
export const VIRTUAL_H = 1000;

// ─── Player Physics ───────────────────────────────────────────────────────────
export const PLAYER_RADIUS = 18;
export const ACCEL = 0.9;
export const FRICTION = 0.88;
export const MAX_VX = 13;

// ─── World Speed ──────────────────────────────────────────────────────────────
export const INITIAL_SPEED = 5;
export const SPEED_RAMP = 0.0004;      // added per frame always
export const LEVEL_SPEED_BONUS = 0.6;  // added per level-up

// ─── Obstacle Spawning ────────────────────────────────────────────────────────
export const BASE_SPAWN_INTERVAL = 48;  // frames between auto-spawns (offline escaper)
export const MIN_SPAWN_INTERVAL  = 12;
export const BOSS_SPAWN_INTERVAL = 20;

// ─── Bot AI ───────────────────────────────────────────────────────────────────
export const BOT_ACCEL         = 0.7;
export const BOT_FRICTION      = 0.85;
export const BOT_EVADE_DIST    = 160;   // px — when to start evading
export const BOT_REACTION_MIN  = 10;    // frames before bot reacts (easy)
export const BOT_REACTION_MAX  = 40;    // frames before bot reacts (hard)
// Offline attacker mode: bot escaper gets harder per level
export const BOT_SKILL_PER_LVL = 0.07; // 0–1 scale added per level

// Bot attacker (offline escaper mode): drop interval in frames
export const BOT_ATTACK_INTERVAL_BASE = 120;
export const BOT_ATTACK_INTERVAL_MIN  = 28;

// ─── Online Match ─────────────────────────────────────────────────────────────
export const MATCH_DURATION_SECONDS = 90;
export const TEAM_SIZE = 4;
export const BOT_FILL_COLOR_POOL = [
  '#ff6b6b','#ffd93d','#6bcb77','#4d96ff','#c77dff',
  '#ff9f1c','#2ec4b6','#e71d36','#011627',
];

// ─── Scoring ──────────────────────────────────────────────────────────────────
export const SCORE_SURVIVE_PER_FRAME   = 1;
export const SCORE_NEAR_MISS           = 25;
export const SCORE_OBSTACLE_CLEARED    = 40;
export const SCORE_POWERUP_COIN        = 500;
export const SCORE_ATTACKER_HIT_BOT    = 600;
export const SCORE_ATTACKER_HIT_REAL   = 1200;
export const SCORE_LEVEL_UP_BONUS      = 200;
export const COMBO_TIMEOUT_FRAMES      = 120;

// ─── Power-Ups ────────────────────────────────────────────────────────────────
export const POWERUP_SPAWN_INTERVAL = 280; // frames
export const POWERUP_DURATION       = 300; // frames (~5s)
export const POWERUP_COIN_DURATION  = 1;   // immediate
export const MAGNET_ATTRACT_RADIUS  = 220;
export const MAGNET_FORCE           = 0.055;
export const SHIELD_BLOCK_HITS      = 1;

// ─── Attacker ─────────────────────────────────────────────────────────────────
export const ATTACKER_ENERGY_REGEN    = 0.12;  // per frame
export const ATTACKER_ENERGY_MAX      = 100;
export const ATTACKER_DROP_COST       = 5;
export const ABILITY_COST: Record<string, number> = {
  SWARM:    22,
  EMP:      40,
  FIREWALL: 65,
};
export const ATTACKER_OFFLINE_DURATION_S = 60; // seconds for solo attacker

// ─── Levels ───────────────────────────────────────────────────────────────────
export const SCORE_PER_LEVEL = 1800;

// ─── Near-Miss ────────────────────────────────────────────────────────────────
export const NEAR_MISS_THRESHOLD = 52; // px from obstacle edge

// ─── Particles ────────────────────────────────────────────────────────────────
export const EXPLOSION_PARTICLE_COUNT = 28;
export const SPARK_PARTICLE_COUNT     = 12;

// ─── Colors ───────────────────────────────────────────────────────────────────
export const COLOR_ESCAPER   = '#00ff88';
export const COLOR_ATTACKER  = '#ff0055';
export const COLOR_OBSTACLE  = '#ff0055';
export const COLOR_OBSTACLE2 = '#ff6600';
export const COLOR_BOSS_OBS  = '#ffcc00';
export const COLOR_ACCENT    = '#00f2ff';
export const COLOR_BG        = '#050505';

// ─── Enhanced Physics ─────────────────────────────────────────────────────────
export const GRAVITY             = 0.12;       // pulls player downward
export const VERTICAL_ACCEL      = 0.7;        // up/down movement acceleration
export const MAX_VY              = 10;         // max vertical speed
export const PLAYER_MIN_Y_OFFSET = 200;        // min distance from top

// ─── Dash Mechanic ────────────────────────────────────────────────────────────
export const DASH_SPEED              = 20;      // burst speed during dash
export const DASH_DURATION_FRAMES    = 8;       // how long dash lasts
export const DASH_COOLDOWN_FRAMES    = 75;      // 1.25s cooldown
export const DASH_INVINCIBILITY      = 8;       // i-frames during dash
export const DASH_TRAIL_MULTIPLIER   = 4;       // trail intensity during dash

// ─── Bullet Time ──────────────────────────────────────────────────────────────
export const BULLET_TIME_DURATION    = 45;      // frames of slow-mo
export const BULLET_TIME_SPEED_MULT  = 0.2;     // world speed multiplier
export const BULLET_TIME_THRESHOLD   = 3;       // near-misses needed to trigger
export const BULLET_TIME_WINDOW      = 120;     // frames window for near-miss count

// ─── Obstacle Enhancements ────────────────────────────────────────────────────
export const OBSTACLE_MIN_ROTATION   = -0.04;   // rad/frame
export const OBSTACLE_MAX_ROTATION   = 0.04;
export const OBSTACLE_GRAVITY_BASE   = 1.0;     // multiplier
export const OBSTACLE_GRAVITY_VARIANCE = 0.4;   // ± variance

// ─── Screen Edge Danger ───────────────────────────────────────────────────────
export const SCREEN_EDGE_DANGER_ZONE = 50;      // px from edge
export const SCREEN_EDGE_PUSH_FORCE  = 0.15;    // force pushing away from edge
