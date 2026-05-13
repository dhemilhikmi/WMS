import { useEffect, useMemo, useState } from 'react'

const cleanNumber = (v: string) => v.replace(/[^\d]/g, '')
const fmtNumberInput = (v: string | number) => {
  const n = Math.round(Number(cleanNumber(String(v || ''))))
  return n > 0 ? n.toLocaleString('id-ID', { maximumFractionDigits: 0 }) : ''
}
import { workshopsAPI, tenantSettingsAPI } from '../services/api'

interface Workshop {
  id: string
  title: string
  description?: string
  price: string
  duration?: number   // menit
  maxCapacity: number
  type: string
  parentId?: string
  startDate: string
  endDate: string
  notes?: string
  _count: { registrations: number }
}

type WarrantyUnit = 'hari' | 'bulan' | 'tahun'

function getWarranty(notes?: string | null): { value: string; unit: WarrantyUnit } {
  if (!notes) return { value: '', unit: 'hari' }
  // format baru: garansi:30:hari
  const m = notes.match(/garansi:(\d+):(hari|bulan|tahun)/)
  if (m) return { value: m[1], unit: m[2] as WarrantyUnit }
  // format lama (fallback): garansi:30 hari
  const old = notes.match(/garansi:(\d+)\s*(hari|bulan|tahun)?/)
  if (old) return { value: old[1], unit: (old[2] as WarrantyUnit) || 'hari' }
  return { value: '', unit: 'hari' }
}

function warrantyLabel(notes?: string | null): string {
  const w = getWarranty(notes)
  if (!w.value) return ''
  return `${w.value} ${w.unit}`
}

function buildNotes(warrantyValue: string, warrantyUnit: WarrantyUnit, existingNotes?: string | null): string | undefined {
  const base = (existingNotes || '').replace(/garansi:\d+[^|]*\|?/, '').replace(/^\|/, '').trim()
  if (!warrantyValue || warrantyValue === '0') return base || undefined
  const tag = `garansi:${warrantyValue}:${warrantyUnit}`
  return base ? `${tag}|${base}` : tag
}

const DEFAULT_JAM_KERJA = 8

