import { useState, useEffect, useCallback } from 'react'
import { users as usersApi } from '../services/api'
import toast from 'react-hot-toast'
import {
  Plus, Pencil, Lock, Trash2, X, CheckCircle, XCircle,
  Loader, Shield,
} from 'lucide-react'

const ALL_PERMISSION_LABELS = {
  home: 'Home',
  dashboard: 'Dashboard',
  conversations: 'Conversations',
  reports: 'Reports',
  facebook_pages: 'Facebook Pages',
  whatsapp: 'WhatsApp',
  logs: 'Logs',
  backup: 'Backup & Restore',
  settings: 'Settings',
  user_management: 'User Management',
  leads_crm: 'Leads CRM',
}

const ALL_PERMISSIONS = Object.keys(ALL_PERMISSION_LABELS)

const emptyForm = () => ({
  full_name: '',
  email: '',
  password: '',
  permissions: [],
})

export default function UsersPermissions() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [resetPassId, setResetPassId] = useState(null)
  const [resetPassValue, setResetPassValue] = useState('')

  const fetchUsers = useCallback(async () => {
    try {
      const res = await usersApi.list()
      setUsers(Array.isArray(res) ? res : [])
    } catch {
      toast.error('Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm())
    setShowModal(true)
  }

  const openEdit = (u) => {
    setEditingId(u.id)
    setForm({
      full_name: u.full_name,
      email: u.email,
      password: '',
      permissions: [...(u.permissions || [])],
    })
    setShowModal(true)
  }

  const togglePermission = (perm) => {
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(perm)
        ? f.permissions.filter((p) => p !== perm)
        : [...f.permissions, perm],
    }))
  }

  const handleSave = async () => {
    if (!form.full_name || !form.email) {
      toast.error('Name and email are required')
      return
    }
    if (!editingId && !form.password) {
      toast.error('Password is required for new users')
      return
    }
    setSaving(true)
    try {
      if (editingId) {
        const payload = { full_name: form.full_name, email: form.email, permissions: form.permissions }
        await usersApi.update(editingId, payload)
        toast.success('User updated')
      } else {
        await usersApi.create(form)
        toast.success('User created')
      }
      setShowModal(false)
      await fetchUsers()
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || 'Failed to save'
      toast.error(typeof msg === 'string' ? msg : JSON.stringify(msg))
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (u) => {
    try {
      await usersApi.update(u.id, { is_active: !u.is_active, permissions: u.permissions })
      toast.success(`User ${u.is_active ? 'disabled' : 'enabled'}`)
      await fetchUsers()
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || 'Failed'
      toast.error(typeof msg === 'string' ? msg : JSON.stringify(msg))
    }
  }

  const handleDelete = async (u) => {
    if (!window.confirm(`Delete user "${u.full_name}"?`)) return
    try {
      await usersApi.delete(u.id)
      toast.success('User deleted')
      await fetchUsers()
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || 'Failed to delete'
      toast.error(typeof msg === 'string' ? msg : JSON.stringify(msg))
    }
  }

  const handleResetPassword = async () => {
    if (!resetPassValue || resetPassValue.length < 4) {
      toast.error('Password must be at least 4 characters')
      return
    }
    try {
      await usersApi.resetPassword(resetPassId, resetPassValue)
      toast.success('Password reset')
      setResetPassId(null)
      setResetPassValue('')
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || 'Failed'
      toast.error(typeof msg === 'string' ? msg : JSON.stringify(msg))
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-gray-900">Users & Permissions</h2>
        <button onClick={openCreate} className="btn-primary inline-flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add User
        </button>
      </div>

      <div className="overflow-x-auto bg-white rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left py-3 px-4 font-medium text-gray-500">Name</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500">Email</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500">Status</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500">Permissions</th>
              <th className="text-right py-3 px-4 font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    {u.role === 'admin' && <Shield className="w-4 h-4 text-blue-500 shrink-0" />}
                    <span className="font-medium text-gray-900">{u.full_name}</span>
                    {u.role === 'admin' && (
                      <span className="text-xs text-blue-600 font-medium bg-blue-50 px-1.5 py-0.5 rounded">Admin</span>
                    )}
                  </div>
                </td>
                <td className="py-3 px-4 text-gray-500">{u.email}</td>
                <td className="py-3 px-4">
                  {u.is_active ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                      <CheckCircle className="w-3 h-3" />
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                      <XCircle className="w-3 h-3" />
                      Disabled
                    </span>
                  )}
                </td>
                <td className="py-3 px-4">
                  <div className="flex flex-wrap gap-1 max-w-[280px]">
                    {(u.permissions || []).slice(0, 4).map((p) => (
                      <span key={p} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                        {ALL_PERMISSION_LABELS[p] || p}
                      </span>
                    ))}
                    {(u.permissions || []).length > 4 && (
                      <span className="text-xs text-gray-400">+{u.permissions.length - 4}</span>
                    )}
                    {u.role === 'admin' && (
                      <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium">Full Access</span>
                    )}
                  </div>
                </td>
                <td className="py-3 px-4 text-right">
                  {u.role !== 'admin' ? (
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(u)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleToggleActive(u)} className="p-1.5 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors" title={u.is_active ? 'Disable' : 'Enable'}>
                        <XCircle className={`w-4 h-4 ${!u.is_active ? 'text-green-500' : ''}`} />
                      </button>
                      <button onClick={() => { setResetPassId(u.id); setResetPassValue('') }} className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors" title="Reset Password">
                        <Lock className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(u)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-gray-400">No users found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">{editingId ? 'Edit User' : 'Add User'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input className="input" value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input className="input" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {editingId ? 'New Password (leave blank to keep current)' : 'Password'}
                </label>
                <input className="input" type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Permissions</label>
                <div className="grid grid-cols-2 gap-2">
                  {ALL_PERMISSIONS.map((perm) => (
                    <label key={perm} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.permissions.includes(perm)}
                        onChange={() => togglePermission(perm)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      {ALL_PERMISSION_LABELS[perm]}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary inline-flex items-center gap-2">
                {saving && <Loader className="w-4 h-4 animate-spin" />}
                {editingId ? 'Save Changes' : 'Create User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetPassId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setResetPassId(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">Reset Password</h3>
            </div>
            <div className="px-6 py-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
              <input className="input" type="password" value={resetPassValue} onChange={(e) => setResetPassValue(e.target.value)} />
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
              <button onClick={() => setResetPassId(null)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleResetPassword} className="btn-primary">Reset</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
