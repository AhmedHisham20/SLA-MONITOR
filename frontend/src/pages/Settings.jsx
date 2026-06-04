import { useState, useEffect } from 'react'
import { settings as settingsApi, whatsapp } from '../services/api'
import toast from 'react-hot-toast'

const tabs = ['General', 'SLA', 'WhatsApp', 'Facebook Pages', 'Page Monitoring']

export default function Settings() {
  const [activeTab, setActiveTab] = useState('General')
  const [form, setForm] = useState({})
  const [pages, setPages] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

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
      const to = form.whatsapp_recipient_number || form.whatsapp_phone_number_id
      const res = await whatsapp.test(to)
      toast.success(res.success ? 'Test message sent!' : 'Test failed')
    } catch {
      toast.error('Test failed')
    }
  }

  const handleAddPage = async () => {
    const pageId = prompt('Enter Facebook Page ID:')
    const pageName = prompt('Enter Page Name:')
    if (pageId && pageName) {
      try {
        await settingsApi.addPage(pageId, pageName)
        const p = await settingsApi.pages()
        setPages(Array.isArray(p) ? p : [])
        toast.success('Page added')
      } catch {
        toast.error('Failed to add page')
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
              <input
                type="password"
                className="input"
                value={form.whatsapp_access_token || ''}
                onChange={(e) => setForm((f) => ({ ...f, whatsapp_access_token: e.target.value }))}
              />
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
            <button onClick={handleAddPage} className="btn-primary">
              + Connect Page
            </button>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 font-medium text-gray-500">Page Name</th>
                    <th className="text-left py-3 font-medium text-gray-500">Page ID</th>
                    <th className="text-left py-3 font-medium text-gray-500">Status</th>
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
                      <td className="py-3 text-right">
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
                      <td colSpan={4} className="py-6 text-center text-gray-400">
                        No pages connected
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
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
                          {page.is_connected && (
                            <button
                              onClick={() => handleRemovePage(page.page_id)}
                              className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100"
                            >
                              Remove
                            </button>
                          )}
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
