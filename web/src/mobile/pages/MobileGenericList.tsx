import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  customersAPI,
  expensesAPI,
  purchaseOrdersAPI,
  registrationsAPI,
  suppliersAPI,
  teknisiAPI,
  warrantiesAPI,
  workshopsAPI,
} from '../../services/api'
import { MobileSubHeader } from '../MobileLayout'

const cleanNumber = (v: string) => v.replace(/[^\d]/g, '')
const fmtNumberInput = (v: string | number) => {
  const n = Math.round(Number(cleanNumber(String(v || ''))))
  return n > 0 ? n.toLocaleString('id-ID', { maximumFractionDigits: 0 }) : ''
}

const fmtRp = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID')
const fmtDate = (s?: string) =>
  s ? new Date(s).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'
type DurationUnit = 'menit' | 'jam' | 'hari'
type WarrantyUnit = 'hari' | 'bulan' | 'tahun'

const DEFAULT_JAM_KERJA = 8
const DEFAULT_SPESIALIS = ['Detailing', 'PPF', 'Coating', 'Poles', 'Interior', 'Ceramic', 'Cuci Mobil', 'Engine Bay']

function toMinutes(value: any, unit: DurationUnit, jamKerja = DEFAULT_JAM_KERJA): number | undefined {
  const n = Number(value)
  if (!n || n <= 0) return undefined
  if (unit === 'hari') return n * jamKerja * 60
  if (unit === 'jam') return n * 60
  return n
}

function fromMinutes(minutes?: number, jamKerja = DEFAULT_JAM_KERJA): { value: string; unit: DurationUnit } {
  if (!minutes) return { value: '', unit: 'jam' }
  const minsPerDay = jamKerja * 60
  if (minutes >= minsPerDay && minutes % minsPerDay === 0) return { value: String(minutes / minsPerDay), unit: 'hari' }
  if (minutes % 60 === 0) return { value: String(minutes / 60), unit: 'jam' }
  return { value: String(minutes), unit: 'menit' }
}

function getWarranty(notes?: string | null): { value: string; unit: WarrantyUnit } {
  if (!notes) return { value: '', unit: 'hari' }
  const m = notes.match(/garansi:(\d+):(hari|bulan|tahun)/)
  if (m) return { value: m[1], unit: m[2] as WarrantyUnit }
  const old = notes.match(/garansi:(\d+)\s*(hari|bulan|tahun)?/)
  if (old) return { value: old[1], unit: (old[2] as WarrantyUnit) || 'hari' }
  return { value: '', unit: 'hari' }
}

function buildNotes(warrantyValue?: string, warrantyUnit: WarrantyUnit = 'hari', existingNotes?: string | null): string | undefined {
  const base = (existingNotes || '').replace(/garansi:\d+[^|]*\|?/, '').replace(/^\|/, '').trim()
  if (!warrantyValue || warrantyValue === '0') return base || undefined
  const tag = `garansi:${warrantyValue}:${warrantyUnit}`
  return base ? `${tag}|${base}` : tag
}

function warrantyLabel(notes?: string | null) {
  const w = getWarranty(notes)
  return w.value ? `${w.value} ${w.unit}` : ''
}

const customerStatusLabel: Record<string, string> = {
  completed: 'Selesai',
  in_progress: 'Proses',
  qc_check: 'QC',
  confirmed: 'Antri',
  pending: 'Pending',
  cancelled: 'Batal',
}

function parseTeknisi(notes?: string) {
  const match = notes?.match(/^teknisi:([^|]+)/)
  return match ? match[1].split(',')[0].trim() : '-'
}

