import { useState, useEffect, useCallback } from 'react'
import { dashboard, settings } from '../services/api'
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
} from 'lucide-react'

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [pages, setPages] = useState([])
  const [selectedPage, setSelectedPage] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => {
    settings.pages().then((res) => {
      const arr = Array.isArray(res) ? res : []
      setPages(arr.filter((p) => p.is_connected))
    }).catch(() => {})
  }, [])

  const fetchData = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true)
    try {
      const params = {}
      if (selectedPage) params.page_id = selectedPage
      if (dateFrom) params.date_from = dateFrom
      if (dateTo) params.date_to = dateTo
      const res = await dashboard.stats(params)
      setData(res)
    } catch {
      // silently fail
    } finally {
      setLoading(false)
      if (isManual) setTimeout(() => setRefreshing(false), 500)
    }
  }, [selectedPage, dateFrom, dateTo])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [fetchData])

  const s = data?.stats
  const recent = data?.recent_conversations || []

  const getDelayColor = (minutes) => {
    if (minutes <= 5) return 'text-green-600 bg-green-50'
    if (minutes <= 10) return 'text-yellow-600 bg-yellow-50'
    return 'text-red-600 bg-red-50'
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <div className="flex items-center gap-3">
          <select
            value={selectedPage}
            onChange={(e) => setSelectedPage(e.target.value)}
            className="input text-sm w-auto"
          >
            <option value="">All Monitored Pages</option>
            {pages.map((p) => (
              <option key={p.page_id} value={p.page_id}>
                {p.page_name}
              </option>
            ))}
          </select>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input text-sm w-auto" title="From date" />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input text-sm w-auto" title="To date" />
          <button onClick={() => fetchData(true)} className="p-2 rounded-lg hover:bg-gray-100 transition-colors" title="Refresh now">
            <RefreshCw className={`w-4 h-4 text-gray-500 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <span className="text-xs text-gray-500">Auto-refreshes every 30s</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
        <WidgetCard title={dateFrom || dateTo ? 'Filtered Conversations' : "Today's Conversations"} value={s?.total_conversations_today} icon={MessageSquare} color="blue" loading={loading} />
        <WidgetCard title="Open Conversations" value={s?.open_conversations} icon={Activity} color="purple" loading={loading} />
        <WidgetCard title="Delayed" value={s?.delayed_conversations} icon={AlertTriangle} color="red" loading={loading} />
        <WidgetCard title="Avg Response Time" value={s?.average_response_time_seconds ? `${Math.floor(s.average_response_time_seconds / 60)}m ${s.average_response_time_seconds % 60}s` : 'N/A'} icon={Clock} color="yellow" loading={loading} />
        <WidgetCard title="SLA Compliance" value={s ? `${s.sla_compliance_percent}%` : null} icon={CheckCircle} color="green" loading={loading} />
        <WidgetCard title="Alerts Sent" value={s?.total_alerts_sent} icon={AlertTriangle} color="red" loading={loading} />
        <WidgetCard title="Monitored Pages" value={s?.active_pages} icon={Users} color="indigo" loading={loading} />
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Conversations</h2>
        <div className="overflow-x-auto">
              <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/50">
                <th className="table-header">Customer</th>
                <th className="table-header">Customer ID</th>
                <th className="table-header">Moderator</th>
                <th className="table-header">Page</th>
                <th className="table-header">Received</th>
                <th className="table-header">Replied</th>
                <th className="table-header">Response Time</th>
                <th className="table-header">Waiting</th>
                <th className="table-header">Status</th>
                <th className="table-header">Chat</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((c) => (
                <tr key={c.id} className="table-row animate-fade-in">
                  <td className="table-cell font-medium text-gray-900">{c.customer_name || 'Unknown'}</td>
                  <td className="table-cell text-gray-400 font-mono text-xs">{c.customer_id}</td>
                  <td className="table-cell text-gray-600">{c.moderator_name || '-'}</td>
                  <td className="table-cell text-gray-600">{c.page_name || '-'}</td>
                  <td className="table-cell text-gray-600 whitespace-nowrap">{new Date(c.message_timestamp).toLocaleString()}</td>
                  <td className="table-cell text-gray-600 whitespace-nowrap">{c.first_reply_timestamp ? new Date(c.first_reply_timestamp).toLocaleString() : '-'}</td>
                  <td className="table-cell text-gray-600">
                    {c.response_time_seconds != null
                      ? `${Math.floor(c.response_time_seconds / 60)}m ${c.response_time_seconds % 60}s`
                      : '-'}
                  </td>
                  <td className="table-cell">
                    <span className={`badge ${getDelayColor(c.waiting_minutes)}`}>
                      {c.waiting_minutes}m
                    </span>
                  </td>
                  <td className="table-cell">
                    <span className={`badge ${
                      c.sla_status === 'delayed' ? 'bg-red-50 text-red-700' :
                      c.sla_status === 'compliant' ? 'bg-green-50 text-green-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {c.sla_status?.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="table-cell">
                    <a href={c.conversation_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors">
                      <ExternalLink className="w-3.5 h-3.5" />
                      Open
                    </a>
                  </td>
                </tr>
              ))}
              {recent.length === 0 && (
                <tr><td colSpan={10} className="py-10 text-center text-gray-400 text-sm">No conversations yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
