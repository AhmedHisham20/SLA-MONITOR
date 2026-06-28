import { useState, useEffect, useMemo } from 'react'
import { conversations, settings } from '../services/api'
import {
  ExternalLink, MessageSquare, CheckCircle, Clock, AlertTriangle,
  ChevronDown, ChevronRight, Timer, XCircle, ShieldCheck, Eye,
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

function StatusBadge({ status, lastSenderType, waitingMinutes, reviewedAt }) {
  if (lastSenderType === 'page') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-300">
        <CheckCircle className="w-3.5 h-3.5" />
        Responded
      </span>
    )
  }
  if (status === 'delayed') {
    const isReviewed = !!reviewedAt
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border-2 border-red-400 shadow-sm">
        <AlertTriangle className="w-4 h-4" />
        DELAYED
        {waitingMinutes > 0 && <span> · {waitingMinutes}m</span>}
        {isReviewed && (
          <span className="ml-1 inline-flex items-center gap-1 text-[10px] bg-red-200 text-red-800 px-1.5 py-0.5 rounded-full">REVIEWED</span>
        )}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700 border border-yellow-300">
      <Clock className="w-3.5 h-3.5" />
      Pending
      {waitingMinutes > 0 && <span> · {waitingMinutes}m</span>}
    </span>
  )
}

function formatDuration(seconds) {
  if (seconds == null) return '-'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m === 0) return `${s}s`
  return `${m}m ${s}s`
}

