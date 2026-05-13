import { useState, useMemo, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { registrationsAPI, expensesAPI } from '../services/api'

// ── Types ──────────────────────────────────────────────────────────────────────

type JenisAliran = 'masuk' | 'keluar'

interface AliranKas {
  id: string
  tanggal: string
  jenis: JenisAliran
  kategori: string
  keterangan: string
  referensi: string
  jumlah: number
}


const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']

const fmt = (n: number) => 'Rp ' + n.toLocaleString('id-ID')
const cleanNumber = (v: string) => v.replace(/[^\d]/g, '')
const fmtNumberInput = (v: number) => v > 0 ? Math.round(v).toLocaleString('id-ID', { maximumFractionDigits: 0 }) : ''
const fmtShort = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1)}JT`
  if (Math.abs(n) >= 1_000) return `Rp ${(n / 1_000).toFixed(0)}K`
  return fmt(n)
}

const KATEGORI_MASUK = ['Pembayaran Layanan', 'DP Booking', 'Lainnya']
const KATEGORI_KELUAR = ['Bahan & Material', 'Pembelian Bahan', 'Pembelian Peralatan', 'Gaji & Upah', 'Listrik & Air', 'Utilitas', 'Sewa', 'Pemasaran', 'Lainnya']
const inputCls = 'w-full rounded border border-[#cbd5e1] bg-white px-3 py-2 text-sm text-[#111] outline-none focus:border-[#1E4FD8] focus:ring-2 focus:ring-[#dbeafe] transition'
const labelCls = 'block text-[11px] font-semibold text-[#555] mb-1'

function isPaidRegistration(r: any) {
  const status = String(r.paymentStatus || '').toUpperCase()
  return status === 'LUNAS' || status === 'PAID'
}

export default function AliranKasPage() {
  const { tenant } = useAuth()
  const now = new Date()
  const [bulan, setBulan] = useState(now.getMonth())
  const [tahun, setTahun] = useState(now.getFullYear())
  const [filterJenis, setFilterJenis] = useState<'semua' | JenisAliran>('semua')
  const [search, setSearch] = useState('')
  const [aliranList, setAliranList] = useState<AliranKas[]>([])
  const [_loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ tanggal: '', jenis: 'masuk' as JenisAliran, kategori: 'Pembayaran Layanan', keterangan: '', referensi: '', jumlah: 0 })
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!tenant?.id) return
    try {
      setLoading(true)
      const [regRes, expRes] = await Promise.all([
        registrationsAPI.list(tenant.id),
        expensesAPI.list(),
      ])
      const regs: any[] = regRes.data.data || []
      const exps: any[] = expRes.data.data || []

      const masuk: AliranKas[] = regs
        .filter(isPaidRegistration)
        .map(r => ({
          id: `reg-${r.id}`,
          tanggal: new Date(r.updatedAt || r.createdAt).toISOString().slice(0, 10),
          jenis: 'masuk' as JenisAliran,
          kategori: 'Pembayaran Layanan',
          keterangan: `${r.workshop?.title || 'Layanan'} - ${r.customer?.name || 'Pelanggan'}`,
          referensi: `INV-${r.id.slice(-6).toUpperCase()}`,
          jumlah: Number(r.workshop?.price || 0),
        }))

      const keluar: AliranKas[] = exps.map(e => ({
        id: `exp-${e.id}`,
        tanggal: new Date(e.tanggal).toISOString().slice(0, 10),
        jenis: 'keluar' as JenisAliran,
        kategori: e.kategori,
        keterangan: e.keterangan,
        referensi: e.refPO || '',
        jumlah: Number(e.jumlah),
      }))

      setAliranList([...masuk, ...keluar])
    } catch (err) {
      console.error('Failed to fetch kas data:', err)
    } finally {
      setLoading(false)
    }
  }, [tenant?.id])

  useEffect(() => { fetchData() }, [fetchData])

  const saldoAwal = 0

  const filtered = useMemo(() => {
    return aliranList
      .filter(a => {
        const d = new Date(a.tanggal)
        if (d.getMonth() !== bulan || d.getFullYear() !== tahun) return false
        if (filterJenis !== 'semua' && a.jenis !== filterJenis) return false
        const q = search.toLowerCase()
        return !q || a.keterangan.toLowerCase().includes(q) || a.kategori.toLowerCase().includes(q) || a.referensi.toLowerCase().includes(q)
      })
      .sort((a, b) => a.tanggal.localeCompare(b.tanggal))
  }, [aliranList, bulan, tahun, filterJenis, search])

  const stats = useMemo(() => {
    const masuk = aliranList.filter(a => { const d = new Date(a.tanggal); return d.getMonth() === bulan && d.getFullYear() === tahun && a.jenis === 'masuk' }).reduce((s, a) => s + a.jumlah, 0)
    const keluar = aliranList.filter(a => { const d = new Date(a.tanggal); return d.getMonth() === bulan && d.getFullYear() === tahun && a.jenis === 'keluar' }).reduce((s, a) => s + a.jumlah, 0)
    return { masuk, keluar, net: masuk - keluar, saldoAkhir: saldoAwal + masuk - keluar }
  }, [aliranList, bulan, tahun, saldoAwal])

  // daily net for chart
  const dailyData = useMemo(() => {
    const days = new Date(tahun, bulan + 1, 0).getDate()
    const masukArr = Array(days).fill(0)
    const keluarArr = Array(days).fill(0)
    aliranList.filter(a => { const d = new Date(a.tanggal); return d.getMonth() === bulan && d.getFullYear() === tahun }).forEach(a => {
      const d = new Date(a.tanggal).getDate() - 1
      if (a.jenis === 'masuk') masukArr[d] += a.jumlah
      else keluarArr[d] += a.jumlah
    })
    return { masukArr, keluarArr }
  }, [aliranList, bulan, tahun])
  const maxBar = Math.max(...dailyData.masukArr, ...dailyData.keluarArr, 1)

  // cumulative saldo
  const cumulative = useMemo(() => {
    let running = saldoAwal
    return dailyData.masukArr.map((m, i) => {
      running += m - dailyData.keluarArr[i]
      return running
    })
  }, [dailyData, saldoAwal])
  const maxSaldo = Math.max(...cumulative, saldoAwal)
  const minSaldo = Math.min(...cumulative, saldoAwal)
  const saldoRange = maxSaldo - minSaldo || 1

  // running balance for table
  const withBalance = useMemo(() => {
    let bal = saldoAwal
    return filtered.map(a => {
      bal += a.jenis === 'masuk' ? a.jumlah : -a.jumlah
      return { ...a, saldo: bal }
    })
  }, [filtered, saldoAwal])

  const openAdd = () => {
    setEditingId(null)
    setForm({ tanggal: new Date().toISOString().slice(0,10), jenis: 'masuk', kategori: 'Pembayaran Layanan', keterangan: '', referensi: '', jumlah: 0 })
    setShowForm(true)
  }
  const openEdit = (a: AliranKas) => {
    setEditingId(a.id)
    setForm({ tanggal: a.tanggal, jenis: a.jenis, kategori: a.kategori, keterangan: a.keterangan, referensi: a.referensi, jumlah: a.jumlah })
    setShowForm(true)
  }
  const handleSave = () => {
    if (!form.keterangan || form.jumlah <= 0) return
    if (editingId) {
      setAliranList(prev => prev.map(a => a.id === editingId ? { ...a, ...form } : a))
    } else {
      setAliranList(prev => [{ id: Date.now().toString(), ...form }, ...prev])
    }
    setShowForm(false)
  }

  const kategoriOptions = form.jenis === 'masuk' ? KATEGORI_MASUK : KATEGORI_KELUAR

  return (
    <div className="p-6 space-y-5">

      {/* Period + toolbar */}
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
        <button onClick={openAdd} className="flex items-center gap-1.5 bg-[#1E4FD8] hover:bg-[#1A45BF] text-white text-sm font-semibold px-4 py-2 rounded-lg transition">
          <span className="text-base leading-none">+</span> Tambah Entri
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Saldo Awal', value: fmtShort(saldoAwal), sub: `1 ${MONTHS[bulan]}`, color: '#555' },
          { label: 'Total Masuk', value: fmtShort(stats.masuk), sub: 'kas diterima', color: '#16a34a' },
          { label: 'Total Keluar', value: fmtShort(stats.keluar), sub: 'kas dikeluarkan', color: '#dc2626' },
          { label: 'Saldo Akhir', value: fmtShort(stats.saldoAkhir), sub: stats.net >= 0 ? `+${fmtShort(stats.net)} neto` : `${fmtShort(stats.net)} neto`, color: stats.saldoAkhir >= 0 ? '#1E4FD8' : '#dc2626' },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-xl border border-[#e2e8f0] p-4">
            <p className="text-[11px] text-[#888] font-medium">{c.label}</p>
            <p className="text-xl font-bold mt-1" style={{ color: c.color }}>{c.value}</p>
            <p className="text-[11px] text-[#aaa] mt-0.5">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Masuk vs Keluar bar */}
        <div className="bg-white rounded-xl border border-[#e2e8f0] p-5">
          <div className="flex items-center gap-4 mb-4">
            <p className="text-sm font-bold text-[#111]">Kas Masuk vs Keluar</p>
            <div className="flex gap-3 ml-auto">
              <span className="flex items-center gap-1 text-[11px] text-[#555]"><span className="w-2.5 h-2.5 rounded-sm inline-block bg-[#22c55e]" />Masuk</span>
              <span className="flex items-center gap-1 text-[11px] text-[#555]"><span className="w-2.5 h-2.5 rounded-sm inline-block bg-[#f87171]" />Keluar</span>
            </div>
          </div>
          <div className="flex items-end gap-0.5 h-[110px]">
            {dailyData.masukArr.map((m, i) => (
              <div key={i} className="flex-1 flex flex-col-reverse gap-px">
                <div className="rounded-sm" style={{ height: `${(m / maxBar) * 55}px`, background: m > 0 ? '#22c55e' : 'transparent', minHeight: m > 0 ? '3px' : '0' }} />
                <div className="rounded-sm" style={{ height: `${(dailyData.keluarArr[i] / maxBar) * 55}px`, background: dailyData.keluarArr[i] > 0 ? '#f87171' : 'transparent', minHeight: dailyData.keluarArr[i] > 0 ? '3px' : '0' }} />
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-1">
            <p className="text-[10px] text-[#aaa]">1</p>
            <p className="text-[10px] text-[#aaa]">{dailyData.masukArr.length}</p>
          </div>
        </div>

        {/* Cumulative saldo line */}
        <div className="bg-white rounded-xl border border-[#e2e8f0] p-5">
          <p className="text-sm font-bold text-[#111] mb-4">Tren Saldo Kas</p>
          <div className="relative h-[110px]">
            <svg className="w-full h-full" viewBox={`0 0 ${cumulative.length} 100`} preserveAspectRatio="none">
              <polyline
                fill="none"
                stroke="#1E4FD8"
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
                points={cumulative.map((v, i) => `${i + 0.5},${100 - ((v - minSaldo) / saldoRange) * 90}`).join(' ')}
              />
            </svg>
          </div>
          <div className="flex justify-between mt-1">
            <p className="text-[10px] text-[#aaa]">1</p>
            <p className="text-[10px] text-[#aaa]">{cumulative.length}</p>
          </div>
          <div className="flex justify-between text-[11px] mt-1">
            <span className="text-[#aaa]">Min: <span className="text-[#555] font-medium">{fmtShort(minSaldo)}</span></span>
            <span className="text-[#aaa]">Max: <span className="text-[#555] font-medium">{fmtShort(maxSaldo)}</span></span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[#e2e8f0] overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-b border-[#e2e8f0]">
          <p className="text-sm font-bold text-[#111]">Rincian Aliran Kas</p>
          <div className="flex gap-2">
            <input className="rounded border border-[#cbd5e1] px-3 py-1.5 text-sm outline-none focus:border-[#1E4FD8] w-44"
              placeholder="Cari keterangan..." value={search} onChange={e => setSearch(e.target.value)} />
            <select className="rounded border border-[#cbd5e1] px-3 py-1.5 text-sm outline-none focus:border-[#1E4FD8]"
              value={filterJenis} onChange={e => setFilterJenis(e.target.value as typeof filterJenis)}>
              <option value="semua">Semua</option>
              <option value="masuk">Masuk</option>
              <option value="keluar">Keluar</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#f8fafc] text-[#555] text-[11px] font-semibold uppercase tracking-wide border-b border-[#e2e8f0]">
                <th className="px-4 py-3 text-left">Tanggal</th>
                <th className="px-4 py-3 text-left">Jenis</th>
                <th className="px-4 py-3 text-left">Kategori</th>
                <th className="px-4 py-3 text-left">Keterangan</th>
                <th className="px-4 py-3 text-left">Referensi</th>
                <th className="px-4 py-3 text-right">Jumlah</th>
                <th className="px-4 py-3 text-right">Saldo</th>
                <th className="px-4 py-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {withBalance.length === 0 && (
                <tr><td colSpan={8} className="text-center py-10 text-[#aaa]">Tidak ada data aliran kas.</td></tr>
              )}
              {withBalance.map(a => (
                <tr key={a.id} className="border-b border-[#f1f5f9] hover:bg-[#f8fafc] transition">
                  <td className="px-4 py-2.5 text-[#555]">{new Date(a.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full ${a.jenis === 'masuk' ? 'bg-[#dcfce7] text-[#15803d]' : 'bg-[#fee2e2] text-[#b91c1c]'}`}>
                      {a.jenis === 'masuk' ? '↑ Masuk' : '↓ Keluar'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-[#555]">{a.kategori}</td>
                  <td className="px-4 py-2.5 text-[#333]">{a.keterangan}</td>
                  <td className="px-4 py-2.5 text-[#1E4FD8] font-medium">{a.referensi || '—'}</td>
                  <td className={`px-4 py-2.5 text-right font-semibold ${a.jenis === 'masuk' ? 'text-[#16a34a]' : 'text-[#dc2626]'}`}>
                    {a.jenis === 'masuk' ? '+' : '-'}{fmt(a.jumlah)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-[#111]">{fmt(a.saldo)}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => openEdit(a)} className="text-xs px-2.5 py-1 rounded border border-[#1E4FD8] text-[#1E4FD8] hover:bg-[#EEF3FE] transition">Edit</button>
                      <button onClick={() => setDeleteId(a.id)} className="text-xs px-2.5 py-1 rounded border border-[#fca5a5] text-[#dc2626] hover:bg-[#fef2f2] transition">Hapus</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {withBalance.length > 0 && (
              <tfoot>
                <tr className="bg-[#f8fafc] border-t-2 border-[#e2e8f0]">
                  <td colSpan={5} className="px-4 py-2.5 font-bold text-[#333] text-right">Saldo Akhir</td>
                  <td className={`px-4 py-2.5 text-right font-bold ${stats.net >= 0 ? 'text-[#16a34a]' : 'text-[#dc2626]'}`}>
                    {stats.net >= 0 ? '+' : ''}{fmt(stats.net)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-bold text-[#1E4FD8]">{fmt(stats.saldoAkhir)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[#e2e8f0]">
              <h2 className="text-base font-bold text-[#111]">{editingId ? 'Edit Entri Kas' : 'Tambah Entri Kas'}</h2>
              <button onClick={() => setShowForm(false)} className="text-[#aaa] hover:text-[#333] text-xl leading-none">✕</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Tanggal *</label>
                  <input type="date" className={inputCls} value={form.tanggal} onChange={e => setForm(f => ({ ...f, tanggal: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Jenis *</label>
                  <select className={inputCls} value={form.jenis} onChange={e => {
                    const j = e.target.value as JenisAliran
                    setForm(f => ({ ...f, jenis: j, kategori: j === 'masuk' ? KATEGORI_MASUK[0] : KATEGORI_KELUAR[0] }))
                  }}>
                    <option value="masuk">Masuk</option>
                    <option value="keluar">Keluar</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>Kategori *</label>
                <select className={inputCls} value={form.kategori} onChange={e => setForm(f => ({ ...f, kategori: e.target.value }))}>
                  {kategoriOptions.map(k => <option key={k}>{k}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Keterangan *</label>
                <input type="text" className={inputCls} placeholder="Deskripsi transaksi kas" value={form.keterangan} onChange={e => setForm(f => ({ ...f, keterangan: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Referensi</label>
                  <input type="text" className={inputCls} placeholder="No. INV / PO" value={form.referensi} onChange={e => setForm(f => ({ ...f, referensi: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Jumlah (Rp) *</label>
                  <input type="text" inputMode="numeric" className={inputCls} value={fmtNumberInput(form.jumlah)} onChange={e => setForm(f => ({ ...f, jumlah: Number(cleanNumber(e.target.value)) }))} placeholder="0" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setShowForm(false)} className="text-sm px-4 py-2 rounded-lg bg-[#f1f5f9] text-[#555] hover:bg-[#e2e8f0] transition">Batal</button>
                <button onClick={handleSave} disabled={!form.keterangan || form.jumlah <= 0} className="text-sm px-5 py-2 rounded-lg bg-[#1E4FD8] text-white hover:bg-[#1A45BF] font-semibold transition disabled:opacity-40">
                  {editingId ? 'Simpan' : 'Tambah'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-bold text-[#111]">Hapus Entri Kas?</h3>
            <p className="text-sm text-[#666]">Data yang dihapus tidak bisa dikembalikan.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteId(null)} className="text-sm px-4 py-2 rounded-lg bg-[#f1f5f9] text-[#555]">Batal</button>
              <button onClick={() => { setAliranList(prev => prev.filter(a => a.id !== deleteId)); setDeleteId(null) }} className="text-sm px-4 py-2 rounded-lg bg-[#dc2626] text-white font-semibold">Hapus</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
