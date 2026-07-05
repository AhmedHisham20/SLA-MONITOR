import { useState, useEffect, useCallback } from 'react'
import { leads as leadsApi } from '../services/api'
import toast from 'react-hot-toast'
import {
  Search, Download, RotateCw, Copy, ExternalLink,
  ChevronLeft, ChevronRight, Phone, User, Calendar,
} from 'lucide-react'

const periods = [
  { label: 'All', value: '' },
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'Last 7 Days', value: '7d' },
  { label: 'Last 30 Days', value: '30d' },
]

const sortOptions = [
  { label: 'Newest', value: 'newest' },
  { label: 'Oldest', value: 'oldest' },
  { label: 'Last Updated', value: 'last_updated' },
  { label: 'Detection Count', value: 'detection_count' },
]

export default function LeadsCRM() {
  const [leads, setLeads] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [stats, setStats] = useState({ total_leads: 0, today_leads: 0, repeated_detections: 0 })
  const [pageFilter, setPageFilter] = useState('')
  const [pages, setPages] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [period, setPeriod] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [startDate, setStartDate] = useState('')
  const [endDate] = useState('')

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, per_page: 50, sort_by: sortBy }
      if (search) params.q = search
      if (period) params.period = period
      if (period === 'custom') {
        if (startDate) params.start_date = startDate
      }
      if (pageFilter) params.page_id = pageFilter
      const res = await leadsApi.list(params)
      setLeads(res.data || [])
      setTotal(res.total || 0)
      setTotalPages(res.total_pages || 1)
    } catch {
      toast.error('Failed to load leads')
    } finally {
      setLoading(false)
    }
  }, [page, search, period, sortBy, pageFilter])

  const fetchStats = useCallback(async () => {
    try {
      const s = await leadsApi.stats()
      setStats(s)
    } catch {
    }
  }, [])

  const fetchPages = useCallback(async () => {
    try {
      const p = await leadsApi.pages()
      setPages(p || [])
    } catch {
    }
  }, [])

  useEffect(() => { fetchLeads() }, [fetchLeads])
  useEffect(() => { fetchStats(); fetchPages() }, [fetchStats, fetchPages])

  const handleScan = async () => {
    try {
      await leadsApi.scan()
      toast.success('Scan complete')
      fetchLeads()
      fetchStats()
    } catch {
      toast.error('Scan failed')
    }
  }

  const handleExportCsv = async () => {
    try {
      const params = {}
      if (search) params.q = search
      if (period) params.period = period
      if (pageFilter) params.page_id = pageFilter
      const blob = await leadsApi.exportCsv(params)
      const url = URL.createObjectURL(new Blob([blob]))
      const a = document.createElement('a')
      a.href = url
      a.download = `leads_${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Exported')
    } catch {
      toast.error('Export failed')
    }
  }

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text)
    toast.success(`${label} copied`)
  }

  const openConversation = (lead) => {
    if (lead.conversation_id) {
      window.open(`/conversations/${lead.conversation_id}`, '_blank')
    } else {
      window.open('https://business.facebook.com/latest/inbox/all', '_blank')
    }
  }

  const handleSearch = (e) => {
    setSearch(e.target.value)
    setPage(1)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-gray-900">Leads CRM</h2>
        <div className="flex items-center gap-2">
          <button onClick={handleScan} className="btn-secondary inline-flex items-center gap-2 text-sm">
            <RotateCw className="w-4 h-4" />
            Scan Now
          </button>
          <button onClick={handleExportCsv} className="btn-secondary inline-flex items-center gap-2 text-sm">
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <Phone className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Leads</p>
              <p className="text-xl font-bold text-gray-900">{stats.total_leads}</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Today's Leads</p>
              <p className="text-xl font-bold text-gray-900">{stats.today_leads}</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
              <User className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Repeated Detections</p>
              <p className="text-xl font-bold text-gray-900">{stats.repeated_detections}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-6">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              className="input pl-9"
              placeholder="Search by phone, name, conversation ID..."
              value={search}
              onChange={handleSearch}
            />
          </div>
          <select className="input w-auto" value={period} onChange={(e) => { setPeriod(e.target.value); setPage(1) }}>
            {periods.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          <select className="input w-auto" value={pageFilter} onChange={(e) => { setPageFilter(e.target.value); setPage(1) }}>
            <option value="">All Pages</option>
            {pages.map((p) => (
              <option key={p.page_name} value={p.page_name}>{p.page_name} ({p.count})</option>
            ))}
          </select>
          <select className="input w-auto" value={sortBy} onChange={(e) => { setSortBy(e.target.value); setPage(1) }}>
            {sortOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto bg-white rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left py-3 px-4 font-medium text-gray-500">Phone</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500">Customer Name</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500">Page</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500">First Detection</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500">Last Seen</th>
              <th className="text-center py-3 px-4 font-medium text-gray-500">Detections</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500">Conversation</th>
              <th className="text-right py-3 px-4 font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-gray-400">Loading...</td>
              </tr>
            ) : leads.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-gray-400">No leads found. Click "Scan Now" to scan conversations for phone numbers.</td>
              </tr>
            ) : (
              leads.map((lead) => (
                <tr key={lead.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <span className="font-mono text-sm text-blue-600">{lead.phone_number}</span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-gray-900 font-medium">{lead.customer_name || '-'}</div>
                    {lead.messenger_name && lead.messenger_name !== lead.customer_name && (
                      <div className="text-xs text-gray-400">{lead.messenger_name}</div>
                    )}
                  </td>
                  <td className="py-3 px-4 text-gray-500">{lead.page_name || '-'}</td>
                  <td className="py-3 px-4 text-gray-500 text-xs">
                    {lead.first_detected_at ? new Date(lead.first_detected_at).toLocaleDateString() : '-'}
                  </td>
                  <td className="py-3 px-4 text-gray-500 text-xs">
                    {lead.last_seen ? new Date(lead.last_seen).toLocaleDateString() : '-'}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium ${
                      lead.detection_count > 1 ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-500'
                    }`}>
                      {lead.detection_count}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-xs text-gray-400 font-mono">
                      {lead.conversation_id ? lead.conversation_id.slice(-12) : '-'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => copyToClipboard(lead.phone_number, 'Phone')} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Copy Phone">
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      {lead.last_message && (
                        <button onClick={() => copyToClipboard(lead.last_message, 'Message')} className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Copy Last Message">
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button onClick={() => openConversation(lead)} className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors" title="Open Conversation">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500">
            Showing {(page - 1) * 50 + 1}-{Math.min(page * 50, total)} of {total}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-gray-600">{page} / {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
