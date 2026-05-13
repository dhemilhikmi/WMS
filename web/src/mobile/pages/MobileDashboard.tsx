import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { registrationsAPI, inventoryAPI, teknisiAPI, serviceMaterialsAPI, tenantSettingsAPI } from '../../services/api'

const STATUS_LABEL: Record<string, string> = {
  pending: 'Menunggu',
  confirmed: 'Antri',
  in_progress: 'Proses',
  qc_check: 'QC',
  completed: 'Selesai',
  cancelled: 'Batal',
}
const STATUS_COLOR: Record<string, string> = {
  pending: '#f59e0b',
  confirmed: '#f59e0b',
  in_progress: '#1E4FD8',
  qc_check: '#8b5cf6',
  completed: '#16a34a',
  cancelled: '#94a3b8',
}

const fmtRp = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID')
const MONTH_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const DAY_NAMES = ['S', 'S', 'R', 'K', 'J', 'S', 'M']

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function parseTeknisiNames(notes?: string): string[] {
  const match = notes?.match(/^teknisi:([^|]+)/i)
  if (!match) return []
  return match[1].split(',').map(name => name.trim()).filter(Boolean)
}

function mapWithRank(
  map: Record<string, { active: number; today: number; month: number }>,
  minActive: number,
  minToday: number
) {
  return Object.fromEntries(Object.entries(map).map(([name, load]) => {
    const status = load.active === 0 ? 'available' : load.active === minActive && load.today === minToday ? 'light' : 'busy'
    return [name, { ...load, status }]
  })) as Record<string, { active: number; today: number; month: number; status: 'available' | 'light' | 'busy' }>
}

type TeknisiLoad = { active: number; today: number; month: number; status: 'available' | 'light' | 'busy' }
type StockShortage = { inventoryId: string; nama: string; satuan: string; stock: number; required: number; shortage: number }

