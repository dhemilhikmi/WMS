import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { purchaseOrdersAPI, suppliersAPI, inventoryAPI, expensesAPI } from '../services/api'
import { DEFAULT_KATEGORI } from '../constants/kategori'
import { loadCompanySettings } from '../hooks/useCompanySettings'

const DB_TO_STATUS: Record<string, StatusPO> = {
  draft: 'draft', ordered: 'dikirim', received: 'diterima', cancelled: 'dibatalkan',
}
const STATUS_TO_DB: Record<StatusPO, string> = {
  draft: 'draft', dikirim: 'ordered', diterima: 'received', dibatalkan: 'cancelled',
}

type StatusPO = 'draft' | 'dikirim' | 'diterima' | 'dibatalkan'
type PaymentStatus = 'UNPAID' | 'PARTIAL' | 'PAID'

interface ItemPO {
  id: string
  inventoryId?: string
  barang: string
  kode: string
  kategori?: string
  satuan: string
  qty: number
  hargaSatuan: number
  panjangRoll?: string
  satuanRoll?: string
}

interface PesananPembelian {
  id: string
  noPO: string
  tanggal: string
  pemasok: string
  status: StatusPO
  paymentStatus: PaymentStatus
  paidAmount: number
  items: ItemPO[]
  catatan: string
  tanggalPesan: string
  createdBy: string
}

interface BarangOption { id: string; kode: string; nama: string; kategori?: string; satuan: string; harga: number; pemasok?: string; panjangRoll?: string }

const STATUS_LABEL: Record<StatusPO, string> = {
  draft: 'Draft',
  dikirim: 'Dikirim',
  diterima: 'Diterima',
  dibatalkan: 'Dibatalkan',
}

const STATUS_COLOR: Record<StatusPO, string> = {
  draft: 'bg-[#f1f5f9] text-[#64748b]',
  dikirim: 'bg-[#dbeafe] text-[#1A45BF]',
  diterima: 'bg-[#dcfce7] text-[#15803d]',
  dibatalkan: 'bg-[#fee2e2] text-[#b91c1c]',
}

const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  UNPAID: 'Belum Bayar',
  PARTIAL: 'Cicilan',
  PAID: 'Lunas',
}

const PAYMENT_COLOR: Record<PaymentStatus, string> = {
  UNPAID: 'bg-[#ffedd5] text-[#c2410c]',
  PARTIAL: 'bg-[#fef3c7] text-[#b45309]',
  PAID: 'bg-[#dcfce7] text-[#15803d]',
}

const SATUAN_OPTIONS = ['Pcs', 'Roll', 'Meter', 'Liter', 'Kg', 'Gram', 'Botol', 'Kaleng', 'Dus', 'Lusin', 'Set', 'Unit']

const inputCls = 'w-full rounded border border-[#cbd5e1] bg-white px-3 py-2 text-sm text-[#111] outline-none focus:border-brand focus:ring-2 focus:ring-[#dbeafe] transition'
const labelCls = 'block text-[11px] font-semibold text-[#555] mb-1'

const totalPO = (po: PesananPembelian) =>
  po.items.reduce((s, i) => s + i.qty * i.hargaSatuan, 0)

const remainingPO = (po: PesananPembelian) => Math.max(0, totalPO(po) - (po.paidAmount || 0))

const fmt = (n: number) => 'Rp ' + n.toLocaleString('id-ID')
const cleanNumber = (value: string) => value.replace(/[^\d]/g, '')

const parsePanjangRoll = (raw: string): { nilai: string; satuan: string } => {
  const m = String(raw || '').match(/^([\d.]+)\s*(cm|m)?$/i)
  if (!m) return { nilai: raw || '', satuan: 'm' }
  return { nilai: m[1], satuan: m[2]?.toLowerCase() || 'm' }
}
const formatPanjangRoll = (nilai: string, satuan: string) =>
  nilai ? `${nilai}${satuan}` : ''
const fmtNumberInput = (value: string | number) => {
  const n = Math.round(Number(cleanNumber(String(value || ''))))
  return n > 0 ? n.toLocaleString('id-ID', { maximumFractionDigits: 0 }) : ''
}

interface FormPO {
  pemasok: string
  tanggalPesan: string
  catatan: string
  items: ItemPO[]
}

const emptyForm = (pemasok = '', barang?: BarangOption): FormPO => ({
  pemasok,
  tanggalPesan: '',
  catatan: '',
  items: barang
    ? (() => { const p = parsePanjangRoll(barang.panjangRoll || ''); return [{ id: Date.now().toString(), barang: barang.nama, kode: barang.kode, kategori: barang.kategori || 'Lainnya', satuan: barang.satuan, qty: 1, hargaSatuan: barang.harga, panjangRoll: p.nilai, satuanRoll: p.satuan }] })()
    : [],
})

const fmtRp = (n: number) => 'Rp ' + n.toLocaleString('id-ID')

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
  showTtd: true,
  catatan: '',
  ttd1Nama: '',
  ttd1Jabatan: '',
  ttd2Nama: '',
  ttd2Jabatan: '',
  ttd3Nama: '',
  ttd3Jabatan: '',
}

