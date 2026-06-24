import { useState, useEffect } from 'react'
import { conversations, settings } from '../services/api'
import { ExternalLink, Clock, AlertTriangle, CheckCircle, RefreshCw, Users } from 'lucide-react'

const statusConfig = {
  delayed: { label: 'Delayed', icon: AlertTriangle, bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-100 text-red-700' },
  pending: { label: 'Pending', icon: Clock, bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', badge: 'bg-yellow-100 text-yellow-700' },
  compliant: { label: 'Compliant', icon: CheckCircle, bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', badge: 'bg-green-100 text-green-700' },
}

export default function SlaStatus() {
  const [filters, setFilters] = useState({ period: 'today', page: 1 })
  const [data, setData] = useState({ items: [], total: 0 })
  const [loading, setLoading] = useState(true)
  const [pages, setPages] = useState([])
  const [activeSection, setActiveSection] = useState('all')

  useEffect(() => {
    settings.pages().then((res) => {
      setPages(Array.isArray(res) ? res.filter((p) => p.is_connected) : [])
    }).catch(() => {})
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const params = { ...filters }
      const res = await conversations.list(params)
      setData(res)
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [filters])

  const groups = { delayed: [], pending: [], compliant: [] }
  data.items.forEach((c) => {
    if (groups[c.sla_status]) groups[c.sla_status].push(c)
    else groups.pending.push(c)
  })

  const orderedSections = ['delayed', 'pending', 'compliant']

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">SLA Monitoring</h1>
        <div className="flex items-center gap-3">
          <select
            value={filters.page_id || ''}
            onChange={(e) => setFilters((f) => ({ ...f, page_id: e.target.value || undefined, page: 1 }))}
            className="input text-sm w-auto"
          >
            <option value="">All Pages</option>
            {pages.map((p) => (
              <option key={p.page_id} value={p.page_id}>{p.page_name}</option>
            ))}
          </select>
          <button onClick={fetchData} className="p-2 rounded-lg hover:bg-gray-100 transition-colors" title="Refresh">
            <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-6">
        {['all', ...orderedSections].map((key) => {
          const cfg = statusConfig[key]
          const count = key === 'all' ? data.items.length : (groups[key]?.length || 0)
          return (
            <button
              key={key}
              onClick={() => setActiveSection(key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                activeSection === key
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {cfg && <cfg.icon className="w-4 h-4" />}
              {key === 'all' ? 'All' : cfg?.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                activeSection === key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
              }`}>{count}</span>
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : (
        <div className="space-y-6">
          {orderedSections
            .filter((key) => activeSection === 'all' || activeSection === key)
            .map((key) => {
              const cfg = statusConfig[key]
              const items = groups[key]
              if (!items || items.length === 0) return null

              return (
                <div key={key} className={`rounded-xl border ${cfg.border} ${cfg.bg} overflow-hidden`}>
                  <div className={`px-5 py-3 border-b ${cfg.border} flex items-center justify-between`}>
                    <div className="flex items-center gap-2">
                      <cfg.icon className={`w-5 h-5 ${cfg.text}`} />
                      <h2 className={`font-semibold ${cfg.text}`}>{cfg.label}</h2>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${cfg.badge}`}>{items.length}</span>
                    </div>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {items.map((c) => (
                      <div key={c.id} className="px-5 py-3 flex items-center gap-4 hover:bg-white/50 transition-colors">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-mono text-gray-500">{c.customer_id}</span>
                            {c.page_name && (
                              <span className="text-xs text-gray-400">· {c.page_name}</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-400">
                            {new Date(c.message_timestamp).toLocaleString()}
                          </div>
                        </div>
                        <div className="text-right flex items-center gap-4">
                          {key === 'delayed' || key === 'pending' ? (
                            <div>
                              <div className={`text-lg font-bold ${
                                c.waiting_minutes <= 5 ? 'text-green-600' :
                                c.waiting_minutes <= 10 ? 'text-yellow-600' :
                                'text-red-600'
                              }`}>{c.waiting_minutes}m</div>
                              <div className="text-xs text-gray-400">waiting</div>
                            </div>
                          ) : (
                            <div className="text-right">
                              <div className="text-sm font-medium text-green-600">
                                {c.response_time_seconds != null
                                  ? `${Math.floor(c.response_time_seconds / 60)}m ${c.response_time_seconds % 60}s`
                                  : 'On time'}
                              </div>
                              <div className="text-xs text-gray-400">response time</div>
                            </div>
                          )}
                          <a
                            href={c.conversation_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Open
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}

          {data.items.length === 0 && (
            <div className="text-center py-12 text-gray-400">No conversations found</div>
          )}
        </div>
      )}
    </div>
  )
}
