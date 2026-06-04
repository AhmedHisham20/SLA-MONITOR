import { createContext, useContext, useState, useEffect } from 'react'
import { auth, checkDemoMode, isDemoMode } from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [demoMode, setDemoMode] = useState(false)

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
        setLoading(false)
        return
      }

      const token = localStorage.getItem('token')
      if (token) {
        try {
          const me = await auth.me()
          setUser(me)
        } catch {
          localStorage.removeItem('token')
        }
      }
      setLoading(false)
    }
    init()
  }, [])

  const login = async (email, password) => {
    const res = await auth.login({ email, password })
    localStorage.setItem('token', res.access_token)
    const me = await auth.me()
    setUser(me)
    return me
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, demoMode, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
