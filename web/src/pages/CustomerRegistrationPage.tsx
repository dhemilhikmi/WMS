import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { customersAPI, registrationsAPI, workshopsAPI } from '../services/api'

interface Workshop {
  id: string
  title: string
  startDate: string
  endDate: string
  price?: number
  type?: string
  parentId?: string
}

interface Customer {
  id: string
  name: string
  address?: string
  phone: string
  satuan?: string
  createdAt: string
}

interface Registration {
  id: string
  customerId: string
  workshopId: string
  customer?: Customer
  workshop?: Workshop
  scheduledDate?: string
  status?: string
  notes?: string
  vehicleType?: string
  vehicleBrand?: string
  vehicleName?: string
  licensePlate?: string
  createdAt: string
}

const initialCustomerForm = { name: '', address: '', phone: '', satuan: 'Ibu' }
const initialEditForm = { workshopId: '', scheduledDate: '', scheduledTime: '', notes: '', vehicleType: '', vehicleBrand: '', vehicleName: '', licensePlate: '', dpAmount: '' }

const cleanNumber = (value: string) => value.replace(/[^\d]/g, '')
const fmtRpInput = (value: string | number) => {
  const n = Math.round(Number(cleanNumber(String(value || ''))))
  return n > 0 ? n.toLocaleString('id-ID', { maximumFractionDigits: 0 }) : ''
}
const parseMoney = (value: string | number) => Number(cleanNumber(String(value || ''))) || 0
const parseDP = (notes?: string) => Number(notes?.match(/(?:^|\|)dp:(\d+(?:\.\d+)?)/i)?.[1] || notes?.match(/DP:\s*Rp\s*([\d.]+)/i)?.[1]?.replace(/\./g, '') || 0)
const stripDP = (notes?: string) => String(notes || '').replace(/(?:^|\|)dp:\d+(?:\.\d+)?/i, '').replace(/^\|+|\|+$/g, '').trim()
const mergeDPNote = (notes: string, amount: number) => {
  const base = stripDP(notes)
  return [base, amount > 0 ? `dp:${amount}` : ''].filter(Boolean).join('|')
}

function statusStyle(status?: string) {
  if (status === 'cancelled') return { bg: '#fee2e2', fg: '#dc2626' }
  if (status === 'completed') return { bg: '#dcfce7', fg: '#16a34a' }
  return { bg: '#dbeafe', fg: '#1E4FD8' }
}

const inputClass = 'w-full rounded border border-[#cbd5e1] bg-white px-3 py-2 text-sm text-[#111] outline-none focus:border-[#1E4FD8] focus:ring-2 focus:ring-[#dbeafe] transition'
const labelClass = 'block text-[11px] font-semibold text-[#555] mb-1'
const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

function readMonthParam(value: string | null): number {
  const n = Number(value)
  return Number.isInteger(n) && n >= 1 && n <= 12 ? n - 1 : new Date().getMonth()
}

function readYearParam(value: string | null): number {
  const n = Number(value)
  return Number.isInteger(n) && n >= 2000 && n <= 2100 ? n : new Date().getFullYear()
}

