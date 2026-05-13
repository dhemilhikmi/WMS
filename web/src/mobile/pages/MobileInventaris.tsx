import { useCallback, useEffect, useMemo, useState } from 'react'
import { inventoryAPI } from '../../services/api'

const categories = ['Material', 'Paint Protection Film', 'Suku Cadang', 'Tools', 'Consumable', 'Lainnya']
const units = ['Pcs', 'Roll', 'Meter', 'Liter', 'Kg', 'Gram', 'Botol', 'Kaleng', 'Dus', 'Set', 'Unit']
type Tab = 'stok' | 'masuk' | 'keluar'

const emptyForm = {
  kode: '',
  nama: '',
  kategori: 'Material',
  satuan: 'Pcs',
  satuanPakai: '',
  isiPerUnit: '',
  stok: '0',
  stokMin: '0',
  hargaSatuan: '0',
  pemasok: '',
  notes: '',
}

function smallUnitLabel(item: any, stok: number): string | null {
  const satuan = String(item.satuan || '').toLowerCase()
  // Pakai isiPerUnit/satuanPakai jika tersedia (sistem baru)
  if (item.isiPerUnit && Number(item.isiPerUnit) > 0 && item.satuanPakai) {
    return `${(stok * Number(item.isiPerUnit)).toLocaleString('id-ID')} ${item.satuanPakai}`
  }
  // Fallback: konversi implisit lama
  if (satuan === 'liter') return `${(stok * 1000).toLocaleString('id-ID')} ml`
  if (satuan === 'kg') return `${(stok * 1000).toLocaleString('id-ID')} gr`
  if (satuan === 'roll' && item.notes && Number(item.notes) > 0) {
    return `${(stok * Number(item.notes)).toLocaleString('id-ID')} m`
  }
  return null
}

function needsLength(item: { kategori: string; satuan: string }) {
  return String(item.satuan || '').toLowerCase() === 'roll' ||
    String(item.kategori || '').toLowerCase().includes('paint protection film')
}

