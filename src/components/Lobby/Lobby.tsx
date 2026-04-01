import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Zap, Shield, Users, Bot, Target, Flame, Timer, Clock,
  Globe, Home, Wifi, Copy, Check, Search, ChevronRight,
  Magnet, Eye, Maximize2, Minimize2, Volume2, VolumeX,
} from 'lucide-react';
import type { Role, RoomMode, LobbyState } from '../../types';
import { setMuted, getMuted } from '../../utils/audio';

interface LobbyProps {
  lobbyState: LobbyState;
  setLobbyState: (s: LobbyState | ((prev: LobbyState) => LobbyState)) => void;
  onStartOffline: (role: Role) => void;
  onJoinMatchmaking: (role: Role) => void;
  onCreateLocalRoom: (role: Role) => void;
  onJoinLocalRoom: (code: string) => void;
  serverError: string | null;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

export function Lobby({
  lobbyState, setLobbyState,
  onStartOffline, onJoinMatchmaking, onCreateLocalRoom, onJoinLocalRoom,
  serverError, isFullscreen, onToggleFullscreen,
}: LobbyProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const [muted, setMutedState] = useState(getMuted());

  const { name, role, mode, localCode, localRoomData } = lobbyState;

  const set = (patch: Partial<LobbyState>) =>
    setLobbyState(prev => ({ ...prev, ...patch }));

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(label);
    setTimeout(() => setCopied(null), 2200);
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
  };