function fmtDuration(minutes: number, jamKerja = DEFAULT_JAM_KERJA): string {
  if (!minutes || minutes <= 0) return ''
  const minsPerDay = jamKerja * 60
  if (minutes >= minsPerDay && minutes % minsPerDay === 0) {
    const d = minutes / minsPerDay
    return `${d} hari`
  }
  if (minutes < 60) return `${minutes} mnt`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h} j ${m} mnt` : `${h} jam`
}

interface ServicesManagementProps {
  tenantId: string
}

type DurationUnit = 'menit' | 'jam' | 'hari'

function toMinutes(value: string, unit: DurationUnit, jamKerja = DEFAULT_JAM_KERJA): number | undefined {
  const n = Number(value)
  if (!n || n <= 0) return undefined
  if (unit === 'hari') return n * jamKerja * 60
  if (unit === 'jam') return n * 60
  return n
}

function fromMinutes(minutes: number, jamKerja = DEFAULT_JAM_KERJA): { value: string; unit: DurationUnit } {
  const minsPerDay = jamKerja * 60
  if (minutes >= minsPerDay && minutes % minsPerDay === 0) return { value: String(minutes / minsPerDay), unit: 'hari' }
  if (minutes % 60 === 0) return { value: String(minutes / 60), unit: 'jam' }
  return { value: String(minutes), unit: 'menit' }
}

const emptyParentForm = { title: '', description: '', price: '', duration: '', durationUnit: 'jam' as DurationUnit, startDate: '', endDate: '', maxCapacity: 10, warrantyValue: '', warrantyUnit: 'hari' as WarrantyUnit }
const emptySubServiceForm = { title: '', description: '', price: '', duration: '', durationUnit: 'jam' as DurationUnit, startDate: '', endDate: '', maxCapacity: 10, warrantyValue: '', warrantyUnit: 'hari' as WarrantyUnit }

export default function ServicesManagement({ tenantId }: ServicesManagementProps) {
  const [jamKerja, setJamKerja] = useState(DEFAULT_JAM_KERJA)
  const [parentServices, setParentServices] = useState<Workshop[]>([])
  const [subServices, setSubServices] = useState<Record<string, Workshop[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAddParent, setShowAddParent] = useState(false)
  const [expandedParent, setExpandedParent] = useState<string | null>(null)
  const [showSubServiceForm, setShowSubServiceForm] = useState<string | null>(null)
  const [parentFormData, setParentFormData] = useState(emptyParentForm)
  const [subServiceFormData, setSubServiceFormData] = useState(emptySubServiceForm)
  const [submitting, setSubmitting] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; title: string; type: 'parent' | 'sub' } | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editPrice, setEditPrice] = useState('')
  const [editTitle, setEditTitle] = useState('')
  const [editDuration, setEditDuration] = useState('')
  const [editDurationUnit, setEditDurationUnit] = useState<DurationUnit>('jam')
  const [editWarrantyValue, setEditWarrantyValue] = useState('')
  const [editWarrantyUnit, setEditWarrantyUnit] = useState<WarrantyUnit>('hari')
  const [editExistingNotes, setEditExistingNotes] = useState<string | undefined>(undefined)
  const [editIsParent, setEditIsParent] = useState(false)

  useEffect(() => {
    fetchServices()
    tenantSettingsAPI.get('jam_kerja_per_hari')
      .then(res => { if (res.data.data?.value) setJamKerja(Number(res.data.data.value)) })
      .catch(() => {})
  }, [tenantId])

  const totalSubServices = useMemo(
    () => Object.values(subServices).reduce((sum, items) => sum + items.length, 0),
    [subServices]
  )

  const totalRegistrations = useMemo(
    () =>
      parentServices.reduce((sum, s) => sum + (s._count?.registrations || 0), 0) +
      Object.values(subServices).reduce(
        (sum, services) => sum + services.reduce((inner, s) => inner + (s._count?.registrations || 0), 0),
        0
      ),
    [parentServices, subServices]
  )

  const fetchServices = async () => {
    try {
      setLoading(true)
      setError('')
      const response = await workshopsAPI.list(tenantId)
      const workshops = response.data.data || []
      const parents = workshops.filter((w: Workshop) => w.type === 'main_service')
      setParentServices(parents)

      const subServiceEntries = await Promise.all(
        parents.map(async (parent: Workshop) => {
          try {
            const subRes = await workshopsAPI.getSubServices(parent.id, tenantId)
            return [parent.id, subRes.data.data || []] as const
          } catch {
            return [parent.id, []] as const
          }
        })
      )
      setSubServices(Object.fromEntries(subServiceEntries))
    } catch (err: any) {
      setError(err.response?.data?.message || 'Gagal memuat layanan')
    } finally {
      setLoading(false)
    }
  }

  const handleAddParentService = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const now = new Date()
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
      await workshopsAPI.create({
        title: parentFormData.title,
        description: parentFormData.description,
        price: parentFormData.price,
        duration: toMinutes(parentFormData.duration, parentFormData.durationUnit, jamKerja),
        startDate: parentFormData.startDate || now.toISOString().slice(0, 16),
        endDate: parentFormData.endDate || tomorrow.toISOString().slice(0, 16),
        maxCapacity: parentFormData.maxCapacity,
        type: 'main_service',
        notes: buildNotes(parentFormData.warrantyValue, parentFormData.warrantyUnit) as any,
        tenantId,
      })
      setParentFormData(emptyParentForm)
      setShowAddParent(false)
      await fetchServices()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Gagal menambah layanan')
    } finally {
      setSubmitting(false)
    }
  }

  const handleAddSubService = async (parentId: string, e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const now = new Date()
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
      await workshopsAPI.createSubService(parentId, {
        title: subServiceFormData.title,
        description: subServiceFormData.description,
        price: subServiceFormData.price,
        duration: toMinutes(subServiceFormData.duration, subServiceFormData.durationUnit, jamKerja),
        startDate: subServiceFormData.startDate || now.toISOString().slice(0, 16),
        endDate: subServiceFormData.endDate || tomorrow.toISOString().slice(0, 16),
        maxCapacity: subServiceFormData.maxCapacity,
        notes: buildNotes(subServiceFormData.warrantyValue, subServiceFormData.warrantyUnit) as any,
        tenantId,
      })
      setSubServiceFormData(emptySubServiceForm)
      setShowSubServiceForm(null)
      setExpandedParent(parentId)
      await fetchServices()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Gagal menambah sub-service')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDuplicateService = async (parentService: Workshop) => {
    setSubmitting(true)
    try {
      const now = new Date()
      const future = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)
      const res = await workshopsAPI.create({
        title: parentService.title + ' (Salinan)',
        description: parentService.description,
        price: parentService.price,
        duration: parentService.duration,
        startDate: now.toISOString().slice(0, 16),
        endDate: future.toISOString().slice(0, 16),
        maxCapacity: parentService.maxCapacity,
        type: 'main_service',
        tenantId,
      })
      const newParentId = res.data.data?.id
      if (newParentId) {
        const subs = subServices[parentService.id] || []
        for (const sub of subs) {
          await workshopsAPI.createSubService(newParentId, {
            title: sub.title,
            description: sub.description,
            price: sub.price,
            duration: sub.duration,
            startDate: now.toISOString().slice(0, 16),
            endDate: future.toISOString().slice(0, 16),
            maxCapacity: sub.maxCapacity,
            tenantId,
          })
        }
      }
      await fetchServices()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Gagal menduplikat layanan')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteService = async (id: string) => {
    setSubmitting(true)
    try {
      await workshopsAPI.delete(id, tenantId)
      setDeleteConfirm(null)
      await fetchServices()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Gagal menghapus layanan')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEditService = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingId) return
    setSubmitting(true)
    try {
      await workshopsAPI.update(editingId, {
        title: editTitle,
        price: editPrice,
        duration: toMinutes(editDuration, editDurationUnit, jamKerja) ?? null,
        notes: buildNotes(editWarrantyValue, editWarrantyUnit, editExistingNotes) ?? null,
        tenantId,
      })
      setEditingId(null)
      setEditPrice('')
      setEditTitle('')
      setEditDuration('')
      setEditWarrantyValue('')
      setEditWarrantyUnit('hari')
      setEditExistingNotes(undefined)
      await fetchServices()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Gagal update layanan')
    } finally {
      setSubmitting(false)
    }
  }

  const formatCurrency = (amount: string | number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(Number(amount))

  const renderServiceForm = (mode: 'parent' | 'sub', onSubmit: (e: React.FormEvent) => Promise<void> | void) => {
    const formData = mode === 'parent' ? parentFormData : subServiceFormData
    const setFormData = mode === 'parent' ? setParentFormData : setSubServiceFormData
    const title = mode === 'parent' ? 'Tambah Kategori Paket' : 'Tambah Paket'
    const submitLabel = mode === 'parent' ? 'Simpan Kategori' : 'Simpan Paket'

    return (
      <div className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-4">
        <h4 className="text-sm font-bold text-[#111] mb-4">{title}</h4>
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
              <label className="block text-[11px] font-semibold text-[#555] mb-1">{mode === 'parent' ? 'Nama Kategori Paket' : 'Nama Paket'}</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
              className="w-full rounded border border-[#cbd5e1] bg-white px-3 py-2 text-sm text-[#111] outline-none focus:border-[#1E4FD8] focus:ring-2 focus:ring-[#dbeafe]"
              placeholder={mode === 'parent' ? 'Interior Detailing' : 'Basic Package'}
            />
          </div>
          {mode === 'sub' && (
            <>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="block text-[11px] font-semibold text-[#555] mb-1">Harga (Rp)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={fmtNumberInput(formData.price)}
                    onChange={(e) => setFormData({ ...formData, price: cleanNumber(e.target.value) })}
                    required
                    className="w-full rounded border border-[#cbd5e1] bg-white px-3 py-2 text-sm text-[#111] outline-none focus:border-[#1E4FD8] focus:ring-2 focus:ring-[#dbeafe]"
                    placeholder="250.000"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#555] mb-1">Estimasi Durasi</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={1}
                      value={formData.duration}
                      onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                      className="flex-1 rounded border border-[#cbd5e1] bg-white px-3 py-2 text-sm text-[#111] outline-none focus:border-[#1E4FD8] focus:ring-2 focus:ring-[#dbeafe]"
                      placeholder="mis. 2"
                    />
                    <select
                      value={formData.durationUnit}
                      onChange={(e) => setFormData({ ...formData, durationUnit: e.target.value as DurationUnit })}
                      className="rounded border border-[#cbd5e1] bg-white px-2 py-2 text-sm text-[#111] outline-none focus:border-[#1E4FD8]"
                    >
                      <option value="menit">Menit</option>
                      <option value="jam">Jam</option>
                      <option value="hari">Hari</option>
                    </select>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#555] mb-1">Garansi</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={0}
                    value={formData.warrantyValue}
                    onChange={(e) => setFormData({ ...formData, warrantyValue: e.target.value })}
                    className="w-24 rounded border border-[#cbd5e1] bg-white px-3 py-2 text-sm text-[#111] outline-none focus:border-[#1E4FD8] focus:ring-2 focus:ring-[#dbeafe]"
                    placeholder="0"
                  />
                  <select
                    value={formData.warrantyUnit}
                    onChange={(e) => setFormData({ ...formData, warrantyUnit: e.target.value as WarrantyUnit })}
                    className="rounded border border-[#cbd5e1] bg-white px-2 py-2 text-sm text-[#111] outline-none focus:border-[#1E4FD8]"
                  >
                    <option value="hari">Hari</option>
                    <option value="bulan">Bulan</option>
                    <option value="tahun">Tahun</option>
                  </select>
                  <span className="self-center text-[11px] text-[#aaa]">(0 = tidak ada garansi)</span>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#555] mb-1">Deskripsi</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  className="w-full rounded border border-[#cbd5e1] bg-white px-3 py-2 text-sm text-[#111] outline-none focus:border-[#1E4FD8] focus:ring-2 focus:ring-[#dbeafe]"
                  placeholder="Deskripsi singkat layanan"
                />
              </div>
            </>
          )}
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded bg-[#1E4FD8] text-white text-sm font-semibold hover:bg-[#1A45BF] disabled:opacity-50 transition"
            >
              {submitting ? 'Menyimpan...' : submitLabel}
            </button>
            <button
              type="button"
              onClick={() => {
                if (mode === 'parent') { setShowAddParent(false); setParentFormData(emptyParentForm) }
                else { setShowSubServiceForm(null); setSubServiceFormData(emptySubServiceForm) }
              }}
              className="px-4 py-2 rounded border border-[#e2e8f0] bg-white text-sm font-semibold text-[#555] hover:bg-[#f8fafc] transition"
            >
              Batal
            </button>
          </div>
        </form>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-[#888]">Memuat layanan...</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-5">
      {error && (
        <div className="rounded-lg border border-[#fecaca] bg-[#fee2e2] px-4 py-3 text-sm text-[#dc2626]">
          {error}
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg border border-[#e2e8f0] bg-white p-6 shadow-xl">
            <h3 className="text-base font-bold text-[#111]">Hapus {deleteConfirm.type === 'parent' ? 'Kategori' : 'Paket'}?</h3>
            <p className="mt-2 text-sm text-[#666]">
              Yakin ingin menghapus <span className="font-semibold text-[#111]">{deleteConfirm.title}</span>? Tindakan ini tidak bisa dibatalkan.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => handleDeleteService(deleteConfirm.id)}
                disabled={submitting}
                className="flex-1 rounded bg-[#dc2626] px-4 py-2 text-sm font-semibold text-white hover:bg-[#b91c1c] disabled:opacity-50 transition"
              >
                {submitting ? 'Menghapus...' : 'Hapus'}
              </button>
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 rounded border border-[#e2e8f0] bg-white px-4 py-2 text-sm font-semibold text-[#555] hover:bg-[#f8fafc] transition"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg border border-[#e2e8f0] bg-white p-6 shadow-xl">
            <h3 className="text-base font-bold text-[#111] mb-4">Edit {editIsParent ? 'Kategori' : 'Paket'}</h3>
            <form onSubmit={handleEditService} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-[#555] mb-1">Nama {editIsParent ? 'Kategori' : 'Paket'}</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  required
                  className="w-full rounded border border-[#cbd5e1] bg-white px-3 py-2 text-sm text-[#111] outline-none focus:border-[#1E4FD8] focus:ring-2 focus:ring-[#dbeafe]"
                />
              </div>
              {!editIsParent && (
                <>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#555] mb-1">Harga (Rp)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={fmtNumberInput(editPrice)}
                      onChange={(e) => setEditPrice(cleanNumber(e.target.value))}
                      required
                      className="w-full rounded border border-[#cbd5e1] bg-white px-3 py-2 text-sm text-[#111] outline-none focus:border-[#1E4FD8] focus:ring-2 focus:ring-[#dbeafe]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#555] mb-1">Estimasi Durasi</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min={1}
                        value={editDuration}
                        onChange={(e) => setEditDuration(e.target.value)}
                        className="flex-1 rounded border border-[#cbd5e1] bg-white px-3 py-2 text-sm text-[#111] outline-none focus:border-[#1E4FD8] focus:ring-2 focus:ring-[#dbeafe]"
                        placeholder="mis. 2"
                      />
                      <select
                        value={editDurationUnit}
                        onChange={(e) => setEditDurationUnit(e.target.value as DurationUnit)}
                        className="rounded border border-[#cbd5e1] bg-white px-2 py-2 text-sm text-[#111] outline-none focus:border-[#1E4FD8]"
                      >
                        <option value="menit">Menit</option>
                        <option value="jam">Jam</option>
                        <option value="hari">Hari</option>
                      </select>
                    </div>
                  </div>
                </>
              )}
              {!editIsParent && (
                <div>
                  <label className="block text-[11px] font-semibold text-[#555] mb-1">Garansi</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={0}
                      value={editWarrantyValue}
                      onChange={(e) => setEditWarrantyValue(e.target.value)}
                      className="w-24 rounded border border-[#cbd5e1] bg-white px-3 py-2 text-sm text-[#111] outline-none focus:border-[#1E4FD8] focus:ring-2 focus:ring-[#dbeafe]"
                      placeholder="0"
                    />
                    <select
                      value={editWarrantyUnit}
                      onChange={(e) => setEditWarrantyUnit(e.target.value as WarrantyUnit)}
                      className="rounded border border-[#cbd5e1] bg-white px-2 py-2 text-sm text-[#111] outline-none focus:border-[#1E4FD8]"
                    >
                      <option value="hari">Hari</option>
                      <option value="bulan">Bulan</option>
                      <option value="tahun">Tahun</option>
                    </select>
                  </div>
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={submitting}
                  className="flex-1 rounded bg-[#1E4FD8] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1A45BF] disabled:opacity-50 transition">
                  {submitting ? 'Menyimpan...' : 'Simpan'}
                </button>
                <button type="button" onClick={() => { setEditingId(null); setEditTitle(''); setEditPrice('') }}
                  className="flex-1 rounded border border-[#e2e8f0] bg-white px-4 py-2 text-sm font-semibold text-[#555] hover:bg-[#f8fafc] transition">
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-lg border border-[#e2e8f0] bg-white p-5">
          <p className="text-xs text-[#999]">Kategori</p>
          <p className="mt-2 text-4xl font-bold text-[#1E4FD8]">{parentServices.length}</p>
          <p className="mt-1 text-xs text-[#888]">Kategori paket aktif</p>
        </div>
        <div className="rounded-lg border border-[#e2e8f0] bg-white p-5">
          <p className="text-xs text-[#999]">Total Paket</p>
          <p className="mt-2 text-4xl font-bold text-[#111]">{totalSubServices}</p>
          <p className="mt-1 text-xs text-[#888]">Paket tersedia</p>
        </div>
        <div className="rounded-lg border border-[#e2e8f0] bg-white p-5">
          <p className="text-xs text-[#999]">Total Booking</p>
          <p className="mt-2 text-4xl font-bold text-[#111]">{totalRegistrations}</p>
          <p className="mt-1 text-xs text-[#888]">Booking terkait layanan</p>
        </div>
      </div>

      {/* Service list */}
      <div className="rounded-lg border border-[#e2e8f0] bg-white overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#f1f5f9]">
          <div>
            <p className="text-sm font-bold text-[#111]">Daftar Paket</p>
            <p className="text-[11px] text-[#888] mt-0.5">Kelola kategori dan paket layanan</p>
          </div>
          <button
            onClick={() => setShowAddParent(!showAddParent)}
            className="px-4 py-2 rounded bg-[#1E4FD8] text-white text-sm font-semibold hover:bg-[#1A45BF] transition"
          >
            {showAddParent ? 'Tutup' : '+ Tambah Kategori'}
          </button>
        </div>

        {showAddParent && (
          <div className="px-5 py-4 border-b border-[#f1f5f9]">
            {renderServiceForm('parent', handleAddParentService)}
          </div>
        )}

        <div>
          {parentServices.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-sm font-semibold text-[#888]">Belum ada layanan</p>
              <p className="mt-1 text-[12px] text-[#aaa]">Mulai dengan menambah kategori paket pertama.</p>
            </div>
          ) : (
            parentServices.map((parentService) => {
              const isExpanded = expandedParent === parentService.id
              const isFormOpen = showSubServiceForm === parentService.id
              const childServices = subServices[parentService.id] || []

              return (
                <div key={parentService.id} className="border-b border-[#f1f5f9] last:border-b-0">
                  {/* Parent row */}
                  <div className="flex items-start justify-between gap-4 px-5 py-4 bg-[#fafbfc] hover:bg-[#f8fafc] transition">
                    <button
                      className="flex items-start gap-3 text-left flex-1"
                      onClick={() => setExpandedParent(isExpanded ? null : parentService.id)}
                    >
                      <span className="mt-0.5 inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded bg-[#dbeafe] text-[#1E4FD8] text-xs font-bold">
                        {isExpanded ? '−' : '+'}
                      </span>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-bold text-[#111]">{parentService.title}</p>
                          <span className="inline-block px-2 py-0.5 rounded-full bg-[#dcfce7] text-[#16a34a] text-[10px] font-bold">
                            Kategori
                          </span>
                        </div>
                        <p className="mt-0.5 text-[12px] text-[#666]">
                          {parentService.description || 'Belum ada deskripsi.'}
                        </p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {parentService.duration ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-[#fde68a] bg-[#fffbeb] text-[11px] font-semibold text-[#92400e]">
                              ⏱ {fmtDuration(parentService.duration, jamKerja)}
                            </span>
                          ) : null}
                          {warrantyLabel(parentService.notes) && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-[#a7f3d0] bg-[#ecfdf5] text-[11px] font-semibold text-[#065f46]">
                              🛡 Garansi {warrantyLabel(parentService.notes)}
                            </span>
                          )}
                          <span className="inline-block px-2 py-0.5 rounded border border-[#e2e8f0] bg-white text-[11px] text-[#666]">
                            {childServices.length} paket
                          </span>
                        </div>
                      </div>
                    </button>

                    <div className="flex gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => setShowSubServiceForm(isFormOpen ? null : parentService.id)}
                        className="px-3 py-1.5 rounded bg-[#1E4FD8] text-white text-[12px] font-semibold hover:bg-[#1A45BF] transition"
                      >
                        + Paket
                      </button>
                      <button
                        onClick={() => { setEditingId(parentService.id); setEditIsParent(true); setEditPrice(parentService.price); setEditTitle(parentService.title); const d = parentService.duration ? fromMinutes(parentService.duration, jamKerja) : { value: '', unit: 'jam' as DurationUnit }; setEditDuration(d.value); setEditDurationUnit(d.unit); const w = getWarranty(parentService.notes); setEditWarrantyValue(w.value); setEditWarrantyUnit(w.unit); setEditExistingNotes(parentService.notes) }}
                        className="px-3 py-1.5 rounded border border-[#e2e8f0] bg-white text-[12px] text-[#555] hover:bg-[#f8fafc] transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDuplicateService(parentService)}
                        disabled={submitting}
                        title={`Duplikat beserta ${(subServices[parentService.id] || []).length} paket`}
                        className="px-3 py-1.5 rounded border border-[#e2e8f0] bg-white text-[12px] text-[#555] hover:bg-[#f8fafc] disabled:opacity-40 transition"
                      >
                        Duplikat
                      </button>
                      <button
                        onClick={() => setDeleteConfirm({ id: parentService.id, title: parentService.title, type: 'parent' })}
                        className="px-3 py-1.5 rounded border border-[#fecaca] bg-[#fee2e2] text-[12px] text-[#dc2626] hover:bg-[#fecaca] transition"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>

                  {/* Sub-service form */}
                  {isFormOpen && (
                    <div className="px-5 py-4 border-t border-[#f1f5f9] bg-white">
                      {renderServiceForm('sub', (e) => handleAddSubService(parentService.id, e))}
                    </div>
                  )}

                  {/* Sub-service list */}
                  {isExpanded && (
                    <div className="px-5 py-3 border-t border-[#f1f5f9] bg-white">
                      <p className="text-[11px] font-bold text-[#888] mb-2 uppercase tracking-wide">
                        Paket · {childServices.length} item
                      </p>
                      {childServices.length === 0 ? (
                        <p className="text-[12px] text-[#aaa] py-3">Belum ada paket.</p>
                      ) : (
                        <div className="space-y-2">
                          {childServices.map((sub) => (
                            <div key={sub.id}
                              className="flex items-center justify-between gap-4 rounded border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3">
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="text-[13px] font-semibold text-[#111]">{sub.title}</p>
                                  <span className="inline-block px-2 py-0.5 rounded border border-[#e2e8f0] bg-white text-[11px] font-semibold text-[#1E4FD8]">
                                    {formatCurrency(sub.price)}
                                  </span>
                                  {sub.duration ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-[#fde68a] bg-[#fffbeb] text-[11px] font-semibold text-[#92400e]">
                                      ⏱ {fmtDuration(sub.duration, jamKerja)}
                                    </span>
                                  ) : null}
                                  {warrantyLabel(sub.notes) && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-[#a7f3d0] bg-[#ecfdf5] text-[11px] font-semibold text-[#065f46]">
                                      🛡 {warrantyLabel(sub.notes)}
                                    </span>
                                  )}
                                </div>
                                {sub.description && (
                                  <p className="text-[11px] text-[#888] mt-0.5">{sub.description}</p>
                                )}
                              </div>
                              <div className="flex gap-1.5 flex-shrink-0">
                                <button
                                  onClick={() => { setEditingId(sub.id); setEditIsParent(false); setEditPrice(sub.price); setEditTitle(sub.title); const d = sub.duration ? fromMinutes(sub.duration, jamKerja) : { value: '', unit: 'jam' as DurationUnit }; setEditDuration(d.value); setEditDurationUnit(d.unit); const w = getWarranty(sub.notes); setEditWarrantyValue(w.value); setEditWarrantyUnit(w.unit); setEditExistingNotes(sub.notes) }}
                                  className="px-2.5 py-1 rounded border border-[#e2e8f0] bg-white text-[11px] text-[#555] hover:bg-[#f8fafc] transition"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => setDeleteConfirm({ id: sub.id, title: sub.title, type: 'sub' })}
                                  className="px-2.5 py-1 rounded border border-[#fecaca] bg-[#fee2e2] text-[11px] text-[#dc2626] hover:bg-[#fecaca] transition"
                                >
                                  Hapus
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
