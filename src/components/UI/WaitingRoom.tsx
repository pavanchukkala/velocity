import { motion, AnimatePresence } from 'motion/react';
import { Users, Wifi, Copy, Check, Play, ArrowLeft, Bot } from 'lucide-react';
import { useState } from 'react';
import type { RemotePlayer, Role, RoomMode } from '../../types';

interface WaitingRoomProps {
  players: RemotePlayer[];
  role: Role;
  mode: RoomMode;
  roomId: string;
  localRoomData: { escaperCode: string; attackerCode: string; roomId: string } | null;
  onReady: () => void;
  onLeave: () => void;
}

export function WaitingRoom({
  players, role, mode, roomId, localRoomData, onReady, onLeave,
}: WaitingRoomProps) {
  const [copied, setCopied] = useState<string | null>(null);

  const escapers  = players.filter(p => p.role === 'ESCAPER');
  const attackers = players.filter(p => p.role === 'ATTACKER');

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  // Host is the first player in the room (whoever created it)
  // For local/online, allow starting once we have at least 1 of each role
  const canStart = escapers.length >= 1 && attackers.length >= 1;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 modal-bg flex flex-col items-center justify-center p-6 z-50"
    >
      {/* Header */}
      <motion.div
        initial={{ y: -16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="text-center mb-6"
      >
        <div className="flex items-center justify-center gap-2 mb-2">
          <Wifi size={16} className="text-[#00f2ff] animate-pulse" />
          <span className="text-[10px] uppercase tracking-[0.4em] text-[#00f2ff] font-bold">
            {mode === 'LOCAL' ? 'Private Room' : 'Match Lobby'}
          </span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight">
          Waiting for Players
        </h2>
        <p className="text-white/30 text-xs mt-1">
          You are: <span className="font-bold" style={{ color: role === 'ESCAPER' ? '#00ff88' : '#ff0055' }}>
            {role}
          </span>
        </p>
      </motion.div>

      {/* Teams display */}
      <div className="w-full max-w-lg grid grid-cols-2 gap-4 mb-6">
        {/* Escapers */}
        <TeamPanel
          title="Escapers"
          color="#00ff88"
          players={escapers}
          maxSlots={4}
        />
        {/* Attackers */}
        <TeamPanel
          title="Attackers"
          color="#ff0055"
          players={attackers}
          maxSlots={4}
        />
      </div>

      {/* Local room codes */}
      {mode === 'LOCAL' && localRoomData && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="w-full max-w-lg bg-white/5 border border-white/10 rounded-2xl p-4 mb-4"
        >
          <p className="text-[9px] uppercase tracking-widest text-white/40 text-center mb-3">
            Share these codes with your friends
          </p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Escaper Code', code: localRoomData.escaperCode, color: '#00ff88', key: 'esc' },
              { label: 'Attacker Code', code: localRoomData.attackerCode, color: '#ff0055', key: 'atk' },
            ].map(item => (
              <button
                key={item.key}
                onClick={() => copyText(item.code, item.key)}
                className="flex flex-col gap-1.5 p-3 bg-black/30 rounded-xl border border-white/10 hover:border-white/20 transition-all group"
              >
                <span className="text-[8px] uppercase font-bold tracking-widest" style={{ color: item.color }}>
                  {item.label}
                </span>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono font-bold">{item.code}</span>
                  {copied === item.key
                    ? <Check size={12} className="text-[#00ff88] shrink-0" />
                    : <Copy size={12} className="opacity-0 group-hover:opacity-50 shrink-0" />
                  }
                </div>
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Start / leave */}
      <div className="w-full max-w-lg flex flex-col gap-3">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={onReady}
          disabled={!canStart}
          className="relative w-full py-4 rounded-2xl font-black uppercase tracking-[0.3em] text-sm overflow-hidden disabled:opacity-30 cyber-btn shimmer"
          style={{
            background: canStart ? 'linear-gradient(135deg,#ff0055,#cc0044)' : 'rgba(255,255,255,0.06)',
            color: canStart ? '#fff' : 'rgba(255,255,255,0.3)',
            boxShadow: canStart ? '0 0 30px rgba(255,0,85,0.3)' : 'none',
          }}
        >
          <span className="relative z-10 flex items-center justify-center gap-2">
            <Play size={16} fill="currentColor" />
            {canStart ? 'Start Game' : 'Waiting for both teams…'}
          </span>
        </motion.button>

        <button
          onClick={onLeave}
          className="flex items-center justify-center gap-2 py-2.5 text-white/30 hover:text-white/60 transition-colors text-xs uppercase tracking-widest"
        >
          <ArrowLeft size={14} />
          Leave Room
        </button>
      </div>
    </motion.div>
  );
}

// ── Team panel ─────────────────────────────────────────────────────────────────

function TeamPanel({
  title, color, players, maxSlots,
}: {
  title: string; color: string; players: RemotePlayer[]; maxSlots: number;
}) {
  const slots = Array.from({ length: maxSlots });

  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[9px] uppercase font-black tracking-widest" style={{ color }}>
          {title}
        </span>
        <span className="text-[9px] text-white/30">{players.length}/{maxSlots}</span>
      </div>

      <div className="flex flex-col gap-1.5">
        {slots.map((_, i) => {
          const p = players[i];
          return (
            <AnimatePresence key={i}>
              {p ? (
                <motion.div
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-2 p-2 rounded-xl bg-white/5"
                >
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: p.color + '30', border: `1px solid ${p.color}60` }}
                  >
                    {p.isBot
                      ? <Bot size={10} style={{ color: p.color }} />
                      : <Users size={10} style={{ color: p.color }} />
                    }
                  </div>
                  <span className="text-[10px] font-bold truncate flex-1">{p.name}</span>
                  {p.isBot && (
                    <span className="text-[7px] uppercase tracking-widest text-white/25 shrink-0">AI</span>
                  )}
                </motion.div>
              ) : (
                <div className="flex items-center gap-2 p-2 rounded-xl border border-dashed border-white/8 opacity-40">
                  <div className="w-6 h-6 rounded-full border border-dashed border-white/20" />
                  <span className="text-[9px] text-white/20">Waiting…</span>
                </div>
              )}
            </AnimatePresence>
          );
        })}
      </div>
    </div>
  );
}
