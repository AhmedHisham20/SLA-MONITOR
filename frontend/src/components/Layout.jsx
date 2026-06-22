import { useState } from 'react'
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
} from 'lucide-react'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/conversations', icon: MessageSquare, label: 'Conversations' },
  { to: '/reports', icon: BarChart3, label: 'Reports' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user, logout, demoMode } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform lg:translate-x-0 lg:static lg:inset-auto ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between h-16 px-6 bg-gradient-to-r from-primary-600 to-primary-700">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-white">SLA Monitor</h1>
            {demoMode && (
              <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-yellow-200 text-yellow-800 rounded-full">
                <FlaskConical className="w-3 h-3" />
                DEMO
              </span>
            )}
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-white/80 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="p-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-primary-50 text-primary-700 shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`
              }
            >
              <item.icon className={`w-5 h-5 ${isActive ? 'text-primary-500' : ''}`} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 bg-gray-50/50">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-700 rounded-full flex items-center justify-center text-white text-sm font-medium shadow-sm">
              {user?.full_name?.[0] || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{user?.full_name}</p>
              <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
            </div>
          </div>
          {!demoMode && (
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          )}
          {demoMode && (
            <p className="text-xs text-center text-yellow-600">Demo session — no auth</p>
          )}
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden">
              <Menu className="w-6 h-6 text-gray-600" />
            </button>
            {demoMode && (
              <span className="hidden sm:flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-full">
                <FlaskConical className="w-3.5 h-3.5" />
                Demo Mode — Authentication Bypassed
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 ml-auto">
            <button className="relative p-2 text-gray-400 hover:text-gray-600">
              <Bell className="w-5 h-5" />
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
