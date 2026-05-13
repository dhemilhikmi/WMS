import axios from 'axios';

const runtimeApiUrl = typeof window !== 'undefined'
  ? `${window.location.protocol}//${window.location.hostname}:5000`
  : 'http://localhost:5000';
const envApiUrl = import.meta.env.VITE_API_URL;
const isLanAccess = typeof window !== 'undefined' && !['localhost', '127.0.0.1'].includes(window.location.hostname);
const API_URL = isLanAccess && envApiUrl?.includes('localhost') ? runtimeApiUrl : (envApiUrl || runtimeApiUrl);

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

// Auto-logout on 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const responseData = error.response?.data;
    if (
      error.response?.status === 403 &&
      (responseData?.upgradeRequired || responseData?.quotaExceeded) &&
      typeof window !== 'undefined'
    ) {
      window.dispatchEvent(new CustomEvent('wms:upgrade-required', {
        detail: {
          message: responseData.message,
          quotaExceeded: responseData.quotaExceeded,
          upgradeRequired: responseData.upgradeRequired,
        },
      }));
    }

    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('tenant');
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (data: {
    tenantName: string;
    tenantEmail?: string;
    email: string;
    name: string;
    password: string;
    planId?: string;
  }) => api.post('/api/auth/register', data),

  login: (data: { email: string; password: string }) =>
    api.post('/api/auth/login', data),

  verifyEmail: (token: string) =>
    api.get('/api/auth/verify-email', { params: { token } }),

  resendVerification: (email: string) =>
    api.post('/api/auth/resend-verification', { email }),

  forgotPassword: (email: string) =>
    api.post('/api/auth/forgot-password', { email }),

  resetPassword: (data: { token: string; password: string }) =>
    api.post('/api/auth/reset-password', data),
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
    price?: string;
    duration?: number;
    type?: string;
    notes?: string;
    tenantId: string;
  }) => api.post('/api/workshops', data),

  update: (id: string, data: any) => api.put(`/api/workshops/${id}`, data),

  delete: (id: string, tenantId: string) =>
    api.delete(`/api/workshops/${id}`, { params: { tenantId } }),

  // Sub-services
  createSubService: (parentId: string, data: {
    title: string;
    description?: string;
    startDate: string;
    endDate: string;
    location?: string;
    maxCapacity?: number;
    price?: string;
    duration?: number;
    notes?: string;
    tenantId: string;
  }) => api.post(`/api/workshops/${parentId}/sub-services`, data),

  getSubServices: (parentId: string, tenantId: string) =>
    api.get(`/api/workshops/${parentId}/sub-services`, { params: { tenantId } }),
};

// Customers API
export const customersAPI = {
  list: (tenantId: string) =>
    api.get('/api/customers', { params: { tenantId } }),

  getByPhone: (phone: string, tenantId: string) =>
    api.get(`/api/customers/phone/${phone}`, {
      params: { tenantId },
      validateStatus: (status) => status < 500 // Treat 404 as success
    }),

  create: (data: {
    name: string;
    address?: string;
    phone: string;
    satuan?: string;
    tenantId: string;
  }) => api.post('/api/customers', data),

  update: (id: string, data: { name?: string; address?: string; phone?: string }) =>
    api.put(`/api/customers/${id}`, data),
};

// Registrations API
export const registrationsAPI = {
  list: (tenantId: string, workshopId?: string) =>
    api.get('/api/registrations', {
      params: { tenantId, ...(workshopId && { workshopId }) },
    }),

  get: (id: string, tenantId: string) =>
    api.get(`/api/registrations/${id}`, { params: { tenantId } }),

  create: (data: { customerId: string; workshopId: string; tenantId: string; scheduledDate?: string; vehicleType?: string; vehicleBrand?: string; vehicleName?: string; licensePlate?: string; notes?: string }) =>
    api.post('/api/registrations', data),

  update: (id: string, data: { tenantId: string; workshopId?: string; scheduledDate?: string; status?: string; notes?: string; vehicleType?: string; vehicleBrand?: string; vehicleName?: string; licensePlate?: string; paymentStatus?: string }) =>
    api.put(`/api/registrations/${id}`, data),

  delete: (id: string, tenantId: string) =>
    api.delete(`/api/registrations/${id}`, { params: { tenantId } }),
};

