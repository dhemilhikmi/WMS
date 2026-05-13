import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { registrationsAPI } from '../services/api'

const MONTH_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

const BAR_COLORS = ['#1E4FD8', '#3b82f6', '#60a5fa', '#93c5fd', '#D9E3FC']

function fmtRp(val: number): string {
  return 'Rp ' + Math.round(Number(val) || 0).toLocaleString('id-ID')
}

export default function SalesSummaryPage() {
  const { tenant } = useAuth()
  const today = new Date()
  const [selYear, setSelYear]   = useState(today.getFullYear())
  const [selMonth, setSelMonth] = useState(today.getMonth())
  const [allRegs, setAllRegs]   = useState<any[]>([])
  const [loading, setLoading]   = useState(true)

  const fetchRegs = useCallback(async () => {
    if (!tenant?.id) return
    try {
      setLoading(true)
      const res = await registrationsAPI.list(tenant.id)
      setAllRegs(res.data.data || [])
    } catch (err) {
      console.error('Failed to fetch registrations:', err)
    } finally {
      setLoading(false)
    }
  }, [tenant?.id])

  useEffect(() => { fetchRegs() }, [fetchRegs])

  const prevMonth = () => {
    if (selMonth === 0) { setSelYear(y => y - 1); setSelMonth(11) }
    else setSelMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (selMonth === 11) { setSelYear(y => y + 1); setSelMonth(0) }
    else setSelMonth(m => m + 1)
  }

  // Filter registrations for selected month
  const inMonth = allRegs.filter((r: any) => {
    const d = new Date(r.updatedAt || r.scheduledDate || r.createdAt)
    return d.getFullYear() === selYear && d.getMonth() === selMonth
  })

  const completed = inMonth.filter((r: any) => r.status === 'completed')
  const outstanding = inMonth.filter((r: any) => ['confirmed', 'in_progress', 'qc_check'].includes(r.status))

  const totalRevenue  = completed.reduce((s: number, r: any) => s + Number(r.workshop?.price || 0), 0)
  const totalOutstanding = outstanding.reduce((s: number, r: any) => s + Number(r.workshop?.price || 0), 0)
  const avgPerBooking = completed.length > 0 ? Math.round(totalRevenue / completed.length) : 0

  // Compare with previous month
  const prevMonthRegs = allRegs.filter((r: any) => {
    const d = new Date(r.updatedAt || r.scheduledDate || r.createdAt)
    const pm = selMonth === 0 ? 11 : selMonth - 1
    const py = selMonth === 0 ? selYear - 1 : selYear
    return d.getFullYear() === py && d.getMonth() === pm && r.status === 'completed'
  })
  const prevRevenue = prevMonthRegs.reduce((s: number, r: any) => s + Number(r.workshop?.price || 0), 0)
  const revGrowth = prevRevenue > 0 ? Math.round(((totalRevenue - prevRevenue) / prevRevenue) * 100) : null

  const stats = [
    {
      label: 'Omset Bulan Ini',
      value: loading ? '...' : fmtRp(totalRevenue),
      sub: revGrowth !== null
        ? `${revGrowth >= 0 ? '↑' : '↓'} ${Math.abs(revGrowth)}% vs bulan lalu`
        : 'Bulan pertama',
      accent: true,
      subColor: revGrowth !== null && revGrowth >= 0 ? '#16a34a' : '#ef4444',
    },
    {
      label: 'Invoice Lunas',
      value: loading ? '...' : String(completed.length),
      sub: `dari ${inMonth.length} booking`,
      accent: false,
      subColor: '#888',
    },
    {
      label: 'Outstanding',
      value: loading ? '...' : fmtRp(totalOutstanding),
      sub: `${outstanding.length} belum selesai`,
      accent: false,
      subColor: totalOutstanding > 0 ? '#f59e0b' : '#888',
    },
    {
      label: 'Avg. per Booking',
      value: loading ? '...' : fmtRp(avgPerBooking),
      sub: 'layanan selesai',
      accent: false,
      subColor: '#888',
    },
  ]

  // Daily revenue chart
  const daysInMonth = new Date(selYear, selMonth + 1, 0).getDate()
  const dailyRev = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1
    return completed
      .filter((r: any) => new Date(r.updatedAt || r.scheduledDate || r.createdAt).getDate() === day)
      .reduce((s: number, r: any) => s + Number(r.workshop?.price || 0), 0)
  })
  const maxRev = Math.max(...dailyRev, 1)
  const todayDay = today.getFullYear() === selYear && today.getMonth() === selMonth ? today.getDate() : -1

  // Top services
  const serviceCount: Record<string, number> = {}
  completed.forEach((r: any) => {
    const name = r.workshop?.title || 'Layanan'
    serviceCount[name] = (serviceCount[name] || 0) + 1
  })
  const topServices = Object.entries(serviceCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count], i) => ({
      name,
      count,
      pct: completed.length > 0 ? Math.round((count / completed.length) * 100) : 0,
      color: BAR_COLORS[i] || '#D9E3FC',
    }))

  // Transaksi selesai bulan ini
  const transaksi = completed.map((r: any) => ({
    pelanggan: r.customer?.name || '—',
    kendaraan: r.vehicleName ? `${r.vehicleName}${r.licensePlate ? ' · ' + r.licensePlate : ''}` : (r.licensePlate || '—'),
    layanan: r.workshop?.title || '—',
    harga: Number(r.workshop?.price || 0),
    tanggal: new Date(r.updatedAt || r.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
  }))

  return (
    <div className="p-6 space-y-5">
      {/* Month selector */}
      <div className="flex items-center justify-between">
        <h1 className="text-base font-bold text-[#111]">Ringkasan Penjualan</h1>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="h-7 w-7 rounded border border-[#e2e8f0] hover:bg-[#f8fafc] text-[#888] text-sm">‹</button>
          <span className="text-sm font-semibold text-[#111] w-36 text-center">
            {MONTH_NAMES[selMonth]} {selYear}
          </span>
          <button onClick={nextMonth} className="h-7 w-7 rounded border border-[#e2e8f0] hover:bg-[#f8fafc] text-[#888] text-sm">›</button>
          <button onClick={fetchRegs} className="ml-2 text-[11px] text-[#1E4FD8] hover:underline">↻ Refresh</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-[#e2e8f0] bg-white p-5">
            <p className="text-xs text-[#999]">{s.label}</p>
            <p className={`mt-2 text-3xl font-bold ${s.accent ? 'text-[#1E4FD8]' : 'text-[#111]'}`}>{s.value}</p>
            <p className="mt-1 text-xs" style={{ color: s.subColor }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        {/* Daily revenue */}
        <div className="rounded-lg border border-[#e2e8f0] bg-white p-5">
          <p className="text-sm font-bold text-[#111] mb-4">
            Omset Harian — {MONTH_NAMES[selMonth]} {selYear}
          </p>
          {loading ? (
            <div className="h-[140px] flex items-center justify-center">
              <p className="text-[12px] text-[#aaa]">Memuat...</p>
            </div>
          ) : completed.length === 0 ? (
            <div className="h-[140px] flex items-center justify-center">
              <p className="text-[12px] text-[#aaa]">Belum ada transaksi selesai bulan ini</p>
            </div>
          ) : (
            <>
              <div className="flex items-end gap-0.5 h-[140px]">
                {dailyRev.map((v, i) => (
                  <div key={i} className="flex-1 rounded-t-sm transition-all"
                    style={{
                      height: `${Math.max((v / maxRev) * 100, v > 0 ? 4 : 0)}%`,
                      background: i + 1 === todayDay ? '#1E4FD8' : v > 0 ? '#93c5fd' : '#f1f5f9',
                      minHeight: v > 0 ? '4px' : '2px',
                    }}
                    title={v > 0 ? `${i + 1} ${MONTH_NAMES[selMonth]}: ${fmtRp(v)}` : undefined}
                  />
                ))}
              </div>
              <div className="flex justify-between mt-2">
                <p className="text-[10px] text-[#aaa]">1 {MONTH_NAMES[selMonth].slice(0, 3)}</p>
                <p className="text-[10px] text-[#aaa]">{daysInMonth} {MONTH_NAMES[selMonth].slice(0, 3)}</p>
              </div>
            </>
          )}
        </div>

        {/* Top services */}
        <div className="rounded-lg border border-[#e2e8f0] bg-white p-5">
          <p className="text-sm font-bold text-[#111] mb-4">Top Layanan</p>
          {loading ? (
            <p className="text-[12px] text-[#aaa]">Memuat...</p>
          ) : topServices.length === 0 ? (
            <p className="text-[12px] text-[#aaa]">Belum ada data layanan bulan ini</p>
          ) : (
            <div className="space-y-3">
              {topServices.map((s) => (
                <div key={s.name}>
                  <div className="flex justify-between mb-1">
                    <p className="text-[12px] text-[#555] truncate pr-2">{s.name}</p>
                    <p className="text-[12px] font-bold flex-shrink-0" style={{ color: s.color }}>{s.pct}%</p>
                  </div>
                  <div className="h-2 rounded-full bg-[#f1f5f9]">
                    <div className="h-2 rounded-full transition-all" style={{ width: `${s.pct}%`, background: s.color }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Transaksi selesai */}
      <div className="rounded-lg border border-[#e2e8f0] bg-white overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#f1f5f9]">
          <p className="text-sm font-bold text-[#111]">
            Transaksi Selesai — {MONTH_NAMES[selMonth]} {selYear}
          </p>
          <p className="text-[11px] text-[#aaa]">{transaksi.length} transaksi</p>
        </div>
        {loading ? (
          <p className="px-5 py-6 text-[12px] text-[#aaa]">Memuat...</p>
        ) : transaksi.length === 0 ? (
          <p className="px-5 py-6 text-center text-[12px] text-[#aaa]">
            Belum ada transaksi selesai bulan ini.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-[1.4fr_1.2fr_1.4fr_1.4fr_0.8fr] px-5 py-2.5 bg-[#f8fafc] border-b border-[#f1f5f9]">
              {['Pelanggan', 'Kendaraan', 'Layanan', 'Harga', 'Tanggal'].map(h => (
                <p key={h} className="text-[11px] font-bold text-[#888]">{h}</p>
              ))}
            </div>
            {transaksi.map((row, i) => (
              <div key={i} className="grid grid-cols-[1.4fr_1.2fr_1.4fr_1.4fr_0.8fr] items-center px-5 py-3 border-b border-[#f1f5f9] last:border-b-0 hover:bg-[#fafbfc]">
                <p className="text-[13px] font-semibold text-[#111]">{row.pelanggan}</p>
                <p className="text-[12px] text-[#555]">{row.kendaraan}</p>
                <p className="text-[12px] text-[#555]">{row.layanan}</p>
                <p className="text-[12px] font-semibold text-[#1E4FD8] whitespace-nowrap">{fmtRp(row.harga)}</p>
                <p className="text-[11px] text-[#888]">{row.tanggal}</p>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
