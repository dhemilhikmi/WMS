import { useEffect, useState, useCallback, useRef, useMemo, type ReactNode } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { registrationsAPI, customersAPI, workshopsAPI } from '../../services/api'

const STATUS_LABEL: Record<string, string> = {
  pending: 'Menunggu',
  confirmed: 'Antri',
  in_progress: 'Proses',
  qc_check: 'QC',
  completed: 'Selesai',
  cancelled: 'Batal',
}

const STATUS_COLOR: Record<string, string> = {
  pending: '#94a3b8',
  confirmed: '#f59e0b',
  in_progress: '#1E4FD8',
  qc_check: '#8b5cf6',
  completed: '#16a34a',
  cancelled: '#dc2626',
}

const blankForm = {
  customerId: '',
  workshopId: '',
  date: '',
  time: '',
  vehicleType: '',
  vehicleBrand: '',
  vehicleName: '',
  licensePlate: '',
  dpAmount: '',
  notes: '',
}

const blankCustomer = { satuan: 'Ibu', name: '', phone: '', address: '' }

const cleanNumber = (value: string) => value.replace(/[^\d]/g, '')
const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const fmtRpInput = (value: string | number) => {
  const n = Math.round(Number(cleanNumber(String(value || ''))))
  return n > 0 ? n.toLocaleString('id-ID', { maximumFractionDigits: 0 }) : ''
}
const parseMoney = (value: string | number) => Number(cleanNumber(String(value || ''))) || 0
const parseDP = (notes?: string) => Number(notes?.match(/(?:^|\|)dp:(\d+(?:\.\d+)?)/i)?.[1] || notes?.match(/DP:\s*Rp\s*([\d.]+)/i)?.[1]?.replace(/\./g, '') || 0)
const stripDP = (notes?: string) => String(notes || '').replace(/(?:^|\|)dp:\d+(?:\.\d+)?/i, '').replace(/^\|+|\|+$/g, '').trim()

function toDateInputValue(dateStr?: string) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function readMonthParam(value: string | null): number {
  const n = Number(value)
  return Number.isInteger(n) && n >= 1 && n <= 12 ? n - 1 : new Date().getMonth()
}

function readYearParam(value: string | null): number {
  const n = Number(value)
  return Number.isInteger(n) && n >= 2000 && n <= 2100 ? n : new Date().getFullYear()
}