// Users API
export const usersAPI = {
  list: (tenantId: string) =>
    api.get('/api/users', { params: { tenantId } }),

  create: (data: {
    name: string;
    email: string;
    password: string;
    role: string;
    tenantId: string;
  }) => api.post('/api/users', data),

  update: (id: string, data: { tenantId: string; name?: string; role?: string }) =>
    api.put(`/api/users/${id}`, data),

  delete: (id: string, tenantId: string) =>
    api.delete(`/api/users/${id}`, { params: { tenantId } }),
};

// Features API
export const featuresAPI = {
  listAll: () =>
    api.get('/api/features'),

  listForTenant: (tenantId: string) =>
    api.get('/api/tenant-features', { params: { tenantId } }),

  enable: (data: { tenantId: string; featureId: string }) =>
    api.post('/api/tenant-features', data),

  disable: (featureId: string, tenantId: string) =>
    api.delete(`/api/tenant-features/${featureId}`, { params: { tenantId } }),
};

// Superadmin API
export const superadminAPI = {
  getTenants: () =>
    api.get('/api/superadmin/tenants'),

  createTenant: (data: {
    name: string;
    email: string;
    phone?: string;
    address?: string;
    planId?: string;
  }) => api.post('/api/superadmin/tenants', data),

  updateTenant: (id: string, data: { name?: string; phone?: string; address?: string }) =>
    api.put(`/api/superadmin/tenants/${id}`, data),

  updateTenantPlan: (id: string, data: {
    plan: 'free' | 'pro';
    planExpiry: string | null;
    partnerType: 'standard' | 'ppf_partner' | null;
  }) => api.put(`/api/superadmin/tenants/${id}/plan`, data),

  deleteTenant: (id: string) =>
    api.delete(`/api/superadmin/tenants/${id}`),

  getPlans: () =>
    api.get('/api/superadmin/plans'),

  createPlan: (data: {
    name: string;
    description?: string;
    price: number;
    maxUsers: number;
    maxServices: number;
  }) => api.post('/api/superadmin/plans', data),

  updatePlan: (id: string, data: any) =>
    api.put(`/api/superadmin/plans/${id}`, data),

  deletePlan: (id: string) =>
    api.delete(`/api/superadmin/plans/${id}`),

  assignSubscription: (data: { tenantId: string; planId: string; status?: string }) =>
    api.post('/api/superadmin/subscriptions', data),

  updateSubscription: (tenantId: string, data: { status?: string; endDate?: string; notes?: string }) =>
    api.put(`/api/superadmin/subscriptions/${tenantId}`, data),

  getAnalytics: () =>
    api.get('/api/superadmin/analytics'),

  getSystemStatus: () =>
    api.get('/api/superadmin/system-status'),
};

// Settings API
export const settingsAPI = {
  get: () =>
    api.get('/api/settings'),

  update: (data: Record<string, string>) =>
    api.put('/api/settings', data),

  testEmail: (email: string) =>
    api.post('/api/settings/test-email', { email }),
};

// Orders API
export const ordersAPI = {
  create: (data: {
    tenantId: string;
    tenantName: string;
    tenantEmail: string;
    planId: string;
    adminName: string;
    adminEmail: string;
  }) => api.post('/api/orders/create', data),
};

// Inventory API
export const inventoryAPI = {
  list: () => api.get('/api/inventory'),
  create: (data: { kode: string; nama: string; kategori: string; satuan: string; stok: number; stokMin: number; hargaSatuan: number; pemasok?: string; notes?: string; satuanPakai?: string | null; isiPerUnit?: number | null }) =>
    api.post('/api/inventory', data),
  update: (id: string, data: Partial<{ kode: string; nama: string; kategori: string; satuan: string; stok: number; stokMin: number; hargaSatuan: number; pemasok: string; notes: string; satuanPakai: string | null; isiPerUnit: number | null }>) =>
    api.put(`/api/inventory/${id}`, data),
  mutasi: (id: string, type: 'masuk' | 'keluar', jumlah: number, keterangan?: string) =>
    api.post(`/api/inventory/${id}/mutasi`, { type, jumlah, keterangan }),
  log: (id: string) => api.get(`/api/inventory/${id}/log`),
  delete: (id: string) => api.delete(`/api/inventory/${id}`),
};

