import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { suppliersAPI, purchaseOrdersAPI } from '../services/api'
import { DEFAULT_KATEGORI } from '../constants/kategori'

interface Pemasok {
  id: string
  nama: string
  kontak: string
  phone: string
  email: string
  alamat: string
  kategori: string
  status: 'aktif' | 'nonaktif'
  totalPO: number
  lastOrder: string
}

const inputCls = 'w-full rounded border border-[#cbd5e1] bg-white px-3 py-2 text-sm text-[#111] outline-none focus:border-[#1E4FD8] focus:ring-2 focus:ring-[#dbeafe] transition'
const labelCls = 'block text-[11px] font-semibold text-[#555] mb-1'

const emptyForm = { nama: '', kontak: '', phone: '', email: '', alamat: '', kategori: '', status: 'aktif' as const }

const parseKategori = (s: string) => s ? s.split(',').map(k => k.trim()).filter(Boolean) : []
const formatKategori = (arr: string[]) => arr.join(', ')

export default function PemasokPage() {
  const { tenant } = useAuth()
  const [pemasokList, setPemasokList] = useState<Pemasok[]>([])
  const [_loading, setLoading] = useState(true)
  const [_saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [kategoriOptions, setKategoriOptions] = useState(DEFAULT_KATEGORI)
  const [addingKategori, setAddingKategori] = useState(false)
  const [newKategori, setNewKategori] = useState('')
  const [showKategoriDropdown, setShowKategoriDropdown] = useState(false)
  const kategoriDropdownRef = useRef<HTMLDivElement>(null)

  const confirmAddKategori = () => {
    const v = newKategori.trim()
    if (v && !kategoriOptions.includes(v)) {
      setKategoriOptions(prev => [...prev, v])
      setForm(f => ({ ...f, kategori: v }))
    }
    setAddingKategori(false)
    setNewKategori('')
  }

  const fetchData = useCallback(async () => {
    if (!tenant?.id) return
    try {
      setLoading(true)
      const [suppRes, poRes] = await Promise.all([
        suppliersAPI.list(),
        purchaseOrdersAPI.list(),
      ])
      const raw: any[] = suppRes.data.data || []
      const pos: any[] = poRes.data.data || []

      // Hitung jumlah PO per nama pemasok
      const poCount: Record<string, number> = {}
      const poLastDate: Record<string, string> = {}
      for (const po of pos) {
        const name = (po.supplierName || '').toLowerCase()
        if (!name) continue
        poCount[name] = (poCount[name] || 0) + 1
        const d = new Date(po.orderDate).toLocaleDateString('id-ID')
        if (!poLastDate[name] || new Date(po.orderDate) > new Date(poLastDate[name])) {
          poLastDate[name] = d
        }
      }

      setPemasokList(raw.map(r => {
        const key = (r.nama || '').toLowerCase()
        return {
          id: r.id,
          nama: r.nama,
          kontak: r.kontak || '—',
          phone: r.phone || '—',
          email: r.email || '—',
          alamat: r.alamat || '—',
          kategori: r.kategori || '',
          status: r.status as 'aktif' | 'nonaktif',
          totalPO: poCount[key] || 0,
          lastOrder: poLastDate[key] || new Date(r.updatedAt).toLocaleDateString('id-ID'),
        }
      }))
    } catch (err) {
      console.error('Failed to fetch suppliers:', err)
    } finally {
      setLoading(false)
    }
  }, [tenant?.id])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    if (!showKategoriDropdown) return
    const close = (e: MouseEvent) => {
      if (kategoriDropdownRef.current && !kategoriDropdownRef.current.contains(e.target as Node))
        setShowKategoriDropdown(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [showKategoriDropdown])

  const filtered = pemasokList.filter((p) => {
    const q = search.toLowerCase()
    return p.nama.toLowerCase().includes(q) || p.kontak.toLowerCase().includes(q) || p.kategori.toLowerCase().includes(q)
  })

  const openAdd = () => {
    setEditingId(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  const openEdit = (p: Pemasok) => {
    setEditingId(p.id)
    setForm({ nama: p.nama, kontak: p.kontak, phone: p.phone, email: p.email, alamat: p.alamat, kategori: p.kategori, status: p.status as 'aktif' })
    setShowForm(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editingId) {
        await suppliersAPI.update(editingId, form)
      } else {
        await suppliersAPI.create(form)
      }
      await fetchData()
      setShowForm(false)
      setEditingId(null)
      setForm(emptyForm)
    } catch (err) {
      console.error('Save failed:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await suppliersAPI.delete(id)
      await fetchData()
    } catch (err) {
      console.error('Delete failed:', err)
    }
    setDeleteConfirmId(null)
  }

  const detail = pemasokList.find((p) => p.id === detailId)
  const aktif = pemasokList.filter((p) => p.status === 'aktif').length

  return (
    <div className="p-6 space-y-5">
      {/* Delete confirm */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg border border-[#e2e8f0] bg-white p-6 shadow-xl">
            <p className="text-base font-bold text-[#111]">Hapus Pemasok?</p>
            <p className="mt-2 text-sm text-[#666]">Data pemasok akan dihapus permanen.</p>
            <div className="mt-5 flex gap-2">
              <button onClick={() => handleDelete(deleteConfirmId)} className="flex-1 rounded bg-[#dc2626] py-2 text-sm font-semibold text-white hover:bg-[#b91c1c] transition">Hapus</button>
              <button onClick={() => setDeleteConfirmId(null)} className="flex-1 rounded border border-[#e2e8f0] py-2 text-sm text-[#555] hover:bg-[#f8fafc] transition">Batal</button>
            </div>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg border border-[#e2e8f0] bg-white p-6 shadow-xl">
            <div className="flex justify-between items-start mb-4">
              <p className="text-base font-bold text-[#111]">{detail.nama}</p>
              <button onClick={() => setDetailId(null)} className="text-[#aaa] hover:text-[#555] text-xl leading-none">×</button>
            </div>
            <div className="space-y-2.5">
              {/* Kategori — multi-badge */}
              <div className="flex justify-between gap-4 border-b border-[#f1f5f9] pb-2">
                <p className="text-[11px] text-[#999] flex-shrink-0">Kategori</p>
                <div className="flex flex-wrap gap-1 justify-end">
                  {parseKategori(detail.kategori).length > 0
                    ? parseKategori(detail.kategori).map(k => (
                        <span key={k} className="inline-block px-2 py-0.5 rounded-full bg-[#f1f5f9] text-[10px] text-[#555]">{k}</span>
                      ))
                    : <span className="text-[12px] text-[#aaa]">—</span>
                  }
                </div>
              </div>
              {[
                ['Kontak', detail.kontak],
                ['No. HP', detail.phone],
                ['Email', detail.email],
                ['Alamat', detail.alamat],
                ['Total PO', `${detail.totalPO} pesanan`],
                ['Terakhir Order', detail.lastOrder],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-[#f1f5f9] pb-2 last:border-0">
                  <p className="text-[11px] text-[#999] flex-shrink-0">{k}</p>
                  <p className="text-[12px] font-semibold text-[#111] text-right">{v}</p>
                </div>
              ))}
              <div className="flex justify-between gap-4">
                <p className="text-[11px] text-[#999]">Status</p>
                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${detail.status === 'aktif' ? 'bg-[#dcfce7] text-[#16a34a]' : 'bg-[#f1f5f9] text-[#888]'}`}>
                  {detail.status}
                </span>
              </div>
            </div>
            <button onClick={() => { setDetailId(null); openEdit(detail) }}
              className="mt-5 w-full rounded border border-[#1E4FD8] py-2 text-sm font-semibold text-[#1E4FD8] hover:bg-[#EEF3FE] transition">
              Edit Pemasok
            </button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-[#e2e8f0] bg-white p-5">
          <p className="text-xs text-[#999]">Total Pemasok</p>
          <p className="mt-2 text-4xl font-bold text-[#111]">{pemasokList.length}</p>
        </div>
        <div className="rounded-lg border border-[#e2e8f0] bg-white p-5">
          <p className="text-xs text-[#999]">Aktif</p>
          <p className="mt-2 text-4xl font-bold text-[#1E4FD8]">{aktif}</p>
        </div>
        <div className="rounded-lg border border-[#e2e8f0] bg-white p-5">
          <p className="text-xs text-[#999]">Total PO Bulan Ini</p>
          <p className="mt-2 text-4xl font-bold text-[#111]">{pemasokList.reduce((s, p) => s + p.totalPO, 0)}</p>
        </div>
      </div>

      {/* Form tambah / edit */}
      {showForm && (
        <div className="rounded-lg border border-[#D9E3FC] bg-white p-5">
          <p className="text-sm font-bold text-[#111] mb-4">{editingId ? 'Edit Pemasok' : 'Tambah Pemasok Baru'}</p>
          <form onSubmit={handleSave} className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className={labelCls}>Nama Perusahaan / Toko</label>
                <input required value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} placeholder="PT. Nama Pemasok" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Nama Kontak PIC</label>
                <input required value={form.kontak} onChange={(e) => setForm({ ...form, kontak: e.target.value })} placeholder="Nama person in charge" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Nomor HP</label>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="0812-xxxx-xxxx" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Email</label>
                <input type="text" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@pemasok.com (opsional)" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Kategori <span className="text-[#aaa] font-normal">(bisa pilih lebih dari satu)</span></label>
                {addingKategori ? (
                  <div className="flex gap-1.5">
                    <input autoFocus value={newKategori} onChange={e => setNewKategori(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); confirmAddKategori() } if (e.key === 'Escape') setAddingKategori(false) }}
                      placeholder="Nama kategori baru" className={inputCls + ' flex-1'} />
                    <button type="button" onClick={confirmAddKategori}
                      className="px-3 py-2 rounded bg-[#1E4FD8] text-white text-sm font-bold hover:bg-[#1A45BF]">✓</button>
                    <button type="button" onClick={() => setAddingKategori(false)}
                      className="px-3 py-2 rounded border border-[#e2e8f0] text-sm text-[#555] hover:bg-[#f8fafc]">×</button>
                  </div>
                ) : (
                  <div className="flex gap-1.5">
                    <div className="relative flex-1" ref={kategoriDropdownRef}>
                      <button type="button"
                        onClick={() => setShowKategoriDropdown(d => !d)}
                        className={inputCls + ' text-left flex items-center justify-between'}>
                        <span className={parseKategori(form.kategori).length === 0 ? 'text-[#aaa]' : 'text-[#111]'}>
                          {parseKategori(form.kategori).length === 0
                            ? 'Pilih kategori...'
                            : parseKategori(form.kategori).join(', ')}
                        </span>
                        <span className="text-[#aaa] text-xs ml-2">▾</span>
                      </button>
                      {showKategoriDropdown && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#e2e8f0] rounded shadow-lg z-50 max-h-52 overflow-y-auto">
                          {kategoriOptions.map(k => {
                            const selected = parseKategori(form.kategori).includes(k)
                            return (
                              <label key={k}
                                className={`flex items-center gap-2.5 px-3 py-2 hover:bg-[#f8fafc] cursor-pointer border-b border-[#f1f5f9] last:border-b-0 ${selected ? 'bg-[#EEF3FE]' : ''}`}>
                                <input type="checkbox" checked={selected}
                                  onChange={() => {
                                    const cur = parseKategori(form.kategori)
                                    const next = selected ? cur.filter(x => x !== k) : [...cur, k]
                                    setForm(f => ({ ...f, kategori: formatKategori(next) }))
                                  }}
                                  className="accent-[#1E4FD8]" />
                                <span className="text-sm text-[#111]">{k}</span>
                              </label>
                            )
                          })}
                        </div>
                      )}
                    </div>
                    <button type="button" onClick={() => { setAddingKategori(true); setShowKategoriDropdown(false) }}
                      className="px-3 py-2 rounded border border-[#1E4FD8] text-[#1E4FD8] text-sm font-bold hover:bg-[#EEF3FE] transition flex-shrink-0">+</button>
                  </div>
                )}
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>Alamat</label>
                <input value={form.alamat} onChange={(e) => setForm({ ...form, alamat: e.target.value })} placeholder="Alamat lengkap pemasok" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as 'aktif' })} className={inputCls}>
                  <option value="aktif">Aktif</option>
                  <option value="nonaktif">Nonaktif</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="submit" className="px-5 py-2 rounded bg-[#1E4FD8] text-white text-sm font-semibold hover:bg-[#1A45BF] transition">
                {editingId ? 'Simpan Perubahan' : 'Tambah Pemasok'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2 rounded border border-[#e2e8f0] text-sm text-[#555] hover:bg-[#f8fafc] transition">
                Batal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border border-[#e2e8f0] bg-white overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-[#f1f5f9]">
          <p className="text-sm font-bold text-[#111]">Daftar Pemasok</p>
          <div className="flex items-center gap-2 rounded border border-[#e2e8f0] px-3 py-1.5 flex-1 max-w-[240px]">
            <span className="text-xs">🔍</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama / kategori..." className="flex-1 text-[12px] outline-none text-[#555]" />
            {search && <button onClick={() => setSearch('')} className="text-[#aaa] hover:text-[#555]">×</button>}
          </div>
          <button onClick={openAdd}
            className="ml-auto px-4 py-2 rounded bg-[#1E4FD8] text-white text-sm font-semibold hover:bg-[#1A45BF] transition">
            + Tambah Pemasok
          </button>
        </div>

        <div className="grid grid-cols-[1.6fr_1.2fr_1fr_1fr_0.8fr_0.8fr_1fr] px-5 py-2.5 bg-[#f8fafc] border-b border-[#f1f5f9]">
          {['Pemasok', 'Kontak', 'No. HP', 'Kategori', 'Total PO', 'Status', 'Aksi'].map((h) => (
            <p key={h} className="text-[11px] font-bold text-[#888]">{h}</p>
          ))}
        </div>

        {filtered.length === 0 ? (
          <p className="px-5 py-10 text-center text-[12px] text-[#aaa]">Tidak ada pemasok</p>
        ) : (
          filtered.map((p) => (
            <div key={p.id} className="grid grid-cols-[1.6fr_1.2fr_1fr_1fr_0.8fr_0.8fr_1fr] items-center px-5 py-3 border-b border-[#f1f5f9] last:border-b-0 hover:bg-[#fafbfc]">
              <div>
                <p className="text-[13px] font-semibold text-[#111]">{p.nama}</p>
                <p className="text-[11px] text-[#aaa]">{p.lastOrder !== '-' ? `Terakhir order: ${p.lastOrder}` : 'Belum ada order'}</p>
              </div>
              <div>
                <p className="text-[12px] text-[#555]">{p.kontak}</p>
                <p className="text-[11px] text-[#aaa]">{p.email}</p>
              </div>
              <p className="text-[12px] text-[#555]">{p.phone}</p>
              <div className="flex flex-wrap gap-1">
                {parseKategori(p.kategori).length > 0
                  ? parseKategori(p.kategori).map(k => (
                      <span key={k} className="inline-block px-2 py-0.5 rounded-full bg-[#f1f5f9] text-[10px] text-[#555]">{k}</span>
                    ))
                  : <span className="text-[11px] text-[#aaa]">—</span>
                }
              </div>
              <p className="text-[13px] font-bold text-[#111]">{p.totalPO}</p>
              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold w-fit ${p.status === 'aktif' ? 'bg-[#dcfce7] text-[#16a34a]' : 'bg-[#f1f5f9] text-[#888]'}`}>
                {p.status}
              </span>
              <div className="flex gap-1.5">
                <button onClick={() => setDetailId(p.id)}
                  className="px-2.5 py-1 rounded border border-[#e2e8f0] text-[11px] text-[#555] hover:bg-[#f8fafc] transition">Detail</button>
                <button onClick={() => openEdit(p)}
                  className="px-2.5 py-1 rounded border border-[#e2e8f0] text-[11px] text-[#555] hover:bg-[#f8fafc] transition">Edit</button>
                <button onClick={() => setDeleteConfirmId(p.id)}
                  className="px-2.5 py-1 rounded border border-[#fecaca] bg-[#fee2e2] text-[11px] text-[#dc2626] hover:bg-[#fecaca] transition">Hapus</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
