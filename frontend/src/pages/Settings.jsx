import { useState, useEffect } from 'react'
import { settings as settingsApi, whatsapp, logs as logsApi } from '../services/api'
import toast from 'react-hot-toast'
import { Eye, EyeOff } from 'lucide-react'

const tabs = ['General', 'SLA', 'WhatsApp', 'Facebook Pages', 'Page Monitoring', 'Logs']

export default function Settings() {
  const [activeTab, setActiveTab] = useState('General')
  const [form, setForm] = useState({})
  const [pages, setPages] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showWhatsAppToken, setShowWhatsAppToken] = useState(false)
  const [logs, setLogs] = useState([])
  const [logsLoading, setLogsLoading] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [settingsRes, pagesRes] = await Promise.all([
          settingsApi.get(),
          settingsApi.pages(),
        ])
        setForm(settingsRes)
        setPages(Array.isArray(pagesRes) ? pagesRes : [])
      } catch {
        toast.error('Failed to load settings')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const fetchLogs = async () => {
    setLogsLoading(true)
    try {
      const res = await logsApi.get()
      setLogs(Array.isArray(res) ? res : [])
    } catch {
      // silent
    } finally {
      setLogsLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'Logs') {
      fetchLogs()
      const interval = setInterval(fetchLogs, 10000)
      return () => clearInterval(interval)
    }
  }, [activeTab])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await settingsApi.update(form)
      setForm((prev) => ({
        ...res,
        whatsapp_access_token: prev.whatsapp_access_token || res.whatsapp_access_token,
      }))
      toast.success('Settings saved')
    } catch {
      toast.error('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleTestWhatsApp = async () => {
    try {
      const to = form.whatsapp_recipient_number
      if (!to) {
        toast.error('Please enter a Recipient Phone Number first')
        return
      }
      const res = await whatsapp.test(to)
      toast.success(res.success ? 'Test message sent!' : 'Test failed')
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.response?.data?.message || err?.message || 'Test failed'
      toast.error(typeof msg === 'string' ? msg : JSON.stringify(msg))
    }
  }

  const [newPage, setNewPage] = useState({ page_id: '', page_name: '', access_token: '' })
  const [connectToken, setConnectToken] = useState('')
  const [connecting, setConnecting] = useState(false)

  const handleAddPage = async () => {
    if (!newPage.page_id || !newPage.page_name) {
      toast.error('Page ID and Page Name are required')
      return
    }
    try {
      await settingsApi.addPage(newPage.page_id, newPage.page_name, newPage.access_token || '')
      const p = await settingsApi.pages()
      setPages(Array.isArray(p) ? p : [])
      setNewPage({ page_id: '', page_name: '', access_token: '' })
      toast.success('Page added')
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.response?.data?.message || err?.message || 'Failed to add page'
      toast.error(typeof msg === 'string' ? msg : JSON.stringify(msg))
    }
  }

  const handleConnectFromToken = async () => {
    if (!connectToken) {
      toast.error('Enter your Page Access Token')
      return
    }
    setConnecting(true)
    try {
      await settingsApi.addPageFromToken(connectToken)
      const p = await settingsApi.pages()
      setPages(Array.isArray(p) ? p : [])
      setConnectToken('')
      toast.success('Page connected successfully!')
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.response?.data?.message || err?.message || 'Failed to connect'
      toast.error(typeof msg === 'string' ? msg : JSON.stringify(msg))
    } finally {
      setConnecting(false)
    }
  }

  const handleUpdateToken = async (pageId, pageName) => {
    const token = prompt(`Enter new Access Token for ${pageName}:`)
    if (token) {
      try {
        await settingsApi.updateToken(pageId, token)
        toast.success('Access token updated')
      } catch {
        toast.error('Failed to update token')
      }
    }
  }

  const handleRemovePage = async (pageId) => {
    if (confirm('Remove this page?')) {
      try {
        await settingsApi.removePage(pageId)
        setPages((prev) => prev.filter((p) => p.page_id !== pageId))
        toast.success('Page removed')
      } catch {
        toast.error('Failed to remove page')
      }
    }
  }

  const handleToggleMonitoring = async (pageId, enabled) => {
    try {
      const res = await settingsApi.toggleMonitoring(pageId, enabled)
      setPages((prev) =>
        prev.map((p) =>
          p.page_id === pageId ? { ...p, monitoring_enabled: res.monitoring_enabled } : p
        )
      )
      toast.success(`Monitoring ${enabled ? 'enabled' : 'disabled'} for ${res.page_name}`)
    } catch {
      toast.error('Failed to toggle monitoring')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  const formatLastActivity = (date) => {
    if (!date) return 'Never'
    const d = new Date(date)
    const now = new Date()
    const diff = now - d
    if (diff < 60000) return 'Just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return d.toLocaleDateString()
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

      <div className="flex gap-2 mb-6 flex-wrap">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="card">
        {activeTab === 'General' && (
          <div className="space-y-4 max-w-lg">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
              <input
                className="input"
                value={form.company_name || ''}
                onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
              <input
                className="input"
                value={form.timezone || ''}
                onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
                placeholder="UTC"
              />
            </div>
            <div className="border-t border-gray-200 pt-4">
              <h3 className="font-medium text-gray-900 mb-3">Facebook Integration</h3>
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Verify Token</label>
                <input
                  className="input"
                  value={form.facebook_verify_token || ''}
                  onChange={(e) => setForm((f) => ({ ...f, facebook_verify_token: e.target.value }))}
                  placeholder="messenger-sla-verify-token"
                />
                <p className="text-xs text-gray-400 mt-1">Used for webhook verification with Meta</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Facebook Access Token</label>
                <input
                  type="password"
                  className="input"
                  value={form.facebook_access_token || ''}
                  onChange={(e) => setForm((f) => ({ ...f, facebook_access_token: e.target.value }))}
                  placeholder="Page access token for API calls"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'SLA' && (
          <div className="space-y-4 max-w-lg">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
              SLA monitoring runs 24/7. All customer messages are tracked regardless of time, weekends, or holidays.
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Delay Threshold (minutes)
              </label>
              <input
                type="number"
                className="input"
                value={form.sla_threshold_minutes || 5}
                onChange={(e) => setForm((f) => ({ ...f, sla_threshold_minutes: parseInt(e.target.value) }))}
              />
              <p className="text-xs text-gray-400 mt-1">WhatsApp alert sent after this many minutes</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Admin Escalation (minutes)
              </label>
              <input
                type="number"
                className="input"
                value={form.escalation_admin_minutes || 10}
                onChange={(e) => setForm((f) => ({ ...f, escalation_admin_minutes: parseInt(e.target.value) }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Critical Escalation (minutes)
              </label>
              <input
                type="number"
                className="input"
                value={form.escalation_critical_minutes || 15}
                onChange={(e) => setForm((f) => ({ ...f, escalation_critical_minutes: parseInt(e.target.value) }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.daily_summary_enabled || false}
                  onChange={(e) => setForm((f) => ({ ...f, daily_summary_enabled: e.target.checked }))}
                  className="rounded"
                />
                Daily Summary
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.weekly_summary_enabled || false}
                  onChange={(e) => setForm((f) => ({ ...f, weekly_summary_enabled: e.target.checked }))}
                  className="rounded"
                />
                Weekly Summary
              </label>
            </div>
          </div>
        )}

        {activeTab === 'WhatsApp' && (
          <div className="space-y-4 max-w-lg">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number ID
              </label>
              <input
                className="input"
                value={form.whatsapp_phone_number_id || ''}
                onChange={(e) => setForm((f) => ({ ...f, whatsapp_phone_number_id: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Access Token
              </label>
              <div className="relative">
                <input
                  type={showWhatsAppToken ? 'text' : 'password'}
                  className="input pr-10"
                  value={form.whatsapp_access_token || ''}
                  onChange={(e) => setForm((f) => ({ ...f, whatsapp_access_token: e.target.value }))}
                />
                <button
                  type="button"
                  onClick={() => setShowWhatsAppToken((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showWhatsAppToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Recipient Phone Number
              </label>
              <input
                className="input"
                value={form.whatsapp_recipient_number || ''}
                onChange={(e) => setForm((f) => ({ ...f, whatsapp_recipient_number: e.target.value }))}
                placeholder="20100xxxxxxx"
              />
              <p className="text-xs text-gray-400 mt-1">
                The phone number that will receive SLA alerts and daily reports (include country code without +)
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={handleTestWhatsApp} className="btn-primary">
                Send Test Message
              </button>
            </div>
          </div>
        )}

        {activeTab === 'Facebook Pages' && (
          <div className="space-y-4 max-w-lg">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
              <h3 className="font-medium text-blue-900">Quick Connect (Recommended)</h3>
              <p className="text-sm text-blue-700">Paste your Page Access Token and we'll fetch the page info automatically.</p>
              <input
                className="input"
                placeholder="Page Access Token"
                value={connectToken}
                onChange={(e) => setConnectToken(e.target.value)}
              />
              <button onClick={handleConnectFromToken} disabled={connecting} className="btn-primary">
                {connecting ? 'Connecting...' : 'Connect Page'}
              </button>
            </div>
            <details className="text-sm text-gray-500 cursor-pointer">
              <summary className="font-medium">Manual entry (Page ID + Name)</summary>
              <div className="mt-3 bg-white border border-gray-200 rounded-lg p-4 space-y-3">
                <input
                  className="input"
                  placeholder="Page ID"
                  value={newPage.page_id}
                  onChange={(e) => setNewPage((f) => ({ ...f, page_id: e.target.value }))}
                />
                <input
                  className="input"
                  placeholder="Page Name"
                  value={newPage.page_name}
                  onChange={(e) => setNewPage((f) => ({ ...f, page_name: e.target.value }))}
                />
                <input
                  className="input"
                  placeholder="Page Access Token"
                  value={newPage.access_token}
                  onChange={(e) => setNewPage((f) => ({ ...f, access_token: e.target.value }))}
                />
                <button onClick={handleAddPage} className="btn-primary">
                  + Add Page
                </button>
              </div>
            </details>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 font-medium text-gray-500">Page Name</th>
                    <th className="text-left py-3 font-medium text-gray-500">Page ID</th>
                    <th className="text-left py-3 font-medium text-gray-500">Status</th>
                    <th className="text-left py-3 font-medium text-gray-500">Token</th>
                    <th className="text-right py-3 font-medium text-gray-500">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pages.filter((p) => p.is_connected).map((page) => (
                    <tr key={page.page_id} className="border-b border-gray-100">
                      <td className="py-3 font-medium text-gray-900">{page.page_name}</td>
                      <td className="py-3 text-gray-500 text-xs">{page.page_id}</td>
                      <td className="py-3">
                        <span className="px-2 py-0.5 bg-green-50 text-green-600 rounded-full text-xs font-medium">
                          Connected
                        </span>
                      </td>
                      <td className="py-3">
                        <span className={`text-xs ${page.access_token ? 'text-green-600' : 'text-red-500'}`}>
                          {page.access_token ? 'Set' : 'Missing'}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => handleUpdateToken(page.page_id, page.page_name)}
                          className="text-blue-600 hover:text-blue-700 text-sm font-medium mr-3"
                        >
                          Token
                        </button>
                        <button
                          onClick={() => handleRemovePage(page.page_id)}
                          className="text-red-600 hover:text-red-700 text-sm font-medium"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                  {pages.filter((p) => p.is_connected).length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-gray-400">
                        No pages connected
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'Logs' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-gray-900">System Events</h3>
              <button onClick={fetchLogs} className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                ↻ Refresh
              </button>
            </div>
            <div className="bg-gray-900 text-gray-100 rounded-lg p-4 font-mono text-xs max-h-[500px] overflow-y-auto space-y-1">
              {logsLoading && logs.length === 0 && <div className="text-gray-500">Loading...</div>}
              {!logsLoading && logs.length === 0 && <div className="text-gray-500">No events yet</div>}
              {logs.map((log) => (
                <div key={log.id} className={`${log.level === 'error' ? 'text-red-400' : log.level === 'warning' ? 'text-yellow-400' : 'text-gray-300'}`}>
                  <span className="text-gray-500">{new Date(log.created_at).toLocaleTimeString()}</span>
                  {' '}[{log.level}]
                  {' '}<span className="font-semibold">{log.source}</span>
                  {' '}{log.message}
                  {log.details && <span className="text-gray-500"> — {log.details}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'Page Monitoring' && (
          <div className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-700">
              Only pages with monitoring enabled will receive SLA tracking, generate alerts, and appear in reports and dashboard statistics. New pages have monitoring disabled by default.
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-3 font-medium text-gray-500">Page Name</th>
                    <th className="text-left py-3 px-3 font-medium text-gray-500">Page ID</th>
                    <th className="text-left py-3 px-3 font-medium text-gray-500">Connection</th>
                    <th className="text-left py-3 px-3 font-medium text-gray-500">Monitoring</th>
                    <th className="text-left py-3 px-3 font-medium text-gray-500">Last Activity</th>
                    <th className="text-right py-3 px-3 font-medium text-gray-500">Controls</th>
                  </tr>
                </thead>
                <tbody>
                  {pages.map((page) => (
                    <tr key={page.page_id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-3 font-medium text-gray-900">{page.page_name}</td>
                      <td className="py-3 px-3 text-gray-500 text-xs">{page.page_id}</td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          page.is_connected
                            ? 'bg-green-50 text-green-600'
                            : 'bg-gray-50 text-gray-500'
                        }`}>
                          {page.is_connected ? 'Connected' : 'Disconnected'}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          page.monitoring_enabled
                            ? 'bg-green-50 text-green-600'
                            : 'bg-gray-50 text-gray-500'
                        }`}>
                          {page.monitoring_enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-500 text-xs">
                        {formatLastActivity(page.last_webhook_activity)}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {page.monitoring_enabled ? (
                            <button
                              onClick={() => handleToggleMonitoring(page.page_id, false)}
                              className="px-3 py-1.5 text-xs font-medium text-yellow-600 bg-yellow-50 border border-yellow-200 rounded-lg hover:bg-yellow-100"
                            >
                              Disable
                            </button>
                          ) : (
                            <button
                              onClick={() => handleToggleMonitoring(page.page_id, true)}
                              className="px-3 py-1.5 text-xs font-medium text-green-600 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100"
                            >
                              Enable
                            </button>
                          )}
                          <button
                            onClick={() => handleRemovePage(page.page_id)}
                            className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100"
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {pages.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-gray-400">
                        No pages connected. Add pages in the Facebook Pages tab first.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-6 pt-6 border-t border-gray-200">
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  )
}