export default function MobileDashboard() {
  const { tenant } = useAuth()
  const navigate = useNavigate()
  const [regs, setRegs] = useState<any[]>([])
  const [inv, setInv]   = useState<any[]>([])
  const [tek, setTek]   = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [setupCompleted, setSetupCompleted] = useState(5)
  const [setupDismissed, setSetupDismissed] = useState(true)
  const now = new Date()
  const [calYear, setCalYear] = useState(now.getFullYear())
  const [calMonth, setCalMonth] = useState(now.getMonth())
  const [selectedDate, setSelectedDate] = useState(now.getDate())
  const [receiveTarget, setReceiveTarget] = useState<any | null>(null)
  const [selectedTeknisi, setSelectedTeknisi] = useState<string[]>([])
  const [savingReceive, setSavingReceive] = useState(false)
  const [upcomingShortages, setUpcomingShortages] = useState<StockShortage[]>([])

  useEffect(() => {
    if (!tenant?.id) return
    setLoading(true)
    Promise.all([
      registrationsAPI.list(tenant.id).then(r => r.data.data || []).catch(() => []),
      inventoryAPI.list().then(r => r.data.data || []).catch(() => []),
      teknisiAPI.list('aktif').then(r => r.data.data || []).catch(() => []),
      serviceMaterialsAPI.upcomingShortages().then(r => r.data.data?.shortages || []).catch(() => []),
    ])
      .then(([r, i, t, shortages]) => { setRegs(r); setInv(i); setTek(t); setUpcomingShortages(shortages) })
      .finally(() => setLoading(false))
  }, [tenant?.id])

  useEffect(() => {
    if (!tenant?.id) return
    tenantSettingsAPI.get('hpp_setup_checklist')
      .then(res => {
        const d = res.data.data
        if (!d) { setSetupDismissed(false); setSetupCompleted(0); return }
        setSetupDismissed(!!d.dismissed)
        setSetupCompleted([d.step1_supplier, d.step2_po, d.step3_receive, d.step4_service, d.step5_bom].filter(Boolean).length)
      })
      .catch(() => { setSetupDismissed(false) })
  }, [tenant?.id])

  const today = new Date()
  const isSameDay = (d: Date) =>
    d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()
  const isSameMonth = (d: Date) =>
    d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()

  const todayJobs    = regs.filter(r => r.scheduledDate && isSameDay(new Date(r.scheduledDate)))
  const activeJobs   = regs.filter(r => ['confirmed', 'in_progress', 'qc_check'].includes(r.status))
  const monthIncome  = regs
    .filter(r => r.status === 'completed' && r.paymentStatus === 'LUNAS' && isSameMonth(new Date(r.updatedAt || r.createdAt)))
    .reduce((s, r) => s + (Number(r.workshop?.price) || 0), 0)
  const lowStock     = inv.filter(it => Number(it.stok) <= Number(it.stokMin))

  const scheduledRegs = useMemo(() => regs
    .filter(r => r.scheduledDate && r.status !== 'cancelled')
    .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime()), [regs])

  const selectedKey = dateKey(new Date(calYear, calMonth, selectedDate))
  const selectedDayJobs = scheduledRegs.filter(r => dateKey(new Date(r.scheduledDate)) === selectedKey)
  const upcomingJobs = scheduledRegs
    .filter(r => ['pending', 'confirmed'].includes(r.status))
    .filter(r => new Date(r.scheduledDate).getTime() >= new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime())
    .slice(0, 6)

  const teknisiLoad = useMemo(() => {
    const map: Record<string, { active: number; today: number; month: number }> = {}
    tek.forEach((t: any) => {
      map[t.name] = { active: 0, today: 0, month: 0 }
    })

    regs.forEach((r: any) => {
      const names = parseTeknisiNames(r.notes)
      if (names.length === 0) return
      const date = new Date(r.updatedAt || r.createdAt)
      const countedToday = isSameDay(date)
      const countedMonth = isSameMonth(date)

      names.forEach(name => {
        if (!map[name]) map[name] = { active: 0, today: 0, month: 0 }
        if (['in_progress', 'qc_check'].includes(r.status)) map[name].active += 1
        if (countedToday && ['in_progress', 'qc_check', 'completed'].includes(r.status)) map[name].today += 1
        if (countedMonth && r.status === 'completed') map[name].month += 1
      })
    })

    const values = Object.values(map)
    const minActive = values.length > 0 ? Math.min(...values.map(v => v.active)) : 0
    const minToday = values.length > 0 ? Math.min(...values.map(v => v.today)) : 0

    return mapWithRank(map, minActive, minToday)
  }, [regs, tek])

  const prevMonth = () => {
    if (calMonth === 0) {
      setCalYear(y => y - 1)
      setCalMonth(11)
    } else {
      setCalMonth(m => m - 1)
    }
    setSelectedDate(1)
  }

  const nextMonth = () => {
    if (calMonth === 11) {
      setCalYear(y => y + 1)
      setCalMonth(0)
    } else {
      setCalMonth(m => m + 1)
    }
    setSelectedDate(1)
  }

  const openReceive = (reg: any) => {
    setReceiveTarget(reg)
    setSelectedTeknisi([])
  }

  const toggleTeknisi = (name: string) => {
    setSelectedTeknisi(prev => prev.includes(name) ? prev.filter(t => t !== name) : [...prev, name])
  }

  const confirmReceive = async () => {
    if (!receiveTarget || selectedTeknisi.length === 0 || !tenant?.id) return
    setSavingReceive(true)
    try {
      const availabilityRes = await serviceMaterialsAPI.availability(receiveTarget.id)
      const availability = availabilityRes.data.data
      if (availability?.shortages?.length > 0) {
        alert('Stok belum cukup:\n' + availability.shortages.map((s: StockShortage) => `${s.nama}: kurang ${s.shortage.toLocaleString('id-ID')} ${s.satuan}`).join('\n'))
        return
      }
      await registrationsAPI.update(receiveTarget.id, {
        tenantId: tenant.id,
        status: 'in_progress',
        notes: `teknisi:${selectedTeknisi.join(',')}`,
      })
      setRegs(prev => prev.map(r => r.id === receiveTarget.id
        ? { ...r, status: 'in_progress', notes: `teknisi:${selectedTeknisi.join(',')}` }
        : r
      ))
      setReceiveTarget(null)
      setSelectedTeknisi([])
    } catch {
      alert('Gagal menerima customer')
    } finally {
      setSavingReceive(false)
    }
  }

  return (
    <div className="px-4 pt-3 space-y-4">
      {/* Setup HPP Banner */}
      {!setupDismissed && setupCompleted < 5 && (
        <div className="rounded-2xl border border-[#D9E3FC] bg-brand-50 px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-[#1A45BF]">Panduan setup belum selesai ({setupCompleted}/5)</p>
            <p className="text-[11px] text-[#3b82f6] mt-0.5">Selesaikan untuk aktifkan HPP FIFO otomatis</p>
          </div>
          <button
            onClick={() => navigate('/m/lainnya/panduan')}
            className="shrink-0 rounded-xl bg-brand px-3 py-1.5 text-[12px] font-semibold text-white"
          >
            Lanjutkan
          </button>
        </div>
      )}

      {/* Greeting */}
      <div>
        <p className="text-[12px] text-ink-4">Halo,</p>
        <p className="text-[18px] font-bold">{tenant?.name || 'Workshop'} 👋</p>
      </div>

      {/* KPI cards 2x2 */}
      <div className="grid grid-cols-2 gap-3">
        <KpiCard icon="📅" label="Booking hari ini" value={loading ? '—' : todayJobs.length.toString()} color="#1E4FD8" />
        <KpiCard icon="🔧" label="Sedang dikerjakan" value={loading ? '—' : activeJobs.length.toString()} color="#8b5cf6" />
        <KpiCard icon="💰" label="Pendapatan bulan ini" value={loading ? '—' : fmtRp(monthIncome)} color="#16a34a" small />
        <KpiCard icon="👨‍🔧" label="Teknisi aktif" value={loading ? '—' : tek.length.toString()} color="#f59e0b" />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Link to="/m/booking" className="bg-brand text-white rounded-2xl px-3 py-3 active:bg-[#1A45BF] shadow-sm">
          <p className="text-[13px] font-bold">Booking Baru</p>
          <p className="text-[10px] text-[#dbeafe] mt-0.5">Tambah customer terjadwal</p>
        </Link>
        <Link to="/m/layanan" className="bg-[#16a34a] text-white rounded-2xl px-3 py-3 active:bg-[#15803d] shadow-sm">
          <p className="text-[13px] font-bold">Layanan Aktif</p>
          <p className="text-[10px] text-[#dcfce7] mt-0.5">Kelola proses hari ini</p>
        </Link>
      </div>

      {/* Low stock alert */}
      {lowStock.length > 0 && (
        <Link to="/m/inventaris" className="block">
          <div className="bg-[#fef3c7] border border-[#fde68a] rounded-2xl p-4 active:bg-[#fde68a]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[13px] font-bold text-[#92400e]">⚠ {lowStock.length} stok menipis</p>
                <p className="text-[11px] text-[#a16207] mt-0.5 truncate">
                  {lowStock.slice(0, 3).map(it => it.nama).join(', ')}
                  {lowStock.length > 3 && ` +${lowStock.length - 3}`}
                </p>
              </div>
              <span className="text-[#92400e] text-[16px]">›</span>
            </div>
          </div>
        </Link>
      )}

      {upcomingShortages.length > 0 && (
        <Link to="/m/lainnya/po" className="block">
          <div className="bg-[#fef2f2] border border-[#fecaca] rounded-2xl p-4 active:bg-[#fee2e2]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-[#991b1b]">Material booking mendatang kurang</p>
                <p className="text-[11px] text-[#b91c1c] mt-0.5 truncate">
                  {upcomingShortages.slice(0, 3).map(it => `${it.nama} -${it.shortage.toLocaleString('id-ID')} ${it.satuan}`).join(', ')}
                  {upcomingShortages.length > 3 && ` +${upcomingShortages.length - 3}`}
                </p>
                <p className="mt-1 text-[10px] font-semibold text-[#991b1b]">Buat PO untuk pembelian material</p>
              </div>
              <span className="text-[#991b1b] text-[16px]">›</span>
            </div>
          </div>
        </Link>
      )}

      {/* Calendar and selected-date customers */}
      <div className="bg-white rounded-2xl border border-wm-line p-3.5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-[14px] font-bold">Kalender Booking</h2>
            <p className="text-[10px] text-ink-4">{MONTH_NAMES[calMonth]} {calYear}</p>
          </div>
          <div className="flex gap-1">
            <button onClick={prevMonth} className="h-8 w-8 rounded-full bg-wm-bg text-[16px] font-bold text-ink-3 active:bg-[#e2e8f0]">&lt;</button>
            <button onClick={nextMonth} className="h-8 w-8 rounded-full bg-wm-bg text-[16px] font-bold text-ink-3 active:bg-[#e2e8f0]">&gt;</button>
          </div>
        </div>

        <MobileCalendar
          year={calYear}
          month={calMonth}
          selectedDate={selectedDate}
          onSelect={setSelectedDate}
          regs={scheduledRegs}
        />

        <div className="mt-3 border-t border-[#f1f5f9] pt-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[12px] font-bold">Customer Tanggal {selectedDate}</p>
            <span className="text-[10px] text-ink-4">{selectedDayJobs.length} booking</span>
          </div>
          {selectedDayJobs.length === 0 ? (
            <p className="text-[12px] text-[#aaa] text-center py-4">Tidak ada booking pada tanggal ini</p>
          ) : (
            <div className="space-y-2">
              {selectedDayJobs.slice(0, 4).map(r => <ScheduleRow key={r.id} reg={r} onReceive={openReceive} />)}
            </div>
          )}
        </div>
      </div>

      {/* Upcoming customers */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[14px] font-bold">Customer Akan Datang</h2>
          <Link to="/m/booking" className="text-[12px] text-brand font-medium">Lihat semua</Link>
        </div>
        <div className="space-y-2">
          {loading && <p className="text-[12px] text-ink-4 py-3 text-center">Memuat...</p>}
          {!loading && upcomingJobs.length === 0 && (
            <div className="bg-white rounded-2xl border border-wm-line p-5 text-center">
              <p className="text-[12px] text-ink-4">Belum ada customer terjadwal</p>
            </div>
          )}
          {upcomingJobs.map(r => <ScheduleRow key={r.id} reg={r} showDate onReceive={openReceive} />)}
        </div>
      </div>

      {/* Active jobs preview */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[14px] font-bold">Layanan Berjalan</h2>
          <Link to="/m/layanan" className="text-[12px] text-brand font-medium">Lihat semua</Link>
        </div>
        <div className="space-y-2">
          {loading && <p className="text-[12px] text-ink-4 py-3 text-center">Memuat...</p>}
          {!loading && activeJobs.length === 0 && (
            <div className="bg-white rounded-2xl border border-wm-line p-5 text-center">
              <p className="text-[12px] text-ink-4">Tidak ada layanan aktif</p>
            </div>
          )}
          {activeJobs.slice(0, 4).map(r => (
            <div key={r.id} className="bg-white rounded-2xl border border-wm-line p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center text-[18px] flex-shrink-0">🚗</div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold truncate">{r.customer?.name || '—'}</p>
                <p className="text-[11px] text-ink-4 truncate">{r.licensePlate || '—'} · {r.workshop?.title || 'Layanan'}</p>
              </div>
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                style={{ background: STATUS_COLOR[r.status] + '22', color: STATUS_COLOR[r.status] }}
              >
                {STATUS_LABEL[r.status] || r.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Today's active services */}
      {false && todayJobs.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-[14px] font-bold">Layanan Berjalan</h2>
            <Link to="/m/booking" className="text-[12px] text-brand font-medium">Lihat semua</Link>
          </div>
          <div className="space-y-2">
            {todayJobs.slice(0, 5).map(r => (
              <div key={r.id} className="bg-white rounded-2xl border border-wm-line p-3">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold truncate">{r.customer?.name || '—'}</p>
                    <p className="text-[11px] text-ink-4">
                      {new Date(r.scheduledDate).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} · {r.workshop?.title || '—'}
                    </p>
                  </div>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{ background: STATUS_COLOR[r.status] + '22', color: STATUS_COLOR[r.status] }}
                  >
                    {STATUS_LABEL[r.status] || r.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {receiveTarget && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end" onClick={() => setReceiveTarget(null)}>
          <div className="bg-white w-full rounded-t-3xl p-5 pb-8 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-[#e2e8f0] rounded-full mx-auto mb-4" />
            <p className="text-[16px] font-bold text-center mb-1">Terima Customer</p>
            <p className="text-[12px] text-[#666] text-center mb-4">
              {receiveTarget.customer?.name || '-'} - {receiveTarget.workshop?.title || '-'}
            </p>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-semibold text-ink-3">Pilih Teknisi</p>
              <p className="text-[10px] text-ink-4">Beban kerja real-time</p>
            </div>
            <div className="space-y-2 mb-5">
              {tek.length === 0 && <p className="text-[12px] text-ink-4 text-center py-3">Belum ada teknisi aktif</p>}
              {[...tek].sort((a: any, b: any) => {
                const la = teknisiLoad[a.name] || { active: 0, today: 0, month: 0 }
                const lb = teknisiLoad[b.name] || { active: 0, today: 0, month: 0 }
                return la.active - lb.active || la.today - lb.today || la.month - lb.month || a.name.localeCompare(b.name)
              }).map((t: any) => (
                <button
                  key={t.id}
                  onClick={() => toggleTeknisi(t.name)}
                  className="w-full text-left rounded-xl border px-3 py-2.5"
                  style={selectedTeknisi.includes(t.name) ? { borderColor: '#1E4FD8', background: '#EEF3FE' } : { borderColor: '#e2e8f0' }}
                >
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 h-4 w-4 rounded border flex-shrink-0 flex items-center justify-center text-[10px]"
                      style={selectedTeknisi.includes(t.name) ? { background: '#1E4FD8', borderColor: '#1E4FD8', color: '#fff' } : { borderColor: '#cbd5e1' }}>
                      {selectedTeknisi.includes(t.name) ? '✓' : ''}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-ink">{t.name}</p>
                      {t.spesialis?.length > 0 && <p className="text-[10px] text-ink-4 mt-0.5">{t.spesialis.join(', ')}</p>}
                      <TeknisiLoadInfo load={teknisiLoad[t.name] || { active: 0, today: 0, month: 0, status: 'available' }} />
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setReceiveTarget(null)} className="flex-1 bg-wm-bg text-ink-3 text-[14px] font-semibold py-3 rounded-xl">Batal</button>
              <button onClick={confirmReceive} disabled={selectedTeknisi.length === 0 || savingReceive}
                className="flex-1 bg-brand text-white text-[14px] font-semibold py-3 rounded-xl disabled:opacity-40">
                {savingReceive ? 'Menyimpan...' : 'Mulai Proses'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TeknisiLoadInfo({ load }: { load: TeknisiLoad }) {
  const badge = load.status === 'available'
    ? { text: 'Available', bg: '#dcfce7', color: '#16a34a' }
    : load.status === 'light'
      ? { text: 'Kurang job', bg: '#EEF3FE', color: '#1E4FD8' }
      : { text: 'Sibuk', bg: '#fef3c7', color: '#b45309' }

  return (
    <div className="mt-1.5">
      <div className="mb-1 flex items-center gap-1.5">
        <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: badge.bg, color: badge.color }}>
          {badge.text}
        </span>
      </div>
      <div className="flex flex-wrap gap-1">
        <span className="rounded-full bg-wm-bg px-2 py-0.5 text-[10px] text-ink-3">{load.active} aktif</span>
        <span className="rounded-full bg-wm-bg px-2 py-0.5 text-[10px] text-ink-3">{load.today} hari ini</span>
        <span className="rounded-full bg-wm-bg px-2 py-0.5 text-[10px] text-ink-3">{load.month} bulan ini</span>
      </div>
    </div>
  )
}

function MobileCalendar({
  year,
  month,
  selectedDate,
  onSelect,
  regs,
}: {
  year: number
  month: number
  selectedDate: number
  onSelect: (date: number) => void
  regs: any[]
}) {
  const today = new Date()
  const firstDay = new Date(year, month, 1).getDay()
  const startOffset = (firstDay + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  const datesWithBookings = new Set(
    regs
      .filter(r => {
        const d = new Date(r.scheduledDate)
        return d.getFullYear() === year && d.getMonth() === month
      })
      .map(r => new Date(r.scheduledDate).getDate())
  )

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAY_NAMES.map((d, i) => (
          <div key={`${d}-${i}`} className="text-center text-[10px] font-semibold text-[#aaa] py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: startOffset }, (_, i) => <div key={`empty-${i}`} />)}
        {days.map(day => {
          const isSelected = day === selectedDate
          const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear()
          const hasBooking = datesWithBookings.has(day)
          return (
            <button
              key={day}
              onClick={() => onSelect(day)}
              className={`relative aspect-square rounded-xl text-[12px] font-semibold flex items-center justify-center ${
                isSelected
                  ? 'bg-brand text-white'
                  : isToday
                    ? 'bg-brand-50 text-brand'
                    : 'bg-wm-bg text-ink-3'
              }`}
            >
              {day}
              {hasBooking && (
                <span className={`absolute bottom-1 h-1.5 w-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-[#f59e0b]'}`} />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ScheduleRow({ reg, showDate, onReceive }: { reg: any; showDate?: boolean; onReceive?: (reg: any) => void }) {
  const d = new Date(reg.scheduledDate)
  return (
    <div className="bg-white rounded-2xl border border-wm-line p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold truncate">{reg.customer?.name || '-'}</p>
          <p className="text-[11px] text-ink-4 truncate">
            {showDate && `${d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })} `}
            {d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} - {reg.workshop?.title || '-'}
          </p>
          <p className="text-[10px] text-[#aaa] truncate">{reg.licensePlate || '-'} {reg.vehicleName ? `- ${reg.vehicleName}` : ''}</p>
        </div>
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
          style={{ background: STATUS_COLOR[reg.status] + '22', color: STATUS_COLOR[reg.status] || '#64748b' }}
        >
          {STATUS_LABEL[reg.status] || reg.status}
        </span>
      </div>
      {reg.status === 'confirmed' && onReceive && (
        <button onClick={() => onReceive(reg)} className="mt-3 w-full bg-brand text-white text-[12px] font-semibold py-2.5 rounded-xl">
          Terima Customer
        </button>
      )}
    </div>
  )
}

function KpiCard({ icon, label, value, color, small }: { icon: string; label: string; value: string; color: string; small?: boolean }) {
  return (
    <div className="bg-white rounded-2xl border border-wm-line p-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[16px]">{icon}</span>
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      </div>
      <p className={`font-bold ${small ? 'text-[14px]' : 'text-[20px]'}`} style={{ color }}>{value}</p>
      <p className="text-[10px] text-ink-4 mt-0.5 truncate">{label}</p>
    </div>
  )
}