export default function MobileBooking() {
  const { tenant } = useAuth()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [regs, setRegs] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [services, setServices] = useState<any[]>([])
  const [brandSuggestions, setBrandSuggestions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('')
  const [monthFilter, setMonthFilter] = useState(() => readMonthParam(searchParams.get('bulan')))
  const [yearFilter, setYearFilter] = useState(() => readYearParam(searchParams.get('tahun')))
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [showForm, setShowForm] = useState(false)
  const [useNewCustomer, setUseNewCustomer] = useState(false)
  const [newCustomer, setNewCustomer] = useState(blankCustomer)
  const [form, setForm] = useState(blankForm)
  const [msg, setMsg] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerMsg, setCustomerMsg] = useState('')
  const [customerMatches, setCustomerMatches] = useState<any[]>([])
  const [foundCustomer, setFoundCustomer] = useState<any | null>(null)
  const [editing, setEditing] = useState<any | null>(null)
  const [canceling, setCanceling] = useState<any | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const openedFromCustomerRef = useRef(false)

  const fetchData = useCallback(async () => {
    if (!tenant?.id) return
    setLoading(true)
    try {
      const [r, c, s] = await Promise.all([
        registrationsAPI.list(tenant.id).then(x => x.data.data || []).catch(() => []),
        customersAPI.list(tenant.id).then(x => x.data.data || []).catch(() => []),
        workshopsAPI.list(tenant.id).then(x => x.data.data || []).catch(() => []),
      ])
      setRegs(r)
      setCustomers(c)
      setServices(s)
      setBrandSuggestions([...new Set(r.map((x: any) => x.vehicleBrand).filter(Boolean))].sort() as string[])
    } finally {
      setLoading(false)
    }
  }, [tenant?.id])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    const next = new URLSearchParams(searchParams)
    next.set('bulan', String(monthFilter + 1))
    next.set('tahun', String(yearFilter))
    setSearchParams(next, { replace: true })
  }, [monthFilter, yearFilter])

  useEffect(() => {
    const state = location.state as { openBookingForm?: boolean; customerId?: string; customer?: any } | null
    if (!state?.openBookingForm || openedFromCustomerRef.current) return
    openedFromCustomerRef.current = true

    const customer = state.customerId
      ? customers.find(c => c.id === state.customerId) || state.customer
      : state.customer

    setShowForm(true)
    setUseNewCustomer(false)
    if (customer?.id) setForm(prev => ({ ...prev, customerId: customer.id }))
    if (customer) {
      setFoundCustomer(customer)
      setCustomerSearch(`${customer.name || ''}${customer.phone ? ' - ' + customer.phone : ''}`.trim())
      setCustomerMsg('Pelanggan baru siap dibuatkan booking.')
    }
  }, [customers, location.state])

  const yearOptions = useMemo(() => {
    const years = new Set<number>([new Date().getFullYear(), yearFilter])
    regs.forEach((r) => {
      const d = new Date(r.scheduledDate || r.createdAt)
      if (!Number.isNaN(d.getTime())) years.add(d.getFullYear())
    })
    return Array.from(years).sort((a, b) => b - a)
  }, [regs, yearFilter])

  const periodRegs = useMemo(() => regs.filter((r) => {
    const d = new Date(r.scheduledDate || r.createdAt)
    return d.getMonth() === monthFilter && d.getFullYear() === yearFilter
  }), [regs, monthFilter, yearFilter])

  const totalActive = useMemo(() => periodRegs.filter(r => r.status !== 'cancelled').length, [periodRegs])
  const totalCancelled = useMemo(() => periodRegs.filter(r => r.status === 'cancelled').length, [periodRegs])

  const serviceOptions = useMemo(() => {
    const parents = services.filter(s => s.type === 'main_service')
    const subs = services.filter(s => s.type === 'sub_service')
    if (parents.length === 0) return services.map(toServiceOption)

    return parents.flatMap(parent => {
      const children = subs.filter(s => s.parentId === parent.id)
      if (children.length === 0) return [toServiceOption(parent)]
      return children.map((child: any) => ({
        id: child.id,
        label: child.title,
        sublabel: `${parent.title} - Rp ${Number(child.price || 0).toLocaleString('id-ID')}`,
      }))
    })
  }, [services])

  const filtered = periodRegs
    .filter(r => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false
      if (dateFilter && toDateInputValue(r.scheduledDate || r.createdAt) !== dateFilter) return false
      if (!search) return true
      const q = search.toLowerCase()
      return (r.customer?.name || '').toLowerCase().includes(q) ||
        (r.customer?.phone || '').toLowerCase().includes(q) ||
        (r.licensePlate || '').toLowerCase().includes(q) ||
        (r.vehicleName || '').toLowerCase().includes(q) ||
        (r.workshop?.title || '').toLowerCase().includes(q)
    })
    .sort((a, b) => {
      const diff = new Date(a.scheduledDate || a.createdAt).getTime() - new Date(b.scheduledDate || b.createdAt).getTime()
      return sortDir === 'asc' ? diff : -diff
    })

  const resetForm = () => {
    setForm(blankForm)
    setNewCustomer(blankCustomer)
    setUseNewCustomer(false)
    setMsg('')
    setCustomerMsg('')
    setCustomerSearch('')
    setCustomerMatches([])
    setFoundCustomer(null)
    setEditing(null)
  }

  const searchCustomer = async () => {
    if (!tenant?.id || !customerSearch.trim()) {
      setCustomerMsg('Masukkan nama atau nomor HP')
      return
    }
    setSaving(true)
    setCustomerMsg('')
    setCustomerMatches([])
    setFoundCustomer(null)
    try {
      const q = customerSearch.trim().toLowerCase()
      const localMatches = customers.filter(c =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q)
      )
      if (localMatches.length === 1) {
        const c = localMatches[0]
        setFoundCustomer(c)
        setForm(prev => ({ ...prev, customerId: c.id }))
      } else if (localMatches.length > 1) {
        setCustomerMatches(localMatches.slice(0, 8))
      } else {
        const res = await customersAPI.getByPhone(customerSearch.trim(), tenant.id)
        if (res.status === 404 || !res.data?.data) {
          setCustomerMsg('Pelanggan tidak ditemukan. Pilih Pelanggan Baru untuk menambahkan.')
          return
        }
        const c = res.data.data
        setFoundCustomer(c)
        setForm(prev => ({ ...prev, customerId: c.id }))
      }
    } catch (e: any) {
      setCustomerMsg(e.response?.data?.message || 'Gagal mencari pelanggan')
    } finally {
      setSaving(false)
    }
  }

  const scheduledIso = () => {
    if (!form.date) return new Date().toISOString()
    const dt = new Date(`${form.date}T${form.time || '09:00'}:00`)
    return isNaN(dt.getTime()) ? new Date().toISOString() : dt.toISOString()
  }

  const handleSubmit = async () => {
    if (!tenant?.id) return
    if (!form.workshopId) { setMsg('Pilih layanan'); return }
    if (!form.date) { setMsg('Tanggal datang wajib diisi'); return }
    if (!form.time) { setMsg('Jam datang wajib diisi'); return }
    if (!form.vehicleType) { setMsg('Jenis kendaraan wajib dipilih'); return }
    if (!form.vehicleBrand.trim()) { setMsg('Merek kendaraan wajib diisi'); return }
    if (!form.vehicleName.trim()) { setMsg('Model kendaraan wajib diisi'); return }
    setSaving(true)
    setMsg('')
    try {
      let customerId = form.customerId
      if (useNewCustomer) {
        if (!newCustomer.name || !newCustomer.phone) {
          setMsg('Nama & no HP wajib')
          setSaving(false)
          return
        }
        const c = await customersAPI.create({ ...newCustomer, tenantId: tenant.id })
        customerId = c.data.data.id
      }
      if (!customerId) {
        setMsg('Pilih atau buat pelanggan')
        setSaving(false)
        return
      }

      const dpValue = parseMoney(form.dpAmount)
      const dpNote = dpValue > 0 ? `dp:${dpValue}` : undefined
      const payload = {
        customerId,
        workshopId: form.workshopId,
        tenantId: tenant.id,
        scheduledDate: scheduledIso(),
        vehicleType: form.vehicleType || undefined,
        vehicleBrand: form.vehicleBrand || undefined,
        vehicleName: form.vehicleName || undefined,
        licensePlate: form.licensePlate || undefined,
        notes: [stripDP(form.notes), dpNote].filter(Boolean).join('|') || undefined,
      }

      if (editing) await registrationsAPI.update(editing.id, payload)
      else await registrationsAPI.create(payload)

      setShowForm(false)
      resetForm()
      fetchData()
    } catch (e: any) {
      setMsg(e.response?.data?.message || 'Gagal menyimpan booking')
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (r: any) => {
    const d = r.scheduledDate ? new Date(r.scheduledDate) : null
    setEditing(r)
    setUseNewCustomer(false)
    setForm({
      customerId: r.customerId || r.customer?.id || '',
      workshopId: r.workshopId || r.workshop?.id || '',
      date: d ? d.toISOString().slice(0, 10) : '',
      time: d ? d.toTimeString().slice(0, 5) : '',
      vehicleType: r.vehicleType || '',
      vehicleBrand: r.vehicleBrand || '',
      vehicleName: r.vehicleName || '',
      licensePlate: r.licensePlate || '',
      dpAmount: parseDP(r.notes) ? String(parseDP(r.notes)) : '',
      notes: stripDP(r.notes),
    })
    setMsg('')
    setShowForm(true)
  }

  const cancelBooking = async () => {
    if (!tenant?.id || !canceling) return
    setSaving(true)
    try {
      await registrationsAPI.update(canceling.id, { tenantId: tenant.id, status: 'cancelled', notes: cancelReason || undefined })
      setCanceling(null)
      setCancelReason('')
      fetchData()
    } catch (e: any) {
      alert(e.response?.data?.message || 'Gagal membatalkan booking')
    } finally {
      setSaving(false)
    }
  }

  const deleteBooking = async (r: any) => {
    if (!tenant?.id) return
    if (!confirm(`Hapus booking ${r.customer?.name || ''}?`)) return
    setSaving(true)
    try {
      await registrationsAPI.delete(r.id, tenant.id)
      fetchData()
    } catch (e: any) {
      alert(e.response?.data?.message || 'Gagal menghapus booking')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="px-4 pt-3 space-y-3 pb-4">
      <div className="grid grid-cols-3 gap-2">
        <MiniStat label="Total" value={periodRegs.length.toString()} />
        <MiniStat label="Aktif" value={totalActive.toString()} tone="#1E4FD8" />
        <MiniStat label="Batal" value={totalCancelled.toString()} tone="#dc2626" />
      </div>

      <div className="relative">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cari nama, HP, plat, layanan..."
          className="w-full bg-white border border-wm-line rounded-2xl pl-3 pr-3 py-2.5 text-[13px] outline-none focus:border-[#1E4FD8]"
        />
      </div>

      <div className="space-y-2 rounded-2xl border border-wm-line bg-white p-3">
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <select
            value={monthFilter}
            onChange={e => setMonthFilter(Number(e.target.value))}
            className="rounded-xl border border-wm-line bg-white px-3 py-2 text-[12px] outline-none focus:border-[#1E4FD8]"
          >
            {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
          <select
            value={yearFilter}
            onChange={e => setYearFilter(Number(e.target.value))}
            className="rounded-xl border border-wm-line bg-white px-3 py-2 text-[12px] outline-none focus:border-[#1E4FD8]"
          >
            {yearOptions.map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
        </div>
        <p className="text-[10px] text-ink-4">
          Link langsung: /m/booking?bulan={monthFilter + 1}&tahun={yearFilter}
        </p>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="min-w-0 rounded-xl border border-wm-line bg-white px-3 py-2 text-[12px] outline-none focus:border-[#1E4FD8]"
          >
            <option value="all">Semua Status</option>
            <option value="pending">Menunggu</option>
            <option value="confirmed">Antri</option>
            <option value="in_progress">Proses</option>
            <option value="qc_check">QC</option>
            <option value="completed">Selesai</option>
            <option value="cancelled">Batal</option>
          </select>
          <input
            type="date"
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            className="min-w-0 rounded-xl border border-wm-line bg-white px-3 py-2 text-[12px] outline-none focus:border-[#1E4FD8]"
            style={{ WebkitAppearance: 'none' }}
          />
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <select
            value={sortDir}
            onChange={e => setSortDir(e.target.value as 'asc' | 'desc')}
            className="min-w-0 rounded-xl border border-wm-line bg-white px-3 py-2 text-[12px] outline-none focus:border-[#1E4FD8]"
          >
            <option value="desc">Terbaru</option>
            <option value="asc">Terlama</option>
          </select>
          <button
            onClick={() => { setStatusFilter('all'); setDateFilter(''); setSearch('') }}
            disabled={statusFilter === 'all' && !dateFilter && !search}
            className="rounded-xl bg-wm-bg px-3 py-2 text-[12px] font-semibold text-ink-3 disabled:opacity-40"
          >
            Reset
          </button>
        </div>
      </div>

      {loading && <p className="text-center text-[12px] text-ink-4 py-6">Memuat...</p>}
      {!loading && filtered.length === 0 && (
        <div className="bg-white rounded-2xl border border-wm-line p-8 text-center">
          <p className="text-[13px] text-[#666]">Belum ada booking</p>
          <p className="text-[11px] text-[#aaa] mt-1">Tap tombol + di kanan bawah</p>
        </div>
      )}

      <div className="space-y-2.5">
        {filtered.map(r => (
          <div key={r.id} className="bg-white rounded-2xl border border-wm-line p-3.5">
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <p className="text-[14px] font-bold truncate">{r.customer?.satuan ? `${r.customer.satuan} ` : ''}{r.customer?.name || '-'}</p>
              <span
                className="text-[9px] font-bold px-2 py-1 rounded-full flex-shrink-0"
                style={{ background: (STATUS_COLOR[r.status] || '#94a3b8') + '22', color: STATUS_COLOR[r.status] || '#94a3b8' }}
              >
                {STATUS_LABEL[r.status] || r.status}
              </span>
            </div>
            <p className="text-[12px] text-ink-3 truncate">HP: {r.customer?.phone || '-'}</p>
            <p className="text-[12px] text-ink-3 truncate">Kendaraan: {r.licensePlate || '-'} - {r.vehicleName || '-'}</p>
            <p className="text-[12px] text-ink-3 truncate">Layanan: {r.workshop?.title || '-'}</p>
            <p className="text-[11px] text-ink-4 mt-1.5">
              {r.scheduledDate ? new Date(r.scheduledDate).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'}
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {r.vehicleType && <span className="px-2 py-0.5 rounded-full bg-wm-bg text-[10px] text-ink-3">{r.vehicleType}</span>}
              {parseDP(r.notes) > 0 && <span className="px-2 py-0.5 rounded-full bg-[#fffbeb] text-[10px] font-semibold text-[#92400e]">DP Rp {fmtRpInput(parseDP(r.notes))}</span>}
            </div>
            <div className="flex gap-2 mt-3">
              {r.status !== 'cancelled' && <button onClick={() => startEdit(r)} className="flex-1 bg-brand-50 text-brand text-[12px] font-semibold py-2 rounded-xl">Edit</button>}
              {r.status !== 'cancelled' && <button onClick={() => setCanceling(r)} className="flex-1 bg-[#fffbeb] text-[#a16207] text-[12px] font-semibold py-2 rounded-xl">Batalkan</button>}
              <button onClick={() => deleteBooking(r)} className="flex-1 bg-[#fef2f2] text-[#dc2626] text-[12px] font-semibold py-2 rounded-xl">Hapus</button>
            </div>
          </div>
        ))}
      </div>

      <button onClick={() => { resetForm(); setShowForm(true) }} className="mobile-fab active:bg-[#1A45BF]">+</button>

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end" onClick={() => { setShowForm(false); resetForm() }}>
          <div className="bg-white w-full rounded-t-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white px-5 pt-4 pb-3 border-b border-wm-line z-10">
              <div className="w-10 h-1 bg-[#e2e8f0] rounded-full mx-auto mb-3" />
              <div className="flex items-center justify-between">
                <p className="text-[16px] font-bold">{editing ? 'Edit Booking' : 'Booking Baru'}</p>
                <button onClick={() => { setShowForm(false); resetForm() }} className="text-[20px] text-ink-4">x</button>
              </div>
            </div>

            <div className="px-5 py-4 space-y-3.5 pb-8">
              {!editing && (
                <div className="flex gap-2">
                  <button onClick={() => setUseNewCustomer(false)} className={`flex-1 text-[12px] font-semibold py-2 rounded-xl ${!useNewCustomer ? 'bg-brand text-white' : 'bg-wm-bg text-ink-3'}`}>
                    Pelanggan Lama
                  </button>
                  <button onClick={() => setUseNewCustomer(true)} className={`flex-1 text-[12px] font-semibold py-2 rounded-xl ${useNewCustomer ? 'bg-brand text-white' : 'bg-wm-bg text-ink-3'}`}>
                    Pelanggan Baru
                  </button>
                </div>
              )}

              {useNewCustomer ? (
                <>
                  <Field label="Sapaan">
                    <select value={newCustomer.satuan} onChange={e => setNewCustomer({ ...newCustomer, satuan: e.target.value })} className={inputCls}>
                      <option value="Bapak">Bapak</option>
                      <option value="Ibu">Ibu</option>
                    </select>
                  </Field>
                  <Field label="Nama">
                    <input value={newCustomer.name} onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })} className={inputCls} placeholder="Nama lengkap" />
                  </Field>
                  <Field label="No HP">
                    <input value={newCustomer.phone} onChange={e => setNewCustomer({ ...newCustomer, phone: e.target.value })} className={inputCls} placeholder="08..." />
                  </Field>
                  <Field label="Alamat">
                    <input value={newCustomer.address} onChange={e => setNewCustomer({ ...newCustomer, address: e.target.value })} className={inputCls} placeholder="Alamat" />
                  </Field>
                </>
              ) : (
                <>
                  {!editing && (
                    <Field label="Cari Nama / No HP">
                      <div className="flex gap-2">
                        <input value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} className={inputCls} placeholder="Nama atau 0812..." />
                        <button onClick={searchCustomer} disabled={saving} className="px-3 rounded-xl bg-brand text-white text-[12px] font-semibold disabled:opacity-50">Cari</button>
                      </div>
                      {customerMsg && <p className="text-[11px] text-[#dc2626] mt-1">{customerMsg}</p>}
                      {foundCustomer && <p className="text-[11px] text-brand mt-1 font-semibold">{foundCustomer.satuan} {foundCustomer.name} ditemukan</p>}
                      {customerMatches.length > 0 && (
                        <div className="mt-2 space-y-1.5">
                          {customerMatches.map(c => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                setFoundCustomer(c)
                                setForm(prev => ({ ...prev, customerId: c.id }))
                                setCustomerSearch(c.phone || c.name)
                                setCustomerMatches([])
                              }}
                              className="w-full rounded-xl bg-white border border-wm-line px-3 py-2 text-left"
                            >
                              <p className="text-[12px] font-semibold text-ink truncate">{c.satuan ? `${c.satuan} ` : ''}{c.name}</p>
                              <p className="text-[10px] text-ink-3 truncate">{[c.phone, c.address].filter(Boolean).join(' - ')}</p>
                            </button>
                          ))}
                        </div>
                      )}
                    </Field>
                  )}
                  <Field label="Pelanggan">
                    <SearchSelect
                      options={customers.map(c => ({
                        id: c.id,
                        label: `${c.satuan ? c.satuan + ' ' : ''}${c.name}`,
                        sublabel: [c.phone, c.address].filter(Boolean).join(' - '),
                      }))}
                      value={form.customerId}
                      onChange={id => setForm({ ...form, customerId: id })}
                      placeholder="Pilih pelanggan..."
                      searchPlaceholder="Cari nama / no HP / alamat..."
                    />
                  </Field>
                </>
              )}

              <Field label="Layanan">
                <SearchSelect
                  options={serviceOptions}
                  value={form.workshopId}
                  onChange={id => setForm({ ...form, workshopId: id })}
                  placeholder="Pilih layanan..."
                  searchPlaceholder="Cari layanan..."
                />
                {form.workshopId && (
                  <p className="mt-1 text-[11px] font-semibold text-brand">
                    Harga: Rp {Number(services.find(s => s.id === form.workshopId)?.price || 0).toLocaleString('id-ID')}
                  </p>
                )}
              </Field>

              <div className="grid grid-cols-2 gap-2.5">
                <Field label="Tanggal Datang *">
                  <input type="date" required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className={inputCls} style={{ minWidth: 0, WebkitAppearance: 'none' }} />
                </Field>
                <Field label="Jam *">
                  <input type="time" required value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} className={inputCls} style={{ minWidth: 0, WebkitAppearance: 'none' }} />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <Field label="Jenis Kendaraan *">
                  <select required value={form.vehicleType} onChange={e => setForm({ ...form, vehicleType: e.target.value })} className={inputCls}>
                    <option value="">Pilih</option>
                    <option value="Mobil">Mobil</option>
                    <option value="Motor">Motor</option>
                  </select>
                </Field>
                <Field label="Merek *">
                  <input required value={form.vehicleBrand} onChange={e => setForm({ ...form, vehicleBrand: e.target.value })} list="mobile-brand-list" className={inputCls} placeholder="Toyota" />
                  <datalist id="mobile-brand-list">{brandSuggestions.map(b => <option key={b} value={b} />)}</datalist>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <Field label="Model *">
                  <input required value={form.vehicleName} onChange={e => setForm({ ...form, vehicleName: e.target.value })} className={inputCls} placeholder="Avanza" />
                </Field>
                <Field label="Plat Nomor">
                  <input value={form.licensePlate} onChange={e => setForm({ ...form, licensePlate: e.target.value })} className={inputCls} placeholder="B 1234 ABC" />
                </Field>
              </div>

              <div className="rounded-xl border border-[#fef3c7] bg-[#fffbeb] p-3">
                <Field label="Down Payment (DP)">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] text-[#92400e] font-semibold">Rp</span>
                    <input type="text" inputMode="numeric" value={fmtRpInput(form.dpAmount)} onChange={e => setForm({ ...form, dpAmount: cleanNumber(e.target.value) })} className="flex-1 bg-white border border-[#fde68a] rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-[#f59e0b]" placeholder="0 (opsional)" />
                  </div>
                  {parseMoney(form.dpAmount) > 0 && <p className="text-[11px] text-[#16a34a] mt-1 font-semibold">DP: Rp {fmtRpInput(form.dpAmount)}</p>}
                </Field>
              </div>

              <Field label="Catatan">
                <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className={inputCls} placeholder="Catatan tambahan" />
              </Field>

              {msg && <p className="text-[12px] text-[#dc2626]">{msg}</p>}

              <button onClick={handleSubmit} disabled={saving || !form.workshopId} className="w-full bg-brand text-white text-[14px] font-semibold py-3 rounded-xl active:bg-[#1A45BF] disabled:opacity-50">
                {saving ? 'Menyimpan...' : editing ? 'Simpan Perubahan' : 'Daftarkan Booking'}
              </button>
            </div>
          </div>
        </div>
      )}

      {canceling && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end" onClick={() => setCanceling(null)}>
          <div className="bg-white w-full rounded-t-3xl p-5 pb-8" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-[#e2e8f0] rounded-full mx-auto mb-4" />
            <p className="text-[16px] font-bold text-center mb-1">Batalkan Booking</p>
            <p className="text-[12px] text-[#666] text-center mb-4">{canceling.customer?.name || '-'} - {canceling.workshop?.title || '-'}</p>
            <Field label="Alasan pembatalan">
              <input value={cancelReason} onChange={e => setCancelReason(e.target.value)} className={inputCls} placeholder="Masukkan alasan..." />
            </Field>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setCanceling(null)} className="flex-1 bg-wm-bg text-ink-3 text-[14px] font-semibold py-3 rounded-xl">Kembali</button>
              <button onClick={cancelBooking} disabled={saving} className="flex-1 bg-[#dc2626] text-white text-[14px] font-semibold py-3 rounded-xl disabled:opacity-50">
                {saving ? 'Memproses...' : 'Konfirmasi Batal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const inputCls = 'w-full bg-wm-bg border border-wm-line rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-[#1E4FD8] focus:bg-white'

function MiniStat({ label, value, tone = '#111827' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-wm-line p-3">
      <p className="text-[10px] text-ink-3">{label}</p>
      <p className="text-[20px] font-bold mt-0.5" style={{ color: tone }}>{value}</p>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-[#666] mb-1">{label}</label>
      {children}
    </div>
  )
}

interface SearchOption {
  id: string
  label: string
  sublabel?: string
}

function toServiceOption(service: any): SearchOption {
  return {
    id: service.id,
    label: service.title,
    sublabel: `Rp ${Number(service.price || 0).toLocaleString('id-ID')}`,
  }
}

function SearchSelect({
  options,
  value,
  onChange,
  placeholder = 'Pilih...',
  searchPlaceholder = 'Cari...',
}: {
  options: SearchOption[]
  value: string
  onChange: (id: string) => void
  placeholder?: string
  searchPlaceholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement | null>(null)
  const selected = options.find(o => o.id === value)

  const filtered = useMemo(() => {
    if (!query.trim()) return options
    const q = query.toLowerCase()
    return options.filter(o => o.label.toLowerCase().includes(q) || (o.sublabel || '').toLowerCase().includes(q))
  }, [options, query])

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const pick = (id: string) => {
    onChange(id)
    setOpen(false)
    setQuery('')
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full bg-wm-bg border border-wm-line rounded-xl pl-3 pr-9 py-2.5 text-[13px] text-left flex items-center justify-between active:bg-white"
        style={{ minWidth: 0 }}
      >
        <span className={`truncate ${selected ? 'text-ink' : 'text-[#aaa]'}`}>
          {selected ? (selected.sublabel ? `${selected.label} - ${selected.sublabel}` : selected.label) : placeholder}
        </span>
        <span className="text-ink-4 text-[10px] flex-shrink-0 ml-2">v</span>
      </button>

      {open && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-wm-line rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-[#f1f5f9] sticky top-0 bg-white">
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              autoFocus
              className="w-full bg-wm-bg border border-wm-line rounded-lg px-2 py-1.5 text-[12px] outline-none focus:border-[#1E4FD8]"
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-3 text-[12px] text-ink-4 text-center">Tidak ditemukan</p>
            ) : (
              filtered.map(o => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => pick(o.id)}
                  className={`w-full text-left px-3 py-2.5 border-b border-[#f8fafc] active:bg-brand-50 ${o.id === value ? 'bg-brand-50' : 'bg-white'}`}
                >
                  <p className="text-[13px] font-semibold text-ink truncate">{o.label}</p>
                  {o.sublabel && <p className="text-[11px] text-[#777] truncate mt-0.5">{o.sublabel}</p>}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
