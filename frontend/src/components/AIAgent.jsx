import { useState, useEffect, useRef, useCallback } from 'react'
import { Zap, Cpu } from 'lucide-react'

const statuses = [
  'Watching moderator activity...',
  'Analyzing live conversations...',
  'Checking SLA performance...',
  'Monitoring delayed conversations...',
  'Inspecting webhook activity...',
  'Scanning system health...',
  'Reviewing response quality...',
  'Everything is operating normally.',
]

const REACTIONS = ['look_widget', 'scan', 'raise_hand', 'touch_holo', 'nod', 'glance_user', 'process', 'idle']
const ACTION_INTERVAL_MS = 5000

const particles = Array.from({ length: 12 }, (_, i) => ({
  id: i,
  size: 0.25 + Math.random() * 0.2,
  top: 40 + Math.random() * 40,
  left: 10 + Math.random() * 80,
  delay: i * 0.4,
  duration: 4 + Math.random() * 2,
  color: i % 3 === 0
    ? `rgba(6,182,212,${0.3 + Math.random() * 0.3})`
    : i % 3 === 1
      ? `rgba(34,211,238,${0.2 + Math.random() * 0.2})`
      : `rgba(99,102,241,${0.2 + Math.random() * 0.2})`,
}))

function useRefreshFlag(lastUpdated) {
  const [flash, setFlash] = useState(false)
  const prev = useRef(lastUpdated)
  useEffect(() => {
    if (lastUpdated && lastUpdated !== prev.current) {
      prev.current = lastUpdated
      setFlash(true)
      setTimeout(() => setFlash(false), 800)
    }
  }, [lastUpdated])
  return flash
}

