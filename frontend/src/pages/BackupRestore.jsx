import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { backup as backupApi } from '../services/api'
import toast from 'react-hot-toast'
import { Download, Upload, Archive, Database, FileText, Loader, CheckCircle, XCircle } from 'lucide-react'

export default function BackupRestore() {
  const navigate = useNavigate()
  const [creatingDb, setCreatingDb] = useState(false)
  const [creatingFull, setCreatingFull] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [restoreResult, setRestoreResult] = useState(null)
  const [restoreError, setRestoreError] = useState(null)
  const [file, setFile] = useState(null)
  const fileInputRef = useRef(null)

  const handleDbBackup = async () => {
    setCreatingDb(true)
    try {
      const blob = await backupApi.database()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `backup-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')}.sql.gz`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      toast.success('Database backup downloaded.')
    } catch {
      toast.error('Database backup failed.')
    } finally {
      setCreatingDb(false)
    }
  }

  const handleFullBackup = async () => {
    setCreatingFull(true)
    try {
      const blob = await backupApi.full()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `full-backup-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      toast.success('Full system backup downloaded.')
    } catch {
      toast.error('Full backup failed.')
    } finally {
      setCreatingFull(false)
    }
  }

  const handleFileChange = (e) => {
    const f = e.target.files[0]
    if (f) setFile(f)
    setRestoreResult(null)
    setRestoreError(null)
  }

  const handleRestore = async () => {
    if (!file) {
      toast.error('Select a backup file first.')
      return
    }
    if (!window.confirm('This will overwrite your current database. Are you sure?')) return
    setRestoring(true)
    setRestoreResult(null)
    setRestoreError(null)
    try {
      const res = await backupApi.restore(file)
      setRestoreResult(res)
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || 'Restore failed.'
      setRestoreError(typeof msg === 'string' ? msg : JSON.stringify(msg))
    } finally {
      setRestoring(false)
    }
  }

  if (restoreResult) {
    const v = restoreResult.verification || {}
    return (
      <div className="space-y-6">
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-green-800 mb-2">Restore completed successfully</h2>
          <p className="text-green-700">Database restored successfully.</p>
          <p className="text-green-700">Scheduler restarted.</p>
          <p className="text-green-700">Cache refreshed.</p>
          <p className="text-green-700 mt-2 font-medium">System is ready to use.</p>
          <p className="text-green-600 text-sm mt-2">Please refresh the page.</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
          >
            <Download className="w-4 h-4 rotate-90" />
            Refresh Dashboard
          </button>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 text-sm">
          <h3 className="font-medium text-gray-900 mb-3">Verification Results</h3>
          <div className="space-y-2">
            {[
              { label: 'Database reachable', ok: v.database },
              { label: 'Tables exist', ok: v.tables },
              { label: 'Scheduler running', ok: v.scheduler },
              { label: 'Redis connected', ok: v.redis },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                {item.ok ? (
                  <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-gray-300 shrink-0" />
                )}
                <span className={item.ok ? 'text-gray-700' : 'text-gray-400'}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (restoreError) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <XCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-red-800 mb-2">Restore failed</h2>
          <p className="text-red-700 text-sm font-mono bg-red-100 rounded p-3 mt-3 text-left whitespace-pre-wrap">{restoreError}</p>
        </div>
        <button
          onClick={() => { setRestoreError(null); setRestoreResult(null) }}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          Back to backup & restore
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={handleDbBackup}
          disabled={creatingDb}
          className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors text-left disabled:opacity-50"
        >
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
            <Database className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-gray-900 text-sm">Database Backup</div>
            <div className="text-xs text-gray-500 mt-0.5">Export PostgreSQL (.sql.gz)</div>
          </div>
          {creatingDb ? <Loader className="w-5 h-5 text-blue-600 animate-spin shrink-0" /> : <Download className="w-5 h-5 text-gray-400 shrink-0" />}
        </button>

        <button
          onClick={handleFullBackup}
          disabled={creatingFull}
          className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors text-left disabled:opacity-50"
        >
          <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
            <Archive className="w-5 h-5 text-purple-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-gray-900 text-sm">Full System Backup</div>
            <div className="text-xs text-gray-500 mt-0.5">Database + Config + Uploads (.zip)</div>
          </div>
          {creatingFull ? <Loader className="w-5 h-5 text-purple-600 animate-spin shrink-0" /> : <Download className="w-5 h-5 text-gray-400 shrink-0" />}
        </button>
      </div>

      <div className="border-t border-gray-200 pt-6">
        <h3 className="font-medium text-gray-900 mb-3">Restore</h3>
        <p className="text-sm text-gray-500 mb-4">Upload a .zip, .sql, or .sql.gz backup file to restore the database.</p>
        <div className="flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 cursor-pointer text-sm text-gray-600">
            <FileText className="w-4 h-4" />
            {file ? file.name : 'Choose file'}
            <input ref={fileInputRef} type="file" accept=".zip,.sql,.sql.gz" onChange={handleFileChange} className="hidden" />
          </label>
          <button
            onClick={handleRestore}
            disabled={!file || restoring}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {restoring ? <Loader className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {restoring ? 'Restoring...' : 'Restore'}
          </button>
        </div>
      </div>
    </div>
  )
}
