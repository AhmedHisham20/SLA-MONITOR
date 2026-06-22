import { useState, useEffect } from 'react'
import { conversations, settings } from '../services/api'
import { ExternalLink, Search } from 'lucide-react'

const periods = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: '7days', label: 'Last 7 Days' },
  { value: '30days', label: 'Last 30 Days' },
  { value: 'all', label: 'All Time' },
]

const delayColors = {
  none: 'bg-green-50 text-green-700',
  moderator: 'bg-yellow-50 text-yellow-700',
  admin: 'bg-orange-50 text-orange-700',
  critical: 'bg-red-50 text-red-700',
}

export default function Conversations() {
  const [data, setData] = useState({ items: [], total: 0, page: 1, page_size: 20 })
  const [loading, setLoading] = useState(true)
  const [pages, setPages] = useState([])
  const [filters, setFilters] = useState({ period: 'today', page: 1 })

  useEffect(() => {
    settings.pages().then((res) => {
      setPages(Array.isArray(res) ? res.filter((p) => p.is_connected) : [])
    }).catch(() => {})
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await conversations.list(filters)
      setData(res)
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [filters])

  const totalPages = Math.ceil(data.total / data.page_size)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Conversations</h1>
        <select
          value={filters.page_id || ''}
          onChange={(e) => setFilters((f) => ({ ...f, page_id: e.target.value || undefined, page: 1 }))}
          className="input text-sm w-auto"
        >
          <option value="">All Monitored Pages</option>
          {pages.map((p) => (
            <option key={p.page_id} value={p.page_id}>{p.page_name}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-6">
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
        <div className="relative ml-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by ID, name..."
            className="input pl-8 text-sm w-56"
            value={filters.search || ''}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value || undefined, page: 1 }))}
          />
        </div>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/50">
                <th className="table-header">Customer</th>
                <th className="table-header">ID</th>
                <th className="table-header">Moderator</th>
                <th className="table-header">Page</th>
                <th className="table-header">Received</th>
                <th className="table-header">Replied</th>
                <th className="table-header">Response Time</th>
                <th className="table-header">Waiting</th>
                <th className="table-header">Delay Level</th>
                <th className="table-header">Status</th>
                <th className="table-header">Alert</th>
                <th className="table-header">Reply</th>
                <th className="table-header">Chat</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((c) => (
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
                    <span className={`badge ${
                      c.waiting_minutes <= 5 ? 'bg-green-50 text-green-600' :
                      c.waiting_minutes <= 10 ? 'bg-yellow-50 text-yellow-600' :
                      'bg-red-50 text-red-600'
                    }`}>
                      {c.waiting_minutes}m
                    </span>
                  </td>
                  <td className="table-cell">
                    <span className={`badge ${delayColors[c.delay_level] || 'bg-gray-100 text-gray-600'}`}>
                      {c.delay_level}
                    </span>
                  </td>
                  <td className="table-cell">
                    <span className={`badge ${
                      c.sla_status === 'compliant' ? 'bg-green-50 text-green-700' :
                      c.sla_status === 'delayed' ? 'bg-red-50 text-red-700' :
                      c.sla_status === 'outside_hours' ? 'bg-gray-100 text-gray-500' :
                      'bg-yellow-50 text-yellow-700'
                    }`}>
                      {c.sla_status?.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="table-cell">
                    {c.alert_sent ? (
                      <span className="badge bg-red-50 text-red-700">Sent</span>
                    ) : (
                      <span className="text-gray-300 text-xs">-</span>
                    )}
                  </td>
                  <td className="table-cell">
                    {c.has_human_reply ? (
                      <span className="badge bg-green-50 text-green-700">Human</span>
                    ) : c.has_automated_reply ? (
                      <span className="badge bg-yellow-50 text-yellow-700">Auto</span>
                    ) : (
                      <span className="text-gray-300 text-xs">-</span>
                    )}
                  </td>
                  <td className="table-cell">
                    <a href={c.conversation_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors">
                      <ExternalLink className="w-3.5 h-3.5" />
                      Open
                    </a>
                  </td>
                </tr>
              ))}
              {data.items.length === 0 && (
                <tr><td colSpan={13} className="py-10 text-center text-gray-400 text-sm">No conversations found</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
            <span className="text-sm text-gray-500">
              Showing {(data.page - 1) * data.page_size + 1} to {Math.min(data.page * data.page_size, data.total)} of {data.total}
            </span>
            <div className="flex gap-2">
              <button disabled={data.page <= 1} onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50">Previous</button>
              <button disabled={data.page >= totalPages} onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