// Suppliers API
export const suppliersAPI = {
  list: () => api.get('/api/suppliers'),
  create: (data: { nama: string; kontak?: string; phone?: string; email?: string; alamat?: string; kategori?: string; status?: string }) =>
    api.post('/api/suppliers', data),
  update: (id: string, data: Partial<{ nama: string; kontak: string; phone: string; email: string; alamat: string; kategori: string; status: string }>) =>
    api.put(`/api/suppliers/${id}`, data),
  delete: (id: string) => api.delete(`/api/suppliers/${id}`),
};

// Purchase Orders API
export const purchaseOrdersAPI = {
  list: () => api.get('/api/purchase-orders'),
  create: (data: { supplierName?: string; orderDate: string; totalAmount: number; notes?: string; items?: any[]; status?: string }) =>
    api.post('/api/purchase-orders', data),
  update: (id: string, data: Partial<{ supplierName: string; orderDate: string; totalAmount: number; notes: string; items: any[]; status: string }>) =>
    api.put(`/api/purchase-orders/${id}`, data),
  delete: (id: string) => api.delete(`/api/purchase-orders/${id}`),
  receive: (id: string) => api.post(`/api/purchase-orders/receive/${id}`, {}),
};

// Expenses API
export const expensesAPI = {
  list: () => api.get('/api/expenses'),
  create: (data: { tanggal: string; kategori: string; keterangan: string; pemasok?: string; refPO?: string; jumlah: number; dicatat?: string }) =>
    api.post('/api/expenses', data),
  update: (id: string, data: Partial<{ tanggal: string; kategori: string; keterangan: string; pemasok: string; refPO: string; jumlah: number; dicatat: string }>) =>
    api.put(`/api/expenses/${id}`, data),
  delete: (id: string) => api.delete(`/api/expenses/${id}`),
};

// Service Materials (BOM) API
export const serviceMaterialsAPI = {
  list: (workshopId?: string) =>
    api.get('/api/service-materials', { params: workshopId ? { workshopId } : {} }),
  upsert: (data: { workshopId: string; inventoryId: string; qty: number; mode?: 'add' | 'replace' | 'set' }) =>
    api.post('/api/service-materials', data),
  delete: (id: string) =>
    api.delete(`/api/service-materials/${id}`),
  calculate: (registrationId: string) =>
    api.post(`/api/service-materials/calculate/${registrationId}`),
  availability: (registrationId: string) =>
    api.get(`/api/service-materials/availability/${registrationId}`),
  upcomingShortages: () =>
    api.get('/api/service-materials/shortages/upcoming'),
  hppReal: (workshopId: string) =>
    api.get(`/api/service-materials/hpp-real/${workshopId}`),
};

export const tenantSettingsAPI = {
  get: (key: string) => api.get(`/api/tenant-settings/${key}`),
  set: (key: string, value: object) => api.put(`/api/tenant-settings/${key}`, value),
};

// Teknisi API
export const teknisiAPI = {
  list: (status?: string) => api.get('/api/teknisi', { params: status ? { status } : {} }),
  create: (data: { name: string; phone?: string; spesialis?: string[]; status?: string }) =>
    api.post('/api/teknisi', data),
  update: (id: string, data: Partial<{ name: string; phone: string; spesialis: string[]; status: string }>) =>
    api.put(`/api/teknisi/${id}`, data),
  delete: (id: string) => api.delete(`/api/teknisi/${id}`),
};

// Warranties API
export const warrantiesAPI = {
  list: (status?: string) => api.get('/api/warranties', { params: status ? { status } : {} }),
  get: (id: string) => api.get(`/api/warranties/${id}`),
  void: (id: string) => api.put(`/api/warranties/${id}/void`),
  syncDuration: (id: string) => api.put(`/api/warranties/${id}/sync-duration`),
};

export default api;
