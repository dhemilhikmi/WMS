import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { expensesAPI, registrationsAPI, serviceMaterialsAPI, teknisiAPI } from '../../services/api'
import { MobileSubHeader } from '../MobileLayout'

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des']
const BAR_COLORS = ['#1E4FD8', '#3b82f6', '#60a5fa', '#93c5fd', '#D9E3FC']

const fmtRp = (n: number) => 'Rp ' + Math.round(Number(n) || 0).toLocaleString('id-ID')
const fmtShort = (n: number) => {
  const value = Number(n) || 0
  const sign = value < 0 ? '-' : ''
  const abs = Math.abs(value)
  if (abs >= 1_000_000_000) return `Rp ${sign}${(abs / 1_000_000_000).toFixed(1)}M`
  if (abs >= 1_000_000) return `Rp ${sign}${(abs / 1_000_000).toFixed(1)}jt`
  if (abs >= 1_000) return `Rp ${sign}${(abs / 1_000).toFixed(0)}rb`
  return `Rp ${sign}${abs.toLocaleString('id-ID')}`
}

function parseHpp(notes?: string): number {
  const match = notes?.match(/hpp:([0-9.]+)/i)
  return match ? Number(match[1]) || 0 : 0
}

function isOperationalExpense(expense: any) {
  const category = String(expense.kategori || '').toLowerCase()
  return category !== 'material' && !expense.refPO
}

function inMonth(dateStr: string | undefined, month: number, year: number) {
  if (!dateStr) return false
  const d = new Date(dateStr)
  return d.getMonth() === month && d.getFullYear() === year
}

function usePeriod() {
  const today = new Date()
  const [month, setMonth] = useState(today.getMonth())
  const [year, setYear] = useState(today.getFullYear())
  const prev = () => {
    if (month === 0) {
      setMonth(11)
      setYear(y => y - 1)
    } else {
      setMonth(m => m - 1)
    }
  }
  const next = () => {
    if (month === 11) {
      setMonth(0)
      setYear(y => y + 1)
    } else {
      setMonth(m => m + 1)
    }
  }
  return { month, year, prev, next }
}

function useAnalyticsData() {
  const { tenant } = useAuth()
  const [regs, setRegs] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [teknisi, setTeknisi] = useState<any[]>([])
  const [hppMap, setHppMap] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    if (!tenant?.id) return
    setLoading(true)
    try {
      const [regRes, expRes, techRes] = await Promise.all([
        registrationsAPI.list(tenant.id),
        expensesAPI.list(),
        teknisiAPI.list(),
      ])
      const nextRegs = regRes.data.data || []
      setRegs(nextRegs)
      setExpenses(expRes.data.data || [])
      setTeknisi(techRes.data.data || [])

      const workshopIds = [...new Set<string>(nextRegs.map((r: any) => r.workshopId).filter(Boolean))]
      const entries = await Promise.all(workshopIds.map(id =>
        serviceMaterialsAPI.list(id)
          .then(res => [id, Number(res.data.hpp || 0)] as const)
          .catch(() => [id, 0] as const)
      ))
      setHppMap(Object.fromEntries(entries))
    } finally {
      setLoading(false)
    }
  }, [tenant?.id])

  useEffect(() => { fetchData() }, [fetchData])
  return { regs, expenses, teknisi, hppMap, loading, fetchData }
}

function PeriodNav({ month, year, subtitle, onPrev, onNext }: { month: number; year: number; subtitle: string; onPrev: () => void; onNext: () => void }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-wm-line bg-white p-3">
      <button onClick={onPrev} className="h-9 w-9 rounded-full bg-wm-bg text-[16px] font-bold">&lt;</button>
      <div className="text-center">
        <p className="text-[13px] font-bold">{MONTHS[month]} {year}</p>
        <p className="text-[10px] text-ink-4">{subtitle}</p>
      </div>
      <button onClick={onNext} className="h-9 w-9 rounded-full bg-wm-bg text-[16px] font-bold">&gt;</button>
    </div>
  )
}

