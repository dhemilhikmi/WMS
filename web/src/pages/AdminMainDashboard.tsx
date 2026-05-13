import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { registrationsAPI, tenantSettingsAPI, teknisiAPI, inventoryAPI, serviceMaterialsAPI } from '../services/api'

type KanbanStatus = 'ANTRI' | 'PROSES' | 'QC' | 'SELESAI'

interface KanbanItem {
  id: string          // registration id dari DB
  label: string
  status: KanbanStatus
  teknisi: string[]
  scheduledDate?: string
  vehicleName?: string
  licensePlate?: string
}

interface Teknisi { id: string; name: string; spesialis: string[] }
type TeknisiLoad = { activeJobs: number; jobsToday: number; jobsMonth: number; status: 'available' | 'light' | 'busy' }

interface BookingEvent {
  date: number
  time: string
  customer: string
  layanan: string
  status: KanbanStatus
  regId: string
}

interface MaterialDeduction {
  nama: string
  qty: number
}

interface StockShortage {
  inventoryId: string
  nama: string
  satuan: string
  stock: number
  required: number
  shortage: number
  jobs?: { customer: string; service: string; scheduledDate?: string | null; required: number }[]
}

// ── Status mapping DB ↔ Kanban ──────────────────────────────────────────────
const DB_TO_KANBAN: Record<string, KanbanStatus> = {
  confirmed:   'ANTRI',
  in_progress: 'PROSES',
  qc_check:    'QC',
  completed:   'SELESAI',
}
const KANBAN_TO_DB: Record<KanbanStatus, string> = {
  ANTRI:   'confirmed',
  PROSES:  'in_progress',
  QC:      'qc_check',
  SELESAI: 'completed',
}


const COLUMN_CONFIG: Record<KanbanStatus, { color: string; next?: KanbanStatus; nextLabel?: string }> = {
  ANTRI:   { color: '#f59e0b', next: 'PROSES',  nextLabel: 'Customer Tiba' },
  PROSES:  { color: '#1E4FD8', next: 'QC',      nextLabel: 'Selesai Proses' },
  QC:      { color: '#8b5cf6', next: 'SELESAI', nextLabel: 'Approve QC' },
  SELESAI: { color: '#16a34a' },
}

const COLUMNS: KanbanStatus[] = ['ANTRI', 'PROSES', 'QC', 'SELESAI']
const COLUMN_LABEL: Record<KanbanStatus, string> = {
  ANTRI:   'Akan Datang',
  PROSES:  'Proses',
  QC:      'QC',
  SELESAI: 'Selesai',
}
const DAY_NAMES   = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
const MONTH_NAMES = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']

function parseTeknisiNames(notes?: string): string[] {
  const m = notes?.match(/^teknisi:([^|]+)/)
  if (!m) return []
  return m[1].split(',').map(n => n.trim()).filter(Boolean)
}

function teknisiLoadStyle(load: TeknisiLoad) {
  if (load.status === 'available') return { text: 'Available', bg: '#dcfce7', color: '#16a34a' }
  if (load.status === 'light') return { text: 'Kurang job', bg: '#EEF3FE', color: '#1E4FD8' }
  return { text: 'Sibuk', bg: '#fef3c7', color: '#b45309' }
}

function TeknisiLoadBadge({ load }: { load: TeknisiLoad }) {
  const badge = teknisiLoadStyle(load)
  return (
    <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: badge.bg, color: badge.color }}>
      {badge.text}
    </span>
  )
}

function TeknisiLoadMeta({ load }: { load: TeknisiLoad }) {
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      <span className="rounded-full bg-[#f8fafc] px-2 py-0.5 text-[10px] text-[#64748b]">{load.activeJobs} aktif</span>
      <span className="rounded-full bg-[#f8fafc] px-2 py-0.5 text-[10px] text-[#64748b]">{load.jobsToday} hari ini</span>
      <span className="rounded-full bg-[#f8fafc] px-2 py-0.5 text-[10px] text-[#64748b]">{load.jobsMonth} bulan ini</span>
    </div>
  )
}

