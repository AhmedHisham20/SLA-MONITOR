import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { auth, users as usersApi, checkDemoMode } from '../services/api'

const ALL_PERMISSIONS = [
  'home', 'dashboard', 'conversations', 'reports',
  'facebook_pages', 'whatsapp', 'logs', 'backup',
  'settings', 'user_management', 'leads_crm',
]

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [permissions, setPermissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [demoMode, setDemoMode] = useState(false)

  const loadPermissions = useCallback(async () => {
    try {
      const res = await usersApi.myPermissions()
      setPermissions(res.permissions || [])
    } catch {
      setPermissions([])
    }
  }, [])

  useEffect(() => {
    const init = async () => {
      const demo = await checkDemoMode()
      setDemoMode(demo)

      if (demo) {
        setUser({
          id: 'demo',
          email: 'demo@slamonitor.local',
          full_name: 'Demo Admin',
          role: 'admin',
        })
        setPermissions(ALL_PERMISSIONS)
        setLoading(false)
        return
      }

      const token = localStorage.getItem('token')
      if (token) {
        try {
          const me = await auth.me()
          setUser(me)
          if (me.role === 'admin') {
            setPermissions(ALL_PERMISSIONS)
          } else {
            await loadPermissions()
          }
        } catch {
          localStorage.removeItem('token')
        }
      }
      setLoading(false)
    }
    init()
  }, [loadPermissions])

  const login = async (email, password) => {
    const res = await auth.login({ email, password })
    localStorage.setItem('token', res.access_token)
    const me = await auth.me()
    setUser(me)
    if (me.role === 'admin') {
      setPermissions(ALL_PERMISSIONS)
    } else {
      await loadPermissions()
    }
    return me
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
    setPermissions([])
  }

  const hasPermission = (perm) => permissions.includes(perm) || user?.role === 'admin'

  return (
    <AuthContext.Provider value={{ user, loading, demoMode, login, logout, permissions, hasPermission }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

export { ALL_PERMISSIONS }
