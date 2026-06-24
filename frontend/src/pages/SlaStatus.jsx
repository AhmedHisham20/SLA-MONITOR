import { useState, useEffect } from 'react'
import { conversations, settings } from '../services/api'
import { ExternalLink, Clock, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react'

const periods = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: '7days', label: 'Last 7 Days' },
  { value: '30days', label: 'Last 30 Days' },
  { value: 'all', label: 'All Time' },
]

const statusTabs = [
  { value: '', label: 'All', icon: null },
  { value: 'delayed', label: 'Delayed', icon: AlertTriangle },
  { value: 'pending', label: 'Pending', icon: Clock },
  { value: 'compliant', label: 'Compliant', icon: CheckCircle },
]

export default function SlaStatus() {
  const [filters, setFilters] = useState({ period: 'all', page: 1, sla_status: '' })
  const [data, setData] = useState({ items: [], total: 0, page: 1, page_size: 20 })
  const [loading, setLoading] = useState(true)
  const [pages, setPages] = useState([])
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => {
    settings.pages().then((res) => {
      setPages(Array.isArray(res) ? res.filter((p) => p.is_connected) : [])
    }).catch(() => {})
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const params = { ...filters }
      if (!params.sla_status) delete params.sla_status
      if (dateFrom) params.date_from = dateFrom
      if (dateTo) params.date_to = dateTo
      const res = await conversations.list(params)
      setData(res)
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [filters, dateFrom, dateTo])

  const totalPages = Math.ceil(data.total / (data.page_size || 20))
  const pageSize = data.page_size || 20

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
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input text-sm w-auto" title="From date" />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input text-sm w-auto" title="To date" />
          <button onClick={fetchData} className="p-2 rounded-lg hover:bg-gray-100 transition-colors" title="Refresh">
            <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {periods.map((p) => (
          <button
            key={p.value}
            onClick={() => setFilters((f) => ({ ...f, period: p.value, page: 1 }))}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filters.period === p.value
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {statusTabs.map((t) => (
          <button
            key={t.value}
            onClick={() => setFilters((f) => ({ ...f, sla_status: t.value, page: 1 }))}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              filters.sla_status === t.value
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {t.icon && <t.icon className="w-4 h-4" />}
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : data.items.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No conversations found</div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Customer ID</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Page</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Received</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Waiting</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Delay Level</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Alert</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Chat</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((c) => (
                  <tr key={c.id} className={`border-b border-gray-100 hover:bg-gray-50 ${
                    c.sla_status === 'delayed' ? 'bg-red-50/40' :
                    c.sla_status === 'pending' ? 'bg-yellow-50/40' : ''
                  }`}>
                    <td className="py-3 px-4 text-gray-500 text-xs font-mono">{c.customer_id}</td>
                    <td className="py-3 px-4 text-gray-600">{c.page_name || '-'}</td>
                    <td className="py-3 px-4 text-gray-600">{new Date(c.message_timestamp).toLocaleString()}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        c.sla_status === 'compliant' ? 'bg-green-50 text-green-600' :
                        c.sla_status === 'delayed' ? 'bg-red-50 text-red-600' :
                        c.sla_status === 'outside_hours' ? 'bg-gray-50 text-gray-500' :
                        'bg-yellow-50 text-yellow-600'
                      }`}>
                        {c.sla_status === 'delayed' && <AlertTriangle className="w-3 h-3" />}
                        {c.sla_status === 'compliant' && <CheckCircle className="w-3 h-3" />}
                        {c.sla_status === 'pending' && <Clock className="w-3 h-3" />}
                        {c.sla_status?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        c.waiting_minutes <= 5 ? 'bg-green-50 text-green-600' :
                        c.waiting_minutes <= 10 ? 'bg-yellow-50 text-yellow-600' :
                        'bg-red-50 text-red-600'
                      }`}>
                        {c.waiting_minutes}m
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        c.delay_level === 'critical' ? 'bg-red-50 text-red-700' :
                        c.delay_level === 'admin' ? 'bg-orange-50 text-orange-700' :
                        c.delay_level === 'moderator' ? 'bg-yellow-50 text-yellow-700' :
                        'bg-green-50 text-green-700'
                      }`}>
                        {c.delay_level}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {c.alert_sent ? (
                        <span className="text-red-500 text-xs font-medium">Sent</span>
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <a href={c.conversation_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-medium">
                        <ExternalLink className="w-3.5 h-3.5" />
                        Open
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <span className="text-sm text-gray-500">
                Showing {(data.page - 1) * pageSize + 1}–{Math.min(data.page * pageSize, data.total)} of {data.total}
              </span>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => {
                  const pageNum = i + 1
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setFilters((f) => ({ ...f, page: pageNum }))}
                      className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                        data.page === pageNum
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {pageNum}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