function mapCustomerData(customers: any[], registrations: any[]) {
  const regsByCustomer: Record<string, any[]> = {}
  registrations.forEach((r: any) => {
    if (!r.customerId) return
    if (!regsByCustomer[r.customerId]) regsByCustomer[r.customerId] = []
    regsByCustomer[r.customerId].push(r)
  })

  return customers.map((c: any) => {
    const regs = regsByCustomer[c.id] || []
    const completed = regs.filter((r: any) => r.status === 'completed')
    const vehicleMap = new Map<string, { plat: string; car: string; primary: boolean }>()
    regs.forEach((r: any) => {
      if (!r.licensePlate) return
      vehicleMap.set(r.licensePlate, {
        plat: r.licensePlate,
        car: r.vehicleName || '-',
        primary: false,
      })
    })
    const vehicles = Array.from(vehicleMap.values())
    if (vehicles.length > 0) vehicles[0].primary = true
    const totalSpendNum = completed.reduce((sum: number, r: any) => sum + Number(r.workshop?.price || 0), 0)
    const history = [...regs]
      .sort((a: any, b: any) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
      .map((r: any) => ({
        date: fmtDate(r.scheduledDate || r.createdAt),
        service: r.workshop?.title || 'Layanan',
        cost: r.workshop?.price ? fmtRp(Number(r.workshop.price)) : '-',
        status: customerStatusLabel[r.status] || r.status,
        teknisi: parseTeknisi(r.notes),
      }))
    return {
      ...c,
      phone: c.phone || '-',
      visit: completed.length,
      vip: completed.length >= 5,
      totalSpendNum,
      totalSpend: fmtRp(totalSpendNum),
      transactions: regs.length,
      vehicles,
      history,
      joinDate: fmtDate(c.createdAt),
    }
  })
}

interface Card {
  title: string
  subtitle?: string
  meta?: string
  right?: string
  rightColor?: string
  tag?: { text: string; color: string }
}

interface FormField {
  name: string
  label: string
  type?: 'text' | 'tel' | 'email' | 'number' | 'date' | 'select' | 'textarea' | 'multiselect'
  placeholder?: string
  required?: boolean
  options?: { value: string; label: string }[]
  default?: any
}

interface FormConfig {
  title: string
  fields: FormField[]
}

interface Config {
  title: string
  fetch: (tenantId: string) => Promise<any[]>
  toCard: (item: any) => Card
  searchable?: (item: any) => string
  create?: FormConfig & {
    submit: (data: Record<string, any>, tenantId: string) => Promise<any>
  }
  edit?: FormConfig & {
    toForm: (item: any) => Record<string, any>
    submit: (id: string, data: Record<string, any>, tenantId: string, item: any) => Promise<any>
  }
  remove?: (id: string, tenantId: string, item: any) => Promise<any>
}

const expenseCategories = [
  { value: 'Operasional', label: 'Operasional' },
  { value: 'Material', label: 'Material' },
  { value: 'Gaji', label: 'Gaji' },
  { value: 'Sewa', label: 'Sewa' },
  { value: 'Utilitas', label: 'Utilitas' },
  { value: 'Marketing', label: 'Marketing' },
  { value: 'Lainnya', label: 'Lainnya' },
]

const poStatuses = [
  { value: 'draft', label: 'Draft' },
  { value: 'ordered', label: 'Dikirim' },
  { value: 'received', label: 'Diterima' },
  { value: 'cancelled', label: 'Dibatalkan' },
]

const CONFIGS: Record<string, Config> = {
  pelanggan: {
    title: 'Pelanggan',
    fetch: async (t) => {
      const [customerRes, registrationRes] = await Promise.all([
        customersAPI.list(t),
        registrationsAPI.list(t),
      ])
      return mapCustomerData(customerRes.data.data || [], registrationRes.data.data || [])
    },
    toCard: (c) => ({
      title: c.name,
      subtitle: `${c.phone || '-'}${c.vehicles?.[0]?.plat ? ' - ' + c.vehicles[0].plat : ''}`,
      meta: `${c.visit || 0}x selesai - ${c.vehicles?.length || 0} kendaraan - ${c.totalSpend || fmtRp(0)}`,
      tag: c.vip ? { text: 'VIP', color: '#f59e0b' } : undefined,
    }),
    searchable: (c) => `${c.name} ${c.phone} ${c.address || ''} ${(c.vehicles || []).map((v: any) => `${v.plat} ${v.car}`).join(' ')}`,
    create: {
      title: 'Pelanggan Baru',
      fields: [
        { name: 'name', label: 'Nama Lengkap', required: true },
        { name: 'phone', label: 'No HP', required: true, type: 'tel' },
        { name: 'address', label: 'Alamat' },
      ],
      submit: (data, tenantId) => customersAPI.create({ ...data, tenantId } as any),
    },
    edit: {
      title: 'Edit Pelanggan',
      fields: [
        { name: 'name', label: 'Nama Lengkap', required: true },
        { name: 'phone', label: 'No HP', required: true, type: 'tel' },
        { name: 'address', label: 'Alamat' },
      ],
      toForm: (c) => ({ name: c.name || '', phone: c.phone || '', address: c.address || '' }),
      submit: (id, data) => customersAPI.update(id, data as any),
    },
  },
  teknisi: {
    title: 'Teknisi',
    fetch: async () => (await teknisiAPI.list()).data.data || [],
    toCard: (t) => ({
      title: t.name,
      subtitle: t.phone || '-',
      meta: (t.spesialis || []).join(', ') || 'Tanpa spesialisasi',
      tag: { text: t.status === 'aktif' ? 'Aktif' : 'Non-aktif', color: t.status === 'aktif' ? '#16a34a' : '#94a3b8' },
    }),
    searchable: (t) => `${t.name} ${(t.spesialis || []).join(' ')}`,
    create: {
      title: 'Teknisi Baru',
      fields: [
        { name: 'name', label: 'Nama', required: true },
        { name: 'phone', label: 'No HP', type: 'tel' },
        { name: 'spesialis', label: 'Spesialisasi', type: 'multiselect' },
        { name: 'status', label: 'Status', type: 'select', default: 'aktif', options: [{ value: 'aktif', label: 'Aktif' }, { value: 'nonaktif', label: 'Non-aktif' }] },
      ],
      submit: (data) => teknisiAPI.create({
        name: data.name,
        phone: data.phone || undefined,
        spesialis: normalizeTags(data.spesialis),
        status: data.status || 'aktif',
      }),
    },
    edit: {
      title: 'Edit Teknisi',
      fields: [
        { name: 'name', label: 'Nama', required: true },
        { name: 'phone', label: 'No HP', type: 'tel' },
        { name: 'spesialis', label: 'Spesialisasi', type: 'multiselect' },
        { name: 'status', label: 'Status', type: 'select', options: [{ value: 'aktif', label: 'Aktif' }, { value: 'nonaktif', label: 'Non-aktif' }] },
      ],
      toForm: (t) => ({ name: t.name || '', phone: t.phone || '', spesialis: t.spesialis || [], status: t.status || 'aktif' }),
      submit: (id, data) => teknisiAPI.update(id, { name: data.name, phone: data.phone || undefined, spesialis: normalizeTags(data.spesialis), status: data.status }),
    },
    remove: (id) => teknisiAPI.delete(id),
  },
  penjualan: {
    title: 'Penjualan',
    fetch: async (t) => {
      const regs = (await registrationsAPI.list(t)).data.data || []
      return regs.filter((r: any) => r.status === 'completed' || r.status === 'qc_check')
    },
    toCard: (r) => ({
      title: r.customer?.name || '-',
      subtitle: `${r.licensePlate || '-'} - ${r.workshop?.title || '-'}`,
      meta: fmtDate(r.updatedAt || r.createdAt),
      right: fmtRp(Number(r.workshop?.price || 0)),
      rightColor: '#16a34a',
      tag: { text: r.paymentStatus === 'LUNAS' ? 'Lunas' : 'Pending', color: r.paymentStatus === 'LUNAS' ? '#16a34a' : '#f59e0b' },
    }),
    searchable: (r) => `${r.customer?.name || ''} ${r.licensePlate || ''} ${r.workshop?.title || ''}`,
    edit: {
      title: 'Ubah Penjualan',
      fields: [
        { name: 'paymentStatus', label: 'Status Pembayaran', required: true, type: 'select', options: [{ value: 'PENDING', label: 'Pending' }, { value: 'LUNAS', label: 'Lunas' }] },
        { name: 'status', label: 'Status Pekerjaan', required: true, type: 'select', options: [
          { value: 'registered', label: 'Terdaftar' },
          { value: 'arrived', label: 'Customer Tiba' },
          { value: 'in_progress', label: 'Dikerjakan' },
          { value: 'qc_check', label: 'QC Check' },
          { value: 'completed', label: 'Selesai' },
        ] },
      ],
      toForm: (r) => ({ paymentStatus: r.paymentStatus || 'PENDING', status: r.status || 'completed' }),
      submit: (id, data, tenantId) => registrationsAPI.update(id, { tenantId, paymentStatus: data.paymentStatus, status: data.status }),
    },
  },
  pemasok: {
    title: 'Pemasok',
    fetch: async () => (await suppliersAPI.list()).data.data || [],
    toCard: (s) => ({
      title: s.nama,
      subtitle: `${s.kontak || ''}${s.phone ? ' - ' + s.phone : ''}`.trim() || '-',
      meta: s.alamat || s.kategori,
      tag: s.status ? { text: s.status, color: s.status === 'aktif' ? '#16a34a' : '#94a3b8' } : undefined,
    }),
    searchable: (s) => `${s.nama} ${s.kategori || ''} ${s.kontak || ''}`,
    create: supplierForm('Pemasok Baru', (data) => suppliersAPI.create(data as any)),
    edit: {
      ...supplierForm('Edit Pemasok', async () => null),
      toForm: (s) => ({ nama: s.nama || '', kontak: s.kontak || '', phone: s.phone || '', email: s.email || '', kategori: s.kategori || '', alamat: s.alamat || '', status: s.status || 'aktif' }),
      submit: (id, data) => suppliersAPI.update(id, data as any),
    },
    remove: (id) => suppliersAPI.delete(id),
  },
  po: {
    title: 'Pesanan Pembelian',
    fetch: async () => (await purchaseOrdersAPI.list()).data.data || [],
    toCard: (po) => ({
      title: po.supplierName || 'Pemasok',
      subtitle: `${po.items?.length || 0} item - ${fmtDate(po.orderDate)}`,
      right: fmtRp(Number(po.totalAmount || 0)),
      rightColor: '#1E4FD8',
      tag: { text: po.status || 'draft', color: po.status === 'received' ? '#16a34a' : '#f59e0b' },
    }),
    searchable: (po) => `${po.supplierName || ''} ${po.notes || ''}`,
    create: poForm('PO Baru', (data) => purchaseOrdersAPI.create({
      supplierName: data.supplierName || undefined,
      orderDate: data.orderDate,
      totalAmount: Number(data.totalAmount) || 0,
      status: data.status || 'draft',
      notes: data.notes || undefined,
      items: [],
    })),
    edit: {
      ...poForm('Edit PO', async () => null),
      toForm: (po) => ({ supplierName: po.supplierName || '', orderDate: (po.orderDate || '').slice(0, 10), totalAmount: po.totalAmount || 0, status: po.status || 'draft', notes: po.notes || '' }),
      submit: (id, data) => purchaseOrdersAPI.update(id, { ...data, totalAmount: Number(data.totalAmount) || 0 }),
    },
    remove: (id) => purchaseOrdersAPI.delete(id),
  },
  garansi: {
    title: 'Garansi',
    fetch: async () => (await warrantiesAPI.list()).data.data || [],
    toCard: (w) => ({
      title: w.customerName || w.customer?.name || '-',
      subtitle: `${w.licensePlate || '-'} - ${w.serviceName || w.workshop?.title || '-'}`,
      meta: `Berlaku s/d ${fmtDate(w.endDate || w.expiresAt)}`,
      tag: { text: w.status || 'active', color: w.status === 'voided' ? '#dc2626' : '#16a34a' },
    }),
    searchable: (w) => `${w.customerName || w.customer?.name || ''} ${w.licensePlate || ''}`,
    edit: {
      title: 'Kelola Garansi',
      fields: [{ name: 'action', label: 'Aksi', type: 'select', default: 'void', options: [{ value: 'void', label: 'Batalkan Garansi' }] }],
      toForm: () => ({ action: 'void' }),
      submit: (id) => warrantiesAPI.void(id),
    },
  },
  pendapatan: {
    title: 'Laporan Pendapatan',
    fetch: async (t) => {
      const regs = (await registrationsAPI.list(t)).data.data || []
      return regs.filter((r: any) => r.status === 'completed')
        .sort((a: any, b: any) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
    },
    toCard: (r) => ({
      title: r.workshop?.title || 'Layanan',
      subtitle: `${r.customer?.name || '-'} - ${r.licensePlate || '-'}`,
      meta: fmtDate(r.updatedAt || r.createdAt),
      right: fmtRp(Number(r.workshop?.price || 0)),
      rightColor: r.paymentStatus === 'LUNAS' ? '#16a34a' : '#f59e0b',
      tag: { text: r.paymentStatus || 'PENDING', color: r.paymentStatus === 'LUNAS' ? '#16a34a' : '#f59e0b' },
    }),
    searchable: (r) => `${r.workshop?.title || ''} ${r.customer?.name || ''}`,
  },
  pengeluaran: {
    title: 'Laporan Pengeluaran',
    fetch: async () => ((await expensesAPI.list()).data.data || []).sort((a: any, b: any) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime()),
    toCard: (e) => ({ title: e.keterangan, subtitle: `${e.kategori || '-'}${e.pemasok ? ' - ' + e.pemasok : ''}`, meta: fmtDate(e.tanggal), right: fmtRp(Number(e.jumlah || 0)), rightColor: '#dc2626' }),
    searchable: (e) => `${e.keterangan} ${e.kategori || ''} ${e.pemasok || ''}`,
    create: expenseForm('Pengeluaran Baru', (data) => expensesAPI.create(normalizeExpense(data))),
    edit: {
      ...expenseForm('Edit Pengeluaran', async () => null),
      toForm: (e) => ({ tanggal: (e.tanggal || '').slice(0, 10), kategori: e.kategori || '', keterangan: e.keterangan || '', pemasok: e.pemasok || '', jumlah: e.jumlah || 0 }),
      submit: (id, data) => expensesAPI.update(id, normalizeExpense(data)),
    },
    remove: (id) => expensesAPI.delete(id),
  },
  services: {
    title: 'Daftar Paket/Layanan',
    fetch: async (t) => (await workshopsAPI.list(t)).data.data || [],
    toCard: (s) => ({ title: s.title, subtitle: s.description || '-', meta: s.duration ? `${s.duration} menit` : undefined, right: fmtRp(Number(s.price || 0)), rightColor: '#1E4FD8' }),
    searchable: (s) => `${s.title} ${s.description || ''}`,
    create: serviceCategoryForm('Tambah Kategori', (data, tenantId) => workshopsAPI.create({
      title: data.title,
      description: data.description || undefined,
      price: '0',
      startDate: new Date().toISOString(),
      endDate: new Date().toISOString(),
      type: 'main_service',
      tenantId,
    } as any)),
    edit: {
      ...serviceForm('Edit Layanan', async () => null),
      toForm: (s) => ({ title: s.title || '', description: s.description || '', price: s.price || 0, duration: s.duration || '' }),
      submit: (id, data, tenantId) => workshopsAPI.update(id, { title: data.title, description: data.description || undefined, price: String(data.price || 0), duration: Number(data.duration) || undefined, tenantId }),
    },
    remove: (id, tenantId) => workshopsAPI.delete(id, tenantId),
  },
}

export default function MobileGenericList() {
  const { tenant } = useAuth()
  const { type = '' } = useParams<{ type: string }>()
  const navigate = useNavigate()
  const config = CONFIGS[type]
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingItem, setEditingItem] = useState<any | null>(null)
  const [deleteItem, setDeleteItem] = useState<any | null>(null)
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [saving, setSaving] = useState(false)
  const [formErr, setFormErr] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [servicePackageParent, setServicePackageParent] = useState<any | null>(null)
  const [extraSpesialis, setExtraSpesialis] = useState<string[]>([])

  const reload = () => {
    if (!config || !tenant?.id) return
    setLoading(true)
    setErr('')
    config.fetch(tenant.id).then(setItems).catch(e => setErr(e.message || 'Gagal memuat data')).finally(() => setLoading(false))
  }

  useEffect(() => { reload() }, [config, tenant?.id])

  const filtered = useMemo(() => {
    if (!search || !config?.searchable) return items
    const q = search.toLowerCase()
    return items.filter(it => config.searchable!(it).toLowerCase().includes(q))
  }, [items, search, config])

  const serviceGroups = useMemo(() => {
    if (type !== 'services') return []
    return groupServices(items, search)
  }, [items, search, type])

  const spesialisOptions = useMemo(() => {
    const options = new Set(DEFAULT_SPESIALIS)
    items.forEach((item: any) => (item.spesialis || []).forEach((s: string) => s && options.add(s)))
    extraSpesialis.forEach(s => options.add(s))
    return Array.from(options).map(value => ({ value, label: value }))
  }, [items, extraSpesialis])

  const addSpesialisOption = (value: string) => {
    const clean = value.trim()
    if (!clean) return
    setExtraSpesialis(prev => prev.includes(clean) ? prev : [...prev, clean])
  }

  const openCreate = () => {
    if (!config?.create) return
    const initial: Record<string, any> = {}
    config.create.fields.forEach(f => { initial[f.name] = f.default ?? '' })
    if (type === 'teknisi') initial.spesialis = []
    setEditingItem(null)
    setServicePackageParent(null)
    setFormData(initial)
    setFormErr('')
    setShowForm(true)
  }

  const openEdit = (item: any) => {
    if (!config?.edit) return
    setEditingItem(item)
    setServicePackageParent(null)
    if (type === 'services') setFormData(isServiceCategory(item) ? serviceCategoryEditForm.toForm(item) : servicePackageForm.toForm(item))
    else setFormData(config.edit.toForm(item))
    setFormErr('')
    setShowForm(true)
  }

  const openAddPackage = (parent: any) => {
    setEditingItem(null)
    setServicePackageParent(parent)
    const initial: Record<string, any> = {}
    servicePackageForm.fields.forEach(f => { initial[f.name] = f.default ?? '' })
    setFormData(initial)
    setFormErr('')
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingItem(null)
    setServicePackageParent(null)
  }

  const handleSubmit = async () => {
    if (!tenant?.id) return
    const formCfg = getActiveFormConfig(type, editingItem, servicePackageParent, config)
    if (!formCfg) return
    for (const f of formCfg.fields) {
      if (f.required && !String(formData[f.name] || '').trim()) {
        setFormErr(`${f.label} wajib diisi`)
        return
      }
    }
    setSaving(true)
    setFormErr('')
    try {
      let result: any
      if (type === 'services' && (editingItem || servicePackageParent)) result = await submitServiceForm({ editingItem, servicePackageParent, formData, tenantId: tenant.id })
      else if (type === 'services' && config?.create) result = await config.create.submit(formData, tenant.id)
      else if (editingItem && config?.edit) result = await config.edit.submit(editingItem.id, formData, tenant.id, editingItem)
      else if (config?.create) result = await config.create.submit(formData, tenant.id)
      closeForm()
      if (type === 'pelanggan' && !editingItem) {
        const customer = result?.data?.data || result?.data || null
        navigate('/m/booking', {
          state: {
            openBookingForm: true,
            customer: customer || {
              name: formData.name,
              phone: formData.phone,
              address: formData.address,
            },
            customerId: customer?.id || '',
          },
        })
        return
      }
      reload()
    } catch (e: any) {
      setFormErr(e.response?.data?.message || e.message || 'Gagal menyimpan')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteItem || !tenant?.id || !config?.remove) return
    setSaving(true)
    try {
      await config.remove(deleteItem.id, tenant.id, deleteItem)
      setDeleteItem(null)
      reload()
    } catch (e: any) {
      alert(e.response?.data?.message || e.message || 'Gagal menghapus')
    } finally {
      setSaving(false)
    }
  }

  if (!config) {
    return (
      <>
        <MobileSubHeader title="Tidak ditemukan" />
        <div className="p-8 text-center">
          <p className="text-[36px] mb-2">?</p>
          <p className="text-[13px] text-[#666]">Halaman tidak ditemukan</p>
        </div>
      </>
    )
  }

  const formCfg = getActiveFormConfig(type, editingItem, servicePackageParent, config)

  return (
    <>
      <MobileSubHeader title={config.title} subtitle={loading ? 'Memuat...' : type === 'services' ? `${serviceGroups.length} kategori` : `${filtered.length} item`} />
      <div className="px-4 pt-3 space-y-3 pb-4">
        {type === 'services' && (
          <button
            onClick={openCreate}
            className="w-full rounded-2xl bg-[#1E4FD8] px-4 py-3 text-[13px] font-bold text-white active:bg-[#1A45BF]"
          >
            + Tambah Kategori
          </button>
        )}

        {config.searchable && (
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cari..."
            className="w-full bg-white border border-[#e2e8f0] rounded-2xl px-3 py-2.5 text-[13px] outline-none focus:border-[#1E4FD8]"
          />
        )}

        {loading && <p className="text-center text-[12px] text-[#888] py-6">Memuat...</p>}
        {err && <p className="text-center text-[12px] text-[#dc2626] py-3">{err}</p>}
        {!loading && (type === 'services' ? serviceGroups.length === 0 : filtered.length === 0) && (
          <div className="bg-white rounded-2xl border border-[#e2e8f0] p-8 text-center">
            <p className="text-[13px] text-[#666]">Belum ada data</p>
          </div>
        )}

        {type === 'services' && serviceGroups.map(group => (
          <ServiceGroupCard
            key={group.parent.id}
            group={group}
            expanded={expandedId === group.parent.id || Boolean(search)}
            onToggle={() => setExpandedId(expandedId === group.parent.id ? null : group.parent.id)}
            onEdit={openEdit}
            onDelete={setDeleteItem}
            onAddPackage={openAddPackage}
          />
        ))}

        {type !== 'services' && filtered.map((item, i) => {
          const c = config.toCard(item)
          return (
            <div key={item.id || i} className="bg-white rounded-2xl border border-[#e2e8f0] p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-[13px] font-bold truncate">{c.title}</p>
                    {c.tag && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: c.tag.color + '22', color: c.tag.color }}>
                        {c.tag.text}
                      </span>
                    )}
                  </div>
                  {c.subtitle && <p className="text-[11px] text-[#666] truncate">{c.subtitle}</p>}
                  {c.meta && <p className="text-[10px] text-[#888] mt-0.5 truncate">{c.meta}</p>}
                </div>
                {c.right && <p className="text-[13px] font-bold flex-shrink-0" style={{ color: c.rightColor || '#111' }}>{c.right}</p>}
              </div>

              {(config.edit || config.remove || type === 'pelanggan') && (
                <div className="flex gap-2 mt-3">
                  {type === 'pelanggan' && (
                    <button
                      onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                      className="flex-1 bg-[#f8fafc] text-[#334155] text-[12px] font-semibold py-2 rounded-xl border border-[#e2e8f0]"
                    >
                      {expandedId === item.id ? 'Tutup' : 'Detail'}
                    </button>
                  )}
                  {config.edit && <button onClick={() => openEdit(item)} className="flex-1 bg-[#EEF3FE] text-[#1E4FD8] text-[12px] font-semibold py-2 rounded-xl">Edit</button>}
                  {config.remove && <button onClick={() => setDeleteItem(item)} className="flex-1 bg-[#fef2f2] text-[#dc2626] text-[12px] font-semibold py-2 rounded-xl">Hapus</button>}
                </div>
              )}

              {type === 'pelanggan' && expandedId === item.id && <CustomerMobileDetail customer={item} />}
            </div>
          )
        })}
      </div>

      {config.create && type !== 'services' && (
        <button onClick={openCreate} className="mobile-fab" aria-label={type === 'services' ? 'Tambah kategori layanan' : 'Tambah baru'}>
          +
        </button>
      )}

      {showForm && formCfg && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end" onClick={closeForm}>
          <div className="bg-white w-full rounded-t-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white px-5 pt-4 pb-3 border-b border-[#e2e8f0] z-10">
              <div className="w-10 h-1 bg-[#e2e8f0] rounded-full mx-auto mb-3" />
              <div className="flex items-center justify-between">
                <p className="text-[16px] font-bold">{formCfg.title}</p>
                <button onClick={closeForm} className="text-[12px] font-semibold text-[#666]">Tutup</button>
              </div>
            </div>

            <div className="px-5 py-4 space-y-3.5 pb-8">
              {formCfg.fields.map(f => (
                <Field
                  key={f.name}
                  field={type === 'teknisi' && f.name === 'spesialis' ? { ...f, options: spesialisOptions } : f}
                  value={formData[f.name] ?? (f.type === 'multiselect' ? [] : '')}
                  onChange={value => setFormData({ ...formData, [f.name]: value })}
                  onAddOption={type === 'teknisi' && f.name === 'spesialis' ? addSpesialisOption : undefined}
                />
              ))}

              {formErr && <p className="text-[12px] text-[#dc2626]">{formErr}</p>}

              <button onClick={handleSubmit} disabled={saving} className="w-full bg-[#1E4FD8] text-white text-[14px] font-semibold py-3 rounded-xl disabled:opacity-50">
                {saving ? 'Menyimpan...' : editingItem ? 'Simpan Perubahan' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteItem && config.remove && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end" onClick={() => setDeleteItem(null)}>
          <div className="bg-white w-full rounded-t-3xl p-5 pb-8" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-[#e2e8f0] rounded-full mx-auto mb-4" />
            <p className="text-[16px] font-bold text-center mb-1">Hapus Data?</p>
            <p className="text-[12px] text-[#666] text-center mb-5">{config.toCard(deleteItem).title} akan dihapus.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteItem(null)} className="flex-1 bg-[#f1f5f9] text-[#555] text-[14px] font-semibold py-3 rounded-xl">Batal</button>
              <button onClick={handleDelete} disabled={saving} className="flex-1 bg-[#dc2626] text-white text-[14px] font-semibold py-3 rounded-xl disabled:opacity-50">
                {saving ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function groupServices(items: any[], search: string) {
  const q = search.trim().toLowerCase()
  const parents = items.filter((s: any) => s.type === 'main_service' || (!s.parentId && s.type !== 'sub_service'))
  const children = items.filter((s: any) => s.parentId || s.type === 'sub_service')
  const parentIds = new Set(parents.map((s: any) => s.id))
  const orphanChildren = children.filter((s: any) => s.parentId && !parentIds.has(s.parentId))
  const allParents = [...parents, ...orphanChildren]

  return allParents.map((parent: any) => {
    const subs = children.filter((s: any) => s.parentId === parent.id)
    return { parent, subs }
  }).filter(({ parent, subs }) => {
    if (!q) return true
    const parentText = `${parent.title || ''} ${parent.description || ''}`.toLowerCase()
    const childText = subs.map((s: any) => `${s.title || ''} ${s.description || ''}`).join(' ').toLowerCase()
    return parentText.includes(q) || childText.includes(q)
  })
}

function isServiceCategory(item: any) {
  return item?.type === 'main_service' || (!item?.parentId && item?.type !== 'sub_service')
}

function getActiveFormConfig(type: string, editingItem: any, servicePackageParent: any, config?: Config) {
  if (type !== 'services') return editingItem ? config?.edit : config?.create
  if (editingItem) return isServiceCategory(editingItem) ? serviceCategoryEditForm : servicePackageForm
  if (servicePackageParent) return { ...servicePackageForm, title: `Paket Baru - ${servicePackageParent.title || 'Kategori'}` }
  return config?.create
}

async function submitServiceForm({
  editingItem,
  servicePackageParent,
  formData,
  tenantId,
}: {
  editingItem: any
  servicePackageParent: any
  formData: Record<string, any>
  tenantId: string
}) {
  const now = new Date()
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  if (editingItem) {
    if (isServiceCategory(editingItem)) {
      await workshopsAPI.update(editingItem.id, {
        title: formData.title,
        description: formData.description || undefined,
        tenantId,
      })
      return
    }

    await workshopsAPI.update(editingItem.id, {
      title: formData.title,
      description: formData.description || undefined,
      price: String(formData.price || 0),
      duration: toMinutes(formData.duration, (formData.durationUnit || 'jam') as DurationUnit) ?? null,
      notes: buildNotes(formData.warrantyValue, (formData.warrantyUnit || 'hari') as WarrantyUnit, editingItem.notes) ?? null,
      tenantId,
    })
    return
  }

  if (servicePackageParent) {
    await workshopsAPI.createSubService(servicePackageParent.id, {
      title: formData.title,
      description: formData.description || undefined,
      price: String(formData.price || 0),
      duration: toMinutes(formData.duration, (formData.durationUnit || 'jam') as DurationUnit),
      notes: buildNotes(formData.warrantyValue, (formData.warrantyUnit || 'hari') as WarrantyUnit),
      startDate: now.toISOString(),
      endDate: tomorrow.toISOString(),
      maxCapacity: 10,
      tenantId,
    })
  }
}

function ServiceGroupCard({
  group,
  expanded,
  onToggle,
  onEdit,
  onDelete,
  onAddPackage,
}: {
  group: { parent: any; subs: any[] }
  expanded: boolean
  onToggle: () => void
  onEdit: (item: any) => void
  onDelete: (item: any) => void
  onAddPackage: (parent: any) => void
}) {
  const { parent, subs } = group
  const prices = subs.map((s: any) => Number(s.price || 0)).filter((n: number) => n > 0)
  const priceText = prices.length === 0
    ? '-'
    : prices.length === 1
      ? fmtRp(prices[0])
      : `${fmtRp(Math.min(...prices))} - ${fmtRp(Math.max(...prices))}`

  return (
    <div className="bg-white rounded-2xl border border-[#e2e8f0] overflow-hidden">
      <button onClick={onToggle} className="w-full p-3.5 flex items-start justify-between gap-3 text-left active:bg-[#f8fafc]">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-[#EEF3FE] text-[#1E4FD8] text-[14px] font-bold flex items-center justify-center flex-shrink-0">
              {expanded ? '-' : '+'}
            </span>
            <p className="text-[13px] font-bold text-[#0f172a] truncate">{parent.title}</p>
          </div>
          {parent.description && <p className="text-[11px] text-[#64748b] truncate mt-1 ml-8">{parent.description}</p>}
          <p className="text-[10px] text-[#888] mt-1 ml-8">{subs.length} paket layanan - {priceText}</p>
        </div>
        <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-[#f1f5f9] text-[#475569] flex-shrink-0">
          Kategori
        </span>
      </button>

      <div className="px-3.5 pb-3 flex items-center gap-2">
        <button onClick={() => onAddPackage(parent)} className="shrink-0 rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] px-2.5 py-1.5 text-[11px] font-bold text-[#16a34a] active:bg-[#dcfce7]">
          + Paket
        </button>
        <button onClick={() => onEdit(parent)} className="flex-1 bg-[#EEF3FE] text-[#1E4FD8] text-[12px] font-semibold py-2 rounded-xl">Edit</button>
        <button onClick={() => onDelete(parent)} className="flex-1 bg-[#fef2f2] text-[#dc2626] text-[12px] font-semibold py-2 rounded-xl">Hapus</button>
      </div>

      {expanded && (
        <div className="border-t border-[#f1f5f9] bg-[#fbfdff] px-3.5 py-3 space-y-2">
          {subs.length === 0 ? (
            <div className="bg-white border border-dashed border-[#cbd5e1] rounded-xl px-3 py-3 text-center">
              <p className="text-[11px] text-[#94a3b8]">Belum ada paket/sub-layanan.</p>
              <button onClick={() => onAddPackage(parent)} className="mt-2 rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] px-3 py-1.5 text-[11px] font-bold text-[#16a34a]">
                + Paket
              </button>
            </div>
          ) : subs.map((svc: any) => (
            <div key={svc.id} className="bg-white rounded-xl border border-[#e2e8f0] p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-bold text-[#0f172a] truncate">{svc.title}</p>
                  {svc.description && <p className="text-[10px] text-[#64748b] truncate mt-0.5">{svc.description}</p>}
                  {svc.duration ? <p className="text-[10px] text-[#888] mt-0.5">{svc.duration} menit</p> : null}
                  {warrantyLabel(svc.notes) && <p className="text-[10px] text-[#16a34a] mt-0.5">Garansi {warrantyLabel(svc.notes)}</p>}
                </div>
                <p className="text-[12px] font-bold text-[#1E4FD8] flex-shrink-0">{fmtRp(Number(svc.price || 0))}</p>
              </div>
              <div className="flex gap-2 mt-2">
                <button onClick={() => onEdit(svc)} className="flex-1 bg-[#EEF3FE] text-[#1E4FD8] text-[11px] font-semibold py-1.5 rounded-lg">Edit</button>
                <button onClick={() => onDelete(svc)} className="flex-1 bg-[#fef2f2] text-[#dc2626] text-[11px] font-semibold py-1.5 rounded-lg">Hapus</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function CustomerMobileDetail({ customer }: { customer: any }) {
  const vehicles = customer.vehicles || []
  const history = customer.history || []

  return (
    <div className="mt-3 pt-3 border-t border-[#f1f5f9] space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <InfoStat label="Selesai" value={`${customer.visit || 0}x`} />
        <InfoStat label="Transaksi" value={String(customer.transactions || 0)} />
        <InfoStat label="Spend" value={customer.totalSpend || fmtRp(0)} tone="#1E4FD8" />
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="bg-[#f8fafc] rounded-xl px-3 py-2">
          <p className="text-[#64748b]">Bergabung</p>
          <p className="font-semibold text-[#0f172a] mt-0.5">{customer.joinDate || '-'}</p>
        </div>
        <div className="bg-[#f8fafc] rounded-xl px-3 py-2">
          <p className="text-[#64748b]">Alamat</p>
          <p className="font-semibold text-[#0f172a] mt-0.5 truncate">{customer.address || '-'}</p>
        </div>
      </div>

      <Link to="/m/booking" className="block w-full text-center bg-[#1E4FD8] text-white text-[12px] font-semibold py-2.5 rounded-xl">
        Booking Baru
      </Link>

      <section>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[12px] font-bold text-[#0f172a]">Kendaraan</p>
          <p className="text-[10px] text-[#64748b]">{vehicles.length} unit</p>
        </div>
        {vehicles.length === 0 ? (
          <p className="text-[11px] text-[#94a3b8] bg-[#f8fafc] rounded-xl px-3 py-2">Belum ada kendaraan dari data booking.</p>
        ) : (
          <div className="space-y-1.5">
            {vehicles.map((v: any) => (
              <div key={v.plat} className="flex items-center justify-between bg-[#f8fafc] rounded-xl px-3 py-2">
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold text-[#0f172a] truncate">{v.plat}</p>
                  <p className="text-[10px] text-[#64748b] truncate">{v.car}</p>
                </div>
                {v.primary && <span className="text-[9px] font-bold text-[#16a34a] bg-[#dcfce7] px-1.5 py-0.5 rounded-full">Utama</span>}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[12px] font-bold text-[#0f172a]">Riwayat Servis</p>
          <p className="text-[10px] text-[#64748b]">{history.length} data</p>
        </div>
        {history.length === 0 ? (
          <p className="text-[11px] text-[#94a3b8] bg-[#f8fafc] rounded-xl px-3 py-2">Belum ada riwayat servis.</p>
        ) : (
          <div className="space-y-2">
            {history.slice(0, 5).map((h: any, idx: number) => (
              <div key={`${h.date}-${h.service}-${idx}`} className="bg-[#f8fafc] rounded-xl px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-[#0f172a] truncate">{h.service}</p>
                    <p className="text-[10px] text-[#64748b] mt-0.5">{h.date} - {h.teknisi}</p>
                  </div>
                  <p className="text-[11px] font-bold text-[#16a34a] flex-shrink-0">{h.cost}</p>
                </div>
                <p className="text-[10px] text-[#64748b] mt-1">{h.status}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function InfoStat({ label, value, tone = '#0f172a' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="bg-[#f8fafc] rounded-xl px-2 py-2 min-w-0">
      <p className="text-[9px] text-[#64748b] truncate">{label}</p>
      <p className="text-[11px] font-bold truncate" style={{ color: tone }}>{value}</p>
    </div>
  )
}

function Field({
  field,
  value,
  onChange,
  onAddOption,
}: {
  field: FormField
  value: any
  onChange: (value: any) => void
  onAddOption?: (value: string) => void
}) {
  const [customValue, setCustomValue] = useState('')

  if (field.type === 'multiselect') {
    const selected = normalizeTags(value)
    const availableOptions = (field.options || []).filter(o => !selected.includes(o.value))
    const addSelected = (next: string) => {
      if (!next || selected.includes(next)) return
      onChange([...selected, next])
    }
    const removeSelected = (name: string) => onChange(selected.filter(s => s !== name))
    const addCustom = () => {
      const clean = customValue.trim()
      if (!clean || selected.includes(clean)) return
      onAddOption?.(clean)
      onChange([...selected, clean])
      setCustomValue('')
    }

    return (
      <div>
        <label className="block text-[11px] font-semibold text-[#666] mb-1">
          {field.label}{field.required && <span className="text-[#dc2626] ml-0.5">*</span>}
        </label>
        <select value="" onChange={e => addSelected(e.target.value)} className={inputCls} style={{ minWidth: 0 }}>
          <option value="">Pilih spesialisasi...</option>
          {availableOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {selected.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {selected.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => removeSelected(s)}
                className="rounded-full border border-[#D9E3FC] bg-[#EEF3FE] px-2.5 py-1 text-[11px] font-semibold text-[#1E4FD8]"
              >
                {s} x
              </button>
            ))}
          </div>
        )}
        <div className="mt-2 flex gap-2">
          <input
            value={customValue}
            onChange={e => setCustomValue(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustom())}
            placeholder="Tambah spesialisasi baru"
            className={inputCls + ' flex-1'}
            style={{ minWidth: 0 }}
          />
          <button
            type="button"
            onClick={addCustom}
            className="shrink-0 rounded-xl bg-[#1E4FD8] px-3 py-2 text-[12px] font-semibold text-white"
          >
            Tambah
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <label className="block text-[11px] font-semibold text-[#666] mb-1">
        {field.label}{field.required && <span className="text-[#dc2626] ml-0.5">*</span>}
      </label>
      {field.type === 'textarea' ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={field.placeholder} rows={3} className={inputCls} />
      ) : field.type === 'select' ? (
        <select value={value} onChange={e => onChange(e.target.value)} className={inputCls} style={{ minWidth: 0 }}>
          <option value="">Pilih...</option>
          {field.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : field.name === 'price' ? (
        <input type="text" inputMode="numeric" value={fmtNumberInput(value)} onChange={e => onChange(cleanNumber(e.target.value))} placeholder="0" className={inputCls} style={{ minWidth: 0 }} />
      ) : (
        <input type={field.type || 'text'} value={value} onChange={e => onChange(e.target.value)} placeholder={field.placeholder} className={inputCls} style={{ minWidth: 0 }} />
      )}
    </div>
  )
}

const inputCls = 'w-full bg-[#f8fafc] border border-[#e2e8f0] rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-[#1E4FD8] focus:bg-white'

function splitCsv(value: any) {
  return value ? String(value).split(',').map(s => s.trim()).filter(Boolean) : []
}

function normalizeTags(value: any) {
  return Array.isArray(value) ? value.map(s => String(s).trim()).filter(Boolean) : splitCsv(value)
}

function supplierForm(title: string, submit: (data: Record<string, any>, tenantId: string) => Promise<any>) {
  return {
    title,
    fields: [
      { name: 'nama', label: 'Nama Pemasok', required: true },
      { name: 'kontak', label: 'Nama Kontak' },
      { name: 'phone', label: 'No HP', type: 'tel' as const },
      { name: 'email', label: 'Email', type: 'email' as const },
      { name: 'kategori', label: 'Kategori' },
      { name: 'alamat', label: 'Alamat', type: 'textarea' as const },
      { name: 'status', label: 'Status', type: 'select' as const, default: 'aktif', options: [{ value: 'aktif', label: 'Aktif' }, { value: 'nonaktif', label: 'Non-aktif' }] },
    ],
    submit,
  }
}

function poForm(title: string, submit: (data: Record<string, any>, tenantId: string) => Promise<any>) {
  return {
    title,
    fields: [
      { name: 'supplierName', label: 'Pemasok', required: true },
      { name: 'orderDate', label: 'Tanggal PO', required: true, type: 'date' as const, default: new Date().toISOString().slice(0, 10) },
      { name: 'totalAmount', label: 'Total (Rp)', required: true, type: 'number' as const },
      { name: 'status', label: 'Status', type: 'select' as const, default: 'draft', options: poStatuses },
      { name: 'notes', label: 'Catatan', type: 'textarea' as const },
    ],
    submit,
  }
}

function expenseForm(title: string, submit: (data: Record<string, any>, tenantId: string) => Promise<any>) {
  return {
    title,
    fields: [
      { name: 'tanggal', label: 'Tanggal', required: true, type: 'date' as const, default: new Date().toISOString().slice(0, 10) },
      { name: 'kategori', label: 'Kategori', required: true, type: 'select' as const, options: expenseCategories },
      { name: 'keterangan', label: 'Keterangan', required: true },
      { name: 'pemasok', label: 'Pemasok' },
      { name: 'jumlah', label: 'Jumlah (Rp)', required: true, type: 'number' as const },
    ],
    submit,
  }
}

function serviceForm(title: string, submit: (data: Record<string, any>, tenantId: string) => Promise<any>) {
  return {
    title,
    fields: [
      { name: 'title', label: 'Nama Paket', required: true },
      { name: 'description', label: 'Deskripsi', type: 'textarea' as const },
      { name: 'price', label: 'Harga (Rp)', required: true, type: 'number' as const },
      { name: 'duration', label: 'Durasi (menit)', type: 'number' as const },
    ],
    submit,
  }
}

const serviceCategoryEditForm = {
  title: 'Edit Kategori',
  fields: [
    { name: 'title', label: 'Nama Kategori', required: true },
    { name: 'description', label: 'Deskripsi', type: 'textarea' as const },
  ],
  toForm: (s: any) => ({ title: s.title || '', description: s.description || '' }),
}

const servicePackageForm = {
  title: 'Edit Paket Layanan',
  fields: [
    { name: 'title', label: 'Nama Paket', required: true, placeholder: 'Basic Package' },
    { name: 'price', label: 'Harga (Rp)', required: true, type: 'number' as const },
    { name: 'duration', label: 'Estimasi Durasi', type: 'number' as const },
    {
      name: 'durationUnit',
      label: 'Satuan Durasi',
      type: 'select' as const,
      default: 'jam',
      options: [
        { value: 'menit', label: 'Menit' },
        { value: 'jam', label: 'Jam' },
        { value: 'hari', label: 'Hari' },
      ],
    },
    { name: 'warrantyValue', label: 'Garansi', type: 'number' as const, placeholder: '0' },
    {
      name: 'warrantyUnit',
      label: 'Satuan Garansi',
      type: 'select' as const,
      default: 'hari',
      options: [
        { value: 'hari', label: 'Hari' },
        { value: 'bulan', label: 'Bulan' },
        { value: 'tahun', label: 'Tahun' },
      ],
    },
    { name: 'description', label: 'Deskripsi', type: 'textarea' as const },
  ],
  toForm: (s: any) => {
    const d = fromMinutes(Number(s.duration || 0))
    const w = getWarranty(s.notes)
    return {
      title: s.title || '',
      price: s.price || 0,
      duration: d.value,
      durationUnit: d.unit,
      warrantyValue: w.value,
      warrantyUnit: w.unit,
      description: s.description || '',
    }
  },
}

function serviceCategoryForm(title: string, submit: (data: Record<string, any>, tenantId: string) => Promise<any>) {
  return {
    title,
    fields: [
      { name: 'title', label: 'Nama Kategori', required: true, placeholder: 'Interior Detailing' },
      { name: 'description', label: 'Deskripsi', type: 'textarea' as const },
    ],
    submit,
  }
}

function normalizeExpense(data: Record<string, any>) {
  return {
    tanggal: data.tanggal,
    kategori: data.kategori,
    keterangan: data.keterangan,
    pemasok: data.pemasok || undefined,
    jumlah: Number(data.jumlah) || 0,
  }
}
