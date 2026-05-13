import { useState, useMemo, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { registrationsAPI, serviceMaterialsAPI } from '../services/api'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Transaksi {
  id: string
  tanggal: string
  noinv: string
  pelanggan: string
  layanan: string
  teknisi: string
  subtotal: number
  hpp: number
  total: number
  keuntungan: number
  status: 'lunas' | 'pending' | 'overdue'
}

function parseTeknisi(notes?: string): string {
  const m = notes?.match(/^teknisi:([^|]+)/)
  return m ? m[1].split(',')[0].trim() : '—'
}

function parseHpp(notes?: string): number {
  const m = notes?.match(/hpp:([\d.]+)/)
  return m ? parseFloat(m[1]) : 0
}

function regToTransaksi(r: any, workshopHppMap: Record<string, number> = {}): Transaksi {
  const price = Number(r.workshop?.price) || 0

  // HPP: pakai dari notes kalau sudah selesai, otherwise pakai estimasi BOM
  const notesHpp = parseHpp(r.notes)
  const bomHpp   = workshopHppMap[r.workshopId] || 0
  const hpp      = notesHpp > 0 ? notesHpp : bomHpp

  // paymentStatus dari DB diutamakan; pekerjaan selesai tidak otomatis lunas.
  let status: Transaksi['status'] = 'pending'
  if (r.paymentStatus) {
    status = String(r.paymentStatus).toLowerCase() as Transaksi['status']
  } else if (r.status === 'cancelled') {
    status = 'overdue'
  }

  const tanggal = r.scheduledDate
    ? r.scheduledDate.slice(0, 10)
    : new Date(r.updatedAt || r.createdAt).toISOString().slice(0, 10)

  return {
    id:         r.id,
    tanggal,
    noinv:      `INV-${r.id.slice(-6).toUpperCase()}`,
    pelanggan:  r.customer?.name || 'Pelanggan',
    layanan:    r.workshop?.title || 'Layanan',
    teknisi:    parseTeknisi(r.notes),
    subtotal:   price,
    hpp,
    total:      price,
    keuntungan: price - hpp,
    status,
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const fmt = (n: number) => 'Rp ' + n.toLocaleString('id-ID')
const fmtShort = (n: number) => {
  if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1)}JT`
  if (n >= 1_000) return `Rp ${(n / 1_000).toFixed(0)}K`
  return fmt(n)
}

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

const STATUS_COLOR: Record<string, string> = {
  lunas:   'bg-[#dcfce7] text-[#15803d]',
  pending: 'bg-[#fef3c7] text-[#b45309]',
  overdue: 'bg-[#fee2e2] text-[#b91c1c]',
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function LaporanPendapatanPage() {
  const { tenant } = useAuth()
  const now = new Date()
  const [bulan, setBulan] = useState(now.getMonth()) // 0-indexed
  const [tahun, setTahun] = useState(now.getFullYear())
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'semua' | 'lunas' | 'pending' | 'overdue'>('semua')
  const [allData, setAllData] = useState<Transaksi[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    if (!tenant?.id) return
    try {
      setLoading(true)
      const res = await registrationsAPI.list(tenant.id)
      const regs: any[] = res.data.data || []

      // Fetch BOM HPP untuk setiap unique workshopId (potensi HPP)
      const uniqueWorkshopIds = [...new Set(regs.map(r => r.workshopId).filter(Boolean))]
      const bomResults = await Promise.all(
        uniqueWorkshopIds.map(id => serviceMaterialsAPI.list(id).then(r => ({ id, hpp: r.data.hpp || 0 })).catch(() => ({ id, hpp: 0 })))
      )
      const workshopHppMap: Record<string, number> = {}
      bomResults.forEach(({ id, hpp }) => { workshopHppMap[id] = hpp })

      setAllData(regs.map(r => regToTransaksi(r, workshopHppMap)))
    } catch (err) {
      console.error('Failed to fetch laporan pendapatan:', err)
    } finally {
      setLoading(false)
    }
  }, [tenant?.id])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Filter data ──
  const filtered = useMemo(() => {
    return allData.filter(t => {
      const d = new Date(t.tanggal)
      if (d.getMonth() !== bulan || d.getFullYear() !== tahun) return false
      if (filterStatus !== 'semua' && t.status !== filterStatus) return false
      const q = search.toLowerCase()
      return !q || t.pelanggan.toLowerCase().includes(q) || t.noinv.toLowerCase().includes(q) || t.layanan.toLowerCase().includes(q)
    })
  }, [allData, bulan, tahun, search, filterStatus])

  // ── Stats ──
  const stats = useMemo(() => {
    const lunas = filtered.filter(t => t.status === 'lunas')
    const pending = filtered.filter(t => t.status === 'pending')
    const overdue = filtered.filter(t => t.status === 'overdue')
    const totalBruto = filtered.reduce((s, t) => s + t.subtotal, 0)
    const totalNeto = filtered.reduce((s, t) => s + t.total, 0)
    const totalLunas = lunas.reduce((s, t) => s + t.total, 0)
    const totalOutstanding = [...pending, ...overdue].reduce((s, t) => s + t.total, 0)
    const totalHpp = filtered.reduce((s, t) => s + t.hpp, 0)
    const totalKeuntungan = filtered.reduce((s, t) => s + t.keuntungan, 0)
    const marginPct = totalBruto > 0 ? (totalKeuntungan / totalBruto) * 100 : 0
    const hppRecorded = filtered.filter(t => t.hpp > 0).length

    // prev month for comparison
    const prevM = bulan === 0 ? 11 : bulan - 1
    const prevY = bulan === 0 ? tahun - 1 : tahun
    const prevLunas = allData.filter(t => {
      const d = new Date(t.tanggal)
      return d.getMonth() === prevM && d.getFullYear() === prevY && t.status === 'lunas'
    }).reduce((s, t) => s + t.total, 0)

    const growth = prevLunas > 0 ? ((totalLunas - prevLunas) / prevLunas) * 100 : null

    return { totalBruto, totalNeto, totalLunas, totalOutstanding, totalHpp, totalKeuntungan, marginPct, hppRecorded, growth, count: filtered.length, lunasCount: lunas.length }
  }, [filtered, bulan, tahun, allData])


  // ── Daily revenue chart ──
  const dailyChart = useMemo(() => {
    const days = new Date(tahun, bulan + 1, 0).getDate()
    const arr = Array(days).fill(0)
    filtered.filter(t => t.status === 'lunas').forEach(t => {
      const d = new Date(t.tanggal).getDate() - 1
      arr[d] += t.total
    })
    return arr
  }, [filtered, bulan, tahun])

  const maxDay = Math.max(...dailyChart, 1)

  return (
    <div className="p-6 space-y-5">

      {/* ── Period selector ── */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex items-center gap-2">
          <select
            className="rounded border border-[#cbd5e1] px-3 py-1.5 text-sm outline-none focus:border-[#1E4FD8]"
            value={bulan}
            onChange={e => setBulan(Number(e.target.value))}
          >
            {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
          <select
            className="rounded border border-[#cbd5e1] px-3 py-1.5 text-sm outline-none focus:border-[#1E4FD8]"
            value={tahun}
            onChange={e => setTahun(Number(e.target.value))}
          >
            {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-sm text-[#888]">
            Laporan Pendapatan — <span className="font-semibold text-[#333]">{MONTHS[bulan]} {tahun}</span>
          </p>
          <button onClick={fetchData} className="text-[11px] text-[#1E4FD8] hover:underline">
            {loading ? 'Memuat...' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-[#e2e8f0] p-4">
          <p className="text-[11px] text-[#888] font-medium">Pendapatan Lunas</p>
          <p className="text-2xl font-bold text-[#1E4FD8] mt-1">{fmtShort(stats.totalLunas)}</p>
          {stats.growth !== null && (
            <p className={`text-[11px] mt-0.5 font-semibold ${stats.growth >= 0 ? 'text-[#16a34a]' : 'text-[#dc2626]'}`}>
              {stats.growth >= 0 ? '↑' : '↓'} {Math.abs(stats.growth).toFixed(1)}% vs bulan lalu
            </p>
          )}
        </div>
        <div className="bg-white rounded-xl border border-[#e2e8f0] p-4">
          <p className="text-[11px] text-[#888] font-medium">Potensi Keuntungan</p>
          <p className="text-2xl font-bold text-[#16a34a] mt-1">{fmtShort(stats.totalKeuntungan)}</p>
          <p className="text-[11px] text-[#aaa] mt-0.5">
            {stats.hppRecorded > 0 ? `margin ${stats.marginPct.toFixed(1)}%` : 'HPP belum tercatat'}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-[#e2e8f0] p-4">
          <p className="text-[11px] text-[#888] font-medium">Total Transaksi</p>
          <p className="text-2xl font-bold text-[#111] mt-1">{stats.count}</p>
          <p className="text-[11px] text-[#aaa] mt-0.5">{stats.lunasCount} lunas</p>
        </div>
        <div className="bg-white rounded-xl border border-[#e2e8f0] p-4">
          <p className="text-[11px] text-[#888] font-medium">Outstanding</p>
          <p className="text-2xl font-bold text-[#dc2626] mt-1">{fmtShort(stats.totalOutstanding)}</p>
          <p className="text-[11px] text-[#aaa] mt-0.5">pending + overdue</p>
        </div>
      </div>

      {/* ── Charts row ── */}
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">

        {/* Daily chart */}
        <div className="bg-white rounded-xl border border-[#e2e8f0] p-5">
          <p className="text-sm font-bold text-[#111] mb-4">Pendapatan Harian — {MONTHS[bulan]} {tahun}</p>
          <div className="flex items-end gap-px h-[120px]">
            {dailyChart.map((v, i) => (
              <div
                key={i}
                className="flex-1 rounded-t-sm transition-all"
                style={{
                  height: `${(v / maxDay) * 100}%`,
                  minHeight: v > 0 ? '4px' : '0',
                  background: v > 0 ? '#1E4FD8' : '#e2e8f0',
                  opacity: v > 0 ? 1 : 0.4,
                }}
                title={`${i + 1} ${MONTHS[bulan]}: ${fmt(v)}`}
              />
            ))}
          </div>
          <div className="flex justify-between mt-2">
            <p className="text-[10px] text-[#aaa]">1</p>
            <p className="text-[10px] text-[#aaa]">{dailyChart.length}</p>
          </div>
        </div>

        {/* Summary box */}
        <div className="bg-white rounded-xl border border-[#e2e8f0] p-5 space-y-3">
          <p className="text-sm font-bold text-[#111]">Ringkasan Bulan Ini</p>
          {[
            { label: 'Potensi Pendapatan', value: stats.totalBruto, color: '#1E4FD8', sub: 'semua transaksi periode ini' },
            { label: 'Sudah Lunas', value: stats.totalLunas, color: '#111', sub: null },
            ...(stats.totalHpp > 0 ? [{ label: 'Potensi HPP', value: -stats.totalHpp, color: '#f59e0b', sub: null, bold: false }] : []),
            { label: 'Potensi Keuntungan', value: stats.totalKeuntungan, color: '#16a34a', bold: true, sub: stats.totalHpp === 0 ? 'Setup BOM dulu di menu Layanan → Setup HPP' : `margin ${stats.marginPct.toFixed(1)}%` },
          ].map(r => (
            <div key={r.label} className={`flex justify-between items-center ${r.bold ? 'border-t border-[#e2e8f0] pt-2' : ''}`}>
              <div>
                <p className={`text-sm ${r.bold ? 'font-bold text-[#333]' : 'text-[#555]'}`}>{r.label}</p>
                {r.sub && <p className="text-[10px] text-[#aaa]">{r.sub}</p>}
              </div>
              <p className="text-sm font-semibold" style={{ color: r.color }}>
                {r.value < 0 ? `- ${fmt(-r.value)}` : fmt(r.value)}
              </p>
            </div>
          ))}
          {stats.hppRecorded < stats.lunasCount && (
            <p className="text-[10px] text-[#aaa] pt-1">
              * HPP tercatat di {stats.hppRecorded} dari {stats.lunasCount} transaksi lunas
            </p>
          )}
          <div className="border-t border-dashed border-[#e2e8f0] pt-3">
            <div className="flex justify-between">
              <p className="text-sm text-[#555]">Outstanding</p>
              <p className="text-sm font-semibold text-[#dc2626]">{fmt(stats.totalOutstanding)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Transactions Table ── */}
      <div className="bg-white rounded-xl border border-[#e2e8f0] overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-b border-[#e2e8f0]">
          <p className="text-sm font-bold text-[#111]">Detail Transaksi</p>
          <div className="flex gap-2">
            <input
              className="rounded border border-[#cbd5e1] px-3 py-1.5 text-sm outline-none focus:border-[#1E4FD8] focus:ring-2 focus:ring-[#dbeafe] w-44"
              placeholder="Cari pelanggan / no inv..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <select
              className="rounded border border-[#cbd5e1] px-3 py-1.5 text-sm outline-none focus:border-[#1E4FD8]"
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value as typeof filterStatus)}
            >
              <option value="semua">Semua</option>
              <option value="lunas">Lunas</option>
              <option value="pending">Pending</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#f8fafc] text-[#555] text-[11px] font-semibold uppercase tracking-wide border-b border-[#e2e8f0]">
                <th className="px-4 py-3 text-left">Tanggal</th>
                <th className="px-4 py-3 text-left">No. Inv</th>
                <th className="px-4 py-3 text-left">Pelanggan</th>
                <th className="px-4 py-3 text-left">Layanan</th>
                <th className="px-4 py-3 text-right">Harga Jual</th>
                <th className="px-4 py-3 text-right">HPP</th>
                <th className="px-4 py-3 text-right">Keuntungan</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-[#aaa]">Memuat data...</td>
                </tr>
              ) : filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-[#aaa]">
                    {allData.length === 0 ? 'Belum ada transaksi.' : 'Tidak ada transaksi di periode ini.'}
                  </td>
                </tr>
              )}
              {filtered.map(t => (
                <tr key={t.id} className="border-b border-[#f1f5f9] hover:bg-[#f8fafc] transition">
                  <td className="px-4 py-2.5 text-[#555]">
                    {new Date(t.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-[#1E4FD8]">{t.noinv}</td>
                  <td className="px-4 py-2.5 text-[#333]">{t.pelanggan}</td>
                  <td className="px-4 py-2.5 text-[#555]">{t.layanan}</td>
                  <td className="px-4 py-2.5 text-right text-[#111]">{fmt(t.total)}</td>
                  <td className="px-4 py-2.5 text-right text-[#f59e0b]">{t.hpp > 0 ? fmt(t.hpp) : '—'}</td>
                  <td className="px-4 py-2.5 text-right font-semibold" style={{ color: t.hpp > 0 ? (t.keuntungan >= 0 ? '#16a34a' : '#dc2626') : '#aaa' }}>
                    {t.hpp > 0 ? fmt(t.keuntungan) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${STATUS_COLOR[t.status]}`}>
                      {t.status.charAt(0).toUpperCase() + t.status.slice(1)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className="bg-[#f8fafc] border-t-2 border-[#e2e8f0]">
                  <td colSpan={4} className="px-4 py-2.5 font-bold text-[#333] text-right">Total</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-[#111]">{fmt(stats.totalBruto)}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-[#f59e0b]">{stats.totalHpp > 0 ? fmt(stats.totalHpp) : '—'}</td>
                  <td className="px-4 py-2.5 text-right font-bold text-[#16a34a]">{stats.totalHpp > 0 ? fmt(stats.totalKeuntungan) : '—'}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}
