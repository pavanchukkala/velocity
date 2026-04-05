import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Flame, Eye, Timer, Magnet, Clock, Zap, Skull, Maximize2, Minimize2 } from 'lucide-react';
import type { Role, RoomMode } from '../../types';
import { ATTACKER_ENERGY_MAX } from '../../constants';

interface HUDRef {
  score: number;
  level: number;
  combo: number;
  multiplier: number;
  energy: number;
  timerSeconds: number;
  shieldActive: boolean;
  fireActive: boolean;
  hideActive: boolean;
  slowActive: boolean;
  magnetActive: boolean;
  timeStopActive: boolean;
  boostActive: boolean;
  // Countdown frames for progress bars
  shieldTimer: number;
  fireTimer: number;
  hideTimer: number;
  slowTimer: number;
  magnetTimer: number;
  timeStopTimer: number;
  boostTimer: number;
}

interface HUDProps {
  hudRef: React.MutableRefObject<HUDRef>;
  role: Role;
  mode: RoomMode;
  onTriggerAbility: (ability: 'SWARM' | 'EMP' | 'FIREWALL') => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

export function HUD({ hudRef, role, mode, onTriggerAbility, isFullscreen, onToggleFullscreen }: HUDProps) {
  // Poll the ref every 100ms to update display without coupling to the game loop
  const [display, setDisplay] = useState({ ...hudRef.current });

  useEffect(() => {
    const t = setInterval(() => setDisplay({ ...hudRef.current }), 100);
    return () => clearInterval(t);
  }, [hudRef]);

  const {
    score, level, combo, multiplier, energy, timerSeconds,
    shieldActive, fireActive, hideActive, slowActive,
    magnetActive, timeStopActive, boostActive,
    shieldTimer, fireTimer, hideTimer, slowTimer,
    magnetTimer, timeStopTimer, boostTimer,
  } = display;

  const energyPct = Math.min(100, (energy / ATTACKER_ENERGY_MAX) * 100);
  const timerPct = role === 'ATTACKER' ? (timerSeconds / (mode === 'OFFLINE' ? 60 : 90)) * 100 : (timerSeconds / 90) * 100;
  const isTimerCritical = timerSeconds <= 15;

  const POWERUP_DURATION_FRAMES = 300; // matches engine POWERUP_DURATION
  const TIME_STOP_DURATION_FRAMES = 180;

  const activePowerUps = [
    shieldActive   && { key: 'shield',   icon: <Shield size={18} />,   color: '#00f2ff', label: 'SHIELD',    timer: shieldTimer,    maxFrames: POWERUP_DURATION_FRAMES },
    fireActive     && { key: 'fire',     icon: <Flame size={18} />,    color: '#ff6600', label: 'FIRE',      timer: fireTimer,      maxFrames: POWERUP_DURATION_FRAMES },
    hideActive     && { key: 'hide',     icon: <Eye size={18} />,      color: '#ccccff', label: 'CLOAK',     timer: hideTimer,      maxFrames: POWERUP_DURATION_FRAMES },
    slowActive     && { key: 'slow',     icon: <Timer size={18} />,    color: '#00ffcc', label: 'SLOW',      timer: slowTimer,      maxFrames: POWERUP_DURATION_FRAMES },
    magnetActive   && { key: 'magnet',   icon: <Magnet size={18} />,   color: '#ff4444', label: 'MAGNET',    timer: magnetTimer,    maxFrames: POWERUP_DURATION_FRAMES },
    timeStopActive && { key: 'tstop',    icon: <Clock size={18} />,    color: '#cc44ff', label: 'TIMESTOP',  timer: timeStopTimer,  maxFrames: TIME_STOP_DURATION_FRAMES },
    boostActive    && { key: 'boost',    icon: <Zap size={18} />,      color: '#ff00ff', label: 'BOOST',     timer: boostTimer,     maxFrames: POWERUP_DURATION_FRAMES },
  ].filter(Boolean) as { key: string; icon: React.ReactNode; color: string; label: string; timer: number; maxFrames: number }[];

  return (
    <div className="absolute inset-0 pointer-events-none z-30">

      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <div className="absolute top-0 left-0 w-full flex items-start justify-between p-3 sm:p-4">

        {/* Left: title + sector */}
        <div className="flex items-center gap-2.5">
          <div className="w-1 h-7 bg-[#ff0055] shadow-[0_0_12px_#ff0055]" />
          <div>
            <div className="text-base sm:text-xl font-black italic tracking-tight leading-none">
              NEON <span className="text-[#ff0055]">VELOCITY</span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[9px] uppercase tracking-[0.3em] text-[#00f2ff] font-bold">
                Sector {level}
              </span>
              <span className="text-white/15">·</span>
              <span className="text-[9px] uppercase tracking-[0.2em] text-white/30 font-bold">
                {role}
              </span>
            </div>
          </div>
        </div>

        {/* Center: score */}
        <div className="flex flex-col items-center">
          <span className="text-[9px] uppercase tracking-[0.3em] text-white/30 font-bold">Score</span>
          <span className="text-2xl sm:text-3xl font-black italic leading-none">
            {score.toLocaleString()}
          </span>
          {multiplier > 1 && (
            <span className="text-[10px] font-black text-[#ffcc00]">×{multiplier}</span>
          )}
        </div>

        {/* Right: fullscreen */}
        <button
          onClick={onToggleFullscreen}
          className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-[#00f2ff] pointer-events-auto mt-0.5"
        >
          {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
      </div>

      {/* ── Combo display ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {combo > 2 && (
          <motion.div
            key={combo}
            initial={{ scale: 1.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute top-20 left-1/2 -translate-x-1/2 text-center pointer-events-none"
          >
            <div className="text-[11px] uppercase tracking-[0.4em] text-[#00f2ff] font-bold">Combo</div>
            <div className="text-4xl font-black italic text-[#00f2ff] neon-cyan leading-none">{combo}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Escaper: TACTICAL ASSETS panel (bottom-left) ─────────────────── */}
      {role === 'ESCAPER' && (
        <div className="absolute bottom-6 left-3 flex flex-col gap-2 max-w-[160px] sm:max-w-[180px]">
          {/* Panel header — always visible so player knows where to look */}
          <div className="flex items-center gap-1.5 mb-0.5">
            <div className="w-2 h-2 rounded-full bg-[#00f2ff] shadow-[0_0_8px_#00f2ff]" />
            <span className="text-[8px] uppercase tracking-[0.35em] text-[#00f2ff] font-black">
              Active Assets
            </span>
          </div>

          <AnimatePresence mode="popLayout">
            {activePowerUps.length === 0 && (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-[9px] text-white/20 uppercase tracking-widest font-bold pl-0.5"
              >
                — none —
              </motion.div>
            )}

            {activePowerUps.map(p => {
              const pct = Math.max(0, p.timer / p.maxFrames);
              const secLeft = Math.ceil(p.timer / 60);
              const isCritical = pct < 0.25;
              return (
                <motion.div
                  key={p.key}
                  layout
                  initial={{ opacity: 0, x: -20, scale: 0.85 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -16, scale: 0.8 }}
                  transition={{ type: 'spring', stiffness: 340, damping: 26 }}
                  className="rounded-xl overflow-hidden border"
                  style={{
                    background: p.color + '14',
                    borderColor: isCritical ? p.color + 'cc' : p.color + '40',
                    boxShadow: isCritical
                      ? `0 0 16px ${p.color}55, inset 0 0 8px ${p.color}22`
                      : `0 0 8px ${p.color}22`,
                  }}
                >
                  {/* Top row: icon + name + seconds */}
                  <div className="flex items-center gap-2 px-2.5 pt-2 pb-1">
                    <span style={{ color: p.color, filter: `drop-shadow(0 0 6px ${p.color})` }}>
                      {p.icon}
                    </span>
                    <span
                      className="text-[11px] font-black uppercase tracking-wider flex-1 leading-none"
                      style={{ color: p.color }}
                    >
                      {p.label}
                    </span>
                    <motion.span
                      className="text-[13px] font-black leading-none tabular-nums"
                      animate={isCritical ? { opacity: [1, 0.3, 1] } : { opacity: 1 }}
                      transition={isCritical ? { repeat: Infinity, duration: 0.55 } : {}}
                      style={{ color: isCritical ? '#ff4444' : p.color }}
                    >
                      {secLeft}s
                    </motion.span>
                  </div>

                  {/* Countdown drain bar */}
                  <div className="mx-2.5 mb-2 h-1.5 rounded-full overflow-hidden bg-white/8">
                    <motion.div
                      className="h-full rounded-full"
                      animate={{ width: `${pct * 100}%` }}
                      transition={{ duration: 0.12 }}
                      style={{
                        background: isCritical
                          ? `linear-gradient(90deg, #ff2222, ${p.color})`
                          : `linear-gradient(90deg, ${p.color}bb, ${p.color})`,
                        boxShadow: `0 0 6px ${p.color}88`,
                      }}
                    />
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* ── Attacker HUD (bottom-right) ───────────────────────────────────── */}
      {role === 'ATTACKER' && (
        <div className="absolute bottom-4 right-4 flex flex-col items-end gap-3 pointer-events-auto">

          {/* Timer */}
          <div className="flex flex-col items-end gap-1">
            <span className="text-[9px] uppercase tracking-[0.3em] font-bold"
              style={{ color: isTimerCritical ? '#ff3333' : '#ff0055' }}>
              Time Remaining
            </span>
            <div className="w-48 sm:w-60 h-2 bg-white/10 rounded-full overflow-hidden border border-white/10">
              <motion.div
                className="h-full rounded-full"
                animate={{ width: `${Math.max(0, timerPct)}%` }}
                transition={{ duration: 0.5 }}
                style={{
                  background: isTimerCritical
                    ? 'linear-gradient(90deg,#ff3333,#ff6600)'
                    : 'linear-gradient(90deg,#ffffff,#cccccc)',
                  boxShadow: isTimerCritical ? '0 0 10px #ff333366' : '0 0 8px #ffffff44',
                }}
              />
            </div>
            <span
              className="text-2xl font-black italic leading-none"
              style={{ color: isTimerCritical ? '#ff3333' : '#fff' }}
            >
              {timerSeconds}s
            </span>
          </div>

          {/* Energy bar */}
          <div className="flex flex-col items-end gap-1">
            <span className="text-[9px] uppercase tracking-[0.3em] text-[#ff0055] font-bold">
              Attack Energy
            </span>
            <div className="w-48 sm:w-60 h-3 bg-white/8 rounded-full overflow-hidden border border-white/10">
              <motion.div
                className="h-full energy-bar rounded-full"
                animate={{ width: `${energyPct}%` }}
                transition={{ duration: 0.15 }}
              />
            </div>
            <span className="text-[9px] text-white/30 uppercase tracking-widest">
              TAP SCREEN — 5E per drop
            </span>
          </div>

          {/* Ability buttons */}
          <div className="flex gap-2">
            <AbilityBtn
              icon={<Skull size={16} />}
              label="SWARM"
              cost={22}
              energy={energy}
              color="#ff3300"
              onClick={() => onTriggerAbility('SWARM')}
            />
            <AbilityBtn
              icon={<Zap size={16} />}
              label="EMP"
              cost={40}
              energy={energy}
              color="#ffcc00"
              onClick={() => onTriggerAbility('EMP')}
            />
            <AbilityBtn
              icon={<Shield size={16} />}
              label="WALL"
              cost={65}
              energy={energy}
              color="#00f2ff"
              onClick={() => onTriggerAbility('FIREWALL')}
            />
          </div>
        </div>
      )}

      {/* ── Escaper: score at top-right corner (already in top bar) ────────── */}

      {/* ── Mobile touch hint (first 3 seconds) ────────────────────────────── */}
      <TouchHint role={role} />
    </div>
  );
}

// ── Ability button ─────────────────────────────────────────────────────────────

function AbilityBtn({
  icon, label, cost, energy, color, onClick,
}: {
  icon: React.ReactNode; label: string; cost: number;
  energy: number; color: string; onClick: () => void;
}) {
  const canAfford = energy >= cost;
  return (
    <button
      onClick={onClick}
      disabled={!canAfford}
      className="flex flex-col items-center gap-1 p-2.5 rounded-xl border transition-all active:scale-95"
      style={canAfford ? {
        background: color + '14',
        borderColor: color + '55',
        color,
        boxShadow: `0 0 10px ${color}22`,
      } : {
        background: 'rgba(255,255,255,0.03)',
        borderColor: 'rgba(255,255,255,0.06)',
        color: 'rgba(255,255,255,0.18)',
        cursor: 'not-allowed',
      }}
    >
      {icon}
      <span className="text-[8px] font-black tracking-widest">{label}</span>
      <span className="text-[7px] opacity-60">{cost}E</span>
    </button>
  );
}

// ── Touch hint (fades after 3s) ────────────────────────────────────────────────

function TouchHint({ role }: { role: Role }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 3500);
    return () => clearTimeout(t);
  }, []);

  if (!visible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 0.5, y: 0 }}
      exit={{ opacity: 0 }}
      className="absolute bottom-24 left-1/2 -translate-x-1/2 text-center pointer-events-none"
    >
      <p className="text-[9px] uppercase tracking-widest text-white/50">
        {role === 'ESCAPER'
          ? '← → Arrow keys or touch to move'
          : 'Tap / click to drop attacks'}
      </p>
    </motion.div>
  );
}
