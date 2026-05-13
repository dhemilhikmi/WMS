import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { inventoryAPI } from '../services/api'
import { DEFAULT_KATEGORI as SHARED_KATEGORI } from '../constants/kategori'

interface BarangInventaris {
  id: string
  kode: string
  nama: string
  kategori: string
  satuan: string
  satuanPakai: string
  isiPerUnit: number
  stokAwal: number
  masuk: number
  keluar: number
  stokMin: number
  hargaSatuan: number
  pemasok: string
  panjangRoll: string
  terakhirUpdate: string
}

const DEFAULT_KATEGORI = SHARED_KATEGORI
const DEFAULT_SATUAN   = ['Botol', 'Pcs', 'Set', 'Liter', 'ml', 'Kg', 'gram', 'mg', 'Meter', 'cm', 'Roll', 'Lembar', 'Box']

// Faktor konversi default antar satuan (dari → ke → faktor)
const KONVERSI_PRESET: Record<string, Record<string, number>> = {
  'liter':  { 'ml': 1000 },
  'ml':     { 'liter': 0.001 },
  'kg':     { 'gram': 1000, 'mg': 1_000_000 },
  'gram':   { 'kg': 0.001, 'mg': 1000 },
  'mg':     { 'gram': 0.001, 'kg': 0.000001 },
  'meter':  { 'cm': 100 },
  'cm':     { 'meter': 0.01 },
}

const isPPF  = (kategori: string) => kategori === 'Paint Protection Film'
const isRoll = (satuan: string)   => satuan.toLowerCase().includes('roll')
const needsUkuran = (kategori: string, satuan: string) => isPPF(kategori) || isRoll(satuan)

const inputCls = 'w-full rounded border border-[#cbd5e1] bg-white px-3 py-2 text-sm text-[#111] outline-none focus:border-brand focus:ring-2 focus:ring-[#dbeafe] transition'
const labelCls = 'block text-[11px] font-semibold text-[#555] mb-1'
const cleanNumber = (value: string) => value.replace(/[^\d]/g, '')
const fmtNumberInput = (value: string | number) => {
  const n = Math.round(Number(cleanNumber(String(value || ''))))
  return n > 0 ? n.toLocaleString('id-ID', { maximumFractionDigits: 0 }) : ''
}

const emptyForm = {
  kode: '', nama: '', kategori: 'Bahan Kimia', satuan: 'Botol',
  satuanPakai: '', isiPerUnit: 0,
  stokAwal: 0, masuk: 0, keluar: 0, stokMin: 0,
  hargaSatuan: 0, pemasok: '', panjangRoll: '', terakhirUpdate: new Date().toLocaleDateString('id-ID'),
}

type Tab = 'stok' | 'masuk' | 'keluar'

