import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { registrationsAPI } from '../services/api'

interface Teknisi { id: string; name: string }

interface RiwayatItem {
  id: string
  customer: string
  plat: string
  kendaraan: string
  layanan: string
  selesai: string       // DD/MM/YYYY
  bulan: number         // 1–12
  tahun: number
  durasi: string
  total: number
  totalLabel: string
  teknisi: Teknisi[]
  catatan?: string
}

type SortKey = 'customer' | 'layanan' | 'kendaraan' | 'selesai' | 'total'
type SortDir = 'asc' | 'desc'

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  const isActive = col === sortKey
  return (
    <span className={`inline-flex flex-col leading-none ml-1 ${isActive ? '' : 'opacity-30'}`}>
      <span style={{ color: isActive && sortDir === 'asc' ? '#1E4FD8' : '#94a3b8', fontSize: 9, lineHeight: 1 }}>▲</span>
      <span style={{ color: isActive && sortDir === 'desc' ? '#1E4FD8' : '#94a3b8', fontSize: 9, lineHeight: 1 }}>▼</span>
    </span>
  )
}

export default function RiwayatLayananPage() {
  const { tenant }    = useAuth()
  const [data, setData]           = useState<RiwayatItem[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [bulanFilter, setBulanFilter] = useState(0)
  const [sortKey, setSortKey]     = useState<SortKey>('selesai')
  const [sortDir, setSortDir]     = useState<SortDir>('desc')
  const [detailId, setDetailId]   = useState<string | null>(null)

  // ── Fetch completed registrations ──
  const fetchRiwayat = useCallback(async () => {
    if (!tenant?.id) return
    try {
      setLoading(true)
      const res = await registrationsAPI.list(tenant.id)
      const regs: any[] = res.data.data || []

      const completed = regs
        .filter(r => r.status === 'completed')
        .map(r => {
          const selesaiDate = new Date(r.updatedAt || r.createdAt)
          const selesai = selesaiDate.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })
          const totalNum = r.workshop?.price ? Number(r.workshop.price) : 0

          // Calculate duration from createdAt to updatedAt
          const start = new Date(r.createdAt)
          const end   = new Date(r.updatedAt || r.createdAt)
          const diffMs = end.getTime() - start.getTime()
          const diffH  = Math.floor(diffMs / 3600000)
          const diffM  = Math.floor((diffMs % 3600000) / 60000)
          const durasi = diffH > 0 ? `${diffH} jam${diffM > 0 ? ` ${diffM} mnt` : ''}` : diffM > 0 ? `${diffM} mnt` : '—'

          // Parse catatan (notes may contain teknisi + free catatan)
          const teknisiMatch = r.notes?.match(/^teknisi:([^|]+)/)
          const catatanMatch = r.notes?.replace(/^teknisi:[^|]+\|?/, '')

          return {
            id:         r.id,
            customer:   r.customer?.name || 'Pelanggan',
            plat:       r.licensePlate || '—',
            kendaraan:  r.vehicleName || '—',
            layanan:    r.workshop?.title || 'Layanan',
            selesai,
            bulan:      selesaiDate.getMonth() + 1,
            tahun:      selesaiDate.getFullYear(),
            durasi,
            total:      totalNum,
            totalLabel: totalNum > 0 ? 'Rp ' + totalNum.toLocaleString('id-ID') : '—',
            teknisi:    teknisiMatch
              ? teknisiMatch[1].split(',').map((n: string, i: number) => ({ id: `t${i}`, name: n.trim() }))
              : [],
            catatan: catatanMatch || undefined,
          } as RiwayatItem
        })

      setData(completed)
    } catch (err) {
      console.error('Failed to fetch riwayat:', err)
    } finally { setLoading(false) }
  }, [tenant?.id])

  useEffect(() => { fetchRiwayat() }, [fetchRiwayat])

  // ── Dynamic month options from data ──
  const monthOptions = useMemo(() => {
    const seen = new Set<string>()
    const opts: { value: string; label: string }[] = [{ value: '0', label: 'Semua Bulan' }]
    const MONTH_NAMES = ['','Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']
    data.forEach(r => {
      const key = `${r.tahun}-${r.bulan}`
      if (!seen.has(key)) {
        seen.add(key)
        opts.push({ value: key, label: `${MONTH_NAMES[r.bulan]} ${r.tahun}` })
      }
    })
    return opts.sort((a, b) => b.value.localeCompare(a.value))
  }, [data])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const filtered = useMemo(() => {
    let d = data

    if (bulanFilter !== 0) {
      const [y, m] = String(bulanFilter).split('-').map(Number)
      d = d.filter(r => r.tahun === y && r.bulan === m)
    }

    if (search) {
      const q = search.toLowerCase()
      d = d.filter(r =>
        r.customer.toLowerCase().includes(q) ||
        r.layanan.toLowerCase().includes(q) ||
        r.plat.toLowerCase().includes(q) ||
        r.kendaraan.toLowerCase().includes(q) ||
        r.teknisi.some(t => t.name.toLowerCase().includes(q))
      )
    }

    return [...d].sort((a, b) => {
      let va: string | number = a[sortKey]
      let vb: string | number = b[sortKey]
      if (sortKey === 'selesai') {
        const parse = (s: string) => { const [dd, mm, yyyy] = s.split('/'); return `${yyyy}${mm}${dd}` }
        va = parse(a.selesai); vb = parse(b.selesai)
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [data, search, bulanFilter, sortKey, sortDir])

  const detail = data.find(r => r.id === detailId)
  const totalPendapatan = filtered.reduce((s, r) => s + r.total, 0)
  const isDefaultSort = sortKey === 'selesai' && sortDir === 'desc'

  const SortTh = ({ col, label }: { col: SortKey; label: string }) => (
    <button onClick={() => handleSort(col)}
      className={`flex items-center gap-0 text-[11px] font-bold transition hover:text-[#1E4FD8] ${sortKey === col ? 'text-[#1E4FD8]' : 'text-[#888]'}`}>
      {label}<SortIcon col={col} sortKey={sortKey} sortDir={sortDir} />
    </button>
  )

  return (
    <div className="p-6 space-y-4">

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-[#e2e8f0] bg-white p-5">
          <p className="text-xs text-[#999]">Total Selesai</p>
          <p className="mt-2 text-4xl font-bold text-[#16a34a]">{filtered.length}</p>
          <p className="mt-1 text-xs text-[#888]">
            {bulanFilter === 0 ? 'semua waktu' : monthOptions.find(m => m.value === String(bulanFilter))?.label}
          </p>
        </div>
        <div className="rounded-lg border border-[#e2e8f0] bg-white p-5">
          <p className="text-xs text-[#999]">Total Pendapatan</p>
          <p className="mt-2 text-2xl font-bold text-[#111]">
            Rp {totalPendapatan.toLocaleString('id-ID')}
          </p>
          <p className="mt-1 text-xs text-[#888]">dari layanan selesai</p>
        </div>
        <div className="rounded-lg border border-[#e2e8f0] bg-white p-5">
          <p className="text-xs text-[#999]">Rata-rata per Layanan</p>
          <p className="mt-2 text-2xl font-bold text-[#111]">
            Rp {filtered.length ? Math.round(totalPendapatan / filtered.length).toLocaleString('id-ID') : 0}
          </p>
          <p className="mt-1 text-xs text-[#888]">rata-rata transaksi</p>
        </div>
      </div>

      {/* Detail modal */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg border border-[#e2e8f0] bg-white p-6 shadow-xl">
            <div className="flex justify-between items-start mb-4">
              <p className="text-base font-bold text-[#111]">Detail Layanan</p>
              <button onClick={() => setDetailId(null)} className="text-[#aaa] hover:text-[#555] text-xl leading-none">×</button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-[12px]">
                {[
                  ['Pelanggan', detail.customer],
                  ['Kendaraan', detail.kendaraan],
                  ['Plat', detail.plat],
                  ['Layanan', detail.layanan],
                  ['Selesai', detail.selesai],
                  ['Durasi', detail.durasi],
                ].map(([k, v]) => (
                  <div key={k}><p className="text-[#999]">{k}</p><p className="font-semibold text-[#111]">{v}</p></div>
                ))}
                <div className="col-span-2">
                  <p className="text-[#999]">Total</p>
                  <p className="font-bold text-[#1E4FD8] text-sm">{detail.totalLabel}</p>
                </div>
              </div>
              {detail.catatan && (
                <div className="rounded border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2">
                  <p className="text-[11px] text-[#888]">Catatan</p>
                  <p className="text-[12px] text-[#555] mt-0.5">{detail.catatan}</p>
                </div>
              )}
              <div>
                <p className="text-[11px] text-[#888] mb-2">Teknisi yang Menangani</p>
                {detail.teknisi.length === 0 ? (
                  <p className="text-[12px] text-[#aaa]">—</p>
                ) : (
                  <div className="space-y-1.5">
                    {detail.teknisi.map(t => (
                      <div key={t.id} className="flex items-center gap-2 rounded border border-[#e2e8f0] px-3 py-2">
                        <div className="h-6 w-6 rounded-full bg-[#dbeafe] flex items-center justify-center flex-shrink-0">
                          <span className="text-[10px] font-bold text-[#1E4FD8]">{t.name[0]}</span>
                        </div>
                        <p className="text-[12px] font-semibold text-[#111]">{t.name}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters + Table */}
      <div className="rounded-lg border border-[#e2e8f0] bg-white overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-[#f1f5f9]">
          <p className="text-sm font-bold text-[#111]">Riwayat Layanan</p>

          <select value={bulanFilter}
            onChange={e => setBulanFilter(Number(e.target.value))}
            className="rounded border border-[#e2e8f0] bg-white px-3 py-1.5 text-[12px] text-[#555] outline-none focus:border-[#1E4FD8] transition">
            {monthOptions.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>

          <div className="flex items-center gap-2 rounded border border-[#e2e8f0] px-3 py-1.5 flex-1 max-w-[260px]">
            <span className="text-xs">🔍</span>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Cari pelanggan / layanan / teknisi..."
              className="flex-1 text-[12px] outline-none text-[#555]" />
            {search && <button onClick={() => setSearch('')} className="text-[#aaa] hover:text-[#555]">×</button>}
          </div>

          <div className="ml-auto flex items-center gap-2">
            {!isDefaultSort && (
              <button onClick={() => { setSortKey('selesai'); setSortDir('desc') }}
                className="flex items-center gap-1 px-2.5 py-1 rounded border border-[#e2e8f0] text-[11px] text-[#555] hover:bg-[#f8fafc] transition">
                ↺ Reset sort
              </button>
            )}
            <button onClick={fetchRiwayat}
              className="text-[11px] text-[#1E4FD8] hover:underline">↻ Refresh</button>
            <p className="text-[11px] text-[#aaa]">{filtered.length} data</p>
          </div>
        </div>

        <div className="grid grid-cols-[1fr_1fr_1.2fr_1.4fr_0.8fr_0.9fr_0.9fr_0.5fr] px-5 py-2.5 bg-[#f8fafc] border-b border-[#f1f5f9]">
          <SortTh col="customer"  label="Pelanggan" />
          <SortTh col="kendaraan" label="Kendaraan" />
          <SortTh col="layanan"   label="Layanan" />
          <p className="text-[11px] font-bold text-[#888]">Teknisi</p>
          <SortTh col="selesai" label="Selesai" />
          <p className="text-[11px] font-bold text-[#888]">Durasi</p>
          <SortTh col="total" label="Total" />
          <p className="text-[11px] font-bold text-[#888]">Detail</p>
        </div>

        {loading ? (
          <p className="px-5 py-10 text-center text-[12px] text-[#aaa]">Memuat data...</p>
        ) : filtered.length === 0 ? (
          <p className="px-5 py-10 text-center text-[12px] text-[#aaa]">
            {data.length === 0
              ? 'Belum ada riwayat. Layanan yang selesai akan muncul di sini.'
              : 'Tidak ada data ditemukan.'}
          </p>
        ) : (
          filtered.map(r => (
            <div key={r.id}
              className="grid grid-cols-[1fr_1fr_1.2fr_1.4fr_0.8fr_0.9fr_0.9fr_0.5fr] items-center px-5 py-3 border-b border-[#f1f5f9] last:border-b-0 hover:bg-[#fafbfc]">
              <div>
                <p className="text-[13px] font-semibold text-[#111]">{r.customer}</p>
                <p className="text-[11px] text-[#aaa]">{r.plat}</p>
              </div>
              <p className="text-[12px] text-[#555]">{r.kendaraan}</p>
              <p className="text-[12px] text-[#555]">{r.layanan}</p>
              <div className="flex flex-wrap gap-1">
                {r.teknisi.length === 0
                  ? <span className="text-[11px] text-[#aaa]">—</span>
                  : r.teknisi.map(t => (
                    <span key={t.id} className="inline-block px-2 py-0.5 rounded-full bg-[#dbeafe] text-[10px] text-[#1E4FD8]">
                      {t.name.split(' ')[0]}
                    </span>
                  ))
                }
              </div>
              <p className="text-[11px] text-[#666]">{r.selesai}</p>
              <p className="text-[12px] text-[#666]">{r.durasi}</p>
              <p className="text-[12px] font-semibold text-[#1E4FD8]">{r.totalLabel}</p>
              <button onClick={() => setDetailId(r.id)}
                className="px-2 py-1 rounded border border-[#e2e8f0] text-[10px] text-[#555] hover:bg-[#f8fafc] transition">
                Lihat
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
