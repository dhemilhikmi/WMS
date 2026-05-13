import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_KATEGORI } from '../../constants/kategori'
import { useAuth } from '../../context/AuthContext'
import { inventoryAPI, serviceMaterialsAPI, workshopsAPI } from '../../services/api'
import { MobileSubHeader } from '../MobileLayout'

const SATUAN_OPTIONS = ['Botol', 'Pcs', 'Set', 'Liter', 'Kg', 'Meter', 'Roll', 'Box', 'Kaleng', 'Gram']

interface Workshop { id: string; title: string; price: number; type?: string; parentId?: string; content?: string }
interface InventoryItem { id: string; kode: string; nama: string; satuan: string; hargaSatuan: number; stok: number; notes?: string; satuanPakai?: string | null; isiPerUnit?: number | null }
interface BomItem { id: string; qty: number; workshopId: string; inventoryId: string; inventory: InventoryItem }
interface JasaItem { id: string; nama: string; harga: number }

const fmt = (n: number) => 'Rp ' + Math.round(n || 0).toLocaleString('id-ID')
const inputCls = 'w-full bg-wm-bg border border-wm-line rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-[#1E4FD8] focus:bg-white'

function parseJasaFromContent(content?: string): JasaItem[] {
  try {
    const parsed = JSON.parse(content || '')
    if (Array.isArray(parsed.jasaItems)) return parsed.jasaItems
  } catch {}
  const legacy = content?.match(/jasa:(\d+)/)
  return legacy ? [{ id: 'legacy', nama: 'Biaya Jasa', harga: Number(legacy[1]) }] : []
}

function buildJasaContent(items: JasaItem[]) {
  return items.length > 0 ? JSON.stringify({ jasaItems: items }) : ''
}

function getSmallUnitInfo(item?: InventoryItem | null) {
  if (!item) return null
  // Pakai isiPerUnit/satuanPakai (sistem baru) jika tersedia
  if (item.isiPerUnit && item.isiPerUnit > 0 && item.satuanPakai) {
    return { factor: item.isiPerUnit, unit: item.satuanPakai, label: `${item.satuanPakai}, 1 ${item.satuan} = ${item.isiPerUnit} ${item.satuanPakai}` }
  }
  // Fallback: konversi implisit lama
  const satuan = item.satuan.toLowerCase()
  if (satuan === 'roll') {
    const factor = Number(item.notes) || 0
    if (factor <= 0) return null
    return { factor, unit: 'm', label: `meter, 1 roll = ${factor} m` }
  }
  if (satuan === 'liter') return { factor: 1000, unit: 'ml', label: 'ml' }
  if (satuan === 'kg') return { factor: 1000, unit: 'gr', label: 'gram' }
  return null
}

function displayQty(item: BomItem) {
  return Number(item.qty || 0)
}

function itemCost(item: BomItem) {
  const info = getSmallUnitInfo(item.inventory)
  const unitCost = info ? Number(item.inventory?.hargaSatuan || 0) / info.factor : Number(item.inventory?.hargaSatuan || 0)
  return Number(item.qty || 0) * unitCost
}

