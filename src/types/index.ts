// ─── Core Game Enums ────────────────────────────────────────────────────────
export type Role = 'ESCAPER' | 'ATTACKER';
export type GamePhase = 'SPLASH' | 'LOBBY' | 'MATCHMAKING' | 'WAITING_ROOM' | 'PLAYING' | 'GAMEOVER';
export type RoomMode = 'OFFLINE' | 'ONLINE' | 'LOCAL';
export type WinResult = 'ESCAPERS_WIN' | 'ATTACKERS_WIN' | 'TIME_EXPIRED' | 'PLAYER_HIT';

// ─── Power-Up Types ──────────────────────────────────────────────────────────
export type PowerUpType =
  | 'SHIELD'
  | 'BOOST'
  | 'FIRE'
  | 'HIDE'
  | 'COIN'
  | 'SLOW'
  | 'MAGNET'
  | 'TIME_STOP';

// ─── Attacker Ability Types ──────────────────────────────────────────────────
export type AttackerAbility = 'SWARM' | 'EMP' | 'FIREWALL';

// ─── Obstacle ────────────────────────────────────────────────────────────────
export interface Obstacle {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  type: 'BLOCK' | 'GATE' | 'BOSS';
  vx: number;
  nearMissTriggered: boolean;
  spawnedBy?: string; // socket id that spawned it (for attribution)
  rotation: number;        // current rotation angle in radians
  rotationSpeed: number;   // rad/frame
  gravityMultiplier: number; // how fast this obstacle falls (1.0 = normal)
}

// ─── Power-Up ────────────────────────────────────────────────────────────────
export interface PowerUp {
  id: string;
  x: number;
  y: number;
  type: PowerUpType;
  size: number;
}

// ─── Particle ────────────────────────────────────────────────────────────────
export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

// ─── Trail Point ─────────────────────────────────────────────────────────────
export interface TrailPoint {
  x: number;
  y: number;
  life: number;
  color: string;
}

// ─── Floating Text ───────────────────────────────────────────────────────────
export interface FloatingText {
  id: string;
  x: number;
  y: number;
  text: string;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

// ─── Speed Line ──────────────────────────────────────────────────────────────
export interface SpeedLine {
  x: number;
  y: number;
  length: number;
  speed: number;
  opacity: number;
}

// ─── Remote Player ───────────────────────────────────────────────────────────
export interface RemotePlayer {
  id: string;
  name: string;
  role: Role;
  x: number;
  y: number;
  vx: number;
  vy: number;
  isBot: boolean;
  isDefeated: boolean;
  isMuted: boolean;
  isSpeaking: boolean;
  color: string;
  // Powerup states for rendering remote players
  isShielded: boolean;
  isFiring: boolean;
  isHidden: boolean;
}

// ─── Bot State ───────────────────────────────────────────────────────────────
export interface BotState {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  isDefeated: boolean;
  reactionTimer: number;
  targetX: number;
  evadeDir: number;
  evadeCooldown: number;
  name: string;
  color: string;
  // for attacker bot (offline escaper mode only)
  dropCooldown?: number;
  // respawn timer (frame-based, not setTimeout)
  respawnTimer?: number;
}

// ─── Attacker Reticle ────────────────────────────────────────────────────────
export interface AttackerReticle {
  x: number;
  y: number;
  lockProgress: number;
  targetId: string | null;
}

// ─── Active Power-Up Timers ──────────────────────────────────────────────────
export interface PowerUpTimers {
  shield: number;
  fire: number;
  hide: number;
  slow: number;
  magnet: number;
  timeStop: number;
  boost: number;
}

// ─── The Game Ref (mutable game state, lives outside React) ─────────────────
export interface GameState {
  // Player
  playerX: number;
  playerY: number;
  playerVx: number;
  playerVy: number;
  playerColor: string;
  playerHue: number;

  // Bot opponents (used in offline mode)
  bots: BotState[];

  // Multiplayer
  remotePlayers: RemotePlayer[];

  // World objects
  obstacles: Obstacle[];
  powerUps: PowerUp[];

  // Visuals
  particles: Particle[];
  trails: TrailPoint[];
  floatingTexts: FloatingText[];
  speedLines: SpeedLine[];
  spawns: { x: number; y: number; life: number; color: string }[];

