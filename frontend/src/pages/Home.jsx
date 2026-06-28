import { useState, useEffect, useCallback, useRef } from 'react'
import { dashboard, conversations, logs } from '../services/api'
import {
  Activity,
  AlertTriangle,
  MessageSquare,
  RefreshCw,
  Shield,
  Cpu,
  BrainCircuit,
  Zap,
} from 'lucide-react'

const insightsGenerators = [
  { id: 'delayed', check: (s) => (s?.delayed_conversations || 0) > 0, build: (s) => `${s.delayed_conversations} conversation${s.delayed_conversations > 1 ? 's are' : ' is'} currently delayed.` },
  { id: 'approaching', check: (s, convs) => convs.filter((c) => c.sla_status === 'pending' && c.last_sender_type === 'customer' && (c.waiting_minutes || 0) >= 3).length > 0, build: (s, convs) => { const n = convs.filter((c) => c.sla_status === 'pending' && c.last_sender_type === 'customer' && (c.waiting_minutes || 0) >= 3).length; return `${n} conversation${n > 1 ? 's are' : ' is'} approaching the SLA limit.` } },
  { id: 'recently_delayed', check: (s, convs) => convs.filter((c) => c.sla_status === 'delayed').length > 0, build: (s, convs) => { const n = convs.filter((c) => c.sla_status === 'delayed').length; return `${n} conversation${n > 1 ? 's became' : ' became'} delayed recently.` } },
  { id: 'improving', check: (s) => (s?.average_response_time_seconds || 0) > 0 && (s?.average_response_time_seconds || 9999) < 300, build: () => 'Average response time is looking healthy today.' },
  { id: 'most_active', check: (s, convs, pages) => pages.length > 0, build: (s, convs, pages) => { const counts = {}; convs.forEach((c) => { counts[c.page_name || c.page_id] = (counts[c.page_name || c.page_id] || 0) + 1 }); const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]; return top ? `Most active page today: ${top[0]} (${top[1]} conversations).` : 'No page activity detected.' } },
  { id: 'no_moderator', check: (s, convs) => convs.filter((c) => c.last_sender_type === 'customer' && c.sla_status === 'delayed').length > 2, build: () => 'No moderator activity detected recently. Review delayed conversations.' },
  { id: 'high_volume', check: (s) => (s?.total_conversations_today || 0) > 20, build: (s) => `High conversation volume detected: ${s.total_conversations_today} conversations today.` },
  { id: 'clean', check: (s) => (s?.delayed_conversations || 0) === 0 && (s?.open_conversations || 0) === 0, build: () => 'No delayed conversations detected. All clear.' },
  { id: 'compliance', check: (s) => (s?.sla_compliance_percent || 100) >= 95, build: (s) => `SLA compliance at ${s.sla_compliance_percent}% — excellent performance.` },
  { id: 'compliance_warn', check: (s) => (s?.sla_compliance_percent || 100) < 80, build: (s) => `SLA compliance dropped to ${s.sla_compliance_percent}%. Review response workflows.` },
]

function getStatus(stats) {
  if (!stats) return { level: 'loading', label: 'Loading...', color: 'text-gray-400' }
  if (stats.delayed_conversations > 5) return { level: 'critical', label: 'Critical', color: 'text-red-400', dot: 'bg-red-500' }
  if (stats.delayed_conversations > 0) return { level: 'warning', label: 'Warning', color: 'text-amber-400', dot: 'bg-amber-500' }
  return { level: 'healthy', label: 'Healthy', color: 'text-emerald-400', dot: 'bg-emerald-500' }
}

function AnimatedCounter({ value, label, icon: Icon, color }) {
  const [display, setDisplay] = useState(0)
  const ref = useRef(null)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    const duration = 800
    const steps = 30
    const stepTime = duration / steps
    let step = 0
    const timer = setInterval(() => {
      step++
      const progress = Math.min(step / steps, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(eased * (value || 0)))
      if (progress >= 1) clearInterval(timer)
    }, stepTime)
    return () => clearInterval(timer)
  }, [value])

  useEffect(() => {
    started.current = false
  }, [value])

  return (
    <div ref={ref} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 backdrop-blur-sm">
      <div className="flex items-center gap-2 text-slate-400 text-xs font-medium mb-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span>{label}</span>
      </div>
      <div className={`text-3xl font-bold ${color} tabular-nums`}>{display}</div>
    </div>
  )
}

function StatusDot({ status }) {
  const pulse = status.level === 'critical' || status.level === 'warning' ? 'animate-ping' : ''
  return (
    <span className="relative inline-flex items-center">
      <span className={`w-2.5 h-2.5 rounded-full ${status.dot} ${pulse} absolute`} />
      <span className={`w-2.5 h-2.5 rounded-full ${status.dot} relative`} />
    </span>
  )
}

