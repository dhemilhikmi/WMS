import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { workshopsAPI, inventoryAPI, serviceMaterialsAPI } from '../services/api'
import { DEFAULT_KATEGORI } from '../constants/kategori'

const SATUAN_OPTIONS = ['Botol', 'Pcs', 'Set', 'Liter', 'Kg', 'Meter', 'Roll', 'Box', 'Kaleng', 'Gram']

interface Workshop { id: string; title: string; price: number; type: string; parentId?: string; notes?: string; content?: string }
interface InventoryItem { id: string; kode: string; nama: string; satuan: string; hargaSatuan: number; stok: number; notes?: string; satuanPakai?: string | null; isiPerUnit?: number | null }
interface SmallUnitCost { label: string; costPerSmall: number; factor: number; unit: string }
interface JasaItem { id: string; nama: string; harga: number }

function getSmallUnitInfo(item: InventoryItem): SmallUnitCost | null {
  const harga = item.hargaSatuan
  // Pakai isiPerUnit/satuanPakai (sistem baru) jika tersedia
  if (item.isiPerUnit && item.isiPerUnit > 0 && item.satuanPakai) {
    const cpp = harga / item.isiPerUnit
    return { label: `Rp ${Math.round(cpp).toLocaleString('id-ID')}/${item.satuanPakai}`, costPerSmall: cpp, factor: item.isiPerUnit, unit: item.satuanPakai }
  }
  // Fallback: konversi implisit lama berdasarkan satuan
  const satuan = item.satuan.toLowerCase()
  if (satuan === 'roll') {
    const panjang = Number(item.notes) || 0
    if (panjang <= 0) return null
    const cpp = harga / panjang
    return { label: `Rp ${Math.round(cpp).toLocaleString('id-ID')}/m`, costPerSmall: cpp, factor: panjang, unit: 'm' }
  }
  if (satuan === 'liter') {
    const cpp = harga / 1000
    return { label: `Rp ${Math.round(cpp).toLocaleString('id-ID')}/ml`, costPerSmall: cpp, factor: 1000, unit: 'ml' }
  }
  if (satuan === 'kg') {
    const cpp = harga / 1000
    return { label: `Rp ${Math.round(cpp).toLocaleString('id-ID')}/gr`, costPerSmall: cpp, factor: 1000, unit: 'gr' }
  }
  return null
}

function parseJasaFromContent(content: string): JasaItem[] {
  try {
    const p = JSON.parse(content)
    if (Array.isArray(p.jasaItems)) return p.jasaItems
  } catch {}
  // Backward compat: jasa:50000
  const m = content?.match(/jasa:(\d+)/)
  if (m) return [{ id: 'legacy', nama: 'Biaya Jasa', harga: Number(m[1]) }]
  return []
}

function buildJasaContent(items: JasaItem[]): string {
  return items.length > 0 ? JSON.stringify({ jasaItems: items }) : ''
}

interface BOMItem { id: string; qty: number; inventory: InventoryItem }

const fmt = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID')
const inp = 'w-full rounded border border-[#cbd5e1] bg-white px-3 py-2 text-sm text-[#111] outline-none focus:border-brand focus:ring-2 focus:ring-[#dbeafe] transition'
const cleanNum = (v: string) => v.replace(/[^\d]/g, '')
const fmtNum = (v: string | number) => { const n = Math.round(Number(cleanNum(String(v || '')))); return n > 0 ? n.toLocaleString('id-ID', { maximumFractionDigits: 0 }) : '' }

