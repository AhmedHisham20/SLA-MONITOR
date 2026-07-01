import { useState, useRef } from 'react'
import { backup as backupApi } from '../services/api'
import toast from 'react-hot-toast'
import { Download, Upload, Archive, Database, FileText, Loader } from 'lucide-react'

export default function BackupRestore() {
  const [creatingDb, setCreatingDb] = useState(false)
  const [creatingFull, setCreatingFull] = useState(false)
  const [restoring, setRestoring] = useState(false)
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
  }

  const handleRestore = async () => {
    if (!file) {
      toast.error('Select a backup file first.')
      return
    }
    if (!window.confirm('This will overwrite your current database. Are you sure?')) return
    setRestoring(true)
    try {
      await backupApi.restore(file)
      toast.success('Database restored successfully.')
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || 'Restore failed.'
      toast.error(typeof msg === 'string' ? msg : JSON.stringify(msg))
    } finally {
      setRestoring(false)
    }
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
