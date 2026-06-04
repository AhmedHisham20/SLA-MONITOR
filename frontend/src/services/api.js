import axios from 'axios'

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

let _demoMode = null

export async function checkDemoMode() {
  try {
    const res = await api.get('/demo/status')
    _demoMode = res.data.demo_mode
    return _demoMode
  } catch {
    _demoMode = false
    return false
  }
}

export function isDemoMode() {
  return _demoMode === true
}

api.interceptors.request.use((config) => {
  if (config.url === '/demo/status') return config
  if (_demoMode) return config
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (_demoMode) return Promise.reject(error)
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export const auth = {
  login: (data) => api.post('/auth/login', data).then((r) => r.data),
  register: (data) => api.post('/auth/register', data).then((r) => r.data),
  me: () => api.get('/auth/me').then((r) => r.data),
}

export const dashboard = {
  stats: (params) => api.get('/dashboard/stats', { params }).then((r) => r.data),
}

export const conversations = {
  list: (params) => api.get('/conversations', { params }).then((r) => r.data),
  get: (id) => api.get(`/conversations/${id}`).then((r) => r.data),
  pageStats: () => api.get('/conversations/stats/pages').then((r) => r.data),
}

export const reports = {
  get: (params) => api.get('/reports', { params }).then((r) => r.data),
  moderators: (params) => api.get('/reports/moderators', { params }).then((r) => r.data),
  exportCsv: (params) =>
    api.get('/reports/export/csv', { params, responseType: 'blob' }).then((r) => r.data),
}

export const settings = {
  get: () => api.get('/settings').then((r) => r.data),
  update: (data) => api.put('/settings', data).then((r) => r.data),
  pages: () => api.get('/settings/pages').then((r) => r.data),
  addPage: (pageId, pageName) =>
    api.post('/settings/pages', null, { params: { page_id: pageId, page_name: pageName } }).then((r) => r.data),
  removePage: (pageId) => api.delete(`/settings/pages/${pageId}`).then((r) => r.data),
  toggleMonitoring: (pageId, enabled) =>
    api.post(`/settings/pages/${pageId}/monitoring`, null, { params: { enabled } }).then((r) => r.data),
}

export const whatsapp = {
  test: (to) => api.post('/whatsapp/test', null, { params: { to } }).then((r) => r.data),
  update: (data) => api.post('/whatsapp/settings', data).then((r) => r.data),
}

export default api
