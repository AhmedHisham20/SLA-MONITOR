import { useState, useEffect } from 'react'
import { conversations, settings } from '../services/api'
import { ExternalLink, MessageSquare, CheckCircle, Clock, AlertTriangle, ChevronDown, ChevronRight, User, Bot } from 'lucide-react'

const periods = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: '7days', label: 'Last 7 Days' },
  { value: '30days', label: 'Last 30 Days' },
  { value: 'all', label: 'All Time' },
]

function StatusBadge({ status, lastSenderType, waitingMinutes }) {
  if (lastSenderType === 'page') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
        <CheckCircle className="w-3.5 h-3.5" />
        Responded
      </span>
    )
  }
  if (status === 'delayed') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
        <AlertTriangle className="w-3.5 h-3.5" />
        DELAYED
        {waitingMinutes > 0 && <span className="ml-0.5">· {waitingMinutes}m</span>}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-yellow-50 text-yellow-700 border border-yellow-200">
      <Clock className="w-3.5 h-3.5" />
      Pending Reply
      {waitingMinutes > 0 && <span className="ml-0.5">· {waitingMinutes}m</span>}
    </span>
  )
}

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

  const groupedList = Object.values(groups).map((g) => ({
    ...g,
    items: g.items.sort((a, b) => new Date(a.message_timestamp) - new Date(b.message_timestamp)),
  }))

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
            const latest = group.items[group.items.length - 1]
            const convLink = latest.conversation_link
            const isExpanded = expanded[group.customer_id]
            return (
              <div key={group.customer_id} className="card p-0 overflow-hidden">
                <button
                  onClick={() => setExpanded((e) => ({ ...e, [group.customer_id]: !e[group.customer_id] }))}
                  className="w-full flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition-colors text-left"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  )}
                  <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <MessageSquare className="w-4 h-4 text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900">{group.customer_id}</span>
                      <span className="text-xs text-gray-400">· {group.page_name}</span>
                      <StatusBadge
                        status={latest.sla_status}
                        lastSenderType={latest.last_sender_type}
                        waitingMinutes={latest.waiting_minutes}
                      />
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {group.items.length} session{group.items.length > 1 ? 's' : ''} · Last message {new Date(latest.message_timestamp).toLocaleString()}
                    </div>
                  </div>
                  <a
                    href={convLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors flex-shrink-0"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open Chat
                  </a>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-100 bg-gray-50/50 px-5 py-4">
                    <div className="max-w-2xl mx-auto space-y-4">
                      {group.items.map((c, idx) => {
                        const isCustomer = c.last_sender_type === 'customer'
                        const prev = idx > 0 ? group.items[idx - 1] : null
                        const isReply = !isCustomer && prev && prev.last_sender_type === 'customer'

                        return (
                          <div key={c.id} className={`flex ${isCustomer ? '' : 'flex-row-reverse'}`}>
                            <div className={`flex gap-3 max-w-[85%] ${isCustomer ? '' : 'flex-row-reverse'}`}>
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                isCustomer ? 'bg-blue-100' : 'bg-green-100'
                              }`}>
                                {isCustomer ? (
                                  <User className="w-4 h-4 text-blue-600" />
                                ) : (
                                  <Bot className="w-4 h-4 text-green-600" />
                                )}
                              </div>
                              <div>
                                <div className={`rounded-2xl px-4 py-2.5 ${
                                  isCustomer
                                    ? 'bg-white border border-gray-200 text-gray-800'
                                    : 'bg-green-50 border border-green-200 text-gray-800'
                                }`}>
                                  <div className="flex items-center gap-2 mb-0.5">
                                    <span className={`text-xs font-semibold ${isCustomer ? 'text-blue-600' : 'text-green-600'}`}>
                                      {isCustomer ? 'Customer' : 'Page'}
                                    </span>
                                    {!isCustomer && c.moderator_name && (
                                      <span className="text-xs text-gray-400">· {c.moderator_name}</span>
                                    )}
                                  </div>
                                  <p className="text-sm whitespace-pre-wrap break-words">
                                    {c.message_content || (isCustomer ? 'Sent a message' : 'Replied')}
                                  </p>
                                </div>
                                <div className={`flex items-center gap-2 mt-1 ${isCustomer ? '' : 'flex-row-reverse'}`}>
                                  <span className="text-[11px] text-gray-400">{new Date(c.message_timestamp).toLocaleString()}</span>
                                  {isReply && c.response_time_seconds != null && (
                                    <span className="text-[11px] text-gray-400">
                                      · Response: {Math.floor(c.response_time_seconds / 60)}m {c.response_time_seconds % 60}s
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
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