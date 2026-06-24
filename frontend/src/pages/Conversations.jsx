import { useState, useEffect } from 'react'
import { conversations, settings } from '../services/api'
import { ExternalLink, MessageSquare, Send, CheckCircle, Clock, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react'

const periods = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: '7days', label: 'Last 7 Days' },
  { value: '30days', label: 'Last 30 Days' },
  { value: 'all', label: 'All Time' },
]

export default function Conversations() {
  const [data, setData] = useState({ items: [], total: 0 })
  const [loading, setLoading] = useState(true)
  const [pages, setPages] = useState([])
  const [filters, setFilters] = useState({ period: 'today', page: 1 })
  const [expanded, setExpanded] = useState({})

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

  useEffect(() => { fetchData() }, [filters])

  const groups = {}
  data.items.forEach((c) => {
    const key = `${c.customer_id}|${c.page_id || ''}`
    if (!groups[key]) groups[key] = { customer_id: c.customer_id, page_name: c.page_name || '-', items: [] }
    groups[key].items.push(c)
  })

  const groupedList = Object.values(groups)

  const totalPages = Math.ceil(data.total / (data.page_size || 20))

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
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : (
        <div className="space-y-4">
          {groupedList.map((group) => {
            const latest = group.items[0]
            const convLink = latest.conversation_link
            return (
              <div key={group.customer_id} className="card p-0 overflow-hidden">
                <button
                  onClick={() => setExpanded((e) => ({ ...e, [group.customer_id]: !e[group.customer_id] }))}
                  className="w-full flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition-colors text-left"
                >
                  {expanded[group.customer_id] ? (
                    <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  )}
                  <MessageSquare className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono font-medium text-gray-900">{group.customer_id}</span>
                      <span className="text-xs text-gray-400">· {group.page_name}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        latest.sla_status === 'delayed' ? 'bg-red-50 text-red-600' :
                        latest.sla_status === 'compliant' ? 'bg-green-50 text-green-600' :
                        latest.sla_status === 'outside_hours' ? 'bg-gray-50 text-gray-500' :
                        'bg-yellow-50 text-yellow-600'
                      }`}>
                        {latest.sla_status?.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {group.items.length} session{group.items.length > 1 ? 's' : ''} · Last message {new Date(latest.message_timestamp).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {latest.last_sender_type === 'customer' ? (
                      <div className={`text-right ${latest.waiting_minutes > 5 ? 'text-red-600 font-bold' : 'text-gray-500'}`}>
                        <div className="text-lg">{latest.waiting_minutes}m</div>
                        <div className="text-xs">waiting</div>
                      </div>
                    ) : (
                      <div className="text-right text-green-600">
                        <CheckCircle className="w-5 h-5" />
                      </div>
                    )}
                    <a
                      href={convLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Open
                    </a>
                  </div>
                </button>

                {expanded[group.customer_id] && (
                  <div className="border-t border-gray-100 divide-y divide-gray-50">
                    {group.items.map((c) => (
                      <div key={c.id} className="px-5 py-3 ml-12">
                        <div className="flex items-center gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-mono text-gray-500">{c.customer_id}</span>
                              {c.moderator_name && (
                                <span className="text-xs text-gray-400">· replied by {c.moderator_name}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-4 mt-2">
                              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                <Send className="w-3 h-3" />
                                {new Date(c.message_timestamp).toLocaleString()}
                              </div>
                              {c.has_human_reply && c.first_reply_timestamp && (
                                <>
                                  <div className="text-xs text-gray-300">→</div>
                                  <div className="flex items-center gap-1.5 text-xs text-green-600">
                                    <CheckCircle className="w-3 h-3" />
                                    {new Date(c.first_reply_timestamp).toLocaleString()}
                                    <span className="text-gray-400">
                                      ({Math.floor(c.response_time_seconds / 60)}m {c.response_time_seconds % 60}s)
                                    </span>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="text-right flex items-center gap-3">
                            {c.sla_status === 'compliant' && (
                              <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">On time</span>
                            )}
                            {c.sla_status === 'delayed' && (
                              <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded-full">
                                {c.waiting_minutes}m delay
                              </span>
                            )}
                            {c.sla_status === 'pending' && (
                              <span className="text-xs font-medium text-yellow-600 bg-yellow-50 px-2 py-1 rounded-full">
                                Pending · {c.waiting_minutes}m
                              </span>
                            )}
                            {c.alert_sent && (
                              <span className="text-xs font-medium text-red-500">Alert sent</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {groupedList.length === 0 && (
            <div className="text-center py-12 text-gray-400">No conversations found</div>
          )}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-gray-500">
            Page {data.page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button disabled={data.page <= 1} onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50">Previous</button>
            <button disabled={data.page >= totalPages} onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50">Next</button>
          </div>
        </div>
      )}
    </div>
  )
}
