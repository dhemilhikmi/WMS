import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { registrationsAPI, expensesAPI, serviceMaterialsAPI, teknisiAPI } from '../services/api'

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des']
const FULL_MONTH  = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']

function fmtRp(n: number) {
  const value = Number(n) || 0
  const sign = value < 0 ? '-' : ''
  const abs = Math.abs(value)
  if (abs >= 1_000_000_000) return `Rp ${sign}${(abs / 1_000_000_000).toFixed(1)}M`
  if (abs >= 1_000_000)     return `Rp ${sign}${(abs / 1_000_000).toFixed(1)}jt`
  if (abs >= 1_000)         return `Rp ${sign}${(abs / 1_000).toFixed(0)}rb`
  return `Rp ${sign}${abs.toLocaleString('id-ID')}`
}

function fmtRpFull(n: number) {
  return 'Rp ' + (Number(n) || 0).toLocaleString('id-ID')
}

function fmtPct(n: number, signed = false) {
  const value = Number.isFinite(n) ? n : 0
  const sign = signed && value > 0 ? '+' : ''
  return `${sign}${value.toFixed(0)}%`
}

function parseHpp(notes?: string): number {
  const match = notes?.match(/hpp:([0-9.]+)/i)
  return match ? Number(match[1]) : 0
}

function isOperationalExpense(expense: any) {
  const category = String(expense.kategori || '').toLowerCase()
  return category !== 'material' && !expense.refPO
}

function Trend({ pct }: { pct: number }) {
  if (pct === 0) return <span className="text-[11px] text-[#aaa]">—</span>
  const up = pct > 0
  return (
    <span className={`text-[11px] font-semibold ${up ? 'text-[#16a34a]' : 'text-[#dc2626]'}`}>
      {up ? '▲' : '▼'} {Math.abs(pct).toFixed(0)}%
    </span>
  )
}

