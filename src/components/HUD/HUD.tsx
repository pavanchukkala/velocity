import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Maximize2, Minimize2, Shield, Flame, Eye, Timer, Magnet, Clock, Zap, Skull } from 'lucide-react';
import type { Role, RoomMode } from '../../types';
import { POWERUP_DURATION, ATTACKER_ENERGY_MAX } from '../../constants';

interface HUDRef {
  score: number; level: number; combo: number; multiplier: number;
  energy: number; timerSeconds: number;
  shieldActive: boolean; fireActive: boolean; hideActive: boolean;
  slowActive: boolean; magnetActive: boolean; timeStopActive: boolean; boostActive: boolean;
  // Timer values (frames remaining) for countdown bars
  shieldTimer?: number; fireTimer?: number; hideTimer?: number;
  slowTimer?: number; magnetTimer?: number; timeStopTimer?: number; boostTimer?: number;
}

interface HUDProps {
  hudRef: React.MutableRefObject<HUDRef>;
  role: Role;
  mode: RoomMode;
  onTriggerAbility: (a: 'SWARM'|'EMP'|'FIREWALL') => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

export function HUD({ hudRef, role, mode, onTriggerAbility, isFullscreen, onToggleFullscreen }: HUDProps) {
  // Poll the ref at 60ms — fast enough to feel live, cheap enough to not matter
  const [d, setD] = useState({ ...hudRef.current });
  useEffect(() => {
    const t = setInterval(() => setD({ ...hudRef.current }), 60);
    return () => clearInterval(t);
  }, [hudRef]);

  const energyPct   = Math.min(100, (d.energy / ATTACKER_ENERGY_MAX) * 100);
  const maxTimer    = mode === 'OFFLINE' && role === 'ATTACKER' ? 60 : 90;
  const timerPct    = Math.max(0, (d.timerSeconds / maxTimer) * 100);
  const timerCrit   = d.timerSeconds <= 15;

  // Build active power-up list with countdown
  const activePUs = [
    d.shieldActive   && { key:'shield',   label:'SHIELD',    color:'#00f2ff', icon:<Shield size={18}/>,  frames: d.shieldTimer   ?? 0 },
    d.fireActive     && { key:'fire',     label:'FIRE',      color:'#ff6600', icon:<Flame size={18}/>,   frames: d.fireTimer     ?? 0 },
    d.hideActive     && { key:'hide',     label:'CLOAK',     color:'#cccccc', icon:<Eye size={18}/>,     frames: d.hideTimer     ?? 0 },
    d.slowActive     && { key:'slow',     label:'SLOW',      color:'#00ffcc', icon:<Timer size={18}/>,   frames: d.slowTimer     ?? 0 },
    d.magnetActive   && { key:'magnet',   label:'MAGNET',    color:'#ff3333', icon:<Magnet size={18}/>,  frames: d.magnetTimer   ?? 0 },
    d.timeStopActive && { key:'tstop',    label:'STOP',      color:'#9900ff', icon:<Clock size={18}/>,   frames: d.timeStopTimer ?? 0 },
    d.boostActive    && { key:'boost',    label:'BOOST',     color:'#ff00ff', icon:<Zap size={18}/>,     frames: d.boostTimer    ?? 0 },
  ].filter(Boolean) as { key:string; label:string; color:string; icon:React.ReactNode; frames:number }[];

  return (
    <div className="absolute inset-0 pointer-events-none z-30">

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="absolute top-0 left-0 w-full flex items-start justify-between px-3 py-2 sm:px-4 sm:py-3">

        {/* Game title + sector */}
        <div className="flex items-center gap-2">
          <div className="w-1 h-7 bg-[#ff0055] shadow-[0_0_10px_#ff0055]" />
          <div>
            <div className="text-sm sm:text-base font-black italic tracking-tight leading-none">
              NEON <span className="text-[#ff0055]">VELOCITY</span>
            </div>
            <div className="text-[8px] uppercase tracking-[0.3em] text-[#00f2ff] font-bold mt-0.5">
              Sector {d.level} · {role}
            </div>
          </div>
        </div>

        {/* Score */}
        <div className="flex flex-col items-center">
          <span className="text-[8px] uppercase tracking-[0.35em] text-white/30 font-bold">Score</span>
          <span className="text-xl sm:text-2xl font-black italic leading-none">
            {d.score.toLocaleString()}
          </span>
          {d.multiplier > 1 && (
            <span className="text-[10px] font-black text-[#ffcc00] leading-none">×{d.multiplier}</span>
          )}
        </div>

        {/* Fullscreen */}
        <button
          onClick={onToggleFullscreen}
          className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-[#00f2ff] pointer-events-auto"
        >
          {isFullscreen ? <Minimize2 size={15}/> : <Maximize2 size={15}/>}
        </button>
      </div>

      {/* ── Combo ───────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {d.combo > 2 && (
          <motion.div
            key={d.combo}
            initial={{ scale: 1.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute top-16 left-1/2 -translate-x-1/2 text-center"
          >
            <div className="text-[9px] uppercase tracking-[0.4em] text-[#00f2ff] font-bold">Combo</div>
            <div className="text-3xl font-black italic text-[#00f2ff] leading-none"
              style={{ textShadow: '0 0 20px #00f2ff' }}>
              {d.combo}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── ESCAPER: Active power-up panel ──────────────────────────────── */}
      {role === 'ESCAPER' && (
        <div className="absolute bottom-5 left-3 right-3 pointer-events-none">
          <AnimatePresence>
            {activePUs.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="flex gap-2 flex-wrap"
              >
                {activePUs.map(pu => (
                  <PowerUpCard key={pu.key} pu={pu} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Hint when no power-ups active */}
          {activePUs.length === 0 && (
            <div className="text-[8px] uppercase tracking-widest text-white/15 text-center">
              ← → to move · collect power-ups
            </div>
          )}
        </div>
      )}

      {/* ── ATTACKER: Right panel ────────────────────────────────────────── */}
      {role === 'ATTACKER' && (
        <div className="absolute bottom-4 right-3 flex flex-col items-end gap-2.5 pointer-events-auto">

          {/* Timer */}
          <div className="flex flex-col items-end gap-1 w-52 sm:w-64">
            <div className="flex items-center justify-between w-full">
              <span className="text-[8px] uppercase tracking-[0.3em] font-bold"
                style={{ color: timerCrit ? '#ff3333' : '#ff0055' }}>
                Time
              </span>
              <span className="font-black italic text-xl leading-none"
                style={{ color: timerCrit ? '#ff3333' : '#fff' }}>
                {d.timerSeconds}s
              </span>
            </div>
            <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden border border-white/10">
              <motion.div
                className="h-full rounded-full"
                animate={{ width: `${timerPct}%` }}
                transition={{ duration: 0.4 }}
                style={{
                  background: timerCrit
                    ? 'linear-gradient(90deg,#ff3333,#ff6600)'
                    : 'linear-gradient(90deg,#fff,#ccc)',
                  boxShadow: timerCrit ? '0 0 8px #ff333366' : '0 0 6px #fff4',
                }}
              />
            </div>
          </div>

          {/* Energy */}
          <div className="flex flex-col items-end gap-1 w-52 sm:w-64">
            <div className="flex items-center justify-between w-full">
              <span className="text-[8px] uppercase tracking-[0.3em] text-[#ff0055] font-bold">Energy</span>
              <span className="text-[10px] text-white/30 font-bold">{Math.floor(d.energy)}/100</span>
            </div>
            <div className="w-full h-3 bg-white/8 rounded-full overflow-hidden border border-white/10">
              <motion.div
                className="h-full rounded-full"
                animate={{ width: `${energyPct}%` }}
                transition={{ duration: 0.12 }}
                style={{
                  background: 'linear-gradient(90deg,#ff0055,#ff6600)',
                  boxShadow: '0 0 10px #ff005555',
                }}
              />
            </div>
            <span className="text-[7px] text-white/20 uppercase tracking-widest">
              Tap screen — 5E per drop
            </span>
          </div>

          {/* Abilities */}
          <div className="flex gap-2 mt-1">
            <AbilityBtn icon={<Skull size={15}/>}  label="SWARM" cost={22} energy={d.energy} color="#ff3300" onClick={()=>onTriggerAbility('SWARM')}/>
            <AbilityBtn icon={<Zap size={15}/>}    label="EMP"   cost={40} energy={d.energy} color="#ffcc00" onClick={()=>onTriggerAbility('EMP')}/>
            <AbilityBtn icon={<Shield size={15}/>} label="WALL"  cost={65} energy={d.energy} color="#00f2ff" onClick={()=>onTriggerAbility('FIREWALL')}/>
          </div>
        </div>
      )}

      {/* ── Touch hint (fades after 4s) ──────────────────────────────────── */}
      <TouchHint role={role} />
    </div>
  );
}

// ── Power-up card — BIG and unmissable ────────────────────────────────────────

function PowerUpCard({ pu }: {
  pu: { key: string; label: string; color: string; icon: React.ReactNode; frames: number }
}) {
  const pct = Math.max(0, Math.min(1, pu.frames / POWERUP_DURATION));

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      className="flex flex-col items-center gap-1 rounded-xl overflow-hidden"
      style={{
        background: pu.color + '1a',
        border: `2px solid ${pu.color}`,
        boxShadow: `0 0 16px ${pu.color}55, inset 0 0 8px ${pu.color}15`,
        minWidth: '60px',
        padding: '6px 8px',
      }}
    >
      {/* Icon */}
      <div style={{ color: pu.color, filter: `drop-shadow(0 0 6px ${pu.color})` }}>
        {pu.icon}
      </div>

      {/* Label */}
      <span className="text-[8px] font-black uppercase tracking-wider leading-none"
        style={{ color: pu.color }}>
        {pu.label}
      </span>

      {/* Countdown bar */}
      <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: pu.color + '25' }}>
        <motion.div
          className="h-full rounded-full"
          animate={{ width: `${pct * 100}%` }}
          transition={{ duration: 0.1 }}
          style={{ background: pu.color, boxShadow: `0 0 4px ${pu.color}` }}
        />
      </div>
    </motion.div>
  );
}

// ── Ability button ────────────────────────────────────────────────────────────

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
      className="flex flex-col items-center gap-1 p-2 rounded-xl border transition-all active:scale-95 w-14"
      style={canAfford ? {
        background:   color + '18',
        borderColor:  color + '66',
        color,
        boxShadow:    `0 0 8px ${color}22`,
      } : {
        background:   'rgba(255,255,255,0.03)',
        borderColor:  'rgba(255,255,255,0.06)',
        color:        'rgba(255,255,255,0.2)',
        cursor:       'not-allowed',
      }}
    >
      {icon}
      <span className="text-[7px] font-black tracking-widest">{label}</span>
      <span className="text-[6px] opacity-50">{cost}E</span>
    </button>
  );
}

// ── Touch hint ────────────────────────────────────────────────────────────────

function TouchHint({ role }: { role: Role }) {
  const [show, setShow] = useState(true);
  useEffect(() => { const t = setTimeout(() => setShow(false), 4000); return () => clearTimeout(t); }, []);
  if (!show) return null;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 0.45 }}
      exit={{ opacity: 0 }}
      className="absolute bottom-24 left-1/2 -translate-x-1/2 pointer-events-none text-center"
    >
      <p className="text-[9px] uppercase tracking-widest text-white/50">
        {role === 'ESCAPER' ? '← → Arrow keys or touch to move' : 'Tap / click anywhere to drop attack'}
      </p>
    </motion.div>
  );
}
