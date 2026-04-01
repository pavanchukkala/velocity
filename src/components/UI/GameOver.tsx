import { motion } from 'motion/react';
import { RotateCcw, Home, Trophy, AlertTriangle, Zap, Target, Clock } from 'lucide-react';
import type { Role, WinResult, RoomMode } from '../../types';

interface GameOverProps {
  score: number;
  highScore: number;
  level: number;
  role: Role;
  winResult: WinResult;
  mode: RoomMode;
  onRestart: () => void;
  onLobby: () => void;
}

export function GameOver({
  score, highScore, level, role, winResult, mode, onRestart, onLobby,
}: GameOverProps) {
  const isWin = getIsWin(role, winResult);
  const { headline, subline, accentColor, bgColor, icon } = getResultConfig(role, winResult, level);

  const isNewHigh = score > 0 && score >= highScore;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-center p-6 z-50 overflow-hidden"
    >
      {/* Background accents */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute top-0 left-0 w-full h-20 opacity-15"
          style={{
            background: `repeating-linear-gradient(45deg,${accentColor},${accentColor} 14px,#000 14px,#000 28px)`,
          }}
        />
        <div
          className="absolute bottom-0 left-0 w-full h-20 opacity-15"
          style={{
            background: `repeating-linear-gradient(45deg,${accentColor},${accentColor} 14px,#000 14px,#000 28px)`,
          }}
        />
        <div className="absolute top-1/3 left-0 w-full h-px opacity-20" style={{ background: accentColor }} />
        <div className="absolute top-2/3 left-0 w-full h-px opacity-10" style={{ background: accentColor }} />

        {/* Corner brackets */}
        {[
          'top-4 left-4 border-t-2 border-l-2',
          'top-4 right-4 border-t-2 border-r-2',
          'bottom-4 left-4 border-b-2 border-l-2',
          'bottom-4 right-4 border-b-2 border-r-2',
        ].map((cls, i) => (
          <div
            key={i}
            className={`absolute w-10 h-10 ${cls}`}
            style={{ borderColor: accentColor + '60' }}
          />
        ))}
      </div>

      {/* Main card */}
      <motion.div
        initial={{ scale: 0.85, y: 30, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 14, stiffness: 160 }}
        className="relative z-10 flex flex-col items-center text-center max-w-md w-full"
      >
        {/* Icon */}
        <motion.div
          animate={{ scale: [1, 1.08, 1], rotate: isWin ? [0, 5, -5, 0] : [0, -3, 3, 0] }}
          transition={{ duration: 0.4, repeat: Infinity, repeatDelay: 2.5 }}
          className="mb-5"
        >
          <div
            className="p-5 rounded-full"
            style={{
              background: accentColor + '18',
              boxShadow: `0 0 40px ${accentColor}44`,
              border: `2px solid ${accentColor}55`,
              color: accentColor,
            }}
          >
            {icon}
          </div>
        </motion.div>

        {/* Result badge */}
        <div
          className="px-3 py-1 text-[9px] font-black uppercase tracking-[0.3em] mb-3 rounded"
          style={{ background: accentColor, color: '#000' }}
        >
          {isWin ? '✓ Victory' : '✗ Eliminated'}
        </div>

        {/* Headline */}
        <h1
          className="text-5xl sm:text-7xl font-black italic tracking-tighter leading-none mb-2"
          style={{ color: accentColor, textShadow: `0 0 20px ${accentColor}66` }}
        >
          {headline}
        </h1>
        <p className="text-white/40 text-[10px] uppercase tracking-[0.4em] mb-8 flex items-center gap-2">
          <AlertTriangle size={10} />
          {subline}
          <AlertTriangle size={10} />
        </p>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-3 w-full mb-8">
          <StatCard
            label="Final Score"
            value={score.toLocaleString()}
            color={accentColor}
            highlight={isNewHigh}
          />
          <StatCard
            label="High Score"
            value={highScore.toLocaleString()}
            color="#ffcc00"
            icon={<Trophy size={14} className="text-[#ffcc00]" />}
          />
          <StatCard
            label="Sector"
            value={`${level}`}
            color="#00f2ff"
          />
        </div>

        {/* New high score flash */}
        {isNewHigh && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mb-4 px-4 py-1.5 bg-[#ffcc00]/15 border border-[#ffcc00]/40 rounded-full text-[#ffcc00] text-[10px] font-black uppercase tracking-widest"
          >
            🏆 New High Score!
          </motion.div>
        )}

        {/* Buttons */}
        <div className="flex flex-col gap-3 w-full">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onRestart}
            className="group relative w-full py-5 font-black italic text-xl tracking-tighter overflow-hidden cyber-btn shimmer rounded-xl"
            style={{
              background: `linear-gradient(135deg,${accentColor},${darken(accentColor, 20)})`,
              color: '#fff',
              boxShadow: `0 0 30px ${accentColor}44`,
            }}
          >
            <span className="relative flex items-center justify-center gap-3 z-10">
              <RotateCcw size={22} className="group-hover:rotate-180 transition-transform duration-500" />
              {mode === 'OFFLINE' ? 'Play Again' : 'New Match'}
            </span>
          </motion.button>

          <button
            onClick={onLobby}
            className="w-full py-3.5 bg-white/5 border border-white/10 rounded-xl text-white/50 hover:text-white hover:border-white/20 font-bold tracking-[0.3em] text-xs transition-all flex items-center justify-center gap-2"
          >
            <Home size={15} />
            Return to Lobby
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getIsWin(role: Role, result: WinResult): boolean {
  if (role === 'ESCAPER') return result === 'ESCAPERS_WIN' || result === 'TIME_EXPIRED';
  return result === 'ATTACKERS_WIN';
}

function getResultConfig(role: Role, result: WinResult, level: number) {
  if (role === 'ESCAPER') {
    if (result === 'ESCAPERS_WIN' || result === 'TIME_EXPIRED') {
      return {
        headline: 'ESCAPED',
        subline: `Survived ${level} sector${level > 1 ? 's' : ''} // System Outrun`,
        accentColor: '#00ff88',
        bgColor: '#00ff8815',
        icon: <Zap size={44} />,
      };
    }
    return {
      headline: 'TERMINATED',
      subline: `Connection severed // Sector ${level} lost`,
      accentColor: '#ff0055',
      bgColor: '#ff005515',
      icon: <AlertTriangle size={44} />,
    };
  } else {
    if (result === 'ATTACKERS_WIN') {
      return {
        headline: 'BREACH',
        subline: 'All targets eliminated // System overrun',
        accentColor: '#ff0055',
        bgColor: '#ff005515',
        icon: <Target size={44} />,
      };
    }
    return {
      headline: 'DEFEATED',
      subline: result === 'TIME_EXPIRED' ? 'Time expired // Target escaped' : 'Mission failed',
      accentColor: '#00f2ff',
      bgColor: '#00f2ff15',
      icon: <Clock size={44} />,
    };
  }
}

function darken(hex: string, amount: number): string {
  const num = parseInt(hex.slice(1), 16);
  const r = Math.max(0, (num >> 16) - amount);
  const g = Math.max(0, ((num >> 8) & 0xff) - amount);
  const b = Math.max(0, (num & 0xff) - amount);
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

// ── StatCard ──────────────────────────────────────────────────────────────────

function StatCard({
  label, value, color, highlight, icon,
}: {
  label: string; value: string; color: string; highlight?: boolean; icon?: React.ReactNode;
}) {
  return (
    <div
      className="p-3 sm:p-4 rounded-2xl border flex flex-col items-center gap-1 transition-all"
      style={{
        background: highlight ? color + '18' : 'rgba(255,255,255,0.04)',
        borderColor: highlight ? color + '50' : 'rgba(255,255,255,0.08)',
        boxShadow: highlight ? `0 0 20px ${color}22` : 'none',
      }}
    >
      {icon && <div className="mb-0.5">{icon}</div>}
      <span className="text-[9px] uppercase tracking-[0.2em] text-white/35 font-bold">{label}</span>
      <span
        className="text-2xl sm:text-3xl font-black italic leading-none"
        style={{ color: highlight ? color : '#fff' }}
      >
        {value}
      </span>
    </div>
  );
}