export default function TenantAnalyticsPage() {
  const { tenant } = useAuth()
  const navigate   = useNavigate()
  const [regs,     setRegs]     = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [teknisi,  setTeknisi]  = useState<any[]>([])
  const [workshopHppMap, setWorkshopHppMap] = useState<Record<string, number>>({})
  const [loading,  setLoading]  = useState(true)
  const [monthOffset, setMonthOffset] = useState(0) // 0 = bulan ini

  useEffect(() => {
    if (!tenant?.id) return
    setLoading(true)
    Promise.all([
      registrationsAPI.list(tenant.id),
      expensesAPI.list(),
      teknisiAPI.list(),
    ]).then(async ([r, e, t]) => {
      const regData = r.data.data || []
      setRegs(regData)
      setExpenses(e.data.data || [])
      setTeknisi(t.data.data || [])
      const uniqueWorkshopIds = [...new Set(regData.map((reg: any) => reg.workshopId).filter(Boolean))]
      const hppEntries = await Promise.all(
        uniqueWorkshopIds.map(id =>
          serviceMaterialsAPI.list(id as string)
            .then(res => [id, Number(res.data.hpp || 0)] as const)
            .catch(() => [id, 0] as const)
        )
      )
      setWorkshopHppMap(Object.fromEntries(hppEntries))
    }).catch(() => {}).finally(() => setLoading(false))
  }, [tenant?.id])

  const now = new Date()
  const targetDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1)
  const targetMonth = targetDate.getMonth()
  const targetYear  = targetDate.getFullYear()

  const prevDate  = new Date(targetYear, targetMonth - 1, 1)
  const prevMonth = prevDate.getMonth()
  const prevYear  = prevDate.getFullYear()

  function inMonth(dateStr: string, m: number, y: number) {
    const d = new Date(dateStr)
    return d.getMonth() === m && d.getFullYear() === y
  }

  // ── Revenue metrics ──────────────────────────────────────────────────────
  const completed = regs.filter(r => r.status === 'completed')

  const revThisMonth = useMemo(() =>
    completed.filter(r => inMonth(r.updatedAt || r.createdAt, targetMonth, targetYear))
      .reduce((s, r) => s + parseFloat(r.workshop?.price || '0'), 0),
    [completed, targetMonth, targetYear])

  const revPrevMonth = useMemo(() =>
    completed.filter(r => inMonth(r.updatedAt || r.createdAt, prevMonth, prevYear))
      .reduce((s, r) => s + parseFloat(r.workshop?.price || '0'), 0),
    [completed, prevMonth, prevYear])

  const revTrend = revPrevMonth > 0 ? ((revThisMonth - revPrevMonth) / revPrevMonth) * 100 : 0

  const jobsThisMonth = useMemo(() =>
    completed.filter(r => inMonth(r.updatedAt || r.createdAt, targetMonth, targetYear)).length,
    [completed, targetMonth, targetYear])

  const jobsPrevMonth = useMemo(() =>
    completed.filter(r => inMonth(r.updatedAt || r.createdAt, prevMonth, prevYear)).length,
    [completed, prevMonth, prevYear])

  const jobsTrend = jobsPrevMonth > 0 ? ((jobsThisMonth - jobsPrevMonth) / jobsPrevMonth) * 100 : 0

  const bookingsThisMonth = useMemo(() =>
    regs.filter(r => inMonth(r.createdAt || r.scheduledDate, targetMonth, targetYear)).length,
    [regs, targetMonth, targetYear])

  const bookingsPrevMonth = useMemo(() =>
    regs.filter(r => inMonth(r.createdAt || r.scheduledDate, prevMonth, prevYear)).length,
    [regs, prevMonth, prevYear])

  const bookingGrowth = bookingsPrevMonth > 0
    ? ((bookingsThisMonth - bookingsPrevMonth) / bookingsPrevMonth) * 100
    : bookingsThisMonth > 0 ? 100 : 0
  const bookingDelta = bookingsThisMonth - bookingsPrevMonth

  const conversionDoneRate = bookingsThisMonth > 0 ? (jobsThisMonth / bookingsThisMonth) * 100 : 0

  const expThisMonth = useMemo(() =>
    expenses.filter(e => isOperationalExpense(e) && inMonth(e.tanggal, targetMonth, targetYear))
      .reduce((s, e) => s + Number(e.jumlah || 0), 0),
    [expenses, targetMonth, targetYear])

  const hppThisMonth = useMemo(() =>
    completed.filter(r => inMonth(r.updatedAt || r.createdAt, targetMonth, targetYear))
      .reduce((s, r) => {
        const notesHpp = parseHpp(r.notes)
        return s + (notesHpp > 0 ? notesHpp : Number(workshopHppMap[r.workshopId] || 0))
      }, 0),
    [completed, targetMonth, targetYear, workshopHppMap])

  const grossProfitThisMonth = revThisMonth - hppThisMonth
  const grossMarginRate = revThisMonth > 0 ? (grossProfitThisMonth / revThisMonth) * 100 : 0
  const operatingProfitThisMonth = grossProfitThisMonth - expThisMonth

  const repeatCustomerRate = useMemo(() => {
    const visits: Record<string, number> = {}
    completed.forEach(r => {
      const customerId = r.customer?.id || r.customerId
      if (!customerId) return
      visits[customerId] = (visits[customerId] || 0) + 1
    })
    const totalCompletedCustomers = Object.keys(visits).length
    const repeatCustomers = Object.values(visits).filter(count => count > 1).length
    return totalCompletedCustomers > 0 ? (repeatCustomers / totalCompletedCustomers) * 100 : 0
  }, [completed])

  // New customers this month
  const allCustomers = useMemo(() => {
    const map: Record<string, string> = {}
    regs.forEach(r => {
      if (r.customer?.id && r.createdAt) {
        if (!map[r.customer.id] || r.createdAt < map[r.customer.id]) {
          map[r.customer.id] = r.createdAt
        }
      }
    })
    return map
  }, [regs])

  const newCustomersThisMonth = Object.values(allCustomers).filter(d => inMonth(d, targetMonth, targetYear)).length

  // ── Top 10 services ──────────────────────────────────────────────────────
  const top10 = useMemo(() => {
    const map: Record<string, { title: string; count: number; revenue: number; hpp: number; hppRecorded: number }> = {}
    completed
      .filter(r => inMonth(r.updatedAt || r.createdAt, targetMonth, targetYear))
      .forEach(r => {
        const id    = r.workshop?.id || 'unknown'
        const title = r.workshop?.title || 'Layanan'
        const price = parseFloat(r.workshop?.price || '0')
        const notesHpp = parseHpp(r.notes)
        const bomHpp   = Number(workshopHppMap[r.workshopId] || 0)
        if (!map[id]) map[id] = { title, count: 0, revenue: 0, hpp: 0, hppRecorded: 0 }
        map[id].count++
        map[id].revenue += price
        map[id].hpp += notesHpp > 0 ? notesHpp : bomHpp
        if (notesHpp > 0) map[id].hppRecorded++
      })
    return Object.values(map)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map(s => ({ ...s, margin: s.revenue > 0 ? ((s.revenue - s.hpp) / s.revenue) * 100 : null }))
  }, [completed, workshopHppMap, targetMonth, targetYear])

  const maxCount = top10[0]?.count || 1

  // ── Monthly revenue last 6 months ────────────────────────────────────────
  const last6Months = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(targetYear, targetMonth - (5 - i), 1)
      const m = d.getMonth()
      const y = d.getFullYear()
      const rev = completed
        .filter(r => inMonth(r.updatedAt || r.createdAt, m, y))
        .reduce((s, r) => s + parseFloat(r.workshop?.price || '0'), 0)
      return { label: MONTH_NAMES[m], rev }
    })
  }, [completed, targetMonth, targetYear])

  const maxBar = Math.max(...last6Months.map(m => m.rev), 1)

  // ── Technician performance this month ────────────────────────────────────
  const teknisiPerf = useMemo(() => {
    const map: Record<string, { name: string; jobs: number; spesialis: string[] }> = {}
    teknisi.forEach(t => {
      map[t.name] = { name: t.name, jobs: 0, spesialis: t.spesialis || [] }
    })
    completed
      .filter(r => inMonth(r.updatedAt || r.createdAt, targetMonth, targetYear))
      .forEach(r => {
        const m = r.notes?.match(/^teknisi:([^|]+)/)
        if (!m) return
        m[1].split(',').map((n: string) => n.trim()).filter(Boolean).forEach((name: string) => {
          if (!map[name]) map[name] = { name, jobs: 0, spesialis: [] }
          map[name].jobs++
        })
      })
    return Object.values(map).filter(t => t.jobs > 0).sort((a, b) => b.jobs - a.jobs).slice(0, 5)
  }, [teknisi, completed, targetMonth, targetYear])

  const maxJobs = teknisiPerf[0]?.jobs || 1

  // ── Vehicle brand analytics ───────────────────────────────────────────────
  const brandStats = useMemo(() => {
    const map: Record<string, { brand: string; count: number; revenue: number; services: Record<string, number> }> = {}
    regs.filter(r => r.vehicleBrand).forEach(r => {
      const brand = r.vehicleBrand!.trim()
      if (!brand) return
      if (!map[brand]) map[brand] = { brand, count: 0, revenue: 0, services: {} }
      map[brand].count++
      if (r.status === 'completed') {
        map[brand].revenue += parseFloat(r.workshop?.price || '0')
        const svc = r.workshop?.title || 'Layanan'
        map[brand].services[svc] = (map[brand].services[svc] || 0) + 1
      }
    })
    return Object.values(map).sort((a, b) => b.count - a.count).slice(0, 10)
  }, [regs])

  const maxBrandCount = brandStats[0]?.count || 1

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-3 text-[#888]">
          <div className="h-4 w-4 rounded-full border-2 border-[#1E4FD8] border-t-transparent animate-spin" />
          <p className="text-sm">Memuat data analitik...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 flex flex-col gap-5">

      {/* Header */}
      <div className="rounded-lg border border-[#e2e8f0] bg-white px-6 py-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#1E4FD8] mb-1">Analitik Bengkel</p>
          <h1 className="text-xl font-bold text-[#111]">Dashboard Performa</h1>
          <p className="mt-0.5 text-[12px] text-[#888]">Data real-time dari semua transaksi</p>
        </div>
        {/* Month nav */}
        <div className="flex items-center gap-2">
          <button onClick={() => setMonthOffset(o => o - 1)}
            className="h-8 w-8 rounded border border-[#e2e8f0] text-[#888] hover:bg-[#f8fafc] text-sm transition">‹</button>
          <div className="min-w-[130px] text-center">
            <p className="text-sm font-bold text-[#111]">{FULL_MONTH[targetMonth]} {targetYear}</p>
            {monthOffset === 0 && <p className="text-[10px] text-[#1E4FD8]">Bulan ini</p>}
          </div>
          <button onClick={() => setMonthOffset(o => Math.min(o + 1, 0))}
            disabled={monthOffset === 0}
            className="h-8 w-8 rounded border border-[#e2e8f0] text-[#888] hover:bg-[#f8fafc] text-sm transition disabled:opacity-30">›</button>
        </div>
        <button onClick={() => navigate('/admin/dashboard')}
          className="rounded-lg border border-[#e2e8f0] px-4 py-2 text-sm text-[#555] hover:bg-[#f8fafc] transition">
          ← Dashboard Operasional
        </button>
      </div>

      <div>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#1E4FD8]">Marketing KPI</p>
            <p className="mt-0.5 text-[12px] text-[#888]">Tolak ukur tenant untuk booking, konversi, repeat order, dan margin layanan</p>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: 'Pertumbuhan Booking',
              value: fmtPct(bookingGrowth, true),
              sub: `${bookingsThisMonth} bulan ini vs ${bookingsPrevMonth} bulan lalu (${bookingDelta >= 0 ? '+' : ''}${bookingDelta} booking)`,
              accent: '#1E4FD8',
            },
            {
              label: 'Konversi Selesai',
              value: fmtPct(conversionDoneRate),
              sub: 'Booking yang berubah menjadi pekerjaan selesai',
              accent: '#16a34a',
            },
            {
              label: 'Repeat Customer',
              value: fmtPct(repeatCustomerRate),
              sub: 'Customer yang kembali untuk layanan lanjutan',
              accent: '#f59e0b',
            },
            {
              label: 'Margin Terbaca',
              value: fmtPct(grossMarginRate),
              sub: `${fmtRp(grossProfitThisMonth)} laba setelah HPP material`,
              accent: grossProfitThisMonth >= 0 ? '#0f766e' : '#dc2626',
            },
          ].map(card => (
            <div key={card.label} className="rounded-lg border border-[#e2e8f0] bg-white p-5">
              <p className="text-xs font-semibold uppercase text-[#64748b]">{card.label}</p>
              <p className="mt-2 text-3xl font-bold leading-tight" style={{ color: card.accent }}>{card.value}</p>
              <p className="mt-1 text-[12px] leading-5 text-[#64748b]">{card.sub}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-[-8px]">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#1E4FD8]">Pendapatan & Pengeluaran</p>
        <p className="mt-0.5 text-[12px] text-[#888]">Ringkasan omzet, HPP, biaya operasional, dan laba periode ini</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Pendapatan Bulan Ini',
            value: fmtRp(revThisMonth),
            sub: fmtRpFull(revThisMonth),
            trend: revTrend,
            accent: '#1E4FD8',
          },
          {
            label: 'Pekerjaan Selesai',
            value: jobsThisMonth.toString(),
            sub: `${jobsPrevMonth} bulan lalu`,
            trend: jobsTrend,
            accent: '#16a34a',
          },
          {
            label: 'Laba Kotor',
            value: fmtRp(grossProfitThisMonth),
            sub: `HPP ${fmtRp(hppThisMonth)}`,
            trend: 0,
            accent: grossProfitThisMonth >= 0 ? '#8b5cf6' : '#dc2626',
          },
          {
            label: 'Pelanggan Baru',
            value: newCustomersThisMonth.toString(),
            sub: `Total ${Object.keys(allCustomers).length} pelanggan`,
            trend: 0,
            accent: '#f59e0b',
          },
        ].map(card => (
          <div key={card.label} className="rounded-lg border border-[#e2e8f0] bg-white p-5">
            <p className="text-xs text-[#999]">{card.label}</p>
            <p className="mt-2 text-3xl font-bold leading-tight" style={{ color: card.accent }}>{card.value}</p>
            <div className="mt-1 flex items-center gap-2">
              <p className="text-[11px] text-[#888]">{card.sub}</p>
              {card.trend !== 0 && <Trend pct={card.trend} />}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-[#e2e8f0] bg-white p-5">
          <p className="text-xs text-[#999]">HPP Material</p>
          <p className="mt-2 text-2xl font-bold text-[#f97316]">{fmtRp(hppThisMonth)}</p>
          <p className="mt-1 text-[11px] text-[#888]">Dari catatan HPP aktual atau setup BOM layanan</p>
        </div>
        <div className="rounded-lg border border-[#e2e8f0] bg-white p-5">
          <p className="text-xs text-[#999]">Pengeluaran Operasional</p>
          <p className="mt-2 text-2xl font-bold text-[#dc2626]">{fmtRp(expThisMonth)}</p>
          <p className="mt-1 text-[11px] text-[#888]">Tidak masuk ke laba kotor</p>
        </div>
        <div className="rounded-lg border border-[#e2e8f0] bg-white p-5">
          <p className="text-xs text-[#999]">Laba Setelah Pengeluaran</p>
          <p className={`mt-2 text-2xl font-bold ${operatingProfitThisMonth >= 0 ? 'text-[#16a34a]' : 'text-[#dc2626]'}`}>{fmtRp(operatingProfitThisMonth)}</p>
          <p className="mt-1 text-[11px] text-[#888]">Pendapatan - HPP - pengeluaran</p>
        </div>
      </div>

      {/* Revenue chart + Technician performance */}
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">

        {/* Bar chart 6 bulan */}
        <div className="rounded-lg border border-[#e2e8f0] bg-white p-5">
          <p className="text-sm font-bold text-[#111] mb-1">Pendapatan 6 Bulan Terakhir</p>
          <p className="text-[11px] text-[#aaa] mb-4">Berdasarkan pekerjaan selesai</p>
          <div className="flex items-end gap-3 h-[140px]">
            {last6Months.map((m, i) => {
              const pct    = Math.max((m.rev / maxBar) * 100, m.rev > 0 ? 4 : 0)
              const isLast = i === 5
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                  {m.rev > 0 && (
                    <p className="text-[9px] text-[#888] font-semibold">{fmtRp(m.rev)}</p>
                  )}
                  <div className="w-full rounded-t transition-all"
                    style={{ height: `${pct}%`, background: isLast ? '#1E4FD8' : '#93c5fd', minHeight: m.rev > 0 ? '4px' : '0' }} />
                  <p className={`text-[11px] font-semibold ${isLast ? 'text-[#1E4FD8]' : 'text-[#aaa]'}`}>{m.label}</p>
                </div>
              )
            })}
          </div>
        </div>

        {/* Technician performance */}
        <div className="rounded-lg border border-[#e2e8f0] bg-white p-5">
          <p className="text-sm font-bold text-[#111] mb-1">Performa Teknisi</p>
          <p className="text-[11px] text-[#aaa] mb-4">Pekerjaan selesai bulan ini</p>
          {teknisiPerf.length === 0 ? (
            <p className="text-[12px] text-[#bbb] text-center py-6">Belum ada data bulan ini</p>
          ) : (
            <div className="space-y-3">
              {teknisiPerf.map((t, i) => (
                <div key={t.name}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] text-[#bbb] w-3 flex-shrink-0">{i + 1}</span>
                      <p className="text-[12px] font-semibold text-[#111] truncate">{t.name}</p>
                    </div>
                    <span className="text-[12px] font-bold text-[#1E4FD8] flex-shrink-0 ml-2">{t.jobs} job</span>
                  </div>
                  {t.spesialis.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-1 ml-5">
                      {t.spesialis.map(s => (
                        <span key={s} className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#f1f5f9] text-[#475569] border border-[#e2e8f0]">{s}</span>
                      ))}
                    </div>
                  )}
                  <div className="ml-5 h-1.5 rounded-full bg-[#f1f5f9]">
                    <div className="h-1.5 rounded-full bg-[#1E4FD8] transition-all"
                      style={{ width: `${Math.round((t.jobs / maxJobs) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top 10 services */}
      <div className="rounded-lg border border-[#e2e8f0] bg-white overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#f1f5f9] bg-[#f8fafc]">
          <div>
            <p className="text-sm font-bold text-[#111]">Top 10 Layanan Terpopuler</p>
            <p className="text-[11px] text-[#aaa] mt-0.5">Berdasarkan semua waktu · pekerjaan selesai</p>
          </div>
          <span className="text-[11px] text-[#888]">{completed.length} total pekerjaan selesai</span>
        </div>

        {top10.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-[13px] text-[#bbb]">Belum ada pekerjaan selesai.</p>
            <p className="text-[11px] text-[#ccc] mt-1">Data akan muncul setelah ada pekerjaan dengan status Selesai.</p>
          </div>
        ) : (
          <div>
            {/* Table header */}
            <div className="grid px-5 py-2 border-b border-[#f1f5f9]"
              style={{ gridTemplateColumns: '2rem 1fr 7rem 8rem 7rem 7rem 6rem' }}>
              {['#', 'Layanan', 'Order', 'Pendapatan', 'HPP', 'Margin', 'Popularitas'].map(h => (
                <p key={h} className="text-[10px] font-bold text-[#888] uppercase tracking-wide">{h}</p>
              ))}
            </div>
            {top10.map((svc, i) => {
              const barPct = Math.round((svc.count / maxCount) * 100)
              const medal  = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null
              const marginColor = svc.margin === null ? '#aaa' : svc.margin >= 30 ? '#16a34a' : svc.margin >= 10 ? '#f59e0b' : '#dc2626'
              return (
                <div key={svc.title}
                  className="grid items-center px-5 py-3 border-b border-[#f1f5f9] last:border-b-0 hover:bg-[#fafbfc] transition"
                  style={{ gridTemplateColumns: '2rem 1fr 7rem 8rem 7rem 7rem 6rem' }}>
                  <span className="text-[11px] font-bold text-[#bbb]">
                    {medal || <span className="text-[#ccc]">{i + 1}</span>}
                  </span>
                  <div className="min-w-0 pr-4">
                    <p className="text-[13px] font-semibold text-[#111] truncate">{svc.title}</p>
                    {svc.hppRecorded < svc.count && svc.hpp > 0 && (
                      <p className="text-[9px] text-[#94a3b8]">HPP: {svc.hppRecorded}/{svc.count} tercatat</p>
                    )}
                  </div>
                  <p className="text-[13px] font-bold text-[#1E4FD8]">{svc.count}×</p>
                  <p className="text-[13px] font-semibold text-[#111]">{fmtRp(svc.revenue)}</p>
                  <p className="text-[12px] text-[#f59e0b]">{svc.hpp > 0 ? fmtRp(svc.hpp) : '—'}</p>
                  <p className="text-[12px] font-semibold" style={{ color: marginColor }}>
                    {svc.margin !== null ? `${svc.margin.toFixed(0)}%` : '—'}
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-[#f1f5f9]">
                      <div className="h-1.5 rounded-full bg-[#1E4FD8] transition-all"
                        style={{ width: `${barPct}%` }} />
                    </div>
                    <span className="text-[10px] text-[#aaa] flex-shrink-0">{barPct}%</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Vehicle brand analytics */}
      {brandStats.length > 0 && (
        <div className="rounded-lg border border-[#e2e8f0] bg-white overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#f1f5f9] bg-[#f8fafc]">
            <div>
              <p className="text-sm font-bold text-[#111]">Analitik Merek Kendaraan</p>
              <p className="text-[11px] text-[#aaa] mt-0.5">Semua kunjungan · urutkan berdasarkan frekuensi</p>
            </div>
            <span className="text-[11px] text-[#888]">{regs.filter(r => r.vehicleBrand).length} kendaraan tercatat</span>
          </div>
          <div className="p-5 space-y-3">
            {brandStats.map((b, i) => {
              const topService = Object.entries(b.services).sort((a, z) => z[1] - a[1])[0]
              const bar = Math.round((b.count / maxBrandCount) * 100)
              return (
                <div key={b.brand}>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-[11px] text-[#bbb] w-4 flex-shrink-0">{i + 1}</span>
                    <p className="text-[13px] font-bold text-[#111] w-24 flex-shrink-0">{b.brand}</p>
                    <div className="flex-1 h-2 rounded-full bg-[#f1f5f9]">
                      <div className="h-2 rounded-full bg-[#1E4FD8] transition-all" style={{ width: `${bar}%` }} />
                    </div>
                    <span className="text-[12px] font-bold text-[#1E4FD8] w-12 text-right flex-shrink-0">{b.count}×</span>
                    {b.revenue > 0 && (
                      <span className="text-[11px] text-[#888] w-24 text-right flex-shrink-0">{fmtRp(b.revenue)}</span>
                    )}
                    {topService && (
                      <span className="hidden lg:inline text-[10px] text-[#aaa] bg-[#f8fafc] px-2 py-0.5 rounded flex-shrink-0 max-w-[180px] truncate">
                        top: {topService[0]}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          {regs.filter(r => !r.vehicleBrand).length > 0 && (
            <div className="px-5 pb-4 text-[11px] text-[#bbb]">
              {regs.filter(r => !r.vehicleBrand).length} kunjungan tanpa data merek — isi merek saat booking untuk analitik lebih lengkap.
            </div>
          )}
        </div>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Riwayat Layanan',    path: '/admin/layanan/riwayat',  icon: '📋', desc: 'Semua pekerjaan selesai' },
          { label: 'Laporan Pendapatan', path: '/admin/finance/income',   icon: '💰', desc: 'Detail transaksi masuk' },
          { label: 'Ringkasan Keuangan', path: '/admin/finance/summary',  icon: '📊', desc: 'Laba rugi bulanan' },
          { label: 'Manajemen Teknisi',  path: '/admin/teknisi',          icon: '🔧', desc: 'Data & performa teknisi' },
        ].map(link => (
          <button key={link.path} onClick={() => navigate(link.path)}
            className="rounded-lg border border-[#e2e8f0] bg-white p-4 text-left hover:border-[#1E4FD8] hover:shadow-sm transition group">
            <p className="text-xl mb-2">{link.icon}</p>
            <p className="text-[13px] font-bold text-[#111] group-hover:text-[#1E4FD8] transition">{link.label}</p>
            <p className="text-[11px] text-[#aaa] mt-0.5">{link.desc}</p>
          </button>
        ))}
      </div>

    </div>
  )
}