export default function CustomerRegistrationPage() {
  const { tenant } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [workshops, setWorkshops] = useState<Workshop[]>([])
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(false)
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerMatches, setCustomerMatches] = useState<Customer[]>([])
  const [foundCustomer, setFoundCustomer] = useState<Customer | null>(null)
  const [searchError, setSearchError] = useState('')
  const [newCustomerForm, setNewCustomerForm] = useState(initialCustomerForm)
  const [newCustomerError, setNewCustomerError] = useState('')
  const [newCustomerSuccess, setNewCustomerSuccess] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [selectedWorkshop, setSelectedWorkshop] = useState('')
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [vehicleType, setVehicleType] = useState('')
  const [vehicleBrand, setVehicleBrand] = useState('')
  const [vehicleName, setVehicleName] = useState('')
  const [licensePlate, setLicensePlate] = useState('')
  const [brandSuggestions, setBrandSuggestions] = useState<string[]>([])
  const [showBrandSuggestions, setShowBrandSuggestions] = useState(false)
  const [dpAmount, setDpAmount] = useState('')
  const [registrationError, setRegistrationError] = useState('')
  const [registrationSuccess, setRegistrationSuccess] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState(initialEditForm)
  const [editError, setEditError] = useState('')
  const [cancelingId, setCancelingId] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelError, setCancelError] = useState('')
  const [monthFilter, setMonthFilter] = useState(() => readMonthParam(searchParams.get('bulan')))
  const [yearFilter, setYearFilter] = useState(() => readYearParam(searchParams.get('tahun')))

  useEffect(() => {
    if (tenant?.id) { fetchWorkshops(); fetchRegistrations(); fetchCustomers() }
  }, [tenant?.id])

  useEffect(() => {
    const next = new URLSearchParams(searchParams)
    next.set('bulan', String(monthFilter + 1))
    next.set('tahun', String(yearFilter))
    setSearchParams(next, { replace: true })
  }, [monthFilter, yearFilter])

  const yearOptions = useMemo(() => {
    const years = new Set<number>([new Date().getFullYear(), yearFilter])
    registrations.forEach((r) => {
      const d = new Date(r.scheduledDate || r.createdAt)
      if (!Number.isNaN(d.getTime())) years.add(d.getFullYear())
    })
    return Array.from(years).sort((a, b) => b - a)
  }, [registrations, yearFilter])

  const filteredRegistrations = useMemo(() => registrations.filter((r) => {
    const d = new Date(r.scheduledDate || r.createdAt)
    return d.getMonth() === monthFilter && d.getFullYear() === yearFilter
  }), [registrations, monthFilter, yearFilter])

  const totalScheduled = useMemo(() => filteredRegistrations.filter((r) => r.status !== 'cancelled').length, [filteredRegistrations])
  const totalCancelled = useMemo(() => filteredRegistrations.filter((r) => r.status === 'cancelled').length, [filteredRegistrations])

  const fetchWorkshops = async () => {
    if (!tenant?.id) return
    try {
      const res = await workshopsAPI.list(tenant.id)
      setWorkshops(res.data.data || [])
    } catch (err) { console.error(err) }
  }

  const fetchRegistrations = async () => {
    if (!tenant?.id) return
    try {
      const res = await registrationsAPI.list(tenant.id)
      const data: Registration[] = res.data.data || []
      setRegistrations(data)
      const brands = [...new Set(data.map(r => r.vehicleBrand).filter(Boolean) as string[])].sort()
      setBrandSuggestions(brands)
    } catch (err) { console.error(err) }
  }

  const fetchCustomers = async () => {
    if (!tenant?.id) return
    try {
      const res = await customersAPI.list(tenant.id)
      setCustomers(res.data.data || [])
    } catch (err) { console.error(err) }
  }

  const handleSearchCustomer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tenant?.id || !customerSearch.trim()) { setSearchError('Masukkan nama atau nomor HP'); return }
    setLoading(true); setSearchError(''); setFoundCustomer(null); setCustomerMatches([])
    try {
      const q = customerSearch.trim().toLowerCase()
      const localMatches = customers.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q)
      )
      if (localMatches.length === 1) {
        setFoundCustomer(localMatches[0]); setSelectedCustomer(localMatches[0])
      } else if (localMatches.length > 1) {
        setCustomerMatches(localMatches.slice(0, 8))
      } else {
        const res = await customersAPI.getByPhone(customerSearch.trim(), tenant.id)
        if (res.status === 404) setSearchError('Pelanggan tidak ditemukan. Silakan buat pelanggan baru.')
        else { setFoundCustomer(res.data.data); setSelectedCustomer(res.data.data) }
      }
    } catch { setSearchError('Gagal mencari pelanggan') }
    finally { setLoading(false) }
  }

  const handleCreateNewCustomer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tenant?.id) return
    if (!newCustomerForm.name || !newCustomerForm.phone) { setNewCustomerError('Nama dan nomor HP harus diisi'); return }
    setLoading(true); setNewCustomerError(''); setNewCustomerSuccess('')
    try {
      const res = await customersAPI.create({ name: newCustomerForm.name, address: newCustomerForm.address || undefined, phone: newCustomerForm.phone, satuan: newCustomerForm.satuan, tenantId: tenant.id })
      const c = res.data.data
      setNewCustomerSuccess(`${c.name} berhasil ditambahkan`)
      setNewCustomerForm(initialCustomerForm)
      setSelectedCustomer(c); setFoundCustomer(c); setCustomerSearch(c.phone)
      await fetchCustomers()
      setTimeout(() => setNewCustomerSuccess(''), 3000)
    } catch (err: any) { setNewCustomerError(err.response?.data?.message || 'Gagal membuat pelanggan') }
    finally { setLoading(false) }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tenant?.id || !selectedCustomer) return
    if (!selectedWorkshop) { setRegistrationError('Pilih layanan'); return }
    if (!scheduledDate) { setRegistrationError('Tanggal datang wajib diisi'); return }
    if (!scheduledTime) { setRegistrationError('Jam datang wajib diisi'); return }
    if (!vehicleType) { setRegistrationError('Jenis kendaraan wajib dipilih'); return }
    if (!vehicleBrand.trim()) { setRegistrationError('Merek kendaraan wajib diisi'); return }
    if (!vehicleName.trim()) { setRegistrationError('Model kendaraan wajib diisi'); return }
    let scheduledDateTime: string | undefined
    if (scheduledDate && scheduledTime) scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}`).toISOString()
    setLoading(true); setRegistrationError(''); setRegistrationSuccess('')
    try {
      const dpValue = parseMoney(dpAmount)
      const dpNote = dpValue > 0 ? `dp:${dpValue}` : undefined
      await registrationsAPI.create({ customerId: selectedCustomer.id, workshopId: selectedWorkshop, tenantId: tenant.id, ...(scheduledDateTime && { scheduledDate: scheduledDateTime }), ...(vehicleType && { vehicleType }), ...(vehicleBrand && { vehicleBrand }), ...(vehicleName && { vehicleName }), ...(licensePlate && { licensePlate }), ...(dpNote && { notes: dpNote }) })
      const ws = workshops.find((w) => w.id === selectedWorkshop)
      setRegistrationSuccess(`${selectedCustomer.name} berhasil didaftarkan untuk ${ws?.title}`)
      setSelectedWorkshop(''); setScheduledDate(''); setScheduledTime(''); setVehicleType(''); setVehicleBrand(''); setVehicleName(''); setLicensePlate(''); setDpAmount('')
      await fetchRegistrations()
      setTimeout(() => setRegistrationSuccess(''), 3000)
    } catch (err: any) { setRegistrationError(err.response?.data?.message || 'Gagal mendaftarkan') }
    finally { setLoading(false) }
  }

  const startEdit = (reg: Registration) => {
    setEditingId(reg.id); setCancelingId(null)
    const dp = parseDP(reg.notes)
    setEditForm({ workshopId: reg.workshopId, scheduledDate: reg.scheduledDate ? reg.scheduledDate.split('T')[0] : '', scheduledTime: reg.scheduledDate ? reg.scheduledDate.split('T')[1].slice(0, 5) : '', notes: stripDP(reg.notes), vehicleType: reg.vehicleType || '', vehicleBrand: reg.vehicleBrand || '', vehicleName: reg.vehicleName || '', licensePlate: reg.licensePlate || '', dpAmount: dp ? String(dp) : '' })
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tenant?.id || !editingId) return
    let scheduledDateTime: string | undefined
    if (editForm.scheduledDate && editForm.scheduledTime) scheduledDateTime = new Date(`${editForm.scheduledDate}T${editForm.scheduledTime}`).toISOString()
    setLoading(true); setEditError('')
    try {
      await registrationsAPI.update(editingId, { tenantId: tenant.id, workshopId: editForm.workshopId, ...(scheduledDateTime && { scheduledDate: scheduledDateTime }), notes: mergeDPNote(editForm.notes, parseMoney(editForm.dpAmount)), ...(editForm.vehicleType && { vehicleType: editForm.vehicleType }), ...(editForm.vehicleBrand && { vehicleBrand: editForm.vehicleBrand }), ...(editForm.vehicleName && { vehicleName: editForm.vehicleName }), ...(editForm.licensePlate && { licensePlate: editForm.licensePlate }) })
      setEditingId(null); setEditForm(initialEditForm)
      await fetchRegistrations()
    } catch (err: any) { setEditError(err.response?.data?.message || 'Gagal mengupdate') }
    finally { setLoading(false) }
  }

  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tenant?.id || !cancelingId) return
    setLoading(true); setCancelError('')
    try {
      await registrationsAPI.update(cancelingId, { tenantId: tenant.id, status: 'cancelled', notes: cancelReason })
      setCancelingId(null); setCancelReason('')
      await fetchRegistrations()
    } catch (err: any) { setCancelError(err.response?.data?.message || 'Gagal membatalkan') }
    finally { setLoading(false) }
  }

  const handleDeleteRegistration = async (id: string) => {
    if (!tenant?.id) return
    setLoading(true)
    try { await registrationsAPI.delete(id, tenant.id); await fetchRegistrations() }
    catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const formatDateTime = (value?: string) => {
    if (!value) return { date: '-', time: '-' }
    const d = new Date(value)
    return { date: d.toLocaleDateString('id-ID'), time: d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) }
  }

  return (
    <div className="p-6 space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-[#e2e8f0] bg-white p-5">
          <p className="text-xs text-[#999]">Total Booking</p>
          <p className="mt-2 text-4xl font-bold text-[#111]">{filteredRegistrations.length}</p>
        </div>
        <div className="rounded-lg border border-[#e2e8f0] bg-white p-5">
          <p className="text-xs text-[#999]">Aktif</p>
          <p className="mt-2 text-4xl font-bold text-[#1E4FD8]">{totalScheduled}</p>
        </div>
        <div className="rounded-lg border border-[#e2e8f0] bg-white p-5">
          <p className="text-xs text-[#999]">Dibatalkan</p>
          <p className="mt-2 text-4xl font-bold text-[#dc2626]">{totalCancelled}</p>
        </div>
      </div>

      {/* Cari + Tambah Pelanggan */}
      <div className="grid gap-4 xl:grid-cols-2">
        {/* Cari pelanggan */}
        <div className="rounded-lg border border-[#e2e8f0] bg-white p-5">
          <p className="text-sm font-bold text-[#111] mb-4">Cari Pelanggan</p>

          {searchError && (
            <div className="mb-3 rounded border border-[#fecaca] bg-[#fee2e2] px-3 py-2 text-[12px] text-[#dc2626]">
              {searchError}
            </div>
          )}

          {foundCustomer && (
            <div className="mb-3 rounded border border-[#D9E3FC] bg-[#EEF3FE] px-3 py-2.5">
              <p className="text-sm font-bold text-[#111]">{foundCustomer.satuan} {foundCustomer.name}</p>
              <p className="text-[12px] text-[#555] mt-0.5">📞 {foundCustomer.phone}</p>
              {foundCustomer.address && <p className="text-[12px] text-[#555]">📍 {foundCustomer.address}</p>}
            </div>
          )}
          {customerMatches.length > 0 && (
            <div className="mb-3 rounded border border-[#e2e8f0] bg-[#f8fafc] p-2">
              <p className="mb-2 text-[11px] font-semibold text-[#555]">Pilih pelanggan</p>
              <div className="space-y-1.5">
                {customerMatches.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => { setFoundCustomer(c); setSelectedCustomer(c); setCustomerMatches([]); setCustomerSearch(c.phone) }}
                    className="w-full rounded bg-white px-3 py-2 text-left text-[12px] hover:bg-[#EEF3FE]"
                  >
                    <span className="font-semibold text-[#111]">{c.satuan} {c.name}</span>
                    <span className="ml-2 text-[#666]">{c.phone}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleSearchCustomer} className="space-y-3">
            <div>
              <label className={labelClass}>Nama / Nomor HP</label>
              <input type="search" value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} placeholder="Nama pelanggan atau 0812..." className={inputClass} />
            </div>
            <button type="submit" disabled={loading} className="w-full rounded bg-[#1E4FD8] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1A45BF] disabled:opacity-50 transition">
              {loading ? 'Mencari...' : 'Cari Pelanggan'}
            </button>
          </form>
        </div>

        {/* Tambah pelanggan baru */}
        <div className="rounded-lg border border-[#e2e8f0] bg-white p-5">
          <p className="text-sm font-bold text-[#111] mb-4">Tambah Pelanggan Baru</p>

          {newCustomerError && (
            <div className="mb-3 rounded border border-[#fecaca] bg-[#fee2e2] px-3 py-2 text-[12px] text-[#dc2626]">
              {newCustomerError}
            </div>
          )}
          {newCustomerSuccess && (
            <div className="mb-3 rounded border border-[#bbf7d0] bg-[#dcfce7] px-3 py-2 text-[12px] text-[#16a34a]">
              {newCustomerSuccess}
            </div>
          )}

          <form onSubmit={handleCreateNewCustomer} className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className={labelClass}>Sapaan</label>
                <select value={newCustomerForm.satuan} onChange={(e) => setNewCustomerForm({ ...newCustomerForm, satuan: e.target.value })} className={inputClass}>
                  <option value="Bapak">Bapak</option>
                  <option value="Ibu">Ibu</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Nomor HP</label>
                <input
                  type="text"
                  inputMode="tel"
                  value={newCustomerForm.phone}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, phone: e.target.value })}
                  placeholder="08123456789"
                  className={inputClass}
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>Nama Lengkap</label>
              <input type="text" value={newCustomerForm.name} onChange={(e) => setNewCustomerForm({ ...newCustomerForm, name: e.target.value })} placeholder="Nama lengkap pelanggan" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Alamat</label>
              <input type="text" value={newCustomerForm.address} onChange={(e) => setNewCustomerForm({ ...newCustomerForm, address: e.target.value })} placeholder="Alamat pelanggan" className={inputClass} />
            </div>
            <button type="submit" disabled={loading} className="w-full rounded bg-[#1E4FD8] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1A45BF] disabled:opacity-50 transition">
              {loading ? 'Menyimpan...' : 'Tambah Pelanggan'}
            </button>
          </form>
        </div>
      </div>

      {/* Form booking */}
      {selectedCustomer && (
        <div className="rounded-lg border border-[#D9E3FC] bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-bold text-[#111]">
              Booking untuk: <span className="text-[#1E4FD8]">{selectedCustomer.satuan} {selectedCustomer.name}</span>
            </p>
            <span className="text-[12px] text-[#888]">📞 {selectedCustomer.phone}</span>
          </div>

          {registrationError && (
            <div className="mb-3 rounded border border-[#fecaca] bg-[#fee2e2] px-3 py-2 text-[12px] text-[#dc2626]">
              {registrationError}
            </div>
          )}
          {registrationSuccess && (
            <div className="mb-3 rounded border border-[#bbf7d0] bg-[#dcfce7] px-3 py-2 text-[12px] text-[#16a34a]">
              {registrationSuccess}
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-3">
            <div>
              <label className={labelClass}>Layanan</label>
              <select value={selectedWorkshop} onChange={(e) => setSelectedWorkshop(e.target.value)} className={inputClass}>
                <option value="">Pilih layanan</option>
                {(() => {
                  const parents = workshops.filter(w => w.type === 'main_service')
                  const subs = workshops.filter(w => w.type === 'sub_service')

                  if (parents.length === 0) {
                    return workshops.map(w => <option key={w.id} value={w.id}>{w.title}</option>)
                  }

                  return parents.map(parent => {
                    const children = subs.filter(s => s.parentId === parent.id)
                    if (children.length === 0) {
                      // parent tanpa sub = bisa dipilih langsung
                      return <option key={parent.id} value={parent.id}>{parent.title}</option>
                    }
                    return (
                      <optgroup key={parent.id} label={parent.title}>
                        {children.map(sub => (
                          <option key={sub.id} value={sub.id}>{sub.title}</option>
                        ))}
                      </optgroup>
                    )
                  })
                })()}
              </select>
              {selectedWorkshop && (() => {
                const ws = workshops.find(w => w.id === selectedWorkshop)
                return ws?.price ? (
                  <p className="mt-1.5 text-[12px] font-semibold text-[#1E4FD8]">
                    Harga: Rp {Number(ws.price).toLocaleString('id-ID')}
                  </p>
                ) : null
              })()}
            </div>
            <div className="grid gap-3 grid-cols-[1fr_auto]">
              <div>
                <label className={labelClass}>Tanggal Datang *</label>
                <input type="date" required value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className={inputClass} />
              </div>
              <div className="w-28">
                <label className={labelClass}>Jam *</label>
                <input type="time" required value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} className={inputClass} />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <div>
                <label className={labelClass}>Jenis Kendaraan *</label>
                <select required value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} className={inputClass}>
                  <option value="">Pilih</option>
                  <option value="Mobil">Mobil</option>
                  <option value="Motor">Motor</option>
                </select>
              </div>
              <div className="relative">
                <label className={labelClass}>Merek *</label>
                <input type="text" value={vehicleBrand}
                  onChange={e => setVehicleBrand(e.target.value)}
                  onFocus={() => setShowBrandSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowBrandSuggestions(false), 150)}
                  placeholder="Toyota, Honda..." className={inputClass} autoComplete="off" required />
                {showBrandSuggestions && brandSuggestions.filter(b => b.toLowerCase().includes(vehicleBrand.toLowerCase())).length > 0 && (
                  <div className="absolute z-20 top-full left-0 right-0 mt-0.5 rounded border border-[#e2e8f0] bg-white shadow-lg max-h-40 overflow-y-auto">
                    {brandSuggestions.filter(b => b.toLowerCase().includes(vehicleBrand.toLowerCase())).map(b => (
                      <button key={b} type="button" onMouseDown={() => { setVehicleBrand(b); setShowBrandSuggestions(false) }}
                        className="w-full text-left px-3 py-1.5 text-[12px] text-[#111] hover:bg-[#f8fafc]">{b}</button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className={labelClass}>Model Kendaraan *</label>
                <input type="text" required value={vehicleName} onChange={(e) => setVehicleName(e.target.value)} placeholder="Avanza, Jazz..." className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Plat Nomor</label>
                <input type="text" value={licensePlate} onChange={(e) => setLicensePlate(e.target.value)} placeholder="AB 1234 CD" className={inputClass} />
              </div>
            </div>
            {/* DP */}
            <div className="rounded border border-[#fef3c7] bg-[#fffbeb] p-3">
              <p className="text-[11px] font-semibold text-[#92400e] mb-2">💳 Down Payment (DP)</p>
              <div className="flex items-center gap-2">
                <span className="text-sm text-[#555] flex-shrink-0">Rp</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={dpAmount}
                  onChange={(e) => setDpAmount(cleanNumber(e.target.value))}
                  placeholder="0 (opsional)"
                  className="flex-1 rounded border border-[#cbd5e1] bg-white px-3 py-2 text-sm text-[#111] outline-none focus:border-[#1E4FD8] focus:ring-2 focus:ring-[#dbeafe] transition"
                />
              </div>
              {parseMoney(dpAmount) > 0 && (
                <p className="text-[11px] text-[#16a34a] mt-1.5 font-semibold">
                  DP: Rp {fmtRpInput(dpAmount)}
                </p>
              )}
            </div>

            <button type="submit" disabled={loading || !selectedWorkshop} className="w-full rounded bg-[#1E4FD8] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1A45BF] disabled:opacity-50 transition">
              {loading ? 'Menyimpan...' : 'Daftarkan Booking'}
            </button>
          </form>
        </div>
      )}

      {/* Daftar booking */}
      <div className="rounded-lg border border-[#e2e8f0] bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-[#f1f5f9] flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-bold text-[#111]">Daftar Booking ({filteredRegistrations.length})</p>
            <p className="mt-0.5 text-[11px] text-[#888]">
              Filter aktif: {MONTHS[monthFilter]} {yearFilter}. URL bisa dipanggil langsung dengan `?bulan={monthFilter + 1}&tahun={yearFilter}`.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select value={monthFilter} onChange={(e) => setMonthFilter(Number(e.target.value))} className="rounded border border-[#cbd5e1] bg-white px-3 py-2 text-[12px] text-[#111] outline-none focus:border-[#1E4FD8]">
              {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
            <select value={yearFilter} onChange={(e) => setYearFilter(Number(e.target.value))} className="rounded border border-[#cbd5e1] bg-white px-3 py-2 text-[12px] text-[#111] outline-none focus:border-[#1E4FD8]">
              {yearOptions.map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
            <button
              type="button"
              onClick={() => { const now = new Date(); setMonthFilter(now.getMonth()); setYearFilter(now.getFullYear()) }}
              className="rounded border border-[#e2e8f0] bg-white px-3 py-2 text-[12px] font-semibold text-[#555] hover:bg-[#f8fafc]"
            >
              Bulan Ini
            </button>
          </div>
        </div>

        {filteredRegistrations.length === 0 ? (
          <p className="px-5 py-10 text-center text-[12px] text-[#aaa]">Belum ada booking untuk {MONTHS[monthFilter]} {yearFilter}</p>
        ) : (
          <div className="divide-y divide-[#f1f5f9]">
            {filteredRegistrations.map((reg) => {
              const schedule = formatDateTime(reg.scheduledDate)
              const isEditing = editingId === reg.id
              const isCanceling = cancelingId === reg.id
              const sc = statusStyle(reg.status)

              return (
                <div key={reg.id} className="px-5 py-4">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <p className="text-sm font-bold text-[#111]">{reg.customer?.satuan} {reg.customer?.name}</p>
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold" style={{ background: sc.bg, color: sc.fg }}>
                          {reg.status || 'pending'}
                        </span>
                      </div>
                      <div className="grid gap-x-6 gap-y-0.5 text-[12px] text-[#666] sm:grid-cols-2 xl:grid-cols-4">
                        <p>📞 {reg.customer?.phone || '-'}</p>
                        <p>🔧 {reg.workshop?.title || '-'}</p>
                        <p>📅 {schedule.date}</p>
                        <p>🕐 {schedule.time}</p>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {reg.vehicleType && <span className="inline-block px-2 py-0.5 rounded bg-[#f1f5f9] text-[11px] text-[#555]">{reg.vehicleType}</span>}
                        {reg.vehicleName && <span className="inline-block px-2 py-0.5 rounded bg-[#f1f5f9] text-[11px] text-[#555]">{reg.vehicleName}</span>}
                        {reg.licensePlate && <span className="inline-block px-2 py-0.5 rounded bg-[#f1f5f9] text-[11px] font-semibold text-[#555]">{reg.licensePlate}</span>}
                        {parseDP(reg.notes) > 0 && (
                          <span className="inline-block px-2 py-0.5 rounded bg-[#fef3c7] text-[11px] font-semibold text-[#92400e]">DP Rp {fmtRpInput(parseDP(reg.notes))}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-1.5 flex-shrink-0">
                      {reg.status === 'cancelled' ? (
                        <button onClick={() => handleDeleteRegistration(reg.id)} className="px-3 py-1.5 rounded border border-[#fecaca] bg-[#fee2e2] text-[12px] text-[#dc2626] hover:bg-[#fecaca] transition">
                          Hapus
                        </button>
                      ) : (
                        <>
                          <button onClick={() => startEdit(reg)} className="px-3 py-1.5 rounded border border-[#e2e8f0] bg-white text-[12px] text-[#555] hover:bg-[#f8fafc] transition">
                            Edit
                          </button>
                          <button onClick={() => { setEditingId(null); setCancelingId(reg.id) }} className="px-3 py-1.5 rounded border border-[#fef3c7] bg-[#fef9c3] text-[12px] text-[#a16207] hover:bg-[#fef3c7] transition">
                            Batalkan
                          </button>
                          <button onClick={() => handleDeleteRegistration(reg.id)} className="px-3 py-1.5 rounded border border-[#fecaca] bg-[#fee2e2] text-[12px] text-[#dc2626] hover:bg-[#fecaca] transition">
                            Hapus
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Edit form */}
                  {isEditing && (
                    <div className="mt-4 rounded border border-[#e2e8f0] bg-[#f8fafc] p-4">
                      <p className="text-[12px] font-bold text-[#111] mb-3">Edit Booking</p>
                      {editError && <div className="mb-3 rounded border border-[#fecaca] bg-[#fee2e2] px-3 py-2 text-[12px] text-[#dc2626]">{editError}</div>}
                      <form onSubmit={handleEditSubmit} className="space-y-3">
                        <div className="grid gap-3 md:grid-cols-3">
                          <div>
                            <label className={labelClass}>Layanan</label>
                            <select value={editForm.workshopId} onChange={(e) => setEditForm({ ...editForm, workshopId: e.target.value })} className={inputClass}>
                              {workshops.map((w) => <option key={w.id} value={w.id}>{w.title}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className={labelClass}>Tanggal</label>
                            <input type="date" value={editForm.scheduledDate} onChange={(e) => setEditForm({ ...editForm, scheduledDate: e.target.value })} className={inputClass} />
                          </div>
                          <div>
                            <label className={labelClass}>Jam</label>
                            <input type="time" value={editForm.scheduledTime} onChange={(e) => setEditForm({ ...editForm, scheduledTime: e.target.value })} className={inputClass} />
                          </div>
                        </div>
                        <div className="grid gap-3 md:grid-cols-4">
                          <div>
                            <label className={labelClass}>Mobil / Motor</label>
                            <select value={editForm.vehicleType} onChange={(e) => setEditForm({ ...editForm, vehicleType: e.target.value })} className={inputClass}>
                              <option value="">Pilih</option>
                              <option value="Mobil">Mobil</option>
                              <option value="Motor">Motor</option>
                            </select>
                          </div>
                          <div className="relative">
                            <label className={labelClass}>Merek</label>
                            <input type="text" value={editForm.vehicleBrand}
                              onChange={e => setEditForm({ ...editForm, vehicleBrand: e.target.value })}
                              list="brand-list-edit" placeholder="Toyota..." className={inputClass} />
                            <datalist id="brand-list-edit">
                              {brandSuggestions.map(b => <option key={b} value={b} />)}
                            </datalist>
                          </div>
                          <div>
                            <label className={labelClass}>Model</label>
                            <input type="text" value={editForm.vehicleName} onChange={(e) => setEditForm({ ...editForm, vehicleName: e.target.value })} placeholder="Avanza..." className={inputClass} />
                          </div>
                          <div>
                            <label className={labelClass}>Plat Nomor</label>
                            <input type="text" value={editForm.licensePlate} onChange={(e) => setEditForm({ ...editForm, licensePlate: e.target.value })} placeholder="AB 1234 CD" className={inputClass} />
                          </div>
                        </div>
                        <div>
                          <label className={labelClass}>Catatan</label>
                          <input type="text" value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} placeholder="Catatan tambahan" className={inputClass} />
                        </div>
                        <div>
                          <label className={labelClass}>DP (Rp)</label>
                          <input type="text" inputMode="numeric" value={fmtRpInput(editForm.dpAmount)} onChange={(e) => setEditForm({ ...editForm, dpAmount: cleanNumber(e.target.value) })} placeholder="0" className={inputClass} />
                        </div>
                        <div className="flex gap-2">
                          <button type="submit" disabled={loading} className="px-4 py-2 rounded bg-[#1E4FD8] text-white text-sm font-semibold hover:bg-[#1A45BF] disabled:opacity-50 transition">
                            {loading ? 'Menyimpan...' : 'Simpan'}
                          </button>
                          <button type="button" onClick={() => setEditingId(null)} className="px-4 py-2 rounded border border-[#e2e8f0] bg-white text-sm text-[#555] hover:bg-[#f8fafc] transition">
                            Batal
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  {/* Cancel form */}
                  {isCanceling && (
                    <div className="mt-4 rounded border border-[#fecaca] bg-[#fff7f7] p-4">
                      <p className="text-[12px] font-bold text-[#dc2626] mb-3">Batalkan Booking</p>
                      {cancelError && <div className="mb-3 rounded border border-[#fecaca] bg-[#fee2e2] px-3 py-2 text-[12px] text-[#dc2626]">{cancelError}</div>}
                      <form onSubmit={handleCancelSubmit} className="space-y-3">
                        <div>
                          <label className={labelClass}>Alasan pembatalan</label>
                          <input type="text" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Masukkan alasan..." className={inputClass} />
                        </div>
                        <div className="flex gap-2">
                          <button type="submit" disabled={loading} className="px-4 py-2 rounded bg-[#dc2626] text-white text-sm font-semibold hover:bg-[#b91c1c] disabled:opacity-50 transition">
                            {loading ? 'Membatalkan...' : 'Konfirmasi Batal'}
                          </button>
                          <button type="button" onClick={() => setCancelingId(null)} className="px-4 py-2 rounded border border-[#fecaca] bg-white text-sm text-[#dc2626] hover:bg-[#fee2e2] transition">
                            Kembali
                          </button>
                        </div>
                      </form>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