  // ── Primary action per mode ───────────────────────────────────────────────
  const handlePlay = () => {
    if (!name.trim()) return;
    if (mode === 'OFFLINE') onStartOffline(role);
    else if (mode === 'ONLINE') onJoinMatchmaking(role);
    else if (mode === 'LOCAL') onCreateLocalRoom(role);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 modal-bg flex flex-col items-center justify-center p-4 sm:p-8 z-50 overflow-y-auto custom-scrollbar"
    >
      {/* Top-right controls */}
      <div className="absolute top-4 right-4 flex gap-2 z-50">
        <button
          onClick={toggleMute}
          className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-white/60 hover:text-white"
          title={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
        <button
          onClick={onToggleFullscreen}
          className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-[#00f2ff]"
          title="Toggle fullscreen"
        >
          {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
      </div>

      {/* Header */}
      <motion.div
        initial={{ y: -24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.05 }}
        className="text-center mb-6 sm:mb-8"
      >
        <h1 className="text-4xl sm:text-6xl font-black italic tracking-tighter leading-none">
          NEON{' '}
          <span className="text-[#ff0055] neon-pink">VELOCITY</span>
        </h1>
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="h-[2px] bg-gradient-to-r from-transparent via-[#00f2ff] to-transparent my-2"
        />
        <p className="text-[#00f2ff] text-[9px] sm:text-[10px] uppercase tracking-[0.5em] sm:tracking-[0.8em] font-bold">
          Cyber Escape Protocol v3.0
        </p>
      </motion.div>

      {/* Error banner */}
      <AnimatePresence>
        {serverError && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="w-full max-w-lg mb-4 px-4 py-2 bg-[#ff0055]/10 border border-[#ff0055]/30 rounded-xl text-[#ff0055] text-xs text-center"
          >
            ⚠ {serverError}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="w-full max-w-lg flex flex-col gap-3 sm:gap-4">

        {/* ── Operator ID ───────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/5 border border-white/10 p-4 rounded-2xl"
        >
          <label className="block text-[9px] uppercase tracking-[0.35em] text-[#00f2ff] font-bold mb-3">
            Operator ID
          </label>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#00f2ff]/15 border border-[#00f2ff]/25 flex items-center justify-center shrink-0">
              <Users size={16} className="text-[#00f2ff]" />
            </div>
            <input
              type="text"
              value={name}
              maxLength={18}
              onChange={e => set({ name: e.target.value })}
              className="flex-1 bg-transparent border-b border-white/15 pb-1 text-lg sm:text-xl font-black tracking-tight focus:outline-none focus:border-[#00f2ff] transition-colors placeholder:opacity-20"
              placeholder="ENTER CALLSIGN..."
            />
          </div>
        </motion.div>

        {/* ── Role selection ────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="grid grid-cols-2 gap-3"
        >
          <RoleCard
            active={role === 'ESCAPER'}
            onClick={() => set({ role: 'ESCAPER' })}
            color="#00ff88"
            icon={<Zap size={22} />}
            label="Escaper"
            sub="Evade & Survive"
            desc="Dodge falling attacks. Collect power-ups. Stay alive."
          />
          <RoleCard
            active={role === 'ATTACKER'}
            onClick={() => set({ role: 'ATTACKER' })}
            color="#ff0055"
            icon={<Target size={22} />}
            label="Attacker"
            sub="Hunt & Eliminate"
            desc="Tap the screen to drop attacks from above. Use abilities."
          />
        </motion.div>

        {/* ── Tactical assets preview ───────────────────────────────────────── */}
        {role === 'ESCAPER' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-white/[0.03] border border-white/[0.06] p-3 rounded-2xl"
          >
            <p className="text-[9px] uppercase tracking-[0.3em] text-[#ffcc00] font-bold mb-3">
              Tactical Assets
            </p>
            <div className="grid grid-cols-4 gap-2">
              {ASSETS.map(a => (
                <div key={a.label} className="flex flex-col items-center gap-1.5 group">
                  <div
                    className="p-2 rounded-xl border transition-all"
                    style={{ background: a.color + '15', borderColor: a.color + '30' }}
                  >
                    <div style={{ color: a.color }}>{a.icon}</div>
                  </div>
                  <span className="text-[8px] uppercase font-bold tracking-tighter opacity-50">
                    {a.label}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {role === 'ATTACKER' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-white/[0.03] border border-white/[0.06] p-3 rounded-2xl"
          >
            <p className="text-[9px] uppercase tracking-[0.3em] text-[#ff0055] font-bold mb-3">
              Attacker Abilities
            </p>
            <div className="grid grid-cols-3 gap-2">
              {ABILITIES.map(a => (
                <div key={a.label} className="flex flex-col items-center gap-1.5">
                  <div className="p-2 rounded-xl bg-[#ff0055]/10 border border-[#ff0055]/20 text-[#ff0055]">
                    {a.icon}
                  </div>
                  <span className="text-[8px] uppercase font-bold tracking-tighter opacity-50">{a.label}</span>
                  <span className="text-[7px] text-white/25 tracking-wider">{a.cost}E</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Mode tabs ─────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-3 gap-2"
        >
          {MODES.map(m => (
            <ModeTab
              key={m.id}
              active={mode === m.id}
              onClick={() => set({ mode: m.id, localRoomData: null })}
              icon={m.icon}
              label={m.label}
              color={m.color}
            />
          ))}
        </motion.div>

        {/* ── Mode-specific panels ──────────────────────────────────────────── */}
        <AnimatePresence mode="wait">

          {/* OFFLINE */}
          {mode === 'OFFLINE' && (
            <motion.div
              key="offline"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 flex flex-col gap-3"
            >
              <div className="text-center">
                <p className="text-xs font-bold text-white/60 uppercase tracking-widest mb-1">Solo Mode</p>
                <p className="text-[10px] text-white/30">
                  {role === 'ESCAPER'
                    ? 'Dodge AI-dropped attacks. Difficulty scales each level.'
                    : 'Hunt the AI escaper. Hit it before time runs out.'}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[9px] text-white/30 uppercase tracking-widest">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#00ff88]" />
                  {role === 'ESCAPER' ? 'Endless survival' : '60s to hit target'}
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#00f2ff]" />
                  Level-up system
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#ffcc00]" />
                  High score tracking
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#ff00ff]" />
                  8 power-ups
                </div>
              </div>
            </motion.div>
          )}

          {/* ONLINE */}
          {mode === 'ONLINE' && (
            <motion.div
              key="online"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 flex flex-col gap-3"
            >
              <div className="text-center">
                <p className="text-xs font-bold text-[#00f2ff] uppercase tracking-widest mb-1">
                  4 Escapers vs 4 Attackers
                </p>
                <p className="text-[10px] text-white/30">
                  Algorithm matches you with real players. AI fills any gaps instantly.
                  90 seconds — Escapers win if 1+ survive.
                </p>
              </div>
              <div className="flex justify-center gap-4 text-[9px] text-white/30 uppercase tracking-widest">
                <span className="flex items-center gap-1"><span className="text-[#00ff88]">●</span> Escapers survive = WIN</span>
                <span className="flex items-center gap-1"><span className="text-[#ff0055]">●</span> All hit = Attackers WIN</span>
              </div>
            </motion.div>
          )}

          {/* LOCAL */}
          {mode === 'LOCAL' && (
            <motion.div
              key="local"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-3"
            >
              {!localRoomData ? (
                /* Join with code */
                <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 flex flex-col gap-3">
                  <p className="text-[9px] uppercase tracking-widest text-white/40 text-center">
                    Have a team code? Enter it below.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="ESC-XXXX or ATK-XXXX"
                      value={localCode}
                      maxLength={10}
                      onChange={e => set({ localCode: e.target.value.toUpperCase() })}
                      className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-bold uppercase tracking-widest focus:outline-none focus:border-[#00f2ff] transition-colors"
                    />
                    <button
                      onClick={() => localCode.trim() && onJoinLocalRoom(localCode)}
                      disabled={!localCode.trim()}
                      className="px-4 py-2.5 bg-white text-black font-black text-xs uppercase tracking-widest rounded-xl disabled:opacity-30 hover:bg-[#00f2ff] transition-all active:scale-95"
                    >
                      Join
                    </button>
                  </div>
                  <div className="relative flex items-center gap-3">
                    <div className="flex-1 h-px bg-white/10" />
                    <span className="text-[9px] text-white/30 uppercase tracking-widest shrink-0">or create a room</span>
                    <div className="flex-1 h-px bg-white/10" />
                  </div>
                  <p className="text-[9px] text-white/30 text-center">
                    Your team: <span className="text-white/60 font-bold">{role}</span>
                    <br />Two codes will be generated — share each with the right team.
                  </p>
                </div>
              ) : (
                /* Room codes display */
                <motion.div
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 space-y-4"
                >
                  <p className="text-[10px] uppercase tracking-widest text-center text-white/50">
                    Room Created — Share These Codes
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <CodeCard
                      label="Escaper Code"
                      code={localRoomData.escaperCode}
                      color="#00ff88"
                      copied={copied === 'esc'}
                      onCopy={() => copyText(localRoomData.escaperCode, 'esc')}
                    />
                    <CodeCard
                      label="Attacker Code"
                      code={localRoomData.attackerCode}
                      color="#ff0055"
                      copied={copied === 'atk'}
                      onCopy={() => copyText(localRoomData.attackerCode, 'atk')}
                    />
                  </div>
                  <p className="text-[8px] text-center text-white/25 leading-relaxed uppercase tracking-widest">
                    Share each code with the correct team.
                    <br />You are already in as <span className="text-white/60">{role}</span>.
                  </p>
                </motion.div>
              )}
            </motion.div>
          )}

        </AnimatePresence>

        {/* ── Play button ────────────────────────────────────────────────────── */}
        <motion.button
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          onClick={handlePlay}
          disabled={!name.trim()}
          whileTap={{ scale: 0.97 }}
          className="relative w-full py-4 sm:py-5 rounded-2xl font-black uppercase tracking-[0.3em] text-sm overflow-hidden disabled:opacity-30 disabled:cursor-not-allowed cyber-btn shimmer"
          style={{
            background: mode === 'OFFLINE'
              ? 'linear-gradient(135deg,#00ff88,#00cc66)'
              : mode === 'ONLINE'
              ? 'linear-gradient(135deg,#00f2ff,#0088ff)'
              : 'linear-gradient(135deg,#ff0055,#cc0044)',
            boxShadow: mode === 'OFFLINE'
              ? '0 0 30px rgba(0,255,136,0.3)'
              : mode === 'ONLINE'
              ? '0 0 30px rgba(0,242,255,0.3)'
              : '0 0 30px rgba(255,0,85,0.3)',
            color: '#000',
          }}
        >
          <span className="relative z-10 flex items-center justify-center gap-2">
            {mode === 'OFFLINE' && <>{role === 'ESCAPER' ? <Zap size={18} fill="currentColor" /> : <Target size={18} />} Play Solo</>}
            {mode === 'ONLINE' && <><Search size={18} /> Find Match</>}
            {mode === 'LOCAL' && !localRoomData && <><Wifi size={18} /> Create Room</>}
            {mode === 'LOCAL' && localRoomData && <><ChevronRight size={18} /> Waiting for Team…</>}
          </span>
        </motion.button>

        {/* Footer */}
        <p className="text-center text-[8px] text-white/15 uppercase tracking-widest pb-2">
          Free to play · No account needed · Web & Mobile
        </p>
      </div>
    </motion.div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function RoleCard({
  active, onClick, color, icon, label, sub, desc,
}: {
  active: boolean; onClick: () => void; color: string;
  icon: React.ReactNode; label: string; sub: string; desc: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative p-4 sm:p-5 rounded-2xl border-2 transition-all text-left flex flex-col gap-2 sm:gap-3 cyber-btn ${
        active ? 'bg-opacity-10' : 'border-white/5 bg-white/[0.03] hover:border-white/15'
      }`}
      style={active ? {
        borderColor: color,
        background: color + '12',
        boxShadow: `0 0 30px ${color}22`,
      } : undefined}
    >
      <div
        className="p-2.5 rounded-xl w-fit transition-all"
        style={active
          ? { background: color, color: '#000', boxShadow: `0 0 16px ${color}` }
          : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }
        }
      >
        {icon}
      </div>
      <div>
        <div className="font-black uppercase tracking-widest text-sm leading-none mb-1">{label}</div>
        <div
          className="text-[9px] font-bold uppercase tracking-widest"
          style={{ color: active ? color : 'rgba(255,255,255,0.3)' }}
        >
          {sub}
        </div>
      </div>
      <p className="text-[9px] text-white/30 leading-relaxed hidden sm:block">{desc}</p>
    </button>
  );
}

function ModeTab({
  active, onClick, icon, label, color,
}: {
  active: boolean; onClick: () => void;
  icon: React.ReactNode; label: string; color: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border transition-all cyber-btn"
      style={active
        ? { borderColor: color, background: color + '14', color }
        : { borderColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.3)' }
      }
    >
      {icon}
      <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
    </button>
  );
}

function CodeCard({
  label, code, color, copied, onCopy,
}: {
  label: string; code: string; color: string; copied: boolean; onCopy: () => void;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[8px] uppercase font-bold tracking-widest" style={{ color }}>
        {label}
      </p>
      <button
        onClick={onCopy}
        className="w-full p-3 bg-black/40 rounded-xl border border-white/10 flex items-center justify-between gap-2 group hover:border-white/20 transition-all"
      >
        <span className="text-xs font-mono font-bold truncate">{code}</span>
        {copied
          ? <Check size={13} className="text-[#00ff88] shrink-0" />
          : <Copy size={13} className="opacity-0 group-hover:opacity-60 transition-all shrink-0" />
        }
      </button>
    </div>
  );
}

// ── Data ──────────────────────────────────────────────────────────────────────

const ASSETS = [
  { label: 'Shield',    color: '#00f2ff', icon: <Shield size={14} /> },
  { label: 'Fire',      color: '#ff6600', icon: <Flame size={14} /> },
  { label: 'Slow',      color: '#00ffcc', icon: <Timer size={14} /> },
  { label: 'Cloak',     color: '#ffffff', icon: <Eye size={14} /> },
  { label: 'Magnet',    color: '#ff3333', icon: <Magnet size={14} /> },
  { label: 'Time Stop', color: '#9900ff', icon: <Clock size={14} /> },
  { label: 'Boost',     color: '#ff00ff', icon: <Zap size={14} /> },
  { label: 'Coin',      color: '#ffcc00', icon: <span className="text-xs font-bold">$</span> },
];

const ABILITIES = [
  { label: 'Swarm',    cost: 22, icon: <Bot size={14} /> },
  { label: 'EMP',      cost: 40, icon: <Zap size={14} /> },
  { label: 'Firewall', cost: 65, icon: <Shield size={14} /> },
];

const MODES = [
  { id: 'OFFLINE' as RoomMode, label: 'Offline', color: '#00ff88', icon: <Home size={16} /> },
  { id: 'ONLINE'  as RoomMode, label: 'Online',  color: '#00f2ff', icon: <Globe size={16} /> },
  { id: 'LOCAL'   as RoomMode, label: 'Local',   color: '#ff0055', icon: <Wifi size={16} /> },
];