export default function ServiceBOMPage() {
  const { tenant } = useAuth()
  const [parents, setParents] = useState<Workshop[]>([])
  const [subsByParent, setSubsByParent] = useState<Record<string, Workshop[]>>({})
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [bom, setBom] = useState<BOMItem[]>([])
  const [hpp, setHpp] = useState(0)
  const [hppReal, setHppReal] = useState<number | null>(null)
  const [hppRealLoading, setHppRealLoading] = useState(false)

  // Jasa items — satu-satunya source of truth
  const [jasaItems, setJasaItems] = useState<JasaItem[]>([])
  // Draft harga per row (string mentah saat user mengetik, belum di-parse)
  const [jasaHargaDraft, setJasaHargaDraft] = useState<Record<string, string>>({})
  const [savingJasa, setSavingJasa] = useState(false)
  const [hppSaved, setHppSaved] = useState(false)
  const [addJasaNama, setAddJasaNama] = useState('')
  const [addJasaHarga, setAddJasaHarga] = useState('')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [expandedParents, setExpandedParents] = useState<string[]>([])


  // Add material to BOM form
  const [addInventoryId, setAddInventoryId] = useState('')
  const [addSelectedItem, setAddSelectedItem] = useState<InventoryItem | null>(null)
  const [addQty, setAddQty] = useState<string>('')
  const addQtyRef = useRef<HTMLInputElement>(null)

  // New material modal
  const [showNewMaterial, setShowNewMaterial] = useState(false)
  const [newMat, setNewMat] = useState({ kode: '', nama: '', kategori: DEFAULT_KATEGORI[0], satuan: 'Pcs', hargaSatuan: '', stok: '0' })
  const [savingMat, setSavingMat] = useState(false)

  const fetchBase = useCallback(async () => {
    if (!tenant?.id) return
    try {
      setLoading(true)
      const [wsRes, invRes] = await Promise.all([
        workshopsAPI.list(tenant.id),
        inventoryAPI.list(),
      ])
      const all: Workshop[] = (wsRes.data.data || []).map((w: any) => ({
        id: w.id, title: w.title, price: Number(w.price || 0), type: w.type, parentId: w.parentId, notes: w.notes || '', content: w.content || '',
      }))
      const parentList = all.filter(w => w.type === 'main_service')
      setParents(parentList)

      const entries = await Promise.all(
        parentList.map(async (p) => {
          try {
            const res = await workshopsAPI.getSubServices(p.id, tenant.id)
            const subs: Workshop[] = (res.data.data || []).map((w: any) => ({
              id: w.id, title: w.title, price: Number(w.price || 0), type: w.type, parentId: p.id,
              content: w.content || '',
            }))
            return [p.id, subs] as const
          } catch { return [p.id, []] as const }
        })
      )
      const subsMap = Object.fromEntries(entries)
      setSubsByParent(subsMap)

      setInventory((invRes.data.data || []).map((i: any) => ({
        id: i.id, kode: i.kode, nama: i.nama, satuan: i.satuan,
        hargaSatuan: Number(i.hargaSatuan), stok: i.stok, notes: i.notes || '',
        satuanPakai: i.satuanPakai || null, isiPerUnit: i.isiPerUnit ? Number(i.isiPerUnit) : null,
      })))

      setExpandedParents(parentList.map(p => p.id))

      const firstSub = entries.find(([, subs]) => subs.length > 0)
      if (firstSub && !selectedId) setSelectedId(firstSub[1][0].id)
    } catch (err) {
      console.error('Failed to fetch:', err)
    } finally {
      setLoading(false)
    }
  }, [tenant?.id])

  const fetchBOM = useCallback(async (workshopId: string) => {
    if (!workshopId) return
    try {
      const res = await serviceMaterialsAPI.list(workshopId)
      const materials = res.data.data || []
      setBom(materials)
      setHpp(materials.reduce((sum: number, item: BOMItem) => {
        const info = getSmallUnitInfo(item.inventory)
        const unitCost = info ? info.costPerSmall : Number(item.inventory.hargaSatuan || 0)
        return sum + Number(item.qty || 0) * unitCost
      }, 0))
      // Fetch HPP real dari batch FIFO
      setHppReal(null)
      setHppRealLoading(true)
      serviceMaterialsAPI.hppReal(workshopId)
        .then(r => setHppReal(r.data.hppReal ?? null))
        .catch(() => setHppReal(null))
        .finally(() => setHppRealLoading(false))
    } catch (err) {
      console.error('Failed to fetch BOM:', err)
    }
  }, [])

  useEffect(() => { fetchBase() }, [fetchBase])

  useEffect(() => {
    if (!selectedId) return
    fetchBOM(selectedId)
    workshopsAPI.get(selectedId, tenant!.id).then((res: any) => {
      const items = parseJasaFromContent(res.data.data?.content || '')
      setJasaItems(items)
      setJasaHargaDraft({})
    }).catch(() => {
      const sub = Object.values(subsByParent).flat().find(w => w.id === selectedId)
      setJasaItems(parseJasaFromContent(sub?.content || ''))
      setJasaHargaDraft({})
    })
  }, [selectedId, fetchBOM])

  const saveJasa = async (items: JasaItem[]) => {
    if (!selectedId) return
    setJasaItems(items)  // update UI langsung
    setSavingJasa(true)
    try {
      await workshopsAPI.update(selectedId, { content: buildJasaContent(items), tenantId: tenant!.id })
    } catch (err) {
      console.error('Save jasa failed:', err)
    } finally {
      setSavingJasa(false)
    }
  }

  const handleSaveHPP = async () => {
    await saveJasa(jasaItems)
    setHppSaved(true)
    setTimeout(() => setHppSaved(false), 2000)
  }

  const handleAddJasa = async () => {
    const nama = addJasaNama.trim()
    const harga = Number(addJasaHarga)
    if (!nama || harga <= 0) return
    const next = [...jasaItems, { id: Date.now().toString(), nama, harga }]
    setAddJasaNama('')
    setAddJasaHarga('')
    await saveJasa(next)
  }

  const handleDeleteJasa = async (id: string) => {
    await saveJasa(jasaItems.filter(j => j.id !== id))
  }

  const handleUpdateJasaNama = (id: string, value: string) => {
    setJasaItems(prev => prev.map(j => j.id === id ? { ...j, nama: value } : j))
  }

  const handleUpdateJasaHargaDraft = (id: string, value: string) => {
    // Simpan string mentah untuk display, jangan parse dulu
    setJasaHargaDraft(prev => ({ ...prev, [id]: cleanNum(value) }))
  }

  const handleSaveJasaRow = async (id: string) => {
    const item = jasaItems.find(j => j.id === id)
    if (!item) return
    const draft = jasaHargaDraft[id]
    // Commit draft harga ke jasaItems kalau ada
    const harga = draft !== undefined ? Number(draft) : item.harga
    if (!item.nama.trim() || harga <= 0) return
    const next = jasaItems.map(j => j.id === id ? { ...j, harga } : j)
    setJasaItems(next)
    setJasaHargaDraft(prev => { const n = { ...prev }; delete n[id]; return n })
    await saveJasa(next)
  }


  const handleAdd = async () => {
    if (!addInventoryId || !addQty || Number(addQty) <= 0) return
    setSaving(true)
    try {
      await serviceMaterialsAPI.upsert({ workshopId: selectedId, inventoryId: addInventoryId, qty: Number(addQty) })
      await fetchBOM(selectedId)
      setAddInventoryId('')
      setAddSelectedItem(null)
      setAddQty('')
    } catch (err) {
      console.error('Add BOM item failed:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateQty = async (_id: string, workshopId: string, inventoryId: string, qty: number) => {
    if (qty <= 0) return
    setSaving(true)
    try {
      await serviceMaterialsAPI.upsert({ workshopId, inventoryId, qty, mode: 'replace' })
      await fetchBOM(workshopId)
    } catch (err) {
      console.error('Update qty failed:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    setSaving(true)
    try {
      await serviceMaterialsAPI.delete(id)
      await fetchBOM(selectedId)
    } catch (err) {
      console.error('Delete BOM item failed:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleCreateMaterial = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMat.nama || !newMat.kode || !newMat.hargaSatuan) return
    setSavingMat(true)
    try {
      await inventoryAPI.create({
        kode: newMat.kode, nama: newMat.nama, kategori: newMat.kategori,
        satuan: newMat.satuan, stok: Number(newMat.stok) || 0,
        stokMin: 0, hargaSatuan: Number(newMat.hargaSatuan),
      })
      const invRes = await inventoryAPI.list()
      setInventory((invRes.data.data || []).map((i: any) => ({
        id: i.id, kode: i.kode, nama: i.nama, satuan: i.satuan,
        hargaSatuan: Number(i.hargaSatuan), stok: i.stok, notes: i.notes || '',
        satuanPakai: i.satuanPakai || null, isiPerUnit: i.isiPerUnit ? Number(i.isiPerUnit) : null,
      })))
      setShowNewMaterial(false)
      setNewMat({ kode: '', nama: '', kategori: DEFAULT_KATEGORI[0], satuan: 'Pcs', hargaSatuan: '', stok: '0' })
    } catch (err) {
      console.error('Create material failed:', err)
    } finally {
      setSavingMat(false)
    }
  }

  const allSubs = Object.values(subsByParent).flat()
  const filteredParents = parents.filter(p =>
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    (subsByParent[p.id] || []).some(s => s.title.toLowerCase().includes(search.toLowerCase()))
  )

  const selected = allSubs.find(w => w.id === selectedId)
  const jasaNum = jasaItems.reduce((sum, j) => sum + j.harga, 0)
  const totalHPP = hpp + jasaNum
  const margin = selected ? selected.price - totalHPP : 0
  const marginPct = selected && selected.price > 0 ? (margin / selected.price) * 100 : 0

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <p className="text-[13px] text-[#aaa]">Memuat data...</p>
    </div>
  )

  return (
    <div className="flex h-[calc(100vh-56px)]">

      {/* Modal tambah material baru */}
      {showNewMaterial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-wm-line bg-white p-6 shadow-xl">
            <h3 className="text-base font-bold text-[#111] mb-4">Tambah Material Baru</h3>
            <form onSubmit={handleCreateMaterial} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#555] mb-1">Kode *</label>
                  <input required value={newMat.kode} onChange={e => setNewMat(m => ({ ...m, kode: e.target.value }))}
                    placeholder="BHN-001" className={inp} />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#555] mb-1">Nama *</label>
                  <input required value={newMat.nama} onChange={e => setNewMat(m => ({ ...m, nama: e.target.value }))}
                    placeholder="Nama material" className={inp} />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#555] mb-1">Kategori</label>
                  <select value={newMat.kategori} onChange={e => setNewMat(m => ({ ...m, kategori: e.target.value }))} className={inp}>
                    {DEFAULT_KATEGORI.map(k => <option key={k}>{k}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#555] mb-1">Satuan</label>
                  <select value={newMat.satuan} onChange={e => setNewMat(m => ({ ...m, satuan: e.target.value }))} className={inp}>
                    {SATUAN_OPTIONS.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#555] mb-1">Harga Satuan (Rp) *</label>
                  <input required type="number" min={0} value={newMat.hargaSatuan}
                    onChange={e => setNewMat(m => ({ ...m, hargaSatuan: e.target.value }))}
                    placeholder="0" className={inp} />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#555] mb-1">Stok Awal</label>
                  <input type="number" min={0} value={newMat.stok}
                    onChange={e => setNewMat(m => ({ ...m, stok: e.target.value }))}
                    placeholder="0" className={inp} />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={savingMat}
                  className="flex-1 rounded bg-brand py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-40 transition">
                  {savingMat ? 'Menyimpan...' : 'Simpan Material'}
                </button>
                <button type="button" onClick={() => setShowNewMaterial(false)}
                  className="flex-1 rounded border border-wm-line py-2 text-sm text-[#555] hover:bg-[#f8fafc] transition">
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Left — service tree */}
      <div className="w-[340px] flex-shrink-0 border-r border-wm-line bg-white flex flex-col">
        <div className="p-4 border-b border-[#f1f5f9]">
          <h2 className="text-sm font-bold text-[#111] mb-3">Setup HPP</h2>
          <div className="flex items-center gap-2 rounded border border-wm-line px-3 py-1.5">
            <span className="text-xs">🔍</span>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Cari layanan..." className="flex-1 text-[12px] outline-none text-[#555]" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredParents.length === 0 ? (
            <p className="px-4 py-6 text-center text-[12px] text-[#aaa]">Belum ada layanan</p>
          ) : filteredParents.map(parent => {
            const subs = subsByParent[parent.id] || []
            const isExpanded = expandedParents.includes(parent.id)
            return (
              <div key={parent.id} className="border-b border-[#f1f5f9]">
                <div className="flex items-center justify-between px-3 py-2.5 bg-[#f8fafc]">
                  <button
                    onClick={() => setExpandedParents(prev =>
                      prev.includes(parent.id) ? prev.filter(x => x !== parent.id) : [...prev, parent.id]
                    )}
                    className="flex items-center gap-2 flex-1 text-left min-w-0">
                    <span className="text-[14px] flex-shrink-0">{isExpanded ? '📂' : '📁'}</span>
                    <div className="min-w-0">
                      <p className="text-[12px] font-bold text-[#333] truncate">{parent.title}</p>
                      <p className="text-[10px] text-[#aaa]">{subs.length} sub-layanan</p>
                    </div>
                  </button>
                </div>


                {isExpanded && (
                  <div className="relative ml-3 pl-3 border-l-2 border-wm-line">
                    {subs.map((sub) => (
                      <button key={sub.id} onClick={() => { setHppReal(null); setSelectedId(sub.id) }}
                        className={`relative w-full text-left pl-4 pr-3 py-2.5 transition
                          before:absolute before:left-0 before:top-1/2 before:w-3 before:h-px before:bg-[#e2e8f0] before:content-['']
                          ${selectedId === sub.id ? 'bg-brand-50' : 'hover:bg-[#f8fafc]'}`}>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] flex-shrink-0">{selectedId === sub.id ? '▶' : '◦'}</span>
                          <div className="min-w-0">
                            <p className={`text-[12px] font-semibold truncate ${selectedId === sub.id ? 'text-brand' : 'text-[#111]'}`}>
                              {sub.title}
                            </p>
                            <p className="text-[10px] text-[#aaa]">{fmt(sub.price)}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                    {subs.length === 0 && (
                      <p className="pl-4 py-2 text-[11px] text-[#aaa] italic">Belum ada sub-layanan</p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Right — BOM editor */}
      <div className="flex-1 overflow-y-auto p-6 bg-[#f8fafc]">
        {!selected ? (
          <p className="text-[13px] text-[#aaa]">Pilih sub-layanan untuk setup HPP</p>
        ) : (
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-base font-bold text-[#111]">{selected.title}</h1>
                <p className="text-[12px] text-[#888] mt-0.5">
                  Harga jual: <span className="font-semibold text-brand">{fmt(selected.price)}</span>
                </p>
              </div>
              <button
                onClick={handleSaveHPP}
                disabled={savingJasa}
                className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-semibold transition disabled:opacity-40 ${hppSaved ? 'bg-[#dcfce7] text-[#16a34a] border border-[#bbf7d0]' : 'bg-brand text-white hover:bg-brand-600'}`}>
                {hppSaved ? '✓ Tersimpan' : 'Simpan HPP'}
              </button>
            </div>

            {/* Total HPP — center */}
            <div className="rounded-xl border-2 border-[#fde68a] bg-[#fffbeb] py-5 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-[#888] mb-1">Total HPP Estimasi</p>
              <p className="text-4xl font-black text-[#f59e0b]">{fmt(totalHPP)}</p>
              <p className="text-[10px] text-[#b45309] mt-1.5">berdasarkan harga beli terakhir · HPP real dihitung saat servis selesai (FIFO)</p>
            </div>

            {/* HPP Summary */}
            <div className="grid grid-cols-4 gap-3">
              <div className="rounded-lg border border-wm-line bg-white p-4">
                <p className="text-[11px] text-[#888]">HPP Material <span className="text-[#94a3b8] font-normal">(estimasi)</span></p>
                <p className="text-xl font-bold text-[#f59e0b] mt-1">{fmt(hpp)}</p>
                <p className="text-[10px] text-[#bbb] mt-1">Σ material × harga beli terakhir</p>
                {hppRealLoading && <p className="text-[10px] text-[#94a3b8] mt-1.5">Menghitung HPP FIFO...</p>}
                {!hppRealLoading && hppReal !== null && (() => {
                  const diff = Math.abs(hppReal - hpp)
                  const pct = hpp > 0 ? (diff / hpp) * 100 : 0
                  const diverged = pct > 5
                  return (
                    <div className={`mt-1.5 rounded px-2 py-1 text-[10px] font-semibold ${diverged ? 'bg-[#fef3c7] text-[#b45309]' : 'bg-[#f0fdf4] text-[#15803d]'}`}>
                      {diverged ? '⚠ ' : '✓ '}HPP FIFO: {fmt(hppReal)}
                      {diverged && <span className="font-normal"> ({pct.toFixed(0)}% beda)</span>}
                    </div>
                  )
                })()}
              </div>
              <div className="rounded-lg border border-wm-line bg-white p-4">
                <p className="text-[11px] text-[#888]">Biaya Jasa</p>
                <p className="text-xl font-bold text-brand mt-1">
                  {jasaNum > 0 ? fmt(jasaNum) : '—'}
                </p>
                <p className="text-[10px] text-[#bbb] mt-1">
                  {jasaItems.length > 0 ? `${jasaItems.length} item ongkos tenaga` : 'Upah / ongkos tenaga'}
                </p>
              </div>
              <div className="rounded-lg border border-wm-line bg-white p-4">
                <p className="text-[11px] text-[#888]">Laba Kotor</p>
                <p className={`text-xl font-bold mt-1 ${margin >= 0 ? 'text-[#16a34a]' : 'text-[#dc2626]'}`}>
                  {fmt(margin)}
                </p>
                <p className="text-[10px] text-[#bbb] mt-1">
                  {fmt(selected?.price ?? 0)} − {fmt(totalHPP)}
                </p>
              </div>
              <div className="rounded-lg border border-wm-line bg-white p-4">
                <p className="text-[11px] text-[#888]">Margin</p>
                <p className={`text-xl font-bold mt-1 ${marginPct >= 30 ? 'text-[#16a34a]' : marginPct >= 10 ? 'text-[#f59e0b]' : 'text-[#dc2626]'}`}>
                  {totalHPP === 0 ? '—' : `${marginPct.toFixed(1)}%`}
                </p>
                <p className="text-[10px] text-[#bbb] mt-1">Laba ÷ Harga Jual</p>
              </div>
            </div>

            {/* BOM Table */}
            <div className="rounded-lg border border-wm-line bg-white overflow-visible">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#f1f5f9]">
                <p className="text-sm font-bold text-[#111]">Daftar Material ({bom.length})</p>
                <p className="text-[11px] text-[#aaa]">Material yang dipakai per 1x layanan</p>
              </div>

              {/* Header kolom */}
              <div className="grid grid-cols-[2fr_0.8fr_1fr_1.2fr_1.2fr_0.4fr] px-4 py-2 bg-[#f8fafc] border-b border-[#f1f5f9]">
                {['Material', 'Satuan', 'Jumlah Digunakan', 'Cost/Unit Kecil', 'Total HPP', ''].map(h => (
                  <div key={h}>
                    <p className="text-[11px] font-bold text-[#888]">{h}</p>
                    {h === 'Cost/Unit Kecil' && (
                      <p className="text-[9px] text-[#bbb] mt-0.5">harga beli terakhir (estimasi)</p>
                    )}
                  </div>
                ))}
              </div>

              {bom.length === 0 ? (
                <p className="px-4 py-6 text-center text-[12px] text-[#aaa]">
                  Belum ada material. Tambah di bawah.
                </p>
              ) : bom.map(item => {
                const small = getSmallUnitInfo(item.inventory)
                const jumlahDisplay = small
                  ? `${Number(item.qty).toLocaleString('id-ID')} ${small.unit}`
                  : `${item.qty} ${item.inventory.satuan}`

                return (
                  <div key={item.id} className="grid grid-cols-[2fr_0.8fr_1fr_1.2fr_1.2fr_0.4fr] items-center px-4 py-3 border-b border-[#f1f5f9] last:border-b-0">
                    <div>
                      <p className="text-[13px] font-semibold text-[#111]">{item.inventory.nama}</p>
                      <p className="text-[10px] text-[#aaa]">{item.inventory.kode} · stok: {item.inventory.stok}</p>
                    </div>
                    <p className="text-[12px] text-[#555]">{item.inventory.satuan}</p>
                    <div>
                      <input
                        type="number" min="0" step="0.01"
                        defaultValue={(() => {
                          return item.qty
                        })()}
                        key={item.id + item.qty}
                        onBlur={e => {
                          const v = Number(e.target.value)
                          if (v <= 0) return
                          handleUpdateQty(item.id, selectedId, item.inventory.id, v)
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            ;(e.target as HTMLInputElement).blur()
                          }
                        }}
                        className="w-20 rounded border border-wm-line px-2 py-1 text-[12px] text-center outline-none focus:border-brand peer"
                      />
                      <p className="text-[9px] text-[#94a3b8] mt-0.5 hidden peer-focus:block">↵ Enter / klik luar</p>
                      {small && <p className="text-[10px] text-[#aaa] mt-0.5">{jumlahDisplay}</p>}
                    </div>
                    <div>
                      {small ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-md bg-brand-50 border border-[#D9E3FC]">
                          <span className="text-[11px] font-bold text-brand">{small.label}</span>
                        </span>
                      ) : (
                        <span className="text-[11px] text-[#ddd]">—</span>
                      )}
                    </div>
                    <p className="text-[13px] font-bold text-[#f59e0b]">
                      {(() => {
                        const info = getSmallUnitInfo(item.inventory)
                        return info
                          ? fmt(item.qty * info.costPerSmall)
                          : fmt(item.qty * item.inventory.hargaSatuan)
                      })()}
                    </p>
                    <button onClick={() => handleDelete(item.id)} disabled={saving}
                      className="text-[#ccc] hover:text-[#ef4444] text-sm transition">×</button>
                  </div>
                )
              })}

              {/* Add material inline row */}
              <div className="grid grid-cols-[2fr_0.8fr_1fr_1.2fr_1.2fr_0.4fr] items-center px-4 py-3 bg-[#f8fafc] border-t border-wm-line gap-2">
                <select
                  value={addInventoryId}
                  onChange={e => {
                    const item = inventory.find(i => i.id === e.target.value) || null
                    setAddInventoryId(e.target.value)
                    setAddSelectedItem(item)
                    if (e.target.value) setTimeout(() => addQtyRef.current?.focus(), 50)
                  }}
                  className={inp}
                >
                  <option value="">— Pilih material —</option>
                  {inventory.map(i => {
                    const inBom = bom.some(b => b.inventory.id === i.id)
                    return (
                      <option key={i.id} value={i.id}>
                        {inBom ? '✓ ' : ''}{i.nama} ({i.satuan}){inBom ? ' — sudah ada, qty akan ditambah' : ''}
                      </option>
                    )
                  })}
                </select>
                <div className={`${inp} bg-[#f1f5f9] text-[#888] text-center text-[12px]`}>
                  {addSelectedItem ? (() => {
                    if (addSelectedItem.isiPerUnit && addSelectedItem.isiPerUnit > 0 && addSelectedItem.satuanPakai) {
                      return `${addSelectedItem.satuanPakai} (1 ${addSelectedItem.satuan} = ${addSelectedItem.isiPerUnit} ${addSelectedItem.satuanPakai})`
                    }
                    const s = addSelectedItem.satuan.toLowerCase()
                    if (s === 'liter') return 'ml'
                    if (s === 'kg') return 'Gram'
                    return addSelectedItem.satuan
                  })() : '—'}
                </div>
                <input
                  ref={addQtyRef}
                  type="number" min="0" step="0.01"
                  value={addQty}
                  onChange={e => setAddQty(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && addInventoryId && Number(addQty) > 0) handleAdd() }}
                  placeholder="Jumlah..."
                  className={inp + ' text-center'}
                />
                {addQty && Number(addQty) > 0 && addInventoryId && (
                  <p className="text-[10px] text-[#64748b] mt-0.5 text-center">↵ Enter untuk simpan</p>
                )}
                <div className={`${inp} bg-brand-50 border-[#D9E3FC] text-right`}>
                  {addSelectedItem ? (() => {
                    const small = getSmallUnitInfo(addSelectedItem)
                    return small
                      ? <span className="text-[11px] font-bold text-brand">{small.label}</span>
                      : <span className="text-[11px] text-[#aaa]">—</span>
                  })() : <span className="text-[11px] text-[#aaa]">—</span>}
                </div>
                <div className={`${inp} bg-[#fffbeb] text-[#f59e0b] font-bold text-right text-[12px]`}>
                  {addSelectedItem && addQty ? (() => {
                    const info = getSmallUnitInfo(addSelectedItem)
                    const q = Number(addQty)
                    return fmt(info ? q * info.costPerSmall : q * addSelectedItem.hargaSatuan)
                  })() : '—'}
                </div>
                <button onClick={handleAdd} disabled={!addInventoryId || !addQty || Number(addQty) <= 0 || saving}
                  className="text-brand hover:text-[#1A45BF] disabled:opacity-30 text-lg font-bold transition"
                  title="Tambah">
                  ＋
                </button>
              </div>

              {/* Biaya Jasa section */}
              <div className="border-t-2 border-dashed border-[#D9E3FC]">
                {/* Section header */}
                <div className="flex items-center justify-between px-4 py-2 bg-brand-50">
                  <div className="flex items-center gap-2">
                    <p className="text-[11px] font-bold text-brand uppercase tracking-wide">Biaya Jasa</p>
                    <p className="text-[10px] text-[#93c5fd]">Upah / ongkos tenaga kerja</p>
                  </div>
                  {jasaItems.length > 0 && (
                    <p className="text-[11px] font-bold text-brand">{fmt(jasaNum)}</p>
                  )}
                </div>

                {/* Existing jasa rows */}
                {jasaItems.map(j => (
                  <div key={j.id} className="grid grid-cols-[2fr_0.8fr_1fr_1.2fr_1.2fr_0.4fr] items-center px-4 py-2.5 bg-[#f8fbff] border-t border-[#dbeafe] gap-2">
                    <input
                      type="text"
                      value={j.nama}
                      onChange={e => handleUpdateJasaNama(j.id, e.target.value)}
                      onBlur={() => handleSaveJasaRow(j.id)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSaveJasaRow(j.id) } }}
                      className="w-full rounded border border-[#D9E3FC] px-2 py-1 text-[13px] font-semibold text-[#111] outline-none focus:border-brand bg-white"
                    />
                    <p className="text-[12px] text-[#aaa]">—</p>
                    <p className="text-[12px] text-[#aaa]">1x</p>
                    <p className="text-[12px] text-[#aaa]">—</p>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={jasaHargaDraft[j.id] !== undefined ? fmtNum(jasaHargaDraft[j.id]) : fmtNum(j.harga)}
                      onChange={e => handleUpdateJasaHargaDraft(j.id, e.target.value)}
                      onBlur={() => handleSaveJasaRow(j.id)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSaveJasaRow(j.id) } }}
                      className="w-full rounded border border-[#D9E3FC] px-2 py-1 text-[12px] font-bold text-[#111] outline-none focus:border-brand bg-white text-right"
                    />
                    <button onClick={() => handleDeleteJasa(j.id)} disabled={savingJasa}
                      className="text-[#ccc] hover:text-[#ef4444] text-sm transition disabled:opacity-40">×</button>
                  </div>
                ))}

                {/* Add jasa inline row */}
                <div className="flex items-center gap-2 px-4 py-2.5 bg-[#f8fbff] border-t border-[#dbeafe]">
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] font-semibold text-[#93c5fd] mb-0.5 uppercase tracking-wide">Nama Jasa</p>
                    <input
                      type="text"
                      value={addJasaNama}
                      onChange={e => setAddJasaNama(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddJasa() } }}
                      placeholder="mis. Ongkos pasang, Biaya tenaga"
                      className="w-full rounded border border-[#D9E3FC] px-2 py-1.5 text-[12px] font-semibold text-[#111] outline-none focus:border-brand bg-white placeholder:text-[#bbb] placeholder:font-normal"
                    />
                  </div>
                  <div className="w-36 flex-shrink-0">
                    <p className="text-[9px] font-semibold text-[#93c5fd] mb-0.5 uppercase tracking-wide">Harga (Rp)</p>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={fmtNum(addJasaHarga)}
                      onChange={e => setAddJasaHarga(cleanNum(e.target.value))}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddJasa() } }}
                      placeholder="0"
                      className="w-full rounded border border-[#D9E3FC] px-2 py-1.5 text-[12px] font-bold text-[#111] outline-none focus:border-brand bg-white text-right placeholder:text-[#bbb] placeholder:font-normal"
                    />
                  </div>
                  <div className="flex-shrink-0 pt-4">
                    <button
                      type="button"
                      onClick={handleAddJasa}
                      disabled={!addJasaNama.trim() || !addJasaHarga || Number(addJasaHarga) <= 0 || savingJasa}
                      className="text-brand hover:text-[#1A45BF] disabled:opacity-30 text-lg font-bold transition"
                      title="Tambah jasa">
                      {savingJasa ? '…' : '＋'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Info */}
            <div className="rounded-lg border border-[#dbeafe] bg-brand-50 px-4 py-3">
              <p className="text-[12px] text-brand">
                💡 Saat layanan ditandai <strong>Selesai</strong>, stok material akan otomatis berkurang sesuai BOM, dan HPP dicatat di laporan pendapatan.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