function Stat({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-wm-line bg-white p-3">
      <span className="mb-1.5 block h-2 w-2 rounded-full" style={{ background: color }} />
      <p className="truncate text-[17px] font-extrabold leading-tight" style={{ color }}>{value}</p>
      <p className="mt-1 truncate text-[10px] text-ink-3">{label}</p>
      {sub && <p className="mt-0.5 truncate text-[10px] text-ink-4">{sub}</p>}
    </div>
  )
}

function Trend({ pct }: { pct: number | null }) {
  const neutral = pct === null || pct === 0
  const color = neutral ? '#64748b' : pct > 0 ? '#16a34a' : '#dc2626'
  const text = pct === null ? 'Bulan pertama' : `${pct > 0 ? '+' : ''}${pct}%`
  return (
    <div className="rounded-2xl border border-wm-line bg-white p-3">
      <p className="text-[10px] text-ink-4">Perubahan</p>
      <p className="mt-1 text-[16px] font-bold" style={{ color }}>{text}</p>
    </div>
  )
}

function MiniBars({ values, labels, color }: { values: number[]; labels?: string[]; color: string }) {
  const max = Math.max(...values, 1)
  return (
    <div className="rounded-2xl border border-wm-line bg-white p-4">
      <div className="flex h-[110px] items-end gap-1">
        {values.map((v, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <div
              className="w-full rounded-t"
              style={{
                height: v > 0 ? `${Math.max(4, (v / max) * 100)}%` : 2,
                background: v > 0 ? color : '#e2e8f0',
              }}
            />
            {labels && <p className="text-[9px] text-ink-4">{labels[i]}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}

function Breakdown({ title, rows, valueKind = 'money' }: { title: string; rows: { label: string; value: number; sub?: string }[]; valueKind?: 'money' | 'count' }) {
  const max = Math.max(...rows.map(r => r.value), 1)
  return (
    <div className="overflow-hidden rounded-2xl border border-wm-line bg-white">
      <div className="border-b border-[#f1f5f9] px-4 py-3">
        <p className="text-[13px] font-bold">{title}</p>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-[12px] text-[#aaa]">Belum ada data.</p>
      ) : (
        <div className="divide-y divide-[#f1f5f9]">
          {rows.map((row, i) => (
            <div key={`${row.label}-${i}`} className="px-4 py-3">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-bold"><span className="mr-1 text-[#aaa]">#{i + 1}</span>{row.label}</p>
                  {row.sub && <p className="mt-0.5 truncate text-[10px] text-ink-4">{row.sub}</p>}
                </div>
                <p className="shrink-0 text-[12px] font-bold text-brand">
                  {valueKind === 'money' ? fmtRp(row.value) : row.value}
                </p>
              </div>
              <div className="h-1.5 rounded-full bg-wm-bg">
                <div className="h-1.5 rounded-full" style={{ width: `${(row.value / max) * 100}%`, background: BAR_COLORS[i] || '#D9E3FC' }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function MobileSalesSummary() {
  const period = usePeriod()
  const { regs, loading, fetchData } = useAnalyticsData()

  const data = useMemo(() => {
    const selectedRegs = regs.filter(r => inMonth(r.updatedAt || r.scheduledDate || r.createdAt, period.month, period.year))
    const completed = selectedRegs.filter(r => r.status === 'completed')
    const outstanding = selectedRegs.filter(r => ['confirmed', 'in_progress', 'qc_check'].includes(r.status))
    const revenue = completed.reduce((s, r) => s + Number(r.workshop?.price || 0), 0)
    const outstandingValue = outstanding.reduce((s, r) => s + Number(r.workshop?.price || 0), 0)
    const avg = completed.length > 0 ? revenue / completed.length : 0
    const prevDate = new Date(period.year, period.month - 1, 1)
    const prevCompleted = regs.filter(r => r.status === 'completed' && inMonth(r.updatedAt || r.scheduledDate || r.createdAt, prevDate.getMonth(), prevDate.getFullYear()))
    const prevRevenue = prevCompleted.reduce((s, r) => s + Number(r.workshop?.price || 0), 0)
    const growth = prevRevenue > 0 ? Math.round(((revenue - prevRevenue) / prevRevenue) * 100) : null
    const days = new Date(period.year, period.month + 1, 0).getDate()
    const daily = Array(days).fill(0)
    completed.forEach(r => {
      const d = new Date(r.updatedAt || r.scheduledDate || r.createdAt)
      daily[d.getDate() - 1] += Number(r.workshop?.price || 0)
    })
    const serviceMap: Record<string, { count: number; revenue: number }> = {}
    completed.forEach(r => {
      const name = r.workshop?.title || 'Layanan'
      if (!serviceMap[name]) serviceMap[name] = { count: 0, revenue: 0 }
      serviceMap[name].count += 1
      serviceMap[name].revenue += Number(r.workshop?.price || 0)
    })
    const topServices = Object.entries(serviceMap)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([label, value]) => ({ label, value: value.revenue, sub: `${value.count} transaksi` }))
    const transactions = completed.map(r => ({
      id: r.id,
      customer: r.customer?.name || 'Pelanggan',
      vehicle: r.vehicleName ? `${r.vehicleName}${r.licensePlate ? ' - ' + r.licensePlate : ''}` : (r.licensePlate || '-'),
      service: r.workshop?.title || 'Layanan',
      price: Number(r.workshop?.price || 0),
      date: new Date(r.updatedAt || r.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
    }))
    return { selectedRegs, completed, outstanding, revenue, outstandingValue, avg, growth, daily, topServices, transactions }
  }, [regs, period.month, period.year])

  return (
    <>
      <MobileSubHeader title="Ringkasan Penjualan" subtitle={loading ? 'Memuat...' : `${data.completed.length} transaksi selesai`} />
      <div className="space-y-3 px-4 pb-4 pt-3">
        <PeriodNav month={period.month} year={period.year} subtitle="Periode penjualan" onPrev={period.prev} onNext={period.next} />
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Omset Bulan Ini" value={fmtShort(data.revenue)} color="#1E4FD8" />
          <Stat label="Invoice Lunas" value={String(data.completed.length)} color="#16a34a" sub={`dari ${data.selectedRegs.length} booking`} />
          <Stat label="Outstanding" value={fmtShort(data.outstandingValue)} color="#f59e0b" sub={`${data.outstanding.length} belum selesai`} />
          <Stat label="Avg. per Booking" value={fmtShort(data.avg)} color="#64748b" />
        </div>
        <Trend pct={data.growth} />
        <MiniBars values={data.daily} color="#1E4FD8" />
        <Breakdown title="Top Layanan" rows={data.topServices} />
        <div className="overflow-hidden rounded-2xl border border-wm-line bg-white">
          <div className="flex items-center justify-between border-b border-[#f1f5f9] px-4 py-3">
            <p className="text-[13px] font-bold">Transaksi Selesai</p>
            <button onClick={fetchData} className="text-[11px] font-semibold text-brand">Refresh</button>
          </div>
          {data.transactions.length === 0 ? (
            <p className="px-4 py-6 text-center text-[12px] text-[#aaa]">Belum ada transaksi selesai bulan ini.</p>
          ) : (
            <div className="divide-y divide-[#f1f5f9]">
              {data.transactions.map(row => (
                <div key={row.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-bold">{row.customer}</p>
                      <p className="mt-0.5 truncate text-[10px] text-ink-4">{row.vehicle}</p>
                      <p className="mt-0.5 truncate text-[10px] text-ink-3">{row.service}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[12px] font-bold text-brand">{fmtRp(row.price)}</p>
                      <p className="mt-0.5 text-[10px] text-ink-4">{row.date}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export function MobileAnalytics() {
  const period = usePeriod()
  const { regs, expenses, teknisi, hppMap, loading } = useAnalyticsData()

  const data = useMemo(() => {
    const completed = regs.filter(r => r.status === 'completed')
    const monthCompleted = completed.filter(r => inMonth(r.updatedAt || r.createdAt, period.month, period.year))
    const prevDate = new Date(period.year, period.month - 1, 1)
    const prevCompleted = completed.filter(r => inMonth(r.updatedAt || r.createdAt, prevDate.getMonth(), prevDate.getFullYear()))
    const revenue = monthCompleted.reduce((s, r) => s + Number(r.workshop?.price || 0), 0)
    const prevRevenue = prevCompleted.reduce((s, r) => s + Number(r.workshop?.price || 0), 0)
    const hpp = monthCompleted.reduce((s, r) => {
      const notesHpp = parseHpp(r.notes)
      return s + (notesHpp > 0 ? notesHpp : Number(hppMap[r.workshopId] || 0))
    }, 0)
    const operationalExpense = expenses
      .filter(e => isOperationalExpense(e) && inMonth(e.tanggal, period.month, period.year))
      .reduce((s, e) => s + Number(e.jumlah || 0), 0)
    const revenueTrend = prevRevenue > 0 ? Math.round(((revenue - prevRevenue) / prevRevenue) * 100) : null
    const jobsTrend = prevCompleted.length > 0 ? Math.round(((monthCompleted.length - prevCompleted.length) / prevCompleted.length) * 100) : null
    const customers: Record<string, string> = {}
    regs.forEach(r => {
      if (r.customer?.id && r.createdAt && (!customers[r.customer.id] || r.createdAt < customers[r.customer.id])) {
        customers[r.customer.id] = r.createdAt
      }
    })
    const newCustomers = Object.values(customers).filter(date => inMonth(date, period.month, period.year)).length
    const last6 = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(period.year, period.month - (5 - i), 1)
      const rev = completed
        .filter(r => inMonth(r.updatedAt || r.createdAt, d.getMonth(), d.getFullYear()))
        .reduce((s, r) => s + Number(r.workshop?.price || 0), 0)
      return { label: SHORT_MONTHS[d.getMonth()], rev }
    })
    const serviceMap: Record<string, { title: string; count: number; revenue: number; hpp: number; hppRecorded: number }> = {}
    monthCompleted.forEach(r => {
      const key = r.workshop?.id || r.workshop?.title || 'unknown'
      const title = r.workshop?.title || 'Layanan'
      const notesHpp = parseHpp(r.notes)
      const bomHpp = Number(hppMap[r.workshopId] || 0)
      if (!serviceMap[key]) serviceMap[key] = { title, count: 0, revenue: 0, hpp: 0, hppRecorded: 0 }
      serviceMap[key].count += 1
      serviceMap[key].revenue += Number(r.workshop?.price || 0)
      serviceMap[key].hpp += notesHpp > 0 ? notesHpp : bomHpp
      if (notesHpp > 0) serviceMap[key].hppRecorded++
    })
    const topServices = Object.entries(serviceMap)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([, value]) => {
        const margin = value.revenue > 0 ? Math.round(((value.revenue - value.hpp) / value.revenue) * 100) : null
        const marginColor = margin === null ? '#94a3b8' : margin >= 30 ? '#16a34a' : margin >= 10 ? '#f59e0b' : '#dc2626'
        const marginStr = margin !== null ? `Margin ${margin}%` : 'Margin —'
        return { label: value.title, value: value.count, sub: `${fmtRp(value.revenue)} · ${marginStr}`, marginColor }
      })
    const techMap: Record<string, { jobs: number; spesialis: string[] }> = {}
    teknisi.forEach(t => { techMap[t.name] = { jobs: 0, spesialis: t.spesialis || [] } })
    monthCompleted.forEach(r => {
      const match = r.notes?.match(/^teknisi:([^|]+)/i)
      if (!match) return
      match[1].split(',').map((n: string) => n.trim()).filter(Boolean).forEach((name: string) => {
        if (!techMap[name]) techMap[name] = { jobs: 0, spesialis: [] }
        techMap[name].jobs += 1
      })
    })
    const techRows = Object.entries(techMap)
      .filter(([, value]) => value.jobs > 0)
      .sort((a, b) => b[1].jobs - a[1].jobs)
      .slice(0, 5)
      .map(([label, value]) => ({ label, value: value.jobs, sub: value.spesialis.join(', ') || 'Teknisi' }))
    const brandMap: Record<string, { count: number; revenue: number; services: Record<string, number> }> = {}
    regs.filter(r => r.vehicleBrand).forEach(r => {
      const brand = String(r.vehicleBrand || '').trim()
      if (!brand) return
      if (!brandMap[brand]) brandMap[brand] = { count: 0, revenue: 0, services: {} }
      brandMap[brand].count += 1
      if (r.status === 'completed') {
        brandMap[brand].revenue += Number(r.workshop?.price || 0)
        const service = r.workshop?.title || 'Layanan'
        brandMap[brand].services[service] = (brandMap[brand].services[service] || 0) + 1
      }
    })
    const brandRows = Object.entries(brandMap)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([label, value]) => ({
        label,
        value: value.count,
        sub: `Omset ${fmtRp(value.revenue)}`,
      }))
    return {
      revenue,
      hpp,
      grossProfit: revenue - hpp,
      operationalExpense,
      operatingProfit: revenue - hpp - operationalExpense,
      jobs: monthCompleted.length,
      revenueTrend,
      jobsTrend,
      newCustomers,
      totalCustomers: Object.keys(customers).length,
      last6,
      topServices,
      techRows,
      brandRows,
      completedCount: completed.length,
    }
  }, [regs, expenses, teknisi, hppMap, period.month, period.year])

  return (
    <>
      <MobileSubHeader title="Analitik Bengkel" subtitle={loading ? 'Memuat...' : `${MONTHS[period.month]} ${period.year}`} />
      <div className="space-y-3 px-4 pb-4 pt-3">
        <PeriodNav month={period.month} year={period.year} subtitle="Dashboard performa" onPrev={period.prev} onNext={period.next} />
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Pendapatan Bulan Ini" value={fmtShort(data.revenue)} color="#1E4FD8" />
          <Stat label="Pekerjaan Selesai" value={String(data.jobs)} color="#16a34a" />
          <Stat label="Laba Kotor" value={fmtShort(data.grossProfit)} color={data.grossProfit >= 0 ? '#8b5cf6' : '#dc2626'} sub={`HPP ${fmtShort(data.hpp)}`} />
          <Stat label="Pelanggan Baru" value={String(data.newCustomers)} color="#f59e0b" sub={`Total ${data.totalCustomers}`} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Trend pct={data.revenueTrend} />
          <Trend pct={data.jobsTrend} />
        </div>
        <div className="grid grid-cols-1 gap-3">
          <div className="rounded-2xl border border-wm-line bg-white p-4">
            <p className="mb-3 text-[13px] font-bold">Laba Rugi Bulan Ini</p>
            <Line label="Pendapatan" value={fmtRp(data.revenue)} color="#1E4FD8" />
            <Line label="HPP Material" value={`-${fmtRp(data.hpp)}`} color="#f97316" />
            <Line label="Pengeluaran Operasional" value={`-${fmtRp(data.operationalExpense)}`} color="#dc2626" />
            <div className="mt-2 border-t border-wm-line pt-2">
              <Line label="Laba Setelah Pengeluaran" value={fmtRp(data.operatingProfit)} color={data.operatingProfit >= 0 ? '#16a34a' : '#dc2626'} bold />
            </div>
            <p className="mt-3 text-[10px] text-ink-4">Formula: pendapatan - HPP material - pengeluaran operasional. Pembelian material dari PO tidak dihitung lagi sebagai operasional.</p>
          </div>
        </div>
        <MiniBars values={data.last6.map(m => m.rev)} labels={data.last6.map(m => m.label)} color="#1E4FD8" />
        <Breakdown title="Top 10 Layanan" rows={data.topServices} valueKind="count" />
        <Breakdown title="Performa Teknisi" rows={data.techRows} valueKind="count" />
        <Breakdown title="Analitik Merek Kendaraan" rows={data.brandRows} valueKind="count" />
      </div>
    </>
  )
}

function Line({ label, value, color, bold }: { label: string; value: string; color: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <p className="text-[12px] text-[#666]">{label}</p>
      <p className={`shrink-0 text-[13px] ${bold ? 'font-bold' : 'font-semibold'}`} style={{ color }}>{value}</p>
    </div>
  )
}

export default function MobileAnalyticsRouter() {
  const location = useLocation()
  if (location.pathname.includes('penjualan-ringkasan')) return <MobileSalesSummary />
  return <MobileAnalytics />
}