async function downloadPO(po: PesananPembelian, tenantName: string) {
  const subtotal = po.items.reduce((s, i) => s + i.qty * i.hargaSatuan, 0)
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
    <div style="font-size:10px;color:#555;line-height:1.6">
      ${company.alamat || ''}${company.alamat ? '<br>' : ''}${company.kota || ''}${company.kota ? '<br>' : ''}${company.telp || ''}${company.telp && company.email ? ' · ' : ''}${company.email || ''}
      ${doc.showNpwp && company.npwp ? `<br>NPWP: ${company.npwp}` : ''}
    </div>`

  const itemsHtml = po.items.map((it, i) => `
    <tr style="background:${i % 2 === 0 ? '#fff' : '#f8fafc'}">
      <td style="padding:5px 8px;color:#888">${i + 1}</td>
      <td style="padding:5px 8px;font-weight:600;color:#111">${it.barang}</td>
      <td style="padding:5px 8px;color:#888">${it.kode || '—'}</td>
      <td style="padding:5px 8px">${it.qty}</td>
      <td style="padding:5px 8px;color:#888">${it.satuan}${it.panjangRoll && String(it.satuan).toLowerCase().includes('roll') ? `<br><span style="font-size:9px;color:#aaa">${it.panjangRoll}${it.satuanRoll || 'm'}/roll</span>` : ''}</td>
      <td style="padding:5px 8px">${fmtRp(it.hargaSatuan)}</td>
      <td style="padding:5px 8px;font-weight:700">${fmtRp(it.qty * it.hargaSatuan)}</td>
    </tr>`).join('')

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>${po.noPO}</title>
    <style>
      * { margin:0; padding:0; box-sizing:border-box;
          -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      body { font-family: 'Segoe UI', Arial, sans-serif; padding: 32px; color: #111; font-size: 12px; }
      @page { margin: 12mm; size: A4 portrait; }
      @media print { body { padding: 0; } }
      table { display: table !important; width: 100% !important; border-collapse: collapse !important; }
      thead { display: table-header-group !important; } tbody { display: table-row-group !important; } tr { display: table-row !important; }
      th, td { display: table-cell !important; padding: 5px 7px !important; text-align: left !important; vertical-align: top !important; word-break: break-word; }
      th { background: ${accent} !important; color: #fff !important; font-size: 10px !important; font-weight: 700 !important; }
    </style>
  </head><body><div style="width:794px;min-height:1123px;background:#fff;padding:40px 48px;font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#111;line-height:1.5;margin:0 auto;">
    <!-- Header -->
    <div style="border-bottom:2px solid ${accent};padding-bottom:14px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:flex-start">
      <div>
        ${logoHtml}
        <div style="font-family:'${companyFont}','Segoe UI',Arial,sans-serif;font-weight:800;font-size:18px;color:#111;margin-bottom:2px">${companyName}</div>
        ${companyDetailHtml}
      </div>
      <div style="text-align:right">
        <div style="font-size:22px;font-weight:900;color:${accent};letter-spacing:-0.5px">PURCHASE ORDER</div>
        <div style="font-size:11px;color:#888;margin-top:4px">No. ${po.noPO}</div>
        <div style="display:inline-block;margin-top:6px;padding:3px 10px;border-radius:4px;background:${accent}18;color:${accent};font-size:10px;font-weight:700">
          ${po.status === 'diterima' ? 'DITERIMA' : po.status === 'dikirim' ? 'DIKIRIM' : 'DIPROSES'}
        </div>
      </div>
    </div>

    <!-- Info boxes -->
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:14px">
      <div style="border:1px solid #e2e8f0;border-radius:4px;padding:10px">
        <div style="font-size:9px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Kepada Pemasok</div>
        <div style="font-size:11px;font-weight:700;color:#111">${po.pemasok}</div>
      </div>
      <div style="border:1px solid #e2e8f0;border-radius:4px;padding:10px">
        <div style="font-size:9px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Dikirim Ke</div>
        <div style="font-size:11px;font-weight:700;color:#111">${companyName}</div>
      </div>
      <div style="border:1px solid #e2e8f0;border-radius:4px;padding:10px">
        <div style="font-size:9px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Detail PO</div>
        <div style="font-size:10px;line-height:1.7">
          <div><span style="color:#888">Tgl PO:</span> <span style="font-weight:600">${po.tanggal}</span></div>
          <div><span style="color:#888">Tgl Pesan:</span> <span style="font-weight:600">${po.tanggalPesan || '—'}</span></div>
          <div><span style="color:#888">Status:</span> <span style="font-weight:600">${po.status.charAt(0).toUpperCase() + po.status.slice(1)}</span></div>
        </div>
      </div>
    </div>

    <!-- Items table -->
    <table style="font-size:10px;margin-bottom:8px">
      <thead>
        <tr style="background:${accent};color:#fff">
          ${['#','Deskripsi Barang','Kode','Qty','Satuan','Harga Satuan','Total'].map(h =>
            `<th style="padding:5px 8px;text-align:left;font-weight:700;font-size:9px">${h}</th>`).join('')}
        </tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
    </table>

    <!-- Totals -->
    <div style="margin-left:auto;width:220px;margin-top:8px">
      <div style="display:flex;justify-content:space-between;padding:3px 0;font-size:10px;color:#555;border-bottom:1px solid #f1f5f9">
        <span>Subtotal</span><span>${fmtRp(subtotal)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:6px 8px;background:#f1f5f9;border-radius:4px;margin-top:4px;font-weight:700;font-size:11px">
        <span>TOTAL</span><span style="color:${accent}">${fmtRp(subtotal)}</span>
      </div>
    </div>

    ${po.catatan ? `<div style="margin-top:12px;padding:8px 10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px;font-size:10px;color:#555">
      <span style="font-weight:700">Catatan: </span>${po.catatan}</div>` : ''}

    ${doc.showTtd ? `<!-- Signatures -->
    <div style="margin-top:24px;display:flex;gap:12px">
      ${[
        ['Dibuat oleh', doc.ttd1Nama, doc.ttd1Jabatan],
        ['Disetujui oleh', doc.ttd2Nama, doc.ttd2Jabatan],
        ['Dikonfirmasi Pemasok', doc.ttd3Nama, doc.ttd3Jabatan],
      ].map(([label, nama, jabatan]) => `
        <div style="flex:1;border:1px solid #e2e8f0;border-radius:4px;padding:10px 12px">
          <div style="font-size:10px;color:#888;margin-bottom:32px">${label}</div>
          <div style="border-top:1px solid #333;padding-top:4px">
            <div style="font-size:10px;font-weight:700;color:#111">${nama || '_______________'}</div>
            <div style="font-size:9px;color:#888">${jabatan || '_______________'}</div>
          </div>
        </div>`).join('')}
    </div>` : ''}

    <!-- Footer -->
    <div style="margin-top:16px;padding-top:8px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between">
      <div style="font-size:9px;color:#aaa">Dokumen ini diterbitkan oleh ${companyName}</div>
      <div style="font-size:9px;color:#aaa">Cetak: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} · Hal. 1/1</div>
    </div>

    <script>window.onload = function(){ window.print(); }</script>
  </div></body></html>`

  const w = window.open('', '_blank')
  if (w) { w.document.write(html); w.document.close() }
}

