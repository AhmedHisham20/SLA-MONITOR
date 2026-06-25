import { useState, useEffect, useMemo } from 'react'
import { conversations, settings } from '../services/api'
import {
  ExternalLink, MessageSquare, CheckCircle, Clock, AlertTriangle,
  ChevronDown, ChevronRight, User, Bot, MailQuestion, Timer,
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
  { value: 'responded', label: 'Responded' },
  { value: 'pending', label: 'Pending' },
  { value: 'delayed', label: 'Delayed' },
]

function StatusBadge({ status, lastSenderType, waitingMinutes }) {
  if (lastSenderType === 'page') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-300">
        <CheckCircle className="w-3.5 h-3.5" />
        Responded
      </span>
    )
  }
  if (status === 'delayed') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border-2 border-red-400 shadow-sm animate-pulse">
        <AlertTriangle className="w-4 h-4" />
        DELAYED
        {waitingMinutes > 0 && <span>· {waitingMinutes}m</span>}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700 border border-yellow-300">
      <Clock className="w-3.5 h-3.5" />
      Pending
      {waitingMinutes > 0 && <span>· {waitingMinutes}m</span>}
    </span>
  )
}

function UnansweredMessages({ texts }) {
  let items = []
  try {
    items = texts ? JSON.parse(texts) : []
  } catch { items = [] }
  if (items.length === 0) return null
  const reversed = [...items].reverse()
  return (
    <div className="bg-amber-50/70 rounded-xl border border-amber-200 p-4 mt-3">
      <div className="flex items-center gap-2 mb-3">
        <MailQuestion className="w-4 h-4 text-amber-500" />
        <span className="text-sm font-semibold text-amber-700">Unanswered Messages ({items.length})</span>
      </div>
      <div className="space-y-2">
        {reversed.map((t, i) => (
          <div key={i} className="flex items-start gap-2.5 py-1.5 px-3 rounded-lg bg-white/60">
            <span className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-[10px] font-bold text-amber-600">{items.length - i}</span>
            </span>
            <span className="text-sm text-gray-700 flex-1 whitespace-pre-wrap break-words">
              {t || <span className="italic text-gray-400">(media or unsupported)</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Conversations() {
  const [data, setData] = useState({ items: [], total: 0 })
  const [loading, setLoading] = useState(true)
  const [pages, setPages] = useState([])
  const [filters, setFilters] = useState({ period: 'today', page: 1 })
  const [statusFilter, setStatusFilter] = useState('')
  const [expanded, setExpanded] = useState({})
  const [counts, setCounts] = useState({ all: 0, responded: 0, pending: 0, delayed: 0 })

  useEffect(() => {
    settings.pages().then((res) => {
      setPages(Array.isArray(res) ? res.filter((p) => p.is_connected) : [])
    }).catch(() => {})
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const params = { ...filters }
      if (statusFilter) params.status = statusFilter
      const [convRes, countRes] = await Promise.all([
        conversations.list(params),
        conversations.statusCounts({ period: filters.period, page_id: filters.page_id || undefined }),
      ])
      setData(convRes)
      setCounts(countRes)
    } catch {
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [filters, statusFilter])

  const groups = {}
  data.items.forEach((c) => {
    const key = `${c.customer_id}|${c.page_id || ''}`
    if (!groups[key]) {
      groups[key] = { customer_id: c.customer_id, customer_name: c.customer_name, page_name: c.page_name || '-', items: [] }
    }
    groups[key].items.push(c)
  })

  const groupedList = useMemo(() => {
    const list = Object.values(groups).map((g) => ({
      ...g,
      items: g.items.sort((a, b) => new Date(a.message_timestamp) - new Date(b.message_timestamp)),
    }))
    list.sort((a, b) => {
      const la = a.items[a.items.length - 1]
      const lb = b.items[b.items.length - 1]
      const ra = la.last_sender_type === 'page' ? 2 : la.sla_status === 'delayed' ? 0 : 1
      const rb = lb.last_sender_type === 'page' ? 2 : lb.sla_status === 'delayed' ? 0 : 1
      if (ra !== rb) return ra - rb
      return new Date(lb.message_timestamp) - new Date(la.message_timestamp)
    })
    return list
  }, [data.items])

  const totalPages = Math.ceil(data.total / (data.page_size || 20))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Conversations</h1>
        <select
          value={filters.page_id || ''}
          onChange={(e) => { setFilters((f) => ({ ...f, page_id: e.target.value || undefined, page: 1 })); setStatusFilter('') }}
          className="input text-sm w-auto"
        >
          <option value="">All Monitored Pages</option>
          {pages.map((p) => (
            <option key={p.page_id} value={p.page_id}>{p.page_name}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {periods.map((p) => (
          <button
            key={p.value}
            onClick={() => { setFilters((f) => ({ ...f, period: p.value, page: 1 })); setStatusFilter('') }}
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

      <div className="flex flex-wrap items-center gap-2 mb-6">
        {statusTabs.map((t) => {
          const countKey = t.value || 'all'
          const count = counts[countKey] ?? 0
          const isActive = statusFilter === t.value
          const tabColors = isActive
            ? t.value === 'delayed' ? 'bg-red-600 text-white ring-2 ring-red-300' :
              t.value === 'responded' ? 'bg-green-600 text-white' :
              t.value === 'pending' ? 'bg-yellow-600 text-white' :
              'bg-blue-600 text-white'
            : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          return (
            <button
              key={t.value}
              onClick={() => { setStatusFilter(t.value); setFilters((f) => ({ ...f, page: 1 })) }}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tabColors}`}
            >
              {t.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                isActive ? 'bg-white/20' : 'bg-gray-100 text-gray-500'
              }`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : (
        <div className="space-y-4">
          {groupedList.map((group) => {
            const latest = group.items[group.items.length - 1]
            const convLink = latest.conversation_link
            const isDelayed = latest.last_sender_type === 'customer' && latest.sla_status === 'delayed'
            const isPending = latest.last_sender_type === 'customer' && latest.sla_status !== 'delayed'
            return (
              <div
                key={group.customer_id}
                className={`card p-0 overflow-hidden transition-all duration-200 ${
                  isDelayed ? 'ring-2 ring-red-400 shadow-lg shadow-red-100 border-red-200' : ''
                } ${isPending ? 'border-amber-200' : ''}`}
              >
                <div className={`px-5 py-4 ${isDelayed ? 'bg-gradient-to-r from-red-50 to-white' : ''}`}>
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      isDelayed ? 'bg-red-100' : isPending ? 'bg-amber-100' : 'bg-green-100'
                    }`}>
                      <MessageSquare className={`w-5 h-5 ${
                        isDelayed ? 'text-red-500' : isPending ? 'text-amber-500' : 'text-green-500'
                      }`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sm font-bold text-gray-900">
                          {group.customer_name || group.customer_id}
                        </span>
                        <span className="text-xs text-gray-400">· {group.page_name}</span>
                        <StatusBadge
                          status={latest.sla_status}
                          lastSenderType={latest.last_sender_type}
                          waitingMinutes={latest.waiting_minutes}
                        />
                      </div>

                      <div className="flex items-center gap-4 flex-wrap">
                        {latest.last_sender_type === 'customer' && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500">
                            <Timer className="w-3.5 h-3.5" />
                            Waiting {latest.waiting_minutes}m
                          </span>
                        )}
                        {latest.unanswered_count > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">
                            <MailQuestion className="w-3.5 h-3.5" />
                            {latest.unanswered_count} unanswered
                          </span>
                        )}
                        <span className="text-xs text-gray-400">
                          {new Date(latest.message_timestamp).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <a
                        href={convLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 text-xs font-medium px-3 py-2 rounded-lg hover:bg-blue-50 transition-colors border border-blue-200"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Open Chat
                      </a>
                    </div>
                  </div>

                  {latest.last_sender_type === 'customer' && latest.unanswered_count > 0 && (
                    <UnansweredMessages texts={latest.unanswered_texts} />
                  )}
                </div>

                <div className="border-t border-gray-100">
                  <button
                    onClick={() => setExpanded((e) => ({ ...e, [group.customer_id]: !e[group.customer_id] }))}
                    className="w-full flex items-center gap-2 px-5 py-2.5 hover:bg-gray-50 transition-colors text-left text-xs text-gray-400 font-medium"
                  >
                    {expanded[group.customer_id] ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                    {group.items.length} session{group.items.length > 1 ? 's' : ''} · View timeline
                  </button>

                  {expanded[group.customer_id] && (
                    <div className="border-t border-gray-100 bg-gray-50/80 px-5 py-4">
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