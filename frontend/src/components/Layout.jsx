import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  LayoutDashboard,
  MessageSquare,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  FlaskConical,
  Monitor,
  ChevronRight,
} from 'lucide-react'

const navItems = [
  { to: '/', icon: Monitor, label: 'Home', end: true },
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', end: false },
  { to: '/conversations', icon: MessageSquare, label: 'Conversations' },
  { to: '/reports', icon: BarChart3, label: 'Reports' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

function useMediaQuery(query) {
  const [matches, setMatches] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(query)
    setMatches(mq.matches)
    const handler = (e) => setMatches(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [query])
  return matches
}

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed')
    if (saved !== null) return saved === 'true'
    return false
  })
  const isTablet = useMediaQuery('(min-width: 768px) and (max-width: 1023px)')
  const { user, logout, demoMode } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (isTablet) {
      const saved = localStorage.getItem('sidebar-collapsed')
      if (saved === null) {
        setCollapsed(true)
      }
    }
  }, [isTablet])

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev
      localStorage.setItem('sidebar-collapsed', String(next))
      return next
    })
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 bg-white border-r border-gray-200 flex flex-col
        transition-all duration-300 ease-in-out
        lg:translate-x-0 lg:static lg:inset-auto
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        ${collapsed ? 'w-[72px]' : 'w-64'}
      `}>
        {/* Logo */}
        <div className={`flex items-center h-16 border-b border-gray-200 flex-shrink-0 ${
          collapsed ? 'justify-center' : 'px-6 justify-between'
        }`}>
          {collapsed ? (
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center shadow-sm flex-shrink-0">
              <span className="text-white font-bold text-sm">S</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center shadow-sm flex-shrink-0">
                <span className="text-white font-bold text-sm">S</span>
              </div>
              <h1 className="text-lg font-bold text-gray-900 truncate transition-opacity duration-200">SLA Monitor</h1>
              {demoMode && (
                <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-700 rounded-full flex-shrink-0">
                  <FlaskConical className="w-3 h-3" />
                  DEMO
                </span>
              )}
            </div>
          )}
          <button onClick={() => setMobileOpen(false)} className="lg:hidden p-1 text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `group relative flex items-center rounded-lg text-sm font-medium transition-all duration-200 ${
                  collapsed ? 'justify-center p-2.5 mx-auto w-11 h-11' : 'gap-3 px-3 py-2.5'
                } ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 shadow-sm'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              <item.icon className={`w-5 h-5 flex-shrink-0 transition-transform duration-200 ${
                collapsed ? '' : ''
              }`} />
              {!collapsed && (
                <span className="truncate transition-opacity duration-200">{item.label}</span>
              )}
              {/* Tooltip when collapsed */}
              {collapsed && (
                <div className="absolute left-full ml-2.5 top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-md opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity duration-150 z-50 shadow-lg">
                  {item.label}
                </div>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User area */}
        <div className={`border-t border-gray-200 flex-shrink-0 ${
          collapsed ? 'p-2' : 'p-4'
        }`}>
          {collapsed ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-blue-700 rounded-full flex items-center justify-center text-white text-sm font-medium shadow-sm flex-shrink-0">
                {user?.full_name?.[0] || 'U'}
              </div>
              {!demoMode && (
                <button
                  onClick={handleLogout}
                  className="group relative text-gray-400 hover:text-red-500 rounded-lg p-1.5 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <div className="absolute left-full ml-2.5 top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-md opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity duration-150 z-50 shadow-lg">
                    Logout
                  </div>
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-blue-700 rounded-full flex items-center justify-center text-white text-sm font-medium shadow-sm flex-shrink-0">
                  {user?.full_name?.[0] || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate transition-opacity duration-200">{user?.full_name}</p>
                  <p className="text-xs text-gray-500 capitalize truncate transition-opacity duration-200">{user?.role}</p>
                </div>
              </div>
              {!demoMode && (
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="transition-opacity duration-200">Logout</span>
                </button>
              )}
              {demoMode && (
                <p className="text-xs text-center text-yellow-600 transition-opacity duration-200">Demo session — no auth</p>
              )}
            </>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-2 lg:gap-3">
            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            {/* Desktop collapse toggle */}
            <button
              onClick={toggleCollapse}
              className="hidden lg:flex items-center justify-center w-8 h-8 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all duration-200 group relative"
            >
              {collapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <Menu className="w-4 h-4" />
              )}
              <span className="absolute left-full ml-2.5 top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-md opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity duration-150 z-50 shadow-lg">
                {collapsed ? 'Expand' : 'Collapse'}
              </span>
            </button>
            {demoMode && (
              <span className="hidden sm:flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-full">
                <FlaskConical className="w-3.5 h-3.5" />
                Demo Mode — Authentication Bypassed
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 ml-auto">
            <button className="relative p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              <Bell className="w-5 h-5" />
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
