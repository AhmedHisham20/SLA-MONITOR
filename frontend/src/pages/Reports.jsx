import { useState, useEffect } from 'react'
import { reports, settings } from '../services/api'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area,
} from 'recharts'

const periods = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
]

export default function Reports() {
  const [period, setPeriod] = useState('daily')
  const [data, setData] = useState(null)
  const [moderators, setModerators] = useState([])
  const [loading, setLoading] = useState(true)
  const [pages, setPages] = useState([])
  const [selectedPage, setSelectedPage] = useState('')

  useEffect(() => {
    settings.pages().then((res) => {
      setPages(Array.isArray(res) ? res.filter((p) => p.is_connected) : [])
    }).catch(() => {})
  }, [])

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const params = { period }
        if (selectedPage) params.page_id = selectedPage
        const [reportRes, modRes] = await Promise.all([
          reports.get(params),
          reports.moderators({ days: 30 }),
        ])
        setData(reportRes)
        setModerators(modRes.moderators || [])
      } catch {
        // silently fail
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [period, selectedPage])

  const m = data?.metrics
  const formatTime = (seconds) => {
    if (!seconds) return 'N/A'
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}m ${s}s`
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <div className="flex items-center gap-3">
          <select
            value={selectedPage}
            onChange={(e) => setSelectedPage(e.target.value)}
            className="input text-sm w-auto"
          >
            <option value="">All Monitored Pages</option>
            {pages.map((p) => (
              <option key={p.page_id} value={p.page_id}>{p.page_name}</option>
            ))}
          </select>
          <div className="flex gap-2">
          {periods.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
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
      </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div className="card">
          <p className="text-sm text-gray-500">Total Messages</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{m?.total_messages || 0}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Total Conversations</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{m?.total_conversations || 0}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Avg Response Time</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatTime(m?.average_response_time_seconds)}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Delayed Conversations</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{m?.delayed_conversations || 0}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">SLA Compliance</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{m?.sla_compliance_rate || 100}%</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Total Alerts</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{m?.total_alerts_sent || 0}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Messages Per Day</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data?.charts?.messages_per_day || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Response Time Trend</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={data?.charts?.response_time_trend || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#8b5cf6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Delayed Conversations Trend</h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={data?.charts?.delayed_trend || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Area type="monotone" dataKey="value" stroke="#ef4444" fill="#fecaca" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">SLA Trend</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={data?.charts?.sla_trend || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#22c55e" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {moderators.length > 0 && (
        <div className="card mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Moderator Performance</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-2 font-medium text-gray-500">Rank</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-500">Moderator</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-500">Total Replies</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-500">Avg Response</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-500">Delayed</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-500">SLA Score</th>
                </tr>
              </thead>
              <tbody>
                {moderators.map((mod, i) => (
                  <tr key={mod.moderator_name} className="border-b border-gray-100">
                    <td className="py-3 px-2 text-gray-500">{i + 1}</td>
                    <td className="py-3 px-2 font-medium text-gray-900">{mod.moderator_name}</td>
                    <td className="py-3 px-2 text-gray-600">{mod.total_replies}</td>
                    <td className="py-3 px-2 text-gray-600">{formatTime(mod.average_response_time_seconds)}</td>
                    <td className="py-3 px-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        mod.delayed_replies > 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
                      }`}>
                        {mod.delayed_replies}
                      </span>
                    </td>
                    <td className="py-3 px-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        mod.sla_score >= 95 ? 'bg-green-50 text-green-600' :
                        mod.sla_score >= 80 ? 'bg-yellow-50 text-yellow-600' :
                        'bg-red-50 text-red-600'
                      }`}>
                        {mod.sla_score}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
