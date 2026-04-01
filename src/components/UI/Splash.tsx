import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, Target, Users, Wifi, Globe, Home, ChevronRight } from 'lucide-react';

interface SplashProps {
  onEnter: () => void;
}

export function Splash({ onEnter }: SplashProps) {
  const [step, setStep] = useState<'intro' | 'tagline' | 'ready'>('intro');
  const [glitchActive, setGlitchActive] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setStep('tagline'), 900);
    const t2 = setTimeout(() => setStep('ready'), 1900);

    // Random glitch flashes
    const glitchInterval = setInterval(() => {
      if (Math.random() > 0.65) {
        setGlitchActive(true);
        setTimeout(() => setGlitchActive(false), 80 + Math.random() * 100);
      }
    }, 800);

    return () => { clearTimeout(t1); clearTimeout(t2); clearInterval(glitchInterval); };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 flex flex-col items-center justify-center overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at 50% 40%, rgba(0,242,255,0.06) 0%, #050505 65%)' }}
    >
      {/* Animated cyber grid */}
      <div className="absolute inset-0 cyber-grid opacity-25 pointer-events-none" />
      <div className="scanlines absolute inset-0 pointer-events-none" />

      {/* Floating particles */}
      <SplashParticles />

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center text-center px-6">

        {/* Logo */}
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 12, stiffness: 120 }}
          className={glitchActive ? 'glitch' : ''}
        >
          {/* Emblem */}
          <div className="mb-4 relative">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
              className="absolute inset-0 rounded-full border border-[#00f2ff]/20"
            />
            <motion.div
              animate={{ rotate: -360 }}
              transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
              className="w-20 h-20 mx-auto rounded-full border-2 border-[#ff0055]/40 flex items-center justify-center"
              style={{ boxShadow: '0 0 30px rgba(255,0,85,0.2), inset 0 0 20px rgba(0,242,255,0.1)' }}
            >
              <Zap size={32} className="text-[#ff0055]" style={{ filter: 'drop-shadow(0 0 12px #ff0055)' }} />
            </motion.div>
          </div>

          <h1 className="text-5xl sm:text-7xl font-black italic tracking-tighter leading-none mb-1">
            NEON{' '}
            <span
              className="text-[#ff0055]"
              style={{ textShadow: '0 0 20px rgba(255,0,85,0.7), 0 0 50px rgba(255,0,85,0.3)' }}
            >
              VELOCITY
            </span>
          </h1>
        </motion.div>

        {/* Divider */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="w-full max-w-xs h-[2px] bg-gradient-to-r from-transparent via-[#00f2ff] to-transparent my-3"
        />

        {/* Tagline */}
        <AnimatePresence>
          {step !== 'intro' && (
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-[#00f2ff] text-[9px] sm:text-[11px] uppercase tracking-[0.6em] sm:tracking-[1em] font-bold mb-8"
            >
              Cyber Escape Protocol
            </motion.p>
          )}
        </AnimatePresence>

        {/* Mode cards */}
        <AnimatePresence>
          {step === 'ready' && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="grid grid-cols-3 gap-3 mb-8 w-full max-w-xs sm:max-w-sm"
            >
              {[
                { icon: <Home size={16} />, label: 'Offline', sub: 'Solo', color: '#00ff88' },
                { icon: <Globe size={16} />, label: 'Online', sub: '4v4', color: '#00f2ff' },
                { icon: <Wifi size={16} />, label: 'Local', sub: 'Private', color: '#ff0055' },
              ].map((m, i) => (
                <motion.div
                  key={m.label}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 + i * 0.07 }}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl border"
                  style={{
                    background: m.color + '0c',
                    borderColor: m.color + '30',
                  }}
                >
                  <div style={{ color: m.color }}>{m.icon}</div>
                  <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: m.color }}>
                    {m.label}
                  </span>
                  <span className="text-[8px] text-white/25 uppercase tracking-wider">{m.sub}</span>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Role preview */}
        <AnimatePresence>
          {step === 'ready' && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex gap-4 mb-8 text-[9px] uppercase tracking-widest text-white/30"
            >
              <span className="flex items-center gap-1.5">
                <Zap size={12} className="text-[#00ff88]" />
                <span className="text-[#00ff88]/70">Escaper</span>
                <span>— Dodge & Survive</span>
              </span>
              <span className="text-white/15">|</span>
              <span className="flex items-center gap-1.5">
                <Target size={12} className="text-[#ff0055]" />
                <span className="text-[#ff0055]/70">Attacker</span>
                <span>— Hunt & Eliminate</span>
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Enter button */}
        <AnimatePresence>
          {step === 'ready' && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              onClick={onEnter}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="relative group px-14 py-4 rounded-2xl font-black uppercase tracking-[0.4em] text-sm overflow-hidden cyber-btn shimmer"
              style={{
                background: 'linear-gradient(135deg,#ff0055,#cc0044)',
                color: '#fff',
                boxShadow: '0 0 40px rgba(255,0,85,0.35)',
              }}
            >
              <span className="relative z-10 flex items-center gap-2">
                Enter System
                <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </span>
            </motion.button>
          )}
        </AnimatePresence>

        {/* Version */}
        <AnimatePresence>
          {step === 'ready' && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.2 }}
              transition={{ delay: 0.5 }}
              className="mt-6 text-[8px] uppercase tracking-[0.4em]"
            >
              v3.0 · Free to Play · No Download
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ── Floating particles ─────────────────────────────────────────────────────────

function SplashParticles() {
  const particles = Array.from({ length: 22 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 1 + Math.random() * 2,
    duration: 3 + Math.random() * 6,
    delay: Math.random() * 4,
    color: Math.random() > 0.5 ? '#00f2ff' : '#ff0055',
  }));

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map(p => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            background: p.color,
            boxShadow: `0 0 ${p.size * 3}px ${p.color}`,
          }}
          animate={{
            y: [0, -30 - Math.random() * 40, 0],
            opacity: [0, 0.7, 0],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}
