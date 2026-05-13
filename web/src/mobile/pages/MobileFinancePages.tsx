import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { expensesAPI, registrationsAPI, serviceMaterialsAPI } from '../../services/api'
import { MobileSubHeader } from '../MobileLayout'

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const fmtRp = (n: number) => 'Rp ' + Math.round(n || 0).toLocaleString('id-ID')
const cleanNumber = (v: string) => v.replace(/[^\d]/g, '')
const fmtNumberInput = (v: number) => v > 0 ? Math.round(v).toLocaleString('id-ID', { maximumFractionDigits: 0 }) : ''
const fmtShort = (n: number) => Math.abs(n) >= 1_000_000 ? `Rp ${(n / 1_000_000).toFixed(1)}JT` : fmtRp(n)
const inputCls = 'w-full bg-white border border-wm-line rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-[#1E4FD8]'

type ExpenseForm = { tanggal: string; kategori: string; keterangan: string; pemasok: string; refPO: string; jumlah: number; recurring?: boolean; recurringMonths?: number }

function parseHpp(notes?: string) {
  const m = notes?.match(/hpp:([\d.]+)/)
  return m ? Number(m[1]) || 0 : 0
}

function paymentStatus(r: any): 'lunas' | 'pending' | 'overdue' {
  const raw = String(r.paymentStatus || '').toUpperCase()
  if (raw === 'LUNAS' || raw === 'PAID') return 'lunas'
  if (raw === 'OVERDUE') return 'overdue'
  return 'pending'
}

function isOperationalExpense(e: any) {
  const category = String(e.kategori || '').toLowerCase()
  return category !== 'material' && !e.refPO
}

function useFinanceData() {
  const { tenant } = useAuth()
  const [regs, setRegs] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [hppMap, setHppMap] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    if (!tenant?.id) return
    setLoading(true)
    try {
      const [regRes, expRes] = await Promise.all([
        registrationsAPI.list(tenant.id),
        expensesAPI.list(),
      ])
      const r = regRes.data.data || []
      setRegs(r)
      setExpenses(expRes.data.data || [])
      const ids = [...new Set<string>(r.map((x: any) => x.workshopId).filter(Boolean))]
      const entries = await Promise.all(ids.map(id =>
        serviceMaterialsAPI.list(id).then(res => [id, Number(res.data.hpp || 0)] as const).catch(() => [id, 0] as const)
      ))
      setHppMap(Object.fromEntries(entries))
    } finally {
      setLoading(false)
    }
  }, [tenant?.id])

  useEffect(() => { fetchData() }, [fetchData])
  return { regs, expenses, hppMap, loading, fetchData }
}

function usePeriod() {
  const today = new Date()
  const [month, setMonth] = useState(today.getMonth())
  const [year, setYear] = useState(today.getFullYear())
  const inPeriod = (date?: string) => {
    if (!date) return false
    const d = new Date(date)
    return d.getMonth() === month && d.getFullYear() === year
  }
  return { month, year, setMonth, setYear, inPeriod }
}

function PeriodControls({ month, year, setMonth, setYear }: ReturnType<typeof usePeriod>) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <select value={month} onChange={e => setMonth(Number(e.target.value))} className={inputCls}>
        {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
      </select>
      <select value={year} onChange={e => setYear(Number(e.target.value))} className={inputCls}>
        {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
      </select>
    </div>
  )
}

function Stat({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-wm-line bg-white p-3 min-w-0">
      <p className="text-[10px] text-ink-3 truncate">{label}</p>
      <p className="mt-1 text-[18px] font-extrabold truncate" style={{ color }}>{value}</p>
      {sub && <p className="mt-1 text-[10px] text-ink-4 truncate">{sub}</p>}
    </div>
  )
}

function MiniBars({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values, 1)
  return (
    <div className="flex h-[86px] items-end gap-px rounded-2xl border border-wm-line bg-white p-3">
      {values.map((v, i) => (
        <div key={i} className="flex-1 rounded-t-sm" style={{ height: v > 0 ? `${Math.max(5, (v / max) * 100)}%` : 2, background: v > 0 ? color : '#e2e8f0' }} />
      ))}
    </div>
  )
}