function SlaEventRow({ event }) {
  const received = new Date(event.received_at).toLocaleString()
  const replied = event.replied_at ? new Date(event.replied_at).toLocaleString() : null
  const isExceeded = event.sla_exceeded
  const waitingMinutes = isExceeded && !replied
    ? Math.floor((Date.now() - new Date(event.received_at).getTime()) / 60000)
    : null
  return (
    <div className={`flex items-start gap-3 py-3 px-4 rounded-xl ${isExceeded ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${isExceeded ? 'bg-red-200' : 'bg-green-200'}`}>
        {isExceeded ? (
          <XCircle className="w-4 h-4 text-red-600" />
        ) : (
          <ShieldCheck className="w-4 h-4 text-green-600" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900 whitespace-pre-wrap break-words mb-1">
          {event.message_text || <span className="italic text-gray-400">(media or unsupported)</span>}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
          <span>Received: <span className="font-medium text-gray-700">{received}</span></span>
          {replied && <span>Replied: <span className="font-medium text-gray-700">{replied}</span></span>}
          {event.response_time_seconds != null ? (
            <span>Response: <span className={`font-semibold ${isExceeded ? 'text-red-600' : 'text-green-600'}`}>{formatDuration(event.response_time_seconds)}</span></span>
          ) : isExceeded ? (
            <span>Waiting: <span className="font-semibold text-red-600">{waitingMinutes} min</span></span>
          ) : null}
          {!replied && isExceeded && (
            <span className="text-red-500 italic">Waiting for reply...</span>
          )}
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${isExceeded ? 'bg-red-200 text-red-700' : 'bg-green-200 text-green-700'}`}>
            {isExceeded ? 'Delayed' : 'OK'}
          </span>
        </div>
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
  const [detailEvents, setDetailEvents] = useState({})
  const [reviewing, setReviewing] = useState({})

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
      const ra = la.sla_status === 'delayed' && !la.reviewed_at ? 0 : 1
      const rb = lb.sla_status === 'delayed' && !lb.reviewed_at ? 0 : 1
      if (ra !== rb) return ra - rb
      return new Date(lb.message_timestamp) - new Date(la.message_timestamp)
    })
    return list
  }, [data.items])

  const totalPages = Math.ceil(data.total / (data.page_size || 20))

  const loadEvents = async (conversationId) => {
    if (detailEvents[conversationId]) return
    try {
      const conv = await conversations.get(conversationId)
      setDetailEvents((prev) => ({ ...prev, [conversationId]: conv.message_events || [] }))
    } catch {}
  }

  const toggleExpand = (customerId, conversationId) => {
    const key = customerId
    setExpanded((e) => ({ ...e, [key]: !e[key] }))
    if (!expanded[key] && conversationId) {
      loadEvents(conversationId)
    }
  }

  const handleReview = async (conversationId) => {
    setReviewing((r) => ({ ...r, [conversationId]: true }))
    try {
      await conversations.review(conversationId)
      const params = { ...filters }
      if (statusFilter) params.status = statusFilter
      const convRes = await conversations.list(params)
      setData(convRes)
    } catch {}
    setReviewing((r) => ({ ...r, [conversationId]: false }))
  }

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
            const isReviewed = !!latest.reviewed_at
            const isUnreviewedDelayed = isDelayed && !isReviewed
            const hasViolation = latest.has_sla_violation || isDelayed
            const cardRing = isUnreviewedDelayed
              ? 'ring-2 ring-red-500 shadow-lg shadow-red-200 border-red-400'
              : isDelayed
                ? 'ring-2 ring-red-300 shadow-md shadow-red-100 border-red-200'
                : 'ring-2 ring-green-400 shadow-lg shadow-green-100 border-green-300'
            const cardBg = isUnreviewedDelayed
              ? 'bg-gradient-to-r from-red-50 to-white'
              : isDelayed
                ? 'bg-gradient-to-r from-red-50/60 to-white'
                : 'bg-gradient-to-r from-green-50 to-white'
            const iconBg = isUnreviewedDelayed ? 'bg-red-100' : isDelayed ? 'bg-red-50' : 'bg-green-100'
            const iconColor = isUnreviewedDelayed ? 'text-red-500' : isDelayed ? 'text-red-400' : 'text-green-500'
            return (
              <div
                key={group.customer_id}
                className={`card p-0 overflow-hidden transition-all duration-200 ${cardRing}`}
              >
                <div className={`px-5 py-4 ${cardBg}`}>
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
                      <MessageSquare className={`w-5 h-5 ${iconColor}`} />
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
                          reviewedAt={latest.reviewed_at}
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
                            <MessageSquare className="w-3.5 h-3.5" />
                            {latest.unanswered_count} unread
                          </span>
                        )}
                        <span className="text-xs text-gray-400">
                          {new Date(latest.message_timestamp).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isUnreviewedDelayed && (
                        <button
                          onClick={() => handleReview(latest.id)}
                          disabled={reviewing[latest.id]}
                          className="inline-flex items-center gap-1.5 text-orange-600 hover:text-orange-800 text-xs font-medium px-3 py-2 rounded-lg hover:bg-orange-50 transition-colors border border-orange-200 disabled:opacity-50"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          {reviewing[latest.id] ? '...' : 'Reviewed'}
                        </button>
                      )}
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
                </div>

                <div className="border-t border-gray-100">
                  <button
                    onClick={() => toggleExpand(group.customer_id, latest.id)}
                    className="w-full flex items-center gap-2 px-5 py-2.5 hover:bg-gray-50 transition-colors text-left text-xs text-gray-400 font-medium"
                  >
                    {expanded[group.customer_id] ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                    SLA History
                  </button>

                  {expanded[group.customer_id] && (
                    <div className="border-t border-gray-100">
                      {(detailEvents[latest.id] && detailEvents[latest.id].length > 0) && (
                        <div className="px-5 py-4">
                          <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4" />
                            SLA Events
                          </h4>
                          <div className="space-y-2">
                            {detailEvents[latest.id].map((evt) => (
                              <SlaEventRow key={evt.id} event={evt} />
                            ))}
                          </div>
                        </div>
                      )}
                      {(detailEvents[latest.id] && detailEvents[latest.id].length === 0) && (
                        <div className="px-5 py-8 text-center text-sm text-gray-400">
                          No SLA events recorded yet
                        </div>
                      )}
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