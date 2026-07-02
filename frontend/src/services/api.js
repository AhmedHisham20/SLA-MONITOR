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

const isLoginRequest = (config) => config?.url?.endsWith('/auth/login')

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (_demoMode) return Promise.reject(error)
    if (!isLoginRequest(error.config) && error.response?.status === 401) {
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
  statusCounts: (params) => api.get('/conversations/stats/status-counts', { params }).then((r) => r.data),
  review: (id) => api.patch(`/conversations/${id}/review`).then((r) => r.data),
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
  addPage: (pageId, pageName, accessToken = '') =>
    api.post('/settings/pages', null, { params: { page_id: pageId, page_name: pageName, access_token: accessToken } }).then((r) => r.data),
  addPageFromToken: (accessToken) =>
    api.post('/settings/pages/from-token', null, { params: { access_token: accessToken } }).then((r) => r.data),
  updateToken: (pageId, accessToken) =>
    api.put(`/settings/pages/${pageId}/token`, null, { params: { access_token: accessToken } }).then((r) => r.data),
  removePage: (pageId) => api.delete(`/settings/pages/${pageId}`).then((r) => r.data),
  toggleMonitoring: (pageId, enabled) =>
    api.post(`/settings/pages/${pageId}/monitoring`, null, { params: { enabled } }).then((r) => r.data),
}

export const whatsapp = {
  test: (to) => api.post('/whatsapp/test', null, { params: { to } }).then((r) => r.data),
  update: (data) => api.post('/whatsapp/settings', data).then((r) => r.data),
}

export const users = {
  list: () => api.get('/users').then((r) => r.data),
  get: (id) => api.get(`/users/${id}`).then((r) => r.data),
  create: (data) => api.post('/users', data).then((r) => r.data),
  update: (id, data) => api.put(`/users/${id}`, data).then((r) => r.data),
  delete: (id) => api.delete(`/users/${id}`).then((r) => r.data),
  resetPassword: (id, newPassword) =>
    api.post(`/users/${id}/reset-password`, { new_password: newPassword }).then((r) => r.data),
  myPermissions: () => api.get('/users/me/permissions').then((r) => r.data),
}

export const logs = {
  get: (limit = 100, source = null, level = null) =>
    api.get('/logs', { params: { limit, source, level } }).then((r) => r.data),
}

export const backup = {
  database: () =>
    api.post('/backup/database', null, { responseType: 'blob' }).then((r) => r.data),
  full: () =>
    api.post('/backup/full', null, { responseType: 'blob' }).then((r) => r.data),
  restore: (file) => {
    const form = new FormData()
    form.append('file', file)
    return api.post('/backup/restore', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data)
  },
  info: () => api.get('/backup/info').then((r) => r.data),
}

export default api