export function MobilePendapatan() {
  const period = usePeriod()
  const { regs, hppMap, loading } = useFinanceData()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'semua' | 'lunas' | 'pending' | 'overdue'>('semua')

  const rows = useMemo(() => regs.map(r => {
    const price = Number(r.workshop?.price || 0)
    const hpp = parseHpp(r.notes) || Number(hppMap[r.workshopId] || 0)
    return {
      id: r.id,
      tanggal: (r.scheduledDate || r.updatedAt || r.createdAt || '').slice(0, 10),
      invoice: `INV-${String(r.id).slice(-6).toUpperCase()}`,
      pelanggan: r.customer?.name || 'Pelanggan',
      layanan: r.workshop?.title || 'Layanan',
      total: price,
      hpp,
      laba: price - hpp,
      status: paymentStatus(r),
    }
  }).filter(t => {
    if (!period.inPeriod(t.tanggal)) return false
    if (status !== 'semua' && t.status !== status) return false
    const q = search.toLowerCase()
    return !q || `${t.invoice} ${t.pelanggan} ${t.layanan}`.toLowerCase().includes(q)
  }), [regs, hppMap, period.month, period.year, search, status])

  const stats = useMemo(() => ({
    lunas: rows.filter(r => r.status === 'lunas').reduce((s, r) => s + r.total, 0),
    bruto: rows.reduce((s, r) => s + r.total, 0),
    hpp: rows.reduce((s, r) => s + r.hpp, 0),
    outstanding: rows.filter(r => r.status !== 'lunas').reduce((s, r) => s + r.total, 0),
  }), [rows])

  const daily = useMemo(() => {
    const days = new Date(period.year, period.month + 1, 0).getDate()
    const arr = Array(days).fill(0)
    rows.filter(r => r.status === 'lunas').forEach(r => { arr[new Date(r.tanggal).getDate() - 1] += r.total })
    return arr
  }, [rows, period.month, period.year])

  return (
    <>
      <MobileSubHeader title="Pendapatan" subtitle={loading ? 'Memuat...' : `${rows.length} transaksi`} />
      <div className="space-y-3 px-4 pb-4 pt-3">
        <PeriodControls {...period} />
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Pendapatan Lunas" value={fmtShort(stats.lunas)} color="#1E4FD8" />
          <Stat label="Potensi Laba" value={fmtShort(stats.bruto - stats.hpp)} color="#16a34a" />
          <Stat label="HPP" value={fmtShort(stats.hpp)} color="#f97316" />
          <Stat label="Outstanding" value={fmtShort(stats.outstanding)} color="#dc2626" />
        </div>
        <MiniBars values={daily} color="#1E4FD8" />
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari invoice, pelanggan..." className={inputCls} />
          <select value={status} onChange={e => setStatus(e.target.value as any)} className={inputCls}>
            <option value="semua">Semua</option><option value="lunas">Lunas</option><option value="pending">Pending</option><option value="overdue">Overdue</option>
          </select>
        </div>
        <div className="space-y-2">
          {rows.map(r => <FinanceCard key={r.id} title={r.invoice} subtitle={`${r.pelanggan} - ${r.layanan}`} amount={r.total} meta={`HPP ${fmtRp(r.hpp)} | Laba ${fmtRp(r.laba)}`} tone={r.status === 'lunas' ? '#16a34a' : '#f59e0b'} tag={r.status} />)}
          {!loading && rows.length === 0 && <Empty text="Tidak ada pendapatan di periode ini." />}
        </div>
      </div>
    </>
  )
}

