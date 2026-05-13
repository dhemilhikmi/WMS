import { useCallback, useEffect, useMemo, useState } from 'react'
import { DEFAULT_KATEGORI } from '../../constants/kategori'
import { purchaseOrdersAPI, suppliersAPI } from '../../services/api'
import { MobileSubHeader } from '../MobileLayout'

type StatusPemasok = 'aktif' | 'nonaktif'

interface Supplier {
  id: string
  nama: string
  kontak: string
  phone: string
  email: string
  alamat: string
  kategori: string
  status: StatusPemasok
  totalPO: number
  lastOrder: string
}

const emptyForm = {
  nama: '',
  kontak: '',
  phone: '',
  email: '',
  alamat: '',
  kategori: '',
  status: 'aktif' as StatusPemasok,
}

const inputCls = 'w-full rounded-xl border border-[#cbd5e1] bg-white px-3 py-2.5 text-[13px] text-ink outline-none focus:border-[#1E4FD8]'
const labelCls = 'block text-[11px] font-semibold text-ink-3 mb-1'

function parseKategori(s?: string) {
  return (s || '').split(',').map(k => k.trim()).filter(Boolean)
}

function fmtDate(s?: string) {
  if (!s) return '-'
  return new Date(s).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function MobilePemasok() {
  const [items, setItems] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [detail, setDetail] = useState<Supplier | null>(null)
  const [deleteItem, setDeleteItem] = useState<Supplier | null>(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [customKategori, setCustomKategori] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [supplierRes, poRes] = await Promise.all([
        suppliersAPI.list(),
        purchaseOrdersAPI.list(),
      ])
      const pos: any[] = poRes.data.data || []
      const poCount: Record<string, number> = {}
      const poLast: Record<string, string> = {}
      pos.forEach(po => {
        const key = String(po.supplierName || '').trim().toLowerCase()
        if (!key) return
        poCount[key] = (poCount[key] || 0) + 1
        const date = po.orderDate || po.createdAt
        if (date && (!poLast[key] || new Date(date) > new Date(poLast[key]))) poLast[key] = date
      })
      setItems((supplierRes.data.data || []).map((s: any) => {
        const key = String(s.nama || '').trim().toLowerCase()
        return {
          id: s.id,
          nama: s.nama || '-',
          kontak: s.kontak || '-',
          phone: s.phone || '-',
          email: s.email || '-',
          alamat: s.alamat || '-',
          kategori: s.kategori || '',
          status: (s.status || 'aktif') as StatusPemasok,
          totalPO: poCount[key] || 0,
          lastOrder: poLast[key] ? fmtDate(poLast[key]) : fmtDate(s.updatedAt || s.createdAt),
        }
      }))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return items.filter(s => !q || `${s.nama} ${s.kontak} ${s.phone} ${s.kategori} ${s.alamat}`.toLowerCase().includes(q))
  }, [items, search])

  const stats = useMemo(() => ({
    total: items.length,
    aktif: items.filter(s => s.status === 'aktif').length,
    po: items.reduce((sum, s) => sum + s.totalPO, 0),
  }), [items])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setCustomKategori(false)
    setErr('')
    setShowForm(true)
  }

  const openEdit = (supplier: Supplier) => {
    setEditing(supplier)
    setForm({
      nama: supplier.nama === '-' ? '' : supplier.nama,
      kontak: supplier.kontak === '-' ? '' : supplier.kontak,
      phone: supplier.phone === '-' ? '' : supplier.phone,
      email: supplier.email === '-' ? '' : supplier.email,
      alamat: supplier.alamat === '-' ? '' : supplier.alamat,
      kategori: supplier.kategori,
      status: supplier.status,
    })
    setCustomKategori(Boolean(supplier.kategori && !DEFAULT_KATEGORI.includes(supplier.kategori)))
    setErr('')
    setShowForm(true)
  }

  const save = async () => {
    if (!form.nama.trim()) return setErr('Nama pemasok wajib diisi')
    if (!form.kontak.trim()) return setErr('Nama kontak PIC wajib diisi')
    setSaving(true)
    setErr('')
    try {
      if (editing) await suppliersAPI.update(editing.id, form)
      else await suppliersAPI.create(form)
      setShowForm(false)
      setEditing(null)
      await fetchData()
    } catch (e: any) {
      setErr(e.response?.data?.message || e.message || 'Gagal menyimpan pemasok')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!deleteItem) return
    setSaving(true)
    try {
      await suppliersAPI.delete(deleteItem.id)
      setDeleteItem(null)
      setDetail(null)
      await fetchData()
    } catch (e: any) {
      alert(e.response?.data?.message || e.message || 'Gagal menghapus pemasok')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <MobileSubHeader title="Pemasok" subtitle={loading ? 'Memuat...' : `${filtered.length} data`} />
      <div className="px-4 pt-3 pb-4 space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Total" value={stats.total} color="#111" />
          <Stat label="Aktif" value={stats.aktif} color="#1E4FD8" />
          <Stat label="Total PO" value={stats.po} color="#16a34a" />
        </div>

        <div className="flex gap-2">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cari nama, kontak, kategori..."
            className="min-w-0 flex-1 bg-white border border-wm-line rounded-2xl px-3 py-2.5 text-[13px] outline-none focus:border-[#1E4FD8]"
          />
          <button onClick={openCreate} className="shrink-0 rounded-2xl bg-brand px-3 text-[12px] font-bold text-white">
            Tambah
          </button>
        </div>

        {loading && <p className="text-center text-[12px] text-ink-4 py-6">Memuat...</p>}
        {!loading && filtered.length === 0 && (
          <div className="bg-white rounded-2xl border border-wm-line p-8 text-center text-[13px] text-[#666]">
            Tidak ada pemasok
          </div>
        )}

        <div className="space-y-2.5">
          {filtered.map(s => (
            <button key={s.id} onClick={() => setDetail(s)} className="w-full text-left rounded-2xl border border-wm-line bg-white p-3 active:bg-wm-bg">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-bold truncate">{s.nama}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${s.status === 'aktif' ? 'bg-[#dcfce7] text-[#16a34a]' : 'bg-wm-bg text-ink-3'}`}>
                      {s.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-ink-3 truncate">{s.kontak} - {s.phone}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {parseKategori(s.kategori).slice(0, 3).map(k => (
                      <span key={k} className="rounded-full bg-wm-bg px-2 py-0.5 text-[9px] font-semibold text-ink-3">{k}</span>
                    ))}
                    {parseKategori(s.kategori).length === 0 && <span className="text-[10px] text-ink-4">Tanpa kategori</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[17px] font-extrabold text-brand">{s.totalPO}</p>
                  <p className="text-[9px] text-ink-4">PO</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {detail && (
        <Sheet title={detail.nama} onClose={() => setDetail(null)}>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1">
              {parseKategori(detail.kategori).map(k => (
                <span key={k} className="rounded-full bg-wm-bg px-2 py-1 text-[10px] font-semibold text-ink-3">{k}</span>
              ))}
            </div>
            <Info label="Kontak" value={detail.kontak} />
            <Info label="No. HP" value={detail.phone} />
            <Info label="Email" value={detail.email} />
            <Info label="Alamat" value={detail.alamat} />
            <Info label="Total PO" value={`${detail.totalPO} pesanan`} />
            <Info label="Terakhir Order" value={detail.lastOrder} />
            <Info label="Status" value={detail.status} />
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button onClick={() => { openEdit(detail); setDetail(null) }} className="rounded-2xl bg-brand-50 py-3 text-[13px] font-bold text-brand">
                Edit
              </button>
              <button onClick={() => setDeleteItem(detail)} className="rounded-2xl bg-[#fef2f2] py-3 text-[13px] font-bold text-[#dc2626]">
                Hapus
              </button>
            </div>
          </div>
        </Sheet>
      )}

      {showForm && (
        <Sheet title={editing ? 'Edit Pemasok' : 'Tambah Pemasok'} onClose={() => setShowForm(false)}>
          <div className="space-y-3 pb-2">
            <Field label="Nama Perusahaan / Toko" value={form.nama} onChange={v => setForm({ ...form, nama: v })} />
            <Field label="Nama Kontak PIC" value={form.kontak} onChange={v => setForm({ ...form, kontak: v })} />
            <Field label="Nomor HP" value={form.phone} onChange={v => setForm({ ...form, phone: v })} />
            <Field label="Email" value={form.email} onChange={v => setForm({ ...form, email: v })} />
            <div>
              <label className={labelCls}>Kategori</label>
              <select value={customKategori ? '__custom' : form.kategori} onChange={e => {
                if (e.target.value === '__custom') {
                  setCustomKategori(true)
                  setForm({ ...form, kategori: '' })
                } else {
                  setCustomKategori(false)
                  setForm({ ...form, kategori: e.target.value })
                }
              }} className={inputCls}>
                <option value="">Pilih kategori...</option>
                {DEFAULT_KATEGORI.map(k => <option key={k}>{k}</option>)}
                <option value="__custom">+ Tambah kategori manual</option>
              </select>
              {customKategori && (
                <input
                  autoFocus
                  value={form.kategori}
                  onChange={e => setForm({ ...form, kategori: e.target.value })}
                  placeholder="Nama kategori baru"
                  className={inputCls + ' mt-2'}
                />
              )}
            </div>
            <Field label="Alamat" value={form.alamat} onChange={v => setForm({ ...form, alamat: v })} textarea />
            <div>
              <label className={labelCls}>Status</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as StatusPemasok })} className={inputCls}>
                <option value="aktif">Aktif</option>
                <option value="nonaktif">Nonaktif</option>
              </select>
            </div>
            {err && <p className="rounded-xl border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-[12px] text-[#dc2626]">{err}</p>}
            <button onClick={save} disabled={saving} className="w-full rounded-2xl bg-brand py-3 text-[14px] font-bold text-white disabled:opacity-60">
              {saving ? 'Menyimpan...' : editing ? 'Simpan Perubahan' : 'Tambah Pemasok'}
            </button>
          </div>
        </Sheet>
      )}

      {deleteItem && (
        <Sheet title="Hapus Pemasok?" onClose={() => setDeleteItem(null)}>
          <p className="text-[12px] text-ink-3">Data pemasok {deleteItem.nama} akan dihapus permanen.</p>
          <button onClick={remove} disabled={saving} className="mt-4 w-full rounded-2xl bg-[#dc2626] py-3 text-[14px] font-bold text-white disabled:opacity-60">
            {saving ? 'Menghapus...' : 'Hapus'}
          </button>
        </Sheet>
      )}
    </>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-2xl border border-wm-line bg-white p-3">
      <p className="text-[10px] text-ink-3">{label}</p>
      <p className="mt-1 text-[22px] font-extrabold" style={{ color }}>{value}</p>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-[#f1f5f9] pb-2 last:border-0">
      <p className="shrink-0 text-[11px] text-ink-4">{label}</p>
      <p className="text-right text-[12px] font-semibold text-ink">{value || '-'}</p>
    </div>
  )
}

function Field({ label, value, onChange, textarea }: { label: string; value: string; onChange: (v: string) => void; textarea?: boolean }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {textarea ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} rows={3} className={inputCls} />
      ) : (
        <input value={value} onChange={e => onChange(e.target.value)} className={inputCls} />
      )}
    </div>
  )
}

function Sheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={onClose}>
      <div className="max-h-[90vh] w-full overflow-y-auto rounded-t-3xl bg-white p-4" onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="min-w-0 truncate text-[17px] font-extrabold text-ink">{title}</h2>
          <button onClick={onClose} className="h-9 w-9 rounded-full bg-wm-bg text-[18px] text-ink-3">x</button>
        </div>
        {children}
      </div>
    </div>
  )
}
