import { useState, useEffect, useRef } from 'react'
import { Zap, BrainCircuit } from 'lucide-react'

const statuses = [
  'Scanning conversations...',
  'Analyzing SLA performance...',
  'Watching moderator activity...',
  'Monitoring response delays...',
  'Checking webhook activity...',
]

function useRefreshFlag(lastUpdated) {
  const [flash, setFlash] = useState(false)
  const prev = useRef(lastUpdated)
  useEffect(() => {
    if (lastUpdated && lastUpdated !== prev.current) {
      prev.current = lastUpdated
      setFlash(true)
      const t = setTimeout(() => setFlash(false), 600)
      return () => clearTimeout(t)
    }
  }, [lastUpdated])
  return flash
}

export default function AIAgent({ status, lastUpdated, insights, currentInsight, thinking, onInsightChange, stats }) {
  const [liveStatus, setLiveStatus] = useState(0)
  const refreshFlash = useRefreshFlag(lastUpdated)

  useEffect(() => {
    const interval = setInterval(() => {
      setLiveStatus((p) => (p + 1) % statuses.length)
    }, 4000)
    return () => clearInterval(interval)
  }, [])

  const isWarning = status?.level === 'warning' || (stats?.delayed_conversations || 0) > 0
  const isCritical = status?.level === 'critical' || (stats?.delayed_conversations || 0) > 5
  const accentColor = isCritical ? 'rose' : isWarning ? 'amber' : 'cyan'

  return (
    <div className={`relative overflow-hidden rounded-xl border backdrop-blur-sm transition-all duration-500 ${
      refreshFlash ? 'border-cyan-400/60' : 'border-slate-700/50'
    } bg-slate-800/60`}>
      <style>{`
        @keyframes agent-float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
        @keyframes agent-breathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.02); }
        }
        @keyframes agent-scan {
          0% { top: 0%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        @keyframes agent-ring-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes agent-ring-spin-reverse {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(-360deg); }
        }
        @keyframes agent-particle {
          0% { transform: translateY(0) translateX(0) scale(1); opacity: 0; }
          20% { opacity: 0.6; }
          80% { opacity: 0.6; }
          100% { transform: translateY(-60px) translateX(20px) scale(0); opacity: 0; }
        }
        @keyframes agent-eye-glow {
          0%, 100% { box-shadow: 0 0 4px 2px rgba(6, 182, 212, 0.3); }
          50% { box-shadow: 0 0 8px 4px rgba(6, 182, 212, 0.6); }
        }
        @keyframes agent-blink {
          0%, 96%, 100% { transform: scaleY(1); opacity: 1; }
          98% { transform: scaleY(0.1); opacity: 0.3; }
        }
        @keyframes agent-head {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(2deg); }
          75% { transform: rotate(-2deg); }
        }
        @keyframes agent-typing {
          0% { opacity: 0; transform: translateY(6px); }
          20% { opacity: 1; transform: translateY(0); }
          80% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-6px); }
        }
        @keyframes agent-pulse-glow {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.05); }
        }
        @keyframes agent-status-fade {
          0% { opacity: 0; transform: translateY(8px); }
          20% { opacity: 1; transform: translateY(0); }
          80% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-8px); }
        }
        @keyframes agent-scan-ring {
          0% { transform: rotate(0deg) scaleX(1); opacity: 0; }
          20% { opacity: 0.5; }
          80% { opacity: 0.5; }
          100% { transform: rotate(360deg) scaleX(1); opacity: 0; }
        }
        .agent-container {
          animation: agent-float 4s ease-in-out infinite;
        }
        .agent-breathe {
          animation: agent-breathe 4s ease-in-out infinite;
        }
        .agent-head-move {
          animation: agent-head 6s ease-in-out infinite;
        }
        .agent-eye {
          animation: agent-eye-glow 3s ease-in-out infinite, agent-blink 4s ease-in-out infinite;
        }
        .agent-scan-line {
          animation: agent-scan 3s ease-in-out infinite;
        }
        .agent-ring-outer {
          animation: agent-ring-spin 8s linear infinite;
        }
        .agent-ring-inner {
          animation: agent-ring-spin-reverse 6s linear infinite;
        }
        .agent-particle {
          animation: agent-particle 4s ease-in-out infinite;
        }
        .agent-particle:nth-child(2) { animation-delay: 1s; }
        .agent-particle:nth-child(3) { animation-delay: 2s; }
        .agent-particle:nth-child(4) { animation-delay: 3s; }
        .agent-particle:nth-child(5) { animation-delay: 0.5s; }
        .agent-particle:nth-child(6) { animation-delay: 2.5s; }
        .agent-status-text {
          animation: agent-status-fade 4s ease-in-out infinite;
        }
        .agent-scan-ring-flash {
          animation: agent-scan-ring 0.8s ease-out forwards;
        }
      `}</style>

      <div className="p-5">
        <div className="flex items-center gap-2 mb-5">
          <span className="relative inline-flex items-center">
            <span className={`w-2 h-2 rounded-full absolute animate-ping ${
              isCritical ? 'bg-rose-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500'
            }`} />
            <span className={`w-2 h-2 rounded-full relative ${
              isCritical ? 'bg-rose-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500'
            }`} />
          </span>
          <span className="text-xs font-semibold text-slate-300 tracking-wide uppercase">AI Monitoring Active</span>
        </div>

        <div className="flex flex-col md:flex-row items-center gap-6">
          {/* Robot Display */}
          <div className="agent-container relative w-44 h-44 flex-shrink-0">
            {/* Background glow */}
            <div className={`absolute inset-4 rounded-full blur-2xl transition-colors duration-700 ${
              isCritical ? 'bg-rose-500/20' : isWarning ? 'bg-amber-500/20' : 'bg-cyan-500/20'
            }`} style={{ animation: 'agent-pulse-glow 4s ease-in-out infinite' }} />

            {/* Holographic outer ring */}
            <div className="agent-ring-outer absolute inset-2 rounded-full border border-cyan-500/20" />
            <div className="agent-ring-outer absolute inset-4 rounded-full border border-cyan-400/10 border-dashed" style={{ animationDuration: '12s' }} />

            {/* Holographic inner ring */}
            <div className="agent-ring-inner absolute inset-6 rounded-full border border-cyan-500/15" />

            {/* Scan ring flash on refresh */}
            {refreshFlash && <div className="agent-scan-ring-flash absolute inset-0 rounded-full border-2 border-cyan-400/60" />}

            {/* Particles */}
            <div className="agent-particle absolute w-1 h-1 rounded-full bg-cyan-400/60" style={{ top: '70%', left: '20%' }} />
            <div className="agent-particle absolute w-1.5 h-1.5 rounded-full bg-cyan-300/50" style={{ top: '60%', left: '75%' }} />
            <div className="agent-particle absolute w-1 h-1 rounded-full bg-cyan-400/40" style={{ top: '80%', left: '50%' }} />
            <div className="agent-particle absolute w-1.5 h-1.5 rounded-full bg-cyan-300/60" style={{ top: '50%', left: '30%' }} />
            <div className="agent-particle absolute w-1 h-1 rounded-full bg-cyan-400/50" style={{ top: '75%', left: '60%' }} />
            <div className="agent-particle absolute w-1 h-1 rounded-full bg-cyan-300/40" style={{ top: '65%', left: '45%' }} />

            {/* Scanning line */}
            <div className="agent-scan-line absolute left-4 right-4 h-px bg-gradient-to-r from-transparent via-cyan-400/80 to-transparent pointer-events-none" />

            {/* Robot Head */}
            <div className="agent-head-move absolute inset-0 flex items-center justify-center">
              <div className="agent-breathe relative w-20 h-20">
                {/* Head shape */}
                <div className="absolute inset-0 rounded-2xl bg-slate-900/80 border border-slate-700/60 backdrop-blur-sm shadow-lg" />

                {/* Visor strip */}
                <div className="absolute top-5 left-3 right-3 h-0.5 rounded-full bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />

                {/* Eyes */}
                <div className="absolute top-7 left-3.5 w-4 h-4">
                  <div className="w-full h-full rounded-full bg-cyan-400/90 agent-eye" />
                  <div className="absolute inset-[3px] rounded-full bg-white/90" />
                </div>
                <div className="absolute top-7 right-3.5 w-4 h-4">
                  <div className="w-full h-full rounded-full bg-cyan-400/90 agent-eye" style={{ animationDelay: '0.15s' }} />
                  <div className="absolute inset-[3px] rounded-full bg-white/90" />
                </div>

                {/* Mouth / indicator */}
                <div className="absolute bottom-5 left-6 right-6 flex items-center justify-center gap-1">
                  <span className={`w-1 h-1 rounded-full transition-colors duration-500 ${
                    isCritical ? 'bg-rose-400' : isWarning ? 'bg-amber-400' : 'bg-cyan-400'
                  }`} />
                  <span className={`w-2 h-1 rounded-full transition-colors duration-500 ${
                    isCritical ? 'bg-rose-400' : isWarning ? 'bg-amber-400' : 'bg-cyan-400'
                  }`} />
                  <span className={`w-1 h-1 rounded-full transition-colors duration-500 ${
                    isCritical ? 'bg-rose-400' : isWarning ? 'bg-amber-400' : 'bg-cyan-400'
                  }`} />
                </div>

                {/* Corner accents */}
                <div className="absolute top-2 left-2 w-2 h-2 border-l border-t border-cyan-500/30 rounded-tl" />
                <div className="absolute top-2 right-2 w-2 h-2 border-r border-t border-cyan-500/30 rounded-tr" />
                <div className="absolute bottom-2 left-2 w-2 h-2 border-l border-b border-cyan-500/30 rounded-bl" />
                <div className="absolute bottom-2 right-2 w-2 h-2 border-r border-b border-cyan-500/30 rounded-br" />
              </div>
            </div>
          </div>

          {/* Status & Insights */}
          <div className="flex-1 min-w-0 self-center md:self-auto">
            {/* Live status line */}
            <div className="flex items-center gap-2 mb-3">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '0ms', animationDuration: '1.2s' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '200ms', animationDuration: '1.2s' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '400ms', animationDuration: '1.2s' }} />
              </div>
              <span className="text-xs text-cyan-400/80 font-mono tracking-wider agent-status-text">
                {statuses[liveStatus]}
              </span>
            </div>

            {/* Insights */}
            <div className="min-h-[72px]">
              {thinking ? (
                <div className="flex items-center gap-2 text-slate-500">
                  <BrainCircuit className="w-4 h-4 text-purple-400/60 animate-pulse" />
                  <span className="text-sm">Analyzing live data...</span>
                </div>
              ) : (
                <div className="relative">
                  <div className="flex items-start gap-2">
                    <Zap className={`w-4 h-4 mt-0.5 flex-shrink-0 transition-colors duration-500 ${
                      isCritical ? 'text-rose-400' : isWarning ? 'text-amber-400' : 'text-cyan-400'
                    }`} />
                    <p key={currentInsight} className="text-sm text-slate-300 leading-relaxed transition-all duration-300">
                      {insights[currentInsight]}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 mt-2 ml-6">
                    {insights.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => onInsightChange(i)}
                        className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                          i === currentInsight
                            ? `${isCritical ? 'bg-rose-400' : isWarning ? 'bg-amber-400' : 'bg-cyan-400'} w-3`
                            : 'bg-slate-600 hover:bg-slate-500'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
