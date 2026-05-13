import { useState, useMemo, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { expensesAPI } from '../services/api'

// ── Types ──────────────────────────────────────────────────────────────────────

type KategoriPengeluaran =
  | 'Bahan & Material'
  | 'Peralatan'
  | 'Gaji & Upah'
  | 'Listrik & Air'
  | 'Sewa Tempat'
  | 'Pemasaran'
  | 'Lainnya'

interface Pengeluaran {
  id: string
  tanggal: string
  kategori: KategoriPengeluaran
  keterangan: string
  pemasok: string
  refPO: string
  jumlah: number
  dicatat: string
}

type ExpenseForm = Omit<Pengeluaran, 'id' | 'dicatat'> & {
  recurring?: boolean
  recurringMonths?: number
}

const KATEGORI_LIST: KategoriPengeluaran[] = [
  'Bahan & Material', 'Peralatan', 'Gaji & Upah', 'Listrik & Air', 'Sewa Tempat', 'Pemasaran', 'Lainnya',
]

const KATEGORI_COLOR: Record<KategoriPengeluaran, string> = {
  'Bahan & Material': '#1E4FD8',
  'Peralatan':        '#7c3aed',
  'Gaji & Upah':      '#0891b2',
  'Listrik & Air':    '#d97706',
  'Sewa Tempat':      '#16a34a',
  'Pemasaran':        '#db2777',
  'Lainnya':          '#64748b',
}

const KATEGORI_BG: Record<KategoriPengeluaran, string> = {
  'Bahan & Material': 'bg-[#dbeafe] text-[#1A45BF]',
  'Peralatan':        'bg-[#ede9fe] text-[#6d28d9]',
  'Gaji & Upah':      'bg-[#cffafe] text-[#0e7490]',
  'Listrik & Air':    'bg-[#fef3c7] text-[#b45309]',
  'Sewa Tempat':      'bg-[#dcfce7] text-[#15803d]',
  'Pemasaran':        'bg-[#fce7f3] text-[#be185d]',
  'Lainnya':          'bg-[#f1f5f9] text-[#475569]',
}

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

const fmt = (n: number) => 'Rp ' + n.toLocaleString('id-ID')
const fmtShort = (n: number) => {
  if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1)}JT`
  if (n >= 1_000) return `Rp ${(n / 1_000).toFixed(0)}K`
  return fmt(n)
}

const inputCls = 'w-full rounded border border-[#cbd5e1] bg-white px-3 py-2 text-sm text-[#111] outline-none focus:border-[#1E4FD8] focus:ring-2 focus:ring-[#dbeafe] transition'
const labelCls = 'block text-[11px] font-semibold text-[#555] mb-1'

const emptyForm = (): ExpenseForm => ({
  tanggal: new Date().toISOString().slice(0, 10),
  kategori: 'Bahan & Material',
  keterangan: '',
  pemasok: '',
  refPO: '',
  jumlah: 0,
  recurring: false,
  recurringMonths: 12,
})

// ── Component ──────────────────────────────────────────────────────────────────

export default function LaporanPengeluaranPage() {
  const { tenant } = useAuth()
  const now = new Date()
  const [bulan, setBulan] = useState(now.getMonth())
  const [tahun, setTahun] = useState(now.getFullYear())
  const [search, setSearch] = useState('')
  const [filterKat, setFilterKat] = useState<'semua' | KategoriPengeluaran>('semua')
  const [pengeluaranList, setPengeluaranList] = useState<Pengeluaran[]>([])
  const [_loading, setLoading] = useState(true)
  const [_saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!tenant?.id) return
    try {
      setLoading(true)
      const res = await expensesAPI.list()
      const raw: any[] = res.data.data || []
      setPengeluaranList(raw.map(r => ({
        id: r.id,
        tanggal: new Date(r.tanggal).toISOString().slice(0, 10),
        kategori: r.kategori as KategoriPengeluaran,
        keterangan: r.keterangan,
        pemasok: r.pemasok || '',
        refPO: r.refPO || '',
        jumlah: Number(r.jumlah),
        dicatat: r.dicatat || 'Admin',
      })))
    } catch (err) {
      console.error('Failed to fetch expenses:', err)
    } finally {
      setLoading(false)
    }
  }, [tenant?.id])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Filter ──
  const filtered = useMemo(() => {
    return pengeluaranList.filter(e => {
      const d = new Date(e.tanggal)
      if (d.getMonth() !== bulan || d.getFullYear() !== tahun) return false
      if (filterKat !== 'semua' && e.kategori !== filterKat) return false
      const q = search.toLowerCase()
      return !q || e.keterangan.toLowerCase().includes(q) || e.kategori.toLowerCase().includes(q) || e.pemasok.toLowerCase().includes(q)
    })
  }, [pengeluaranList, bulan, tahun, search, filterKat])

  // ── Stats ──
  const stats = useMemo(() => {
    const total = filtered.reduce((s, e) => s + e.jumlah, 0)
    const prevM = bulan === 0 ? 11 : bulan - 1
    const prevY = bulan === 0 ? tahun - 1 : tahun
    const prevTotal = pengeluaranList.filter(e => {
      const d = new Date(e.tanggal)
      return d.getMonth() === prevM && d.getFullYear() === prevY
    }).reduce((s, e) => s + e.jumlah, 0)
    const growth = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : null
    return { total, count: filtered.length, growth }
  }, [filtered, bulan, tahun, pengeluaranList])

  // ── Per kategori ──
  const byKat = useMemo(() => {
    const map: Record<string, number> = {}
    filtered.forEach(e => {
      map[e.kategori] = (map[e.kategori] || 0) + e.jumlah
    })
    return Object.entries(map)
      .map(([k, v]) => ({ kategori: k as KategoriPengeluaran, jumlah: v, pct: stats.total > 0 ? (v / stats.total) * 100 : 0 }))
      .sort((a, b) => b.jumlah - a.jumlah)
  }, [filtered, stats.total])

  // ── Daily chart ──
  const dailyChart = useMemo(() => {
    const days = new Date(tahun, bulan + 1, 0).getDate()
    const arr = Array(days).fill(0)
    filtered.forEach(e => {
      const d = new Date(e.tanggal).getDate() - 1
      arr[d] += e.jumlah
    })
    return arr
  }, [filtered, bulan, tahun])
  const maxDay = Math.max(...dailyChart, 1)

  // ── CRUD ──
  const openAdd = () => {
    setEditingId(null)
    setForm(emptyForm())
    setShowForm(true)
  }

  const openEdit = (e: Pengeluaran) => {
    setEditingId(e.id)
    setForm({ tanggal: e.tanggal, kategori: e.kategori, keterangan: e.keterangan, pemasok: e.pemasok, refPO: e.refPO, jumlah: e.jumlah, recurring: false, recurringMonths: 1 })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.keterangan || form.jumlah <= 0) return
    setSaving(true)
    try {
      if (editingId) {
        await expensesAPI.update(editingId, form)
      } else if (form.recurring) {
        const months = Math.max(1, Math.min(Number(form.recurringMonths) || 1, 36))
        const start = new Date(form.tanggal)
        await Promise.all(Array.from({ length: months }, (_, idx) => {
          const d = new Date(start)
          d.setMonth(start.getMonth() + idx)
          const { recurring: _recurring, recurringMonths: _recurringMonths, ...expensePayload } = form
          return expensesAPI.create({
            ...expensePayload,
            tanggal: d.toISOString().slice(0, 10),
            keterangan: `${form.keterangan} (${idx + 1}/${months})`,
            dicatat: 'Admin',
          })
        }))
      } else {
        await expensesAPI.create({ ...form, dicatat: 'Admin' })
      }
      await fetchData()
      setShowForm(false)
      setEditingId(null)
    } catch (err) {
      console.error('Save expense failed:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await expensesAPI.delete(id)
      await fetchData()
    } catch (err) {
      console.error('Delete expense failed:', err)
    }
    setDeleteId(null)
  }

  return (
    <div className="p-6 space-y-5">

      {/* ── Period + toolbar ── */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex items-center gap-2">
          <select className="rounded border border-[#cbd5e1] px-3 py-1.5 text-sm outline-none focus:border-[#1E4FD8]"
            value={bulan} onChange={e => setBulan(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
          <select className="rounded border border-[#cbd5e1] px-3 py-1.5 text-sm outline-none focus:border-[#1E4FD8]"
            value={tahun} onChange={e => setTahun(Number(e.target.value))}>
            {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 bg-[#1E4FD8] hover:bg-[#1A45BF] text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
        >
          <span className="text-base leading-none">+</span> Tambah Pengeluaran
        </button>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-[#e2e8f0] p-4">
          <p className="text-[11px] text-[#888] font-medium">Total Pengeluaran</p>
          <p className="text-2xl font-bold text-[#dc2626] mt-1">{fmtShort(stats.total)}</p>
          {stats.growth !== null && (
            <p className={`text-[11px] mt-0.5 font-semibold ${stats.growth <= 0 ? 'text-[#16a34a]' : 'text-[#dc2626]'}`}>
              {stats.growth >= 0 ? '↑' : '↓'} {Math.abs(stats.growth).toFixed(1)}% vs bulan lalu
            </p>
          )}
        </div>
        <div className="bg-white rounded-xl border border-[#e2e8f0] p-4">
          <p className="text-[11px] text-[#888] font-medium">Jumlah Transaksi</p>
          <p className="text-2xl font-bold text-[#111] mt-1">{stats.count}</p>
          <p className="text-[11px] text-[#aaa] mt-0.5">entri pengeluaran</p>
        </div>
        <div className="bg-white rounded-xl border border-[#e2e8f0] p-4">
          <p className="text-[11px] text-[#888] font-medium">Pengeluaran Terbesar</p>
          <p className="text-base font-bold text-[#7c3aed] mt-1">{byKat[0]?.kategori || '—'}</p>
          <p className="text-[11px] text-[#aaa] mt-0.5">{byKat[0] ? fmtShort(byKat[0].jumlah) : '—'}</p>
        </div>
        <div className="bg-white rounded-xl border border-[#e2e8f0] p-4">
          <p className="text-[11px] text-[#888] font-medium">Rata-rata / Hari</p>
          <p className="text-2xl font-bold text-[#0891b2] mt-1">
            {fmtShort(stats.total / Math.max(dailyChart.filter(v => v > 0).length, 1))}
          </p>
          <p className="text-[11px] text-[#aaa] mt-0.5">hari dengan pengeluaran</p>
        </div>
      </div>

      {/* ── Charts row ── */}
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">

        {/* Daily chart */}
        <div className="bg-white rounded-xl border border-[#e2e8f0] p-5">
          <p className="text-sm font-bold text-[#111] mb-4">Pengeluaran Harian — {MONTHS[bulan]} {tahun}</p>
          <div className="flex items-end gap-px h-[120px]">
            {dailyChart.map((v, i) => (
              <div
                key={i}
                className="flex-1 rounded-t-sm transition-all"
                style={{
                  height: `${(v / maxDay) * 100}%`,
                  minHeight: v > 0 ? '4px' : '0',
                  background: v > 0 ? '#dc2626' : '#e2e8f0',
                  opacity: v > 0 ? 1 : 0.35,
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

        {/* Per kategori donut-style list */}
        <div className="bg-white rounded-xl border border-[#e2e8f0] p-5">
          <p className="text-sm font-bold text-[#111] mb-4">Komposisi per Kategori</p>
          {byKat.length === 0 && <p className="text-sm text-[#aaa]">Tidak ada data.</p>}
          <div className="space-y-2.5">
            {byKat.map(k => (
              <div key={k.kategori}>
                <div className="flex justify-between mb-1">
                  <p className="text-xs text-[#555]">{k.kategori}</p>
                  <div className="flex items-center gap-2">
                    <p className="text-[11px] text-[#888]">{k.pct.toFixed(1)}%</p>
                    <p className="text-xs font-semibold text-[#111]">{fmtShort(k.jumlah)}</p>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-[#f1f5f9]">
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{ width: `${k.pct}%`, background: KATEGORI_COLOR[k.kategori] }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-xl border border-[#e2e8f0] overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-b border-[#e2e8f0]">
          <p className="text-sm font-bold text-[#111]">Detail Pengeluaran</p>
          <div className="flex gap-2 flex-wrap">
            <input
              className="rounded border border-[#cbd5e1] px-3 py-1.5 text-sm outline-none focus:border-[#1E4FD8] focus:ring-2 focus:ring-[#dbeafe] w-44"
              placeholder="Cari keterangan..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <select
              className="rounded border border-[#cbd5e1] px-3 py-1.5 text-sm outline-none focus:border-[#1E4FD8]"
              value={filterKat}
              onChange={e => setFilterKat(e.target.value as typeof filterKat)}
            >
              <option value="semua">Semua Kategori</option>
              {KATEGORI_LIST.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#f8fafc] text-[#555] text-[11px] font-semibold uppercase tracking-wide border-b border-[#e2e8f0]">
                <th className="px-4 py-3 text-left">Tanggal</th>
                <th className="px-4 py-3 text-left">Kategori</th>
                <th className="px-4 py-3 text-left">Keterangan</th>
                <th className="px-4 py-3 text-left">Pemasok</th>
                <th className="px-4 py-3 text-left">Ref. PO</th>
                <th className="px-4 py-3 text-right">Jumlah</th>
                <th className="px-4 py-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-[#aaa]">
                    Tidak ada pengeluaran di periode ini.
                  </td>
                </tr>
              )}
              {filtered.map(e => (
                <tr key={e.id} className="border-b border-[#f1f5f9] hover:bg-[#f8fafc] transition">
                  <td className="px-4 py-2.5 text-[#555]">
                    {new Date(e.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full ${KATEGORI_BG[e.kategori]}`}>
                      {e.kategori}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-[#333]">{e.keterangan}</td>
                  <td className="px-4 py-2.5 text-[#555]">{e.pemasok || '—'}</td>
                  <td className="px-4 py-2.5 text-[#1E4FD8] font-medium">{e.refPO || '—'}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-[#111]">{fmt(e.jumlah)}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => openEdit(e)}
                        className="text-xs px-2.5 py-1 rounded border border-[#1E4FD8] text-[#1E4FD8] hover:bg-[#EEF3FE] transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteId(e.id)}
                        className="text-xs px-2.5 py-1 rounded border border-[#fca5a5] text-[#dc2626] hover:bg-[#fef2f2] transition"
                      >
                        Hapus
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className="bg-[#f8fafc] border-t-2 border-[#e2e8f0]">
                  <td colSpan={5} className="px-4 py-2.5 text-right font-bold text-[#333]">Total</td>
                  <td className="px-4 py-2.5 text-right font-bold text-[#dc2626]">{fmt(stats.total)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* ── Form Modal ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[#e2e8f0]">
              <h2 className="text-base font-bold text-[#111]">
                {editingId ? 'Edit Pengeluaran' : 'Tambah Pengeluaran'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-[#aaa] hover:text-[#333] text-xl leading-none">✕</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Tanggal *</label>
                  <input type="date" className={inputCls}
                    value={form.tanggal}
                    onChange={e => setForm(f => ({ ...f, tanggal: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Kategori *</label>
                  <select className={inputCls}
                    value={form.kategori}
                    onChange={e => setForm(f => ({ ...f, kategori: e.target.value as KategoriPengeluaran }))}>
                    {KATEGORI_LIST.map(k => <option key={k}>{k}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>Keterangan *</label>
                <input type="text" className={inputCls}
                  placeholder="Deskripsi pengeluaran"
                  value={form.keterangan}
                  onChange={e => setForm(f => ({ ...f, keterangan: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Pemasok</label>
                  <input type="text" className={inputCls}
                    placeholder="Nama pemasok (opsional)"
                    value={form.pemasok}
                    onChange={e => setForm(f => ({ ...f, pemasok: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Ref. PO</label>
                  <input type="text" className={inputCls}
                    placeholder="No. PO terkait (opsional)"
                    value={form.refPO}
                    onChange={e => setForm(f => ({ ...f, refPO: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Jumlah (Rp) *</label>
                <input type="number" min={0} className={inputCls}
                  placeholder="0"
                  value={form.jumlah || ''}
                  onChange={e => setForm(f => ({ ...f, jumlah: Number(e.target.value) }))} />
              </div>
              {!editingId && (
                <div className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3">
                  <label className="flex items-center gap-2 text-sm font-semibold text-[#111]">
                    <input
                      type="checkbox"
                      checked={Boolean(form.recurring)}
                      onChange={e => setForm(f => ({ ...f, recurring: e.target.checked }))}
                    />
                    Jadikan pengeluaran berulang bulanan
                  </label>
                  <p className="mt-1 text-[11px] text-[#888]">Cocok untuk gaji, listrik, sewa, internet. Kalau ada perubahan karyawan/resign, edit atau hapus bulan berikutnya saja.</p>
                  {form.recurring && (
                    <div className="mt-3 w-40">
                      <label className={labelCls}>Jumlah Bulan</label>
                      <input
                        type="number"
                        min={1}
                        max={36}
                        className={inputCls}
                        value={form.recurringMonths || 12}
                        onChange={e => setForm(f => ({ ...f, recurringMonths: Number(e.target.value) }))}
                      />
                    </div>
                  )}
                </div>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setShowForm(false)}
                  className="text-sm px-4 py-2 rounded-lg bg-[#f1f5f9] text-[#555] hover:bg-[#e2e8f0] transition">
                  Batal
                </button>
                <button
                  onClick={handleSave}
                  disabled={!form.keterangan || form.jumlah <= 0}
                  className="text-sm px-5 py-2 rounded-lg bg-[#1E4FD8] text-white hover:bg-[#1A45BF] font-semibold transition disabled:opacity-40">
                  {editingId ? 'Simpan' : 'Tambah'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm ── */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-bold text-[#111]">Hapus Pengeluaran?</h3>
            <p className="text-sm text-[#666]">Data yang dihapus tidak bisa dikembalikan.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteId(null)}
                className="text-sm px-4 py-2 rounded-lg bg-[#f1f5f9] text-[#555] hover:bg-[#e2e8f0] transition">
                Batal
              </button>
              <button onClick={() => handleDelete(deleteId)}
                className="text-sm px-4 py-2 rounded-lg bg-[#dc2626] text-white hover:bg-[#b91c1c] transition font-semibold">
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
