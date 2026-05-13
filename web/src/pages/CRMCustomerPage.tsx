import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { customersAPI, registrationsAPI, workshopsAPI } from '../services/api'

interface Vehicle {
  plat: string
  car: string
  primary: boolean
}

interface HistoryItem {
  date: string
  service: string
  cost: string
  status: string
  teknisi: string
}

interface Customer {
  id: string
  name: string
  vehicles: Vehicle[]
  visit: number
  vip: boolean
  phone: string
  joinDate: string
  totalSpend: string
  transactions: number
  history: HistoryItem[]
}

const STATUS_LABEL: Record<string, string> = {
  completed: 'SELESAI',
  in_progress: 'PROSES',
  qc_check: 'QC',
  confirmed: 'ANTRI',
  pending: 'PENDING',
}

function parseTeknisi(notes?: string): string {
  const m = notes?.match(/^teknisi:(.+)/)
  return m ? m[1].split(',')[0].trim() : '—'
}

function fmtRp(val: number): string {
  if (val >= 1_000_000) return `Rp ${(val / 1_000_000).toFixed(1).replace('.0', '')}JT`
  if (val >= 1_000) return `Rp ${Math.round(val / 1000)}K`
  return `Rp ${val.toLocaleString('id-ID')}`
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

const inputClass = 'w-full rounded border border-[#cbd5e1] bg-white px-3 py-2 text-sm text-[#111] outline-none focus:border-brand focus:ring-2 focus:ring-[#dbeafe] transition'
const labelClass = 'block text-[11px] font-semibold text-[#555] mb-1'
const cleanNum = (v: string) => v.replace(/[^\d]/g, '')
const fmtNum = (v: string | number) => { const n = Math.round(Number(cleanNum(String(v || '')))); return n > 0 ? n.toLocaleString('id-ID', { maximumFractionDigits: 0 }) : '' }

interface BookingForm {
  workshopId: string
  scheduledDate: string
  scheduledTime: string
  vehicleType: string
  vehicleBrand: string
  vehicleName: string
  licensePlate: string
  dpAmount: string
  catatan: string
}
const emptyBookingForm = (): BookingForm => ({
  workshopId: '', scheduledDate: '', scheduledTime: '',
  vehicleType: 'mobil', vehicleBrand: '', vehicleName: '', licensePlate: '', dpAmount: '', catatan: '',
})

export default function CRMCustomerPage() {
  const { tenant } = useAuth()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string>('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ name: '', phone: '' })
  const [saving, setSaving] = useState(false)
  // Booking modal
  const [showBooking, setShowBooking] = useState(false)
  const [bookingCustomerId, setBookingCustomerId] = useState('')
  const [bookingForm, setBookingForm] = useState<BookingForm>(emptyBookingForm())
  const [bookingError, setBookingError] = useState('')
  const [bookingSaving, setBookingSaving] = useState(false)
  const [workshops, setWorkshops] = useState<any[]>([])

  const fetchData = useCallback(async () => {
    if (!tenant?.id) return
    try {
      setLoading(true)
      const [custRes, regRes] = await Promise.all([
        customersAPI.list(tenant.id),
        registrationsAPI.list(tenant.id),
      ])
      const rawCusts: any[] = custRes.data.data || custRes.data || []
      const rawRegs: any[] = regRes.data.data || []

      const regsByCustomer: Record<string, any[]> = {}
      rawRegs.forEach((r: any) => {
        if (r.customerId) {
          if (!regsByCustomer[r.customerId]) regsByCustomer[r.customerId] = []
          regsByCustomer[r.customerId].push(r)
        }
      })

      const mapped: Customer[] = rawCusts.map((c: any) => {
        const regs = regsByCustomer[c.id] || []
        const completed = regs.filter((r: any) => r.status === 'completed')

        const vehicleMap = new Map<string, Vehicle>()
        regs.forEach((r: any) => {
          if (r.licensePlate) {
            vehicleMap.set(r.licensePlate, {
              plat: r.licensePlate,
              car: r.vehicleName || '—',
              primary: false,
            })
          }
        })
        const vehicles = Array.from(vehicleMap.values())
        if (vehicles.length > 0) vehicles[0].primary = true

        const totalSpend = completed.reduce((sum: number, r: any) => sum + (r.workshop?.price || 0), 0)

        const history: HistoryItem[] = regs
          .sort((a: any, b: any) =>
            new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()
          )
          .map((r: any) => ({
            date: fmtDate(r.scheduledDate || r.createdAt),
            service: r.workshop?.title || 'Layanan',
            cost: r.workshop?.price ? fmtRp(r.workshop.price) : '—',
            status: STATUS_LABEL[r.status] || r.status,
            teknisi: parseTeknisi(r.notes),
          }))

        return {
          id: c.id,
          name: c.name,
          phone: c.phone || '—',
          joinDate: new Date(c.createdAt).toLocaleDateString('id-ID', { month: 'short', year: 'numeric' }),
          visit: completed.length,
          vip: completed.length >= 5,
          totalSpend: fmtRp(totalSpend),
          transactions: regs.length,
          vehicles,
          history,
        }
      })

      setCustomers(mapped)
      if (mapped.length > 0 && !selectedId) setSelectedId(mapped[0].id)
    } catch (err) {
      console.error('Failed to load customers:', err)
    } finally {
      setLoading(false)
    }
  }, [tenant?.id])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    if (!tenant?.id) return
    workshopsAPI.list(tenant.id).then((res: any) => {
      const all: any[] = res.data.data || []
      setWorkshops(all.filter((w: any) => w.type !== 'main_service'))
    }).catch(() => {})
  }, [tenant?.id])

  const openBooking = (customerId: string) => {
    const cust = customers.find(c => c.id === customerId)
    const primaryVehicle = cust?.vehicles.find(v => v.primary) || cust?.vehicles[0]
    setBookingCustomerId(customerId)
    setBookingForm({
      ...emptyBookingForm(),
      vehicleName: primaryVehicle?.car || '',
      licensePlate: primaryVehicle?.plat || '',
    })
    setBookingError('')
    setShowBooking(true)
  }

  const handleBookingSave = async () => {
    if (!bookingForm.workshopId) { setBookingError('Pilih layanan terlebih dahulu'); return }
    if (!bookingForm.scheduledDate) { setBookingError('Tanggal datang wajib diisi'); return }
    if (!bookingForm.vehicleType) { setBookingError('Jenis kendaraan wajib dipilih'); return }
    if (!bookingForm.vehicleBrand.trim()) { setBookingError('Merek kendaraan wajib diisi'); return }
    if (!bookingForm.vehicleName.trim()) { setBookingError('Model kendaraan wajib diisi'); return }
    setBookingSaving(true)
    setBookingError('')
    try {
      const scheduledDateTime = bookingForm.scheduledDate && bookingForm.scheduledTime
        ? new Date(`${bookingForm.scheduledDate}T${bookingForm.scheduledTime}`).toISOString()
        : new Date(`${bookingForm.scheduledDate}T08:00`).toISOString()
      const dpValue = Number(cleanNum(bookingForm.dpAmount))
      const dpNote = dpValue > 0 ? `dp:${dpValue}` : undefined
      const notes = [bookingForm.catatan, dpNote].filter(Boolean).join('|') || undefined
      await registrationsAPI.create({
        customerId: bookingCustomerId,
        workshopId: bookingForm.workshopId,
        tenantId: tenant!.id,
        scheduledDate: scheduledDateTime,
        vehicleType: bookingForm.vehicleType,
        vehicleBrand: bookingForm.vehicleBrand,
        vehicleName: bookingForm.vehicleName,
        licensePlate: bookingForm.licensePlate,
        ...(notes && { notes }),
      })
      setShowBooking(false)
      await fetchData()
    } catch (err: any) {
      setBookingError(err?.response?.data?.message || 'Gagal membuat booking')
    } finally {
      setBookingSaving(false)
    }
  }

  const filteredCustomers = customers.filter((c) => {
    const q = search.toLowerCase()
    const qDigits = q.replace(/\D/g, '')
    const phoneDigits = c.phone.replace(/\D/g, '')
    return (
      c.name.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q) ||
      (qDigits.length >= 4 && phoneDigits.includes(qDigits)) ||
      c.vehicles.some((v) => v.plat.toLowerCase().includes(q))
    )
  })

  const openEdit = (c: Customer) => {
    setEditingId(c.id)
    setEditForm({ name: c.name, phone: c.phone })
  }

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingId) return
    setSaving(true)
    try {
      await customersAPI.update(editingId, { name: editForm.name, phone: editForm.phone })
      setCustomers(prev => prev.map(c => c.id === editingId ? { ...c, ...editForm } : c))
      setEditingId(null)
    } catch (err) {
      console.error('Update failed:', err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="flex h-[calc(100vh-56px)] items-center justify-center">
      <p className="text-[13px] text-[#aaa]">Memuat data pelanggan...</p>
    </div>
  )

  if (customers.length === 0) return (
    <div className="flex h-[calc(100vh-56px)] items-center justify-center flex-col gap-2">
      <p className="text-[13px] text-[#aaa]">Belum ada pelanggan terdaftar.</p>
      <a href="/admin/sales/registration"
        className="px-4 py-2 rounded bg-brand text-white text-sm font-semibold hover:bg-brand-600 transition">
        + Buat Booking Pertama
      </a>
    </div>
  )

  const display = customers.find(c => c.id === selectedId) || customers[0]
  const bookingCustomer = customers.find(c => c.id === bookingCustomerId)

  return (
    <div className="flex h-[calc(100vh-56px)]">

      {/* Modal Booking */}
      {showBooking && bookingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col" style={{ maxHeight: '90vh' }}>
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-wm-line flex-shrink-0">
              <div>
                <p className="text-[11px] text-[#888]">Buat Booking untuk</p>
                <h2 className="text-base font-bold text-[#111]">{bookingCustomer.name}</h2>
              </div>
              <button onClick={() => setShowBooking(false)} className="text-[#aaa] hover:text-[#333] text-xl leading-none">✕</button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
              {/* Layanan */}
              <div>
                <label className={labelClass}>Layanan / Paket *</label>
                <select value={bookingForm.workshopId}
                  onChange={e => setBookingForm(f => ({ ...f, workshopId: e.target.value }))}
                  className={inputClass}>
                  <option value="">— Pilih layanan —</option>
                  {workshops.map((w: any) => (
                    <option key={w.id} value={w.id}>{w.title} — {fmtRp(Number(w.price || 0))}</option>
                  ))}
                </select>
              </div>

              {/* Tanggal & Jam */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Tanggal Datang *</label>
                  <input type="date" value={bookingForm.scheduledDate}
                    onChange={e => setBookingForm(f => ({ ...f, scheduledDate: e.target.value }))}
                    className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Jam</label>
                  <input type="time" value={bookingForm.scheduledTime}
                    onChange={e => setBookingForm(f => ({ ...f, scheduledTime: e.target.value }))}
                    className={inputClass} />
                </div>
              </div>

              {/* Kendaraan */}
              <div>
                <label className={labelClass}>Jenis Kendaraan *</label>
                <div className="flex gap-2">
                  {['mobil', 'motor'].map(t => (
                    <button key={t} type="button"
                      onClick={() => setBookingForm(f => ({ ...f, vehicleType: t }))}
                      className={`flex-1 py-2 rounded border text-sm font-semibold transition capitalize ${bookingForm.vehicleType === t ? 'border-brand bg-brand-50 text-brand' : 'border-wm-line text-[#555] hover:bg-[#f8fafc]'}`}>
                      {t === 'mobil' ? '🚗 Mobil' : '🏍 Motor'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Merek *</label>
                  <input value={bookingForm.vehicleBrand} placeholder="Toyota, Honda..."
                    onChange={e => setBookingForm(f => ({ ...f, vehicleBrand: e.target.value }))}
                    className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Model *</label>
                  <input value={bookingForm.vehicleName} placeholder="Avanza, Brio..."
                    onChange={e => setBookingForm(f => ({ ...f, vehicleName: e.target.value }))}
                    className={inputClass} />
                </div>
              </div>
              <div>
                <label className={labelClass}>Plat Nomor</label>
                <input value={bookingForm.licensePlate} placeholder="B 1234 ABC"
                  onChange={e => setBookingForm(f => ({ ...f, licensePlate: e.target.value.toUpperCase() }))}
                  className={inputClass} />
              </div>

              {/* DP */}
              <div>
                <label className={labelClass}>DP / Uang Muka (opsional)</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[#555] flex-shrink-0">Rp</span>
                  <input type="text" inputMode="numeric"
                    value={fmtNum(bookingForm.dpAmount)}
                    onChange={e => setBookingForm(f => ({ ...f, dpAmount: cleanNum(e.target.value) }))}
                    placeholder="0" className={inputClass} />
                </div>
              </div>

              {/* Catatan */}
              <div>
                <label className={labelClass}>Catatan (opsional)</label>
                <textarea rows={2} value={bookingForm.catatan}
                  onChange={e => setBookingForm(f => ({ ...f, catatan: e.target.value }))}
                  placeholder="Permintaan khusus, kondisi kendaraan, dll."
                  className={inputClass + ' resize-none'} />
              </div>

              {bookingError && (
                <p className="text-sm text-[#dc2626] bg-[#fef2f2] border border-[#fecaca] rounded px-3 py-2">{bookingError}</p>
              )}
            </div>
            <div className="px-6 py-4 border-t border-wm-line flex gap-2 flex-shrink-0">
              <button onClick={() => setShowBooking(false)}
                className="flex-1 py-2 rounded-lg border border-wm-line text-sm text-[#555] hover:bg-[#f8fafc] transition">
                Batal
              </button>
              <button onClick={handleBookingSave} disabled={bookingSaving}
                className="flex-1 py-2 rounded-lg bg-brand text-white text-sm font-semibold hover:bg-brand-600 disabled:opacity-40 transition">
                {bookingSaving ? 'Menyimpan...' : 'Buat Booking'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer list */}
      <div className="w-[320px] border-r border-wm-line bg-white flex flex-col">
        <div className="border-b border-[#f1f5f9] p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-[#111]">Pelanggan</h2>
            <button onClick={fetchData} className="text-[11px] text-brand hover:underline">↻ Refresh</button>
          </div>
          <div className="flex items-center gap-2 rounded border border-wm-line bg-white px-3 py-1.5">
            <span className="text-sm">🔍</span>
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama / plat / telp..."
              className="flex-1 text-[12px] text-[#555] outline-none" />
            {search && (
              <button onClick={() => setSearch('')} className="text-[#aaa] hover:text-[#555] text-sm leading-none">×</button>
            )}
          </div>
          <div className="flex gap-1.5 mt-3">
            <span className="inline-block px-2.5 py-0.5 bg-[#dbeafe] rounded-full text-[11px] text-brand">
              Semua ({filteredCustomers.length})
            </span>
            <span className="inline-block px-2.5 py-0.5 bg-[#fef3c7] rounded-full text-[11px] text-[#f59e0b]">
              VIP ({customers.filter(c => c.vip).length})
            </span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredCustomers.length === 0 && (
            <p className="px-4 py-6 text-center text-[12px] text-[#aaa]">Tidak ada hasil untuk "{search}"</p>
          )}
          {filteredCustomers.map((c) => (
            <button key={c.id} onClick={() => setSelectedId(c.id)}
              className={`w-full text-left px-4 py-3 border-b border-[#f8fafc] transition ${selectedId === c.id ? 'bg-brand-50' : 'bg-white hover:bg-[#f8fafc]'}`}>
              <div className="flex justify-between items-start">
                <div className="flex gap-2 items-start">
                  <div className="h-8 w-8 rounded-full bg-[#dbeafe] flex items-center justify-center flex-shrink-0">
                    <span className="text-[12px] font-bold text-brand">{c.name[0]}</span>
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-[#111]">{c.name}</p>
                    <p className="text-[11px] text-[#aaa]">
                      {c.vehicles.find(v => v.primary)?.plat || c.vehicles[0]?.plat || '—'}
                    </p>
                  </div>
                </div>
                {c.vip && <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-[#fef3c7] text-[#f59e0b]">VIP</span>}
              </div>
              <p className="text-[11px] text-[#bbb] mt-1 ml-10">
                {c.visit}x selesai · {c.vehicles.length} kendaraan
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Detail */}
      <div className="flex-1 overflow-y-auto p-6 bg-[#f8fafc]">
        {/* Header */}
        <div className="flex justify-between items-start mb-5">
          <div className="flex gap-3 items-center">
            <div className="h-12 w-12 rounded-full bg-[#dbeafe] flex items-center justify-center">
              <span className="text-xl font-bold text-brand">{display.name[0]}</span>
            </div>
            <div>
              <div className="flex gap-2 items-center">
                <h1 className="font-display text-xl font-bold text-ink">{display.name}</h1>
                {display.vip && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#fef3c7] text-[#f59e0b]">VIP</span>}
              </div>
              <p className="text-[12px] text-[#888] mt-0.5">
                Bergabung {display.joinDate} · {display.visit} selesai · {display.totalSpend}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => openEdit(display)}
              className="px-3 py-1.5 rounded border border-brand text-brand text-[12px] font-semibold hover:bg-brand-50 transition">
              Edit
            </button>
            <button onClick={() => openBooking(display.id)}
              className="px-3 py-1.5 rounded bg-brand text-white text-[12px] font-semibold hover:bg-brand-600 transition">
              + Booking
            </button>
          </div>
        </div>

        {/* Edit form */}
        {editingId === display.id && (
          <div className="mb-5 rounded-lg border border-[#D9E3FC] bg-white p-5">
            <p className="text-sm font-bold text-[#111] mb-4">Edit Data Pelanggan</p>
            <form onSubmit={handleEditSave} className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className={labelClass}>Nama Lengkap</label>
                  <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Nomor HP</label>
                  <input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className={inputClass} />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={saving}
                  className="px-4 py-2 rounded bg-brand text-white text-sm font-semibold hover:bg-brand-600 disabled:opacity-40 transition">
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
                <button type="button" onClick={() => setEditingId(null)}
                  className="px-4 py-2 rounded border border-wm-line bg-white text-sm text-[#555] hover:bg-[#f8fafc] transition">
                  Batal
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <div className="rounded-lg border border-wm-line bg-white p-4">
            <p className="text-[12px] font-bold text-[#111] mb-1.5">📞 Kontak</p>
            <p className="text-[12px] text-[#666]">{display.phone}</p>
          </div>
          <div className="rounded-lg border border-wm-line bg-white p-4">
            <p className="text-[12px] font-bold text-[#111] mb-1.5">💰 Total Spend</p>
            <p className="text-[13px] font-bold text-brand">{display.totalSpend}</p>
            <p className="text-[11px] text-[#aaa]">{display.transactions} transaksi</p>
          </div>
          <div className="rounded-lg border border-wm-line bg-white p-4">
            <p className="text-[12px] font-bold text-[#111] mb-1.5">📅 Bergabung</p>
            <p className="text-[12px] text-[#666]">{display.joinDate}</p>
            <p className="text-[11px] text-[#aaa]">{display.visit} layanan selesai</p>
          </div>
        </div>

        {/* Kendaraan */}
        <div className="rounded-lg border border-wm-line bg-white overflow-hidden mb-4">
          <div className="px-4 py-3 border-b border-[#f1f5f9]">
            <p className="text-sm font-bold text-[#111]">🚗 Kendaraan ({display.vehicles.length})</p>
          </div>
          {display.vehicles.length === 0 ? (
            <p className="px-4 py-4 text-[12px] text-[#aaa]">Belum ada kendaraan terdaftar</p>
          ) : (
            <div className="divide-y divide-[#f1f5f9]">
              {display.vehicles.map((v, idx) => (
                <div key={idx} className="flex items-center gap-3 px-4 py-3">
                  <span className="text-lg">🚘</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-semibold text-[#111]">{v.car}</p>
                      {v.primary && (
                        <span className="inline-block px-1.5 py-0.5 rounded bg-[#dbeafe] text-brand text-[10px] font-bold">Utama</span>
                      )}
                    </div>
                    <p className="text-[11px] text-[#888]">{v.plat}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Riwayat */}
        <div className="rounded-lg border border-wm-line bg-white overflow-hidden">
          <div className="flex justify-between items-center px-4 py-3 border-b border-[#f1f5f9]">
            <p className="text-sm font-bold text-[#111]">Riwayat Servis</p>
            <p className="text-[11px] text-[#aaa]">{display.history.length} layanan</p>
          </div>
          <div className="grid grid-cols-5 px-4 py-2 bg-[#f8fafc] border-b border-[#f1f5f9]">
            {['Tanggal', 'Layanan', 'Teknisi', 'Biaya', 'Status'].map((h) => (
              <p key={h} className="text-[11px] font-bold text-[#888]">{h}</p>
            ))}
          </div>
          {display.history.length === 0 ? (
            <p className="px-4 py-6 text-center text-[12px] text-[#aaa]">Belum ada riwayat servis</p>
          ) : (
            display.history.map((h, i) => (
              <div key={i} className="grid grid-cols-5 px-4 py-2.5 border-b border-[#f1f5f9] last:border-b-0 items-center">
                <p className="text-[12px] text-[#444]">{h.date}</p>
                <p className="text-[12px] text-[#444]">{h.service}</p>
                <div className="flex items-center gap-1.5">
                  {h.teknisi !== '—' && (
                    <div className="h-5 w-5 rounded-full bg-[#dbeafe] flex items-center justify-center flex-shrink-0">
                      <span className="text-[9px] font-bold text-brand">{h.teknisi[0]}</span>
                    </div>
                  )}
                  <p className="text-[11px] text-[#555]">{h.teknisi}</p>
                </div>
                <p className="text-[12px] text-[#444]">{h.cost}</p>
                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold w-fit ${
                  h.status === 'SELESAI' ? 'bg-[#dcfce7] text-[#16a34a]' :
                  h.status === 'PROSES'  ? 'bg-[#dbeafe] text-brand' :
                  h.status === 'QC'      ? 'bg-[#f3e8ff] text-[#8b5cf6]' :
                                           'bg-[#fef3c7] text-[#f59e0b]'
                }`}>{h.status}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