export default function Home() {
  const [stats, setStats] = useState(null)
  const [convData, setConvData] = useState({ items: [] })
  const [eventLogs, setEventLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [insights, setInsights] = useState([])
  const [thinking, setThinking] = useState(true)
  const [currentInsight, setCurrentInsight] = useState(0)

  const fetchData = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true)
    try {
      const [statsRes, convRes, logsRes] = await Promise.all([
        dashboard.stats({ period: 'today' }),
        conversations.list({ period: 'today', page_size: 50 }),
        logs.get(20),
      ])
      setStats(statsRes)
      setConvData(convRes)
      setEventLogs(Array.isArray(logsRes) ? logsRes : logsRes?.items || [])
      setLastUpdated(new Date())
    } catch {
      // silent
    } finally {
      setLoading(false)
      if (isManual) setTimeout(() => setRefreshing(false), 500)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(fetchData, 300)
    return () => clearTimeout(timer)
  }, [fetchData])

  useEffect(() => {
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [fetchData])

  useEffect(() => {
    if (!stats) return
    setThinking(true)
    const timer = setTimeout(() => {
      const s = stats?.stats
      const items = convData?.items || []
      const pages = items.reduce((acc, c) => {
        const name = c.page_name || c.page_id
        if (!acc.includes(name)) acc.push(name)
        return acc
      }, [])
      const active = insightsGenerators
        .filter((g) => g.check(s, items, pages))
        .map((g) => g.build(s, items, pages))
      setInsights(active.length > 0 ? active : ['System is operating normally. No notable events.'])
      setThinking(false)
    }, 1800)
    return () => clearTimeout(timer)
  }, [stats, convData])

  useEffect(() => {
    if (thinking || insights.length <= 1) return
    const interval = setInterval(() => {
      setCurrentInsight((p) => (p + 1) % insights.length)
    }, 5000)
    return () => clearInterval(interval)
  }, [thinking, insights.length])

  const s = stats?.stats
  const status = getStatus(s)

  const formatTime = (d) => {
    if (!d) return '-'
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
  }

  const activityItems = eventLogs.slice(0, 10).map((log) => ({
    message: log.message || log.event || '',
    level: log.level || 'info',
    time: log.created_at,
    source: log.source || '',
  }))

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Cpu className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">AI Operations Center</h1>
              <p className="text-xs text-slate-400">Real-time system monitoring</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <StatusDot status={status} />
              <span className={status.color}>{status.label}</span>
            </div>
            <span className="text-xs text-slate-500">Updated: {formatTime(lastUpdated)}</span>
            <button
              onClick={() => fetchData(true)}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 text-slate-400 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Live Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <AnimatedCounter value={s?.open_conversations || 0} label="Active Conversations" icon={MessageSquare} color="text-cyan-400" />
          <AnimatedCounter value={s?.delayed_conversations || 0} label="Delayed" icon={AlertTriangle} color={s?.delayed_conversations > 0 ? 'text-red-400' : 'text-emerald-400'} />
          <AnimatedCounter value={s?.total_conversations_today || 0} label="Today Total" icon={Activity} color="text-blue-400" />
          <AnimatedCounter value={s?.sla_compliance_percent != null ? `${s.sla_compliance_percent}%` : '-'} label="SLA Compliance" icon={Shield} color={s?.sla_compliance_percent >= 90 ? 'text-emerald-400' : 'text-amber-400'} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* AI Assistant */}
          <div className="lg:col-span-2 bg-slate-800/60 border border-slate-700/50 rounded-xl p-5 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-4">
              <BrainCircuit className="w-5 h-5 text-purple-400" />
              <h2 className="text-sm font-semibold text-slate-200">AI Assistant</h2>
            </div>
            <div className="min-h-[120px] flex items-center">
              {thinking ? (
                <div className="flex items-center gap-3 text-slate-400">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-sm text-slate-500">Analyzing live data...</span>
                </div>
              ) : (
                <div className="w-full">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Zap className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="relative overflow-hidden">
                        <p className="text-sm text-slate-300 leading-relaxed transition-opacity duration-300">
                          {insights[currentInsight]}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 mt-3">
                        {insights.map((_, i) => (
                          <button
                            key={i}
                            onClick={() => setCurrentInsight(i)}
                            className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                              i === currentInsight ? 'bg-purple-400 w-4' : 'bg-slate-600 hover:bg-slate-500'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* System Status Card */}
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-5 h-5 text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-200">System Status</h2>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Status</span>
                <span className={`font-medium ${status.color}`}>{status.label}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Delayed</span>
                <span className={`font-medium tabular-nums ${(s?.delayed_conversations || 0) > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{s?.delayed_conversations || 0}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Awaiting Reply</span>
                <span className="font-medium text-cyan-400 tabular-nums">{s?.open_conversations || 0}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Avg Response</span>
                <span className="font-medium text-slate-300 tabular-nums">
                  {s?.average_response_time_seconds != null
                    ? `${Math.floor(s.average_response_time_seconds / 60)}m ${s.average_response_time_seconds % 60}s`
                    : 'N/A'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Alerts Sent</span>
                <span className="font-medium text-slate-300 tabular-nums">{s?.total_alerts_sent || 0}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Pages</span>
                <span className="font-medium text-slate-300 tabular-nums">{s?.active_pages || 0}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-200">Recent Activity</h2>
          </div>
          {activityItems.length > 0 ? (
            <div className="space-y-0">
              {activityItems.map((item, i) => (
                <div key={i} className="flex items-start gap-3 py-2.5 border-b border-slate-700/30 last:border-0">
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                    item.level === 'error' ? 'bg-red-500' :
                    item.level === 'warning' ? 'bg-amber-500' : 'bg-slate-500'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-300 truncate">{item.message}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-slate-500">{item.source}</span>
                      {item.time && (
                        <span className="text-xs text-slate-600">{new Date(item.time).toLocaleTimeString()}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center text-sm text-slate-500">No recent activity</div>
          )}
        </div>
      </div>
    </div>
  )
}