export default function MobileServiceBOM() {
  const { tenant } = useAuth()
  const [parents, setParents] = useState<Workshop[]>([])
  const [subsByParent, setSubsByParent] = useState<Record<string, Workshop[]>>({})
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [activePanel, setActivePanel] = useState<'services' | 'setup'>('services')
  const [search, setSearch] = useState('')
  const [bom, setBom] = useState<BomItem[]>([])
  const [hpp, setHpp] = useState(0)
  const [hppReal, setHppReal] = useState<number | null>(null)
  const [hppRealLoading, setHppRealLoading] = useState(false)
  const [jasaItems, setJasaItems] = useState<JasaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const [addInventoryId, setAddInventoryId] = useState('')
  const [addQty, setAddQty] = useState('')
  const addQtyRef = useRef<HTMLInputElement>(null)
  const [addJasaNama, setAddJasaNama] = useState('')
  const [addJasaHarga, setAddJasaHarga] = useState('')
  const [showNewMaterial, setShowNewMaterial] = useState(false)
  const [newMat, setNewMat] = useState({ kode: '', nama: '', kategori: DEFAULT_KATEGORI[0], satuan: 'Pcs', hargaSatuan: '', stok: '0' })

  const allSubs = useMemo(() => Object.values(subsByParent).flat(), [subsByParent])
  const selected = allSubs.find(s => s.id === selectedId)
  const selectedInventory = inventory.find(i => i.id === addInventoryId)
  const smallInfo = getSmallUnitInfo(selectedInventory)
  const jasaTotal = jasaItems.reduce((s, j) => s + Number(j.harga || 0), 0)
  const totalHpp = hpp + jasaTotal
  const margin = selected ? selected.price - totalHpp : 0
  const marginPct = selected && selected.price > 0 ? (margin / selected.price) * 100 : 0

  const fetchBase = useCallback(async () => {
    if (!tenant?.id) return
    setLoading(true)
    try {
      const [wsRes, invRes] = await Promise.all([workshopsAPI.list(tenant.id), inventoryAPI.list()])
      const all = (wsRes.data.data || []).map((w: any) => ({
        id: w.id,
        title: w.title,
        price: Number(w.price || 0),
        type: w.type,
        parentId: w.parentId,
        content: w.content || '',
      }))
      const parentList = all.filter((w: Workshop) => w.type === 'main_service')
      const subsMap: Record<string, Workshop[]> = {}
      parentList.forEach((p: Workshop) => {
        subsMap[p.id] = all.filter((w: Workshop) => w.parentId === p.id || (w.type === 'sub_service' && w.parentId === p.id))
      })
      setParents(parentList)
      setSubsByParent(subsMap)
      setInventory((invRes.data.data || []).map((i: any) => ({
        id: i.id,
        kode: i.kode,
        nama: i.nama,
        satuan: i.satuan,
        hargaSatuan: Number(i.hargaSatuan || 0),
        stok: Number(i.stok || 0),
        notes: i.notes || '',
        satuanPakai: i.satuanPakai || null,
        isiPerUnit: i.isiPerUnit ? Number(i.isiPerUnit) : null,
      })))
      const firstParent = parentList[0]
      setExpandedId(prev => prev ?? firstParent?.id ?? null)
      const firstSub = Object.values(subsMap).flat()[0]
      setSelectedId(prev => prev || firstSub?.id || '')
    } finally {
      setLoading(false)
    }
  }, [tenant?.id])

  const fetchBom = useCallback(async (workshopId: string) => {
    if (!workshopId) return
    const res = await serviceMaterialsAPI.list(workshopId)
    const materials = res.data.data || []
    setBom(materials)
    setHpp(materials.reduce((sum: number, item: BomItem) => sum + itemCost(item), 0))
    setHppReal(null)
    setHppRealLoading(true)
    serviceMaterialsAPI.hppReal(workshopId)
      .then(r => setHppReal(r.data.hppReal ?? null))
      .catch(() => setHppReal(null))
      .finally(() => setHppRealLoading(false))
  }, [])

  useEffect(() => { fetchBase() }, [fetchBase])
  useEffect(() => {
    if (!selectedId) return
    fetchBom(selectedId).catch(() => {})
    const sub = allSubs.find(s => s.id === selectedId)
    setJasaItems(parseJasaFromContent(sub?.content))
  }, [selectedId, allSubs, fetchBom])

  const filteredParents = parents.filter(p => {
    const q = search.toLowerCase()
    if (!q) return true
    return p.title.toLowerCase().includes(q) || (subsByParent[p.id] || []).some(s => s.title.toLowerCase().includes(q))
  })

  const persistJasa = async (items: JasaItem[]) => {
    if (!selectedId || !tenant?.id) return
    const content = buildJasaContent(items)
    await workshopsAPI.update(selectedId, { content, tenantId: tenant.id })
    setJasaItems(items)
    setSubsByParent(prev => {
      const next = { ...prev }
      Object.keys(next).forEach(pid => {
        next[pid] = next[pid].map(s => s.id === selectedId ? { ...s, content } : s)
      })
      return next
    })
  }

  const addMaterial = async () => {
    if (!selectedId || !addInventoryId || !addQty || Number(addQty) <= 0) return
    setSaving(true)
    setMsg('')
    try {
      await serviceMaterialsAPI.upsert({ workshopId: selectedId, inventoryId: addInventoryId, qty: Number(addQty) })
      await fetchBom(selectedId)
      setAddInventoryId('')
      setAddQty('')
    } catch (e: any) {
      setMsg(e.response?.data?.message || 'Gagal menambah material')
    } finally {
      setSaving(false)
    }
  }

  const updateQty = async (item: BomItem, qty: number) => {
    if (!selectedId || qty <= 0) return
    setSaving(true)
    try {
      await serviceMaterialsAPI.upsert({ workshopId: selectedId, inventoryId: item.inventoryId, qty, mode: 'replace' })
      await fetchBom(selectedId)
    } finally {
      setSaving(false)
    }
  }

  const deleteBom = async (id: string) => {
    if (!selectedId) return
    setSaving(true)
    try {
      await serviceMaterialsAPI.delete(id)
      await fetchBom(selectedId)
    } finally {
      setSaving(false)
    }
  }

  const addJasa = async () => {
    if (!addJasaNama.trim() || !addJasaHarga || Number(addJasaHarga) <= 0) return
    setSaving(true)
    try {
      await persistJasa([...jasaItems, { id: Date.now().toString(), nama: addJasaNama.trim(), harga: Number(addJasaHarga) }])
      setAddJasaNama('')
      setAddJasaHarga('')
    } finally {
      setSaving(false)
    }
  }

  const deleteJasa = async (id: string) => {
    setSaving(true)
    try {
      await persistJasa(jasaItems.filter(j => j.id !== id))
    } finally {
      setSaving(false)
    }
  }

  const createMaterial = async () => {
    if (!newMat.kode || !newMat.nama || !newMat.hargaSatuan) return
    setSaving(true)
    try {
      await inventoryAPI.create({
        kode: newMat.kode,
        nama: newMat.nama,
        kategori: newMat.kategori,
        satuan: newMat.satuan,
        stok: Number(newMat.stok || 0),
        stokMin: 0,
        hargaSatuan: Number(newMat.hargaSatuan || 0),
      })
      const invRes = await inventoryAPI.list()
      setInventory((invRes.data.data || []).map((i: any) => ({
        id: i.id,
        kode: i.kode,
        nama: i.nama,
        satuan: i.satuan,
        hargaSatuan: Number(i.hargaSatuan || 0),
        stok: Number(i.stok || 0),
        notes: i.notes || '',
        satuanPakai: i.satuanPakai || null,
        isiPerUnit: i.isiPerUnit ? Number(i.isiPerUnit) : null,
      })))
      setShowNewMaterial(false)
      setNewMat({ kode: '', nama: '', kategori: DEFAULT_KATEGORI[0], satuan: 'Pcs', hargaSatuan: '', stok: '0' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <MobileSubHeader title="Setup HPP" subtitle={selected ? selected.title : 'Pilih paket layanan'} />
      <div className="px-4 pt-3 pb-4 space-y-3">
        {loading ? (
          <p className="text-center text-[12px] text-ink-4 py-6">Memuat...</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 bg-white border border-wm-line rounded-2xl p-1">
              <button
                onClick={() => setActivePanel('services')}
                className={`text-[12px] font-semibold py-2 rounded-xl ${activePanel === 'services' ? 'bg-brand text-white' : 'text-ink-3'}`}
              >
                Layanan
              </button>
              <button
                onClick={() => setActivePanel('setup')}
                disabled={!selected}
                className={`text-[12px] font-semibold py-2 rounded-xl disabled:opacity-40 ${activePanel === 'setup' ? 'bg-brand text-white' : 'text-ink-3'}`}
              >
                Setup HPP
              </button>
            </div>

            {activePanel === 'services' && (
              <section className="bg-white rounded-2xl border border-wm-line overflow-hidden">
                <div className="p-4 border-b border-[#f1f5f9]">
                  <p className="text-[13px] font-bold text-ink mb-3">Pilih Layanan</p>
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari kategori / paket..." className={inputCls} />
                </div>
                <div className="max-h-[62vh] overflow-y-auto">
                  {filteredParents.length === 0 ? (
                    <p className="text-center text-[12px] text-ink-4 py-8">Belum ada layanan</p>
                  ) : filteredParents.map(parent => {
                    const subs = subsByParent[parent.id] || []
                    const open = expandedId === parent.id
                    return (
                      <div key={parent.id} className="border-b border-[#f1f5f9] last:border-b-0">
                        <button onClick={() => setExpandedId(open ? null : parent.id)} className="w-full px-3.5 py-3 flex items-center justify-between text-left bg-wm-bg">
                          <div className="min-w-0">
                            <p className="text-[13px] font-bold text-ink truncate">{parent.title}</p>
                            <p className="text-[10px] text-ink-4">{subs.length} paket</p>
                          </div>
                          <span className="text-[16px] font-bold text-brand">{open ? '-' : '+'}</span>
                        </button>
                        {open && (
                          <div className="p-2 space-y-1.5 bg-white">
                            {subs.length === 0 ? <p className="text-[11px] text-ink-4 text-center py-2">Belum ada paket.</p> : subs.map(s => (
                              <button
                                key={s.id}
                                onClick={() => { setSelectedId(s.id); setActivePanel('setup') }}
                                className="w-full rounded-xl border border-wm-line bg-white px-3 py-2 text-left"
                              >
                                <p className="text-[12px] font-bold text-ink truncate">{s.title}</p>
                                <p className="text-[10px] text-ink-3">{fmt(s.price)}</p>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {activePanel === 'setup' && selected ? (
              <>
                <section className="bg-white rounded-2xl border border-wm-line p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] text-ink-3">Paket dipilih</p>
                      <p className="text-[15px] font-bold text-ink truncate">{selected.title}</p>
                      <p className="text-[11px] text-brand font-semibold mt-0.5">{fmt(selected.price)}</p>
                    </div>
                    <button onClick={() => setActivePanel('services')} className="px-3 py-2 rounded-xl bg-brand-50 text-brand text-[12px] font-semibold flex-shrink-0">
                      Ganti
                    </button>
                  </div>
                </section>

                <div className="grid grid-cols-2 gap-3">
                  <Stat label="Harga Paket" value={fmt(selected.price)} color="#1E4FD8" />
                  <Stat label="Total HPP" value={fmt(totalHpp)} color="#f97316" />
                  <Stat label="Margin" value={fmt(margin)} color={margin >= 0 ? '#16a34a' : '#dc2626'} />
                  <Stat label="Margin %" value={`${marginPct.toFixed(1)}%`} color={marginPct >= 20 ? '#16a34a' : marginPct >= 10 ? '#f59e0b' : '#dc2626'} />
                </div>
                {(hppRealLoading || hppReal !== null) && (
                  <div className={`rounded-xl border px-3 py-2 text-[12px] ${hppReal !== null && Math.abs(hppReal - hpp) / Math.max(hpp, 1) >= 0.05 ? 'border-[#fde68a] bg-[#fffbeb] text-[#92400e]' : 'border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]'}`}>
                    {hppRealLoading
                      ? <span className="text-ink-4">Menghitung HPP FIFO...</span>
                      : hppReal !== null && (() => {
                          const diff = Math.abs(hppReal - hpp)
                          const diverged = hpp > 0 && diff / hpp >= 0.05
                          return <span className="font-semibold">{diverged ? '⚠ ' : '✓ '}HPP FIFO: {fmt(hppReal)}{diverged ? ` (${Math.round(diff / hpp * 100)}% beda dari estimasi)` : ''}</span>
                        })()
                    }
                  </div>
                )}

                <section className="bg-white rounded-2xl border border-wm-line p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[13px] font-bold">Material HPP</p>
                    <button onClick={() => setShowNewMaterial(true)} className="text-[11px] font-semibold text-brand">Material Baru</button>
                  </div>
                  <div className="space-y-2">
                    <select
                      value={addInventoryId}
                      onChange={e => {
                        setAddInventoryId(e.target.value)
                        if (e.target.value) setTimeout(() => addQtyRef.current?.focus(), 50)
                      }}
                      className={inputCls}
                    >
                      <option value="">Pilih material...</option>
                      {inventory.map(i => <option key={i.id} value={i.id}>{i.nama} - {fmt(i.hargaSatuan)} / {i.satuan}</option>)}
                    </select>
                    <div className="grid grid-cols-[1fr_auto] gap-2">
                      <input
                        ref={addQtyRef}
                        type="number" min="0" step="0.01"
                        value={addQty}
                        onChange={e => setAddQty(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && addInventoryId && Number(addQty) > 0) addMaterial() }}
                        className={inputCls}
                        placeholder={smallInfo ? `Qty dalam ${smallInfo.unit}` : 'Qty'}
                      />
                      <button onClick={addMaterial} disabled={saving || !addInventoryId || !addQty || Number(addQty) <= 0} className="px-4 rounded-xl bg-brand text-white text-[12px] font-semibold disabled:opacity-50">+ Simpan</button>
                    </div>
                    {smallInfo && <p className="text-[10px] text-ink-3">Input pakai {smallInfo.label}; sistem simpan ke satuan stok asli.</p>}
                  </div>

                  {bom.length === 0 ? (
                    <p className="text-[11px] text-ink-4 bg-wm-bg rounded-xl px-3 py-2 text-center">Belum ada material.</p>
                  ) : (
                    <div className="space-y-2">
                      {bom.map(item => (
                        <BomRow key={item.id} item={item} saving={saving} onUpdate={updateQty} onDelete={deleteBom} />
                      ))}
                    </div>
                  )}
                </section>

                <section className="bg-white rounded-2xl border border-wm-line p-4 space-y-3">
                  <p className="text-[13px] font-bold">Biaya Jasa</p>
                  <div className="grid grid-cols-2 gap-2">
                    <input value={addJasaNama} onChange={e => setAddJasaNama(e.target.value)} className={inputCls} placeholder="Nama jasa" />
                    <input type="number" min="0" value={addJasaHarga} onChange={e => setAddJasaHarga(e.target.value)} className={inputCls} placeholder="Harga" />
                  </div>
                  <button onClick={addJasa} disabled={saving} className="w-full bg-[#16a34a] text-white text-[12px] font-semibold py-2.5 rounded-xl disabled:opacity-50">Tambah Jasa</button>
                  {jasaItems.length === 0 ? (
                    <p className="text-[11px] text-ink-4 bg-wm-bg rounded-xl px-3 py-2 text-center">Belum ada biaya jasa.</p>
                  ) : jasaItems.map(j => (
                    <div key={j.id} className="flex items-center justify-between bg-wm-bg rounded-xl px-3 py-2">
                      <div>
                        <p className="text-[12px] font-bold">{j.nama}</p>
                        <p className="text-[10px] text-ink-3">{fmt(j.harga)}</p>
                      </div>
                      <button onClick={() => deleteJasa(j.id)} className="text-[11px] font-semibold text-[#dc2626]">Hapus</button>
                    </div>
                  ))}
                </section>

                {msg && <p className="text-[12px] text-[#dc2626]">{msg}</p>}
              </>
            ) : activePanel === 'setup' ? (
              <p className="text-[12px] text-ink-4 text-center py-4">Pilih paket layanan untuk setup HPP.</p>
            ) : null}
          </>
        )}
      </div>

      {showNewMaterial && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end" onClick={() => setShowNewMaterial(false)}>
          <div className="bg-white w-full rounded-t-3xl max-h-[90vh] overflow-y-auto p-5 pb-8" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-[#e2e8f0] rounded-full mx-auto mb-4" />
            <p className="text-[16px] font-bold mb-4">Material Baru</p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <input value={newMat.kode} onChange={e => setNewMat({ ...newMat, kode: e.target.value })} className={inputCls} placeholder="Kode" />
                <input value={newMat.nama} onChange={e => setNewMat({ ...newMat, nama: e.target.value })} className={inputCls} placeholder="Nama" />
              </div>
              <select value={newMat.kategori} onChange={e => setNewMat({ ...newMat, kategori: e.target.value })} className={inputCls}>
                {DEFAULT_KATEGORI.map(k => <option key={k}>{k}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <select value={newMat.satuan} onChange={e => setNewMat({ ...newMat, satuan: e.target.value })} className={inputCls}>
                  {SATUAN_OPTIONS.map(s => <option key={s}>{s}</option>)}
                </select>
                <input type="number" min="0" value={newMat.stok} onChange={e => setNewMat({ ...newMat, stok: e.target.value })} className={inputCls} placeholder="Stok awal" />
              </div>
              <input type="number" min="0" value={newMat.hargaSatuan} onChange={e => setNewMat({ ...newMat, hargaSatuan: e.target.value })} className={inputCls} placeholder="Harga satuan" />
              <button onClick={createMaterial} disabled={saving} className="w-full bg-brand text-white text-[14px] font-semibold py-3 rounded-xl disabled:opacity-50">
                {saving ? 'Menyimpan...' : 'Simpan Material'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function BomRow({ item, saving, onUpdate, onDelete }: {
  item: BomItem
  saving: boolean
  onUpdate: (item: BomItem, qty: number) => void
  onDelete: (id: string) => void
}) {
  const [editQty, setEditQty] = useState(String(displayQty(item)))
  const [dirty, setDirty] = useState(false)
  const cost = itemCost(item)

  const save = () => {
    const q = Number(editQty)
    if (q > 0) { onUpdate(item, q); setDirty(false) }
  }

  return (
    <div className="bg-wm-bg rounded-xl p-3">
      <div className="flex justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className="text-[12px] font-bold truncate">{item.inventory?.nama || '-'}</p>
          <p className="text-[10px] text-ink-3">
            {(() => {
              const info = getSmallUnitInfo(item.inventory)
              if (info) {
                const cpp = Number(item.inventory?.hargaSatuan || 0) / info.factor
                return `${displayQty(item).toLocaleString('id-ID')} ${info.unit} × Rp ${Math.round(cpp).toLocaleString('id-ID')}/${info.unit}`
              }
              return `${Number(item.qty || 0).toLocaleString('id-ID')} ${item.inventory?.satuan || ''} × ${fmt(Number(item.inventory?.hargaSatuan || 0))}`
            })()}
          </p>
        </div>
        <p className="text-[12px] font-bold text-[#f97316] flex-shrink-0">{fmt(cost)}</p>
      </div>
      <div className="grid grid-cols-[1fr_auto_auto] gap-2">
        <input
          type="number" min="0" step="0.01"
          value={editQty}
          onChange={e => { setEditQty(e.target.value); setDirty(true) }}
          onKeyDown={e => { if (e.key === 'Enter') save() }}
          className={inputCls}
        />
        {dirty && (
          <button onClick={save} disabled={saving} className="px-3 rounded-xl bg-brand text-white text-[12px] font-semibold disabled:opacity-50">
            Simpan
          </button>
        )}
        <button onClick={() => onDelete(item.id)} disabled={saving} className="px-3 rounded-xl bg-[#fef2f2] text-[#dc2626] text-[12px] font-semibold disabled:opacity-50">
          Hapus
        </button>
      </div>
      {getSmallUnitInfo(item.inventory) && (
        <p className="text-[10px] text-ink-4 mt-1">Disimpan sebagai {Number(item.qty).toLocaleString('id-ID')} {getSmallUnitInfo(item.inventory)?.unit}</p>
      )}
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white rounded-2xl border border-wm-line p-3">
      <p className="text-[10px] text-ink-3">{label}</p>
      <p className="text-[15px] font-bold mt-1" style={{ color }}>{value}</p>
    </div>
  )
}
