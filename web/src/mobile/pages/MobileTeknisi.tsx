import { useCallback, useEffect, useState } from 'react'
import { teknisiAPI } from '../../services/api'
import { MobileSubHeader } from '../MobileLayout'

interface Teknisi {
  id: string
  name: string
  phone: string
  spesialis: string[]
  status: 'aktif' | 'cuti' | 'nonaktif'
}

const DEFAULT_SPESIALIS = ['Detailing', 'PPF', 'Coating', 'Poles', 'Interior', 'Ceramic', 'Cuci Mobil', 'Engine Bay']

const statusLabel: Record<string, string> = { aktif: 'Aktif', cuti: 'Cuti', nonaktif: 'Nonaktif' }
const statusColor: Record<string, string> = { aktif: '#16a34a', cuti: '#f59e0b', nonaktif: '#94a3b8' }
const statusBg: Record<string, string>    = { aktif: '#dcfce7', cuti: '#fef3c7', nonaktif: '#f1f5f9' }

const inputCls = 'w-full bg-wm-bg border border-wm-line rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-[#1E4FD8] focus:bg-white'
const emptyForm = { name: '', phone: '', spesialis: [] as string[], status: 'aktif' as Teknisi['status'] }

export default function MobileTeknisi() {
  const [list, setList] = useState<Teknisi[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Teknisi | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [spesialisOptions, setSpesialisOptions] = useState<string[]>(DEFAULT_SPESIALIS)
  const [newSpesialis, setNewSpesialis] = useState('')
  const [deleteItem, setDeleteItem] = useState<Teknisi | null>(null)
  const [err, setErr] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await teknisiAPI.list()
      const data: Teknisi[] = res.data.data || []
      setList(data)
      const all = new Set(DEFAULT_SPESIALIS)
      data.forEach(t => t.spesialis.forEach(s => all.add(s)))
      setSpesialisOptions(Array.from(all))
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const openCreate = () => { setEditing(null); setForm(emptyForm); setErr(''); setShowForm(true) }
  const openEdit = (t: Teknisi) => { setEditing(t); setForm({ name: t.name, phone: t.phone, spesialis: t.spesialis, status: t.status }); setErr(''); setShowForm(true) }

  const toggleSpesialis = (s: string) => {
    setForm(f => ({ ...f, spesialis: f.spesialis.includes(s) ? f.spesialis.filter(x => x !== s) : [...f.spesialis, s] }))
  }

  const addSpesialis = () => {
    const v = newSpesialis.trim()
    if (!v) return
    if (!spesialisOptions.includes(v)) setSpesialisOptions(p => [...p, v])
    setForm(f => ({ ...f, spesialis: f.spesialis.includes(v) ? f.spesialis : [...f.spesialis, v] }))
    setNewSpesialis('')
  }

  const save = async () => {
    if (!form.name.trim()) return setErr('Nama teknisi wajib diisi')
    setSaving(true); setErr('')
    try {
      if (editing) await teknisiAPI.update(editing.id, { name: form.name.trim(), phone: form.phone, spesialis: form.spesialis, status: form.status })
      else await teknisiAPI.create({ name: form.name.trim(), phone: form.phone, spesialis: form.spesialis, status: form.status })
      setShowForm(false)
      fetchData()
    } catch (e: any) {
      setErr(e.response?.data?.message || 'Gagal menyimpan')
    } finally { setSaving(false) }
  }

  const confirmDelete = async () => {
    if (!deleteItem) return
    setSaving(true)
    try {
      await teknisiAPI.delete(deleteItem.id)
      setDeleteItem(null)
      fetchData()
    } catch (e: any) {
      alert(e.response?.data?.message || 'Gagal menghapus')
    } finally { setSaving(false) }
  }

  return (
    <>
      <MobileSubHeader title="Teknisi" subtitle={loading ? 'Memuat...' : `${list.length} teknisi`} />
      <div className="px-4 pt-4 pb-8 space-y-3">

        {/* Onboarding banner */}
        {!loading && list.length === 0 && (
          <div className="rounded-2xl border border-[#D9E3FC] bg-brand-50 p-4 space-y-2">
            <div className="flex items-start gap-3">
              <span className="text-2xl flex-shrink-0">👨‍🔧</span>
              <div>
                <p className="text-[14px] font-bold text-[#1e40af]">Belum ada teknisi terdaftar</p>
                <p className="text-[12px] text-[#3b82f6] leading-relaxed mt-0.5">
                  Tambahkan teknisi agar bisa di-assign ke setiap pekerjaan. Performa teknisi bisa dipantau di laporan.
                </p>
              </div>
            </div>
            <ul className="text-[11px] text-brand space-y-0.5 pl-1">
              <li>• Isi nama dan nomor HP (opsional)</li>
              <li>• Pilih spesialisasi — PPF, Coating, Detailing, dll.</li>
              <li>• Status bisa diubah sewaktu-waktu</li>
            </ul>
            <button onClick={openCreate} className="w-full py-2.5 rounded-xl bg-brand text-white text-[13px] font-bold">
              + Tambah Teknisi Pertama
            </button>
          </div>
        )}

        {/* Add button */}
        {list.length > 0 && (
          <button onClick={openCreate} className="w-full py-3 rounded-2xl border-2 border-dashed border-[#D9E3FC] text-brand text-[13px] font-semibold">
            + Tambah Teknisi
          </button>
        )}

        {/* List */}
        {list.map(t => (
          <div key={t.id} className="bg-white rounded-2xl border border-wm-line p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[14px] font-bold text-ink truncate">{t.name}</p>
                {t.phone && <p className="text-[11px] text-ink-4 mt-0.5">{t.phone}</p>}
              </div>
              <span className="flex-shrink-0 px-2 py-0.5 rounded-full text-[11px] font-bold" style={{ background: statusBg[t.status], color: statusColor[t.status] }}>
                {statusLabel[t.status]}
              </span>
            </div>
            {t.spesialis.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {t.spesialis.map(s => (
                  <span key={s} className="px-2 py-0.5 rounded-full bg-wm-bg text-ink-3 text-[10px] font-semibold">{s}</span>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button onClick={() => openEdit(t)} className="py-2 rounded-xl bg-brand-50 text-brand text-[12px] font-semibold">Edit</button>
              <button onClick={() => setDeleteItem(t)} className="py-2 rounded-xl bg-[#fef2f2] text-[#dc2626] text-[12px] font-semibold">Hapus</button>
            </div>
          </div>
        ))}

        {loading && <p className="text-center text-[12px] text-ink-4 py-6">Memuat...</p>}
      </div>

      {/* Form sheet */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end" onClick={() => setShowForm(false)}>
          <div className="bg-white w-full rounded-t-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white px-5 pt-4 pb-3 border-b border-wm-line">
              <div className="w-10 h-1 bg-[#e2e8f0] rounded-full mx-auto mb-3" />
              <div className="flex items-center justify-between">
                <p className="text-[16px] font-bold">{editing ? 'Edit Teknisi' : 'Teknisi Baru'}</p>
                <button onClick={() => setShowForm(false)} className="text-[12px] font-semibold text-[#666]">Tutup</button>
              </div>
            </div>
            <div className="px-5 py-4 space-y-4 pb-8">
              <div>
                <label className="block text-[11px] font-semibold text-[#666] mb-1">Nama <span className="text-[#dc2626]">*</span></label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Nama teknisi" className={inputCls} />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#666] mb-1">Nomor HP</label>
                <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="08xx..." className={inputCls} />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#666] mb-1">Status</label>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as Teknisi['status'] })} className={inputCls}>
                  <option value="aktif">Aktif</option>
                  <option value="cuti">Cuti</option>
                  <option value="nonaktif">Nonaktif</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#666] mb-2">Spesialisasi</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {spesialisOptions.map(s => (
                    <button key={s} type="button" onClick={() => toggleSpesialis(s)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition ${form.spesialis.includes(s) ? 'bg-brand text-white border-[#1E4FD8]' : 'bg-white text-ink-3 border-wm-line'}`}>
                      {s}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={newSpesialis}
                    onChange={e => setNewSpesialis(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSpesialis() } }}
                    placeholder="+ Spesialisasi lain..."
                    className={inputCls + ' flex-1'}
                  />
                  <button onClick={addSpesialis} className="px-3 rounded-xl bg-wm-bg text-brand text-[12px] font-bold">+</button>
                </div>
              </div>
              {err && <p className="text-[12px] text-[#dc2626]">{err}</p>}
              <button onClick={save} disabled={saving} className="w-full py-3 rounded-xl bg-brand text-white text-[14px] font-semibold disabled:opacity-50">
                {saving ? 'Menyimpan...' : editing ? 'Simpan Perubahan' : 'Tambah Teknisi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteItem && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end" onClick={() => setDeleteItem(null)}>
          <div className="bg-white w-full rounded-t-3xl p-5 pb-8" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-[#e2e8f0] rounded-full mx-auto mb-4" />
            <p className="text-[16px] font-bold text-center mb-1">Hapus Teknisi?</p>
            <p className="text-[12px] text-[#666] text-center mb-5">{deleteItem.name} akan dihapus permanen.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteItem(null)} className="flex-1 bg-wm-bg text-ink-3 text-[14px] font-semibold py-3 rounded-xl">Batal</button>
              <button onClick={confirmDelete} disabled={saving} className="flex-1 bg-[#dc2626] text-white text-[14px] font-semibold py-3 rounded-xl disabled:opacity-50">
                {saving ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