export function MobilePengeluaran() {
  const period = usePeriod()
  const { expenses, loading, fetchData } = useFinanceData()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('semua')
  const [form, setForm] = useState<ExpenseForm | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const categories = ['Bahan & Material', 'Peralatan', 'Gaji & Upah', 'Listrik & Air', 'Sewa Tempat', 'Pemasaran', 'Lainnya']

  const rows = useMemo(() => expenses.map(e => ({
    id: e.id,
    tanggal: new Date(e.tanggal).toISOString().slice(0, 10),
    kategori: e.kategori || 'Lainnya',
    keterangan: e.keterangan || '-',
    pemasok: e.pemasok || '',
    refPO: e.refPO || '',
    jumlah: Number(e.jumlah || 0),
  })).filter(e => {
    if (!period.inPeriod(e.tanggal)) return false
    if (category !== 'semua' && e.kategori !== category) return false
    const q = search.toLowerCase()
    return !q || `${e.kategori} ${e.keterangan} ${e.pemasok} ${e.refPO}`.toLowerCase().includes(q)
  }), [expenses, period.month, period.year, search, category])

  const total = rows.reduce((s, e) => s + e.jumlah, 0)
  const byCategory = (Object.entries(
    rows.reduce<Record<string, number>>((m, e) => {
      m[e.kategori] = (m[e.kategori] || 0) + e.jumlah
      return m
    }, {})
  ) as [string, number][]).sort((a, b) => b[1] - a[1])
  const daily = useMemo(() => {
    const days = new Date(period.year, period.month + 1, 0).getDate()
    const arr = Array(days).fill(0)
    rows.forEach(e => { arr[new Date(e.tanggal).getDate() - 1] += e.jumlah })
    return arr
  }, [rows, period.month, period.year])

  const openAdd = () => {
    setEditingId(null)
    setForm({ tanggal: new Date().toISOString().slice(0, 10), kategori: categories[0], keterangan: '', pemasok: '', refPO: '', jumlah: 0, recurring: false, recurringMonths: 12 })
  }
  const openEdit = (e: any) => {
    setEditingId(e.id)
    setForm({ tanggal: e.tanggal, kategori: e.kategori, keterangan: e.keterangan, pemasok: e.pemasok, refPO: e.refPO, jumlah: e.jumlah, recurring: false, recurringMonths: 1 })
  }
  const save = async () => {
    if (!form || !form.keterangan || form.jumlah <= 0) return
    const { recurring, recurringMonths = 1, ...payload } = form
    if (editingId) await expensesAPI.update(editingId, payload)
    else if (recurring) {
      const base = new Date(`${form.tanggal}T00:00:00`)
      const months = Math.max(1, Math.min(Number(recurringMonths) || 1, 36))
      await Promise.all(Array.from({ length: months }).map((_, idx) => {
        const d = new Date(base)
        d.setMonth(base.getMonth() + idx)
        return expensesAPI.create({
          ...payload,
          tanggal: d.toISOString().slice(0, 10),
          dicatat: `Mobile - berulang monthly ${idx + 1}/${months}`,
        })
      }))
    } else await expensesAPI.create({ ...payload, dicatat: 'Mobile' })
    setForm(null); setEditingId(null); fetchData()
  }
  const remove = async (id: string) => {
    if (!confirm('Hapus pengeluaran ini?')) return
    await expensesAPI.delete(id); fetchData()
  }

  return (
    <>
      <MobileSubHeader title="Pengeluaran" subtitle={loading ? 'Memuat...' : `${rows.length} entri`} />
      <div className="space-y-3 px-4 pb-4 pt-3">
        <PeriodControls {...period} />
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Total Pengeluaran" value={fmtShort(total)} color="#dc2626" />
          <Stat label="Jumlah Entri" value={String(rows.length)} color="#111" />
          <Stat label="Terbesar" value={byCategory[0]?.[0] || '-'} color="#7c3aed" sub={byCategory[0] ? fmtShort(byCategory[0][1]) : undefined} />
          <Stat label="Rata-rata" value={fmtShort(total / Math.max(daily.filter(Boolean).length, 1))} color="#0891b2" />
        </div>
        <MiniBars values={daily} color="#dc2626" />
        <button onClick={openAdd} className="w-full rounded-2xl bg-brand py-3 text-[13px] font-bold text-white">+ Tambah Pengeluaran</button>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari pengeluaran..." className={inputCls} />
          <select value={category} onChange={e => setCategory(e.target.value)} className={inputCls}>
            <option value="semua">Semua</option>{categories.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          {rows.map(e => (
            <FinanceCard key={e.id} title={e.keterangan} subtitle={`${e.kategori}${e.pemasok ? ' - ' + e.pemasok : ''}`} amount={e.jumlah} meta={`${e.tanggal}${e.refPO ? ' | ' + e.refPO : ''}`} tone="#dc2626" actions={<><button onClick={() => openEdit(e)} className="rounded-xl bg-brand-50 px-3 py-2 text-[11px] font-bold text-brand">Edit</button><button onClick={() => remove(e.id)} className="rounded-xl bg-[#fef2f2] px-3 py-2 text-[11px] font-bold text-[#dc2626]">Hapus</button></>} />
          ))}
          {!loading && rows.length === 0 && <Empty text="Tidak ada pengeluaran di periode ini." />}
        </div>
      </div>
      {form && <ExpenseSheet form={form} setForm={setForm} categories={categories} onSave={save} onClose={() => setForm(null)} editing={Boolean(editingId)} />}
    </>
  )
}

export function MobileAliranKas() {
  const period = usePeriod()
  const { regs, expenses, loading } = useFinanceData()
  const [kind, setKind] = useState<'semua' | 'masuk' | 'keluar'>('semua')

  const rows = useMemo(() => {
    const masuk = regs.filter(r => paymentStatus(r) === 'lunas').map(r => ({
      id: `reg-${r.id}`, tanggal: (r.updatedAt || r.createdAt).slice(0, 10), jenis: 'masuk' as const,
      kategori: 'Pembayaran Layanan', keterangan: `${r.workshop?.title || 'Layanan'} - ${r.customer?.name || '-'}`,
      ref: `INV-${String(r.id).slice(-6).toUpperCase()}`, jumlah: Number(r.workshop?.price || 0),
    }))
    const keluar = expenses.map(e => ({
      id: `exp-${e.id}`, tanggal: new Date(e.tanggal).toISOString().slice(0, 10), jenis: 'keluar' as const,
      kategori: e.kategori || 'Pengeluaran', keterangan: e.keterangan || '-', ref: e.refPO || '', jumlah: Number(e.jumlah || 0),
    }))
    let balance = 0
    return [...masuk, ...keluar].filter(r => period.inPeriod(r.tanggal) && (kind === 'semua' || r.jenis === kind)).sort((a, b) => a.tanggal.localeCompare(b.tanggal)).map(r => {
      balance += r.jenis === 'masuk' ? r.jumlah : -r.jumlah
      return { ...r, balance }
    })
  }, [regs, expenses, period.month, period.year, kind])

  const masuk = rows.filter(r => r.jenis === 'masuk').reduce((s, r) => s + r.jumlah, 0)
  const keluar = rows.filter(r => r.jenis === 'keluar').reduce((s, r) => s + r.jumlah, 0)

  return (
    <>
      <MobileSubHeader title="Aliran Kas" subtitle={loading ? 'Memuat...' : `${rows.length} transaksi`} />
      <div className="space-y-3 px-4 pb-4 pt-3">
        <PeriodControls {...period} />
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Kas Masuk" value={fmtShort(masuk)} color="#16a34a" />
          <Stat label="Kas Keluar" value={fmtShort(keluar)} color="#dc2626" />
          <Stat label="Net" value={fmtShort(masuk - keluar)} color={masuk - keluar >= 0 ? '#1E4FD8' : '#dc2626'} />
          <Stat label="Saldo Akhir" value={fmtShort(rows.length ? rows[rows.length - 1].balance : 0)} color="#111" />
        </div>
        <select value={kind} onChange={e => setKind(e.target.value as any)} className={inputCls}>
          <option value="semua">Semua</option><option value="masuk">Masuk</option><option value="keluar">Keluar</option>
        </select>
        <div className="space-y-2">
          {rows.map(r => <FinanceCard key={r.id} title={r.keterangan} subtitle={`${r.kategori}${r.ref ? ' - ' + r.ref : ''}`} amount={r.jumlah} meta={`Saldo ${fmtRp(r.balance)}`} tone={r.jenis === 'masuk' ? '#16a34a' : '#dc2626'} tag={r.jenis} />)}
          {!loading && rows.length === 0 && <Empty text="Tidak ada aliran kas di periode ini." />}
        </div>
      </div>
    </>
  )
}

export function MobileRingkasanKeuangan() {
  const { regs, expenses, hppMap, loading } = useFinanceData()
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  const monthly = useMemo(() => MONTHS.map((m, idx) => {
      const monthRegs = regs.filter(r => paymentStatus(r) === 'lunas' && new Date(r.updatedAt || r.createdAt).getFullYear() === year && new Date(r.updatedAt || r.createdAt).getMonth() === idx)
    const opExps = expenses.filter(e => isOperationalExpense(e) && new Date(e.tanggal).getFullYear() === year && new Date(e.tanggal).getMonth() === idx)
    const pendapatan = monthRegs.reduce((s, r) => s + Number(r.workshop?.price || 0), 0)
    const hpp = monthRegs.reduce((s, r) => s + (parseHpp(r.notes) || Number(hppMap[r.workshopId] || 0)), 0)
    const pengeluaran = opExps.reduce((s, e) => s + Number(e.jumlah || 0), 0)
    return { label: m, pendapatan, hpp, pengeluaran, laba: pendapatan - hpp - pengeluaran }
  }), [regs, expenses, hppMap, year])
  const selected = monthly[month]
  const ytd = monthly.reduce((a, m) => ({ pendapatan: a.pendapatan + m.pendapatan, hpp: a.hpp + m.hpp, pengeluaran: a.pengeluaran + m.pengeluaran, laba: a.laba + m.laba }), { pendapatan: 0, hpp: 0, pengeluaran: 0, laba: 0 })

  return (
    <>
      <MobileSubHeader title="Ringkasan Keuangan" subtitle={loading ? 'Memuat...' : String(year)} />
      <div className="space-y-3 px-4 pb-4 pt-3">
        <select value={year} onChange={e => setYear(Number(e.target.value))} className={inputCls}>{[2025, 2026, 2027].map(y => <option key={y}>{y}</option>)}</select>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Pendapatan YTD" value={fmtShort(ytd.pendapatan)} color="#1E4FD8" />
          <Stat label="HPP YTD" value={fmtShort(ytd.hpp)} color="#f97316" />
          <Stat label="Pengeluaran YTD" value={fmtShort(ytd.pengeluaran)} color="#dc2626" />
          <Stat label="Laba Bersih YTD" value={fmtShort(ytd.laba)} color={ytd.laba >= 0 ? '#16a34a' : '#dc2626'} />
        </div>
        <div className="grid grid-cols-4 gap-2">
          {monthly.map((m, i) => <button key={m.label} onClick={() => setMonth(i)} className={`rounded-xl border px-2 py-2 text-[11px] font-bold ${month === i ? 'border-[#1E4FD8] bg-brand-50 text-brand' : 'border-wm-line bg-white text-ink-3'}`}>{m.label.slice(0, 3)}</button>)}
        </div>
        <section className="rounded-2xl border border-wm-line bg-white p-4">
          <p className="text-[13px] font-bold text-ink">Laba Rugi - {selected.label}</p>
          <Row label="Pendapatan" value={fmtRp(selected.pendapatan)} color="#1E4FD8" />
          <Row label="HPP Material" value={`- ${fmtRp(selected.hpp)}`} color="#f97316" />
          <Row label="Pengeluaran Operasional" value={`- ${fmtRp(selected.pengeluaran)}`} color="#dc2626" />
          <div className="mt-3 border-t border-wm-line pt-3"><Row label="Laba Bersih" value={fmtRp(selected.laba)} color={selected.laba >= 0 ? '#16a34a' : '#dc2626'} bold /></div>
        </section>
      </div>
    </>
  )
}

export default function MobileFinanceRouter() {
  const path = useLocation().pathname
  if (path.includes('pengeluaran')) return <MobilePengeluaran />
  if (path.includes('aliran-kas')) return <MobileAliranKas />
  if (path.includes('ringkasan-keuangan')) return <MobileRingkasanKeuangan />
  return <MobilePendapatan />
}

function Row({ label, value, color, bold }: { label: string; value: string; color?: string; bold?: boolean }) {
  return <div className="mt-3 flex justify-between gap-3 text-[13px]"><span className={bold ? 'font-bold text-ink' : 'text-ink-3'}>{label}</span><span className={bold ? 'font-extrabold' : 'font-bold'} style={{ color }}>{value}</span></div>
}

function FinanceCard({ title, subtitle, amount, meta, tone, tag, actions }: { title: string; subtitle: string; amount: number; meta?: string; tone: string; tag?: string; actions?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-wm-line bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><p className="truncate text-[13px] font-bold">{title}</p><p className="truncate text-[11px] text-ink-3">{subtitle}</p>{meta && <p className="mt-1 truncate text-[10px] text-ink-4">{meta}</p>}</div>
        <div className="text-right"><p className="text-[13px] font-extrabold" style={{ color: tone }}>{fmtRp(amount)}</p>{tag && <p className="mt-1 rounded-full bg-wm-bg px-2 py-0.5 text-[9px] font-bold text-ink-3">{tag}</p>}</div>
      </div>
      {actions && <div className="mt-3 flex gap-2">{actions}</div>}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl border border-wm-line bg-white p-8 text-center text-[13px] text-ink-3">{text}</div>
}

function ExpenseSheet({ form, setForm, categories, onSave, onClose, editing }: { form: ExpenseForm; setForm: (f: ExpenseForm | null) => void; categories: string[]; onSave: () => void; onClose: () => void; editing: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={onClose}>
      <div className="max-h-[90vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5" onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between"><p className="text-[16px] font-bold">{editing ? 'Edit Pengeluaran' : 'Tambah Pengeluaran'}</p><button onClick={onClose} className="text-[12px] font-bold text-ink-3">Tutup</button></div>
        <div className="space-y-3">
          <input type="date" value={form.tanggal} onChange={e => setForm({ ...form, tanggal: e.target.value })} className={inputCls} />
          <select value={form.kategori} onChange={e => setForm({ ...form, kategori: e.target.value })} className={inputCls}>{categories.map(c => <option key={c}>{c}</option>)}</select>
          <input value={form.keterangan} onChange={e => setForm({ ...form, keterangan: e.target.value })} placeholder="Keterangan" className={inputCls} />
          <input value={form.pemasok} onChange={e => setForm({ ...form, pemasok: e.target.value })} placeholder="Pemasok" className={inputCls} />
          <input value={form.refPO} onChange={e => setForm({ ...form, refPO: e.target.value })} placeholder="Ref PO" className={inputCls} />
          <input type="text" inputMode="numeric" value={fmtNumberInput(form.jumlah || 0)} onChange={e => setForm({ ...form, jumlah: Number(cleanNumber(e.target.value)) })} placeholder="0" className={inputCls} />
          {!editing && (
            <div className="rounded-2xl border border-wm-line bg-wm-bg p-3">
              <label className="flex items-center justify-between gap-3 text-[12px] font-bold text-ink">
                <span>Pengeluaran berulang bulanan</span>
                <input type="checkbox" checked={Boolean(form.recurring)} onChange={e => setForm({ ...form, recurring: e.target.checked })} />
              </label>
              {form.recurring && (
                <div className="mt-3">
                  <label className="mb-1 block text-[11px] font-semibold text-ink-3">Buat untuk berapa bulan?</label>
                  <input type="number" min={1} max={36} value={form.recurringMonths || 12} onChange={e => setForm({ ...form, recurringMonths: Number(e.target.value) || 1 })} className={inputCls} />
                  <p className="mt-2 text-[10px] leading-relaxed text-ink-3">Kalau ada karyawan resign atau nominal berubah, edit/hapus entri bulan berikutnya yang sudah dibuat.</p>
                </div>
              )}
            </div>
          )}
          <button onClick={onSave} className="w-full rounded-2xl bg-brand py-3 text-[14px] font-bold text-white">Simpan</button>
        </div>
      </div>
    </div>
  )
}
