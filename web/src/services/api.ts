import axios from 'axios';

const API_URL = import.meta.env.REACT_APP_API_URL || 'http://localhost:4100';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth API
export const authAPI = {
  register: (data: {
    tenantName: string;
    tenantEmail: string;
    email: string;
    name: string;
    password: string;
  }) => api.post('/api/auth/register', data),

  login: (data: { email: string; password: string }) =>
    api.post('/api/auth/login', data),
};

// Workshops API
export const workshopsAPI = {
  list: (tenantId: string) =>
    api.get('/api/workshops', { params: { tenantId } }),

  get: (id: string, tenantId: string) =>
    api.get(`/api/workshops/${id}`, { params: { tenantId } }),

  create: (data: {
    title: string;
    description?: string;
    startDate: string;
    endDate: string;
    location?: string;
    maxCapacity?: number;
    tenantId: string;
  }) => api.post('/api/workshops', data),

  update: (id: string, data: any) => api.put(`/api/workshops/${id}`, data),

  delete: (id: string, tenantId: string) =>
    api.delete(`/api/workshops/${id}`, { params: { tenantId } }),
};

// Registrations API
export const registrationsAPI = {
  list: (tenantId: string, workshopId?: string) =>
    api.get('/api/registrations', {
      params: { tenantId, ...(workshopId && { workshopId }) },
    }),

  get: (id: string, tenantId: string) =>
    api.get(`/api/registrations/${id}`, { params: { tenantId } }),

  create: (data: { userId: string; workshopId: string; tenantId: string }) =>
    api.post('/api/registrations', data),

  delete: (id: string, tenantId: string) =>
    api.delete(`/api/registrations/${id}`, { params: { tenantId } }),
};

export default api;