export default function PesananPembelianPage() {
  const { tenant } = useAuth()
  const [poList, setPoList] = useState<PesananPembelian[]>([])
  const [pemasokOptions, setPemasokOptions] = useState<string[]>([])
  const [barangOptions, setBarangOptions] = useState<BarangOption[]>([])
  const [_loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'semua' | StatusPO>('semua')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormPO>(emptyForm())
  const [detailId, setDetailId] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [statusModal, setStatusModal] = useState<{ id: string; current: StatusPO } | null>(null)
  const [payModal, setPayModal] = useState<PesananPembelian | null>(null)
  const [payAmount, setPayAmount] = useState(0)
  const [terimaModal, setTerimaModal] = useState<PesananPembelian | null>(null)
  const [terimaResult, setTerimaResult] = useState<{ updated: string[]; notFound: string[] } | null>(null)
  const [terimaError, setTerimaError] = useState('')
  // linkMap: itemIndex → inventoryId yang dipilih user untuk item tanpa inventoryId
  const [linkMap, setLinkMap] = useState<Record<number, string>>({})
  const [satuanOptions, setSatuanOptions] = useState<string[]>(SATUAN_OPTIONS)
  const [kategoriOptions, setKategoriOptions] = useState<string[]>(DEFAULT_KATEGORI)
  const [addingKategori, setAddingKategori] = useState<number | null>(null)
  const [newKategoriVal, setNewKategoriVal] = useState('')
  const [addingSatuan, setAddingSatuan] = useState<number | null>(null)
  const [newSatuanVal, setNewSatuanVal] = useState('')
  const [suggestionIdx, setSuggestionIdx] = useState<number | null>(null)
  const [suggestionPos, setSuggestionPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const barangInputRefs = useRef<(HTMLInputElement | null)[]>([])

  const fetchData = useCallback(async () => {
    if (!tenant?.id) return
    try {
      setLoading(true)
      const [poRes, suppRes, invRes, expRes] = await Promise.all([
        purchaseOrdersAPI.list(),
        suppliersAPI.list(),
        inventoryAPI.list(),
        expensesAPI.list(),
      ])

      // Suppliers
      const suppliers: string[] = (suppRes.data.data || [])
        .filter((s: any) => s.status === 'aktif')
        .map((s: any) => s.nama)
      setPemasokOptions(suppliers)

      // Inventory as barang options
      const barang: BarangOption[] = (invRes.data.data || []).map((b: any) => ({
        id: b.id,
        kode: b.kode,
        nama: b.nama,
        kategori: b.kategori || 'Lainnya',
        satuan: b.satuan,
        harga: Number(b.hargaSatuan) || 0,
        pemasok: b.pemasok || '',
        panjangRoll: b.notes || '',
      }))
      setBarangOptions(barang)
      setKategoriOptions(Array.from(new Set([...DEFAULT_KATEGORI, ...barang.map(b => b.kategori || 'Lainnya')])).filter(Boolean))

      const res = poRes
      const raw: any[] = res.data.data || []
      const paidByRef = (expRes.data.data || []).reduce((map: Record<string, number>, e: any) => {
        if (e.refPO) map[e.refPO] = (map[e.refPO] || 0) + Number(e.jumlah || 0)
        return map
      }, {})
      setPoList(raw.map(r => ({
        id: r.id,
        noPO: r.noPO,
        tanggal: new Date(r.createdAt || r.orderDate).toLocaleDateString('id-ID'),
        pemasok: r.supplierName || '—',
        status: (DB_TO_STATUS[r.status] || 'draft') as StatusPO,
        paymentStatus: Number(paidByRef[r.noPO] || 0) >= Number(r.totalAmount || 0)
          ? 'PAID'
          : Number(paidByRef[r.noPO] || 0) > 0 ? 'PARTIAL' : 'UNPAID',
        paidAmount: Number(paidByRef[r.noPO] || 0),
        items: r.items ? JSON.parse(r.items).map((it: any, idx: number) => ({
          id: String(idx),
          inventoryId: it.inventoryId || undefined,
          barang: it.nama || it.barang || '',
          kode: it.kode || '',
          kategori: it.kategori || 'Lainnya',
          satuan: it.satuan || 'Pcs',
          qty: Number(it.qty) || 0,
          hargaSatuan: Number(it.harga || it.hargaSatuan) || 0,
          ...(() => { const p = parsePanjangRoll(it.panjangRoll || ''); return { panjangRoll: p.nilai, satuanRoll: p.satuan } })(),
        })) : [],
        catatan: r.notes || '',
        tanggalPesan: r.orderDate ? new Date(r.orderDate).toISOString().split('T')[0] : '',
        createdBy: 'Admin',
      })))
    } catch (err) {
      console.error('Failed to fetch POs:', err)
    } finally {
      setLoading(false)
    }
  }, [tenant?.id])

  useEffect(() => { fetchData() }, [fetchData])

  const filtered = useMemo(() => {
    return poList.filter((po) => {
      const q = search.toLowerCase()
      const matchQ = po.noPO.toLowerCase().includes(q) || po.pemasok.toLowerCase().includes(q)
      const matchStatus = filterStatus === 'semua' || po.status === filterStatus
      return matchQ && matchStatus
    })
  }, [poList, search, filterStatus])

  const stats = useMemo(() => ({
    total: poList.length,
    draft: poList.filter(p => p.status === 'draft').length,
    dikirim: poList.filter(p => p.status === 'dikirim').length,
    diterima: poList.filter(p => p.status === 'diterima').length,
    belumBayar: poList.filter(p => p.status !== 'dibatalkan' && p.paymentStatus !== 'PAID').length,
    nilaiTotal: poList.filter(p => p.status !== 'dibatalkan').reduce((s, p) => s + totalPO(p), 0),
  }), [poList])

  const openAdd = async () => {
    await fetchData()
    setEditingId(null)
    setForm(emptyForm(pemasokOptions[0] || ''))
    setShowForm(true)
  }

  const openEdit = async (po: PesananPembelian) => {
    await fetchData()
    setEditingId(po.id)
    setForm({
      pemasok: po.pemasok,
      tanggalPesan: po.tanggalPesan,
      catatan: po.catatan,
      items: po.items.map(i => ({ ...i })),
    })
    setShowForm(true)
  }

  const openPay = (po: PesananPembelian) => {
    setPayModal(po)
    setPayAmount(remainingPO(po))
  }

  const handleSave = async () => {
    if (!form.pemasok || form.items.length === 0) return
    setSaving(true)
    setSaveError('')
    try {
      const apiItems = form.items.map(i => ({ inventoryId: i.inventoryId || undefined, nama: i.barang, kode: i.kode, kategori: i.kategori || 'Lainnya', satuan: i.satuan, qty: i.qty, harga: i.hargaSatuan, panjangRoll: formatPanjangRoll(i.panjangRoll || '', i.satuanRoll || 'm') }))
      const total = form.items.reduce((s, i) => s + i.qty * i.hargaSatuan, 0)
      if (editingId) {
        await purchaseOrdersAPI.update(editingId, {
          supplierName: form.pemasok, notes: form.catatan,
          items: apiItems, totalAmount: total,
          ...(form.tanggalPesan ? { orderDate: new Date(form.tanggalPesan).toISOString() } : {}),
        })
      } else {
        await purchaseOrdersAPI.create({
          supplierName: form.pemasok,
          orderDate: form.tanggalPesan ? new Date(form.tanggalPesan).toISOString() : new Date().toISOString(),
          notes: form.catatan, items: apiItems, totalAmount: total, status: 'draft',
        })
      }
      setShowForm(false)
      fetchData()
    } catch (err: any) {
      console.error('Save PO failed:', err)
      setSaveError(err?.response?.data?.message || 'Gagal menyimpan. Coba lagi.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await purchaseOrdersAPI.delete(id)
      await fetchData()
      if (detailId === id) setDetailId(null)
    } catch (err) {
      console.error('Delete PO failed:', err)
    }
    setDeleteConfirmId(null)
  }

  const handleBayar = async () => {
    if (!payModal) return
    const amount = Number(payAmount) || 0
    if (amount <= 0) return
    setSaving(true)
    try {
      await expensesAPI.create({
        tanggal: new Date().toISOString().slice(0, 10),
        kategori: 'Pembelian Bahan',
        keterangan: `Pembayaran ${payModal.noPO} - ${payModal.pemasok || 'Pemasok'}`,
        pemasok: payModal.pemasok || undefined,
        refPO: payModal.noPO,
        jumlah: amount,
        dicatat: 'Desktop PO',
      })
      setPayModal(null)
      setPayAmount(0)
      await fetchData()
    } catch (err) {
      console.error('Bayar PO failed:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleChangeStatus = async (id: string, status: StatusPO) => {
    setStatusModal(null)
    if (status === 'diterima') {
      const po = poList.find(p => p.id === id)
      // Jangan proses ulang PO yang sudah diterima
      if (po?.status === 'diterima') return
      if (po) { setTerimaModal(po); setLinkMap({}); return }
    }
    try {
      await purchaseOrdersAPI.update(id, { status: STATUS_TO_DB[status] })
      await fetchData()
    } catch (err) {
      console.error('Status update failed:', err)
    }
  }

  // Fuzzy score: berapa kata dari needle yang ada di haystack
  const fuzzyScore = (needle: string, haystack: string): number => {
    const a = needle.toLowerCase()
    const b = haystack.toLowerCase()
    if (b.includes(a)) return 10
    const words = a.split(/\s+/)
    return words.filter(w => w.length > 2 && b.includes(w)).length
  }

  const fuzzyOptions = (itemName: string): BarangOption[] => {
    return barangOptions
      .map(b => ({ ...b, score: fuzzyScore(itemName, b.nama) }))
      .filter(b => b.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
  }

  const handleTerima = async () => {
    if (!terimaModal) return
    setSaving(true)
    setTerimaError('')
    try {
      // Jika ada linkMap, patch PO items dulu dengan inventoryId yang dipilih user
      const hasLinks = Object.keys(linkMap).length > 0
      if (hasLinks) {
        const updatedItems = terimaModal.items.map((item, idx) => ({
          inventoryId: linkMap[idx] || item.inventoryId || undefined,
          nama: item.barang,
          kode: item.kode,
          kategori: item.kategori || 'Lainnya',
          satuan: item.satuan,
          qty: item.qty,
          harga: item.hargaSatuan,
          panjangRoll: formatPanjangRoll(item.panjangRoll || '', item.satuanRoll || 'm'),
        }))
        await purchaseOrdersAPI.update(terimaModal.id, { items: updatedItems })
      }

      const res = await purchaseOrdersAPI.receive(terimaModal.id)
      const batches: { nama: string; qty: number; hargaPerUnit: number }[] = res.data.batches || []
      await fetchData()
      setTerimaModal(null)
      setLinkMap({})
      setTerimaResult({
        updated: batches.map(b => `${b.nama} +${b.qty} (Rp ${Math.round(b.hargaPerUnit).toLocaleString('id-ID')}/unit)`),
        notFound: [],
      })
    } catch (err: any) {
      console.error('Terima PO failed:', err)
      setTerimaError(err?.response?.data?.message || err?.message || 'Gagal memproses penerimaan. Coba lagi.')
    } finally {
      setSaving(false)
    }
  }

  // ── Form item helpers ──
  const updateItem = (idx: number, field: keyof ItemPO, val: string | number) => {
    setForm(f => {
      const items = f.items.map((it, i) => i === idx ? { ...it, [field]: val } : it)
      return { ...f, items }
    })
  }

  const addItem = () => {
    setForm(f => ({
      ...f,
      items: [...f.items, { id: Date.now().toString(), barang: '', kode: '', kategori: '', satuan: 'Pcs', qty: 1, hargaSatuan: 0, panjangRoll: '', satuanRoll: 'm' }],
    }))
  }

  const removeItem = (idx: number) => {
    setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))
  }

  const formTotal = form.items.reduce((s, i) => s + i.qty * i.hargaSatuan, 0)

  // Suggestions: item yang pernah dibeli dari pemasok yang sama
  const pemasokHistory = useMemo(() => {
    if (!form.pemasok) return []
    const seen = new Map<string, ItemPO>()
    poList
      .filter(po => po.pemasok === form.pemasok)
      .forEach(po => po.items.forEach(item => {
        if (item.barang && !seen.has(item.barang)) seen.set(item.barang, item)
      }))
    return Array.from(seen.values())
  }, [form.pemasok, poList])

  const detailPO = detailId ? poList.find(p => p.id === detailId) : null

  return (
    <div className="p-6 space-y-5">

      {/* Modal Konfirmasi Terima Barang */}
      {terimaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-lg border border-wm-line bg-white p-6 shadow-xl">
            <p className="text-base font-bold text-[#111] mb-1">📦 Konfirmasi Barang Diterima</p>
            <p className="text-[12px] text-[#888] mb-4">
              {terimaModal.noPO} · {terimaModal.pemasok}
            </p>
            <p className="text-[12px] font-semibold text-[#555] mb-2">Stok yang akan ditambahkan:</p>
            <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
              {terimaModal.items.map((item, i) => {
                const resolvedId = linkMap[i] || item.inventoryId
                const hasLink = !!resolvedId
                const opts = !item.inventoryId ? fuzzyOptions(item.barang) : []
                const linkedName = resolvedId ? barangOptions.find(b => b.id === resolvedId)?.nama : null
                return (
                  <div key={i} className={`rounded-lg border px-3 py-2.5 text-[12px] ${hasLink ? 'border-[#bbf7d0] bg-[#f0fdf4]' : 'border-[#fde68a] bg-[#fffbeb]'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[#111]">{item.barang}</span>
                      <span className={`font-bold flex-shrink-0 ${hasLink ? 'text-[#15803d]' : 'text-[#92400e]'}`}>
                        +{item.qty} {item.satuan}
                      </span>
                    </div>
                    {hasLink ? (
                      <p className="text-[11px] text-[#15803d] mt-0.5">
                        ✓ Terhubung ke: <span className="font-semibold">{linkedName || resolvedId}</span>
                        {linkMap[i] && (
                          <button onClick={() => setLinkMap(m => { const n = { ...m }; delete n[i]; return n })}
                            className="ml-2 text-[#94a3b8] hover:text-[#ef4444]">ubah</button>
                        )}
                      </p>
                    ) : (
                      <div className="mt-1.5">
                        <p className="text-[11px] text-[#b45309] mb-1">
                          ⚠ Nama tidak cocok dengan inventaris — tautkan ke item mana?
                        </p>
                        <select
                          value={linkMap[i] || ''}
                          onChange={e => setLinkMap(m => ({ ...m, [i]: e.target.value }))}
                          className="w-full rounded border border-[#fde68a] bg-white px-2 py-1 text-[12px] outline-none focus:border-[#f59e0b]"
                        >
                          <option value="">— Pilih item inventaris —</option>
                          {opts.length > 0 && (
                            <optgroup label="Kemungkinan cocok">
                              {opts.map(o => (
                                <option key={o.id} value={o.id}>{o.nama} ({o.satuan})</option>
                              ))}
                            </optgroup>
                          )}
                          <optgroup label="Semua inventaris">
                            {barangOptions
                              .filter(o => !opts.some(x => x.id === o.id))
                              .map(o => <option key={o.id} value={o.id}>{o.nama} ({o.satuan})</option>)
                            }
                          </optgroup>
                        </select>
                        <p className="text-[10px] text-[#94a3b8] mt-1">Jika tidak ditautkan, stok tetap masuk tapi batch FIFO tidak terbuat.</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            {terimaModal && (() => {
              const unlinked = terimaModal.items.filter((item, i) => !(linkMap[i] || item.inventoryId)).length
              return unlinked > 0 ? (
                <div className="mb-3 rounded border border-[#fde68a] bg-[#fffbeb] px-3 py-2 text-[12px] text-[#92400e]">
                  ⚠ <span className="font-semibold">{unlinked} item</span> tidak ter-link ke inventaris. Stok item tersebut tidak akan bertambah dan batch FIFO tidak terbuat.
                </div>
              ) : null
            })()}
            {terimaError && (
              <p className="text-[12px] text-[#dc2626] bg-[#fef2f2] border border-[#fecaca] rounded px-3 py-2 mb-3">{terimaError}</p>
            )}
            <div className="flex gap-2">
              <button onClick={handleTerima} disabled={saving}
                className="flex-1 rounded bg-[#16a34a] py-2 text-sm font-semibold text-white hover:bg-[#15803d] transition disabled:opacity-40">
                {saving ? 'Memproses...' : 'Konfirmasi Diterima'}
              </button>
              <button onClick={() => { setTerimaModal(null); setTerimaError(''); setLinkMap({}) }}
                className="flex-1 rounded border border-wm-line py-2 text-sm text-[#555] hover:bg-[#f8fafc] transition">
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Hasil Update Stok */}
      {terimaResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg border border-wm-line bg-white p-6 shadow-xl">
            <p className="text-base font-bold text-[#111] mb-3">✅ Barang Diterima</p>
            {terimaResult.updated.length > 0 && (
              <div className="mb-3">
                <p className="text-[11px] font-semibold text-[#16a34a] mb-1.5">Stok berhasil diupdate:</p>
                {terimaResult.updated.map((u, i) => (
                  <p key={i} className="text-[12px] text-[#333] pl-2">• {u}</p>
                ))}
              </div>
            )}
            {terimaResult.notFound.length > 0 && (
              <div className="mb-3">
                <p className="text-[11px] font-semibold text-[#f59e0b] mb-1.5">Tidak ditemukan di stok:</p>
                {terimaResult.notFound.map((u, i) => (
                  <p key={i} className="text-[12px] text-[#888] pl-2">• {u}</p>
                ))}
              </div>
            )}
            <button onClick={() => setTerimaResult(null)}
              className="mt-2 w-full rounded bg-brand py-2 text-sm font-semibold text-white hover:bg-brand-600 transition">
              OK
            </button>
          </div>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {[
          { label: 'Total PO', value: stats.total, sub: 'semua waktu', color: '#1E4FD8' },
          { label: 'Draft', value: stats.draft, sub: 'belum dikirim', color: '#64748b' },
          { label: 'Dikirim', value: stats.dikirim, sub: 'dalam perjalanan', color: '#1A45BF' },
          { label: 'Diterima', value: stats.diterima, sub: 'sudah masuk', color: '#15803d' },
          { label: 'Belum Bayar', value: stats.belumBayar, sub: 'perlu dicatat kas keluar', color: '#f97316' },
          { label: 'Nilai PO Aktif', value: fmt(stats.nilaiTotal), sub: 'draft + dikirim + diterima', color: '#7c3aed', isText: true },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-xl border border-wm-line p-4">
            <p className="text-[11px] text-[#888] font-medium">{c.label}</p>
            <p className={`text-${c.isText ? 'base' : '2xl'} font-bold mt-1`} style={{ color: c.color }}>
              {c.value}
            </p>
            <p className="text-[10px] text-[#aaa] mt-0.5">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <input
            className="rounded border border-[#cbd5e1] px-3 py-1.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-[#dbeafe] w-56"
            placeholder="Cari no. PO atau pemasok..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select
            className="rounded border border-[#cbd5e1] px-3 py-1.5 text-sm outline-none focus:border-brand"
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value as typeof filterStatus)}
          >
            <option value="semua">Semua Status</option>
            <option value="draft">Draft</option>
            <option value="dikirim">Dikirim</option>
            <option value="diterima">Diterima</option>
            <option value="dibatalkan">Dibatalkan</option>
          </select>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 bg-brand hover:bg-brand-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
        >
          <span className="text-base leading-none">+</span> Buat PO
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-wm-line overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#f8fafc] text-[#555] text-[11px] font-semibold uppercase tracking-wide border-b border-wm-line">
                <th className="px-4 py-3 text-left">No. PO</th>
                <th className="px-4 py-3 text-left">Tanggal</th>
                <th className="px-4 py-3 text-left">Pemasok</th>
                <th className="px-4 py-3 text-left">Barang</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-left">Tgl. Pesan</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-[#aaa] text-sm">
                    Tidak ada pesanan pembelian ditemukan.
                  </td>
                </tr>
              )}
              {filtered.map((po) => (
                <tr key={po.id} className="border-b border-[#f1f5f9] hover:bg-[#f8fafc] transition">
                  <td className="px-4 py-3 font-semibold text-brand">{po.noPO}</td>
                  <td className="px-4 py-3 text-[#555]">{po.tanggal}</td>
                  <td className="px-4 py-3 text-[#333]">{po.pemasok}</td>
                  <td className="px-4 py-3 text-[#555]">
                    <div className="space-y-0.5">
                      {Object.values(
                        po.items.reduce((acc, it) => {
                          const key = it.kode || it.barang
                          if (acc[key]) {
                            acc[key] = { ...acc[key], qty: acc[key].qty + it.qty }
                          } else {
                            acc[key] = { ...it }
                          }
                          return acc
                        }, {} as Record<string, ItemPO>)
                      ).map((it, i) => (
                        <div key={i} className="text-[12px]">
                          <span className="font-medium text-[#333]">{it.barang}</span>
                          <span className="text-[#aaa] ml-1">×{it.qty} {it.satuan}</span>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-[#111]">{fmt(totalPO(po))}</td>
                  <td className="px-4 py-3 text-[#555]">{po.tanggalPesan || '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => setStatusModal({ id: po.id, current: po.status })}
                      className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full transition hover:opacity-75 ${STATUS_COLOR[po.status]}`}
                    >
                      {STATUS_LABEL[po.status]}
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1 flex-wrap">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${PAYMENT_COLOR[po.paymentStatus]}`}>
                        {PAYMENT_LABEL[po.paymentStatus]}
                      </span>
                      {po.paymentStatus !== 'PAID' && po.status !== 'dibatalkan' && (
                        <button
                          onClick={() => openPay(po)}
                          className="text-xs px-2.5 py-1 rounded border border-[#f97316] text-[#c2410c] hover:bg-[#fff7ed] transition"
                        >
                          Bayar
                        </button>
                      )}
                      <button
                        onClick={() => setDetailId(po.id)}
                        className="text-xs px-2.5 py-1 rounded border border-[#cbd5e1] text-[#555] hover:bg-[#f1f5f9] transition"
                      >
                        Detail
                      </button>
                      <button
                        onClick={() => downloadPO(po, tenant?.name || 'Workshop')}
                        className="text-xs px-2.5 py-1 rounded border border-[#7c3aed] text-[#7c3aed] hover:bg-[#f5f3ff] transition"
                        title="Download PDF"
                      >
                        PDF
                      </button>
                      {po.status !== 'dibatalkan' && (
                        <button
                          onClick={() => openEdit(po)}
                          className="text-xs px-2.5 py-1 rounded border border-brand text-brand hover:bg-brand-50 transition"
                        >
                          Edit
                        </button>
                      )}
                      {po.status === 'draft' && (
                        <button
                          onClick={() => setDeleteConfirmId(po.id)}
                          className="text-xs px-2.5 py-1 rounded border border-[#fca5a5] text-[#dc2626] hover:bg-[#fef2f2] transition"
                        >
                          Hapus
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Detail Modal ── */}
      {detailPO && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-wm-line">
              <div>
                <p className="text-xs text-[#888]">Pesanan Pembelian</p>
                <h2 className="text-lg font-bold text-[#111]">{detailPO.noPO}</h2>
              </div>
              <button onClick={() => setDetailId(null)} className="text-[#aaa] hover:text-[#333] text-xl leading-none mt-1">✕</button>
            </div>
            <div className="px-6 py-4 space-y-4">
              {/* Meta */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-[11px] text-[#888] font-semibold">PEMASOK</p>
                  <p className="font-medium text-[#111]">{detailPO.pemasok}</p>
                </div>
                <div>
                  <p className="text-[11px] text-[#888] font-semibold">STATUS</p>
                  <span className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full ${STATUS_COLOR[detailPO.status]}`}>
                    {STATUS_LABEL[detailPO.status]}
                  </span>
                </div>
                <div>
                  <p className="text-[11px] text-[#888] font-semibold">PEMBAYARAN</p>
                  <span className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full ${PAYMENT_COLOR[detailPO.paymentStatus]}`}>
                    {PAYMENT_LABEL[detailPO.paymentStatus]}
                  </span>
                  <p className="text-[11px] text-[#888] mt-1">{fmt(detailPO.paidAmount || 0)} / {fmt(totalPO(detailPO))}</p>
                </div>
                <div>
                  <p className="text-[11px] text-[#888] font-semibold">TANGGAL PO</p>
                  <p className="text-[#333]">{detailPO.tanggal}</p>
                </div>
                <div>
                  <p className="text-[11px] text-[#888] font-semibold">ESTIMASI TIBA</p>
                  <p className="text-[#333]">{detailPO.tanggalPesan || '—'}</p>
                </div>
              </div>

              {detailPO.catatan && (
                <div className="bg-[#fffbeb] border border-[#fde68a] rounded-lg px-3 py-2 text-sm text-[#92400e]">
                  <span className="font-semibold">Catatan: </span>{detailPO.catatan}
                </div>
              )}

              {/* Items Table */}
              <div>
                <p className="text-[11px] font-semibold text-[#555] mb-2">ITEM PESANAN</p>
                <table className="w-full text-sm border border-wm-line rounded-lg overflow-hidden">
                  <thead className="bg-[#f8fafc] text-[#555] text-[11px] uppercase">
                    <tr>
                      <th className="px-3 py-2 text-left">Barang</th>
                      <th className="px-3 py-2 text-left">Kode</th>
                      <th className="px-3 py-2 text-center">Qty</th>
                      <th className="px-3 py-2 text-left">Satuan</th>
                      <th className="px-3 py-2 text-right">Harga</th>
                      <th className="px-3 py-2 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailPO.items.map((it) => (
                      <tr key={it.id} className="border-t border-[#f1f5f9]">
                        <td className="px-3 py-2">{it.barang}</td>
                        <td className="px-3 py-2 text-[#888]">{it.kode}</td>
                        <td className="px-3 py-2 text-center">{it.qty}</td>
                        <td className="px-3 py-2 text-[#888]">
                          {it.satuan}
                          {it.panjangRoll && String(it.satuan).toLowerCase().includes('roll') && (
                            <span className="text-[10px] text-[#aaa] ml-1">({it.panjangRoll}{it.satuanRoll || 'm'}/roll)</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">{fmt(it.hargaSatuan)}</td>
                        <td className="px-3 py-2 text-right font-semibold">{fmt(it.qty * it.hargaSatuan)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[#f8fafc] border-t-2 border-wm-line">
                      <td colSpan={5} className="px-3 py-2 text-right font-bold text-[#333]">Total</td>
                      <td className="px-3 py-2 text-right font-bold text-brand">{fmt(totalPO(detailPO))}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                {detailPO.paymentStatus !== 'PAID' && detailPO.status !== 'dibatalkan' && (
                  <button
                    onClick={() => { openPay(detailPO); setDetailId(null) }}
                    className="text-sm px-4 py-2 rounded-lg border border-[#f97316] text-[#c2410c] hover:bg-[#fff7ed] transition font-semibold"
                  >
                    Bayar
                  </button>
                )}
                {detailPO.status !== 'dibatalkan' && (
                  <button
                    onClick={() => { openEdit(detailPO); setDetailId(null) }}
                    className="text-sm px-4 py-2 rounded-lg border border-brand text-brand hover:bg-brand-50 transition font-semibold"
                  >
                    Edit
                  </button>
                )}
                <button
                  onClick={() => setDetailId(null)}
                  className="text-sm px-4 py-2 rounded-lg bg-[#f1f5f9] text-[#555] hover:bg-[#e2e8f0] transition font-semibold"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Status Modal ── */}
      {payModal && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div>
              <h3 className="font-bold text-[#111]">Catat Pembayaran PO</h3>
              <p className="text-sm text-[#555] mt-1">
                Nominal yang dibayar akan dicatat ke Pengeluaran dan Aliran Kas untuk {payModal.noPO}.
              </p>
            </div>
            <div className="rounded-lg border border-wm-line bg-[#f8fafc] p-3">
              <div className="flex justify-between text-sm">
                <span className="text-[#666]">Pemasok</span>
                <span className="font-semibold text-[#111]">{payModal.pemasok}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-[#666]">Total PO</span>
                <span className="font-bold text-[#c2410c]">{fmt(totalPO(payModal))}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-[#666]">Sudah Dibayar</span>
                <span className="font-semibold text-[#111]">{fmt(payModal.paidAmount || 0)}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-[#666]">Sisa</span>
                <span className="font-bold text-[#111]">{fmt(remainingPO(payModal))}</span>
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#555] mb-1">Nominal Dibayar</label>
              <input
                type="number"
                min="1"
                max={remainingPO(payModal)}
                value={payAmount || ''}
                onChange={e => setPayAmount(Number(e.target.value))}
                className="w-full rounded border border-[#cbd5e1] bg-white px-3 py-2 text-sm text-[#111] outline-none focus:border-brand focus:ring-2 focus:ring-[#dbeafe] transition"
              />
              <div className="flex gap-2 mt-2">
                <button onClick={() => setPayAmount(remainingPO(payModal))} className="text-xs px-3 py-1.5 rounded bg-[#f1f5f9] text-[#555] font-semibold">Bayar Sisa</button>
                <button onClick={() => setPayAmount(Math.round(remainingPO(payModal) / 2))} className="text-xs px-3 py-1.5 rounded bg-[#f1f5f9] text-[#555] font-semibold">50%</button>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setPayModal(null)}
                className="text-sm px-4 py-2 rounded-lg bg-[#f1f5f9] text-[#555] hover:bg-[#e2e8f0] transition"
              >
                Batal
              </button>
              <button
                onClick={handleBayar}
                disabled={saving || payAmount <= 0 || payAmount > remainingPO(payModal)}
                className="text-sm px-4 py-2 rounded-lg bg-[#f97316] text-white hover:bg-[#ea580c] transition font-semibold disabled:opacity-50"
              >
                {saving ? 'Menyimpan...' : 'Bayar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {statusModal && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xs p-6 space-y-4">
            <h3 className="font-bold text-[#111]">Ubah Status</h3>
            <p className="text-sm text-[#555]">Pilih status baru untuk PO ini.</p>
            <div className="space-y-2">
              {(['draft', 'dikirim', 'diterima', 'dibatalkan'] as StatusPO[]).map((s) => (
                <button
                  key={s}
                  onClick={() => handleChangeStatus(statusModal.id, s)}
                  className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-semibold border transition
                    ${statusModal.current === s
                      ? 'border-brand bg-brand-50 text-brand'
                      : 'border-wm-line hover:bg-[#f8fafc] text-[#333]'
                    }`}
                >
                  {STATUS_LABEL[s]}
                  {statusModal.current === s && <span className="float-right text-brand">✓</span>}
                </button>
              ))}
            </div>
            <button
              onClick={() => setStatusModal(null)}
              className="w-full text-sm text-[#888] hover:text-[#333] transition"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-bold text-[#111]">Hapus Pesanan?</h3>
            <p className="text-sm text-[#666]">PO yang dihapus tidak bisa dikembalikan.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteConfirmId(null)} className="text-sm px-4 py-2 rounded-lg bg-[#f1f5f9] text-[#555] hover:bg-[#e2e8f0] transition">Batal</button>
              <button onClick={() => handleDelete(deleteConfirmId)} className="text-sm px-4 py-2 rounded-lg bg-[#dc2626] text-white hover:bg-[#b91c1c] transition font-semibold">Hapus</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Form Modal ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-6xl flex flex-col" style={{ maxHeight: '95vh' }}>
            {/* Header — tidak ikut scroll */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-wm-line flex-shrink-0">
              <h2 className="text-base font-bold text-[#111]">
                {editingId ? 'Edit Pesanan Pembelian' : 'Buat Pesanan Pembelian'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-[#aaa] hover:text-[#333] text-xl leading-none">✕</button>
            </div>

            {/* Body — scrollable */}
            <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">
              {/* Header fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 md:col-span-1">
                  <label className={labelCls}>Pemasok *</label>
                  <select
                    className={inputCls}
                    value={form.pemasok}
                    onChange={e => setForm(f => ({ ...f, pemasok: e.target.value }))}
                  >
                    {pemasokOptions.length === 0
                      ? <option value="">— Belum ada pemasok aktif —</option>
                      : pemasokOptions.map(p => <option key={p}>{p}</option>)
                    }
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Tanggal Pesan</label>
                  <input
                    type="date"
                    className={inputCls}
                    value={form.tanggalPesan}
                    onChange={e => setForm(f => ({ ...f, tanggalPesan: e.target.value }))}
                  />
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Catatan</label>
                  <textarea
                    className={inputCls + ' resize-none'}
                    rows={2}
                    placeholder="Keterangan tambahan (opsional)"
                    value={form.catatan}
                    onChange={e => setForm(f => ({ ...f, catatan: e.target.value }))}
                  />
                </div>
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-semibold text-[#555] uppercase tracking-wide">Item Pesanan</p>
                  <button
                    onClick={addItem}
                    className="text-xs text-brand font-semibold hover:underline"
                  >
                    + Tambah Item
                  </button>
                </div>

                <div className="space-y-2">
                  {form.items.map((it, idx) => (
                    <div key={it.id} className="bg-[#f8fafc] rounded-lg px-4 py-3">
                      <div className="flex gap-2 items-end overflow-x-auto">
                        {/* Barang */}
                        <div className="w-48 flex-shrink-0">
                          <label className={labelCls}>Barang</label>
                          <input
                            ref={el => { barangInputRefs.current[idx] = el }}
                            type="text"
                            className={inputCls}
                            placeholder="Nama barang..."
                            value={it.barang}
                            onChange={e => { updateItem(idx, 'barang', e.target.value); setSuggestionIdx(idx) }}
                            onFocus={() => {
                              const el = barangInputRefs.current[idx]
                              if (el) {
                                const r = el.getBoundingClientRect()
                                setSuggestionPos({ top: r.bottom + 4, left: r.left, width: r.width })
                              }
                              setSuggestionIdx(idx)
                            }}
                            onBlur={() => setTimeout(() => setSuggestionIdx(null), 150)}
                          />
                        </div>
                        {/* Kategori */}
                        <div className="w-48 flex-shrink-0">
                          <label className={labelCls}>Kategori</label>
                          {addingKategori === idx ? (
                            <div className="flex gap-1">
                              <input autoFocus value={newKategoriVal} onChange={e => setNewKategoriVal(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') { e.preventDefault(); const v = newKategoriVal.trim(); if (v && !kategoriOptions.includes(v)) setKategoriOptions(p => [...p, v]); if (v) updateItem(idx, 'kategori', v); setAddingKategori(null); setNewKategoriVal('') }
                                  if (e.key === 'Escape') { setAddingKategori(null); setNewKategoriVal('') }
                                }}
                                placeholder="Baru" className={inputCls + ' flex-1 min-w-0'} />
                              <button type="button" onClick={() => { const v = newKategoriVal.trim(); if (v && !kategoriOptions.includes(v)) setKategoriOptions(p => [...p, v]); if (v) updateItem(idx, 'kategori', v); setAddingKategori(null); setNewKategoriVal('') }} className="px-1.5 py-1 rounded bg-brand text-white text-xs font-bold">✓</button>
                              <button type="button" onClick={() => { setAddingKategori(null); setNewKategoriVal('') }} className="px-1.5 py-1 rounded border border-wm-line text-xs text-[#555]">×</button>
                            </div>
                          ) : (
                            <div className="flex gap-1">
                              <select className={inputCls + ' flex-1 min-w-0'} value={it.kategori || ''}
                                onChange={e => { const k = e.target.value; updateItem(idx, 'kategori', k); if (k === 'Paint Protection Film' && !['Roll', 'Meter'].includes(it.satuan)) updateItem(idx, 'satuan', 'Roll') }}>
                                <option value="">Pilih</option>
                                {it.kategori && !kategoriOptions.includes(it.kategori) && <option value={it.kategori}>{it.kategori}</option>}
                                {kategoriOptions.map(k => <option key={k} value={k}>{k}</option>)}
                              </select>
                              <button type="button" onClick={() => { setAddingKategori(idx); setNewKategoriVal('') }} className="px-1.5 py-1 rounded border border-brand text-brand text-xs font-bold hover:bg-brand-50 flex-shrink-0">+</button>
                            </div>
                          )}
                        </div>
                        {/* Qty */}
                        <div className="w-14 flex-shrink-0">
                          <label className={labelCls}>Qty</label>
                          <input type="number" min={1} className={inputCls} value={it.qty}
                            onChange={e => updateItem(idx, 'qty', Number(e.target.value))} />
                        </div>
                        {/* Satuan */}
                        <div className="w-24 flex-shrink-0">
                          <label className={labelCls}>Satuan</label>
                          {addingSatuan === idx ? (
                            <div className="flex gap-1">
                              <input autoFocus value={newSatuanVal} onChange={e => setNewSatuanVal(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') { const v = newSatuanVal.trim(); if (v && !satuanOptions.includes(v)) setSatuanOptions(p => [...p, v]); if (v) updateItem(idx, 'satuan', v); setAddingSatuan(null); setNewSatuanVal('') }
                                  if (e.key === 'Escape') { setAddingSatuan(null); setNewSatuanVal('') }
                                }}
                                placeholder="Baru" className={inputCls + ' flex-1 min-w-0'} />
                              <button type="button" onClick={() => { const v = newSatuanVal.trim(); if (v && !satuanOptions.includes(v)) setSatuanOptions(p => [...p, v]); if (v) updateItem(idx, 'satuan', v); setAddingSatuan(null); setNewSatuanVal('') }} className="px-1.5 py-1 rounded bg-brand text-white text-xs font-bold">✓</button>
                              <button type="button" onClick={() => { setAddingSatuan(null); setNewSatuanVal('') }} className="px-1.5 py-1 rounded border border-wm-line text-xs text-[#555]">×</button>
                            </div>
                          ) : (
                            <div className="flex gap-1">
                              <select className={inputCls + ' flex-1 min-w-0'} value={it.satuan} onChange={e => updateItem(idx, 'satuan', e.target.value)}>
                                {it.satuan && !satuanOptions.includes(it.satuan) && <option value={it.satuan}>{it.satuan}</option>}
                                {(it.kategori === 'Paint Protection Film' ? ['Roll', 'Meter'] : satuanOptions).map(s => <option key={s}>{s}</option>)}
                              </select>
                              <button type="button" onClick={() => { setAddingSatuan(idx); setNewSatuanVal('') }} className="px-1.5 py-1 rounded border border-brand text-brand text-xs font-bold hover:bg-brand-50 flex-shrink-0">+</button>
                            </div>
                          )}
                        </div>
                        {/* Panjang/Roll — inline setelah Satuan */}
                        {String(it.satuan).toLowerCase().includes('roll') && (
                          <div className="w-32 flex-shrink-0">
                            <label className={labelCls}>Panjang/Roll</label>
                            <div className="flex items-center gap-1">
                              <input type="number" min={0} step="0.1" className={inputCls + ' flex-1 min-w-0'}
                                value={it.panjangRoll || ''} onChange={e => updateItem(idx, 'panjangRoll', e.target.value)} />
                              <select className="rounded border border-[#cbd5e1] bg-white px-1 py-2 text-[12px] text-[#111] outline-none focus:border-brand transition flex-shrink-0"
                                value={it.satuanRoll || 'm'} onChange={e => updateItem(idx, 'satuanRoll', e.target.value)}>
                                <option value="m">m</option>
                                <option value="cm">cm</option>
                              </select>
                            </div>
                          </div>
                        )}
                        {/* Harga */}
                        <div className="w-32 flex-shrink-0">
                          <label className={labelCls}>Harga/Satuan</label>
                          <input type="text" inputMode="numeric" className={inputCls}
                            value={fmtNumberInput(it.hargaSatuan)}
                            onChange={e => updateItem(idx, 'hargaSatuan', Number(cleanNumber(e.target.value)))} />
                        </div>
                        {/* Subtotal + Remove */}
                        <div className="flex flex-col gap-1 flex-shrink-0">
                          <label className={labelCls}>Subtotal</label>
                          <div className="flex items-center gap-2">
                            <div className="w-28 rounded border border-[#cbd5e1] bg-[#f1f5f9] px-3 py-2 text-sm font-semibold text-[#333] whitespace-nowrap">
                              {fmt(it.qty * it.hargaSatuan)}
                            </div>
                            {form.items.length > 1 && (
                              <button onClick={() => removeItem(idx)} className="text-[#dc2626] hover:text-[#b91c1c] text-base leading-none" title="Hapus item">✕</button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Grand Total */}
                <div className="mt-3 flex justify-end">
                  <div className="bg-brand-50 border border-[#D9E3FC] rounded-lg px-4 py-2 text-sm font-bold text-brand">
                    Total: {fmt(formTotal)}
                  </div>
                </div>
              </div>

              {saveError && (
                <p className="text-sm text-[#dc2626] bg-[#fef2f2] border border-[#fecaca] rounded px-3 py-2">{saveError}</p>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => { setShowForm(false); setSaveError('') }}
                  className="text-sm px-4 py-2 rounded-lg bg-[#f1f5f9] text-[#555] hover:bg-[#e2e8f0] transition"
                >
                  Batal
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !form.pemasok || form.items.length === 0}
                  className="text-sm px-5 py-2 rounded-lg bg-brand text-white hover:bg-brand-600 font-semibold transition disabled:opacity-40"
                >
                  {saving ? 'Menyimpan...' : editingId ? 'Simpan Perubahan' : 'Buat PO'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dropdown suggestion barang — fixed agar tidak terpotong modal scroll */}
      {suggestionIdx !== null && suggestionPos && showForm && (() => {
        const fromInv = barangOptions.map(b => ({ inventoryId: b.id, barang: b.nama, kode: b.kode, kategori: b.kategori || 'Lainnya', satuan: b.satuan, hargaSatuan: b.harga, panjangRoll: b.panjangRoll || '' }))
        const seen = new Set(fromInv.map(b => b.barang.toLowerCase()))
        const idx = suggestionIdx
        const currentBarang = form.items[idx]?.barang || ''
        const combined = [...fromInv, ...pemasokHistory.filter(h => !seen.has(h.barang.toLowerCase()))]
        const filtered2 = combined.filter(h => !currentBarang || h.barang.toLowerCase().includes(currentBarang.toLowerCase())).slice(0, 12)
        return filtered2.length > 0 && (
          <div
            className="fixed bg-white border border-wm-line rounded-lg shadow-lg z-[200] max-h-52 overflow-y-auto"
            style={{ top: suggestionPos.top, left: suggestionPos.left, width: Math.max(suggestionPos.width, 220) }}
          >
            {filtered2.map((h, i) => (
              <button key={i} type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => {
                  if ((h as any).inventoryId) updateItem(idx, 'inventoryId', (h as any).inventoryId)
                  updateItem(idx, 'barang', h.barang)
                  updateItem(idx, 'kode', h.kode || '')
                  updateItem(idx, 'kategori', h.kategori || 'Lainnya')
                  updateItem(idx, 'satuan', h.satuan)
                  updateItem(idx, 'hargaSatuan', h.hargaSatuan)
                  const pr = parsePanjangRoll(h.panjangRoll || ''); updateItem(idx, 'panjangRoll', pr.nilai); updateItem(idx, 'satuanRoll', pr.satuan)
                  setSuggestionIdx(null)
                }}
                className="w-full text-left px-3 py-2 hover:bg-[#f8fafc] border-b border-[#f1f5f9] last:border-0">
                <p className="text-[12px] font-semibold text-[#111]">{h.barang}</p>
                <p className="text-[10px] text-[#aaa]">{h.satuan} · {fmt(h.hargaSatuan)}</p>
              </button>
            ))}
          </div>
        )
      })()}
    </div>
  )
}