// ── Calendar component ──────────────────────────────────────────────────────
function MiniCalendar({
  selectedDate, onSelect, calYear, calMonth, onPrev, onNext, events,
}: {
  selectedDate: number
  onSelect: (d: number) => void
  calYear: number
  calMonth: number
  onPrev: () => void
  onNext: () => void
  events: BookingEvent[]
}) {
  const today     = new Date()
  const isThisMonth = today.getFullYear() === calYear && today.getMonth() === calMonth
  const todayDay  = isThisMonth ? today.getDate() : -1
  const firstDay  = new Date(calYear, calMonth, 1).getDay()
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()

  const countByDay = events.reduce<Record<number, number>>((acc, e) => {
    acc[e.date] = (acc[e.date] || 0) + 1
    return acc
  }, {})

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-bold text-[#111]">{MONTH_NAMES[calMonth]} {calYear}</p>
        <div className="flex gap-1">
          <button onClick={onPrev} className="h-6 w-6 rounded hover:bg-[#f1f5f9] text-[#888] text-sm">‹</button>
          <button onClick={onNext} className="h-6 w-6 rounded hover:bg-[#f1f5f9] text-[#888] text-sm">›</button>
        </div>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {DAY_NAMES.map(d => <div key={d} className="text-center text-[10px] font-semibold text-[#bbb] py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day      = i + 1
          const count    = countByDay[day] || 0
          const isToday  = day === todayDay
          const isSel    = day === selectedDate
          const isPast   = isThisMonth && day < todayDay
          return (
            <button key={day}
              onClick={() => (count > 0 || isToday) ? onSelect(day) : undefined}
              className={`relative flex flex-col items-center py-1 rounded transition ${
                isSel    ? 'bg-brand text-white' :
                isToday  ? 'bg-[#dbeafe] text-brand font-bold' :
                count > 0? 'hover:bg-[#f8fafc] cursor-pointer' : 'cursor-default'
              }`}>
              <span className={`text-[11px] ${isSel ? 'text-white' : isToday ? 'text-brand' : isPast && count > 0 ? 'text-[#94a3b8]' : 'text-[#444]'}`}>
                {day}
              </span>
              {count > 0 && !isSel && (
                <span className="mt-0.5 h-1 w-1 rounded-full"
                  style={{ background: isToday ? '#1E4FD8' : isPast ? '#94a3b8' : '#f59e0b' }} />
              )}
              {isSel && count > 0 && <span className="mt-0.5 h-1 w-1 rounded-full bg-white/70" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── SLA helpers ────────────────────────────────────────────────────────────
const DEFAULT_JAM_KERJA = 8

function fmtDuration(minutes: number, jamKerja = DEFAULT_JAM_KERJA): string {
  if (minutes < 1) return '< 1 menit'
  if (minutes < 60) return `${Math.round(minutes)} menit`
  const minsPerDay = jamKerja * 60
  if (minutes >= minsPerDay && minutes % minsPerDay === 0) {
    const d = minutes / minsPerDay
    return `${d} hari kerja`
  }
  if (minutes >= minsPerDay) {
    const d = Math.floor(minutes / minsPerDay)
    const rem = minutes % minsPerDay
    const rh = Math.floor(rem / 60)
    return rh > 0 ? `${d} hr ${rh} j` : `${d} hari kerja`
  }
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return m > 0 ? `${h} j ${m} m` : `${h} jam`
}
function slaColor(mins: number, jamKerja = DEFAULT_JAM_KERJA, targetMinutes?: number) {
  if (targetMinutes && targetMinutes > 0) {
    if (mins <= targetMinutes) return '#16a34a'
    if (mins <= targetMinutes * 1.25) return '#f59e0b'
    return '#dc2626'
  }
  const minsPerDay = jamKerja * 60
  if (mins <= minsPerDay * 0.5) return '#16a34a'   // ≤ setengah hari kerja = sangat baik
  if (mins <= minsPerDay)       return '#f59e0b'   // ≤ 1 hari kerja = normal
  return '#dc2626'                                  // > 1 hari kerja = perlu perhatian
}
function slaLabel(mins: number, jamKerja = DEFAULT_JAM_KERJA, targetMinutes?: number) {
  if (targetMinutes && targetMinutes > 0) {
    if (mins <= targetMinutes) return `Sesuai paket (target ${fmtDuration(targetMinutes, jamKerja)})`
    if (mins <= targetMinutes * 1.25) return `Lewat sedikit (target ${fmtDuration(targetMinutes, jamKerja)})`
    return `Lewat target paket (${fmtDuration(targetMinutes, jamKerja)})`
  }
  const minsPerDay = jamKerja * 60
  if (mins <= minsPerDay * 0.5) return `Sangat Baik (≤ ${jamKerja / 2} jam)`
  if (mins <= minsPerDay)       return `Normal (≤ ${jamKerja} jam)`
  return `Perlu Perhatian (> ${jamKerja} jam)`
}

function serviceTargetMinutes(reg: any, jamKerja = DEFAULT_JAM_KERJA) {
  const duration = Number(reg.workshop?.duration || 0)
  return duration > 0 ? duration : jamKerja * 60
}

interface OperatingSchedule {
  days: string[]
  startTime: string
  endTime: string
}

// Sunday=0 … Saturday=6 mapped to Indonesian day keys
const IDX_TO_DAY = ['minggu','senin','selasa','rabu','kamis','jumat','sabtu']

function isCurrentlyOpen(schedule: OperatingSchedule | null, now: Date): boolean {
  if (!schedule) return false
  const dayKey = IDX_TO_DAY[now.getDay()]
  if (!schedule.days.includes(dayKey)) return false
  const [sh, sm] = schedule.startTime.split(':').map(Number)
  const [eh, em] = schedule.endTime.split(':').map(Number)
  const nowMins = now.getHours() * 60 + now.getMinutes()
  return nowMins >= sh * 60 + sm && nowMins < eh * 60 + em
}

function calcBusinessMinutes(start: Date, end: Date, schedule: OperatingSchedule): number {
  if (start >= end) return 0
  const [sh, sm] = schedule.startTime.split(':').map(Number)
  const [eh, em] = schedule.endTime.split(':').map(Number)
  let total = 0
  const cur = new Date(start)
  cur.setHours(0, 0, 0, 0)
  const endDay = new Date(end)
  endDay.setHours(0, 0, 0, 0)
  while (cur <= endDay) {
    if (schedule.days.includes(IDX_TO_DAY[cur.getDay()])) {
      const open  = new Date(cur); open.setHours(sh, sm, 0, 0)
      const close = new Date(cur); close.setHours(eh, em, 0, 0)
      const os = Math.max(start.getTime(), open.getTime())
      const oe = Math.min(end.getTime(), close.getTime())
      if (oe > os) total += (oe - os) / 60000
    }
    cur.setDate(cur.getDate() + 1)
  }
  return total
}

interface SLAData {
  avgMinutes: number
  avgTargetMinutes: number
  minMinutes: number
  maxMinutes: number
  onTargetCount: number
  count: number
  byService: { title: string; avg: number; target: number; count: number; onTarget: number }[]
  businessHours: boolean
}

type CardId = 'stats' | 'sla' | 'sla-detail' | 'calendar-kanban'
const DEFAULT_CARD_ORDER: CardId[] = ['stats', 'calendar-kanban', 'sla', 'sla-detail']

// ── Main component ──────────────────────────────────────────────────────────
export default function AdminMainDashboard() {
  const { user, tenant } = useAuth()
  const navigate = useNavigate()
  const [items, setItems]             = useState<KanbanItem[]>([])
  const [events, setEvents]           = useState<BookingEvent[]>([])
  const [slaData, setSlaData]         = useState<SLAData | null>(null)
  const [slaRows, setSlaRows]         = useState<{ customer: string; layanan: string; masuk: string; selesai: string; durasi: number; target: number }[]>([])
  const [opSchedule, setOpSchedule]   = useState<OperatingSchedule | null>(null)
  const [jamKerja, setJamKerja]       = useState(DEFAULT_JAM_KERJA)
  const [rawRegs, setRawRegs]         = useState<any[]>([])
  const [loading, setLoading]         = useState(true)
  const [now, setNow]                 = useState(new Date())
  const [apiTeknisi, setApiTeknisi]   = useState<Teknisi[]>([])
  const [dynamicNotifs, setDynamicNotifs] = useState<{ text: string; color: string }[]>([])
  const [upcomingShortages, setUpcomingShortages] = useState<StockShortage[]>([])
  const [overdueServices, setOverdueServices] = useState<{ customer: string; layanan: string; elapsed: number; target: number }[]>([])
  const [lowStockItems, setLowStockItems]   = useState<{ nama: string; stok: number; stokMin: number; satuan: string; notes?: string }[]>([])
  const [cardOrder, setCardOrder]     = useState<CardId[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('wms_dashboard_order') || 'null')
      if (Array.isArray(saved) && saved.length === DEFAULT_CARD_ORDER.length) return saved
    } catch {}
    return DEFAULT_CARD_ORDER
  })
  const dragCard  = useRef<CardId | null>(null)
  const dragOver  = useRef<CardId | null>(null)

  // Calendar navigation
  const today = new Date()
  const [calYear,  setCalYear]  = useState(today.getFullYear())
  const [calMonth, setCalMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState(today.getDate())

  // Check-in modal
  const [checkInTarget,  setCheckInTarget]  = useState<KanbanItem | null>(null)
  const [selectedTeknisi, setSelectedTeknisi] = useState<string[]>([])
  const [checkInLoading,  setCheckInLoading]  = useState(false)

  // Overtime
  const [overtime, setOvertime] = useState(() => {
    try { return JSON.parse(localStorage.getItem('wms_overtime') || 'null') } catch { return null }
  })
  // overtime = null (off) | { start: string, end: string } e.g. { start: '17:00', end: '21:00' }
  const [showOvertimeModal, setShowOvertimeModal] = useState(false)
  const [overtimeStart, setOvertimeStart] = useState('17:00')
  const [overtimeEnd, setOvertimeEnd] = useState('21:00')
  const [paymentReminder, setPaymentReminder] = useState<KanbanItem | null>(null)
  const [advanceConfirm, setAdvanceConfirm] = useState<KanbanItem | null>(null)
  const [stockAlert, setStockAlert] = useState<{ shortages: StockShortage[] } | null>(null)
  const [cancelConfirm, setCancelConfirm] = useState<KanbanItem | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [rescheduleItem, setRescheduleItem] = useState<KanbanItem | null>(null)
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [rescheduleTime, setRescheduleTime] = useState('')
  const [paymentMaterials, setPaymentMaterials] = useState<{ hpp: number; deducted: MaterialDeduction[] } | null>(null)
  const [setupDismissed, setSetupDismissed] = useState(true)
  const [setupCompleted, setSetupCompleted] = useState(0)

  // Clock
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Fetch setup checklist status
  useEffect(() => {
    if (!tenant?.id) return
    tenantSettingsAPI.get('hpp_setup_checklist')
      .then(res => {
        const d = res.data.data
        if (!d) { setSetupDismissed(false); setSetupCompleted(0); return }
        setSetupDismissed(!!d.dismissed)
        const count = [d.step1_supplier, d.step2_po, d.step3_receive, d.step4_service, d.step5_bom].filter(Boolean).length
        setSetupCompleted(count)
      })
      .catch(() => { setSetupDismissed(false) })
  }, [tenant?.id])

  // Fetch teknisi aktif dari tabel Teknisi
  useEffect(() => {
    teknisiAPI.list('aktif')
      .then(res => {
        const list: { id: string; name: string; spesialis?: string[] }[] = res.data.data || []
        setApiTeknisi(list.map(t => ({ id: t.id, name: t.name, spesialis: t.spesialis || [] })))
      })
      .catch(() => {})
  }, [])

  // Fetch inventory untuk notifikasi stok menipis
  useEffect(() => {
    if (!tenant?.id) return
    inventoryAPI.list()
      .then(res => {
        const items: any[] = res.data.data || []
        const lowStock = items.filter(i => i.stok <= i.stokMin)
        setLowStockItems(lowStock.map(i => ({ nama: i.nama, stok: i.stok, stokMin: i.stokMin, satuan: i.satuan, notes: i.notes })))
      })
      .catch(() => {})
  }, [tenant?.id])

  // ── SLA compute (called after fetch and after schedule loads) ──
  const computeSLA = useCallback((regs: any[], schedule?: OperatingSchedule | null) => {
    const sched = schedule !== undefined ? schedule : opSchedule
    const completedWithDate = regs.filter((r: any) => r.status === 'completed' && r.scheduledDate)
    const slaRecords = completedWithDate.map((r: any) => {
      const start = new Date(r.scheduledDate)
      const end   = new Date(r.updatedAt)
      const durasi = sched ? calcBusinessMinutes(start, end, sched) : (end.getTime() - start.getTime()) / 60000
      return { reg: r, durasi, target: serviceTargetMinutes(r, jamKerja) }
    }).filter(row => row.durasi > 0 && row.durasi < 60 * jamKerja * 60)
    const durations = slaRecords.map(row => row.durasi)
    const targets = slaRecords.map(row => row.target)

    if (durations.length === 0) { setSlaData(null); setSlaRows([]); return }

    const avg = durations.reduce((a, b) => a + b, 0) / durations.length
    const avgTarget = targets.reduce((a, b) => a + b, 0) / targets.length
    const onTargetCount = slaRecords.filter(row => row.durasi <= row.target).length
    const byServiceMap: Record<string, { title: string; durations: number[]; targets: number[]; onTarget: number }> = {}
    slaRecords.forEach(({ reg: r, durasi, target }) => {
      const key = r.workshop?.id || 'unknown'
      if (!byServiceMap[key]) byServiceMap[key] = { title: r.workshop?.title || 'Layanan', durations: [], targets: [], onTarget: 0 }
      byServiceMap[key].durations.push(durasi)
      byServiceMap[key].targets.push(target)
      if (durasi <= target) byServiceMap[key].onTarget += 1
    })
    const byService = Object.values(byServiceMap).map(s => ({
      title: s.title,
      avg: s.durations.reduce((a, b) => a + b, 0) / s.durations.length,
      target: s.targets.reduce((a, b) => a + b, 0) / s.targets.length,
      count: s.durations.length,
      onTarget: s.onTarget,
    })).sort((a, b) => (b.onTarget / b.count) - (a.onTarget / a.count))

    setSlaData({
      avgMinutes: avg,
      avgTargetMinutes: avgTarget,
      minMinutes: Math.min(...durations),
      maxMinutes: Math.max(...durations),
      onTargetCount,
      count: durations.length,
      byService,
      businessHours: !!sched,
    })

    const fmtDate = (d: Date) => d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
      + ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    setSlaRows(slaRecords.map(({ reg: r, durasi, target }) => ({
      customer: r.customer?.name || '—',
      layanan: r.workshop?.title || '—',
      masuk: r.scheduledDate ? fmtDate(new Date(r.scheduledDate)) : '—',
      selesai: fmtDate(new Date(r.updatedAt)),
      durasi,
      target,
    })))
  }, [opSchedule, jamKerja])

  // ── Fetch registrations ──
  const fetchRegistrations = useCallback(async () => {
    if (!tenant?.id) return
    try {
      setLoading(true)
      const res = await registrationsAPI.list(tenant.id)
      const regs: any[] = res.data.data || []

      // Map to KanbanItems
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
      const todayEnd = new Date(todayStart); todayEnd.setHours(23, 59, 59, 999)
      const kanbanItems: KanbanItem[] = regs
        .filter(r => {
          if (r.status === 'cancelled') return false
          if (r.status !== 'completed') return true
          const doneAt = new Date(r.updatedAt || r.createdAt)
          return doneAt >= todayStart && doneAt <= todayEnd
        })
        .map(r => {
          const kanbanStatus = DB_TO_KANBAN[r.status] || 'ANTRI'
          const teknisi = parseTeknisiNames(r.notes)
          return {
            id: r.id,
            label: `${r.customer?.name || 'Pelanggan'} — ${r.workshop?.title || 'Layanan'}`,
            status: kanbanStatus,
            teknisi,
            scheduledDate: r.scheduledDate,
            vehicleName: r.vehicleName,
            licensePlate: r.licensePlate,
          }
        })

      // Map to BookingEvents for calendar
      const bookingEvs: BookingEvent[] = regs
        .filter(r => r.scheduledDate && r.status !== 'cancelled')
        .map(r => {
          const d     = new Date(r.scheduledDate)
          const time  = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
          return {
            date: d.getDate(),
            time,
            customer: r.customer?.name || 'Pelanggan',
            layanan:  r.workshop?.title || 'Layanan',
            status: DB_TO_KANBAN[r.status] || 'ANTRI',
            regId: r.id,
          }
        })
        .filter(e => {
          const d = new Date(regs.find(r => r.id === e.regId)?.scheduledDate)
          return d.getFullYear() === calYear && d.getMonth() === calMonth
        })

      setItems(kanbanItems)
      setEvents(bookingEvs)
      setRawRegs(regs)
      computeSLA(regs)

      const activeOverdue = regs
        .filter((r: any) => ['in_progress', 'qc_check'].includes(r.status))
        .map((r: any) => {
          // Pakai scheduledDate kalau ada, fallback ke createdAt
          const startRaw = r.scheduledDate || r.createdAt
          const start = new Date(startRaw)
          const elapsed = opSchedule ? calcBusinessMinutes(start, new Date(), opSchedule) : (Date.now() - start.getTime()) / 60000
          const target = serviceTargetMinutes(r, jamKerja)
          return { customer: r.customer?.name || 'Pelanggan', layanan: r.workshop?.title || 'Layanan', elapsed, target }
        })
        .filter(row => row.elapsed > row.target && row.target > 0)
        .sort((a, b) => (b.elapsed - b.target) - (a.elapsed - a.target))
      setOverdueServices(activeOverdue)

      // Generate notifikasi dari data real
      const newToday = regs.filter(r =>
        r.status === 'confirmed' && r.createdAt && new Date(r.createdAt) >= todayStart
      ).length
      const pending = regs.filter(r => r.status === 'confirmed').length
      const inQC    = regs.filter(r => r.status === 'qc_check').length
      const notifs: { text: string; color: string }[] = []
      if (activeOverdue.length > 0) notifs.unshift({ text: `${activeOverdue.length} layanan melewati durasi paket - cek prioritas pengerjaan`, color: '#dc2626' })
      if (newToday > 0) notifs.push({ text: `${newToday} booking baru hari ini — cek kalender`, color: '#1E4FD8' })
      if (pending > 0)  notifs.push({ text: `${pending} servis menunggu kedatangan pelanggan`, color: '#6366f1' })
      if (inQC > 0)     notifs.push({ text: `${inQC} unit dalam tahap QC — siap diselesaikan`, color: '#16a34a' })
      try {
        const shortageRes = await serviceMaterialsAPI.upcomingShortages()
        const shortages: StockShortage[] = shortageRes.data.data?.shortages || []
        setUpcomingShortages(shortages)
        if (shortages.length > 0) {
          const top = shortages[0]
          notifs.unshift({
            text: `Kekurangan stok untuk booking mendatang: ${top.nama} kurang ${top.shortage.toLocaleString('id-ID')} ${top.satuan}${shortages.length > 1 ? ` +${shortages.length - 1} material` : ''}`,
            color: '#dc2626',
          })
        }
      } catch {
        setUpcomingShortages([])
      }
      if (notifs.length === 0) notifs.push({ text: 'Semua servis berjalan lancar hari ini', color: '#16a34a' })
      setDynamicNotifs(notifs)
    } catch (err) {
      console.error('Failed to fetch registrations:', err)
    } finally {
      setLoading(false)
    }
  }, [tenant?.id, calYear, calMonth])

  useEffect(() => { fetchRegistrations() }, [fetchRegistrations])

  useEffect(() => {
    tenantSettingsAPI.get('operating_schedule')
      .then(res => {
        if (res.data.data) {
          setOpSchedule(res.data.data)
          if (rawRegs.length > 0) computeSLA(rawRegs, res.data.data)
        }
      })
      .catch(() => {})
    tenantSettingsAPI.get('jam_kerja_per_hari')
      .then(res => { if (res.data.data?.value) setJamKerja(Number(res.data.data.value)) })
      .catch(() => {})
  }, [])

  // Re-compute SLA when schedule is updated externally
  useEffect(() => {
    if (rawRegs.length > 0) computeSLA(rawRegs)
  }, [opSchedule])

  // ── Calendar nav ──
  const prevMonth = () => {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11) }
    else setCalMonth(m => m - 1)
    setSelectedDate(1)
  }
  const nextMonth = () => {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0) }
    else setCalMonth(m => m + 1)
    setSelectedDate(1)
  }

  // ── Weekly omset dari rawRegs ──
  /*
  const weeklyOmset = useMemo(() => {
    const totals = [0, 0, 0, 0, 0, 0, 0] // Mon=0 … Sun=6
    const now = new Date()
    const day = now.getDay()
    const monday = new Date(now)
    monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1))
    monday.setHours(0, 0, 0, 0)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    sunday.setHours(23, 59, 59, 999)
    rawRegs
      .filter(r => r.status === 'completed')
      .forEach(r => {
        const d = new Date(r.updatedAt || r.createdAt)
        if (d < monday || d > sunday) return
        const dow = d.getDay()
        const idx = dow === 0 ? 6 : dow - 1
        totals[idx] += parseFloat(r.workshop?.price || '0')
      })
    const max = Math.max(...totals, 1)
    const totalMinggu = totals.reduce((s, v) => s + v, 0)
    return { pct: totals.map(v => Math.round((v / max) * 100)), values: totals, total: totalMinggu }
  }, [rawRegs])
  */

  // ── Stats ──
  const stats = [
    { label: 'Akan Datang',     value: items.filter(i => i.status === 'ANTRI').length.toString(),   sub: 'menunggu kedatangan', accent: true },
    { label: 'Sedang Dikerjakan', value: items.filter(i => i.status === 'PROSES').length.toString(), sub: `${items.filter(i => i.status === 'QC').length} hampir selesai`, accent: false },
    { label: 'Selesai Hari Ini', value: items.filter(i => i.status === 'SELESAI').length.toString(), sub: 'unit selesai', accent: false },
    { label: 'Total Booking',    value: items.length.toString(), sub: 'bulan ini', accent: false },
  ]

  // ── Real teknisi stats from rawRegs ──
  const todayStr = new Date().toDateString()
  const thisMonth = new Date().getMonth()
  const thisYear = new Date().getFullYear()
  // Mulai dari daftar teknisi aktif di DB, lalu hitung job dari rawRegs
  const teknisiJobMap: Record<string, { activeJobs: number; jobsToday: number; jobsMonth: number }> = {}
  apiTeknisi.forEach(t => { teknisiJobMap[t.name] = { activeJobs: 0, jobsToday: 0, jobsMonth: 0 } })
  rawRegs.forEach((r: any) => {
    const names = parseTeknisiNames(r.notes)
    if (names.length === 0) return
    const d = new Date(r.updatedAt || r.createdAt)
    const isToday = d.toDateString() === todayStr
    const isMonth = d.getMonth() === thisMonth && d.getFullYear() === thisYear
    names.forEach(name => {
      if (!teknisiJobMap[name]) teknisiJobMap[name] = { activeJobs: 0, jobsToday: 0, jobsMonth: 0 }
      if (['in_progress', 'qc_check'].includes(r.status)) teknisiJobMap[name].activeJobs++
      if (isToday && ['in_progress', 'qc_check', 'completed'].includes(r.status)) teknisiJobMap[name].jobsToday++
      if (isMonth && r.status === 'completed') teknisiJobMap[name].jobsMonth++
    })
  })
  const minActiveJobs = Math.min(...Object.values(teknisiJobMap).map(t => t.activeJobs), 0)
  const minJobsToday = Math.min(...Object.values(teknisiJobMap).map(t => t.jobsToday), 0)
  const teknisiLoadMap: Record<string, TeknisiLoad> = Object.fromEntries(
    Object.entries(teknisiJobMap).map(([name, data]) => {
      const status = data.activeJobs === 0
        ? 'available'
        : data.activeJobs === minActiveJobs && data.jobsToday === minJobsToday ? 'light' : 'busy'
      return [name, { ...data, status }]
    })
  )
  // ── Check-in ──
  const openCheckIn = (item: KanbanItem) => {
    setCheckInTarget(item)
    setSelectedTeknisi(item.teknisi)
  }

  const confirmCheckIn = async () => {
    if (!checkInTarget) return
    const cfg = COLUMN_CONFIG[checkInTarget.status]
    if (!cfg.next) return

    setCheckInLoading(true)
    try {
      const nextStatus = KANBAN_TO_DB[cfg.next]
      const availabilityRes = await serviceMaterialsAPI.availability(checkInTarget.id)
      const availability = availabilityRes.data.data
      if (availability?.shortages?.length > 0) {
        setStockAlert({ shortages: availability.shortages })
        setCheckInLoading(false)
        return
      }
      const teknisiNote = selectedTeknisi.length > 0
        ? `teknisi:${selectedTeknisi.join(',')}`
        : undefined

      await registrationsAPI.update(checkInTarget.id, {
        tenantId: tenant!.id,
        status: nextStatus,
        ...(teknisiNote && { notes: teknisiNote }),
      })

      // Update local state immediately
      setItems(prev => prev.map(item =>
        item.id === checkInTarget.id
          ? { ...item, status: cfg.next!, teknisi: selectedTeknisi }
          : item
      ))
      setEvents(prev => prev.map(e =>
        e.regId === checkInTarget.id ? { ...e, status: cfg.next! } : e
      ))
    } catch (err) {
      console.error('Check-in failed:', err)
    } finally {
      setCheckInLoading(false)
      setCheckInTarget(null)
    }
  }

  const advance = async (item: KanbanItem) => {
    if (item.status === 'ANTRI') {
      openCheckIn(item)
      return
    }
    const cfg = COLUMN_CONFIG[item.status]
    if (!cfg.next) return
    setAdvanceConfirm(item)
  }

  const doAdvance = async (item: KanbanItem) => {
    setAdvanceConfirm(null)
    const cfg = COLUMN_CONFIG[item.status]
    if (!cfg.next) return

    try {
      let materialResult: { hpp: number; deducted: MaterialDeduction[] } = { hpp: 0, deducted: [] }
      if (cfg.next === 'SELESAI') {
        try {
          const hppRes = await serviceMaterialsAPI.calculate(item.id)
          materialResult = {
            hpp: Number(hppRes.data?.hpp || 0),
            deducted: hppRes.data?.deducted || [],
          }
        } catch {
          // HPP calculation gagal — lanjut dengan nilai kosong, user bisa lihat warning
        }
      }
      await registrationsAPI.update(item.id, {
        tenantId: tenant!.id,
        status: KANBAN_TO_DB[cfg.next],
      })
      setItems(prev => prev.map(i =>
        i.id === item.id ? { ...i, status: cfg.next! } : i
      ))
      setEvents(prev => prev.map(e =>
        e.regId === item.id ? { ...e, status: cfg.next! } : e
      ))
      if (cfg.next === 'SELESAI') {
        setPaymentMaterials(materialResult)
        setPaymentReminder(item)
      }
    } catch (err) {
      console.error('Advance status failed:', err)
    }
  }

  const confirmCancel = async () => {
    if (!cancelConfirm || !tenant?.id) return
    try {
      await registrationsAPI.update(cancelConfirm.id, {
        tenantId: tenant!.id,
        status: 'cancelled',
        ...(cancelReason && { notes: `cancel:${cancelReason}` }),
      })
      setItems(prev => prev.filter(i => i.id !== cancelConfirm.id))
      setCancelConfirm(null)
      setCancelReason('')
    } catch (err) {
      console.error('Cancel failed:', err)
      setCancelConfirm(null)
      setCancelReason('')
    }
  }

  const confirmReschedule = async () => {
    if (!rescheduleItem || !tenant?.id || !rescheduleDate) return
    try {
      const dt = rescheduleTime
        ? new Date(`${rescheduleDate}T${rescheduleTime}`).toISOString()
        : new Date(`${rescheduleDate}T08:00`).toISOString()
      await registrationsAPI.update(rescheduleItem.id, {
        tenantId: tenant!.id,
        scheduledDate: dt,
        status: 'confirmed',
      })
      setItems(prev => prev.map(i => i.id === rescheduleItem.id
        ? { ...i, scheduledDate: dt }
        : i
      ))
      setRescheduleItem(null)
      setRescheduleDate('')
      setRescheduleTime('')
    } catch (err) { console.error('Reschedule failed:', err) }
  }

  const toggleTeknisi = (name: string) =>
    setSelectedTeknisi(prev => prev.includes(name) ? prev.filter(t => t !== name) : [...prev, name])

  const onDragStart = (id: CardId) => { dragCard.current = id }
  const onDragEnter = (id: CardId) => { dragOver.current = id }
  const onDragEnd   = () => {
    if (!dragCard.current || !dragOver.current || dragCard.current === dragOver.current) return
    const order = [...cardOrder]
    const from  = order.indexOf(dragCard.current)
    const to    = order.indexOf(dragOver.current)
    order.splice(from, 1)
    order.splice(to, 0, dragCard.current)
    setCardOrder(order)
    localStorage.setItem('wms_dashboard_order', JSON.stringify(order))
    dragCard.current = null
    dragOver.current = null
  }

  const selectedEvents = events.filter(e => e.date === selectedDate)
  const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const dateStr = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const DragHandle = ({ id }: { id: CardId }) => (
    <div
      draggable
      onDragStart={() => onDragStart(id)}
      onDragEnd={onDragEnd}
      className="absolute top-2 right-2 cursor-grab active:cursor-grabbing p-1 rounded hover:bg-[#f1f5f9] opacity-0 group-hover/drag:opacity-60 hover:!opacity-100 transition-opacity z-10"
      title="Geser untuk pindah posisi"
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <circle cx="4" cy="3" r="1.2" fill="#888"/><circle cx="10" cy="3" r="1.2" fill="#888"/>
        <circle cx="4" cy="7" r="1.2" fill="#888"/><circle cx="10" cy="7" r="1.2" fill="#888"/>
        <circle cx="4" cy="11" r="1.2" fill="#888"/><circle cx="10" cy="11" r="1.2" fill="#888"/>
      </svg>
    </div>
  )

  return (
    <div className="p-6 flex flex-col gap-5">

      {/* Check-in modal */}
      {checkInTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg border border-wm-line bg-white p-6 shadow-xl">
            <p className="text-base font-bold text-[#111] mb-1">Konfirmasi Check In</p>
            <p className="text-[12px] text-[#888] mb-1">{checkInTarget.label}</p>
            {checkInTarget.vehicleName && (
              <p className="text-[11px] text-brand mb-4">
                {checkInTarget.vehicleName} {checkInTarget.licensePlate ? `· ${checkInTarget.licensePlate}` : ''}
              </p>
            )}
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold text-[#555]">Pilih Teknisi (bisa lebih dari 1)</p>
              <p className="text-[10px] text-[#888]">Beban kerja real-time</p>
            </div>
            <div className="space-y-1.5 mb-5">
              {[...apiTeknisi].sort((a, b) => {
                const la = teknisiLoadMap[a.name] || { activeJobs: 0, jobsToday: 0, jobsMonth: 0 }
                const lb = teknisiLoadMap[b.name] || { activeJobs: 0, jobsToday: 0, jobsMonth: 0 }
                return la.activeJobs - lb.activeJobs || la.jobsToday - lb.jobsToday || la.jobsMonth - lb.jobsMonth || a.name.localeCompare(b.name)
              }).map(t => (
                <label key={t.id} className="flex items-start gap-3 cursor-pointer rounded border border-wm-line px-3 py-2.5 hover:bg-[#f8fafc] transition"
                  style={selectedTeknisi.includes(t.name) ? { borderColor: '#1E4FD8', background: '#EEF3FE' } : {}}>
                  <input type="checkbox" checked={selectedTeknisi.includes(t.name)}
                    onChange={() => toggleTeknisi(t.name)} className="h-4 w-4 accent-[#1E4FD8] mt-0.5 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[13px] font-semibold text-[#111] truncate">{t.name}</p>
                      <TeknisiLoadBadge load={teknisiLoadMap[t.name] || { activeJobs: 0, jobsToday: 0, jobsMonth: 0, status: 'available' }} />
                    </div>
                    {t.spesialis.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {t.spesialis.map(s => (
                          <span key={s} className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#f1f5f9] text-[#475569] border border-wm-line">{s}</span>
                        ))}
                      </div>
                    )}
                    <TeknisiLoadMeta load={teknisiLoadMap[t.name] || { activeJobs: 0, jobsToday: 0, jobsMonth: 0, status: 'available' }} />
                  </div>
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={confirmCheckIn}
                disabled={selectedTeknisi.length === 0 || checkInLoading}
                className="flex-1 rounded bg-brand py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-40 transition">
                {checkInLoading ? 'Menyimpan...' : 'Check In'}
              </button>
              <button onClick={() => setCheckInTarget(null)}
                className="flex-1 rounded border border-wm-line py-2 text-sm text-[#555] hover:bg-[#f8fafc] transition">
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel confirm modal */}
      {cancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg border border-wm-line bg-white p-6 shadow-xl">
            <p className="text-base font-bold text-[#dc2626] mb-1">Batalkan Booking?</p>
            <p className="text-[13px] font-semibold text-[#111]">{cancelConfirm.label}</p>
            {cancelConfirm.licensePlate && <p className="text-[12px] text-[#888] mb-3">{cancelConfirm.licensePlate}</p>}
            <div className="mb-4 mt-2">
              <label className="block text-[11px] font-semibold text-[#555] mb-1">Alasan <span className="text-[#aaa] font-normal">(opsional)</span></label>
              <input value={cancelReason} onChange={e => setCancelReason(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && confirmCancel()}
                placeholder="Misal: customer tidak jadi datang"
                className="w-full rounded border border-[#cbd5e1] px-3 py-2 text-sm outline-none focus:border-[#dc2626] transition" />
            </div>
            <div className="flex gap-2">
              <button onClick={confirmCancel}
                className="flex-1 rounded bg-[#dc2626] py-2 text-sm font-semibold text-white hover:bg-[#b91c1c] transition">
                Ya, Batalkan
              </button>
              <button onClick={() => { setCancelConfirm(null); setCancelReason('') }}
                className="flex-1 rounded border border-wm-line py-2 text-sm text-[#555] hover:bg-[#f8fafc] transition">
                Tidak
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule modal */}
      {rescheduleItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg border border-wm-line bg-white p-6 shadow-xl">
            <p className="text-base font-bold text-[#111] mb-1">Jadwal Ulang</p>
            <p className="text-[13px] font-semibold text-[#111]">{rescheduleItem.label}</p>
            {rescheduleItem.licensePlate && <p className="text-[12px] text-[#888] mb-3">{rescheduleItem.licensePlate}</p>}
            <div className="space-y-3 mb-5 mt-2">
              <div>
                <label className="block text-[11px] font-semibold text-[#555] mb-1">Tanggal baru <span className="text-[#dc2626]">*</span></label>
                <input type="date" value={rescheduleDate} onChange={e => setRescheduleDate(e.target.value)}
                  className="w-full rounded border border-[#cbd5e1] px-3 py-2 text-sm outline-none focus:border-brand transition" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#555] mb-1">Jam <span className="text-[#aaa] font-normal">(opsional)</span></label>
                <input type="time" value={rescheduleTime} onChange={e => setRescheduleTime(e.target.value)}
                  className="w-full rounded border border-[#cbd5e1] px-3 py-2 text-sm outline-none focus:border-brand transition" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={confirmReschedule} disabled={!rescheduleDate}
                className="flex-1 rounded bg-brand py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50 transition">
                Simpan Jadwal
              </button>
              <button onClick={() => { setRescheduleItem(null); setRescheduleDate(''); setRescheduleTime('') }}
                className="flex-1 rounded border border-wm-line py-2 text-sm text-[#555] hover:bg-[#f8fafc] transition">
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stock shortage alert modal */}
      {stockAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg border border-wm-line bg-white p-6 shadow-xl">
            <p className="text-base font-bold text-[#dc2626] mb-1">Stok Tidak Cukup</p>
            <p className="text-[12px] text-[#888] mb-4">Material berikut belum mencukupi untuk memproses layanan ini:</p>
            <div className="space-y-2 mb-5">
              {stockAlert.shortages.map((s, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg bg-[#fef2f2] border border-[#fecaca] px-3 py-2">
                  <span className="text-[12px] font-semibold text-[#111]">{s.nama}</span>
                  <div className="text-right">
                    <p className="text-[11px] font-bold text-[#dc2626]">Butuh {s.required.toLocaleString('id-ID')} {s.satuan}</p>
                    <p className="text-[10px] text-[#aaa]">Stok {s.stock.toLocaleString('id-ID')} {s.satuan}</p>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setStockAlert(null)}
              className="w-full rounded bg-[#dc2626] py-2 text-sm font-semibold text-white hover:bg-[#b91c1c]">
              Mengerti
            </button>
          </div>
        </div>
      )}

      {/* Advance status confirm modal */}
      {advanceConfirm && (() => {
        const cfg = COLUMN_CONFIG[advanceConfirm.status]
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-sm rounded-lg border border-wm-line bg-white p-6 shadow-xl">
              <p className="text-base font-bold text-[#111]">Ubah Status?</p>
              <p className="mt-2 text-sm text-[#555]">
                <span className="font-semibold">{advanceConfirm.label}</span>
                <br />
                <span className="text-[#888]">{COLUMN_LABEL[advanceConfirm.status]}</span>
                {' → '}
                <span className="font-semibold" style={{ color: cfg.color }}>{cfg.next ? COLUMN_LABEL[cfg.next] : ''}</span>
              </p>
              <div className="mt-5 flex gap-2">
                <button onClick={() => doAdvance(advanceConfirm)}
                  className="flex-1 rounded bg-brand py-2 text-sm font-semibold text-white hover:bg-brand-600">
                  Ya, Lanjutkan
                </button>
                <button onClick={() => setAdvanceConfirm(null)}
                  className="flex-1 rounded border border-wm-line py-2 text-sm text-[#555] hover:bg-[#f8fafc]">
                  Batal
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Payment reminder after finishing from dashboard */}
      {paymentReminder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg border border-wm-line bg-white p-6 shadow-xl">
            <p className="text-base font-bold text-[#111] mb-1">Layanan Selesai</p>
            <p className="text-[12px] text-[#888] mb-4">{paymentReminder.label}</p>
            <div className="mb-5 rounded-lg border border-[#D9E3FC] bg-brand-50 px-3 py-2.5">
              <p className="text-[12px] font-semibold text-[#1e40af]">Pembayaran belum otomatis lunas.</p>
              <p className="mt-0.5 text-[11px] text-[#475569]">
                Silakan cek halaman Penjualan untuk konfirmasi nominal pembayaran dan update status invoice.
              </p>
            </div>
            {paymentMaterials && (
              <div className="mb-5 space-y-2">
                {paymentMaterials.deducted.length === 0 && paymentMaterials.hpp === 0 && (
                  <div className="rounded-lg border border-[#fde68a] bg-[#fffbeb] px-3 py-2">
                    <p className="text-[11px] font-semibold text-[#92400e]">⚠️ HPP belum diisi untuk layanan ini.</p>
                    <p className="text-[10px] text-[#b45309] mt-0.5">Isi BOM di menu Paket/Layanan agar HPP dan stok material tercatat otomatis.</p>
                  </div>
                )}
                <p className="text-center text-[11px] text-[#64748b]">
                  {paymentMaterials.deducted.length > 0 ? 'Stok otomatis dikurangi sesuai BOM.' : 'Tidak ada material keluar dari setup HPP layanan ini.'}
                </p>
                {paymentMaterials.deducted.length > 0 && (
                  <div className="space-y-1.5">
                    {paymentMaterials.deducted.map((mat, idx) => (
                      <div key={`${mat.nama}-${idx}`} className="flex items-center justify-between rounded bg-[#f8fafc] px-3 py-2 text-[12px]">
                        <span className="font-semibold text-[#334155]">{mat.nama}</span>
                        <span className="font-bold text-[#dc2626]">-{Number(mat.qty).toLocaleString('id-ID')}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between rounded bg-brand-50 px-3 py-2 text-[12px]">
                      <span className="font-semibold text-[#1e40af]">HPP Material</span>
                      <span className="font-bold text-brand">Rp {Number(paymentMaterials.hpp || 0).toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => { setPaymentReminder(null); setPaymentMaterials(null) }}
                className="flex-1 rounded border border-wm-line py-2 text-sm text-[#555] hover:bg-[#f8fafc] transition">
                Nanti
              </button>
              <button onClick={() => { setPaymentReminder(null); setPaymentMaterials(null); navigate('/admin/sales') }}
                className="flex-1 rounded bg-brand py-2 text-sm font-semibold text-white hover:bg-brand-600 transition">
                Cek Penjualan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Overtime modal */}
      {showOvertimeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xs rounded-lg border border-wm-line bg-white p-6 shadow-xl">
            <p className="text-base font-bold text-[#111] mb-4">Jadwal Lembur</p>
            <div className="space-y-3 mb-5">
              <div>
                <label className="block text-[11px] font-semibold text-[#555] mb-1">Mulai</label>
                <input type="time" value={overtimeStart} onChange={e => setOvertimeStart(e.target.value)}
                  className="w-full rounded border border-[#cbd5e1] px-3 py-2 text-sm outline-none focus:border-brand" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#555] mb-1">Selesai</label>
                <input type="time" value={overtimeEnd} onChange={e => setOvertimeEnd(e.target.value)}
                  className="w-full rounded border border-[#cbd5e1] px-3 py-2 text-sm outline-none focus:border-brand" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => {
                const ot = { start: overtimeStart, end: overtimeEnd }
                setOvertime(ot)
                localStorage.setItem('wms_overtime', JSON.stringify(ot))
                setShowOvertimeModal(false)
              }} className="flex-1 rounded bg-[#f59e0b] py-2 text-sm font-semibold text-white hover:bg-[#d97706]">
                Aktifkan
              </button>
              {overtime && (
                <button onClick={() => {
                  setOvertime(null)
                  localStorage.removeItem('wms_overtime')
                  setShowOvertimeModal(false)
                }} className="flex-1 rounded border border-wm-line py-2 text-sm text-[#dc2626] hover:bg-[#fee2e2]">
                  Nonaktifkan
                </button>
              )}
              <button onClick={() => setShowOvertimeModal(false)}
                className="flex-1 rounded border border-wm-line py-2 text-sm text-[#555]">
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Greeting + Clock */}
      <div className="rounded-lg border border-wm-line bg-white px-6 py-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-brand mb-1">Dashboard Operasional</p>
          <h1 className="font-display text-xl font-bold text-ink">Selamat Datang, {user?.name || 'Admin'} 👋</h1>
          <p className="mt-0.5 text-[12px] text-[#888] capitalize">{dateStr}</p>
        </div>
        {/* Open/close + overtime */}
        <div className="flex flex-col items-center gap-1.5">
          {opSchedule ? (
            <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold ${isCurrentlyOpen(opSchedule, now) || overtime ? 'bg-[#dcfce7] text-[#16a34a]' : 'bg-[#fee2e2] text-[#dc2626]'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${isCurrentlyOpen(opSchedule, now) || overtime ? 'bg-[#16a34a]' : 'bg-[#dc2626]'}`} />
              {isCurrentlyOpen(opSchedule, now) ? 'BUKA' : overtime ? `LEMBUR s/d ${overtime.end}` : 'TUTUP'}
            </div>
          ) : null}
          <button
            onClick={() => setShowOvertimeModal(true)}
            className={`text-[10px] px-2 py-1 rounded border transition ${overtime ? 'border-[#f59e0b] bg-[#fffbeb] text-[#f59e0b]' : 'border-wm-line text-[#aaa] hover:border-[#f59e0b] hover:text-[#f59e0b]'}`}
          >
            {overtime ? `⏰ Lembur aktif` : '+ Tambah Lembur'}
          </button>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-lg border border-wm-line bg-[#f8fafc] px-5 py-3 text-center min-w-[140px]">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#aaa] mb-1">Waktu Sekarang</p>
            <p className="text-3xl font-bold text-[#111] tabular-nums tracking-tight">{timeStr.slice(0, 5)}</p>
            <p className="text-[11px] text-brand font-semibold mt-0.5 tabular-nums">{timeStr.slice(6)}<span className="text-[#bbb]"> detik</span></p>
          </div>
          <button onClick={() => navigate('/admin/sales/registration')}
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-3 text-sm font-semibold text-white hover:bg-brand-600 transition">
            + Booking Baru
          </button>
        </div>
      </div>

      {/* Setup HPP banner */}
      {!setupDismissed && setupCompleted < 5 && (
        <div className="rounded-lg border border-[#D9E3FC] bg-brand-50 px-5 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-xl flex-shrink-0">🧭</span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-[#1A45BF]">Panduan setup belum selesai ({setupCompleted}/5 langkah)</p>
              <p className="text-[11px] text-[#3b82f6] mt-0.5">Lengkapi setup agar HPP dihitung otomatis dengan harga beli aktual (FIFO).</p>
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={() => navigate('/admin/setup')}
              className="text-[12px] font-semibold px-3 py-1.5 rounded-lg bg-brand text-white hover:bg-brand-600 transition">
              Lanjutkan Setup
            </button>
            <button onClick={() => setSetupDismissed(true)}
              className="text-[12px] text-[#94a3b8] hover:text-[#555] transition px-1">
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Notifikasi */}
      <div className="rounded-lg border border-wm-line bg-white p-5">
        <p className="text-sm font-bold text-[#111] mb-3">Notifikasi</p>
        <div className="space-y-2.5">
          {dynamicNotifs.length === 0 ? (
            <p className="text-[12px] text-[#bbb]">Memuat notifikasi...</p>
          ) : dynamicNotifs.map((n, i) => (
            <div key={i} className="flex gap-2 items-start">
              <div className="h-2 w-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: n.color }} />
              <p className="text-[12px] text-[#555]">{n.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Banner stok menipis ── */}
      {lowStockItems.length > 0 && (
        <div className="rounded-lg border border-[#fde68a] bg-[#fffbeb] px-4 py-3 flex items-start gap-3">
          <span className="text-lg flex-shrink-0 mt-0.5">⚠️</span>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-[#92400e] mb-1.5">
              {lowStockItems.length} item stok menipis — segera lakukan pembelian
            </p>
            <div className="flex flex-wrap gap-2">
              {lowStockItems.map(item => {
                // Konversi ke satuan lebih kecil untuk display
                const s = item.satuan.toLowerCase()
                let displayStok = `${item.stok}`
                let displayMin  = `${item.stokMin}`
                let displaySat  = item.satuan
                if (s === 'liter') {
                  displayStok = `${(item.stok * 1000).toLocaleString('id-ID')}`
                  displayMin  = `${(item.stokMin * 1000).toLocaleString('id-ID')}`
                  displaySat  = 'ml'
                } else if (s === 'kg') {
                  displayStok = `${(item.stok * 1000).toLocaleString('id-ID')}`
                  displayMin  = `${(item.stokMin * 1000).toLocaleString('id-ID')}`
                  displaySat  = 'gram'
                } else if (s === 'roll' && item.notes && Number(item.notes) > 0) {
                  displayStok = `${(item.stok * Number(item.notes)).toLocaleString('id-ID')}`
                  displayMin  = `${(item.stokMin * Number(item.notes)).toLocaleString('id-ID')}`
                  displaySat  = 'm'
                }
                return (
                  <span key={item.nama}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#fef3c7] border border-[#fde68a] px-2.5 py-1 text-[11px] font-semibold text-[#92400e]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#f59e0b] flex-shrink-0" />
                    {item.nama}
                    <span className="font-normal text-[#b45309]">{displayStok} / {displayMin} {displaySat}</span>
                  </span>
                )
              })}
            </div>
          </div>
          <button onClick={() => navigate('/admin/purchases/orders')}
            className="flex-shrink-0 rounded border border-[#fde68a] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#92400e] hover:bg-[#fef3c7] transition whitespace-nowrap">
            Buat PO
          </button>
        </div>
      )}

      {overdueServices.length > 0 && (
        <div className="rounded-lg border border-[#fecaca] bg-[#fff7f7] px-4 py-3 flex items-start gap-3">
          <span className="text-lg flex-shrink-0 mt-0.5">!</span>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-[#991b1b] mb-1.5">
              Layanan melewati durasi paket
            </p>
            <div className="flex flex-wrap gap-2">
              {overdueServices.slice(0, 5).map((item, idx) => (
                <span key={`${item.customer}-${idx}`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white border border-[#fecaca] px-2.5 py-1 text-[11px] font-semibold text-[#991b1b]">
                  {item.customer} - {item.layanan}
                  <span className="font-normal text-[#dc2626]">
                    lewat {fmtDuration(item.elapsed - item.target, jamKerja)}
                  </span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {upcomingShortages.length > 0 && (
        <div className="rounded-lg border border-[#fecaca] bg-[#fef2f2] px-4 py-3 flex items-start gap-3">
          <span className="text-lg flex-shrink-0 mt-0.5">!</span>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-[#991b1b] mb-1.5">
              Material untuk booking mendatang belum cukup
            </p>
            <div className="flex flex-wrap gap-2">
              {upcomingShortages.slice(0, 5).map(item => (
                <span key={item.inventoryId}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white border border-[#fecaca] px-2.5 py-1 text-[11px] font-semibold text-[#991b1b]">
                  {item.nama}
                  <span className="font-normal text-[#dc2626]">
                    kurang {item.shortage.toLocaleString('id-ID')} {item.satuan}
                  </span>
                </span>
              ))}
              {upcomingShortages.length > 5 && (
                <span className="rounded-full bg-white border border-[#fecaca] px-2.5 py-1 text-[11px] font-semibold text-[#991b1b]">
                  +{upcomingShortages.length - 5} material
                </span>
              )}
            </div>
          </div>
          <button onClick={() => navigate('/admin/purchases/orders')}
            className="flex-shrink-0 rounded border border-[#fecaca] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#991b1b] hover:bg-[#fee2e2] transition whitespace-nowrap">
            Buat PO
          </button>
        </div>
      )}

      {/* Cards — reorderable via drag */}
      {(['stats','calendar-kanban','sla','sla-detail'] as CardId[]).map(id => {
        const order = cardOrder.indexOf(id)
        const DH = () => <DragHandle id={id} />
        return (
          <div key={id} style={{ order }}
            className="relative group/drag"
            onDragEnter={() => onDragEnter(id)}
            onDragOver={e => e.preventDefault()}>
            <DH />
            {id === 'stats' && (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(card => (
          <div key={card.label} className="rounded-lg border border-wm-line bg-white p-5">
            <p className="text-xs text-[#999]">{card.label}</p>
            <p className={`mt-2 text-4xl font-bold leading-tight ${card.accent ? 'text-brand' : 'text-[#111]'}`}>{card.value}</p>
            <p className="mt-1 text-xs text-[#16a34a]">{card.sub}</p>
          </div>
        ))}
      </div>)}
            {id === 'sla' && (
      <div className="rounded-lg border border-wm-line bg-white p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-base">⏱</span>
            <p className="text-sm font-bold text-[#111]">SLA — Waktu Pengerjaan</p>
            <p className="text-[11px] text-[#bbb]">
              {slaData?.businessHours ? `· jam kerja ${opSchedule?.startTime}–${opSchedule?.endTime}` : '· raw time'}
            </p>
          </div>
          <span className="text-[11px] text-[#aaa]">{slaData ? `${slaData.count} servis selesai` : ''}</span>
        </div>

        {!slaData ? (
          <p className="text-[12px] text-[#bbb] text-center py-6">
            Tandai pekerjaan sebagai <strong>Selesai</strong> untuk mulai melacak SLA.
          </p>
        ) : (
          <div className="space-y-4">
            {/* Scorecard — 3 angka besar */}
            <div className="grid grid-cols-4 gap-3">
              <div className="rounded-lg bg-[#f8fafc] border border-wm-line px-4 py-3 text-center">
                <p className="text-[10px] font-semibold text-[#aaa] uppercase tracking-wide mb-1">Rata-rata</p>
                <p className="text-2xl font-black leading-none" style={{ color: slaColor(slaData.avgMinutes, jamKerja, slaData.avgTargetMinutes) }}>
                  {fmtDuration(slaData.avgMinutes, jamKerja)}
                </p>
                <div className="mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5"
                  style={{ backgroundColor: slaColor(slaData.avgMinutes, jamKerja, slaData.avgTargetMinutes) + '18' }}>
                  <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: slaColor(slaData.avgMinutes, jamKerja, slaData.avgTargetMinutes) }} />
                  <span className="text-[9px] font-semibold" style={{ color: slaColor(slaData.avgMinutes, jamKerja, slaData.avgTargetMinutes) }}>
                    {slaLabel(slaData.avgMinutes, jamKerja, slaData.avgTargetMinutes)}
                  </span>
                </div>
              </div>
              <div className="rounded-lg bg-[#f8fafc] border border-wm-line px-4 py-3 text-center">
                <p className="text-[10px] font-semibold text-[#aaa] uppercase tracking-wide mb-1">Target Paket</p>
                <p className="text-2xl font-black leading-none text-brand">
                  {fmtDuration(slaData.avgTargetMinutes, jamKerja)}
                </p>
                <p className="mt-2 text-[9px] font-semibold text-[#64748b]">rata-rata durasi layanan</p>
              </div>
              <div className="rounded-lg bg-[#f8fafc] border border-wm-line px-4 py-3 text-center">
                <p className="text-[10px] font-semibold text-[#aaa] uppercase tracking-wide mb-1">Sesuai Target</p>
                <p className="text-2xl font-black leading-none text-[#16a34a]">
                  {Math.round((slaData.onTargetCount / slaData.count) * 100)}%
                </p>
                <p className="mt-2 text-[9px] font-semibold text-[#64748b]">{slaData.onTargetCount} dari {slaData.count} servis</p>
              </div>
              <div className="rounded-lg bg-[#f8fafc] border border-wm-line px-4 py-3 text-center">
                <p className="text-[10px] font-semibold text-[#aaa] uppercase tracking-wide mb-1">🐢 Terlama</p>
                <p className="text-2xl font-black leading-none text-[#dc2626]">
                  {fmtDuration(slaData.maxMinutes, jamKerja)}
                </p>
              </div>
            </div>

            {/* Per layanan */}
            {slaData.byService.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <p className="text-[10px] font-semibold text-[#bbb] uppercase tracking-wide mb-2">Rata-rata Per Layanan</p>
                {slaData.byService.map(row => {
                  const color = slaColor(row.avg, jamKerja, row.target)
                  return (
                    <div key={row.title} className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#f8fafc]">
                      <p className="text-[12px] text-[#555] truncate">{row.title}</p>
                      <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                        <p className="text-[13px] font-bold" style={{ color }}>{fmtDuration(row.avg, jamKerja)}</p>
                        <span className="text-[10px] text-[#888]">target {fmtDuration(row.target, jamKerja)}</span>
                        <span className="text-[10px] font-semibold text-[#16a34a]">{Math.round((row.onTarget / row.count) * 100)}%</span>
                        <span className="text-[10px] text-[#bbb]">{row.count}x</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>)}
            {id === 'sla-detail' && slaRows.length > 0 && (
        <div className="rounded-lg border border-wm-line bg-white overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-[#f1f5f9] bg-[#f8fafc]">
            <p className="text-[12px] font-bold text-[#555]">Riwayat SLA</p>
            <p className="text-[11px] text-[#aaa]">
              {slaRows.length > 30 ? `30 dari ${slaRows.length} pekerjaan terbaru` : `${slaRows.length} pekerjaan`}
            </p>
          </div>
          <div className="grid grid-cols-[1.2fr_1.4fr_1.5fr_1.5fr_0.9fr_0.9fr] px-5 py-2 bg-[#f8fafc] border-b border-[#f1f5f9]">
            {['Pelanggan', 'Layanan', 'Masuk', 'Selesai', 'Target', 'Durasi'].map(h => (
              <p key={h} className="text-[10px] font-bold text-[#888]">{h}</p>
            ))}
          </div>
          <div className="overflow-y-auto max-h-[320px]">
            {slaRows.slice(0, 30).map((row, i) => (
              <div key={i} className="grid grid-cols-[1.2fr_1.4fr_1.5fr_1.5fr_0.9fr_0.9fr] items-center px-5 py-2.5 border-b border-[#f1f5f9] last:border-b-0 hover:bg-[#fafbfc]">
                <p className="text-[12px] font-semibold text-[#111]">{row.customer}</p>
                <p className="text-[12px] text-[#555]">{row.layanan}</p>
                <p className="text-[11px] text-[#888]">{row.masuk}</p>
                <p className="text-[11px] text-[#888]">{row.selesai}</p>
                <p className="text-[11px] font-semibold text-brand">{fmtDuration(row.target, jamKerja)}</p>
                <p className="text-[12px] font-bold" style={{ color: slaColor(row.durasi, jamKerja, row.target) }}>
                  {fmtDuration(row.durasi, jamKerja)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
            {id === 'calendar-kanban' && (
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">

        {/* Calendar */}
        <div className="rounded-lg border border-wm-line bg-white p-4 space-y-4">
          <MiniCalendar
            selectedDate={selectedDate}
            onSelect={setSelectedDate}
            calYear={calYear}
            calMonth={calMonth}
            onPrev={prevMonth}
            onNext={nextMonth}
            events={events}
          />
          <hr className="border-[#f1f5f9]" />
          <div>
            <p className="text-[11px] font-bold text-[#888] mb-2">
              {selectedDate} {MONTH_NAMES[calMonth]} — {selectedEvents.length} booking
            </p>
            {selectedEvents.length === 0 ? (
              <p className="text-[11px] text-[#bbb]">Tidak ada booking</p>
            ) : (
              <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-1">
                {selectedEvents.map((e, i) => (
                  <div key={i} className="flex items-start gap-2 rounded border border-[#f1f5f9] bg-[#f8fafc] px-2.5 py-1.5">
                    <div className="h-1.5 w-1.5 rounded-full mt-1.5 flex-shrink-0"
                      style={{ background: COLUMN_CONFIG[e.status].color }} />
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-[#111] truncate">{e.customer}</p>
                      <p className="text-[10px] text-[#888]">{e.time} · {e.layanan}</p>
                    </div>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                      style={{ background: COLUMN_CONFIG[e.status].color + '22', color: COLUMN_CONFIG[e.status].color }}>
                      {e.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Kanban */}
        <div className="rounded-lg border border-wm-line bg-white overflow-hidden">
          <div className="flex items-center gap-3 border-b border-[#f1f5f9] px-5 py-3">
            <p className="text-sm font-bold text-[#111]">Status Servis</p>
            <span className="rounded-full bg-[#e2e8f0] px-2.5 py-0.5 text-[11px] text-[#555]">
              {loading ? 'Memuat...' : 'Live dari database'}
            </span>
            <button onClick={fetchRegistrations}
              className="ml-auto text-[11px] text-brand hover:underline">
              ↻ Refresh
            </button>
          </div>
          <div className="grid grid-cols-4 min-h-[320px]">
            {COLUMNS.map((col, i) => {
              const cfg      = COLUMN_CONFIG[col]
              const colItems = items.filter(item => item.status === col)
              return (
                <div key={col} className={`p-3 ${i < 3 ? 'border-r border-[#f1f5f9]' : ''} ${i % 2 === 0 ? 'bg-[#fafafa]' : 'bg-white'}`}>
                  <div className="flex items-center gap-1.5 mb-3">
                    <div className="h-2 w-2 rounded-full" style={{ background: cfg.color }} />
                    <p className="text-[11px] font-bold text-[#888]">{COLUMN_LABEL[col]}</p>
                    <span className="ml-auto text-[10px] text-[#bbb]">{colItems.length}</span>
                  </div>
                  <div className="space-y-2">
                    {colItems.map(item => (
                      <div key={item.id} className="rounded border border-wm-line bg-white overflow-hidden"
                        style={{ borderLeft: `3px solid ${cfg.color}` }}>
                        <div className="px-2 pt-2 flex items-start justify-between gap-1">
                          <p className="text-[11px] text-[#444] leading-snug">{item.label}</p>
                          {item.scheduledDate && (
                            <span className="text-[9px] font-semibold text-[#888] bg-[#f1f5f9] rounded px-1.5 py-0.5 flex-shrink-0 mt-0.5 whitespace-nowrap">
                              {new Date(item.scheduledDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} {new Date(item.scheduledDate).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                        {item.licensePlate && (
                          <p className="px-2 text-[10px] text-[#888]">{item.licensePlate}</p>
                        )}
                        {item.teknisi.length > 0 && (
                          <div className="px-2 pb-1 flex flex-wrap gap-0.5 mt-0.5">
                            {item.teknisi.map(t => (
                              <span key={t} className="text-[9px] text-brand bg-brand-50 px-1.5 py-0.5 rounded-full">
                                {t.split(' ')[0]}
                              </span>
                            ))}
                          </div>
                        )}
                        {cfg.next && (
                          <button onClick={() => advance(item)}
                            className="w-full px-2 py-1 text-[10px] font-semibold transition text-left border-t border-[#f1f5f9] hover:bg-[#f8fafc]"
                            style={{ color: cfg.color }}>
                            ↑ {cfg.nextLabel}
                          </button>
                        )}
                        {item.status === 'ANTRI' && (
                          <div className="flex border-t border-[#f1f5f9]">
                            <button onClick={() => { setRescheduleItem(item); setRescheduleDate(''); setRescheduleTime('') }}
                              className="flex-1 px-2 py-1 text-[9px] text-[#555] hover:bg-[#f8fafc] transition border-r border-[#f1f5f9]">
                              📅 Jadwal Ulang
                            </button>
                            <button onClick={() => { setCancelConfirm(item); setCancelReason('') }}
                              className="flex-1 px-2 py-1 text-[9px] text-[#dc2626] hover:bg-[#fee2e2] transition">
                              ✕ Batalkan
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                    {colItems.length === 0 && !loading && (
                      <p className="text-[10px] text-[#ddd] text-center py-2">kosong</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>)}
          </div>
        )
      })}
    </div>
  )
}