export default function InventarisPage() {
  const { tenant } = useAuth()
  const location = useLocation()
  const [barangList, setBarangList] = useState<BarangInventaris[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [activeTab, setActiveTab] = useState<Tab>('stok')
  const [search, setSearch] = useState('')
  const [filterKategori, setFilterKategori] = useState('Semua')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [mutasiModal, setMutasiModal] = useState<{ id: string; type: 'masuk' | 'keluar'; panjangRoll?: string } | null>(null)
  const [mutasiJumlah, setMutasiJumlah] = useState(0)
  const [mutasiKet, setMutasiKet] = useState('')
  const [mutasiInputMode, setMutasiInputMode] = useState<'roll' | 'meter'>('roll')
  // Custom options
  const [kategoriOptions, setKategoriOptions] = useState(DEFAULT_KATEGORI)
  const [satuanOptions, setSatuanOptions]     = useState(DEFAULT_SATUAN)
  const [addingKategori, setAddingKategori]       = useState(false)
  const [addingSatuan, setAddingSatuan]           = useState(false)
  const [newKategori, setNewKategori]             = useState('')
  const [newSatuan, setNewSatuan]                 = useState('')
  const [showKategoriDropdown, setShowKategoriDropdown] = useState(false)
  const kategoriDropdownRef = useRef<HTMLDivElement>(null)
  // Konversi satuan
  const [konversiFrom, setKonversiFrom]       = useState<string>('')
  const [konversiFaktor, setKonversiFaktor]   = useState<number>(1)
  const [showKonversi, setShowKonversi]       = useState(false)
  // Edit stok langsung
  const [editStokModal, setEditStokModal]     = useState<{ id: string; nama: string; stok: number } | null>(null)
  const [editStokVal, setEditStokVal]         = useState(0)
  // Audit log
  const [logModal, setLogModal]               = useState<{ id: string; nama: string } | null>(null)
  const [logData, setLogData]                 = useState<any[]>([])
  const [logLoading, setLogLoading]           = useState(false)
  // Dropdown aksi per baris
  const [openMenuId, setOpenMenuId]           = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!tenant?.id) return
    try {
      setLoading(true)
      const res = await inventoryAPI.list()
      const raw: any[] = res.data.data || []
      setBarangList(raw.map(r => ({
        id: r.id,
        kode: r.kode,
        nama: r.nama,
        kategori: r.kategori,
        satuan: r.satuan,
        satuanPakai: r.satuanPakai || '',
        isiPerUnit: r.isiPerUnit || 0,
        stokAwal: Math.max(0, Math.round((r.stok - r.masuk + r.keluar) * 1000) / 1000),
        masuk: r.masuk,
        keluar: r.keluar,
        stokMin: r.stokMin,
        hargaSatuan: Math.round(Number(r.hargaSatuan)),
        pemasok: r.pemasok || '',
        panjangRoll: r.notes || '',
        terakhirUpdate: new Date(r.updatedAt).toLocaleDateString('id-ID'),
      })))
    } catch (err) {
      console.error('Failed to fetch inventory:', err)
    } finally {
      setLoading(false)
    }
  }, [tenant?.id])

  // Re-fetch setiap navigasi (location.key unik tiap kunjungan)
  useEffect(() => { fetchData() }, [fetchData, location.key])

  useEffect(() => {
    if (!showKategoriDropdown) return
    const close = (e: MouseEvent) => {
      if (kategoriDropdownRef.current && !kategoriDropdownRef.current.contains(e.target as Node)) {
        setShowKategoriDropdown(false)
      }
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [showKategoriDropdown])

  const getStok = (b: BarangInventaris) => b.stokAwal + b.masuk - b.keluar
  const isLow = (b: BarangInventaris) => getStok(b) <= b.stokMin

  const smallUnitLabel = (b: BarangInventaris, stok: number): string | null => {
    // Sistem baru: isiPerUnit + satuanPakai
    if (b.isiPerUnit && b.isiPerUnit > 0 && b.satuanPakai) {
      return `${(stok * b.isiPerUnit).toLocaleString('id-ID')} ${b.satuanPakai}`
    }
    // Fallback sistem lama
    const s = b.satuan.toLowerCase()
    if (s === 'liter') return `${(stok * 1000).toLocaleString('id-ID')} ml`
    if (s === 'kg')    return `${(stok * 1000).toLocaleString('id-ID')} gr`
    if (s === 'roll' && b.panjangRoll && Number(b.panjangRoll) > 0)
      return `${(stok * Number(b.panjangRoll)).toLocaleString('id-ID')} m`
    return null
  }

  const filtered = useMemo(() => {
    return barangList.filter((b) => {
      const q = search.toLowerCase()
      const matchSearch = b.nama.toLowerCase().includes(q) || b.kode.toLowerCase().includes(q) || b.pemasok.toLowerCase().includes(q)
      const matchKat = filterKategori === 'Semua' || b.kategori === filterKategori
      return matchSearch && matchKat
    })
  }, [barangList, search, filterKategori])

  const lowStockCount = barangList.filter(isLow).length
  const totalNilai = barangList.reduce((sum, b) => sum + getStok(b) * b.hargaSatuan, 0)
  const totalMeterPPF = barangList
    .filter(b => b.kategori === 'Paint Protection Film' && Number(b.panjangRoll) > 0)
    .reduce((sum, b) => sum + getStok(b) * Number(b.panjangRoll), 0)
  const ppfItems = barangList.filter(b => b.kategori === 'Paint Protection Film')

  const openAdd = () => {
    setEditingId(null)
    setForm({ ...emptyForm, kode: `BHN-${String(barangList.length + 1).padStart(3, '0')}` })
    setShowForm(true)
  }

  const openLog = async (b: BarangInventaris) => {
    setLogModal({ id: b.id, nama: b.nama })
    setLogLoading(true)
    try {
      const res = await inventoryAPI.log(b.id)
      setLogData(res.data.data || [])
    } catch {
      setLogData([])
    } finally {
      setLogLoading(false)
    }
  }

  const openEdit = (b: BarangInventaris) => {
    setEditingId(b.id)
    setForm({ kode: b.kode, nama: b.nama, kategori: b.kategori, satuan: b.satuan, satuanPakai: b.satuanPakai || '', isiPerUnit: b.isiPerUnit || 0, stokAwal: getStok(b), masuk: b.masuk, keluar: b.keluar, stokMin: b.stokMin, hargaSatuan: b.hargaSatuan, pemasok: b.pemasok || '', panjangRoll: b.panjangRoll, terakhirUpdate: b.terakhirUpdate })
    setKonversiFrom(b.satuan)
    setKonversiFaktor(1)
    setShowKonversi(false)
    setShowForm(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSaveError('')
    try {
      const notes = form.satuan.toLowerCase().includes('roll') && form.panjangRoll ? form.panjangRoll : ''
      if (editingId) {
        const stokLama = form.stokAwal
        const stokBaru = showKonversi && konversiFaktor !== 1
          ? Math.round(stokLama * konversiFaktor * 1000) / 1000
          : stokLama
        await inventoryAPI.update(editingId, {
          kode: form.kode, nama: form.nama, kategori: form.kategori,
          satuan: form.satuan, stokMin: showKonversi && konversiFaktor !== 1
            ? Math.round(form.stokMin * konversiFaktor * 1000) / 1000
            : form.stokMin,
          hargaSatuan: showKonversi && konversiFaktor !== 1 && konversiFaktor > 0
            ? Math.round((form.hargaSatuan / konversiFaktor) * 1000) / 1000
            : form.hargaSatuan,
          pemasok: form.pemasok,
          stok: stokBaru,
          notes,
          satuanPakai: form.satuanPakai?.trim() || null,
          isiPerUnit: form.isiPerUnit > 0 ? form.isiPerUnit : null,
        })
      } else {
        await inventoryAPI.create({
          kode: form.kode, nama: form.nama, kategori: form.kategori,
          satuan: form.satuan, stok: form.stokAwal,
          stokMin: form.stokMin, hargaSatuan: form.hargaSatuan, pemasok: form.pemasok,
          notes,
          satuanPakai: form.satuanPakai?.trim() || null,
          isiPerUnit: form.isiPerUnit > 0 ? form.isiPerUnit : null,
        })
      }
      setShowForm(false)
      setEditingId(null)
      fetchData()
    } catch (err: any) {
      console.error('Save failed:', err)
      setSaveError(err?.response?.data?.message || 'Gagal menyimpan. Coba lagi.')
    } finally {
      setSaving(false)
    }
  }

  const handleMutasi = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!mutasiModal || mutasiJumlah <= 0) return
    setSaving(true)
    try {
      // Konversi meter ke roll jika perlu
      const panjang = Number(mutasiModal.panjangRoll) || 0
      const jumlahFinal = (mutasiInputMode === 'meter' && panjang > 0)
        ? Math.ceil(mutasiJumlah / panjang)
        : mutasiJumlah
      await inventoryAPI.mutasi(mutasiModal.id, mutasiModal.type, jumlahFinal, mutasiKet || undefined)
      await fetchData()
      setMutasiModal(null)
      setMutasiJumlah(0)
      setMutasiKet('')
      setMutasiInputMode('roll')
    } catch (err) {
      console.error('Mutasi failed:', err)
    } finally {
      setSaving(false)
    }
  }

  const confirmAddKategori = () => {
    const v = newKategori.trim()
    if (v && !kategoriOptions.includes(v)) {
      setKategoriOptions(prev => [...prev, v])
      setForm(f => ({ ...f, kategori: v }))
    }
    setAddingKategori(false)
    setNewKategori('')
  }

  const confirmAddSatuan = () => {
    const v = newSatuan.trim()
    if (v && !satuanOptions.includes(v)) {
      setSatuanOptions(prev => [...prev, v])
      setForm(f => ({ ...f, satuan: v }))
    }
    setAddingSatuan(false)
    setNewSatuan('')
  }

  const deleteKategori = (k: string) => {
    setKategoriOptions(prev => prev.filter(o => o !== k))
    if (form.kategori === k) setForm(f => ({ ...f, kategori: kategoriOptions.find(o => o !== k) || '' }))
  }

  const handleEditStok = async () => {
    if (!editStokModal) return
    setSaving(true)
    try {
      await inventoryAPI.update(editStokModal.id, { stok: editStokVal })
      await fetchData()
      setEditStokModal(null)
    } catch (err) { console.error('Edit stok failed:', err) }
    finally { setSaving(false) }
  }

  const fmt = (n: number) => 'Rp ' + n.toLocaleString('id-ID')

  const LOG_TYPE_LABEL: Record<string, { label: string; color: string }> = {
    masuk:       { label: 'Masuk',        color: 'text-[#15803d] bg-[#dcfce7]' },
    keluar:      { label: 'Keluar',       color: 'text-[#c2410c] bg-[#ffedd5]' },
    koreksi:     { label: 'Koreksi',      color: 'text-[#7c3aed] bg-[#f5f3ff]' },
    po_terima:   { label: 'Terima PO',    color: 'text-[#1A45BF] bg-[#dbeafe]' },
    service_pakai: { label: 'Pakai Servis', color: 'text-[#b45309] bg-[#fef3c7]' },
  }

  return (
    <div className="p-6 space-y-5">

      {/* Modal Audit Log */}
      {logModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-xl border border-wm-line bg-white shadow-xl flex flex-col" style={{ maxHeight: '85vh' }}>
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-wm-line flex-shrink-0">
              <div>
                <p className="text-[11px] text-[#888]">Riwayat Mutasi Stok</p>
                <h2 className="text-base font-bold text-[#111]">{logModal.nama}</h2>
              </div>
              <button onClick={() => setLogModal(null)} className="text-[#aaa] hover:text-[#333] text-xl leading-none">✕</button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-4">
              {logLoading ? (
                <p className="text-sm text-[#aaa] text-center py-8">Memuat...</p>
              ) : logData.length === 0 ? (
                <p className="text-sm text-[#aaa] text-center py-8">Belum ada riwayat mutasi.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#f8fafc] text-[#555] text-[11px] font-semibold uppercase tracking-wide border-b border-wm-line">
                      <th className="px-3 py-2 text-left">Waktu</th>
                      <th className="px-3 py-2 text-left">Tipe</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2 text-right">Stok Sebelum</th>
                      <th className="px-3 py-2 text-right">Stok Sesudah</th>
                      <th className="px-3 py-2 text-left">Keterangan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logData.map((l: any) => {
                      const t = LOG_TYPE_LABEL[l.type] || { label: l.type, color: 'text-[#555] bg-[#f1f5f9]' }
                      return (
                        <tr key={l.id} className="border-b border-[#f1f5f9] hover:bg-[#f8fafc]">
                          <td className="px-3 py-2 text-[#888] whitespace-nowrap">
                            {new Date(l.createdAt).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-3 py-2">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${t.color}`}>{t.label}</span>
                          </td>
                          <td className="px-3 py-2 text-right font-semibold">
                            <span className={l.type === 'keluar' ? 'text-[#c2410c]' : 'text-[#15803d]'}>
                              {l.type === 'keluar' ? '-' : '+'}{l.qty}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right text-[#888]">{l.stokBefore}</td>
                          <td className="px-3 py-2 text-right font-semibold text-[#111]">{l.stokAfter}</td>
                          <td className="px-3 py-2 text-[#555]">{l.keterangan || '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
            <div className="px-6 py-3 border-t border-wm-line flex-shrink-0 flex justify-end">
              <button onClick={() => setLogModal(null)}
                className="px-4 py-2 rounded-lg bg-[#f1f5f9] text-sm text-[#555] hover:bg-[#e2e8f0] transition">
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg border border-wm-line bg-white p-6 shadow-xl">
            <p className="text-base font-bold text-[#111]">Hapus Barang?</p>
            <p className="mt-2 text-sm text-[#666]">Data inventaris akan dihapus permanen.</p>
            <div className="mt-5 flex gap-2">
              <button onClick={async () => { await inventoryAPI.delete(deleteConfirmId!); setDeleteConfirmId(null); fetchData() }}
                className="flex-1 rounded bg-[#dc2626] py-2 text-sm font-semibold text-white hover:bg-[#b91c1c] transition">Hapus</button>
              <button onClick={() => setDeleteConfirmId(null)}
                className="flex-1 rounded border border-wm-line py-2 text-sm text-[#555] hover:bg-[#f8fafc] transition">Batal</button>
            </div>
          </div>
        </div>
      )}

      {/* Mutasi modal */}
      {mutasiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg border border-wm-line bg-white p-6 shadow-xl">
            <p className="text-base font-bold text-[#111] mb-1">
              {mutasiModal.type === 'masuk' ? '📦 Tambah Stok Masuk' : '📤 Catat Stok Keluar'}
            </p>
            <p className="text-[12px] text-[#888] mb-4">
              {barangList.find((b) => b.id === mutasiModal.id)?.nama}
            </p>
            <form onSubmit={handleMutasi} className="space-y-3">
              {/* Toggle Roll/Meter jika ada panjangRoll */}
              {mutasiModal.panjangRoll && Number(mutasiModal.panjangRoll) > 0 && (
                <div className="flex rounded border border-wm-line overflow-hidden">
                  {(['roll', 'meter'] as const).map(mode => (
                    <button key={mode} type="button"
                      onClick={() => { setMutasiInputMode(mode); setMutasiJumlah(0) }}
                      className={`flex-1 py-1.5 text-[12px] font-semibold transition ${mutasiInputMode === mode ? 'bg-brand text-white' : 'bg-white text-[#888] hover:bg-[#f8fafc]'}`}>
                      {mode === 'roll' ? '🔲 Roll' : '📏 Meter'}
                    </button>
                  ))}
                </div>
              )}

              <div>
                <label className={labelCls}>
                  Jumlah {mutasiInputMode === 'meter' ? '(meter)' : '(roll)'}
                </label>
                <div className="flex items-center gap-2">
                  <input type="number" min="0.001" step={mutasiInputMode === 'meter' ? '0.1' : '0.001'}
                    required value={mutasiJumlah || ''}
                    onChange={e => setMutasiJumlah(e.target.value === '' ? 0 : Number(e.target.value))}
                    className={inputCls + ' flex-1'} />
                  <span className="text-[12px] text-[#888] flex-shrink-0">
                    {mutasiInputMode === 'meter' ? 'm' : 'roll'}
                  </span>
                </div>
                {/* Konversi info */}
                {mutasiInputMode === 'meter' && mutasiModal.panjangRoll && mutasiJumlah > 0 && (
                  <div className="mt-1.5 px-3 py-2 rounded bg-[#fffbeb] border border-[#fde68a] text-[11px] text-[#92400e]">
                    {mutasiJumlah}m ÷ {mutasiModal.panjangRoll}m/roll =&nbsp;
                    <span className="font-bold">
                      {(mutasiJumlah / Number(mutasiModal.panjangRoll)).toFixed(2)} roll
                    </span>
                    &nbsp;→ dibulatkan ke&nbsp;
                    <span className="font-bold">
                      {Math.ceil(mutasiJumlah / Number(mutasiModal.panjangRoll))} roll
                    </span>
                  </div>
                )}
                {mutasiInputMode === 'roll' && mutasiModal.panjangRoll && mutasiJumlah > 0 && (
                  <p className="text-[11px] text-brand mt-1">
                    = {(mutasiJumlah * Number(mutasiModal.panjangRoll)).toLocaleString('id-ID')} meter
                  </p>
                )}
              </div>
              <div>
                <label className={labelCls}>Keterangan</label>
                <input value={mutasiKet} onChange={e => setMutasiKet(e.target.value)}
                  placeholder="Contoh: dari PO-2026-04-0089" className={inputCls} />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="submit"
                  className={`flex-1 rounded py-2 text-sm font-semibold text-white transition ${mutasiModal.type === 'masuk' ? 'bg-brand hover:bg-brand-600' : 'bg-[#f59e0b] hover:bg-[#d97706]'}`}>
                  Simpan
                </button>
                <button type="button" onClick={() => setMutasiModal(null)}
                  className="flex-1 rounded border border-wm-line py-2 text-sm text-[#555] hover:bg-[#f8fafc] transition">Batal</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit stok modal */}
      {editStokModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xs rounded-lg border border-wm-line bg-white p-5 shadow-xl">
            <p className="text-sm font-bold text-[#111] mb-1">✏️ Edit Stok</p>
            <p className="text-[12px] text-[#888] mb-4">{editStokModal.nama}</p>
            <div className="mb-4">
              <label className={labelCls}>Jumlah Stok Sekarang</label>
              <input type="number" min="0" value={editStokVal}
                onChange={e => setEditStokVal(e.target.value === '' ? 0 : Number(e.target.value))}
                className={inputCls} autoFocus />
              <p className="text-[11px] text-[#aaa] mt-1">Stok sebelumnya: {editStokModal.stok}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={handleEditStok}
                className="flex-1 rounded bg-brand py-1.5 text-sm font-semibold text-white hover:bg-brand-600 transition">
                Simpan
              </button>
              <button onClick={() => setEditStokModal(null)}
                className="flex-1 rounded border border-wm-line py-1.5 text-sm text-[#555] hover:bg-[#f8fafc] transition">
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      {false && ppfItems.length > 0 && (
        <div className="rounded border border-[#ede9fe] bg-[#faf5ff] px-4 py-2.5 flex items-center gap-3">
          <div className="h-7 w-7 rounded bg-[#7c3aed] flex items-center justify-center text-white text-sm flex-shrink-0">
            🛡️
          </div>
          <p className="text-[10px] font-semibold text-[#7c3aed] uppercase tracking-wide flex-shrink-0">Stok PPF</p>
          <div className="flex items-center gap-3 flex-wrap flex-1">
            {ppfItems.map(b => (
              <span key={b.id} className="text-[12px] text-[#555]">
                <span className="font-semibold text-[#111]">{b.nama}:</span>{' '}
                <span className="font-bold text-[#7c3aed]">{getStok(b)}</span> roll
                {b.panjangRoll && Number(b.panjangRoll) > 0 && (
                  <span className="text-[#7c3aed]"> = {(getStok(b) * Number(b.panjangRoll)).toLocaleString('id-ID')}m</span>
                )}
              </span>
            ))}
          </div>
          {totalMeterPPF > 0 && (
            <div className="text-right flex-shrink-0">
              <span className="text-[10px] text-[#7c3aed]">Total PPF </span>
              <span className="text-[15px] font-bold text-[#7c3aed]">{totalMeterPPF.toLocaleString('id-ID')}m</span>
            </div>
          )}
        </div>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-lg border border-wm-line bg-white p-5">
          <p className="text-xs text-[#999]">Total Item</p>
          <p className="mt-2 text-4xl font-bold text-[#111]">{barangList.length}</p>
        </div>
        <div className="rounded-lg border border-wm-line bg-white p-5">
          <p className="text-xs text-[#999]">Stok Menipis</p>
          <p className={`mt-2 text-4xl font-bold ${lowStockCount > 0 ? 'text-[#dc2626]' : 'text-[#16a34a]'}`}>{lowStockCount}</p>
          {lowStockCount > 0 && <p className="mt-1 text-xs text-[#dc2626]">perlu reorder</p>}
        </div>
        <div className="rounded-lg border border-wm-line bg-white p-5">
          <p className="text-xs text-[#999]">Total Masuk (Bln)</p>
          <p className="mt-2 text-4xl font-bold text-brand">{barangList.reduce((s, b) => s + b.masuk, 0)}</p>
        </div>
        <div className="rounded-lg border border-wm-line bg-white p-5">
          <p className="text-xs text-[#999]">Nilai Inventaris</p>
          <p className="mt-2 text-xl font-bold text-[#111]">{fmt(totalNilai)}</p>
        </div>
      </div>

      {/* Form tambah / edit */}
      {showForm && (
        <div className="rounded-lg border border-[#D9E3FC] bg-white p-5">
          <p className="text-sm font-bold text-[#111] mb-4">{editingId ? 'Edit Barang' : 'Tambah Barang Baru'}</p>
          <form onSubmit={handleSave} className="space-y-3">
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label className={labelCls}>Kode Barang</label>
                <input required value={form.kode} onChange={(e) => setForm({ ...form, kode: e.target.value })} className={inputCls} />
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>Nama Barang</label>
                <input required value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} placeholder="Nama barang" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Kategori</label>
                {addingKategori ? (
                  <div className="flex gap-1.5">
                    <input autoFocus value={newKategori} onChange={e => setNewKategori(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); confirmAddKategori() } if (e.key === 'Escape') setAddingKategori(false) }}
                      placeholder="Nama kategori baru" className={inputCls + ' flex-1'} />
                    <button type="button" onClick={confirmAddKategori}
                      className="px-3 py-2 rounded bg-brand text-white text-sm font-bold hover:bg-brand-600">✓</button>
                    <button type="button" onClick={() => setAddingKategori(false)}
                      className="px-3 py-2 rounded border border-wm-line text-sm text-[#555] hover:bg-[#f8fafc]">×</button>
                  </div>
                ) : (
                  <div className="flex gap-1.5">
                    <div className="relative flex-1" ref={kategoriDropdownRef}>
                      <button type="button"
                        onClick={() => setShowKategoriDropdown(d => !d)}
                        className={inputCls + ' text-left flex items-center justify-between'}>
                        <span>{form.kategori || 'Pilih kategori'}</span>
                        <span className="text-[#aaa] text-xs ml-2">▾</span>
                      </button>
                      {showKategoriDropdown && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-wm-line rounded shadow-lg z-50 max-h-52 overflow-y-auto">
                          {kategoriOptions.map(k => (
                            <div key={k}
                              className={`flex items-center justify-between px-3 py-2 hover:bg-[#f8fafc] border-b border-[#f1f5f9] last:border-b-0 ${form.kategori === k ? 'bg-brand-50' : ''}`}>
                              <button type="button"
                                onClick={() => {
                                  const isPPFKat = k === 'Paint Protection Film'
                                  setForm(f => ({
                                    ...f,
                                    kategori: k,
                                    satuan: isPPFKat && !['Roll','Meter'].includes(f.satuan) ? 'Roll' : f.satuan,
                                  }))
                                  setShowKategoriDropdown(false)
                                }}
                                className="flex-1 text-left text-sm text-[#111]">
                                {k}
                                {form.kategori === k && <span className="ml-2 text-brand text-[10px]">✓</span>}
                              </button>
                              <button type="button"
                                onClick={e => { e.stopPropagation(); deleteKategori(k) }}
                                className="ml-2 p-1 rounded text-[#ccc] hover:text-[#ef4444] hover:bg-[#fee2e2] transition flex-shrink-0"
                                title={`Hapus "${k}"`}>
                                🗑
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <button type="button" onClick={() => { setAddingKategori(true); setShowKategoriDropdown(false) }}
                      className="px-3 py-2 rounded border border-brand text-brand text-sm font-bold hover:bg-brand-50 transition flex-shrink-0">+</button>
                  </div>
                )}
              </div>
              <div>
                <label className={labelCls}>Satuan</label>
                {addingSatuan ? (
                  <div className="flex gap-1.5">
                    <input autoFocus value={newSatuan} onChange={e => setNewSatuan(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); confirmAddSatuan() } if (e.key === 'Escape') setAddingSatuan(false) }}
                      placeholder="Nama satuan baru" className={inputCls + ' flex-1'} />
                    <button type="button" onClick={confirmAddSatuan}
                      className="px-3 py-2 rounded bg-brand text-white text-sm font-bold hover:bg-brand-600">✓</button>
                    <button type="button" onClick={() => setAddingSatuan(false)}
                      className="px-3 py-2 rounded border border-wm-line text-sm text-[#555] hover:bg-[#f8fafc]">×</button>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-1.5">
                      <select value={form.satuan} onChange={e => {
                        const newSatuanVal = e.target.value
                        const preset = KONVERSI_PRESET[konversiFrom.toLowerCase()]?.[newSatuanVal.toLowerCase()]
                        setKonversiFaktor(preset || 1)
                        setShowKonversi(editingId !== null && newSatuanVal !== konversiFrom)
                        setForm({ ...form, satuan: newSatuanVal })
                      }} className={inputCls + ' flex-1'}>
                        {(isPPF(form.kategori) ? ['Roll', 'Meter'] : satuanOptions).map(s => <option key={s}>{s}</option>)}
                      </select>
                      {!isPPF(form.kategori) && (
                        <button type="button" onClick={() => setAddingSatuan(true)}
                          className="px-3 py-2 rounded border border-brand text-brand text-sm font-bold hover:bg-brand-50 transition flex-shrink-0">+</button>
                      )}
                    </div>
                    {showKonversi && editingId && (
                      <div className="mt-2 rounded-lg border border-[#D9E3FC] bg-brand-50 p-3 space-y-2">
                        <p className="text-[11px] font-semibold text-brand">Konversi Stok</p>
                        <div className="flex items-center gap-2 text-[12px] text-[#555]">
                          <span>1 {konversiFrom}</span>
                          <span className="text-[#aaa]">=</span>
                          <input type="number" value={konversiFaktor} min={0} step="any"
                            onChange={e => setKonversiFaktor(Number(e.target.value))}
                            className="w-24 rounded border border-[#cbd5e1] px-2 py-1 text-sm text-center outline-none focus:border-brand" />
                          <span>{form.satuan}</span>
                        </div>
                        {(() => {
                          const item = barangList.find(b => b.id === editingId)
                          const stokSekarang = item ? getStok(item) : 0
                          const stokBaru = Math.round(stokSekarang * konversiFaktor * 1000) / 1000
                          return (
                            <p className="text-[11px] text-[#555]">
                              Stok saat ini <span className="font-semibold">{stokSekarang} {konversiFrom}</span> →{' '}
                              <span className="font-bold text-brand">{stokBaru} {form.satuan}</span>
                            </p>
                          )
                        })()}
                        <p className="text-[10px] text-[#93c5fd]">Stok, stok minimum & harga satuan dikonversi otomatis saat disimpan</p>
                      </div>
                    )}
                  </>
                )}
              </div>
              {/* Konversi satuan beli → satuan pakai (untuk HPP FIFO) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>
                    Isi per {form.satuan} <span className="text-[#94a3b8] font-normal">(opsional)</span>
                  </label>
                  <input
                    type="number" min="0" step="0.001"
                    value={form.isiPerUnit || ''}
                    onChange={e => setForm({ ...form, isiPerUnit: e.target.value === '' ? 0 : Number(e.target.value) })}
                    placeholder={`Contoh: 1 ${form.satuan} = ?`}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Satuan Pakai</label>
                  <select
                    value={form.satuanPakai}
                    onChange={e => setForm({ ...form, satuanPakai: e.target.value })}
                    className={inputCls}
                  >
                    <option value="">— tidak ada —</option>
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
              {form.satuanPakai && form.isiPerUnit > 0 && (
                <p className="text-[11px] text-brand bg-brand-50 rounded px-2 py-1">
                  1 {form.satuan} = {form.isiPerUnit} {form.satuanPakai} · HPP dihitung per {form.satuanPakai}
                </p>
              )}
              <div>
                <label className={labelCls}>Pemasok</label>
                <input value={form.pemasok} onChange={(e) => setForm({ ...form, pemasok: e.target.value })} placeholder="Nama pemasok" className={inputCls} />
              </div>
              {needsUkuran(form.kategori, form.satuan) && (
                <div>
                  <label className={labelCls}>
                    {isPPF(form.kategori)
                      ? <>Ukuran / Panjang PPF <span className="text-brand">(wajib diisi)</span></>
                      : <>Panjang Roll <span className="text-brand">(meter/yard/cm)</span></>
                    }
                  </label>
                  {isPPF(form.kategori) ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="number" min="0" step="0.1"
                        value={form.panjangRoll || ''}
                        onChange={e => setForm({ ...form, panjangRoll: e.target.value })}
                        placeholder="0"
                        className={inputCls + ' flex-1'}
                      />
                      <span className="text-sm font-semibold text-[#555] flex-shrink-0">meter</span>
                    </div>
                  ) : (
                    <input value={form.panjangRoll} onChange={e => setForm({ ...form, panjangRoll: e.target.value })}
                      placeholder="Contoh: 50m, 1.52m x 25m" className={inputCls} />
                  )}
                </div>
              )}
              <div>
                <label className={labelCls}>{editingId ? 'Stok Tersedia (ganti langsung)' : 'Stok Awal (opsional)'}</label>
                <input type="number" min="0" step="0.001" value={form.stokAwal || ''} onChange={(e) => setForm({ ...form, stokAwal: e.target.value === '' ? 0 : Number(e.target.value) })} className={inputCls} />
                <p className="mt-1 text-[10px] text-[#888]">
                  {editingId
                    ? 'Angka ini mengganti stok langsung. Untuk tambah/kurangi stok gunakan +Masuk / -Keluar.'
                    : 'Kosongkan jika stok akan diisi lewat Pesanan Pembelian.'}
                </p>
              </div>
              <div>
                <label className={labelCls}>Stok Minimum</label>
                <input type="number" min="0" step="0.001" value={form.stokMin || ''} onChange={(e) => setForm({ ...form, stokMin: e.target.value === '' ? 0 : Number(e.target.value) })} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Harga Satuan (Rp)</label>
                <input type="text" inputMode="numeric" value={fmtNumberInput(form.hargaSatuan)} onChange={(e) => setForm({ ...form, hargaSatuan: Number(cleanNumber(e.target.value)) })} className={inputCls} />
              </div>
            </div>
            {saveError && (
              <p className="text-sm text-[#dc2626] bg-[#fef2f2] border border-[#fecaca] rounded px-3 py-2">{saveError}</p>
            )}
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={saving} className="px-5 py-2 rounded bg-brand text-white text-sm font-semibold hover:bg-brand-600 transition disabled:opacity-40">
                {saving ? 'Menyimpan...' : editingId ? 'Simpan Perubahan' : 'Tambah Barang'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setSaveError('') }} className="px-5 py-2 rounded border border-wm-line text-sm text-[#555] hover:bg-[#f8fafc] transition">
                Batal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border border-wm-line bg-white overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-[#f1f5f9]">
          {/* Tabs */}
          <div className="flex gap-1">
            {([['stok', 'Stok'], ['masuk', 'Masuk'], ['keluar', 'Keluar']] as [Tab, string][]).map(([t, l]) => (
              <button key={t} onClick={() => setActiveTab(t)}
                className={`px-3 py-1.5 rounded text-[12px] font-medium transition ${activeTab === t ? 'bg-brand text-white' : 'border border-wm-line text-[#888] hover:border-[#cbd5e1]'}`}>
                {l}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="flex items-center gap-2 rounded border border-wm-line px-3 py-1.5 flex-1 max-w-[240px]">
            <span className="text-xs">🔍</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama / kode..." className="flex-1 text-[12px] outline-none text-[#555]" />
            {search && <button onClick={() => setSearch('')} className="text-[#aaa] hover:text-[#555]">×</button>}
          </div>

          {/* Filter kategori */}
          <select value={filterKategori} onChange={(e) => setFilterKategori(e.target.value)}
            className="rounded border border-wm-line bg-white px-3 py-1.5 text-[12px] text-[#555] outline-none focus:border-brand transition">
            <option>Semua</option>
            {kategoriOptions.map((k) => <option key={k}>{k}</option>)}
          </select>

          <div className="ml-auto flex gap-2">
            <button onClick={() => fetchData()} disabled={loading}
              className="px-3 py-2 rounded border border-wm-line text-sm text-[#555] hover:bg-[#f8fafc] transition disabled:opacity-40"
              title="Refresh data">
              {loading ? '...' : '↻'}
            </button>
            <button onClick={openAdd}
              className="px-4 py-2 rounded bg-brand text-white text-sm font-semibold hover:bg-brand-600 transition">
              + Tambah Barang
            </button>
          </div>
        </div>

        {/* Header */}
        {activeTab === 'stok' && (
          <div className="grid grid-cols-[0.6fr_1fr_1.4fr_0.8fr_0.8fr_0.8fr_0.8fr_0.8fr_1fr_1.2fr] px-5 py-2.5 bg-[#f8fafc] border-b border-[#f1f5f9]">
            {['Kode', 'Kategori', 'Nama', 'Satuan', 'Stok', 'Min', 'Status', 'Nilai', 'Pemasok', 'Aksi'].map((h) => (
              <p key={h} className="text-[11px] font-bold text-[#888]">{h}</p>
            ))}
          </div>
        )}
        {activeTab === 'masuk' && (
          <div className="grid grid-cols-[0.6fr_1.4fr_0.8fr_0.8fr_0.8fr_0.8fr_1fr_1.2fr] px-5 py-2.5 bg-[#f8fafc] border-b border-[#f1f5f9]">
            {['Kode', 'Nama', 'Satuan', 'Stok Awal', 'Masuk', 'Stok Akhir', 'Update', 'Aksi'].map((h) => (
              <p key={h} className="text-[11px] font-bold text-[#888]">{h}</p>
            ))}
          </div>
        )}
        {activeTab === 'keluar' && (
          <div className="grid grid-cols-[0.6fr_1.4fr_0.8fr_0.8fr_0.8fr_0.8fr_1fr_1.2fr] px-5 py-2.5 bg-[#f8fafc] border-b border-[#f1f5f9]">
            {['Kode', 'Nama', 'Satuan', 'Stok Awal', 'Keluar', 'Stok Akhir', 'Update', 'Aksi'].map((h) => (
              <p key={h} className="text-[11px] font-bold text-[#888]">{h}</p>
            ))}
          </div>
        )}

        {/* Rows */}
        {filtered.length === 0 ? (
          <p className="px-5 py-10 text-center text-[12px] text-[#aaa]">Tidak ada barang</p>
        ) : (
          filtered.map((b) => {
            const stok = getStok(b)
            const low = isLow(b)

            if (activeTab === 'stok') return (
              <div key={b.id} className={`grid grid-cols-[0.6fr_1fr_1.4fr_0.8fr_0.8fr_0.8fr_0.8fr_0.8fr_1fr_1.2fr] items-center px-5 py-3 border-b border-[#f1f5f9] last:border-b-0 hover:bg-[#fafbfc] ${low ? 'bg-[#fff7f7]' : ''}`}>
                <p className="text-[11px] text-[#888]">{b.kode}</p>
                <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] w-fit ${b.kategori === 'Paint Protection Film' ? 'bg-[#ede9fe] text-[#7c3aed] font-semibold' : 'bg-[#f1f5f9] text-[#555]'}`}>
                  {b.kategori === 'Paint Protection Film' ? 'PPF' : b.kategori}
                </span>
                <div>
                  <p className="text-[13px] font-semibold text-[#111]">{b.nama}</p>
                  {low && <p className="text-[10px] text-[#dc2626] font-semibold">⚠ Stok menipis</p>}
                </div>
                <div>
                  <p className="text-[12px] text-[#666]">{b.satuan}</p>
                  {b.panjangRoll && (
                    <p className={`text-[10px] font-semibold ${b.kategori === 'Paint Protection Film' ? 'text-[#7c3aed]' : 'text-brand'}`}>
                      📏 {b.panjangRoll}{b.kategori === 'Paint Protection Film' ? 'm' : ''}
                    </p>
                  )}
                </div>
                <div>
                  <p className={`text-[14px] font-bold ${low ? 'text-[#dc2626]' : 'text-[#111]'}`}>{stok.toLocaleString('id-ID', { maximumFractionDigits: 3 })}</p>
                  {smallUnitLabel(b, stok) && (
                    <p className="text-[10px] text-brand font-semibold">{smallUnitLabel(b, stok)}</p>
                  )}
                </div>
                <p className="text-[12px] text-[#888]">{b.stokMin}</p>
                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold w-fit ${low ? 'bg-[#fee2e2] text-[#dc2626]' : 'bg-[#dcfce7] text-[#16a34a]'}`}>
                  {low ? 'Menipis' : 'Aman'}
                </span>
                <p className="text-[11px] text-brand font-semibold">{fmt(stok * b.hargaSatuan)}</p>
                <p className="text-[11px] text-[#666]">{b.pemasok.split('.')[0].replace('PT', 'PT.')}</p>
                <div className="flex gap-1 items-center relative">
                  <button onClick={() => { setMutasiModal({ id: b.id, type: 'masuk', panjangRoll: b.panjangRoll }); setMutasiInputMode('roll') }}
                    className="px-2 py-1 rounded border border-brand text-[10px] text-brand hover:bg-brand-50 transition font-semibold">+Masuk</button>
                  <button onClick={() => { setMutasiModal({ id: b.id, type: 'keluar', panjangRoll: b.panjangRoll }); setMutasiInputMode('roll') }}
                    className="px-2 py-1 rounded border border-[#f59e0b] text-[10px] text-[#f59e0b] hover:bg-[#fffbeb] transition font-semibold">-Keluar</button>
                  {/* Dropdown ⋯ */}
                  <div className="relative">
                    <button
                      onClick={() => setOpenMenuId(openMenuId === b.id ? null : b.id)}
                      className="px-2 py-1 rounded border border-wm-line text-[12px] text-[#555] hover:bg-[#f1f5f9] transition leading-none"
                    >⋯</button>
                    {openMenuId === b.id && (
                      <div className="absolute right-0 top-full mt-1 bg-white border border-wm-line rounded-lg shadow-lg z-50 w-32 py-1"
                        onMouseLeave={() => setOpenMenuId(null)}>
                        <button onClick={() => { setEditStokModal({ id: b.id, nama: b.nama, stok }); setEditStokVal(stok); setOpenMenuId(null) }}
                          className="w-full text-left px-3 py-1.5 text-[12px] text-[#555] hover:bg-[#f8fafc]">Edit Stok</button>
                        <button onClick={() => { openEdit(b); setOpenMenuId(null) }}
                          className="w-full text-left px-3 py-1.5 text-[12px] text-[#555] hover:bg-[#f8fafc]">Edit Item</button>
                        <button onClick={() => { openLog(b); setOpenMenuId(null) }}
                          className="w-full text-left px-3 py-1.5 text-[12px] text-[#0891b2] hover:bg-[#f8fafc]">Log Mutasi</button>
                        <div className="border-t border-[#f1f5f9] my-1" />
                        <button onClick={() => { setDeleteConfirmId(b.id); setOpenMenuId(null) }}
                          className="w-full text-left px-3 py-1.5 text-[12px] text-[#dc2626] hover:bg-[#fef2f2]">Hapus</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )

            if (activeTab === 'masuk') return (
              <div key={b.id} className="grid grid-cols-[0.6fr_1.4fr_0.8fr_0.8fr_0.8fr_0.8fr_1fr_1.2fr] items-center px-5 py-3 border-b border-[#f1f5f9] last:border-b-0 hover:bg-[#fafbfc]">
                <p className="text-[11px] text-[#888]">{b.kode}</p>
                <p className="text-[13px] font-semibold text-[#111]">{b.nama}</p>
                <p className="text-[12px] text-[#666]">{b.satuan}</p>
                <p className="text-[13px] text-[#555]">{b.stokAwal.toLocaleString('id-ID', { maximumFractionDigits: 3 })}</p>
                <p className="text-[14px] font-bold text-brand">+{b.masuk.toLocaleString('id-ID', { maximumFractionDigits: 3 })}</p>
                <div>
                  <p className="text-[14px] font-bold text-[#111]">{stok.toLocaleString('id-ID', { maximumFractionDigits: 3 })}</p>
                  {smallUnitLabel(b, stok) && <p className="text-[10px] text-brand font-semibold">{smallUnitLabel(b, stok)}</p>}
                </div>
                <p className="text-[11px] text-[#888]">{b.terakhirUpdate}</p>
                <button onClick={() => setMutasiModal({ id: b.id, type: 'masuk' })}
                  className="w-fit px-3 py-1 rounded bg-brand text-[10px] font-semibold text-white hover:bg-brand-600 transition">+ Tambah</button>
              </div>
            )

            return (
              <div key={b.id} className="grid grid-cols-[0.6fr_1.4fr_0.8fr_0.8fr_0.8fr_0.8fr_1fr_1.2fr] items-center px-5 py-3 border-b border-[#f1f5f9] last:border-b-0 hover:bg-[#fafbfc]">
                <p className="text-[11px] text-[#888]">{b.kode}</p>
                <p className="text-[13px] font-semibold text-[#111]">{b.nama}</p>
                <p className="text-[12px] text-[#666]">{b.satuan}</p>
                <p className="text-[13px] text-[#555]">{b.stokAwal.toLocaleString('id-ID', { maximumFractionDigits: 3 })}</p>
                <p className="text-[14px] font-bold text-[#f59e0b]">-{b.keluar.toLocaleString('id-ID', { maximumFractionDigits: 3 })}</p>
                <div>
                  <p className={`text-[14px] font-bold ${low ? 'text-[#dc2626]' : 'text-[#111]'}`}>{stok.toLocaleString('id-ID', { maximumFractionDigits: 3 })}</p>
                  {smallUnitLabel(b, stok) && <p className="text-[10px] text-brand font-semibold">{smallUnitLabel(b, stok)}</p>}
                </div>
                <p className="text-[11px] text-[#888]">{b.terakhirUpdate}</p>
                <button onClick={() => setMutasiModal({ id: b.id, type: 'keluar' })}
                  className="w-fit px-3 py-1 rounded border border-[#f59e0b] text-[10px] font-semibold text-[#f59e0b] hover:bg-[#fffbeb] transition">+ Catat</button>
              </div>
            )
          })
        )}
      </div>

      {/* Low stock alert */}
      {lowStockCount > 0 && (
        <div className="rounded-lg border border-[#fecaca] bg-[#fff7f7] px-4 py-3 flex items-center gap-3">
          <span className="text-lg">⚠️</span>
          <div>
            <p className="text-[12px] font-semibold text-[#dc2626]">{lowStockCount} item stok menipis</p>
            <p className="text-[11px] text-[#888]">
              {barangList.filter(isLow).map((b) => b.nama).join(', ')}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