export default function MobileInventaris() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'ALL' | 'LOW'>('ALL')
  const [activeTab, setActiveTab] = useState<Tab>('stok')
  const [filterKategori, setFilterKategori] = useState('Semua')
  const [viewMode, setViewMode] = useState<'simple' | 'detail'>('simple')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [mutasi, setMutasi] = useState<{ item: any; type: 'masuk' | 'keluar' } | null>(null)
  const [jumlah, setJumlah] = useState('')
  const [mutasiInputMode, setMutasiInputMode] = useState<'roll' | 'meter'>('roll')
  const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null)
  const [editingItem, setEditingItem] = useState<any | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [formErr, setFormErr] = useState('')
  const [deleteItem, setDeleteItem] = useState<any | null>(null)
  const [editStok, setEditStok] = useState<any | null>(null)
  const [editStokVal, setEditStokVal] = useState('')
  const [editStokSatuan, setEditStokSatuan] = useState('')
  const [editStokIsiPerUnit, setEditStokIsiPerUnit] = useState('')
  const [editStokSatuanPakai, setEditStokSatuanPakai] = useState('')
  const [saving, setSaving] = useState(false)

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const r = await inventoryAPI.list()
      setItems(r.data.data || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const filtered = useMemo(() => items.filter(it => {
    if (filter === 'LOW' && Number(it.stok) > Number(it.stokMin)) return false
    if (filterKategori !== 'Semua' && it.kategori !== filterKategori) return false
    if (!search) return true
    const q = search.toLowerCase()
    return (it.nama || '').toLowerCase().includes(q) ||
      (it.kode || '').toLowerCase().includes(q) ||
      (it.kategori || '').toLowerCase().includes(q) ||
      (it.pemasok || '').toLowerCase().includes(q)
  }), [items, filter, filterKategori, search])

  const lowCount = items.filter(it => Number(it.stok) <= Number(it.stokMin)).length
  const totalNilai = items.reduce((sum, it) => sum + Number(it.stok || 0) * Number(it.hargaSatuan || 0), 0)
  const totalMasuk = items.reduce((sum, it) => sum + Number(it.masuk || 0), 0)

  const submitMutasi = async () => {
    if (!mutasi || !jumlah) return
    const raw = Number(jumlah)
    if (Number.isNaN(raw) || raw <= 0) {
      alert('Jumlah tidak valid')
      return
    }
    const panjangRoll = Number(mutasi.item.notes || 0)
    const j = mutasiInputMode === 'meter' && panjangRoll > 0 ? Math.ceil(raw / panjangRoll) : raw
    setSaving(true)
    try {
      await inventoryAPI.mutasi(mutasi.item.id, mutasi.type, j)
      setMutasi(null)
      setJumlah('')
      fetch()
    } catch (e: any) {
      alert(e.response?.data?.message || 'Gagal mutasi')
    } finally {
      setSaving(false)
      setMutasiInputMode('roll')
    }
  }

  const openCreate = () => {
    setFormMode('create')
    setEditingItem(null)
    setForm(emptyForm)
    setFormErr('')
  }

  const openEdit = (item: any) => {
    setFormMode('edit')
    setEditingItem(item)
    setForm({
      kode: item.kode || '',
      nama: item.nama || '',
      kategori: item.kategori || 'Material',
      satuan: item.satuan || 'Pcs',
      satuanPakai: item.satuanPakai || '',
      isiPerUnit: item.isiPerUnit ? String(item.isiPerUnit) : '',
      stok: String(item.stok ?? 0),
      stokMin: String(item.stokMin ?? 0),
      hargaSatuan: String(Math.round(Number(item.hargaSatuan ?? 0))),
      pemasok: item.pemasok || '',
      notes: item.notes || '',
    })
    setFormErr('')
  }

  const closeForm = () => {
    setFormMode(null)
    setEditingItem(null)
  }

  const submitForm = async () => {
    if (!form.kode.trim()) return setFormErr('Kode wajib diisi')
    if (!form.nama.trim()) return setFormErr('Nama item wajib diisi')
    const payload = {
      kode: form.kode.trim(),
      nama: form.nama.trim(),
      kategori: form.kategori,
      satuan: form.satuan,
      satuanPakai: form.satuanPakai.trim() || null,
      isiPerUnit: form.isiPerUnit && Number(form.isiPerUnit) > 0 ? Number(form.isiPerUnit) : null,
      stok: Number(form.stok) || 0,
      stokMin: Number(form.stokMin) || 0,
      hargaSatuan: Number(form.hargaSatuan) || 0,
      pemasok: form.pemasok || undefined,
      notes: needsLength(form) ? form.notes || undefined : undefined,
    }
    setSaving(true)
    setFormErr('')
    try {
      if (formMode === 'edit' && editingItem) await inventoryAPI.update(editingItem.id, payload)
      else await inventoryAPI.create(payload)
      closeForm()
      fetch()
    } catch (e: any) {
      setFormErr(e.response?.data?.message || e.message || 'Gagal menyimpan item')
    } finally {
      setSaving(false)
    }
  }

  const submitDelete = async () => {
    if (!deleteItem) return
    setSaving(true)
    try {
      await inventoryAPI.delete(deleteItem.id)
      setDeleteItem(null)
      fetch()
    } catch (e: any) {
      alert(e.response?.data?.message || e.message || 'Gagal menghapus item')
    } finally {
      setSaving(false)
    }
  }

  const submitEditStok = async () => {
    if (!editStok) return
    const stok = Number(editStokVal)
    if (Number.isNaN(stok) || stok < 0) return alert('Jumlah stok tidak valid')
    setSaving(true)
    try {
      const isiPerUnit = editStokIsiPerUnit && Number(editStokIsiPerUnit) > 0 ? Number(editStokIsiPerUnit) : null
      await inventoryAPI.update(editStok.id, {
        stok,
        satuan: editStokSatuan || editStok.satuan,
        isiPerUnit,
        satuanPakai: isiPerUnit ? (editStokSatuanPakai || null) : null,
      })
      setEditStok(null)
      setEditStokVal('')
      fetch()
    } catch (e: any) {
      alert(e.response?.data?.message || e.message || 'Gagal mengubah stok')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="px-4 pt-3 space-y-3 pb-4">
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Total Item" value={items.length.toLocaleString('id-ID')} color="#111" />
        <Stat label="Stok Menipis" value={lowCount.toLocaleString('id-ID')} color={lowCount > 0 ? '#64748b' : '#16a34a'} />
        <Stat label="Masuk" value={`+${totalMasuk.toLocaleString('id-ID')}`} color="#1E4FD8" />
        <Stat label="Nilai Stok" value={'Rp ' + Math.round(totalNilai).toLocaleString('id-ID')} color="#7c3aed" small />
      </div>

      <div className="grid grid-cols-3 gap-1 rounded-2xl bg-[#e2e8f0] p-1">
        {([['stok', 'Stok'], ['masuk', 'Masuk'], ['keluar', 'Keluar']] as [Tab, string][]).map(([key, label]) => (
          <button key={key} onClick={() => setActiveTab(key)} className={`rounded-xl py-2 text-[12px] font-semibold ${activeTab === key ? 'bg-white text-brand shadow-sm' : 'text-ink-3'}`}>
            {label}
          </button>
        ))}
      </div>

      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Cari nama, kode, kategori, pemasok..."
        className="w-full bg-white border border-wm-line rounded-2xl px-3 py-2.5 text-[13px] outline-none focus:border-[#1E4FD8]"
      />

      <div className="flex gap-2 overflow-x-auto pb-1">
        <button onClick={() => setFilter('ALL')} className={`flex-1 text-[12px] font-semibold py-2 rounded-xl ${filter === 'ALL' ? 'bg-brand text-white' : 'bg-white text-ink-3 border border-wm-line'}`}>
          Semua ({items.length})
        </button>
        <button onClick={() => setFilter('LOW')} className={`flex-1 text-[12px] font-semibold py-2 rounded-xl ${filter === 'LOW' ? 'bg-[#475569] text-white' : 'bg-white text-[#475569] border border-[#cbd5e1]'}`}>
          Stok rendah ({lowCount})
        </button>
      </div>

      <select value={filterKategori} onChange={e => setFilterKategori(e.target.value)} className="w-full bg-white border border-wm-line rounded-2xl px-3 py-2.5 text-[13px] outline-none focus:border-[#1E4FD8]">
        <option>Semua</option>
        {categories.map(k => <option key={k}>{k}</option>)}
      </select>

      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[#e2e8f0] p-1">
        <button onClick={() => setViewMode('simple')} className={`text-[12px] font-semibold py-2 rounded-xl ${viewMode === 'simple' ? 'bg-white text-ink shadow-sm' : 'text-ink-3'}`}>
          Ringkas
        </button>
        <button onClick={() => setViewMode('detail')} className={`text-[12px] font-semibold py-2 rounded-xl ${viewMode === 'detail' ? 'bg-white text-ink shadow-sm' : 'text-ink-3'}`}>
          Detail
        </button>
      </div>

      {loading && <p className="text-center text-[12px] text-ink-4 py-6">Memuat...</p>}
      {!loading && filtered.length === 0 && (
        <div className="bg-white rounded-2xl border border-wm-line p-8 text-center">
          <p className="text-[13px] text-[#666]">Tidak ada item</p>
        </div>
      )}

      <div className="space-y-2.5">
        {filtered.map(it => {
          const low = Number(it.stok) <= Number(it.stokMin)
          const small = smallUnitLabel(it, Number(it.stok))
          const expanded = expandedId === it.id
          if (activeTab === 'masuk' || activeTab === 'keluar') {
            const qty = Number(it[activeTab] || 0)
            const color = activeTab === 'masuk' ? '#1E4FD8' : '#f59e0b'
            return (
              <div key={it.id} className="bg-white rounded-2xl border border-wm-line p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold truncate">{it.nama}</p>
                    <p className="text-[10px] text-ink-4">{it.kode} - {it.satuan}</p>
                    <p className="text-[11px] text-ink-3 mt-1">
                      Stok akhir: <b>{Number(it.stok).toLocaleString('id-ID')}</b> {it.satuan}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[18px] font-extrabold" style={{ color }}>{activeTab === 'masuk' ? '+' : '-'}{qty.toLocaleString('id-ID')}</p>
                    <p className="text-[9px] text-ink-4">{activeTab === 'masuk' ? 'Masuk' : 'Keluar'}</p>
                  </div>
                </div>
                <button
                  onClick={() => { setMutasi({ item: it, type: activeTab }); setJumlah(''); setMutasiInputMode('roll') }}
                  className={`mt-3 w-full rounded-xl py-2 text-[12px] font-bold ${activeTab === 'masuk' ? 'bg-brand-50 text-brand' : 'bg-[#fffbeb] text-[#f59e0b]'}`}
                >
                  {activeTab === 'masuk' ? '+ Tambah Masuk' : '+ Catat Keluar'}
                </button>
              </div>
            )
          }
          if (viewMode === 'simple') {
            return (
              <div key={it.id} className="bg-white rounded-2xl border border-wm-line p-3">
                <div className="flex items-center gap-3">
                  <button onClick={() => setExpandedId(expanded ? null : it.id)} className="min-w-0 flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-bold truncate">{it.nama}</p>
                      {low && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-wm-bg text-ink-3">RENDAH</span>}
                    </div>
                    <p className="text-[10px] text-ink-4 truncate">{it.kode} - {it.kategori || '-'}</p>
                  </button>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[18px] font-bold leading-none text-ink">
                      {Number(it.stok).toLocaleString('id-ID')}
                      <span className="text-[10px] text-ink-4 font-normal ml-1">{it.satuan}</span>
                    </p>
                    {small && <p className="text-[9px] text-brand font-semibold mt-0.5">{small}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-3">
                  <button onClick={() => { setMutasi({ item: it, type: 'masuk' }); setJumlah('') }} className="bg-[#dcfce7] text-[#15803d] text-[12px] font-semibold py-2 rounded-xl">
                    + Masuk
                  </button>
                  <button onClick={() => { setMutasi({ item: it, type: 'keluar' }); setJumlah('') }} className="bg-[#fee2e2] text-[#b91c1c] text-[12px] font-semibold py-2 rounded-xl">
                    - Keluar
                  </button>
                  <button onClick={() => setExpandedId(expanded ? null : it.id)} className="bg-wm-bg text-[#475569] text-[12px] font-semibold py-2 rounded-xl">
                    {expanded ? 'Tutup' : 'Detail'}
                  </button>
                </div>

                {expanded && (
                  <div className="mt-3 pt-3 border-t border-[#f1f5f9] space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <InfoBox label="Masuk" value={`+${Number(it.masuk || 0).toLocaleString('id-ID')}`} color="#15803d" />
                      <InfoBox label="Keluar" value={`-${Number(it.keluar || 0).toLocaleString('id-ID')}`} color="#dc2626" />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-[#666]">
                      <span>Min: {Number(it.stokMin).toLocaleString('id-ID')} {it.satuan}</span>
                      <span>Rp {Number(it.hargaSatuan || 0).toLocaleString('id-ID')}/{it.satuan}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => openEdit(it)} className="bg-brand-50 text-brand text-[12px] font-semibold py-2 rounded-xl">Edit</button>
                      <button onClick={() => { setEditStok(it); setEditStokVal(String(it.stok ?? 0)); setEditStokSatuan(it.satuan || 'Pcs'); setEditStokIsiPerUnit(it.isiPerUnit ? String(it.isiPerUnit) : ''); setEditStokSatuanPakai(it.satuanPakai || '') }} className="bg-[#f5f3ff] text-[#7c3aed] text-[12px] font-semibold py-2 rounded-xl">Stok</button>
                      <button onClick={() => setDeleteItem(it)} className="bg-[#fef2f2] text-[#dc2626] text-[12px] font-semibold py-2 rounded-xl col-span-2">Hapus</button>
                    </div>
                  </div>
                )}
              </div>
            )
          }
          return (
            <div key={it.id} className="bg-white rounded-2xl border border-wm-line p-3.5">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold truncate">{it.nama}</p>
                  <p className="text-[10px] text-ink-4">{it.kode} - {it.kategori || '-'}</p>
                </div>
                {low && <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-wm-bg text-ink-3">RENDAH</span>}
              </div>

              <div className="flex items-end justify-between mb-2.5">
                <div>
                  <p className="text-[20px] font-bold leading-none text-ink">
                    {Number(it.stok).toLocaleString('id-ID')}
                    <span className="text-[11px] text-ink-4 font-normal ml-1">{it.satuan}</span>
                  </p>
                  {smallUnitLabel(it, Number(it.stok)) && (
                    <p className="text-[10px] text-brand font-semibold mt-0.5">{smallUnitLabel(it, Number(it.stok))}</p>
                  )}
                  <p className="text-[10px] text-ink-4 mt-0.5">Min: {Number(it.stokMin).toLocaleString('id-ID')}</p>
                </div>
                <p className="text-[11px] text-[#666]">Rp {Number(it.hargaSatuan || 0).toLocaleString('id-ID')}/{it.satuan}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-2.5">
                <div className="rounded-xl bg-[#f0fdf4] px-3 py-2">
                  <p className="text-[10px] text-[#15803d] font-semibold">Masuk</p>
                  <p className="text-[13px] text-[#15803d] font-bold">+{Number(it.masuk || 0).toLocaleString('id-ID')}</p>
                </div>
                <div className="rounded-xl bg-[#fef2f2] px-3 py-2">
                  <p className="text-[10px] text-[#dc2626] font-semibold">Keluar</p>
                  <p className="text-[13px] text-[#dc2626] font-bold">-{Number(it.keluar || 0).toLocaleString('id-ID')}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-2">
                <button onClick={() => { setMutasi({ item: it, type: 'masuk' }); setJumlah('') }} className="bg-[#dcfce7] text-[#15803d] text-[12px] font-semibold py-2 rounded-xl">
                  + Masuk
                </button>
                <button onClick={() => { setMutasi({ item: it, type: 'keluar' }); setJumlah('') }} className="bg-[#fee2e2] text-[#b91c1c] text-[12px] font-semibold py-2 rounded-xl">
                  - Keluar
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => openEdit(it)} className="bg-brand-50 text-brand text-[12px] font-semibold py-2 rounded-xl">Edit</button>
                <button onClick={() => { setEditStok(it); setEditStokVal(String(it.stok ?? 0)); setEditStokSatuan(it.satuan || 'Pcs'); setEditStokIsiPerUnit(it.isiPerUnit ? String(it.isiPerUnit) : ''); setEditStokSatuanPakai(it.satuanPakai || '') }} className="bg-[#f5f3ff] text-[#7c3aed] text-[12px] font-semibold py-2 rounded-xl">Stok</button>
                <button onClick={() => setDeleteItem(it)} className="bg-[#fef2f2] text-[#dc2626] text-[12px] font-semibold py-2 rounded-xl col-span-2">Hapus</button>
              </div>
            </div>
          )
        })}
      </div>

      <button onClick={openCreate} className="mobile-fab" aria-label="Tambah item">
        +
      </button>

      {mutasi && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end" onClick={() => setMutasi(null)}>
          <div className="bg-white w-full rounded-t-3xl p-5 pb-8" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-[#e2e8f0] rounded-full mx-auto mb-4" />
            <p className="text-[16px] font-bold text-center mb-1">Mutasi {mutasi.type === 'masuk' ? 'Masuk' : 'Keluar'}</p>
            <p className="text-[12px] text-[#666] text-center mb-4">{mutasi.item.nama}</p>
            {String(mutasi.item.satuan || '').toLowerCase() === 'roll' && Number(mutasi.item.notes || 0) > 0 && (
              <div className="mb-3 grid grid-cols-2 rounded-xl border border-wm-line p-1">
                <button onClick={() => { setMutasiInputMode('roll'); setJumlah('') }} className={`rounded-lg py-2 text-[12px] font-semibold ${mutasiInputMode === 'roll' ? 'bg-brand text-white' : 'text-ink-3'}`}>Roll</button>
                <button onClick={() => { setMutasiInputMode('meter'); setJumlah('') }} className={`rounded-lg py-2 text-[12px] font-semibold ${mutasiInputMode === 'meter' ? 'bg-brand text-white' : 'text-ink-3'}`}>Meter</button>
              </div>
            )}
            <label className="block text-[11px] font-semibold text-[#666] mb-1">Jumlah ({mutasiInputMode === 'meter' ? 'meter' : mutasi.item.satuan})</label>
            <input type="number" value={jumlah} onChange={e => setJumlah(e.target.value)} autoFocus className={inputCls + ' text-[16px] mb-4'} />
            {mutasiInputMode === 'meter' && Number(mutasi.item.notes || 0) > 0 && Number(jumlah) > 0 && (
              <p className="mb-4 rounded-xl border border-[#fde68a] bg-[#fffbeb] px-3 py-2 text-[11px] text-[#92400e]">
                {Number(jumlah).toLocaleString('id-ID')}m / {mutasi.item.notes}m per roll = {Math.ceil(Number(jumlah) / Number(mutasi.item.notes))} roll
              </p>
            )}
            <div className="flex gap-2">
              <button onClick={() => setMutasi(null)} className="flex-1 bg-wm-bg text-ink-3 text-[14px] font-semibold py-3 rounded-xl">Batal</button>
              <button onClick={submitMutasi} disabled={saving} className={`flex-1 text-white text-[14px] font-semibold py-3 rounded-xl disabled:opacity-50 ${mutasi.type === 'masuk' ? 'bg-[#16a34a]' : 'bg-[#dc2626]'}`}>
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editStok && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end" onClick={() => setEditStok(null)}>
          <div className="bg-white w-full rounded-t-3xl p-5 pb-8" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-[#e2e8f0] rounded-full mx-auto mb-4" />
            <p className="text-[16px] font-bold text-center mb-1">Edit Stok</p>
            <p className="text-[12px] text-[#666] text-center mb-4">{editStok.nama}</p>

            <div className="flex gap-2 mb-3">
              <div className="flex-1">
                <label className="block text-[11px] font-semibold text-[#666] mb-1">Jumlah Stok</label>
                <input type="number" value={editStokVal} onChange={e => setEditStokVal(e.target.value)} autoFocus className={inputCls + ' text-[16px]'} />
              </div>
              <div className="w-28">
                <label className="block text-[11px] font-semibold text-[#666] mb-1">Satuan Beli</label>
                <select value={editStokSatuan} onChange={e => setEditStokSatuan(e.target.value)} className={inputCls}>
                  {units.map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
            </div>

            <div className="flex gap-2 mb-3">
              <div className="flex-1">
                <label className="block text-[11px] font-semibold text-[#666] mb-1">Isi per {editStokSatuan} (opsional)</label>
                <input type="number" value={editStokIsiPerUnit} onChange={e => setEditStokIsiPerUnit(e.target.value)} placeholder="Kosong = tidak ada" className={inputCls} />
              </div>
              <div className="w-28">
                <label className="block text-[11px] font-semibold text-[#666] mb-1">Satuan pakai</label>
                <select value={editStokSatuanPakai} onChange={e => setEditStokSatuanPakai(e.target.value)} className={inputCls}>
                  <option value="">—</option>
                  <option value="m">m (meter)</option>
                  <option value="cm">cm</option>
                  <option value="ml">ml</option>
                  <option value="gr">gr (gram)</option>
                  <option value="mm">mm</option>
                  <option value="liter">liter</option>
                  <option value="kg">kg</option>
                </select>
              </div>
            </div>
            {editStokIsiPerUnit && Number(editStokIsiPerUnit) > 0 && editStokSatuanPakai && (
              <p className="mb-3 text-[11px] text-brand bg-brand-50 rounded-lg px-3 py-2">
                = {(Number(editStokVal || 0) * Number(editStokIsiPerUnit)).toLocaleString('id-ID')} {editStokSatuanPakai} total
              </p>
            )}
            <p className="mb-4 text-[11px] text-ink-4">Stok sebelumnya: {Number(editStok.stok || 0).toLocaleString('id-ID')} {editStok.satuan}</p>
            <div className="flex gap-2">
              <button onClick={() => setEditStok(null)} className="flex-1 bg-wm-bg text-ink-3 text-[14px] font-semibold py-3 rounded-xl">Batal</button>
              <button onClick={submitEditStok} disabled={saving} className="flex-1 bg-brand text-white text-[14px] font-semibold py-3 rounded-xl disabled:opacity-50">
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {formMode && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end" onClick={closeForm}>
          <div className="bg-white w-full rounded-t-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white px-5 pt-4 pb-3 border-b border-wm-line">
              <div className="w-10 h-1 bg-[#e2e8f0] rounded-full mx-auto mb-3" />
              <div className="flex items-center justify-between">
                <p className="text-[16px] font-bold">{formMode === 'edit' ? 'Edit Item' : 'Item Baru'}</p>
                <button onClick={closeForm} className="text-[12px] font-semibold text-[#666]">Tutup</button>
              </div>
            </div>
            <div className="px-5 py-4 space-y-3.5 pb-8">
              <TextField label="Kode" value={form.kode} onChange={v => setForm({ ...form, kode: v })} required />
              <TextField label="Nama Item" value={form.nama} onChange={v => setForm({ ...form, nama: v })} required />
              <SelectField label="Kategori" value={form.kategori} options={categories} onChange={v => setForm({ ...form, kategori: v })} />
              <SelectField label="Satuan Beli" value={form.satuan} options={units} onChange={v => setForm({ ...form, satuan: v })} />
              <div className="flex gap-2">
                <div className="flex-1">
                  <TextField
                    label={`Isi per ${form.satuan} (opsional)`}
                    value={form.isiPerUnit}
                    type="number"
                    onChange={v => setForm({ ...form, isiPerUnit: v })}
                    placeholder={`Contoh: 1 ${form.satuan} = ? satuan pakai`}
                  />
                </div>
                <div className="w-32">
                  <label className="block text-[11px] font-semibold text-[#666] mb-1">Satuan Pakai</label>
                  <select value={form.satuanPakai} onChange={e => setForm({ ...form, satuanPakai: e.target.value })} className={inputCls}>
                    <option value="">—</option>
                    <option value="m">m (meter)</option>
                    <option value="cm">cm</option>
                    <option value="ml">ml</option>
                    <option value="gr">gr (gram)</option>
                    <option value="mm">mm</option>
                    <option value="liter">liter</option>
                    <option value="kg">kg</option>
                  </select>
                </div>
              </div>
              {form.isiPerUnit && Number(form.isiPerUnit) > 0 && form.satuanPakai && (
                <p className="text-[11px] text-brand bg-brand-50 rounded-lg px-3 py-2">
                  1 {form.satuan} = {form.isiPerUnit} {form.satuanPakai}
                </p>
              )}
              {needsLength(form) && !form.satuanPakai && (
                <TextField
                  label={String(form.kategori).toLowerCase().includes('paint protection film') ? 'Ukuran / Panjang PPF (meter) — sistem lama' : 'Panjang Roll — sistem lama'}
                  value={form.notes}
                  type="number"
                  onChange={v => setForm({ ...form, notes: v })}
                />
              )}
              <TextField label="Stok" value={form.stok} type="number" onChange={v => setForm({ ...form, stok: v })} />
              <TextField label="Stok Minimum" value={form.stokMin} type="number" onChange={v => setForm({ ...form, stokMin: v })} />
              <TextField label="Harga Satuan" value={form.hargaSatuan} type="number" onChange={v => setForm({ ...form, hargaSatuan: v.replace(/^0+(?=\d)/, '') })} />
              <TextField label="Pemasok" value={form.pemasok} onChange={v => setForm({ ...form, pemasok: v })} />
              {!needsLength(form) && <TextField label="Catatan" value={form.notes} onChange={v => setForm({ ...form, notes: v })} textarea />}
              {formErr && <p className="text-[12px] text-[#dc2626]">{formErr}</p>}
              <button onClick={submitForm} disabled={saving} className="w-full bg-brand text-white text-[14px] font-semibold py-3 rounded-xl disabled:opacity-50">
                {saving ? 'Menyimpan...' : formMode === 'edit' ? 'Simpan Perubahan' : 'Simpan Item'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteItem && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end" onClick={() => setDeleteItem(null)}>
          <div className="bg-white w-full rounded-t-3xl p-5 pb-8" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-[#e2e8f0] rounded-full mx-auto mb-4" />
            <p className="text-[16px] font-bold text-center mb-1">Hapus Item?</p>
            <p className="text-[12px] text-[#666] text-center mb-5">{deleteItem.nama} akan dihapus.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteItem(null)} className="flex-1 bg-wm-bg text-ink-3 text-[14px] font-semibold py-3 rounded-xl">Batal</button>
              <button onClick={submitDelete} disabled={saving} className="flex-1 bg-[#dc2626] text-white text-[14px] font-semibold py-3 rounded-xl disabled:opacity-50">
                {saving ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TextField({ label, value, onChange, type = 'text', required, textarea, placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean; textarea?: boolean; placeholder?: string }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-[#666] mb-1">{label}{required && <span className="text-[#dc2626] ml-0.5">*</span>}</label>
      {textarea ? (
        <textarea rows={3} value={value} onChange={e => onChange(e.target.value)} className={inputCls} />
      ) : (
        <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={inputCls} style={{ minWidth: 0 }} />
      )}
    </div>
  )
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-[#666] mb-1">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} className={inputCls} style={{ minWidth: 0 }}>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

function InfoBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl bg-wm-bg px-3 py-2">
      <p className="text-[10px] text-ink-4 font-semibold">{label}</p>
      <p className="text-[13px] font-bold" style={{ color }}>{value}</p>
    </div>
  )
}

function Stat({ label, value, color, small }: { label: string; value: string; color: string; small?: boolean }) {
  return (
    <div className="rounded-2xl border border-wm-line bg-white p-3 min-w-0">
      <p className="text-[10px] text-ink-3 truncate">{label}</p>
      <p className={`${small ? 'text-[13px]' : 'text-[20px]'} mt-1 font-extrabold truncate`} style={{ color }}>{value}</p>
    </div>
  )
}

const inputCls = 'w-full bg-wm-bg border border-wm-line rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-[#1E4FD8] focus:bg-white'