  // Physics
  worldSpeed: number;
  frameCount: number;

  // Screen FX
  shake: number;
  glitchTimer: number;

  // Input
  keys: Record<string, boolean>;
  touchX: number | null;
  touchY: number | null;

  // Timers (power-ups)
  powerUpTimers: PowerUpTimers;

  // Attacker state
  attackerEnergy: number;
  attackerTimer: number; // countdown frames for attacker time limit
  attackerReticle: AttackerReticle;

  // Scoring
  score: number;
  level: number;
  combo: number;
  comboTimer: number;
  multiplier: number;

  // Level
  levelUpFlash: number;

  // Game result
  isGameOver: boolean;
  winResult: WinResult | null;

  // Misc
  lastSpawnFrame: number;
  lastPowerUpFrame: number;
  botAttackFrame: number; // for bot attacker timing in offline mode

  // ── Enhanced Mechanics ──────────────────────────────────────────────────

  // Dash
  dashCooldown: number;       // frames until dash available again
  dashActive: number;         // frames remaining of dash
  dashDirectionX: number;     // dash direction vector X
  dashDirectionY: number;     // dash direction vector Y
  dashInvincibility: number;  // i-frames remaining

  // Bullet Time
  bulletTimeActive: number;           // frames remaining
  recentNearMissTimestamps: number[]; // frame numbers of recent near-misses
}

// ─── Socket Events (Client → Server) ────────────────────────────────────────
export interface ClientEvents {
  'join-matchmaking': { name: string; role: Role };
  'cancel-matchmaking': void;
  'create-local-room': { name: string; role: Role };
  'join-local-room': { teamCode: string; name: string };
  'join-offline': { name: string; role: Role };
  'player-ready': { roomId: string };
  'player-move': { roomId: string; x: number; y: number; vx: number; vy: number; powerUpStates: { isShielded: boolean; isFiring: boolean; isHidden: boolean } };
  'drop-attack': { roomId: string; x: number };
  'use-ability': { roomId: string; ability: AttackerAbility };
  'game-over-report': { roomId: string; escaperId: string };
  'leave-room': { roomId: string };
  'voice-signal': { roomId: string; to: string; signal: unknown };
  'voice-state': { roomId: string; isMuted: boolean; isSpeaking: boolean };
}

// ─── Socket Events (Server → Client) ────────────────────────────────────────
export interface ServerEvents {
  'room-joined': { roomId: string; role: Role; players: RemotePlayer[] };
  'room-update': { players: RemotePlayer[]; gamePhase: 'WAITING' | 'PLAYING' | 'GAMEOVER' };
  'match-found': { roomId: string; role: Role };
  'local-room-created': { roomId: string; escaperCode: string; attackerCode: string };
  'game-start': { roomId: string; seed: number };
  'attack-dropped': { obstacle: Obstacle };
  'ability-used': { ability: AttackerAbility; fromId: string };
  'escaper-eliminated': { escaperId: string; remaining: number };
  'game-end': { result: WinResult; scores: Record<string, number> };
  'voice-signal': { from: string; signal: unknown };
  'error': { message: string };
}

// ─── Lobby UI State ──────────────────────────────────────────────────────────
export interface LobbyState {
  name: string;
  role: Role;
  mode: RoomMode;
  localCode: string;
  // Local room creation result
  localRoomData: { escaperCode: string; attackerCode: string; roomId: string } | null;
}

// ─── Server-side room ────────────────────────────────────────────────────────
export interface ServerRoom {
  id: string;
  mode: RoomMode;
  players: Map<string, ServerPlayer>;
  gamePhase: 'WAITING' | 'PLAYING' | 'GAMEOVER';
  seed: number;
  startTime: number;
  escaperCode?: string;
  attackerCode?: string;
  gameTimer?: ReturnType<typeof setInterval>;
  remainingSeconds: number;
  scores: Map<string, number>;
  eliminatedEscapers: Set<string>;
}

export interface ServerPlayer {
  id: string;
  name: string;
  role: Role;
  x: number;
  y: number;
  vx: number;
  isBot: boolean;
  isMuted: boolean;
  isSpeaking: boolean;
  color: string;
  isDefeated: boolean;
  isShielded: boolean;
  isFiring: boolean;
  isHidden: boolean;
}