export default function AIAgent({ status, lastUpdated, insights, currentInsight, thinking, onInsightChange, stats }) {
  const [liveStatus, setLiveStatus] = useState(0)
  const [reaction, setReaction] = useState('idle')
  const [ringSpeed, setRingSpeed] = useState(1)
  const [particleBoost, setParticleBoost] = useState(false)
  const refreshFlash = useRefreshFlag(lastUpdated)
  const reactionTimerRef = useRef(null)
  const speedTimerRef = useRef(null)

  const scheduleNextReaction = useCallback(() => {
    const delay = ACTION_INTERVAL_MS + Math.random() * 4000
    reactionTimerRef.current = setTimeout(() => {
      let next = REACTIONS[Math.floor(Math.random() * REACTIONS.length)]
      while (next === reaction && REACTIONS.length > 1) {
        next = REACTIONS[Math.floor(Math.random() * REACTIONS.length)]
      }
      setReaction(next)
      if (next === 'scan' || next === 'raise_hand' || next === 'touch_holo') {
        setRingSpeed(2.5)
        speedTimerRef.current = setTimeout(() => setRingSpeed(1), 1200)
      }
      setTimeout(() => {
        setReaction('idle')
        scheduleNextReaction()
      }, 2000 + Math.random() * 1500)
    }, delay)
  }, [reaction])

  useEffect(() => {
    scheduleNextReaction()
    return () => {
      if (reactionTimerRef.current) clearTimeout(reactionTimerRef.current)
      if (speedTimerRef.current) clearTimeout(speedTimerRef.current)
    }
  }, [scheduleNextReaction])

  useEffect(() => {
    const interval = setInterval(() => {
      setLiveStatus((p) => (p + 1) % statuses.length)
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (refreshFlash) {
      setParticleBoost(true)
      const t = setTimeout(() => setParticleBoost(false), 1500)
      return () => clearTimeout(t)
    }
  }, [refreshFlash])

  const isWarning = status?.level === 'warning' || (stats?.delayed_conversations || 0) > 0
  const isCritical = status?.level === 'critical' || (stats?.delayed_conversations || 0) > 3
  const accentHue = isCritical ? '#f43f5e' : isWarning ? '#f59e0b' : '#06b6d4'
  const accentDim = isCritical ? '#f43f5e' : isWarning ? '#f59e0b' : '#22d3ee'
  const angryEyes = isCritical ? '#f43f5e' : '#06b6d4'

  return (
    <div className={`relative overflow-hidden rounded-2xl border backdrop-blur-sm transition-all duration-700 ${
      refreshFlash ? 'border-cyan-400/70 shadow-lg shadow-cyan-500/10' : 'border-slate-700/40'
    } bg-slate-900/70`}>
      <style>{`
        @keyframes af-float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        @keyframes af-float-delayed {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        @keyframes af-breathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.015); }
        }
        @keyframes af-breathe-head {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.008); }
        }
        @keyframes af-scan {
          0% { top: 0%; opacity: 0; }
          12% { opacity: 0.9; }
          88% { opacity: 0.9; }
          100% { top: 100%; opacity: 0; }
        }
        @keyframes af-ring-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        @keyframes af-ring-spin-reverse { 0% { transform: rotate(0deg); } 100% { transform: rotate(-360deg); } }
        @keyframes af-ring-spin-fast { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        @keyframes af-ring-spin-rev-fast { 0% { transform: rotate(0deg); } 100% { transform: rotate(-360deg); } }
        @keyframes af-glow-pulse {
          0%, 100% { opacity: 0.35; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.08); }
        }
        @keyframes af-core-pulse {
          0%, 100% { opacity: 0.7; transform: scale(1); box-shadow: 0 0 12px 4px rgba(6,182,212,0.3); }
          50% { opacity: 1; transform: scale(1.05); box-shadow: 0 0 24px 8px rgba(6,182,212,0.5); }
        }
        @keyframes af-blink {
          0%, 95%, 100% { transform: scaleY(1); opacity: 1; }
          97.5% { transform: scaleY(0.08); opacity: 0.3; }
        }
        @keyframes af-eye-glow {
          0%, 100% { filter: drop-shadow(0 0 4px rgba(6,182,212,0.5)); }
          50% { filter: drop-shadow(0 0 12px rgba(6,182,212,0.8)); }
        }
        @keyframes af-arm-swing {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(3deg); }
          75% { transform: rotate(-3deg); }
        }
        @keyframes af-particle-float {
          0% { transform: translateY(0) translateX(0) scale(1); opacity: 0; }
          15% { opacity: 0.7; }
          85% { opacity: 0.7; }
          100% { transform: translateY(-70px) translateX(25px) scale(0.3); opacity: 0; }
        }
        @keyframes af-particles-more {
          0% { transform: translateY(0) translateX(0) scale(1); opacity: 0; }
          10% { opacity: 0.9; }
          90% { opacity: 0.9; }
          100% { transform: translateY(-90px) translateX(35px) scale(0.2); opacity: 0; }
        }
        @keyframes af-status-cycle {
          0% { opacity: 0; transform: translateY(10px); }
          15% { opacity: 1; transform: translateY(0); }
          85% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-10px); }
        }
        @keyframes af-typing-dot {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        @keyframes af-grid-scroll {
          0% { transform: translateY(0); }
          100% { transform: translateY(40px); }
        }
        @keyframes af-data-stream {
          0% { transform: translateY(-100%); opacity: 0; }
          20% { opacity: 0.6; }
          80% { opacity: 0.6; }
          100% { transform: translateY(100%); opacity: 0; }
        }
        @keyframes af-ring-orbit {
          0% { transform: rotate(0deg) translateX(52px) rotate(0deg); }
          100% { transform: rotate(360deg) translateX(52px) rotate(-360deg); }
        }
        @keyframes af-ring-orbit-reverse {
          0% { transform: rotate(0deg) translateX(45px) rotate(0deg); }
          100% { transform: rotate(-360deg) translateX(45px) rotate(360deg); }
        }
        @keyframes af-neon-pulse {
          0%, 100% { opacity: 0.15; }
          50% { opacity: 0.4; }
        }
        @keyframes af-orbit-dot {
          0% { transform: rotate(0deg) translateX(60px) rotate(0deg); }
          100% { transform: rotate(360deg) translateX(60px) rotate(-360deg); }
        }
        @keyframes af-orbit-dot2 {
          0% { transform: rotate(0deg) translateX(55px) rotate(0deg); }
          100% { transform: rotate(-360deg) translateX(55px) rotate(360deg); }
        }
        @keyframes af-nod {
          0%, 100% { transform: rotate(0deg); }
          20% { transform: rotate(-4deg); }
          40% { transform: rotate(4deg); }
          60% { transform: rotate(-3deg); }
        }
        @keyframes af-raise-hand {
          0%, 100% { transform: rotate(0deg); }
          30% { transform: rotate(-20deg); }
          70% { transform: rotate(-20deg); }
        }
        @keyframes af-look-widget {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(8deg); }
          75% { transform: rotate(8deg); }
        }
        @keyframes af-touch-holo {
          0%, 100% { transform: translateX(0) rotate(0deg); }
          25% { transform: translateX(10px) rotate(-10deg); }
          75% { transform: translateX(10px) rotate(-10deg); }
        }
        @keyframes af-processing {
          0%, 100% { filter: brightness(1); }
          25% { filter: brightness(1.2); }
          50% { filter: brightness(0.8); }
          75% { filter: brightness(1.3); }
        }
        @keyframes af-scan-ring-out {
          0% { transform: scale(0.8); opacity: 0; }
          20% { opacity: 0.6; }
          100% { transform: scale(1.3); opacity: 0; }
        }
        @keyframes af-eye-flash {
          0%, 100% { filter: drop-shadow(0 0 4px rgba(6,182,212,0.5)) brightness(1); }
          50% { filter: drop-shadow(0 0 30px rgba(6,182,212,1)) brightness(2); }
        }
        @keyframes af-head-gesture {
          0%, 100% { transform: rotate(0deg); }
          30% { transform: rotate(-6deg); }
          60% { transform: rotate(6deg); }
        }
        @keyframes af-energy-wave {
          0% { transform: scale(1); opacity: 0.3; }
          100% { transform: scale(2.5); opacity: 0; }
        }

        .af-float { animation: af-float 5s ease-in-out infinite; }
        .af-ring { animation: af-ring-spin var(--speed, 8s) linear infinite; }
        .af-ring-rev { animation: af-ring-spin-reverse var(--speed, 6s) linear infinite; }
        .af-scan { animation: af-scan 3.5s ease-in-out infinite; }
        .af-particle { animation: af-particle-float 5s ease-in-out infinite; }
        .af-particle.boost { animation: af-particles-more 3s ease-in-out infinite; }
        .af-pulse { animation: af-glow-pulse 4s ease-in-out infinite; }
        .af-core { animation: af-core-pulse 3s ease-in-out infinite; }
        .af-eye-pulse { animation: af-eye-glow 3s ease-in-out infinite, af-blink 5s ease-in-out infinite; }
        .af-arm-swing { animation: af-arm-swing 6s ease-in-out infinite; }
        .af-status-text { animation: af-status-cycle 5s ease-in-out infinite; }
        .af-typing { animation: af-typing-dot 1.2s ease-in-out infinite; }
        .af-grid { animation: af-grid-scroll 8s linear infinite; }
        .af-data-stream { animation: af-data-stream 4s ease-in-out infinite; }
        .af-neon-cycle { animation: af-neon-pulse 3s ease-in-out infinite; }
        .af-orbit { animation: af-orbit-dot 12s linear infinite; }
        .af-orbit2 { animation: af-orbit-dot2 10s linear infinite; }
        .af-energy-wave { animation: af-energy-wave 2s ease-out infinite; }

        .af-head-turn { animation: none; }
        .af-arm-wave { animation: none; }
        .af-arm-reach { animation: none; }
        .af-body-process { animation: none; }

        .af-reaction-look .af-head-turn { animation: af-look-widget 2.5s ease-in-out 1; }
        .af-reaction-look .af-arm-wave { animation: af-arm-swing 2.5s ease-in-out 1; }
        .af-reaction-scan .af-body-process { animation: af-processing 2s ease-in-out 1; }
        .af-reaction-scan .af-scan-line { opacity: 0.6 !important; }
        .af-reaction-raise .af-arm-wave { animation: af-raise-hand 2s ease-in-out 1; }
        .af-reaction-touch .af-arm-reach { animation: af-touch-holo 2.5s ease-in-out 1; }
        .af-reaction-nod .af-head-turn { animation: af-nod 1.5s ease-in-out 1; }
        .af-reaction-glance .af-head-turn { animation: af-head-gesture 2s ease-in-out 1; }
        .af-reaction-process .af-body-process { animation: af-processing 2.5s ease-in-out 1; }

        .af-ring-speed-2 { --speed: 3.2s; }
        .af-ring-speed-1 { --speed: 8s; }
        .af-ring-rev-speed-2 { --speed: 2.4s; }
        .af-ring-rev-speed-1 { --speed: 6s; }
      `}</style>

      <div className={`p-6 ${reaction === 'scan' ? 'af-reaction-scan' : ''} ${
        reaction === 'look_widget' ? 'af-reaction-look' : ''
      } ${reaction === 'raise_hand' ? 'af-reaction-raise' : ''} ${
        reaction === 'touch_holo' ? 'af-reaction-touch' : ''
      } ${reaction === 'nod' ? 'af-reaction-nod' : ''} ${
        reaction === 'glance_user' ? 'af-reaction-glance' : ''
      } ${reaction === 'process' ? 'af-reaction-process' : ''}`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <span className="relative inline-flex items-center">
              <span className={`w-2.5 h-2.5 rounded-full absolute animate-ping ${
                isCritical ? 'bg-rose-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500'
              }`} />
              <span className={`w-2.5 h-2.5 rounded-full relative ${
                isCritical ? 'bg-rose-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500'
              }`} />
            </span>
            <div>
              <span className="text-xs font-bold text-slate-300 tracking-widest uppercase">AI Monitoring</span>
              <div className="flex items-center gap-2 text-[10px] text-slate-500">
                <Cpu className="w-3 h-3" />
                <span>v2.0 · active</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-slate-600 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 af-typing" />
            {statuses[liveStatus]}
          </div>
        </div>

        {/* Main content */}
        <div className="flex flex-col lg:flex-row items-center gap-8">
          {/* Robot + Holographic Environment */}
          <div className="relative w-52 h-52 lg:w-56 lg:h-56 flex-shrink-0">
            {/* Digital Grid Background */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 224 224">
              <defs>
                <pattern id="grid" width="16" height="16" patternUnits="userSpaceOnUse">
                  <path d="M 16 0 L 0 0 0 16" fill="none" stroke="rgba(6,182,212,0.06)" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" className="af-grid" />
            </svg>

            {/* Energy platform */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-3">
              <div className={`w-full h-full rounded-full blur-xl transition-colors duration-700 ${
                isCritical ? 'bg-rose-500/30' : isWarning ? 'bg-amber-500/30' : 'bg-cyan-500/30'
              } af-pulse`} />
              <div className={`absolute inset-0 rounded-full blur-md transition-colors duration-700 ${
                isCritical ? 'bg-rose-400/20' : isWarning ? 'bg-amber-400/20' : 'bg-cyan-400/20'
              }`} />
            </div>

            {/* Energy wave */}
            {refreshFlash && (
              <div className={`absolute bottom-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full border-2 transition-colors duration-700 ${
                isCritical ? 'border-rose-400' : isWarning ? 'border-amber-400' : 'border-cyan-400'
              } af-energy-wave`} />
            )}

            {/* Holographic orbit rings */}
            <div className={`absolute inset-0 af-ring ${ringSpeed > 1 ? 'af-ring-speed-2' : 'af-ring-speed-1'}`}>
              <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[104px] h-[104px] rounded-full border transition-colors duration-700 ${
                isCritical ? 'border-rose-500/20' : isWarning ? 'border-amber-500/20' : 'border-cyan-500/20'
              }`} />
            </div>
            <div className={`absolute inset-0 af-ring-rev ${ringSpeed > 1 ? 'af-ring-rev-speed-2' : 'af-ring-rev-speed-1'}`}>
              <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90px] h-[90px] rounded-full border border-dashed transition-colors duration-700 ${
                isCritical ? 'border-rose-400/15' : isWarning ? 'border-amber-400/15' : 'border-cyan-400/15'
              }`} />
            </div>

            {/* Orbit dots */}
            <div className="absolute inset-0 af-orbit pointer-events-none">
              <div className={`absolute top-1/2 left-1/2 w-1.5 h-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full transition-colors duration-700 ${
                isCritical ? 'bg-rose-400/60' : isWarning ? 'bg-amber-400/60' : 'bg-cyan-400/60'
              }`} />
            </div>
            <div className="absolute inset-0 af-orbit2 pointer-events-none">
              <div className={`absolute top-1/2 left-1/2 w-1 h-1 -translate-x-1/2 -translate-y-1/2 rounded-full transition-colors duration-700 ${
                isCritical ? 'bg-rose-300/50' : isWarning ? 'bg-amber-300/50' : 'bg-cyan-300/50'
              }`} />
            </div>

            {/* Floating particles */}
            {particles.map((p) => (
              <div
                key={p.id}
                className={`absolute rounded-full pointer-events-none transition-all duration-700 ${
                  particleBoost ? 'boost' : ''
                } af-particle`}
                style={{
                  width: `${p.size}rem`,
                  height: `${p.size}rem`,
                  top: `${p.top}%`,
                  left: `${p.left}%`,
                  animationDelay: `${p.delay}s`,
                  animationDuration: `${p.duration}s`,
                  backgroundColor: p.color,
                }}
              />
            ))}

            {/* Neon circle accents */}
            <div className={`absolute top-4 left-3 w-2 h-2 rounded-full transition-colors duration-700 ${isCritical ? 'bg-rose-500/30' : isWarning ? 'bg-amber-500/30' : 'bg-cyan-500/30'} af-neon-cycle`} />
            <div className={`absolute top-4 right-3 w-2 h-2 rounded-full transition-colors duration-700 ${isCritical ? 'bg-rose-500/20' : isWarning ? 'bg-amber-500/20' : 'bg-cyan-500/20'} af-neon-cycle`} style={{ animationDelay: '1.5s' }} />

            {/* HUD corner brackets */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 224 224">
              <path d="M 20 20 L 20 8 L 32 8" fill="none" stroke={accentDim} strokeWidth="1" opacity="0.3" />
              <path d="M 204 20 L 204 8 L 192 8" fill="none" stroke={accentDim} strokeWidth="1" opacity="0.3" />
              <path d="M 20 204 L 20 216 L 32 216" fill="none" stroke={accentDim} strokeWidth="1" opacity="0.3" />
              <path d="M 204 204 L 204 216 L 192 216" fill="none" stroke={accentDim} strokeWidth="1" opacity="0.3" />
            </svg>

            {/* Data streams (vertical lines) */}
            <div className="absolute left-1 top-0 bottom-0 w-px overflow-hidden opacity-30">
              <div className="af-data-stream w-full h-8 bg-gradient-to-b from-transparent to-cyan-400" />
            </div>
            <div className="absolute right-1 top-0 bottom-0 w-px overflow-hidden opacity-30">
              <div className="af-data-stream w-full h-8 bg-gradient-to-b from-transparent to-cyan-400" style={{ animationDelay: '2s' }} />
            </div>

            {/* Scanning beam */}
            <div className="af-scan absolute left-4 right-4 h-px bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent pointer-events-none z-10" />

            {/* ====== SVG ROBOT ====== */}
            <div className="af-float absolute inset-0 flex items-center justify-center">
              <svg viewBox="0 0 200 240" className="w-36 h-44 lg:w-40 lg:h-48" style={{ filter: 'drop-shadow(0 0 20px rgba(6,182,212,0.08))' }}>
                <defs>
                  <linearGradient id="metalBody" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#f0f4f8" />
                    <stop offset="40%" stopColor="#e2e8f0" />
                    <stop offset="100%" stopColor="#cbd5e1" />
                  </linearGradient>
                  <linearGradient id="metalDark" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#94a3b8" />
                    <stop offset="100%" stopColor="#64748b" />
                  </linearGradient>
                  <linearGradient id="metalShine" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.6" />
                    <stop offset="50%" stopColor="#f1f5f9" stopOpacity="0.1" />
                    <stop offset="100%" stopColor="#e2e8f0" stopOpacity="0.3" />
                  </linearGradient>
                  <linearGradient id="shoulderGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#e2e8f0" />
                    <stop offset="100%" stopColor="#94a3b8" />
                  </linearGradient>
                  <linearGradient id="armGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#cbd5e1" />
                    <stop offset="50%" stopColor="#f1f5f9" />
                    <stop offset="100%" stopColor="#cbd5e1" />
                  </linearGradient>
                  <radialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#22d3ee" stopOpacity="1" />
                    <stop offset="40%" stopColor="#06b6d4" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#0891b2" stopOpacity="0.3" />
                  </radialGradient>
                  <radialGradient id="eyeGlowGrad" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="30%" stopColor="#22d3ee" />
                    <stop offset="100%" stopColor="#06b6d4" />
                  </radialGradient>
                  <linearGradient id="antennaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22d3ee" />
                    <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.5" />
                  </linearGradient>
                  <linearGradient id="faceGloss" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0f172a" />
                    <stop offset="100%" stopColor="#1e293b" />
                  </linearGradient>
                  <radialGradient id="platformGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.5" />
                    <stop offset="60%" stopColor="#0891b2" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
                  </radialGradient>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="2" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                  <filter id="glowStrong">
                    <feGaussianBlur stdDeviation="4" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                </defs>

                {/* Platform glow */}
                <ellipse cx="100" cy="230" rx="55" ry="6" fill="url(#platformGlow)" />
                <ellipse cx="100" cy="230" rx="30" ry="3" fill="#06b6d4" opacity="0.15" />

                {/* Legs */}
                <rect x="72" y="200" width="12" height="22" rx="5" fill="url(#metalDark)" />
                <rect x="116" y="200" width="12" height="22" rx="5" fill="url(#metalDark)" />
                <rect x="74" y="200" width="3" height="22" rx="1.5" fill="#fff" opacity="0.08" />
                <rect x="118" y="200" width="3" height="22" rx="1.5" fill="#fff" opacity="0.08" />

                {/* Feet */}
                <rect x="66" y="218" width="24" height="6" rx="3" fill="url(#metalDark)" />
                <rect x="110" y="218" width="24" height="6" rx="3" fill="url(#metalDark)" />
                <rect x="66" y="218" width="3" height="6" rx="1.5" fill="#06b6d4" opacity="0.2" />
                <rect x="131" y="218" width="3" height="6" rx="1.5" fill="#06b6d4" opacity="0.2" />

                {/* === LEFT ARM === */}
                <g className="af-arm-swing" style={{ transformOrigin: '60px 110px' }}>
                  <rect x="50" y="108" width="14" height="50" rx="7" fill="url(#armGrad)" />
                  <rect x="50" y="108" width="3" height="50" rx="1.5" fill="#fff" opacity="0.15" />
                  {/* Elbow joint */}
                  <circle cx="57" cy="155" r="8" fill="url(#metalDark)" />
                  <circle cx="57" cy="155" r="3" fill="#06b6d4" opacity="0.2" />
                  {/* Hand */}
                  <circle cx="57" cy="165" r="6" fill="url(#metalDark)" />
                  <circle cx="57" cy="165" r="2" fill="#06b6d4" opacity="0.15" />
                </g>

                {/* === RIGHT ARM === */}
                <g className={`af-arm-swing ${reaction === 'raise_hand' ? 'af-arm-wave' : ''} ${reaction === 'touch_holo' ? 'af-arm-reach' : ''}`}
                   style={{ transformOrigin: '140px 110px', animationDelay: '0.3s' }}>
                  <rect x="136" y="108" width="14" height="50" rx="7" fill="url(#armGrad)" />
                  <rect x="147" y="108" width="3" height="50" rx="1.5" fill="#fff" opacity="0.15" />
                  <circle cx="143" cy="155" r="8" fill="url(#metalDark)" />
                  <circle cx="143" cy="155" r="3" fill="#06b6d4" opacity="0.2" />
                  <circle cx="143" cy="165" r="6" fill="url(#metalDark)" />
                  <circle cx="143" cy="165" r="2" fill="#06b6d4" opacity="0.15" />
                </g>

                {/* === BODY / TORSO === */}
                <path d="M68 90 Q68 82 78 82 L122 82 Q132 82 132 90 L138 190 Q138 200 128 200 L72 200 Q62 200 62 190 Z"
                      fill="url(#metalBody)" stroke="#cbd5e1" strokeWidth="0.5" />

                {/* Body highlight/reflection */}
                <path d="M75 90 L72 190 Q72 195 78 195 L100 195 L105 90 Z"
                      fill="url(#metalShine)" opacity="0.3" />

                {/* Chest panel lines */}
                <line x1="78" y1="110" x2="122" y2="110" stroke="#94a3b8" strokeWidth="0.5" opacity="0.4" />
                <line x1="78" y1="115" x2="122" y2="115" stroke="#94a3b8" strokeWidth="0.5" opacity="0.3" />
                <line x1="78" y1="120" x2="122" y2="120" stroke="#94a3b8" strokeWidth="0.5" opacity="0.2" />

                {/* Chest core */}
                <circle cx="100" cy="148" r="16" fill="url(#coreGlow)" className="af-core" filter="url(#glow)" />
                <circle cx="100" cy="148" r="6" fill="#22d3ee" opacity="0.6" filter="url(#glowStrong)" />
                <circle cx="100" cy="148" r="2" fill="#ffffff" opacity="0.8" />

                {/* Core ring accents */}
                <circle cx="100" cy="148" r="20" fill="none" stroke="#06b6d4" strokeWidth="1" opacity="0.15" />
                <circle cx="100" cy="148" r="12" fill="none" stroke="#22d3ee" strokeWidth="0.5" opacity="0.3" />

                {/* Lower body vent lines */}
                <line x1="85" y1="180" x2="115" y2="180" stroke="#94a3b8" strokeWidth="1" opacity="0.3" />
                <line x1="85" y1="186" x2="115" y2="186" stroke="#94a3b8" strokeWidth="1" opacity="0.2" />
                <line x1="85" y1="192" x2="115" y2="192" stroke="#94a3b8" strokeWidth="1" opacity="0.1" />

                {/* === SHOULDERS === */}
                <rect x="44" y="86" width="28" height="16" rx="8" fill="url(#shoulderGrad)" stroke="#94a3b8" strokeWidth="0.5" />
                <rect x="44" y="86" width="4" height="16" rx="2" fill="#06b6d4" opacity="0.15" />
                <rect x="128" y="86" width="28" height="16" rx="8" fill="url(#shoulderGrad)" stroke="#94a3b8" strokeWidth="0.5" />
                <rect x="152" y="86" width="4" height="16" rx="2" fill="#06b6d4" opacity="0.15" />

                {/* Shoulder accents */}
                <circle cx="56" cy="94" r="2" fill="#06b6d4" opacity="0.2" />
                <circle cx="144" cy="94" r="2" fill="#06b6d4" opacity="0.2" />

                {/* === NECK === */}
                <rect x="88" y="77" width="24" height="10" rx="4" fill="url(#metalDark)" />
                <rect x="90" y="77" width="3" height="10" rx="1.5" fill="#fff" opacity="0.1" />

                {/* === HEAD === */}
                <g className="af-head-turn" style={{ transformOrigin: '100px 75px' }}>
                  {/* Head main shape */}
                  <rect x="58" y="15" width="84" height="65" rx="16" fill="url(#metalBody)" stroke="#cbd5e1" strokeWidth="0.5" />

                  {/* Head reflection */}
                  <path d="M65 20 L65 70 Q65 75 75 75 L100 75 L100 20 Z"
                        fill="url(#metalShine)" opacity="0.2" />

                  {/* Head side accents */}
                  <rect x="58" y="30" width="3" height="35" rx="1.5" fill="#22d3ee" opacity="0.1" />
                  <rect x="139" y="30" width="3" height="35" rx="1.5" fill="#22d3ee" opacity="0.1" />

                  {/* === FACE PANEL === */}
                  <rect x="67" y="23" width="66" height="48" rx="10" fill="url(#faceGloss)" />
                  <rect x="67" y="23" width="66" height="48" rx="10" fill="#000" opacity="0.2" />

                  {/* Face panel inner border */}
                  <rect x="69" y="25" width="62" height="44" rx="8" fill="none" stroke="#06b6d4" strokeWidth="0.5" opacity="0.15" />

                  {/* === EYES === */}
                  <g filter="url(#glow)">
                    <ellipse cx="82" cy="44" rx="9" ry="7" fill="url(#eyeGlowGrad)" className="af-eye-pulse" />
                    <ellipse cx="118" cy="44" rx="9" ry="7" fill="url(#eyeGlowGrad)" className="af-eye-pulse" style={{ animationDelay: '0.15s' }} />
                  </g>

                  {/* Eye inner bright dots */}
                  <ellipse cx="84" cy="42" rx="3" ry="2.5" fill="#ffffff" opacity="0.9" />
                  <ellipse cx="120" cy="42" rx="3" ry="2.5" fill="#ffffff" opacity="0.9" />

                  {/* Eye outer glow rings */}
                  <ellipse cx="82" cy="44" rx="12" ry="10" fill="none" stroke="#22d3ee" strokeWidth="1" opacity="0.15" />
                  <ellipse cx="118" cy="44" rx="12" ry="10" fill="none" stroke="#22d3ee" strokeWidth="1" opacity="0.15" />

                  {/* === VISOR / EYEBROW LINE === */}
                  <line x1="70" y1="34" x2="94" y2="34" stroke="#22d3ee" strokeWidth="0.5" opacity="0.2" />
                  <line x1="106" y1="34" x2="130" y2="34" stroke="#22d3ee" strokeWidth="0.5" opacity="0.2" />

                  {/* === MOUTH === */}
                  <rect x="88" y="58" width="24" height="2" rx="1" fill="#22d3ee" opacity="0.5" />
                  <rect x="88" y="61" width="8" height="1.5" rx="0.75" fill="#22d3ee" opacity="0.3" />
                  <rect x="104" y="61" width="8" height="1.5" rx="0.75" fill="#22d3ee" opacity="0.3" />

                  {/* === ANTENNA === */}
                  <line x1="100" y1="15" x2="100" y2="5" stroke="url(#antennaGrad)" strokeWidth="2.5" strokeLinecap="round" />
                  <circle cx="100" cy="3" r="4" fill="#22d3ee" filter="url(#glowStrong)" />
                  <circle cx="100" cy="3" r="1.5" fill="#ffffff" opacity="0.8" />
                </g>

                {/* ====== HOLOGRAPHIC RING INNER SVG ====== */}
                <ellipse cx="100" cy="160" rx="28" ry="6" fill="none" stroke="#22d3ee" strokeWidth="0.5" opacity="0.12" />
              </svg>
            </div>
          </div>

          {/* ====== AI STATUS PANEL ====== */}
          <div className="flex-1 min-w-0 w-full lg:w-auto">
            {/* Live status dots */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400 af-typing" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-cyan-400 af-typing" style={{ animationDelay: '200ms' }} />
                <span className="w-2 h-2 rounded-full bg-cyan-400 af-typing" style={{ animationDelay: '400ms' }} />
              </div>
              <span className="text-[11px] text-cyan-500/70 font-mono tracking-wider uppercase af-status-text">
                {statuses[liveStatus]}
              </span>
            </div>

            {/* Insights area */}
            <div className="relative min-h-[100px]">
              {thinking ? (
                <div className="flex items-center gap-3 text-slate-500 py-4">
                  <div className="flex gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-cyan-500/60 af-typing" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 rounded-full bg-cyan-500/60 af-typing" style={{ animationDelay: '200ms' }} />
                    <span className="w-2 h-2 rounded-full bg-cyan-500/60 af-typing" style={{ animationDelay: '400ms' }} />
                  </div>
                  <span className="text-sm text-slate-500 font-mono italic">Analyzing live data...</span>
                </div>
              ) : (
                <div>
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors duration-700 ${
                      isCritical ? 'bg-rose-500/15 text-rose-400' : isWarning ? 'bg-amber-500/15 text-amber-400' : 'bg-cyan-500/15 text-cyan-400'
                    }`}>
                      <Zap className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p key={currentInsight} className="text-sm text-slate-200 leading-relaxed font-light tracking-wide transition-all duration-500">
                        {insights[currentInsight]}
                      </p>
                      {/* Insight navigation */}
                      <div className="flex items-center gap-1.5 mt-3">
                        {insights.map((_, i) => (
                          <button
                            key={i}
                            onClick={() => onInsightChange(i)}
                            className={`h-1 rounded-full transition-all duration-500 ${
                              i === currentInsight
                                ? `${isCritical ? 'bg-rose-400' : isWarning ? 'bg-amber-400' : 'bg-cyan-400'} w-5`
                                : 'bg-slate-700 hover:bg-slate-600 w-1.5'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom metric bar */}
            <div className="flex flex-wrap items-center gap-4 mt-2 pt-3 border-t border-slate-800/60">
              {stats && (
                <>
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                    <span className={`w-1.5 h-1.5 rounded-full ${(stats?.delayed_conversations || 0) > 0 ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                    <span>{stats?.delayed_conversations || 0} delayed</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                    <span>{stats?.open_conversations || 0} active</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    <span>{stats?.total_conversations_today || 0} today</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                    <span className={`w-1.5 h-1.5 rounded-full ${(stats?.sla_compliance_percent || 100) >= 90 ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    <span>{stats?.sla_compliance_percent != null ? `${stats.sla_compliance_percent}%` : 'N/A'} SLA</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
