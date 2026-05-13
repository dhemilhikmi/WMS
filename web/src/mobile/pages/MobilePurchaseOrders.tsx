import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { expensesAPI, inventoryAPI, purchaseOrdersAPI, suppliersAPI } from '../../services/api'
import { MobileSubHeader } from '../MobileLayout'
import { loadCompanySettings } from '../../hooks/useCompanySettings'
import { DEFAULT_KATEGORI } from '../../constants/kategori'

type StatusPO = 'draft' | 'ordered' | 'received' | 'cancelled'
type PaymentStatus = 'UNPAID' | 'PARTIAL' | 'PAID'

interface POItem {
  id: string
  inventoryId?: string
  nama: string
  kode: string
  kategori: string
  satuan: string
  qty: number
  harga: number
  panjangRoll?: string
}

interface PurchaseOrder {
  id: string
  noPO: string
  supplierName: string
  status: StatusPO
  orderDate: string
  notes: string
  totalAmount: number
  paymentStatus: PaymentStatus
  paidAmount: number
  items: POItem[]
}

interface InventoryOption {
  id: string
  kode: string
  nama: string
  kategori: string
  satuan: string
  harga: number
}

const statusLabels: Record<StatusPO, string> = {
  draft: 'Draft',
  ordered: 'Dikirim',
  received: 'Diterima',
  cancelled: 'Dibatalkan',
}

const statusColors: Record<StatusPO, string> = {
  draft: '#64748b',
  ordered: '#1E4FD8',
  received: '#16a34a',
  cancelled: '#dc2626',
}

const unitOptions = ['Pcs', 'Roll', 'Meter', 'Liter', 'Kg', 'Gram', 'Botol', 'Kaleng', 'Dus', 'Set', 'Unit']
const emptyItem = (): POItem => ({ id: `${Date.now()}-${Math.random()}`, nama: '', kode: '', kategori: 'Lainnya', satuan: 'Pcs', qty: 1, harga: 0, panjangRoll: '' })
const emptyForm = () => ({ supplierName: '', orderDate: new Date().toISOString().slice(0, 10), notes: '', status: 'draft' as StatusPO, items: [emptyItem()] })
const fmtRp = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID')
const fmtDate = (s: string) => new Date(s).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
const remainingPO = (po: PurchaseOrder) => Math.max(0, po.totalAmount - (po.paidAmount || 0))
const paymentLabel: Record<PaymentStatus, string> = { UNPAID: 'Belum Bayar', PARTIAL: 'Cicilan', PAID: 'Lunas' }
const paymentColor: Record<PaymentStatus, string> = { UNPAID: '#f59e0b', PARTIAL: '#d97706', PAID: '#16a34a' }

function loadSaved<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback
  } catch { return fallback }
}

const defaultDoc = {
  accentColor: '#1E4FD8',
  showLogo: true,
  logoSize: 140,
  logoZoom: 1,
  companyNameFont: 'Inter',
  showNpwp: true,
}

