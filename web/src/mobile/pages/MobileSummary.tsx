import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { registrationsAPI, expensesAPI, serviceMaterialsAPI, teknisiAPI } from '../../services/api'
import { MobileSubHeader } from '../MobileLayout'

const fmtRp = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID')
const MONTH_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const BAR_COLORS = ['#1E4FD8', '#3b82f6', '#60a5fa', '#93c5fd', '#D9E3FC']
function parseHpp(notes?: string): number {
  const m = notes?.match(/hpp:([\d.]+)/)
  return m ? parseFloat(m[1]) : 0
}

function isOperationalExpense(expense: any) {
  const category = String(expense.kategori || '').toLowerCase()
  return category !== 'material' && !expense.refPO
}

const TITLES: Record<string, string> = {
  'penjualan-ringkasan':   'Ringkasan Penjualan',
  'aliran-kas':            'Aliran Kas',
  'ringkasan-keuangan':    'Ringkasan Keuangan',
  'analitik':              'Analitik Bengkel',
}

export default function MobileSummary() {
  const { tenant } = useAuth()
  const params = useParams<{ type: string }>()
  const location = useLocation()
  const type = params.type || location.pathname.split('/').filter(Boolean).pop() || ''
  const [regs, setRegs] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [teknisi, setTeknisi] = useState<any[]>([])
  const [workshopHppMap, setWorkshopHppMap] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const today = new Date()
  const [selYear, setSelYear] = useState(today.getFullYear())
  const [selMonth, setSelMonth] = useState(today.getMonth())

  useEffect(() => {
    if (!tenant?.id) return
    setLoading(true)
    Promise.all([
      registrationsAPI.list(tenant.id).then(r => r.data.data || []).catch(() => []),
      expensesAPI.list().then(r => r.data.data || []).catch(() => []),
      teknisiAPI.list().then(r => r.data.data || []).catch(() => []),
    ]).then(async ([r, e, t]) => {
      setRegs(r)
      setExpenses(e)
      setTeknisi(t)
      const uniqueWorkshopIds = [...new Set((r as any[]).map(reg => reg.workshopId).filter(Boolean))]
      const hppEntries = await Promise.all(
        uniqueWorkshopIds.map(id => serviceMaterialsAPI.list(id).then(res => [id, res.data.hpp || 0] as const).catch(() => [id, 0] as const))
      )
      setWorkshopHppMap(Object.fromEntries(hppEntries))
    }).finally(() => setLoading(false))
  }, [tenant?.id])

  const thisMonth = (d?: string) => {
    if (!d) return false
    const x = new Date(d)
    return x.getMonth() === today.getMonth() && x.getFullYear() === today.getFullYear()
  }

  const selectedMonth = (d?: string) => {
    if (!d) return false
    const x = new Date(d)
    return x.getMonth() === selMonth && x.getFullYear() === selYear
  }

  const salesSummary = useMemo(() => {
    const inMonth = regs.filter((r: any) => selectedMonth(r.updatedAt || r.scheduledDate || r.createdAt))
    const completed = inMonth.filter((r: any) => r.status === 'completed')
    const outstanding = inMonth.filter((r: any) => ['confirmed', 'in_progress', 'qc_check'].includes(r.status))
    const totalRevenue = completed.reduce((s: number, r: any) => s + Number(r.workshop?.price || 0), 0)
    const totalOutstanding = outstanding.reduce((s: number, r: any) => s + Number(r.workshop?.price || 0), 0)
    const avgPerBooking = completed.length > 0 ? Math.round(totalRevenue / completed.length) : 0

    const prevMonth = selMonth === 0 ? 11 : selMonth - 1
    const prevYear = selMonth === 0 ? selYear - 1 : selYear
    const prevCompleted = regs.filter((r: any) => {
      const d = new Date(r.updatedAt || r.scheduledDate || r.createdAt)
      return d.getFullYear() === prevYear && d.getMonth() === prevMonth && r.status === 'completed'
    })
    const prevRevenue = prevCompleted.reduce((s: number, r: any) => s + Number(r.workshop?.price || 0), 0)
    const revGrowth = prevRevenue > 0 ? Math.round(((totalRevenue - prevRevenue) / prevRevenue) * 100) : null

    const daysInMonth = new Date(selYear, selMonth + 1, 0).getDate()
    const dailyRev = Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1
      return completed
        .filter((r: any) => new Date(r.updatedAt || r.scheduledDate || r.createdAt).getDate() === day)
        .reduce((s: number, r: any) => s + Number(r.workshop?.price || 0), 0)
    })

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

    const transaksi = completed.map((r: any) => ({
      pelanggan: r.customer?.name || '-',
      kendaraan: r.vehicleName ? `${r.vehicleName}${r.licensePlate ? ' - ' + r.licensePlate : ''}` : (r.licensePlate || '-'),
      layanan: r.workshop?.title || '-',
      harga: Number(r.workshop?.price || 0),
      tanggal: new Date(r.updatedAt || r.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
    }))

    return { inMonth, completed, outstanding, totalRevenue, totalOutstanding, avgPerBooking, revGrowth, dailyRev, topServices, transaksi }
  }, [regs, selMonth, selYear])

  const prevSalesMonth = () => {
    if (selMonth === 0) { setSelYear(y => y - 1); setSelMonth(11) }
    else setSelMonth(m => m - 1)
  }
  const nextSalesMonth = () => {
    if (selMonth === 11) { setSelYear(y => y + 1); setSelMonth(0) }
    else setSelMonth(m => m + 1)
  }

  const analyticsSummary = useMemo(() => {
    const completed = regs.filter((r: any) => r.status === 'completed')
    const inMonth = (dateStr?: string, month = selMonth, year = selYear) => {
      if (!dateStr) return false
      const d = new Date(dateStr)
      return d.getMonth() === month && d.getFullYear() === year
    }
    const prevMonth = selMonth === 0 ? 11 : selMonth - 1
    const prevYear = selMonth === 0 ? selYear - 1 : selYear
    const monthCompleted = completed.filter((r: any) => inMonth(r.updatedAt || r.createdAt))
    const prevCompleted = completed.filter((r: any) => inMonth(r.updatedAt || r.createdAt, prevMonth, prevYear))
    const revThisMonth = monthCompleted.reduce((s: number, r: any) => s + Number(r.workshop?.price || 0), 0)
    const revPrevMonth = prevCompleted.reduce((s: number, r: any) => s + Number(r.workshop?.price || 0), 0)
    const expThisMonth = expenses
      .filter((e: any) => isOperationalExpense(e) && inMonth(e.tanggal))
      .reduce((s: number, e: any) => s + Number(e.jumlah || 0), 0)
    const hppThisMonth = monthCompleted.reduce((s: number, r: any) => {
      const notesHpp = parseHpp(r.notes)
      return s + (notesHpp > 0 ? notesHpp : Number(workshopHppMap[r.workshopId] || 0))
    }, 0)
    const revTrend = revPrevMonth > 0 ? Math.round(((revThisMonth - revPrevMonth) / revPrevMonth) * 100) : null
    const jobsTrend = prevCompleted.length > 0 ? Math.round(((monthCompleted.length - prevCompleted.length) / prevCompleted.length) * 100) : null

    const customers: Record<string, string> = {}
    regs.forEach((r: any) => {
      if (r.customer?.id && r.createdAt && (!customers[r.customer.id] || r.createdAt < customers[r.customer.id])) {
        customers[r.customer.id] = r.createdAt
      }
    })
    const newCustomers = Object.values(customers).filter(d => inMonth(d)).length

    const last6Months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(selYear, selMonth - (5 - i), 1)
      const month = d.getMonth()
      const year = d.getFullYear()
      const rev = completed
        .filter((r: any) => inMonth(r.updatedAt || r.createdAt, month, year))
        .reduce((s: number, r: any) => s + Number(r.workshop?.price || 0), 0)
      return { label: MONTH_NAMES[month].slice(0, 3), rev }
    })

    const topMap: Record<string, { title: string; count: number; revenue: number }> = {}
    completed.forEach((r: any) => {
      const id = r.workshop?.id || r.workshop?.title || 'unknown'
      const title = r.workshop?.title || 'Layanan'
      if (!topMap[id]) topMap[id] = { title, count: 0, revenue: 0 }
      topMap[id].count += 1
      topMap[id].revenue += Number(r.workshop?.price || 0)
    })
    const top10 = Object.values(topMap).sort((a, b) => b.count - a.count).slice(0, 10)

    const techMap: Record<string, { name: string; jobs: number; spesialis: string[] }> = {}
    teknisi.forEach((t: any) => {
      techMap[t.name] = { name: t.name, jobs: 0, spesialis: t.spesialis || [] }
    })
    monthCompleted.forEach((r: any) => {
      const match = r.notes?.match(/teknisi:([^|]+)/i)
      if (!match) return
      match[1].split(',').map((n: string) => n.trim()).filter(Boolean).forEach((name: string) => {
        if (!techMap[name]) techMap[name] = { name, jobs: 0, spesialis: [] }
        techMap[name].jobs += 1
      })
    })
    const teknisiPerf = Object.values(techMap).filter(t => t.jobs > 0).sort((a, b) => b.jobs - a.jobs).slice(0, 5)

    const brandMap: Record<string, { brand: string; count: number; revenue: number; services: Record<string, number> }> = {}
    regs.filter((r: any) => r.vehicleBrand).forEach((r: any) => {
      const brand = String(r.vehicleBrand || '').trim()
      if (!brand) return
      if (!brandMap[brand]) brandMap[brand] = { brand, count: 0, revenue: 0, services: {} }
      brandMap[brand].count += 1
      if (r.status === 'completed') {
        brandMap[brand].revenue += Number(r.workshop?.price || 0)
        const service = r.workshop?.title || 'Layanan'
        brandMap[brand].services[service] = (brandMap[brand].services[service] || 0) + 1
      }
    })
    const brandStats = Object.values(brandMap).sort((a, b) => b.count - a.count).slice(0, 10)
    const missingBrandCount = regs.filter((r: any) => !r.vehicleBrand).length

    return {
      revThisMonth,
      revTrend,
      jobsThisMonth: monthCompleted.length,
      jobsTrend,
      expThisMonth,
      hppThisMonth,
      grossProfitThisMonth: revThisMonth - hppThisMonth,
      operatingProfitThisMonth: revThisMonth - hppThisMonth - expThisMonth,
      newCustomers,
      totalCustomers: Object.keys(customers).length,
      last6Months,
      teknisiPerf,
      top10,
      brandStats,
      missingBrandCount,
      completedCount: completed.length,
    }
  }, [regs, expenses, teknisi, selMonth, selYear, workshopHppMap])

  const cashflowSummary = useMemo(() => {
    const entries = [
      ...regs.filter((r: any) => r.status === 'completed').map((r: any) => ({
        id: `reg-${r.id}`,
        tanggal: new Date(r.updatedAt || r.createdAt).toISOString().slice(0, 10),
        jenis: 'masuk' as const,
        kategori: 'Pembayaran Layanan',
        keterangan: `${r.workshop?.title || 'Layanan'} - ${r.customer?.name || 'Pelanggan'}`,
        referensi: `INV-${String(r.id).slice(-6).toUpperCase()}`,
        jumlah: Number(r.workshop?.price || 0),
      })),
      ...expenses.map((e: any) => ({
        id: `exp-${e.id}`,
        tanggal: new Date(e.tanggal).toISOString().slice(0, 10),
        jenis: 'keluar' as const,
        kategori: e.kategori || 'Lainnya',
        keterangan: e.keterangan || '-',
        referensi: e.refPO || '',
        jumlah: Number(e.jumlah || 0),
      })),
    ].filter(a => {
      const d = new Date(a.tanggal)
      return d.getMonth() === selMonth && d.getFullYear() === selYear
    }).sort((a, b) => a.tanggal.localeCompare(b.tanggal))

    const masuk = entries.filter(a => a.jenis === 'masuk').reduce((s, a) => s + a.jumlah, 0)
    const keluar = entries.filter(a => a.jenis === 'keluar').reduce((s, a) => s + a.jumlah, 0)
    const days = new Date(selYear, selMonth + 1, 0).getDate()
    const masukArr = Array(days).fill(0)
    const keluarArr = Array(days).fill(0)
    entries.forEach(a => {
      const day = new Date(a.tanggal).getDate() - 1
      if (a.jenis === 'masuk') masukArr[day] += a.jumlah
      else keluarArr[day] += a.jumlah
    })
    let running = 0
    const withBalance = entries.map(a => {
      running += a.jenis === 'masuk' ? a.jumlah : -a.jumlah
      return { ...a, saldo: running }
    })
    let dailyRunning = 0
    const cumulative = masukArr.map((m, i) => {
      dailyRunning += m - keluarArr[i]
      return dailyRunning
    })
    return { entries, withBalance, masuk, keluar, net: masuk - keluar, saldoAkhir: masuk - keluar, masukArr, keluarArr, cumulative }
  }, [regs, expenses, selMonth, selYear])

  const financeSummary = useMemo(() => {
    const monthly = Array.from({ length: 12 }, (_, m) => {
      const monthRegs = regs.filter((r: any) => {
        if (r.status !== 'completed') return false
        const d = new Date(r.updatedAt || r.createdAt)
        return d.getFullYear() === selYear && d.getMonth() === m
      })
      const monthExps = expenses.filter((e: any) => {
        if (!isOperationalExpense(e)) return false
        const d = new Date(e.tanggal)
        return d.getFullYear() === selYear && d.getMonth() === m
      })
      const pendapatan = monthRegs.reduce((s: number, r: any) => s + Number(r.workshop?.price || 0), 0)
      const hpp = monthRegs.reduce((s: number, r: any) => {
        const notesHpp = parseHpp(r.notes)
        return s + (notesHpp > 0 ? notesHpp : (workshopHppMap[r.workshopId] || 0))
      }, 0)
      const pengeluaran = monthExps.reduce((s: number, e: any) => s + Number(e.jumlah || 0), 0)
      return { month: m, label: MONTH_NAMES[m].slice(0, 3), pendapatan, hpp, pengeluaran, labaBersih: pendapatan - hpp - pengeluaran }
    })
    const active = monthly.filter(m => m.pendapatan > 0 || m.hpp > 0 || m.pengeluaran > 0)
    const ytd = {
      pendapatan: active.reduce((s, m) => s + m.pendapatan, 0),
      hpp: active.reduce((s, m) => s + m.hpp, 0),
      pengeluaran: active.reduce((s, m) => s + m.pengeluaran, 0),
      labaBersih: active.reduce((s, m) => s + m.labaBersih, 0),
    }
    const selRegs = regs.filter((r: any) => {
      if (r.status !== 'completed') return false
      const d = new Date(r.updatedAt || r.createdAt)
      return d.getFullYear() === selYear && d.getMonth() === selMonth
    })
    const selExps = expenses.filter((e: any) => {
      if (!isOperationalExpense(e)) return false
      const d = new Date(e.tanggal)
      return d.getFullYear() === selYear && d.getMonth() === selMonth
    })
    const incomeByService = groupSum(selRegs, (r: any) => r.workshop?.title || 'Layanan', (r: any) => Number(r.workshop?.price || 0))
    const expenseByCategory = groupSum(selExps, (e: any) => e.kategori || 'Lainnya', (e: any) => Number(e.jumlah || 0))
    return { monthly, active, ytd, selected: monthly[selMonth], incomeByService, expenseByCategory }
  }, [regs, expenses, selMonth, selYear, workshopHppMap])

  const completedThisMonth = regs.filter(r => r.status === 'completed' && thisMonth(r.updatedAt || r.createdAt))
  const lunasThisMonth = completedThisMonth.filter(r => r.paymentStatus === 'LUNAS')
  const totalLunas = lunasThisMonth.reduce((s, r) => s + Number(r.workshop?.price || 0), 0)
  const totalPotensi = completedThisMonth.reduce((s, r) => s + Number(r.workshop?.price || 0), 0)
  const totalHpp = completedThisMonth.reduce((s, r) => {
    const notesHpp = parseHpp(r.notes)
    return s + (notesHpp > 0 ? notesHpp : (workshopHppMap[r.workshopId] || 0))
  }, 0)
  const potentialProfit = totalPotensi - totalHpp
  const expenseThisMonth = expenses.filter(e => thisMonth(e.tanggal)).reduce((s, e) => s + Number(e.jumlah || 0), 0)

  // Top services
  const serviceMap = new Map<string, { count: number; total: number }>()
  completedThisMonth.forEach(r => {
    const name = r.workshop?.title || 'Lainnya'
    const cur = serviceMap.get(name) || { count: 0, total: 0 }
    cur.count++
    cur.total += Number(r.workshop?.price || 0)
    serviceMap.set(name, cur)
  })
  const topServices = Array.from(serviceMap.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 5)

  // Cashflow simple
  const cashIn = totalLunas
  const cashOut = expenseThisMonth

  return (
    <>
      <MobileSubHeader title={TITLES[type] || 'Ringkasan'} subtitle={`Bulan ${today.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}`} />
      <div className="px-4 pt-3 space-y-3 pb-4">
        {loading && <p className="text-center text-[12px] text-ink-4 py-6">Memuat...</p>}
        {!loading && type === 'penjualan-ringkasan' && (
          <SalesSummaryMobile
            data={salesSummary}
            selMonth={selMonth}
            selYear={selYear}
            onPrev={prevSalesMonth}
            onNext={nextSalesMonth}
          />
        )}
        {!loading && type === 'aliran-kas' && (
          <CashflowMobile
            data={cashflowSummary}
            selMonth={selMonth}
            selYear={selYear}
            onPrev={prevSalesMonth}
            onNext={nextSalesMonth}
          />
        )}
        {!loading && type === 'ringkasan-keuangan' && (
          <FinanceSummaryMobile
            data={financeSummary}
            selMonth={selMonth}
            selYear={selYear}
            setSelMonth={setSelMonth}
            setSelYear={setSelYear}
          />
        )}
        {!loading && type === 'analitik' && (
          <AnalyticsMobile
            data={analyticsSummary}
            selMonth={selMonth}
            selYear={selYear}
            onPrev={prevSalesMonth}
            onNext={nextSalesMonth}
          />
        )}
        {!loading && !['penjualan-ringkasan', 'aliran-kas', 'ringkasan-keuangan', 'analitik'].includes(type) && (
          <>
            {/* KPI cards */}
            <div className="grid grid-cols-2 gap-3">
              <Stat icon="💰" label="Pendapatan (Lunas)" value={fmtRp(totalLunas)} color="#16a34a" />
              <Stat icon="⏳" label="Potensi Pendapatan" value={fmtRp(totalPotensi - totalLunas)} color="#f59e0b" />
              <Stat icon="💸" label="HPP Material" value={fmtRp(totalHpp)} color="#dc2626" />
              <Stat icon="📈" label={potentialProfit >= 0 ? 'Potensi Keuntungan' : 'Potensi Rugi'} value={fmtRp(potentialProfit)} color={potentialProfit >= 0 ? '#1E4FD8' : '#dc2626'} />
            </div>

            <div className="bg-white rounded-2xl border border-wm-line p-4">
              <p className="text-[13px] font-bold mb-3">Ringkasan Potensi</p>
              <div className="space-y-2">
                <Row label="Potensi Pendapatan" value={fmtRp(totalPotensi)} color="#1E4FD8" />
                <Row label="HPP Material" value={`-${fmtRp(totalHpp)}`} color="#dc2626" />
                <div className="border-t border-wm-line pt-2 mt-2">
                  <Row label="Potensi Keuntungan" value={fmtRp(potentialProfit)} color={potentialProfit >= 0 ? '#16a34a' : '#dc2626'} bold />
                </div>
              </div>
              {totalHpp === 0 && totalPotensi > 0 && (
                <p className="text-[10px] text-[#f59e0b] mt-3">HPP masih 0. Pastikan BOM sudah diset di menu Layanan - Setup HPP.</p>
              )}
            </div>

            {(type === 'aliran-kas' || type === 'ringkasan-keuangan') && (
              <div className="bg-white rounded-2xl border border-wm-line p-4">
                <p className="text-[13px] font-bold mb-3">Aliran Kas Bulan Ini</p>
                <div className="space-y-2">
                  <Row label="Kas Masuk" value={fmtRp(cashIn)} color="#16a34a" />
                  <Row label="Kas Keluar" value={fmtRp(cashOut)} color="#dc2626" />
                  <div className="border-t border-wm-line pt-2 mt-2">
                    <Row label="Saldo Bersih" value={fmtRp(cashIn - cashOut)} color={cashIn - cashOut >= 0 ? '#1E4FD8' : '#dc2626'} bold />
                  </div>
                </div>
              </div>
            )}

            {(type === 'penjualan-ringkasan' || type === 'analitik') && topServices.length > 0 && (
              <div className="bg-white rounded-2xl border border-wm-line p-4">
                <p className="text-[13px] font-bold mb-3">Top 5 Layanan Bulan Ini</p>
                <div className="space-y-3">
                  {topServices.map(([name, s], i) => {
                    const max = topServices[0][1].total || 1
                    const pct = (s.total / max) * 100
                    return (
                      <div key={name}>
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-[12px] font-semibold truncate flex-1">
                            <span className="text-[#aaa] mr-1">#{i + 1}</span> {name}
                          </p>
                          <p className="text-[11px] text-[#666] flex-shrink-0">{s.count}x</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-wm-bg rounded-full overflow-hidden">
                            <div className="h-full bg-brand" style={{ width: `${pct}%` }} />
                          </div>
                          <p className="text-[10px] font-semibold text-brand flex-shrink-0">{fmtRp(s.total)}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-wm-line p-4">
              <p className="text-[13px] font-bold mb-3">Statistik Bulan Ini</p>
              <div className="space-y-2">
                <Row label="Total Layanan Selesai" value={completedThisMonth.length.toString()} />
                <Row label="Sudah Lunas" value={lunasThisMonth.length.toString()} color="#16a34a" />
                <Row label="Belum Lunas" value={(completedThisMonth.length - lunasThisMonth.length).toString()} color="#f59e0b" />
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}

function SalesSummaryMobile({
  data,
  selMonth,
  selYear,
  onPrev,
  onNext,
}: {
  data: any
  selMonth: number
  selYear: number
  onPrev: () => void
  onNext: () => void
}) {
  const today = new Date()
  const maxRev = Math.max(...data.dailyRev, 1)
  const todayDay = today.getFullYear() === selYear && today.getMonth() === selMonth ? today.getDate() : -1
  const growthText = data.revGrowth !== null
    ? `${data.revGrowth >= 0 ? '+' : '-'}${Math.abs(data.revGrowth)}% vs bulan lalu`
    : 'Bulan pertama'

  return (
    <>
      <div className="bg-white rounded-2xl border border-wm-line p-3 flex items-center justify-between">
        <button onClick={onPrev} className="h-9 w-9 rounded-full bg-wm-bg text-[16px] font-bold">&lt;</button>
        <div className="text-center">
          <p className="text-[13px] font-bold">{MONTH_NAMES[selMonth]} {selYear}</p>
          <p className="text-[10px] text-ink-4">Ringkasan penjualan</p>
        </div>
        <button onClick={onNext} className="h-9 w-9 rounded-full bg-wm-bg text-[16px] font-bold">&gt;</button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat icon="" label="Omset Bulan Ini" value={fmtRp(data.totalRevenue)} color="#1E4FD8" />
        <Stat icon="" label="Invoice Lunas" value={String(data.completed.length)} color="#16a34a" />
        <Stat icon="" label="Outstanding" value={fmtRp(data.totalOutstanding)} color="#f59e0b" />
        <Stat icon="" label="Avg. per Booking" value={fmtRp(data.avgPerBooking)} color="#111827" />
      </div>

      <div className="bg-white rounded-2xl border border-wm-line p-4">
        <p className="text-[12px] font-semibold mb-1" style={{ color: data.revGrowth !== null && data.revGrowth >= 0 ? '#16a34a' : '#ef4444' }}>{growthText}</p>
        <p className="text-[10px] text-ink-4">Dihitung dari transaksi selesai dibanding bulan sebelumnya.</p>
      </div>

      <div className="bg-white rounded-2xl border border-wm-line p-4">
        <p className="text-[13px] font-bold mb-3">Omset Harian</p>
        {data.completed.length === 0 ? (
          <p className="text-[12px] text-[#aaa] text-center py-8">Belum ada transaksi selesai bulan ini</p>
        ) : (
          <>
            <div className="flex items-end gap-0.5 h-[120px]">
              {data.dailyRev.map((v: number, i: number) => (
                <div
                  key={i}
                  className="flex-1 rounded-t-sm"
                  style={{
                    height: `${Math.max((v / maxRev) * 100, v > 0 ? 4 : 0)}%`,
                    background: i + 1 === todayDay ? '#1E4FD8' : v > 0 ? '#93c5fd' : '#f1f5f9',
                    minHeight: v > 0 ? '4px' : '2px',
                  }}
                  title={v > 0 ? fmtRp(v) : undefined}
                />
              ))}
            </div>
            <div className="flex justify-between mt-2">
              <p className="text-[10px] text-[#aaa]">1 {MONTH_NAMES[selMonth].slice(0, 3)}</p>
              <p className="text-[10px] text-[#aaa]">{data.dailyRev.length} {MONTH_NAMES[selMonth].slice(0, 3)}</p>
            </div>
          </>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-wm-line p-4">
        <p className="text-[13px] font-bold mb-3">Top Layanan</p>
        {data.topServices.length === 0 ? (
          <p className="text-[12px] text-[#aaa]">Belum ada data layanan bulan ini</p>
        ) : (
          <div className="space-y-3">
            {data.topServices.map((s: any) => (
              <div key={s.name}>
                <div className="flex justify-between mb-1">
                  <p className="text-[12px] text-ink-3 truncate pr-2">{s.name}</p>
                  <p className="text-[12px] font-bold flex-shrink-0" style={{ color: s.color }}>{s.pct}%</p>
                </div>
                <div className="h-2 rounded-full bg-wm-bg">
                  <div className="h-2 rounded-full" style={{ width: `${s.pct}%`, background: s.color }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-wm-line overflow-hidden">
        <div className="px-4 py-3 border-b border-[#f1f5f9] flex items-center justify-between">
          <p className="text-[13px] font-bold">Transaksi Selesai</p>
          <p className="text-[10px] text-[#aaa]">{data.transaksi.length} transaksi</p>
        </div>
        {data.transaksi.length === 0 ? (
          <p className="px-4 py-6 text-center text-[12px] text-[#aaa]">Belum ada transaksi selesai bulan ini.</p>
        ) : (
          <div className="divide-y divide-[#f1f5f9]">
            {data.transaksi.map((row: any, i: number) => (
              <div key={i} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold truncate">{row.pelanggan}</p>
                    <p className="text-[11px] text-[#666] truncate">{row.kendaraan}</p>
                    <p className="text-[11px] text-ink-4 truncate">{row.layanan} - {row.tanggal}</p>
                  </div>
                  <p className="text-[12px] font-bold text-brand flex-shrink-0">{fmtRp(row.harga)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

function CashflowMobile({
  data,
  selMonth,
  selYear,
  onPrev,
  onNext,
}: {
  data: any
  selMonth: number
  selYear: number
  onPrev: () => void
  onNext: () => void
}) {
  const maxBar = Math.max(...data.masukArr, ...data.keluarArr, 1)
  const maxSaldo = Math.max(...data.cumulative, 0)
  const minSaldo = Math.min(...data.cumulative, 0)
  const saldoRange = maxSaldo - minSaldo || 1

  return (
    <>
      <PeriodNav month={selMonth} year={selYear} onPrev={onPrev} onNext={onNext} subtitle="Aliran kas" />
      <div className="grid grid-cols-2 gap-3">
        <Stat icon="" label="Saldo Awal" value={fmtRp(0)} color="#555" />
        <Stat icon="" label="Total Masuk" value={fmtRp(data.masuk)} color="#16a34a" />
        <Stat icon="" label="Total Keluar" value={fmtRp(data.keluar)} color="#dc2626" />
        <Stat icon="" label="Saldo Akhir" value={fmtRp(data.saldoAkhir)} color={data.saldoAkhir >= 0 ? '#1E4FD8' : '#dc2626'} />
      </div>

      <div className="bg-white rounded-2xl border border-wm-line p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[13px] font-bold">Kas Masuk vs Keluar</p>
          <div className="flex gap-3">
            <Legend color="#22c55e" label="Masuk" />
            <Legend color="#f87171" label="Keluar" />
          </div>
        </div>
        <div className="flex items-end gap-0.5 h-[120px]">
          {data.masukArr.map((m: number, i: number) => (
            <div key={i} className="flex-1 flex flex-col-reverse gap-px">
              <div className="rounded-sm" style={{ height: `${(m / maxBar) * 58}px`, background: m > 0 ? '#22c55e' : 'transparent', minHeight: m > 0 ? '3px' : '0' }} />
              <div className="rounded-sm" style={{ height: `${(data.keluarArr[i] / maxBar) * 58}px`, background: data.keluarArr[i] > 0 ? '#f87171' : 'transparent', minHeight: data.keluarArr[i] > 0 ? '3px' : '0' }} />
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-wm-line p-4">
        <p className="text-[13px] font-bold mb-3">Tren Saldo Kas</p>
        <svg className="w-full h-[110px]" viewBox={`0 0 ${Math.max(data.cumulative.length, 1)} 100`} preserveAspectRatio="none">
          <polyline
            fill="none"
            stroke="#1E4FD8"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            points={data.cumulative.map((v: number, i: number) => `${i + 0.5},${100 - ((v - minSaldo) / saldoRange) * 90}`).join(' ')}
          />
        </svg>
        <div className="flex justify-between text-[11px] mt-1">
          <span className="text-[#aaa]">Min: <span className="text-ink-3 font-medium">{fmtRp(minSaldo)}</span></span>
          <span className="text-[#aaa]">Max: <span className="text-ink-3 font-medium">{fmtRp(maxSaldo)}</span></span>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-wm-line overflow-hidden">
        <div className="px-4 py-3 border-b border-[#f1f5f9]">
          <p className="text-[13px] font-bold">Rincian Aliran Kas</p>
        </div>
        {data.withBalance.length === 0 ? (
          <p className="px-4 py-6 text-center text-[12px] text-[#aaa]">Tidak ada data aliran kas.</p>
        ) : (
          <div className="divide-y divide-[#f1f5f9]">
            {data.withBalance.map((a: any) => (
              <div key={a.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold truncate">{a.keterangan}</p>
                    <p className="text-[11px] text-[#666] truncate">{a.kategori} - {new Date(a.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}</p>
                    <p className="text-[10px] text-ink-4">Saldo: {fmtRp(a.saldo)}</p>
                  </div>
                  <p className="text-[12px] font-bold flex-shrink-0" style={{ color: a.jenis === 'masuk' ? '#16a34a' : '#dc2626' }}>
                    {a.jenis === 'masuk' ? '+' : '-'}{fmtRp(a.jumlah)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

function AnalyticsMobile({
  data,
  selMonth,
  selYear,
  onPrev,
  onNext,
}: {
  data: any
  selMonth: number
  selYear: number
  onPrev: () => void
  onNext: () => void
}) {
  const maxRev = Math.max(...data.last6Months.map((m: any) => m.rev), 1)
  const maxJobs = Math.max(...data.teknisiPerf.map((t: any) => t.jobs), 1)
  const maxServiceCount = Math.max(...data.top10.map((s: any) => s.count), 1)
  const maxBrandCount = Math.max(...data.brandStats.map((b: any) => b.count), 1)

  return (
    <>
      <PeriodNav month={selMonth} year={selYear} onPrev={onPrev} onNext={onNext} subtitle="Dashboard performa" />

      <div className="grid grid-cols-2 gap-3">
        <Stat icon="" label="Pendapatan Bulan Ini" value={fmtRp(data.revThisMonth)} color="#1E4FD8" />
        <Stat icon="" label="Pekerjaan Selesai" value={String(data.jobsThisMonth)} color="#16a34a" />
        <Stat icon="" label="Laba Kotor" value={fmtRp(data.grossProfitThisMonth)} color={data.grossProfitThisMonth >= 0 ? '#7c3aed' : '#dc2626'} />
        <Stat icon="" label="Pelanggan Baru" value={String(data.newCustomers)} color="#f59e0b" />
      </div>

      <div className="bg-white rounded-2xl border border-wm-line p-4">
        <p className="text-[13px] font-bold mb-3">Komponen Laba</p>
        <Row label="Pendapatan" value={fmtRp(data.revThisMonth)} color="#1E4FD8" />
        <Row label="HPP Material" value={`-${fmtRp(data.hppThisMonth || 0)}`} color="#f97316" />
        <Row label="Laba Kotor" value={fmtRp(data.grossProfitThisMonth)} color={data.grossProfitThisMonth >= 0 ? '#7c3aed' : '#dc2626'} bold />
        <div className="my-2 border-t border-[#f1f5f9]" />
        <Row label="Pengeluaran Operasional" value={`-${fmtRp(data.expThisMonth || 0)}`} color="#dc2626" />
        <Row label="Laba Setelah Pengeluaran" value={fmtRp(data.operatingProfitThisMonth)} color={data.operatingProfitThisMonth >= 0 ? '#16a34a' : '#dc2626'} bold />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <TrendCard label="Pendapatan vs bulan lalu" pct={data.revTrend} />
        <TrendCard label="Job selesai vs bulan lalu" pct={data.jobsTrend} />
      </div>

      <div className="bg-white rounded-2xl border border-wm-line p-4">
        <p className="text-[13px] font-bold mb-1">Pendapatan 6 Bulan Terakhir</p>
        <p className="text-[10px] text-ink-4 mb-4">Berdasarkan pekerjaan selesai</p>
        <div className="flex items-end gap-2 h-[120px]">
          {data.last6Months.map((m: any, i: number) => {
            const pct = Math.max((m.rev / maxRev) * 100, m.rev > 0 ? 4 : 0)
            const isLast = i === data.last6Months.length - 1
            return (
              <div key={`${m.label}-${i}`} className="flex-1 flex flex-col items-center gap-1">
                {m.rev > 0 && <p className="text-[8px] text-ink-4 font-semibold">{fmtRp(m.rev)}</p>}
                <div
                  className="w-full rounded-t"
                  style={{ height: `${pct}%`, minHeight: m.rev > 0 ? '4px' : '0', background: isLast ? '#1E4FD8' : '#93c5fd' }}
                />
                <p className={`text-[10px] font-semibold ${isLast ? 'text-brand' : 'text-[#aaa]'}`}>{m.label}</p>
              </div>
            )
          })}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-wm-line p-4">
        <p className="text-[13px] font-bold mb-1">Performa Teknisi</p>
        <p className="text-[10px] text-ink-4 mb-4">Pekerjaan selesai bulan ini</p>
        {data.teknisiPerf.length === 0 ? (
          <p className="text-[12px] text-[#aaa] text-center py-6">Belum ada data teknisi bulan ini</p>
        ) : (
          <div className="space-y-3">
            {data.teknisiPerf.map((t: any, i: number) => (
              <div key={t.name}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[12px] font-semibold truncate pr-2"><span className="text-[#aaa] mr-1">#{i + 1}</span>{t.name}</p>
                  <p className="text-[12px] font-bold text-brand">{t.jobs} job</p>
                </div>
                {t.spesialis?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-1">
                    {t.spesialis.slice(0, 3).map((s: string) => (
                      <span key={s} className="text-[9px] px-1.5 py-0.5 rounded-full bg-wm-bg text-[#475569] border border-wm-line">{s}</span>
                    ))}
                  </div>
                )}
                <div className="h-1.5 rounded-full bg-wm-bg">
                  <div className="h-1.5 rounded-full bg-brand" style={{ width: `${Math.round((t.jobs / maxJobs) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-wm-line overflow-hidden">
        <div className="px-4 py-3 border-b border-[#f1f5f9] flex items-center justify-between">
          <div>
            <p className="text-[13px] font-bold">Top 10 Layanan Terpopuler</p>
            <p className="text-[10px] text-ink-4">Semua waktu, pekerjaan selesai</p>
          </div>
          <p className="text-[10px] text-[#aaa]">{data.completedCount} selesai</p>
        </div>
        {data.top10.length === 0 ? (
          <p className="px-4 py-6 text-center text-[12px] text-[#aaa]">Belum ada pekerjaan selesai.</p>
        ) : (
          <div className="divide-y divide-[#f1f5f9]">
            {data.top10.map((svc: any, i: number) => {
              const pct = Math.round((svc.count / maxServiceCount) * 100)
              const avg = svc.count > 0 ? svc.revenue / svc.count : 0
              return (
                <div key={svc.title} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="text-[12px] font-bold truncate"><span className="text-[#aaa] mr-1">#{i + 1}</span>{svc.title}</p>
                      <p className="text-[10px] text-ink-4">{svc.count} order - rata-rata {fmtRp(avg)}</p>
                    </div>
                    <p className="text-[12px] font-bold text-brand flex-shrink-0">{fmtRp(svc.revenue)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-wm-bg">
                      <div className="h-1.5 rounded-full bg-brand" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-[10px] text-[#aaa] w-8 text-right">{pct}%</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-wm-line overflow-hidden">
        <div className="px-4 py-3 border-b border-[#f1f5f9]">
          <p className="text-[13px] font-bold">Analitik Merek Kendaraan</p>
          <p className="text-[10px] text-ink-4">Semua kunjungan, urut frekuensi</p>
        </div>
        {data.brandStats.length === 0 ? (
          <p className="px-4 py-6 text-center text-[12px] text-[#aaa]">Belum ada data merek kendaraan.</p>
        ) : (
          <div className="divide-y divide-[#f1f5f9]">
            {data.brandStats.map((b: any, i: number) => {
              const pct = Math.round((b.count / maxBrandCount) * 100)
              const topService = Object.entries(b.services).sort((a: any, z: any) => z[1] - a[1])[0]
              return (
                <div key={b.brand} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="text-[12px] font-bold truncate"><span className="text-[#aaa] mr-1">#{i + 1}</span>{b.brand}</p>
                      <p className="text-[10px] text-ink-4 truncate">
                        {b.count} kunjungan{topService ? ` - top: ${topService[0]}` : ''}
                      </p>
                    </div>
                    <p className="text-[12px] font-bold text-brand flex-shrink-0">{fmtRp(b.revenue)}</p>
                  </div>
                  <div className="h-1.5 rounded-full bg-wm-bg">
                    <div className="h-1.5 rounded-full bg-brand" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
        {data.missingBrandCount > 0 && (
          <p className="px-4 pb-4 text-[10px] text-[#aaa]">{data.missingBrandCount} kunjungan belum punya data merek.</p>
        )}
      </div>
    </>
  )
}

function FinanceSummaryMobile({
  data,
  selMonth,
  selYear,
  setSelMonth,
  setSelYear,
}: {
  data: any
  selMonth: number
  selYear: number
  setSelMonth: (m: number) => void
  setSelYear: (y: number) => void
}) {
  const maxBar = Math.max(...data.monthly.map((m: any) => Math.max(m.pendapatan, m.pengeluaran)), 1)
  const selected = data.selected
  const selectedMargin = selected?.pendapatan > 0 ? (selected.labaBersih / selected.pendapatan) * 100 : 0

  return (
    <>
      <div className="bg-white rounded-2xl border border-wm-line p-3 flex items-center justify-between">
        <p className="text-[12px] text-ink-4">Tahun berjalan: <span className="font-bold text-ink">{selYear}</span></p>
        <select value={selYear} onChange={e => setSelYear(Number(e.target.value))} className="bg-wm-bg border border-wm-line rounded-xl px-3 py-2 text-[12px]">
          {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat icon="" label="Pendapatan YTD" value={fmtRp(data.ytd.pendapatan)} color="#1E4FD8" />
        <Stat icon="" label="HPP YTD" value={fmtRp(data.ytd.hpp)} color="#f59e0b" />
        <Stat icon="" label="Pengeluaran YTD" value={fmtRp(data.ytd.pengeluaran)} color="#dc2626" />
        <Stat icon="" label="Laba Bersih YTD" value={fmtRp(data.ytd.labaBersih)} color={data.ytd.labaBersih >= 0 ? '#16a34a' : '#dc2626'} />
      </div>

      <div className="bg-white rounded-2xl border border-wm-line p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[13px] font-bold">Ringkasan Per Bulan</p>
          <div className="flex gap-2">
            <Legend color="#1E4FD8" label="Pendapatan" />
            <Legend color="#f87171" label="Pengeluaran" />
            <Legend color="#22c55e" label="Laba" />
          </div>
        </div>
        <div className="flex items-end gap-2 h-[140px]">
          {data.monthly.map((m: any, i: number) => {
            const hasData = m.pendapatan > 0
            return (
              <button key={m.label} onClick={() => setSelMonth(i)} className={`flex-1 flex flex-col items-center gap-1 ${selMonth === i ? 'opacity-100' : 'opacity-70'}`}>
                <div className="w-full flex items-end gap-0.5 h-[112px]">
                  <div className="flex-1 rounded-t-sm" style={{ height: hasData ? `${(m.pendapatan / maxBar) * 100}%` : '4px', background: hasData ? '#1E4FD8' : '#e2e8f0', minHeight: '4px' }} />
                  <div className="flex-1 rounded-t-sm" style={{ height: hasData ? `${(m.pengeluaran / maxBar) * 100}%` : '4px', background: hasData ? '#f87171' : '#e2e8f0', minHeight: '4px' }} />
                  <div className="flex-1 rounded-t-sm" style={{ height: hasData ? `${(Math.max(m.labaBersih, 0) / maxBar) * 100}%` : '4px', background: hasData && m.labaBersih >= 0 ? '#22c55e' : '#e2e8f0', minHeight: '4px' }} />
                </div>
                <p className={`text-[10px] font-medium ${selMonth === i ? 'text-brand' : 'text-[#aaa]'}`}>{m.label}</p>
              </button>
            )
          })}
        </div>
      </div>

      {selected && (
        <div className="bg-white rounded-2xl border border-wm-line p-4">
          <p className="text-[13px] font-bold mb-3">Laba Rugi - {MONTH_NAMES[selMonth]}</p>
          <div className="space-y-2">
            <Row label="Pendapatan" value={fmtRp(selected.pendapatan)} color="#1E4FD8" />
            <Row label="HPP Material" value={`-${fmtRp(selected.hpp || 0)}`} color="#f59e0b" />
            <Row label="Pengeluaran" value={`-${fmtRp(selected.pengeluaran)}`} color="#dc2626" />
            <div className="border-t border-wm-line pt-2 mt-2">
              <Row label="Laba Bersih" value={fmtRp(selected.labaBersih)} color={selected.labaBersih >= 0 ? '#16a34a' : '#dc2626'} bold />
            </div>
            <Row label="Margin" value={`${selectedMargin.toFixed(1)}%`} color={selectedMargin >= 20 ? '#16a34a' : '#f59e0b'} />
          </div>
          {(selected.hpp || 0) === 0 && selected.pendapatan > 0 && (
            <p className="text-[10px] text-[#f59e0b] mt-3">HPP masih 0. Pastikan BOM sudah diset di menu Layanan - Setup HPP.</p>
          )}
        </div>
      )}

      <BreakdownCard title="Pendapatan per Layanan" data={data.incomeByService} colors={BAR_COLORS} />
      <BreakdownCard title="Pengeluaran per Kategori" data={data.expenseByCategory} colors={['#dc2626', '#ef4444', '#f87171', '#fca5a5', '#fecaca']} />

      <div className="bg-white rounded-2xl border border-wm-line overflow-hidden">
        <div className="px-4 py-3 border-b border-[#f1f5f9]">
          <p className="text-[13px] font-bold">Rekap Tahunan {selYear}</p>
        </div>
        <div className="divide-y divide-[#f1f5f9]">
          {data.monthly.map((m: any, i: number) => (
            <button key={m.label} onClick={() => setSelMonth(i)} className={`w-full px-4 py-3 text-left ${selMonth === i ? 'bg-brand-50' : ''}`}>
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-bold">{MONTH_NAMES[i]}</p>
                <p className="text-[12px] font-bold" style={{ color: m.labaBersih >= 0 ? '#16a34a' : '#dc2626' }}>{m.pendapatan > 0 ? fmtRp(m.labaBersih) : '-'}</p>
              </div>
              <p className="text-[10px] text-ink-4 mt-1">Pendapatan {fmtRp(m.pendapatan)} - HPP {fmtRp(m.hpp || 0)} - Pengeluaran {fmtRp(m.pengeluaran)}</p>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

function PeriodNav({ month, year, subtitle, onPrev, onNext }: { month: number; year: number; subtitle: string; onPrev: () => void; onNext: () => void }) {
  return (
    <div className="bg-white rounded-2xl border border-wm-line p-3 flex items-center justify-between">
      <button onClick={onPrev} className="h-9 w-9 rounded-full bg-wm-bg text-[16px] font-bold">&lt;</button>
      <div className="text-center">
        <p className="text-[13px] font-bold">{MONTH_NAMES[month]} {year}</p>
        <p className="text-[10px] text-ink-4">{subtitle}</p>
      </div>
      <button onClick={onNext} className="h-9 w-9 rounded-full bg-wm-bg text-[16px] font-bold">&gt;</button>
    </div>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span className="flex items-center gap-1 text-[9px] text-ink-3"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: color }} />{label}</span>
}

function TrendCard({ label, pct }: { label: string; pct: number | null }) {
  const neutral = pct === null || pct === 0
  const color = neutral ? '#64748b' : pct > 0 ? '#16a34a' : '#dc2626'
  const text = pct === null ? 'Bulan pertama' : `${pct > 0 ? '+' : ''}${pct}%`
  return (
    <div className="bg-white rounded-2xl border border-wm-line p-3">
      <p className="text-[10px] text-ink-4 mb-1">{label}</p>
      <p className="text-[16px] font-bold" style={{ color }}>{text}</p>
    </div>
  )
}

function BreakdownCard({ title, data, colors }: { title: string; data: { label: string; nilai: number }[]; colors: string[] }) {
  const max = Math.max(...data.map(d => d.nilai), 1)
  return (
    <div className="bg-white rounded-2xl border border-wm-line p-4">
      <p className="text-[13px] font-bold mb-3">{title}</p>
      {data.length === 0 ? (
        <p className="text-[12px] text-[#aaa]">Belum ada data bulan ini</p>
      ) : (
        <div className="space-y-3">
          {data.map((d, i) => (
            <div key={d.label}>
              <div className="flex justify-between mb-1">
                <p className="text-[12px] text-ink-3 truncate pr-2">{d.label}</p>
                <p className="text-[12px] font-semibold text-ink">{fmtRp(d.nilai)}</p>
              </div>
              <div className="h-1.5 rounded-full bg-wm-bg">
                <div className="h-1.5 rounded-full" style={{ width: `${(d.nilai / max) * 100}%`, background: colors[i % colors.length] }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Stat({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <div className="bg-white rounded-2xl border border-wm-line p-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[16px]">{icon}</span>
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      </div>
      <p className="text-[14px] font-bold leading-tight" style={{ color }}>{value}</p>
      <p className="text-[10px] text-ink-4 mt-0.5 truncate">{label}</p>
    </div>
  )
}

function Row({ label, value, color, bold }: { label: string; value: string; color?: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-[12px] text-[#666]">{label}</p>
      <p className={`text-[13px] ${bold ? 'font-bold' : 'font-semibold'}`} style={{ color: color || '#111' }}>{value}</p>
    </div>
  )
}

function groupSum<T>(items: T[], getLabel: (item: T) => string, getValue: (item: T) => number) {
  const map: Record<string, number> = {}
  items.forEach(item => {
    const label = getLabel(item)
    map[label] = (map[label] || 0) + getValue(item)
  })
  return Object.entries(map)
    .map(([label, nilai]) => ({ label, nilai }))
    .sort((a, b) => b.nilai - a.nilai)
    .slice(0, 6)
}
