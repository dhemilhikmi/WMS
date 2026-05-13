import { useState, useMemo, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { registrationsAPI, expensesAPI, serviceMaterialsAPI } from '../services/api'

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

interface BulanData {
  bulan: string
  pendapatan: number
  hpp: number
  pengeluaran: number
  labaBersih: number
  kasAkhir: number
}

const fmt = (n: number) => 'Rp ' + n.toLocaleString('id-ID')
const fmtShort = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1)}JT`
  if (Math.abs(n) >= 1_000) return `Rp ${(n / 1_000).toFixed(0)}K`
  return fmt(n)
}

const parseHpp = (notes?: string) => {
  if (!notes) return 0
  const match = notes.match(/hpp:([0-9.]+)/i)
  return match ? Number(match[1]) || 0 : 0
}

function isOperationalExpense(expense: any) {
  const category = String(expense.kategori || '').toLowerCase()
  return category !== 'material' && !expense.refPO
}

const PCT_COLORS = ['#1E4FD8', '#3b82f6', '#60a5fa', '#93c5fd', '#D9E3FC', '#dbeafe']
const PCT_COLORS_RED = ['#dc2626', '#ef4444', '#f87171', '#fca5a5', '#fecaca', '#fee2e2']

export default function RingkasanKeuanganPage() {
  const { tenant } = useAuth()
  const now = new Date()
  const [tahun, setTahun] = useState(now.getFullYear())
  const [selectedBulan, setSelectedBulan] = useState(now.getMonth())
  const [allRegs, setAllRegs] = useState<any[]>([])
  const [allExps, setAllExps] = useState<any[]>([])
  const [workshopHppMap, setWorkshopHppMap] = useState<Record<string, number>>({})
  const [_loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    if (!tenant?.id) return
    try {
      setLoading(true)
      const [regRes, expRes] = await Promise.all([
        registrationsAPI.list(tenant.id),
        expensesAPI.list(),
      ])
      const regs = regRes.data.data || []
      setAllRegs(regs)
      setAllExps(expRes.data.data || [])

      const workshopIds = [...new Set<string>(
        regs.map((r: any) => r.workshopId).filter(Boolean)
      )]
      const hppEntries = await Promise.all(
        workshopIds.map(async (id) => {
          try {
            const res = await serviceMaterialsAPI.list(id)
            return [id, Number(res.data.hpp || 0)] as const
          } catch {
            return [id, 0] as const
          }
        })
      )
      setWorkshopHppMap(Object.fromEntries(hppEntries))
    } catch (err) {
      console.error('Failed to fetch ringkasan data:', err)
    } finally {
      setLoading(false)
    }
  }, [tenant?.id])

  useEffect(() => { fetchData() }, [fetchData])

  const MONTHLY: BulanData[] = useMemo(() => {
    let runningCash = 0
    return Array.from({ length: 12 }, (_, m) => {
      const monthRegs = allRegs.filter((r: any) => {
        if (r.status !== 'completed') return false
        const d = new Date(r.updatedAt || r.createdAt)
        return d.getFullYear() === tahun && d.getMonth() === m
      })
      const monthExps = allExps.filter((e: any) => {
        if (!isOperationalExpense(e)) return false
        const d = new Date(e.tanggal)
        return d.getFullYear() === tahun && d.getMonth() === m
      })
      const pendapatan = monthRegs.reduce((s: number, r: any) => s + Number(r.workshop?.price || 0), 0)
      const hpp = monthRegs.reduce((s: number, r: any) => {
        const notesHpp = parseHpp(r.notes)
        return s + (notesHpp > 0 ? notesHpp : Number(workshopHppMap[r.workshopId] || 0))
      }, 0)
      const pengeluaran = monthExps.reduce((s: number, e: any) => s + Number(e.jumlah), 0)
      const labaBersih = pendapatan - hpp - pengeluaran
      runningCash += pendapatan - pengeluaran
      return {
        bulan: MONTHS[m].slice(0, 3),
        pendapatan,
        hpp,
        pengeluaran,
        labaBersih,
        kasAkhir: runningCash,
      }
    })
  }, [allRegs, allExps, tahun, workshopHppMap])

  const selRegs = useMemo(() => allRegs.filter((r: any) => {
    if (r.status !== 'completed') return false
    const d = new Date(r.updatedAt || r.createdAt)
    return d.getFullYear() === tahun && d.getMonth() === selectedBulan
  }), [allRegs, tahun, selectedBulan])

  const selExps = useMemo(() => allExps.filter((e: any) => {
    if (!isOperationalExpense(e)) return false
    const d = new Date(e.tanggal)
    return d.getFullYear() === tahun && d.getMonth() === selectedBulan
  }), [allExps, tahun, selectedBulan])

  const pendapatanByKat = useMemo(() => {
    const map: Record<string, number> = {}
    selRegs.forEach((r: any) => {
      const k = r.workshop?.title || 'Layanan'
      map[k] = (map[k] || 0) + Number(r.workshop?.price || 0)
    })
    return Object.entries(map).map(([label, nilai]) => ({ label, nilai })).sort((a, b) => b.nilai - a.nilai).slice(0, 6)
  }, [selRegs])

  const pengeluaranByKat = useMemo(() => {
    const map: Record<string, number> = {}
    selExps.forEach((e: any) => {
      map[e.kategori] = (map[e.kategori] || 0) + Number(e.jumlah)
    })
    return Object.entries(map).map(([label, nilai]) => ({ label, nilai })).sort((a, b) => b.nilai - a.nilai).slice(0, 6)
  }, [selExps])

  const activeMonths = MONTHLY.filter(m => m.pendapatan > 0 || m.hpp > 0 || m.pengeluaran > 0)

  const ytd = useMemo(() => ({
    pendapatan: activeMonths.reduce((s, m) => s + m.pendapatan, 0),
    hpp: activeMonths.reduce((s, m) => s + m.hpp, 0),
    pengeluaran: activeMonths.reduce((s, m) => s + m.pengeluaran, 0),
    labaBersih: activeMonths.reduce((s, m) => s + m.labaBersih, 0),
    kasAkhir: MONTHLY.reduce((last, m) => m.pendapatan > 0 || m.pengeluaran > 0 ? m.kasAkhir : last, 0),
  }), [activeMonths, MONTHLY])

  const marginPct = ytd.pendapatan > 0 ? (ytd.labaBersih / ytd.pendapatan) * 100 : 0
  const selData = MONTHLY[selectedBulan]
  const maxBar = Math.max(...MONTHLY.map(m => Math.max(m.pendapatan, m.hpp, m.pengeluaran)), 1)
  const maxPend = Math.max(...pendapatanByKat.map(k => k.nilai), 1)
  const maxPeng = Math.max(...pengeluaranByKat.map(k => k.nilai), 1)
  const selMargin = selData.pendapatan > 0 ? (selData.labaBersih / selData.pendapatan) * 100 : 0

  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <p className="text-sm text-[#888]">Tahun berjalan: <span className="font-bold text-[#333]">{tahun}</span></p>
        <select className="rounded border border-[#cbd5e1] px-3 py-1.5 text-sm outline-none focus:border-[#1E4FD8]"
          value={tahun} onChange={e => setTahun(Number(e.target.value))}>
          {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white rounded-xl border border-[#e2e8f0] p-4">
          <p className="text-[11px] text-[#888] font-medium">Total Pendapatan YTD</p>
          <p className="text-xl font-bold text-[#1E4FD8] mt-1">{fmtShort(ytd.pendapatan)}</p>
          <p className="text-[11px] text-[#aaa] mt-0.5">{activeMonths.length} bulan aktif</p>
        </div>
        <div className="bg-white rounded-xl border border-[#e2e8f0] p-4">
          <p className="text-[11px] text-[#888] font-medium">Total HPP YTD</p>
          <p className="text-xl font-bold text-[#f97316] mt-1">{fmtShort(ytd.hpp)}</p>
          <p className="text-[11px] text-[#aaa] mt-0.5">harga barang/material</p>
        </div>
        <div className="bg-white rounded-xl border border-[#e2e8f0] p-4">
          <p className="text-[11px] text-[#888] font-medium">Total Pengeluaran YTD</p>
          <p className="text-xl font-bold text-[#dc2626] mt-1">{fmtShort(ytd.pengeluaran)}</p>
          <p className="text-[11px] text-[#aaa] mt-0.5">semua kategori</p>
        </div>
        <div className="bg-white rounded-xl border border-[#e2e8f0] p-4">
          <p className="text-[11px] text-[#888] font-medium">Laba Bersih YTD</p>
          <p className={`text-xl font-bold mt-1 ${ytd.labaBersih >= 0 ? 'text-[#16a34a]' : 'text-[#dc2626]'}`}>{fmtShort(ytd.labaBersih)}</p>
          <p className="text-[11px] text-[#aaa] mt-0.5">pendapatan - HPP - pengeluaran</p>
        </div>
        <div className="bg-white rounded-xl border border-[#e2e8f0] p-4">
          <p className="text-[11px] text-[#888] font-medium">Margin Laba</p>
          <p className={`text-xl font-bold mt-1 ${marginPct >= 20 ? 'text-[#16a34a]' : marginPct >= 10 ? 'text-[#f59e0b]' : 'text-[#dc2626]'}`}>{marginPct.toFixed(1)}%</p>
          <p className="text-[11px] text-[#aaa] mt-0.5">{marginPct >= 20 ? 'Sehat' : marginPct >= 10 ? 'Cukup' : 'Perlu perhatian'}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#e2e8f0] p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-bold text-[#111]">Ringkasan Per Bulan - {tahun}</p>
          <div className="flex gap-4">
            <span className="flex items-center gap-1 text-[11px] text-[#555]"><span className="w-2.5 h-2 rounded-sm inline-block bg-[#1E4FD8]" />Pendapatan</span>
            <span className="flex items-center gap-1 text-[11px] text-[#555]"><span className="w-2.5 h-2 rounded-sm inline-block bg-[#fb923c]" />HPP</span>
            <span className="flex items-center gap-1 text-[11px] text-[#555]"><span className="w-2.5 h-2 rounded-sm inline-block bg-[#f87171]" />Pengeluaran</span>
            <span className="flex items-center gap-1 text-[11px] text-[#555]"><span className="w-2.5 h-2 rounded-sm inline-block bg-[#22c55e]" />Laba</span>
          </div>
        </div>
        <div className="flex items-end gap-2 h-[140px]">
          {MONTHLY.map((m, i) => {
            const hasData = m.pendapatan > 0 || m.hpp > 0 || m.pengeluaran > 0
            return (
              <button
                key={m.bulan}
                onClick={() => setSelectedBulan(i)}
                className={`flex-1 flex flex-col items-center gap-0.5 group transition ${selectedBulan === i ? 'opacity-100' : 'opacity-70 hover:opacity-100'}`}
              >
                <div className="w-full flex items-end gap-0.5 h-[110px]">
                  <div className="flex-1 rounded-t-sm transition-all" style={{ height: hasData ? `${(m.pendapatan / maxBar) * 100}%` : '4px', background: hasData ? '#1E4FD8' : '#e2e8f0', minHeight: '4px' }} />
                  <div className="flex-1 rounded-t-sm transition-all" style={{ height: hasData ? `${(m.hpp / maxBar) * 100}%` : '4px', background: hasData ? '#fb923c' : '#e2e8f0', minHeight: '4px' }} />
                  <div className="flex-1 rounded-t-sm transition-all" style={{ height: hasData ? `${(m.pengeluaran / maxBar) * 100}%` : '4px', background: hasData ? '#f87171' : '#e2e8f0', minHeight: '4px' }} />
                  <div className="flex-1 rounded-t-sm transition-all" style={{ height: hasData ? `${(Math.max(m.labaBersih, 0) / maxBar) * 100}%` : '4px', background: hasData && m.labaBersih >= 0 ? '#22c55e' : '#e2e8f0', minHeight: '4px' }} />
                </div>
                <p className={`text-[10px] font-medium ${selectedBulan === i ? 'text-[#1E4FD8]' : 'text-[#aaa]'}`}>{m.bulan}</p>
              </button>
            )
          })}
        </div>
        <p className="text-[11px] text-[#aaa] mt-1">Klik kolom untuk lihat detail bulan</p>
      </div>

      {selData && (selData.pendapatan > 0 || selData.hpp > 0 || selData.pengeluaran > 0) && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="bg-white rounded-xl border border-[#e2e8f0] p-5 space-y-3">
            <p className="text-sm font-bold text-[#111]">Laba Rugi - {MONTHS[selectedBulan]}</p>
            {[
              { label: 'Pendapatan', nilai: selData.pendapatan, color: '#1E4FD8' },
              { label: 'HPP Material', nilai: -selData.hpp, color: '#f97316' },
              { label: 'Pengeluaran', nilai: -selData.pengeluaran, color: '#dc2626' },
            ].map(r => (
              <div key={r.label} className="flex justify-between">
                <p className="text-sm text-[#555]">{r.label}</p>
                <p className="text-sm font-semibold" style={{ color: r.color }}>
                  {r.nilai < 0 ? `- ${fmt(-r.nilai)}` : fmt(r.nilai)}
                </p>
              </div>
            ))}
            <div className="border-t border-[#e2e8f0] pt-2 flex justify-between">
              <p className="text-sm font-bold text-[#333]">Laba Bersih</p>
              <p className={`text-sm font-bold ${selData.labaBersih >= 0 ? 'text-[#16a34a]' : 'text-[#dc2626]'}`}>{fmt(selData.labaBersih)}</p>
            </div>
            <div className="border-t border-dashed border-[#e2e8f0] pt-2 flex justify-between">
              <p className="text-sm text-[#555]">Saldo Kas Akhir</p>
              <p className="text-sm font-bold text-[#1E4FD8]">{fmt(selData.kasAkhir)}</p>
            </div>
            <div className="flex justify-between">
              <p className="text-sm text-[#555]">Margin</p>
              <p className={`text-sm font-bold ${selMargin >= 20 ? 'text-[#16a34a]' : 'text-[#f59e0b]'}`}>
                {selMargin.toFixed(1)}%
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#e2e8f0] p-5">
            <p className="text-sm font-bold text-[#111] mb-4">Pendapatan per Layanan</p>
            <div className="space-y-2.5">
              {pendapatanByKat.map((k, i) => (
                <div key={k.label}>
                  <div className="flex justify-between mb-1">
                    <p className="text-xs text-[#555]">{k.label}</p>
                    <p className="text-xs font-semibold text-[#111]">{fmtShort(k.nilai)}</p>
                  </div>
                  <div className="h-1.5 rounded-full bg-[#f1f5f9]">
                    <div className="h-1.5 rounded-full" style={{ width: `${(k.nilai / maxPend) * 100}%`, background: PCT_COLORS[i % PCT_COLORS.length] }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#e2e8f0] p-5">
            <p className="text-sm font-bold text-[#111] mb-4">Pengeluaran per Kategori</p>
            <div className="space-y-2.5">
              {pengeluaranByKat.map((k, i) => (
                <div key={k.label}>
                  <div className="flex justify-between mb-1">
                    <p className="text-xs text-[#555]">{k.label}</p>
                    <p className="text-xs font-semibold text-[#111]">{fmtShort(k.nilai)}</p>
                  </div>
                  <div className="h-1.5 rounded-full bg-[#f1f5f9]">
                    <div className="h-1.5 rounded-full" style={{ width: `${(k.nilai / maxPeng) * 100}%`, background: PCT_COLORS_RED[i % PCT_COLORS_RED.length] }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-[#e2e8f0] overflow-hidden">
        <div className="px-5 py-3 border-b border-[#e2e8f0]">
          <p className="text-sm font-bold text-[#111]">Rekap Tahunan {tahun}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#f8fafc] text-[#555] text-[11px] font-semibold uppercase tracking-wide border-b border-[#e2e8f0]">
                <th className="px-4 py-3 text-left">Bulan</th>
                <th className="px-4 py-3 text-right">Pendapatan</th>
                <th className="px-4 py-3 text-right">HPP</th>
                <th className="px-4 py-3 text-right">Pengeluaran</th>
                <th className="px-4 py-3 text-right">Laba Bersih</th>
                <th className="px-4 py-3 text-right">Margin</th>
                <th className="px-4 py-3 text-right">Saldo Kas</th>
              </tr>
            </thead>
            <tbody>
              {MONTHLY.map((m, i) => {
                const hasData = m.pendapatan > 0 || m.hpp > 0 || m.pengeluaran > 0
                const margin = hasData ? (m.labaBersih / m.pendapatan) * 100 : null
                return (
                  <tr
                    key={m.bulan}
                    onClick={() => hasData && setSelectedBulan(i)}
                    className={`border-b border-[#f1f5f9] transition ${hasData ? 'cursor-pointer hover:bg-[#f8fafc]' : 'opacity-40'} ${selectedBulan === i && hasData ? 'bg-[#EEF3FE]' : ''}`}
                  >
                    <td className="px-4 py-2.5 font-medium text-[#333]">{MONTHS[i]}</td>
                    <td className="px-4 py-2.5 text-right text-[#1E4FD8] font-medium">{hasData ? fmt(m.pendapatan) : '-'}</td>
                    <td className="px-4 py-2.5 text-right text-[#f97316]">{hasData ? fmt(m.hpp) : '-'}</td>
                    <td className="px-4 py-2.5 text-right text-[#dc2626]">{hasData ? fmt(m.pengeluaran) : '-'}</td>
                    <td className={`px-4 py-2.5 text-right font-semibold ${m.labaBersih >= 0 ? 'text-[#16a34a]' : 'text-[#dc2626]'}`}>
                      {hasData ? fmt(m.labaBersih) : '-'}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {margin !== null ? (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${margin >= 20 ? 'bg-[#dcfce7] text-[#15803d]' : margin >= 10 ? 'bg-[#fef3c7] text-[#b45309]' : 'bg-[#fee2e2] text-[#b91c1c]'}`}>
                          {margin.toFixed(1)}%
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium text-[#111]">{hasData ? fmt(m.kasAkhir) : '-'}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="bg-[#f8fafc] border-t-2 border-[#e2e8f0]">
                <td className="px-4 py-2.5 font-bold text-[#333]">Total YTD</td>
                <td className="px-4 py-2.5 text-right font-bold text-[#1E4FD8]">{fmt(ytd.pendapatan)}</td>
                <td className="px-4 py-2.5 text-right font-bold text-[#f97316]">{fmt(ytd.hpp)}</td>
                <td className="px-4 py-2.5 text-right font-bold text-[#dc2626]">{fmt(ytd.pengeluaran)}</td>
                <td className={`px-4 py-2.5 text-right font-bold ${ytd.labaBersih >= 0 ? 'text-[#16a34a]' : 'text-[#dc2626]'}`}>{fmt(ytd.labaBersih)}</td>
                <td className="px-4 py-2.5 text-right">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${marginPct >= 20 ? 'bg-[#dcfce7] text-[#15803d]' : 'bg-[#fef3c7] text-[#b45309]'}`}>
                    {marginPct.toFixed(1)}%
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right font-bold text-[#111]">{fmt(ytd.kasAkhir)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}