async function downloadPO(po: PurchaseOrder, tenantName: string) {
  const company = await loadCompanySettings()
  const doc = loadSaved('wms_doc_settings_po', defaultDoc)
  const companyName = company.nama || tenantName
  const accent = doc.accentColor || '#1E4FD8'
  const logoSize = Number(doc.logoSize || 140)
  const logoZoom = Number(doc.logoZoom || 1)
  const companyFont = String(doc.companyNameFont || 'Inter').replace(/'/g, '')
  const logoSrc = company.logoDataUrl || (window.location.origin + '/workshopmu-logo.svg')
  const logoHtml = doc.showLogo
    ? `<div style="width:${logoSize}px;height:${Math.round(logoSize * 0.7)}px;display:flex;align-items:center;justify-content:flex-start;margin-bottom:6px;overflow:hidden;">
        <img src="${logoSrc}" style="width:100%;height:100%;object-fit:contain;display:block;transform:scale(${logoZoom});transform-origin:left center;" />
      </div>`
    : ''
  const companyDetailHtml = `
    <div style="font-size:10px;color:#555;line-height:1.6;margin-top:3px">
      ${company.alamat || ''}${company.alamat ? '<br>' : ''}${company.kota || ''}${company.kota ? '<br>' : ''}${company.telp || ''}${company.telp && company.email ? ' - ' : ''}${company.email || ''}
      ${doc.showNpwp && company.npwp ? `<br>NPWP: ${company.npwp}` : ''}
    </div>`
  const rows = po.items.map((it, i) => `
    <tr style="background:${i % 2 ? '#f8fafc' : '#fff'}">
      <td style="padding:6px 8px;color:#888">${i + 1}</td>
      <td style="padding:6px 8px;font-weight:600">${it.nama}</td>
      <td style="padding:6px 8px;color:#888">${it.kode || '-'}</td>
      <td style="padding:6px 8px">${it.qty}</td>
      <td style="padding:6px 8px;color:#888">${it.satuan}</td>
      <td style="padding:6px 8px;text-align:right">${fmtRp(it.harga)}</td>
      <td style="padding:6px 8px;text-align:right;font-weight:700">${fmtRp(it.qty * it.harga)}</td>
    </tr>
  `).join('')
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${po.noPO}</title><style>
*{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
body{font-family:'Segoe UI',Arial,sans-serif;padding:32px;color:#111;font-size:12px}
@page{margin:12mm;size:A4 portrait}
@media print{body{padding:0}}
table{display:table!important;width:100%!important;border-collapse:collapse!important}
thead{display:table-header-group!important}tbody{display:table-row-group!important}tr{display:table-row!important}
th,td{display:table-cell!important;padding:5px 7px!important;text-align:left!important;vertical-align:top!important;word-break:break-word}
th{background:${accent}!important;color:#fff!important;font-size:10px!important;font-weight:700!important}
</style></head><body><div style="width:794px;min-height:1123px;background:#fff;padding:40px 48px;font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#111;line-height:1.5;margin:0 auto;">
<div style="display:flex;justify-content:space-between;border-bottom:2px solid ${accent};padding-bottom:14px;margin-bottom:16px">
  <div>${logoHtml}<div style="font-family:'${companyFont}','Segoe UI',Arial,sans-serif;font-size:18px;font-weight:800">${companyName}</div>${companyDetailHtml}</div>
  <div style="text-align:right"><div style="font-size:22px;font-weight:900;color:${accent}">PURCHASE ORDER</div><div style="font-size:11px;color:#888">No. ${po.noPO}</div></div>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:14px">
  <div style="border:1px solid #e2e8f0;border-radius:4px;padding:10px"><div style="font-size:9px;color:#aaa;font-weight:700">KEPADA PEMASOK</div><b>${po.supplierName || '-'}</b></div>
  <div style="border:1px solid #e2e8f0;border-radius:4px;padding:10px"><div style="font-size:9px;color:#aaa;font-weight:700">DIKIRIM KE</div><b>${companyName}</b></div>
  <div style="border:1px solid #e2e8f0;border-radius:4px;padding:10px"><div style="font-size:9px;color:#aaa;font-weight:700">DETAIL PO</div><div>${fmtDate(po.orderDate)}</div><div>${statusLabels[po.status]}</div></div>
</div>
<table><thead><tr><th>#</th><th>Barang</th><th>Kode</th><th>Qty</th><th>Satuan</th><th style="text-align:right">Harga</th><th style="text-align:right">Total</th></tr></thead><tbody>${rows}</tbody></table>
<div style="margin-left:auto;width:240px;margin-top:12px;background:#f1f5f9;border-radius:4px;padding:9px;display:flex;justify-content:space-between;font-weight:800"><span>TOTAL</span><span style="color:${accent}">${fmtRp(po.totalAmount)}</span></div>
${po.notes ? `<div style="margin-top:12px;padding:9px;border:1px solid #e2e8f0;border-radius:4px;background:#f8fafc"><b>Catatan:</b> ${po.notes}</div>` : ''}
<script>window.onload=function(){window.print()}</script>
</div></body></html>`
  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
}

export default function MobilePurchaseOrders() {
  const { tenant } = useAuth()
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [suppliers, setSuppliers] = useState<string[]>([])
  const [inventory, setInventory] = useState<InventoryOption[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | StatusPO>('all')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<PurchaseOrder | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [statusModal, setStatusModal] = useState<PurchaseOrder | null>(null)
  const [receiveModal, setReceiveModal] = useState<PurchaseOrder | null>(null)
  const [receiveLinkMap, setReceiveLinkMap] = useState<Record<number, string>>({})
  const [payModal, setPayModal] = useState<PurchaseOrder | null>(null)
  const [payAmount, setPayAmount] = useState(0)
  const [deleteItem, setDeleteItem] = useState<PurchaseOrder | null>(null)
  const [detailPO, setDetailPO] = useState<PurchaseOrder | null>(null)
  const [itemPicker, setItemPicker] = useState<{ idx: number; query: string } | null>(null)
  const [kategoriOptions, setKategoriOptions] = useState<string[]>(DEFAULT_KATEGORI)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [poRes, supplierRes, inventoryRes] = await Promise.all([
        purchaseOrdersAPI.list(),
        suppliersAPI.list(),
        inventoryAPI.list(),
      ])
      const expenseRes = await expensesAPI.list().catch(() => ({ data: { data: [] } }))
      const paidByRef = (expenseRes.data.data || []).reduce((map: Record<string, number>, e: any) => {
        if (e.refPO) map[e.refPO] = (map[e.refPO] || 0) + Number(e.jumlah || 0)
        return map
      }, {})
      setOrders((poRes.data.data || []).map((raw: any) => normalizePO(raw, paidByRef)))
      setSuppliers((supplierRes.data.data || []).filter((s: any) => s.status === 'aktif').map((s: any) => s.nama))
      setInventory((inventoryRes.data.data || []).map((i: any) => ({
        id: i.id,
        kode: i.kode,
        nama: i.nama,
        kategori: i.kategori || 'Lainnya',
        satuan: i.satuan,
        harga: Number(i.hargaSatuan || 0),
      })))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const filtered = useMemo(() => orders.filter(po => {
    if (filter !== 'all' && po.status !== filter) return false
    if (!search) return true
    const q = search.toLowerCase()
    return po.noPO.toLowerCase().includes(q) ||
      po.supplierName.toLowerCase().includes(q) ||
      po.items.some(i => `${i.nama} ${i.kode}`.toLowerCase().includes(q))
  }), [orders, filter, search])

  const stats = useMemo(() => ({
    total: orders.length,
    draft: orders.filter(p => p.status === 'draft').length,
    ordered: orders.filter(p => p.status === 'ordered').length,
    received: orders.filter(p => p.status === 'received').length,
    unpaid: orders.filter(p => p.status !== 'cancelled' && p.paymentStatus !== 'PAID').length,
    activeValue: orders.filter(p => p.status !== 'cancelled').reduce((s, p) => s + p.totalAmount, 0),
  }), [orders])

  const formTotal = form.items.reduce((sum, item) => sum + Number(item.qty || 0) * Number(item.harga || 0), 0)

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm())
    setErr('')
    setShowForm(true)
  }

  const openEdit = (po: PurchaseOrder) => {
    setEditing(po)
    setForm({
      supplierName: po.supplierName,
      orderDate: po.orderDate.slice(0, 10),
      notes: po.notes,
      status: po.status,
      items: po.items.length ? po.items.map(i => ({ ...i, id: `${Date.now()}-${Math.random()}` })) : [emptyItem()],
    })
    setErr('')
    setShowForm(true)
  }

  const openPay = (po: PurchaseOrder) => {
    setPayModal(po)
    setPayAmount(remainingPO(po))
  }

  const updateItem = (idx: number, patch: Partial<POItem>) => {
    setForm(prev => ({ ...prev, items: prev.items.map((it, i) => i === idx ? { ...it, ...patch } : it) }))
  }

  const addItem = () => setForm(prev => ({ ...prev, items: [...prev.items, emptyItem()] }))
  const removeLine = (idx: number) => {
    setForm(prev => {
      const items = prev.items.filter((_, i) => i !== idx)
      return { ...prev, items: items.length ? items : [emptyItem()] }
    })
  }

  const pickInventory = (idx: number, inv: InventoryOption) => {
    updateItem(idx, { inventoryId: inv.id, nama: inv.nama, kode: inv.kode, kategori: inv.kategori, satuan: inv.satuan, harga: inv.harga })
    setItemPicker(null)
  }

  const savePO = async () => {
    if (!form.supplierName.trim()) return setErr('Pemasok wajib diisi')
    const validItems = form.items.filter(i => i.nama.trim() && Number(i.qty) > 0)
    if (validItems.length === 0) return setErr('Minimal 1 item barang wajib diisi')

    setSaving(true)
    setErr('')
    const apiItems = validItems.map(i => ({
      inventoryId: i.inventoryId || undefined,
      nama: i.nama.trim(),
      kode: i.kode.trim(),
      kategori: i.kategori || 'Lainnya',
      satuan: i.satuan || 'Pcs',
      qty: Number(i.qty) || 0,
      harga: Number(i.harga) || 0,
      panjangRoll: i.panjangRoll || undefined,
    }))
    const payload = {
      supplierName: form.supplierName.trim(),
      orderDate: new Date(form.orderDate || new Date()).toISOString(),
      notes: form.notes || undefined,
      status: form.status,
      items: apiItems,
      totalAmount: formTotal,
    }
    try {
      if (editing) await purchaseOrdersAPI.update(editing.id, payload)
      else await purchaseOrdersAPI.create(payload)
      setShowForm(false)
      setEditing(null)
      fetchData()
    } catch (e: any) {
      setErr(e.response?.data?.message || e.message || 'Gagal menyimpan PO')
    } finally {
      setSaving(false)
    }
  }

  const updateStatus = async (po: PurchaseOrder, status: StatusPO) => {
    setStatusModal(null)
    if (status === 'received' && po.status !== 'received') {
      setReceiveModal(po)
      return
    }
    setSaving(true)
    try {
      await purchaseOrdersAPI.update(po.id, { status })
      fetchData()
    } catch (e: any) {
      alert(e.response?.data?.message || 'Gagal ubah status')
    } finally {
      setSaving(false)
    }
  }

  const fuzzyScore = (needle: string, haystack: string): number => {
    const a = needle.toLowerCase(), b = haystack.toLowerCase()
    if (b.includes(a)) return 10
    return a.split(/\s+/).filter(w => w.length > 2 && b.includes(w)).length
  }
  const fuzzyOptions = (itemName: string) =>
    inventory
      .map(inv => ({ ...inv, score: fuzzyScore(itemName, inv.nama) }))
      .filter(inv => inv.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)

  const receivePO = async () => {
    if (!receiveModal) return
    setSaving(true)
    try {
      const hasLinks = Object.keys(receiveLinkMap).length > 0
      if (hasLinks) {
        const updatedItems = receiveModal.items.map((item, idx) => ({
          inventoryId: receiveLinkMap[idx] || item.inventoryId || undefined,
          nama: item.nama, kode: item.kode, satuan: item.satuan,
          qty: item.qty, harga: item.harga,
        }))
        await purchaseOrdersAPI.update(receiveModal.id, { items: updatedItems })
      }
      await purchaseOrdersAPI.receive(receiveModal.id)
      setReceiveModal(null)
      setReceiveLinkMap({})
      fetchData()
    } catch (e: any) {
      alert(e.response?.data?.message || e.message || 'Gagal menerima PO')
    } finally {
      setSaving(false)
    }
  }

  const payPO = async () => {
    if (!payModal) return
    const amount = Number(payAmount) || 0
    if (amount <= 0) return
    setSaving(true)
    try {
      await expensesAPI.create({
        tanggal: new Date().toISOString().slice(0, 10),
        kategori: 'Pembelian Bahan',
        keterangan: `Pembayaran ${payModal.noPO} - ${payModal.supplierName || 'Pemasok'}`,
        pemasok: payModal.supplierName || undefined,
        refPO: payModal.noPO,
        jumlah: amount,
        dicatat: 'Mobile PO',
      })
      setPayModal(null)
      setPayAmount(0)
      fetchData()
    } catch (e: any) {
      alert(e.response?.data?.message || e.message || 'Gagal mencatat pembayaran PO')
    } finally {
      setSaving(false)
    }
  }

  const deletePO = async () => {
    if (!deleteItem) return
    setSaving(true)
    try {
      await purchaseOrdersAPI.delete(deleteItem.id)
      setDeleteItem(null)
      fetchData()
    } catch (e: any) {
      alert(e.response?.data?.message || 'Gagal menghapus PO')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <MobileSubHeader title="Pesanan Pembelian" subtitle={loading ? 'Memuat...' : `${filtered.length} PO`} />
      <div className="px-4 pt-3 space-y-3 pb-4">
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Total" value={stats.total} color="#1E4FD8" />
          <Stat label="Draft" value={stats.draft} color="#64748b" />
          <Stat label="Kirim" value={stats.ordered} color="#1E4FD8" />
          <Stat label="Terima" value={stats.received} color="#16a34a" />
          <Stat label="Belum Bayar" value={stats.unpaid} color="#f97316" />
          <Stat label="Nilai Aktif" value={fmtRp(stats.activeValue)} color="#7c3aed" small />
        </div>

        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari PO, pemasok, barang..." className={inputCls} />

        <div className="flex gap-2 overflow-x-auto pb-1">
          {(['all', 'draft', 'ordered', 'received', 'cancelled'] as const).map(s => (
            <button key={s} onClick={() => setFilter(s)} className={`flex-shrink-0 px-3 py-2 rounded-xl text-[12px] font-semibold ${filter === s ? 'bg-brand text-white' : 'bg-white border border-wm-line text-ink-3'}`}>
              {s === 'all' ? 'Semua' : statusLabels[s]}
            </button>
          ))}
        </div>

        {loading && <p className="text-center text-[12px] text-ink-4 py-6">Memuat...</p>}
        {!loading && filtered.length === 0 && <div className="bg-white rounded-2xl border border-wm-line p-8 text-center text-[13px] text-[#666]">Belum ada PO</div>}

        <div className="space-y-2.5">
          {filtered.map(po => (
            <div key={po.id} className="bg-white rounded-2xl border border-wm-line p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-brand">{po.noPO}</p>
                  <p className="text-[12px] font-semibold truncate">{po.supplierName || '-'}</p>
                  <p className="text-[10px] text-ink-4">{fmtDate(po.orderDate)} - {po.items.length} item</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[13px] font-bold">{fmtRp(po.totalAmount)}</p>
                  <button onClick={() => setStatusModal(po)} className="text-[10px] font-bold px-2 py-1 rounded-full mt-1" style={{ background: statusColors[po.status] + '22', color: statusColors[po.status] }}>
                    {statusLabels[po.status]}
                  </button>
                  <p
                    className="text-[10px] font-bold px-2 py-1 rounded-full mt-1"
                    style={{
                      background: paymentColor[po.paymentStatus] + '22',
                      color: paymentColor[po.paymentStatus],
                    }}
                  >
                    {paymentLabel[po.paymentStatus]}
                  </p>
                  {po.paidAmount > 0 && <p className="text-[9px] text-ink-4 mt-0.5">{fmtRp(po.paidAmount)}</p>}
                </div>
              </div>

              <div className="mt-2 space-y-1">
                {po.items.slice(0, 3).map((it, idx) => (
                  <p key={idx} className="text-[11px] text-[#666] truncate">{it.nama} x{it.qty} {it.satuan}</p>
                ))}
                {po.items.length > 3 && <p className="text-[10px] text-ink-4">+{po.items.length - 3} item lainnya</p>}
              </div>

              <div className="grid grid-cols-3 gap-2 mt-3">
                <button onClick={() => setDetailPO(po)} className="bg-wm-bg text-[#475569] text-[12px] font-semibold py-2 rounded-xl">Detail</button>
                <button onClick={() => downloadPO(po, tenant?.name || 'Workshop')} className="bg-[#f5f3ff] text-[#7c3aed] text-[12px] font-semibold py-2 rounded-xl">PDF</button>
                <button onClick={() => openEdit(po)} disabled={po.status !== 'draft'} className="bg-brand-50 text-brand disabled:text-[#aaa] disabled:bg-wm-bg text-[12px] font-semibold py-2 rounded-xl">Edit</button>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-2">
                <button onClick={() => setReceiveModal(po)} disabled={po.status === 'received' || po.status === 'cancelled'} className="bg-[#dcfce7] text-[#15803d] disabled:text-[#aaa] disabled:bg-wm-bg text-[12px] font-semibold py-2 rounded-xl">Terima</button>
                <button onClick={() => openPay(po)} disabled={po.paymentStatus === 'PAID' || po.status === 'cancelled'} className="bg-[#fef3c7] text-[#b45309] disabled:text-[#aaa] disabled:bg-wm-bg text-[12px] font-semibold py-2 rounded-xl">Bayar</button>
                <button onClick={() => setDeleteItem(po)} disabled={po.status !== 'draft'} className="bg-[#fef2f2] text-[#dc2626] disabled:text-[#aaa] disabled:bg-wm-bg text-[12px] font-semibold py-2 rounded-xl">Hapus</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button onClick={openCreate} className="mobile-fab" aria-label="Tambah PO">+</button>

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end" onClick={() => setShowForm(false)}>
          <div className="bg-white w-full rounded-t-3xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <SheetHeader title={editing ? 'Edit PO' : 'PO Baru'} onClose={() => setShowForm(false)} />
            <div className="px-5 py-4 space-y-3.5 pb-8">
              <label className={labelCls}>Pemasok</label>
              <select value={form.supplierName} onChange={e => setForm({ ...form, supplierName: e.target.value })} className={inputCls}>
                <option value="">Pilih pemasok</option>
                {suppliers.map(s => <option key={s} value={s}>{s}</option>)}
              </select>

              <label className={labelCls}>Tanggal PO</label>
              <input type="date" value={form.orderDate} onChange={e => setForm({ ...form, orderDate: e.target.value })} className={inputCls} />

              <label className={labelCls}>Status</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as StatusPO })} className={inputCls}>
                {(['draft', 'ordered', 'received', 'cancelled'] as StatusPO[]).map(s => <option key={s} value={s}>{statusLabels[s]}</option>)}
              </select>

              <div className="flex items-center justify-between pt-2">
                <p className="text-[13px] font-bold">Item Barang</p>
                <button onClick={addItem} className="text-[12px] font-semibold text-brand">+ Tambah item</button>
              </div>

              {form.items.map((item, idx) => (
                <div key={item.id} className="rounded-2xl border border-wm-line bg-wm-bg p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold text-[#666]">Item {idx + 1}</p>
                    {form.items.length > 1 && <button onClick={() => removeLine(idx)} className="text-[11px] font-semibold text-[#dc2626]">Hapus</button>}
                  </div>
                  <button onClick={() => setItemPicker({ idx, query: item.nama })} className="w-full text-left bg-white border border-wm-line rounded-xl px-3 py-2.5">
                    <p className="text-[12px] font-semibold truncate">{item.nama || 'Pilih / cari barang'}</p>
                    <p className="text-[10px] text-ink-4 truncate">{item.kode || 'Bisa pilih dari inventaris atau isi manual'}</p>
                  </button>
                  <input value={item.nama} onChange={e => updateItem(idx, { nama: e.target.value })} placeholder="Nama barang" className={inputCls} />
                  <input value={item.kode} onChange={e => updateItem(idx, { kode: e.target.value })} placeholder="Kode barang (opsional)" className={inputCls} />
                  <input
                    list={`kategori-list-${idx}`}
                    value={item.kategori}
                    onChange={e => {
                      const v = e.target.value
                      updateItem(idx, { kategori: v })
                      if (v.trim() && !kategoriOptions.includes(v.trim())) setKategoriOptions(p => [...p, v.trim()])
                    }}
                    placeholder="Kategori barang"
                    className={inputCls}
                  />
                  <datalist id={`kategori-list-${idx}`}>
                    {kategoriOptions.map(k => <option key={k} value={k} />)}
                  </datalist>
                  <div className="grid grid-cols-3 gap-2">
                    <input type="number" value={item.qty || ''} onChange={e => updateItem(idx, { qty: Number(e.target.value) || 0 })} placeholder="Qty" className={inputCls} />
                    <select value={item.satuan} onChange={e => updateItem(idx, { satuan: e.target.value })} className={inputCls}>
                      {unitOptions.map(u => <option key={u}>{u}</option>)}
                    </select>
                    <input type="number" value={item.harga || ''} onChange={e => updateItem(idx, { harga: Number(e.target.value.replace(/^0+(?=\d)/, '')) || 0 })} placeholder="Harga" className={inputCls} />
                  </div>
                  {(item.satuan === 'Roll' || item.satuan === 'Meter') && (
                    <input value={item.panjangRoll || ''} onChange={e => updateItem(idx, { panjangRoll: e.target.value })} placeholder="Panjang roll (cth: 15m atau 150cm)" className={inputCls} />
                  )}
                  <p className="text-right text-[12px] font-bold text-ink">{fmtRp(Number(item.qty || 0) * Number(item.harga || 0))}</p>
                </div>
              ))}

              <label className={labelCls}>Catatan</label>
              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} className={inputCls} />

              <div className="rounded-2xl bg-brand-50 border border-[#D9E3FC] p-3 flex items-center justify-between">
                <p className="text-[12px] font-semibold text-[#1e40af]">Total PO</p>
                <p className="text-[16px] font-bold text-[#1A45BF]">{fmtRp(formTotal)}</p>
              </div>

              {err && <p className="text-[12px] text-[#dc2626]">{err}</p>}
              <button onClick={savePO} disabled={saving} className="w-full bg-brand text-white text-[14px] font-semibold py-3 rounded-xl disabled:opacity-50">
                {saving ? 'Menyimpan...' : editing ? 'Simpan Perubahan' : 'Buat PO'}
              </button>
            </div>
          </div>
        </div>
      )}

      {itemPicker && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-end" onClick={() => setItemPicker(null)}>
          <div className="bg-white w-full rounded-t-3xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <SheetHeader title="Pilih Barang" onClose={() => setItemPicker(null)} />
            <div className="px-5 py-4 space-y-2 pb-8">
              <input autoFocus value={itemPicker.query} onChange={e => setItemPicker({ ...itemPicker, query: e.target.value })} placeholder="Cari inventaris..." className={inputCls} />
              {inventory.filter(i => `${i.nama} ${i.kode}`.toLowerCase().includes(itemPicker.query.toLowerCase())).map(inv => (
                <button key={inv.id} onClick={() => pickInventory(itemPicker.idx, inv)} className="w-full text-left border border-wm-line rounded-2xl p-3">
                  <p className="text-[13px] font-bold">{inv.nama}</p>
                  <p className="text-[11px] text-[#666]">{inv.kode} - {fmtRp(inv.harga)}/{inv.satuan}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {statusModal && (
        <ChoiceSheet title="Ubah Status" onClose={() => setStatusModal(null)}>
          {(['draft', 'ordered', 'received', 'cancelled'] as StatusPO[]).map(s => (
            <button key={s} onClick={() => updateStatus(statusModal, s)} className="w-full text-left border border-wm-line rounded-xl px-3 py-3 text-[13px] font-semibold">
              {statusLabels[s]}
            </button>
          ))}
        </ChoiceSheet>
      )}

      {receiveModal && (
        <ChoiceSheet title="Terima PO" onClose={() => { setReceiveModal(null); setReceiveLinkMap({}) }}>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {receiveModal.items.map((item, i) => {
              const resolvedId = receiveLinkMap[i] || item.inventoryId
              const hasLink = !!resolvedId
              const opts = !item.inventoryId ? fuzzyOptions(item.nama) : []
              const linkedName = resolvedId ? inventory.find(b => b.id === resolvedId)?.nama : null
              return (
                <div key={i} className={`rounded-xl border px-3 py-2.5 text-[12px] ${hasLink ? 'border-[#bbf7d0] bg-[#f0fdf4]' : 'border-[#fde68a] bg-[#fffbeb]'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-ink">{item.nama}</span>
                    <span className={`font-bold flex-shrink-0 ${hasLink ? 'text-[#15803d]' : 'text-[#92400e]'}`}>+{item.qty} {item.satuan}</span>
                  </div>
                  {hasLink ? (
                    <p className="text-[11px] text-[#15803d] mt-0.5">
                      ✓ {linkedName || resolvedId}
                      {receiveLinkMap[i] && (
                        <button onClick={() => setReceiveLinkMap(m => { const n = {...m}; delete n[i]; return n })} className="ml-2 text-ink-4">ubah</button>
                      )}
                    </p>
                  ) : (
                    <div className="mt-1.5">
                      <p className="text-[11px] text-[#b45309] mb-1">⚠ Tidak ter-link — tautkan ke inventaris:</p>
                      <select
                        value={receiveLinkMap[i] || ''}
                        onChange={e => setReceiveLinkMap(m => ({ ...m, [i]: e.target.value }))}
                        className="w-full rounded-lg border border-[#fde68a] bg-white px-2 py-1.5 text-[12px]"
                      >
                        <option value="">— Pilih item inventaris —</option>
                        {opts.length > 0 && <optgroup label="Kemungkinan cocok">{opts.map(o => <option key={o.id} value={o.id}>{o.nama} ({o.satuan})</option>)}</optgroup>}
                        <optgroup label="Semua inventaris">{inventory.filter(o => !opts.some(x => x.id === o.id)).map(o => <option key={o.id} value={o.id}>{o.nama} ({o.satuan})</option>)}</optgroup>
                      </select>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          {(() => {
            const unlinked = receiveModal.items.filter((item, i) => !(receiveLinkMap[i] || item.inventoryId)).length
            return unlinked > 0 ? (
              <div className="rounded-xl border border-[#fde68a] bg-[#fffbeb] px-3 py-2 text-[12px] text-[#92400e]">
                ⚠ <span className="font-semibold">{unlinked} item</span> tidak ter-link — stok & batch FIFO tidak akan terbuat untuk item tersebut.
              </div>
            ) : null
          })()}
          <button onClick={receivePO} disabled={saving} className="w-full bg-[#16a34a] text-white text-[14px] font-semibold py-3 rounded-xl disabled:opacity-50">
            {saving ? 'Memproses...' : 'Terima dan Tambah Stok'}
          </button>
        </ChoiceSheet>
      )}

      {payModal && (
        <ChoiceSheet title="Catat Pembayaran PO" onClose={() => setPayModal(null)}>
          <p className="text-[12px] text-[#666] leading-relaxed">
            Nominal pembayaran akan masuk ke Pengeluaran dengan referensi {payModal.noPO}. Bisa dicatat sebagian kalau pembayarannya dicicil.
          </p>
          <div className="rounded-2xl border border-wm-line bg-wm-bg p-3 space-y-1">
            <Row label="Total PO" value={fmtRp(payModal.totalAmount)} />
            <Row label="Sudah Dibayar" value={fmtRp(payModal.paidAmount || 0)} />
            <Row label="Sisa" value={fmtRp(remainingPO(payModal))} color="#b45309" bold />
          </div>
          <div>
            <label className={labelCls}>Nominal Dibayar</label>
            <input
              type="number"
              min="1"
              max={remainingPO(payModal)}
              value={payAmount || ''}
              onChange={e => setPayAmount(Number(e.target.value))}
              className={inputCls}
            />
            <div className="grid grid-cols-2 gap-2 mt-2">
              <button onClick={() => setPayAmount(remainingPO(payModal))} className="bg-wm-bg text-ink-3 text-[12px] font-semibold py-2 rounded-xl">Bayar Sisa</button>
              <button onClick={() => setPayAmount(Math.round(remainingPO(payModal) / 2))} className="bg-wm-bg text-ink-3 text-[12px] font-semibold py-2 rounded-xl">50%</button>
            </div>
          </div>
          <button onClick={payPO} disabled={saving || payAmount <= 0 || payAmount > remainingPO(payModal)} className="w-full bg-[#f59e0b] text-white text-[14px] font-semibold py-3 rounded-xl disabled:opacity-50">
            {saving ? 'Mencatat...' : 'Catat Pembayaran'}
          </button>
        </ChoiceSheet>
      )}

      {detailPO && (
        <ChoiceSheet title={detailPO.noPO} onClose={() => setDetailPO(null)}>
          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-wm-line bg-wm-bg p-3">
            <Row label="Pemasok" value={detailPO.supplierName || '-'} />
            <Row label="Tanggal" value={fmtDate(detailPO.orderDate)} />
            <Row label="Status" value={statusLabels[detailPO.status]} />
            <Row label="Pembayaran" value={paymentLabel[detailPO.paymentStatus]} />
            <Row label="Sudah Dibayar" value={fmtRp(detailPO.paidAmount || 0)} />
            <Row label="Sisa" value={fmtRp(remainingPO(detailPO))} color="#b45309" bold />
          </div>
          {detailPO.notes && <p className="rounded-2xl border border-[#fde68a] bg-[#fffbeb] p-3 text-[12px] text-[#92400e]">{detailPO.notes}</p>}
          <div className="overflow-hidden rounded-2xl border border-wm-line">
            <div className="grid grid-cols-[1fr_48px_76px] bg-wm-bg px-3 py-2 text-[10px] font-bold text-ink-3">
              <span>Barang</span><span className="text-center">Qty</span><span className="text-right">Total</span>
            </div>
            {detailPO.items.map((it, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_48px_76px] border-t border-[#f1f5f9] px-3 py-2 text-[11px]">
                <div className="min-w-0">
                  <p className="font-semibold text-ink truncate">{it.nama}</p>
                  <p className="text-[10px] text-ink-4 truncate">{it.kode || '-'} - {fmtRp(it.harga)}/{it.satuan}</p>
                </div>
                <p className="text-center text-ink-3">{it.qty}</p>
                <p className="text-right font-bold text-ink">{fmtRp(it.qty * it.harga)}</p>
              </div>
            ))}
            <div className="flex justify-between border-t-2 border-wm-line bg-wm-bg px-3 py-2 text-[12px] font-extrabold">
              <span>Total</span><span className="text-brand">{fmtRp(detailPO.totalAmount)}</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {detailPO.paymentStatus !== 'PAID' && detailPO.status !== 'cancelled' && (
              <button onClick={() => { openPay(detailPO); setDetailPO(null) }} className="rounded-xl bg-[#fef3c7] py-2.5 text-[12px] font-bold text-[#b45309]">Bayar</button>
            )}
            {detailPO.status === 'draft' && (
              <button onClick={() => { openEdit(detailPO); setDetailPO(null) }} className="rounded-xl bg-brand-50 py-2.5 text-[12px] font-bold text-brand">Edit</button>
            )}
            <button onClick={() => downloadPO(detailPO, tenant?.name || 'Workshop')} className="rounded-xl bg-[#f5f3ff] py-2.5 text-[12px] font-bold text-[#7c3aed]">PDF</button>
          </div>
        </ChoiceSheet>
      )}

      {deleteItem && (
        <ChoiceSheet title="Hapus PO" onClose={() => setDeleteItem(null)}>
          <p className="text-[12px] text-[#666]">PO {deleteItem.noPO} akan dihapus.</p>
          <button onClick={deletePO} disabled={saving} className="w-full bg-[#dc2626] text-white text-[14px] font-semibold py-3 rounded-xl disabled:opacity-50">
            {saving ? 'Menghapus...' : 'Hapus PO'}
          </button>
        </ChoiceSheet>
      )}
    </>
  )
}

function normalizePO(raw: any, paidByRef: Record<string, number> = {}): PurchaseOrder {
  const parsed = parseItems(raw.items)
  const paidAmount = Number(paidByRef[raw.noPO] || 0)
  const totalAmount = Number(raw.totalAmount || 0)
  return {
    id: raw.id,
    noPO: raw.noPO || '-',
    supplierName: raw.supplierName || '',
    status: (raw.status || 'draft') as StatusPO,
    orderDate: raw.orderDate || raw.createdAt || new Date().toISOString(),
    notes: raw.notes || '',
    totalAmount,
    paymentStatus: paidAmount >= totalAmount ? 'PAID' : paidAmount > 0 ? 'PARTIAL' : 'UNPAID',
    paidAmount,
    items: parsed.map((it, idx) => ({
      id: String(idx),
      inventoryId: it.inventoryId || undefined,
      nama: it.nama || it.barang || '',
      kode: it.kode || '',
      kategori: it.kategori || 'Lainnya',
      satuan: it.satuan || 'Pcs',
      qty: Number(it.qty) || 0,
      harga: Number(it.harga ?? it.hargaSatuan) || 0,
      panjangRoll: it.panjangRoll || '',
    })),
  }
}

function parseItems(items: any): any[] {
  if (Array.isArray(items)) return items
  if (!items) return []
  try {
    const parsed = JSON.parse(items)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function Stat({ label, value, color, small }: { label: string; value: number | string; color: string; small?: boolean }) {
  return (
    <div className="bg-white border border-wm-line rounded-2xl p-2 text-center">
      <p className={`${small ? 'text-[12px]' : 'text-[16px]'} font-bold truncate`} style={{ color }}>{value}</p>
      <p className="text-[9px] text-ink-4">{label}</p>
    </div>
  )
}

function SheetHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="sticky top-0 bg-white px-5 pt-4 pb-3 border-b border-wm-line z-10">
      <div className="w-10 h-1 bg-[#e2e8f0] rounded-full mx-auto mb-3" />
      <div className="flex items-center justify-between">
        <p className="text-[16px] font-bold">{title}</p>
        <button onClick={onClose} className="text-[12px] font-semibold text-[#666]">Tutup</button>
      </div>
    </div>
  )
}

function ChoiceSheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end" onClick={onClose}>
      <div className="bg-white w-full rounded-t-3xl p-5 pb-8 space-y-3" onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 bg-[#e2e8f0] rounded-full mx-auto mb-3" />
        <div className="flex items-center justify-between">
          <p className="text-[16px] font-bold">{title}</p>
          <button onClick={onClose} className="text-[12px] font-semibold text-[#666]">Tutup</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Row({ label, value, color, bold }: { label: string; value: string; color?: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-[12px] text-[#666]">{label}</p>
      <p className={`text-[13px] ${bold ? 'font-bold' : 'font-semibold'}`} style={{ color: color || '#111' }}>{value}</p>
    </div>
  )
}

const labelCls = 'block text-[11px] font-semibold text-[#666] mb-1'
const inputCls = 'w-full bg-white border border-wm-line rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-[#1E4FD8]'
