import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Volume2, VolumeX, Sparkles, AlertTriangle, Check, Bomb, Clock } from 'lucide-react';

interface FloatingIndicator {
  id: string;
  text: string;
  color: string;
  x: number;
  y: number;
}

interface EffectsEngineProps {
  triggerWinEffect?: boolean;
  triggerLossEffect?: boolean;
  triggerPointsEffect?: { teamName: string; amount: number } | null;
  onClearPointsEffect?: () => void;
}

export const EffectsEngine: React.FC<EffectsEngineProps> = ({
  triggerWinEffect,
  triggerLossEffect,
  triggerPointsEffect,
  onClearPointsEffect
}) => {
  const [muted, setMuted] = useState(false);
  const [floaters, setFloaters] = useState<FloatingIndicator[]>([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showExplosion, setShowExplosion] = useState(false);

  // Sound generator simulation using Web Audio API
  const playSimulatedSound = (type: 'win' | 'loss' | 'point' | 'bomb' | 'tick') => {
    if (muted) return;
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      
      if (type === 'point') {
        // High pleasant ding
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1); // A5
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      } else if (type === 'win') {
        // Arpeggio of victory
        const freqs = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        freqs.forEach((f, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(f, ctx.currentTime + i * 0.1);
          gain.gain.setValueAtTime(0.12, ctx.currentTime + i * 0.1);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.1 + 0.4);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + i * 0.1);
          osc.stop(ctx.currentTime + i * 0.1 + 0.4);
        });
      } else if (type === 'loss') {
        // Sad sliding down tone
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, ctx.currentTime); // A3
        osc.frequency.linearRampToValueAtTime(110, ctx.currentTime + 0.4); // A2
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      } else if (type === 'bomb') {
        // Noise explosion
        const bufferSize = ctx.sampleRate * 0.4;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, ctx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.4);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        noise.start();
      } else if (type === 'tick') {
        // High woodblock tick
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1500, ctx.currentTime);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.05);
      }
    } catch (e) {
      console.warn("Web Audio API not supported or blocked: ", e);
    }
  };

  useEffect(() => {
    if (triggerWinEffect) {
      setShowConfetti(true);
      playSimulatedSound('win');
      const t = setTimeout(() => setShowConfetti(false), 5000);
      return () => clearTimeout(t);
    }
  }, [triggerWinEffect]);

  useEffect(() => {
    if (triggerLossEffect) {
      setShowExplosion(true);
      playSimulatedSound('bomb');
      const t = setTimeout(() => setShowExplosion(false), 3000);
      return () => clearTimeout(t);
    }
  }, [triggerLossEffect]);

  useEffect(() => {
    if (triggerPointsEffect) {
      const { teamName, amount } = triggerPointsEffect;
      playSimulatedSound(amount > 0 ? 'point' : 'loss');
      
      const newFloater: FloatingIndicator = {
        id: `floater_${Date.now()}_${Math.random()}`,
        text: `${amount > 0 ? '▲ +' : '▼ '}${amount} لـ ${teamName}`,
        color: amount > 0 ? 'text-emerald-500 bg-emerald-50' : 'text-rose-500 bg-rose-50',
        x: Math.random() * 40 + 30, // Random percentage offset
        y: Math.random() * 20 + 40
      };

      setFloaters(prev => [...prev, newFloater]);
      
      const t = setTimeout(() => {
        setFloaters(prev => prev.filter(f => f.id !== newFloater.id));
      }, 2500);

      if (onClearPointsEffect) onClearPointsEffect();
      return () => clearTimeout(t);
    }
  }, [triggerPointsEffect]);

  return (
    <div className="relative pointer-events-none z-50">
      {/* Floaters render */}
      <AnimatePresence>
        {floaters.map(f => (
          <motion.div
            key={f.id}
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: -80 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 1.8, ease: "easeOut" }}
            style={{ left: `${f.x}%`, top: `${f.y}%` }}
            className={`fixed px-4 py-2 rounded-full font-black text-xs border border-current shadow-md flex items-center gap-1 z-50 ${f.color}`}
          >
            {f.text.includes('+') ? '🎉' : '⚠️'}
            <span>{f.text}</span>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Simulated Confetti Overlay */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none flex items-center justify-center overflow-hidden z-40">
          <div className="absolute w-full h-full bg-emerald-500/5 animate-pulse" />
          {[...Array(40)].map((_, i) => {
            const randomX = Math.random() * 100;
            const randomDelay = Math.random() * 2;
            const randomDuration = Math.random() * 3 + 2;
            const randomColor = ['bg-amber-400', 'bg-emerald-400', 'bg-cyan-400', 'bg-rose-400', 'bg-indigo-400'][i % 5];
            return (
              <motion.div
                key={i}
                initial={{ top: -20, left: `${randomX}%`, rotate: 0 }}
                animate={{ top: '110%', left: `${randomX + (Math.random() * 20 - 10)}%`, rotate: 360 }}
                transition={{
                  duration: randomDuration,
                  repeat: Infinity,
                  delay: randomDelay,
                  ease: "linear"
                }}
                className={`absolute w-3 h-3 rounded-xs ${randomColor} opacity-80`}
              />
            );
          })}
        </div>
      )}

      {/* Simulated Explosion Overlay */}
      {showExplosion && (
        <div className="fixed inset-0 pointer-events-none flex items-center justify-center z-40">
          <motion.div
            initial={{ scale: 0.1, opacity: 1 }}
            animate={{ scale: 3, opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="w-40 h-40 bg-gradient-to-r from-red-600 via-amber-500 to-yellow-400 rounded-full blur-xs mix-blend-screen"
          />
        </div>
      )}

      {/* Floating Sound Toggle controls - purely client option */}
      <div className="fixed bottom-4 left-4 pointer-events-auto z-40">
        <button
          onClick={() => setMuted(!muted)}
          className={`p-3 rounded-full shadow-lg border transition-all ${
            muted ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-amber-500 text-slate-950 border-amber-400 hover:scale-105'
          }`}
          title={muted ? 'كتم المؤثرات الصوتية' : 'تشغيل المؤثرات الصوتية'}
        >
          {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
};
