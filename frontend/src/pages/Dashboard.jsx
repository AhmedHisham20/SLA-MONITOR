import { useState, useEffect, useCallback } from 'react'
import { dashboard, conversations, settings } from '../services/api'
import WidgetCard from '../components/WidgetCard'
import {
  MessageSquare,
  Clock,
  AlertTriangle,
  CheckCircle,
  Users,
  Activity,
  RefreshCw,
  ExternalLink,
  Bot,
  User,
} from 'lucide-react'

const periods = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: '7days', label: 'Last 7 Days' },
  { value: '30days', label: 'Last 30 Days' },
  { value: 'all', label: 'All Time' },
]

const statusTabs = [
  { value: '', label: 'All' },
  { value: 'delayed', label: 'Delayed' },
  { value: 'pending', label: 'Pending' },
  { value: 'compliant', label: 'Compliant' },
]

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [convData, setConvData] = useState({ items: [], total: 0, page: 1, page_size: 20 })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [pages, setPages] = useState([])
  const [selectedPage, setSelectedPage] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [period, setPeriod] = useState('today')
  const [slaStatus, setSlaStatus] = useState('')
  const [convPage, setConvPage] = useState(1)

  useEffect(() => {
    settings.pages().then((res) => {
      const arr = Array.isArray(res) ? res : []
      setPages(arr.filter((p) => p.is_connected))
    }).catch(() => {})
  }, [])

  const buildParams = useCallback(() => {
    const params = { period }
    if (selectedPage) params.page_id = selectedPage
    if (dateFrom) params.date_from = dateFrom
    if (dateTo) params.date_to = dateTo
    return params
  }, [selectedPage, dateFrom, dateTo, period])

  const fetchData = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true)
    try {
      const [statsRes, convRes] = await Promise.all([
        dashboard.stats(buildParams()),
        conversations.list({ ...buildParams(), sla_status: slaStatus || undefined, page: convPage }),
      ])
      setData(statsRes)
      setConvData(convRes)
    } catch {
      // silently fail
    } finally {
      setLoading(false)
      if (isManual) setTimeout(() => setRefreshing(false), 500)
    }
  }, [buildParams, slaStatus, convPage])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [fetchData])

  const s = data?.stats
  const totalPages = Math.ceil(convData.total / (convData.page_size || 20))
  const pageSize = convData.page_size || 20

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <div className="flex items-center gap-3">
          <select
            value={selectedPage}
            onChange={(e) => { setSelectedPage(e.target.value); setConvPage(1) }}
            className="input text-sm w-auto"
          >
            <option value="">All Monitored Pages</option>
            {pages.map((p) => (
              <option key={p.page_id} value={p.page_id}>{p.page_name}</option>
            ))}
          </select>
          <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setConvPage(1) }} className="input text-sm w-auto" title="From date" />
          <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setConvPage(1) }} className="input text-sm w-auto" title="To date" />
          <button onClick={() => fetchData(true)} className="p-2 rounded-lg hover:bg-gray-100 transition-colors" title="Refresh now">
            <RefreshCw className={`w-4 h-4 text-gray-500 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <span className="text-xs text-gray-500">Auto-refreshes every 30s</span>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {periods.map((p) => (
          <button
            key={p.value}
            onClick={() => { setPeriod(p.value); setConvPage(1) }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              period === p.value
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
        <WidgetCard title={dateFrom || dateTo ? 'Filtered Conversations' : "Today's Conversations"} value={s?.total_conversations_today} icon={MessageSquare} color="blue" loading={loading} />
        <WidgetCard title="Awaiting Reply" value={s?.open_conversations} icon={Activity} color="purple" loading={loading} />
        <WidgetCard title="Delayed" value={s?.delayed_conversations} icon={AlertTriangle} color="red" loading={loading} />
        <WidgetCard title="Avg Response Time" value={s?.average_response_time_seconds ? `${Math.floor(s.average_response_time_seconds / 60)}m ${s.average_response_time_seconds % 60}s` : 'N/A'} icon={Clock} color="yellow" loading={loading} />
        <WidgetCard title="SLA Compliance" value={s ? `${s.sla_compliance_percent}%` : null} icon={CheckCircle} color="green" loading={loading} />
        <WidgetCard title="Alerts Sent" value={s?.total_alerts_sent} icon={AlertTriangle} color="red" loading={loading} />
        <WidgetCard title="Monitored Pages" value={s?.active_pages} icon={Users} color="indigo" loading={loading} />
      </div>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {statusTabs.map((t) => (
          <button
            key={t.value}
            onClick={() => { setSlaStatus(t.value); setConvPage(1) }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              slaStatus === t.value
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {t.label}
          </button>
        ))}
        <span className="text-sm text-gray-400 ml-auto">{convData.total} conversation{convData.total !== 1 ? 's' : ''}</span>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-3 font-medium text-gray-500">Customer ID</th>
                <th className="text-left py-3 px-3 font-medium text-gray-500">Moderator</th>
                <th className="text-left py-3 px-3 font-medium text-gray-500">Page</th>
                <th className="text-left py-3 px-3 font-medium text-gray-500">Received</th>
                <th className="text-left py-3 px-3 font-medium text-gray-500">Replied</th>
                <th className="text-left py-3 px-3 font-medium text-gray-500">Response Time</th>
                <th className="text-left py-3 px-3 font-medium text-gray-500">Status</th>
                <th className="text-left py-3 px-3 font-medium text-gray-500">Chat</th>
              </tr>
            </thead>
            <tbody>
              {convData.items.map((c) => (
                <tr key={c.id} className={`border-b border-gray-100 hover:bg-gray-50 ${
                  c.sla_status === 'delayed' ? 'bg-red-50/40' :
                  c.sla_status === 'pending' ? 'bg-yellow-50/40' : ''
                }`}>
                  <td className="py-3 px-3 text-gray-500 text-xs font-mono">{c.customer_id}</td>
                  <td className="py-3 px-3 text-gray-600">{c.moderator_name || '-'}</td>
                  <td className="py-3 px-3 text-gray-600">{c.page_name || '-'}</td>
                  <td className="py-3 px-3 text-gray-600">{new Date(c.message_timestamp).toLocaleString()}</td>
                  <td className="py-3 px-3 text-gray-600">{c.first_reply_timestamp ? new Date(c.first_reply_timestamp).toLocaleString() : '-'}</td>
                  <td className="py-3 px-3 text-gray-600">
                    {c.response_time_seconds != null
                      ? `${Math.floor(c.response_time_seconds / 60)}m ${c.response_time_seconds % 60}s`
                      : '-'}
                  </td>
                  <td className="py-3 px-3">
                    {c.last_sender_type === 'page' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                        <CheckCircle className="w-3 h-3" />
                        Responded
                      </span>
                    ) : c.sla_status === 'delayed' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                        <AlertTriangle className="w-3 h-3" />
                        DELAYED
                        {c.waiting_minutes > 0 && <span>· {c.waiting_minutes}m</span>}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-50 text-yellow-700 border border-yellow-200">
                        <Clock className="w-3 h-3" />
                        Pending Reply
                        {c.waiting_minutes > 0 && <span>· {c.waiting_minutes}m</span>}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3">
                    <a href={c.conversation_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-medium">
                      <ExternalLink className="w-3.5 h-3.5" />
                      Open
                    </a>
                  </td>
                </tr>
              ))}
              {convData.items.length === 0 && (
                <tr><td colSpan={8} className="py-8 text-center text-gray-400">No conversations found</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <span className="text-sm text-gray-500">
              Showing {(convData.page - 1) * pageSize + 1}–{Math.min(convData.page * pageSize, convData.total)} of {convData.total}
            </span>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => {
                const p = i + 1
                return (
                  <button
                    key={p}
                    onClick={() => setConvPage(p)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                      convData.page === p
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {p}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
