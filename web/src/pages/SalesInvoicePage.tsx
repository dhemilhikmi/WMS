import { useState, useEffect, useCallback } from 'react'
import { registrationsAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { loadCompanySettings } from '../hooks/useCompanySettings'

interface Invoice {
  no: string
  name: string
  service: string
  total: string
  totalNum: number
  dpAmount: number
  date: string
  status: string      // LUNAS | PENDING | OVERDUE
  workStatus: string  // in_progress | qc_check | completed
  teknisi: string
  phone: string
  kendaraan: string
  plat: string
  regId?: string
}

const parseDP = (notes?: string) =>
  Number(notes?.match(/(?:^|\|)dp:(\d+(?:\.\d+)?)/i)?.[1] || notes?.match(/DP:\s*Rp\s*([\d.]+)/i)?.[1]?.replace(/\./g, '') || 0)

// Map registration from API → Invoice
// paymentStatus dari DB diutamakan; pekerjaan selesai tidak otomatis lunas.
function regToInvoice(r: any): Invoice {
  const totalNum = r.workshop?.price ? Number(r.workshop.price) : 0
  const dpAmount = Math.min(parseDP(r.notes), totalNum)
  const teknisiMatch = r.notes?.match(/^teknisi:([^|]+)/)
  const teknisi = teknisiMatch ? teknisiMatch[1].split(',').map((t: string) => t.trim()).join(', ') : '—'
  const checkInDate = r.updatedAt || r.createdAt
  const date = new Date(checkInDate).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '/')
  const invNo = 'INV-' + r.id.slice(-6).toUpperCase()

  let status = 'PENDING'
  if (r.paymentStatus) {
    const normalized = r.paymentStatus.toUpperCase()
    status = ['LUNAS', 'PENDING', 'OVERDUE'].includes(normalized) ? normalized : 'PENDING'
  }

  return {
    no: invNo,
    name: r.customer?.name || 'Pelanggan',
    service: r.workshop?.title || 'Layanan',
    total: totalNum > 0 ? 'Rp ' + totalNum.toLocaleString('id-ID') : '—',
    totalNum,
    dpAmount,
    date,
    status,
    workStatus: r.status || 'in_progress',
    teknisi,
    phone: r.customer?.phone || '—',
    kendaraan: r.vehicleName || '—',
    plat: r.licensePlate || '—',
    regId: r.id,
  }
}

const fmtRp = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID', { maximumFractionDigits: 0 })

const filterTabs = ['Semua', 'Lunas', 'Pending', 'Overdue']

function statusColor(status: string) {
  if (status === 'LUNAS') return { bg: '#dcfce7', fg: '#16a34a' }
  if (status === 'PENDING') return { bg: '#fef3c7', fg: '#f59e0b' }
  return { bg: '#fee2e2', fg: '#dc2626' }
}

function workStatusBadge(ws: string) {
  if (ws === 'completed')   return { label: 'Selesai', bg: '#dcfce7', fg: '#16a34a' }
  if (ws === 'qc_check')    return { label: 'QC',      bg: '#ede9fe', fg: '#7c3aed' }
  return                           { label: 'Proses',  bg: '#dbeafe', fg: '#1E4FD8' }
}

// ─── Load saved template settings ─────────────────────────────────────────────

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
  pajakRate: 11,
  diskonRate: 0,
  termin: 'NET 30',
  catatan: 'Pembayaran dapat dilakukan melalui transfer bank. Harap cantumkan nomor invoice pada keterangan transfer.',
  ttd1Nama: 'Admin', ttd1Jabatan: 'Staf Admin',
  ttd2Nama: 'Manager', ttd2Jabatan: 'Manajer Workshop',
  ttd3Nama: '', ttd3Jabatan: '',
}

// ─── Print invoice ─────────────────────────────────────────────────────────────

async function printInvoice(inv: Invoice) {
  const company = await loadCompanySettings()
  const doc = loadSaved('wms_doc_settings_invoice', defaultDoc)

  const afterDp = Math.max(0, inv.totalNum - inv.dpAmount)
  const pajak = Math.round(afterDp * (doc.pajakRate / 100))
  const diskon = Math.round(afterDp * (doc.diskonRate / 100))
  const total = afterDp - diskon + pajak
  const fmt = (n: number) => 'Rp ' + n.toLocaleString('id-ID')
  const accent = doc.accentColor
  const logoSize = Number(doc.logoSize || 140)
  const logoZoom = Number(doc.logoZoom || 1)
  const companyFont = String(doc.companyNameFont || 'Inter').replace(/'/g, '')
  const logoSrc = company.logoDataUrl || (window.location.origin + '/workshopmu-logo.svg')
  const logoHtml = doc.showLogo
    ? `<div style="width:${logoSize}px;height:${Math.round(logoSize * 0.7)}px;display:flex;align-items:center;justify-content:flex-start;margin-bottom:6px;overflow:hidden;">
        <img src="${logoSrc}" style="width:100%;height:100%;object-fit:contain;display:block;transform:scale(${logoZoom});transform-origin:left center;" />
      </div>`
    : ''

  const html = `<!DOCTYPE html>
<html><head><title>${inv.no}</title>
<meta charset="utf-8">
<style>
* { box-sizing: border-box; margin: 0; padding: 0;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important; }
body { font-family: 'Segoe UI', Arial, sans-serif; padding: 32px; color: #111; font-size: 12px; }
@page { margin: 12mm; size: A4 portrait; }
@media print { body { padding: 0; } }

table  { display: table !important; width: 100% !important; border-collapse: collapse !important; }
thead  { display: table-header-group !important; }
tbody  { display: table-row-group !important; }
tr     { display: table-row !important; }
th, td { display: table-cell !important; padding: 5px 7px !important;
         text-align: left !important; vertical-align: top !important; word-break: break-word; }
th { background: ${accent} !important; color: #fff !important; font-size: 10px !important; font-weight: 700 !important; }
td { font-size: 10px !important; border-bottom: 1px solid #f1f5f9; }
</style>
</head><body><div style="width:794px;min-height:1123px;background:#fff;padding:40px 48px;font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#111;line-height:1.5;margin:0 auto;">

<!-- Header -->
<div style="border-bottom: 2px solid ${accent}; padding-bottom: 14px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-start;">
  <div>
    ${logoHtml}
    <div style="font-family: '${companyFont}', 'Segoe UI', Arial, sans-serif; font-weight: 800; font-size: 18px; margin-bottom: 4px;">${company.nama}</div>
    <div style="font-size: 10px; color: #555; line-height: 1.6;">
      ${company.alamat}<br>${company.kota}<br>${company.telp} · ${company.email}
      ${doc.showNpwp ? `<br>NPWP: ${company.npwp}` : ''}
    </div>
  </div>
  <div style="text-align: right;">
    <div style="font-size: 24px; font-weight: 900; color: ${accent}; letter-spacing: -0.5px;">INVOICE</div>
    <div style="font-size: 11px; color: #888; margin-top: 4px;">No. ${inv.no}</div>
    <div style="display: inline-block; margin-top: 6px; padding: 3px 10px; border-radius: 4px; background: ${accent}18; color: ${accent}; font-size: 10px; font-weight: 700;">
      ${inv.status}
    </div>
  </div>
</div>

<!-- Bill to + Details -->
<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
  <div style="border: 1px solid #e2e8f0; border-radius: 4px; padding: 10px;">
    <div style="font-size: 9px; font-weight: 700; color: #aaa; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">Tagihan Kepada</div>
    <div style="font-weight: 700; font-size: 12px;">${inv.name}</div>
    <div style="font-size: 10px; color: #555; line-height: 1.6;">${inv.phone}<br>${inv.kendaraan} · ${inv.plat}</div>
  </div>
  <div style="border: 1px solid #e2e8f0; border-radius: 4px; padding: 10px;">
    <div style="font-size: 9px; font-weight: 700; color: #aaa; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">Detail Invoice</div>
    ${[['Tanggal', inv.date], ['Termin', doc.termin], ['Kendaraan', `${inv.kendaraan} · ${inv.plat}`], ['Teknisi', inv.teknisi]].map(([k, v]) =>
      `<div style="display: flex; justify-content: space-between; font-size: 10px; padding: 1px 0;">
        <span style="color: #888;">${k}</span>
        <span style="font-weight: 600;">${v}</span>
      </div>`
    ).join('')}
  </div>
</div>

<!-- Items -->
<table style="margin-bottom: 8px;">
  <thead><tr>
    <th>#</th><th>Deskripsi Layanan</th><th>SKU</th><th>Qty</th><th>Satuan</th><th>Harga Satuan</th><th>Jumlah</th>
  </tr></thead>
  <tbody>
    <tr><td style="color:#888;">1</td><td style="font-weight:600;">${inv.service}</td><td style="color:#888;">—</td><td>1</td><td>Unit</td><td>${fmt(inv.totalNum)}</td><td style="font-weight:700;">${fmt(inv.totalNum)}</td></tr>
  </tbody>
</table>

<!-- Totals -->
<div style="margin-left: auto; width: 220px; margin-top: 8px;">
  <div style="display:flex; justify-content:space-between; padding:3px 0; font-size:10px; color:#555; border-bottom:1px solid #f1f5f9;">
    <span>Subtotal</span><span>${fmt(inv.totalNum)}</span>
  </div>
  ${doc.diskonRate > 0 ? `<div style="display:flex; justify-content:space-between; padding:3px 0; font-size:10px; color:#555; border-bottom:1px solid #f1f5f9;">
    <span>Diskon (${doc.diskonRate}%)</span><span>- ${fmt(diskon)}</span>
  </div>` : ''}
  ${inv.dpAmount > 0 ? `<div style="display:flex; justify-content:space-between; padding:3px 0; font-size:10px; color:#555; border-bottom:1px solid #f1f5f9;">
    <span>DP / Uang Muka</span><span>- ${fmt(inv.dpAmount)}</span>
  </div>` : ''}
  <div style="display:flex; justify-content:space-between; padding:3px 0; font-size:10px; color:#555; border-bottom:1px solid #f1f5f9;">
    <span>PPN ${doc.pajakRate}%</span><span>${fmt(pajak)}</span>
  </div>
  <div style="display:flex; justify-content:space-between; padding:6px 8px; background:#f1f5f9; border-radius:4px; margin-top:4px; font-weight:700; font-size:12px;">
    <span>TOTAL</span><span style="color:${accent};">${fmt(total)}</span>
  </div>
</div>

${doc.catatan ? `<div style="margin-top:12px; padding:8px 10px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:4px; font-size:10px; color:#555;">
  <span style="font-weight:700;">Catatan: </span>${doc.catatan}
</div>` : ''}

${doc.showTtd ? `<div style="margin-top:24px; display:flex; gap:12px;">
  ${[
    { label: 'Disiapkan oleh', nama: doc.ttd1Nama, jabatan: doc.ttd1Jabatan },
    { label: 'Disetujui oleh', nama: doc.ttd2Nama, jabatan: doc.ttd2Jabatan },
    ...(doc.ttd3Nama ? [{ label: 'Diterima oleh', nama: doc.ttd3Nama, jabatan: doc.ttd3Jabatan }] : []),
  ].map(s => `<div style="flex:1; border:1px solid #e2e8f0; border-radius:4px; padding:10px 12px;">
    <div style="font-size:10px; color:#888; margin-bottom:32px;">${s.label}</div>
    <div style="border-top:1px solid #333; padding-top:4px;">
      <div style="font-size:10px; font-weight:700;">${s.nama || '_______________'}</div>
      <div style="font-size:9px; color:#888;">${s.jabatan || '_______________'}</div>
    </div>
  </div>`).join('')}
</div>` : ''}

<!-- Footer -->
<div style="margin-top:16px; padding-top:8px; border-top:1px solid #e2e8f0; display:flex; justify-content:space-between;">
  <div style="font-size:9px; color:#aaa;">Dokumen ini diterbitkan oleh ${company.nama}</div>
  <div style="font-size:9px; color:#aaa;">Cetak: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} · Hal. 1/1</div>
</div>

</div></body></html>`

  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => { win.print(); win.close() }, 300)
}

// ─── Main ──────────────────────────────────────────────────────────────────────

export default function SalesInvoicePage() {
  const { tenant } = useAuth()
  const [activeFilter, setActiveFilter] = useState('Semua')
  const [search, setSearch] = useState('')
  const [detailInv, setDetailInv] = useState<Invoice | null>(null)
  const [editInv, setEditInv] = useState<Invoice | null>(null)
  const [editForm, setEditForm] = useState<Invoice | null>(null)
  const [invoiceList, setInvoiceList] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [statusConfirm, setStatusConfirm] = useState<{ inv: Invoice; newStatus: string } | null>(null)
  const [savingStatus, setSavingStatus] = useState(false)

  // ── Fetch checked-in registrations ──
  const fetchInvoices = useCallback(async () => {
    if (!tenant?.id) { setLoading(false); return }
    try {
      setLoading(true)
      const res = await registrationsAPI.list(tenant.id)
      const regs: any[] = res.data.data || []
      const checkedIn = regs.filter(r =>
        ['in_progress', 'qc_check', 'completed'].includes(r.status)
      )
      setInvoiceList(checkedIn.map(r => regToInvoice(r)))
    } catch (err) {
      console.error('Failed to fetch invoices:', err)
    } finally { setLoading(false) }
  }, [tenant?.id])

  useEffect(() => { fetchInvoices() }, [tenant?.id])

  // ── Derived stats ──
  const lunas    = invoiceList.filter(i => i.status === 'LUNAS')
  const pending  = invoiceList.filter(i => i.status === 'PENDING')
  const overdue  = invoiceList.filter(i => i.status === 'OVERDUE')
  const totalRev = lunas.reduce((s, i) => s + i.totalNum, 0)
  const outstanding = [...pending, ...overdue].reduce((s, i) => s + i.totalNum, 0)
  const avgPerBooking = invoiceList.length > 0 ? Math.round(totalRev / Math.max(lunas.length, 1)) : 0
  const fmt = (n: number) => n >= 1_000_000 ? `Rp ${(n/1_000_000).toFixed(1)}JT` : `Rp ${(n/1_000).toFixed(0)}K`

  const stats = [
    { label: 'Total Pendapatan',  value: fmt(totalRev),          sub: `${lunas.length} invoice lunas`,             accent: true  },
    { label: 'Invoice Lunas',     value: lunas.length.toString(), sub: `dari ${invoiceList.length} total`,          accent: false },
    { label: 'Outstanding',       value: fmt(outstanding),        sub: `${pending.length + overdue.length} belum lunas`, accent: false },
    { label: 'Avg. per Booking',  value: fmt(avgPerBooking),      sub: 'rata-rata per transaksi',                  accent: false },
  ]

  const openEdit = (inv: Invoice) => { setEditInv(inv); setEditForm({ ...inv }) }

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editForm || !tenant?.id) return
    const statusChanged = editInv && editInv.status !== editForm.status
    if (editForm.regId) {
      try {
        await registrationsAPI.update(editForm.regId, {
          tenantId: tenant.id,
          paymentStatus: editForm.status.toLowerCase(),
        })
      } catch (err) { console.error('Failed to save payment status:', err) }
    }
    setInvoiceList(prev => prev.map(i => i.no === editForm.no ? editForm : i))
    setEditInv(null)
    setEditForm(null)
    // Tampilkan notif singkat jika status berubah
    if (statusChanged) {
      const msg = `Status pembayaran diubah ke ${editForm.status}`
      const el = document.createElement('div')
      el.textContent = msg
      el.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#111;color:#fff;padding:8px 18px;border-radius:8px;font-size:13px;z-index:9999;pointer-events:none'
      document.body.appendChild(el)
      setTimeout(() => el.remove(), 2500)
    }
  }

  const requestChangeStatus = (inv: Invoice, newStatus: string) => {
    if (inv.status === newStatus) return
    setStatusConfirm({ inv, newStatus })
  }

  const confirmChangeStatus = async () => {
    if (!statusConfirm || !tenant?.id) return
    const { inv, newStatus } = statusConfirm
    setSavingStatus(true)
    try {
      await registrationsAPI.update(inv.regId!, {
        tenantId: tenant.id,
        paymentStatus: newStatus.toLowerCase(),
      })
      setInvoiceList(prev => prev.map(i => i.no === inv.no ? { ...i, status: newStatus } : i))
      setStatusConfirm(null)
    } catch (err) {
      console.error('Failed to save payment status:', err)
      await fetchInvoices()
    } finally {
      setSavingStatus(false)
    }
  }

  const filtered = invoiceList.filter(inv => {
    const matchFilter = activeFilter === 'Semua' ||
      (activeFilter === 'Lunas'   && inv.status === 'LUNAS') ||
      (activeFilter === 'Pending' && inv.status === 'PENDING') ||
      (activeFilter === 'Overdue' && inv.status === 'OVERDUE')
    const q = search.toLowerCase()
    const matchSearch = !q || inv.no.toLowerCase().includes(q) ||
      inv.name.toLowerCase().includes(q) || inv.service.toLowerCase().includes(q)
    return matchFilter && matchSearch
  })

  return (
    <div className="p-6 space-y-5">

      {/* Konfirmasi ubah status pembayaran */}
      {statusConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg border border-wm-line bg-white p-6 shadow-xl">
            <p className="text-base font-bold text-[#111] mb-1">Konfirmasi Ubah Status</p>
            <p className="text-[12px] text-[#888] mb-4">{statusConfirm.inv.no} · {statusConfirm.inv.name}</p>
            <div className="flex items-center gap-3 mb-5 p-3 rounded-lg bg-[#f8fafc] border border-wm-line">
              <div className="text-center flex-1">
                <p className="text-[10px] text-[#aaa] mb-1">Status Sekarang</p>
                <span className="inline-block text-[12px] font-bold px-3 py-1 rounded-full"
                  style={{ background: statusColor(statusConfirm.inv.status).bg, color: statusColor(statusConfirm.inv.status).fg }}>
                  {statusConfirm.inv.status}
                </span>
              </div>
              <span className="text-[#bbb] text-lg">→</span>
              <div className="text-center flex-1">
                <p className="text-[10px] text-[#aaa] mb-1">Status Baru</p>
                <span className="inline-block text-[12px] font-bold px-3 py-1 rounded-full"
                  style={{ background: statusColor(statusConfirm.newStatus).bg, color: statusColor(statusConfirm.newStatus).fg }}>
                  {statusConfirm.newStatus}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={confirmChangeStatus} disabled={savingStatus}
                className="flex-1 rounded bg-brand py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50 transition">
                {savingStatus ? 'Menyimpan...' : 'Ya, Ubah Status'}
              </button>
              <button onClick={() => setStatusConfirm(null)} disabled={savingStatus}
                className="flex-1 rounded border border-wm-line py-2 text-sm text-[#555] hover:bg-[#f8fafc] transition">
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editInv && editForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-lg border border-wm-line bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between mb-5">
              <div>
                <p className="text-base font-bold text-[#111]">Edit Invoice</p>
                <p className="text-[12px] text-[#888] mt-0.5">{editInv.no}</p>
              </div>
              <button onClick={() => setEditInv(null)} className="text-[#aaa] hover:text-[#555] text-xl leading-none">×</button>
            </div>
            <form onSubmit={handleEditSave} className="space-y-3">
              <div className="grid gap-3 grid-cols-2">
                <div>
                  <label className="block text-[11px] font-semibold text-[#555] mb-1">Pelanggan</label>
                  <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full rounded border border-[#cbd5e1] px-3 py-2 text-sm outline-none focus:border-brand transition" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#555] mb-1">No. HP</label>
                  <input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full rounded border border-[#cbd5e1] px-3 py-2 text-sm outline-none focus:border-brand transition" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#555] mb-1">Layanan</label>
                  <input value={editForm.service} onChange={(e) => setEditForm({ ...editForm, service: e.target.value })}
                    className="w-full rounded border border-[#cbd5e1] px-3 py-2 text-sm outline-none focus:border-brand transition" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#555] mb-1">Teknisi</label>
                  <input value={editForm.teknisi} onChange={(e) => setEditForm({ ...editForm, teknisi: e.target.value })}
                    className="w-full rounded border border-[#cbd5e1] px-3 py-2 text-sm outline-none focus:border-brand transition" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#555] mb-1">Kendaraan</label>
                  <input value={editForm.kendaraan} onChange={(e) => setEditForm({ ...editForm, kendaraan: e.target.value })}
                    className="w-full rounded border border-[#cbd5e1] px-3 py-2 text-sm outline-none focus:border-brand transition" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#555] mb-1">Plat Nomor</label>
                  <input value={editForm.plat} onChange={(e) => setEditForm({ ...editForm, plat: e.target.value })}
                    className="w-full rounded border border-[#cbd5e1] px-3 py-2 text-sm outline-none focus:border-brand transition" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#555] mb-1">Tanggal</label>
                  <input value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                    className="w-full rounded border border-[#cbd5e1] px-3 py-2 text-sm outline-none focus:border-brand transition" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#555] mb-1">Status</label>
                  <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    className="w-full rounded border border-[#cbd5e1] px-3 py-2 text-sm outline-none focus:border-brand transition">
                    <option value="LUNAS">LUNAS</option>
                    <option value="PENDING">PENDING</option>
                    <option value="OVERDUE">OVERDUE</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#555] mb-1">Total (Rp)</label>
                <input type="number" value={editForm.totalNum}
                  onChange={(e) => setEditForm({ ...editForm, totalNum: Number(e.target.value), total: 'Rp ' + Number(e.target.value).toLocaleString('id-ID') })}
                  className="w-full rounded border border-[#cbd5e1] px-3 py-2 text-sm outline-none focus:border-brand transition" />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="submit" className="flex-1 rounded bg-brand py-2 text-sm font-semibold text-white hover:bg-brand-600 transition">
                  Simpan
                </button>
                <button type="button" onClick={() => setEditInv(null)} className="flex-1 rounded border border-wm-line py-2 text-sm text-[#555] hover:bg-[#f8fafc] transition">
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {detailInv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg border border-wm-line bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-base font-bold text-[#111]">{detailInv.no}</p>
                <p className="text-[12px] text-[#888] mt-0.5">{detailInv.date}</p>
              </div>
              <button onClick={() => setDetailInv(null)} className="text-[#aaa] hover:text-[#555] text-xl leading-none">×</button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {[
                  ['Pelanggan', detailInv.name],
                  ['Layanan', detailInv.service],
                  ['Kendaraan', detailInv.kendaraan],
                  ['Plat', detailInv.plat],
                  ['Teknisi', detailInv.teknisi],
                  ['No. HP', detailInv.phone],
                ].map(([k, v]) => (
                  <div key={k}>
                    <p className="text-[10px] text-[#999]">{k}</p>
                    <p className="text-[13px] font-semibold text-[#111]">{v}</p>
                  </div>
                ))}
              </div>

              <div className="rounded border border-wm-line bg-[#f8fafc] px-4 py-3 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-[12px] text-[#555]">Harga Layanan</span>
                  <span className="text-[13px] font-semibold text-[#111]">{detailInv.total}</span>
                </div>
                {detailInv.dpAmount > 0 && (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-[12px] text-[#f59e0b]">DP / Uang Muka</span>
                      <span className="text-[13px] font-semibold text-[#f59e0b]">− {fmtRp(detailInv.dpAmount)}</span>
                    </div>
                    <div className="border-t border-wm-line pt-1.5 flex justify-between items-center">
                      <span className="text-[12px] font-bold text-[#555]">Tagihan</span>
                      <span className="text-base font-bold text-brand">{fmtRp(detailInv.totalNum - detailInv.dpAmount)}</span>
                    </div>
                  </>
                )}
                {detailInv.dpAmount === 0 && (
                  <div className="border-t border-wm-line pt-1.5 flex justify-between items-center">
                    <span className="text-[12px] font-bold text-[#555]">Tagihan</span>
                    <span className="text-base font-bold text-brand">{fmtRp(detailInv.totalNum)}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div>
                    <p className="text-[10px] text-[#999]">Status Bayar</p>
                    <span className="inline-block px-2.5 py-0.5 rounded text-[11px] font-bold mt-1"
                      style={{ background: statusColor(detailInv.status).bg, color: statusColor(detailInv.status).fg }}>
                      {detailInv.status}
                    </span>
                  </div>
                  <div>
                    <p className="text-[10px] text-[#999]">Status Servis</p>
                    {(() => { const wb = workStatusBadge(detailInv.workStatus); return (
                      <span className="inline-block px-2.5 py-0.5 rounded text-[11px] font-bold mt-1"
                        style={{ background: wb.bg, color: wb.fg }}>{wb.label}</span>
                    )})()}
                  </div>
                </div>
                <button
                  onClick={() => { setDetailInv(null); printInvoice(detailInv) }}
                  className="px-4 py-2 rounded bg-brand text-white text-[12px] font-semibold hover:bg-brand-600 transition"
                >
                  PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold text-[#111]">Penjualan & Invoice</h1>
        <div className="flex gap-2">
          <button onClick={fetchInvoices}
            className="px-3 py-1.5 rounded border border-wm-line bg-white text-[12px] text-[#555] hover:bg-[#f8fafc]">
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <div key={s.label} className="rounded-lg border border-wm-line bg-white p-5">
            <p className="text-xs text-[#999]">{s.label}</p>
            <p className={`mt-2 text-3xl font-bold ${s.accent ? 'text-brand' : 'text-[#111]'}`}>{s.value}</p>
            <p className="mt-1 text-xs text-[#16a34a]">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Invoice table */}
      <div className="rounded-lg border border-wm-line bg-white overflow-visible">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#f1f5f9]">
          <p className="text-sm font-bold text-[#111]">Daftar Invoice</p>
          <div className="flex-1 max-w-[220px] flex items-center gap-2 rounded border border-wm-line px-2.5 py-1">
            <span className="text-xs">🔍</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari invoice..."
              className="flex-1 outline-none text-[12px]"
            />
          </div>
          <div className="flex gap-1.5">
            {filterTabs.map((f) => (
              <button key={f} onClick={() => setActiveFilter(f)}
                className={`px-3 py-1 rounded text-[11px] font-medium transition ${
                  activeFilter === f ? 'bg-brand text-white' : 'border border-wm-line bg-white text-[#888] hover:border-[#cbd5e1]'
                }`}>
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-[1fr_1fr_1.3fr_1fr_0.9fr_0.9fr_0.9fr_0.6fr_0.7fr_0.8fr_0.8fr] px-4 py-2.5 bg-[#f8fafc] border-b border-[#f1f5f9]">
          {['No. Invoice', 'Pelanggan', 'Layanan', 'Teknisi', 'Total', 'DP', 'Tagihan', 'Tgl.', 'Servis', 'Status', 'Aksi'].map((h) => (
            <p key={h} className="text-[11px] font-bold text-[#888]">{h}</p>
          ))}
        </div>

        {loading ? (
          <p className="px-4 py-8 text-center text-[12px] text-[#aaa]">Memuat data...</p>
        ) : filtered.length === 0 ? (
          <p className="px-4 py-8 text-center text-[12px] text-[#aaa]">
            {invoiceList.length === 0
              ? 'Belum ada invoice. Lakukan check-in pada booking agar muncul di sini.'
              : 'Tidak ada invoice ditemukan.'}
          </p>
        ) : (
          filtered.map((inv) => {
            const colors = statusColor(inv.status)
            return (
              <div key={inv.no}
                className="grid grid-cols-[1fr_1fr_1.3fr_1fr_0.9fr_0.9fr_0.9fr_0.6fr_0.7fr_0.8fr_0.8fr] px-4 py-3 border-b border-[#f1f5f9] last:border-b-0 hover:bg-[#fafbfc] items-center">
                <p className="text-[12px] font-semibold text-brand">{inv.no}</p>
                <p className="text-[12px] text-[#444]">{inv.name}</p>
                <p className="text-[12px] text-[#444]">{inv.service}</p>
                <div className="flex items-center gap-1.5">
                  <div className="h-5 w-5 rounded-full bg-[#dbeafe] flex items-center justify-center flex-shrink-0">
                    <span className="text-[9px] font-bold text-brand">{inv.teknisi[0]}</span>
                  </div>
                  <p className="text-[11px] text-[#555]">{inv.teknisi}</p>
                </div>
                <p className="text-[12px] font-semibold text-[#111] whitespace-nowrap">{inv.total}</p>
                <p className="text-[12px] text-[#f59e0b] font-semibold whitespace-nowrap">
                  {inv.dpAmount > 0 ? fmtRp(inv.dpAmount) : '—'}
                </p>
                <p className="text-[12px] font-bold text-brand whitespace-nowrap">
                  {fmtRp(inv.totalNum - inv.dpAmount)}
                </p>
                <p className="text-[12px] text-[#666]">{inv.date}</p>
                <div>
                  {(() => { const wb = workStatusBadge(inv.workStatus); return (
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold"
                      style={{ background: wb.bg, color: wb.fg }}>{wb.label}</span>
                  )})()}
                </div>
                <div className="relative group">
                  <button
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition hover:opacity-80"
                    style={{ background: colors.bg, color: colors.fg }}
                    title="Klik untuk ubah status"
                  >
                    {inv.status} <span className="opacity-60">▾</span>
                  </button>
                  <div className="absolute left-0 top-full mt-1 z-50 hidden group-focus-within:block group-hover:block bg-white border border-wm-line rounded shadow-lg overflow-hidden min-w-[110px]">
                    {['LUNAS', 'PENDING', 'OVERDUE'].map(s => {
                      const sc = statusColor(s)
                      const isCurrent = inv.status === s
                      return (
                        <button key={s}
                          onClick={() => requestChangeStatus(inv, s)}
                          disabled={isCurrent}
                          className="w-full text-left px-3 py-1.5 text-[11px] font-semibold hover:bg-[#f8fafc] flex items-center gap-2 disabled:opacity-40 disabled:cursor-default"
                          style={{ color: sc.fg }}>
                          <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: sc.fg }} />
                          {s}{isCurrent && ' ✓'}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setDetailInv(inv)}
                    className="px-2 py-1 rounded border border-wm-line text-[10px] text-[#555] hover:bg-[#f8fafc] transition">
                    Lihat
                  </button>
                  <button onClick={() => openEdit(inv)}
                    className="px-2 py-1 rounded border border-wm-line text-[10px] text-[#555] hover:bg-[#f8fafc] transition">
                    Edit
                  </button>
                  <button onClick={() => printInvoice(inv)}
                    className="px-2 py-1 rounded border border-brand text-[10px] text-brand font-semibold hover:bg-brand-50 transition">
                    PDF
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      <div className="rounded-lg border border-[#dbeafe] bg-brand-50 px-4 py-3 text-[12px] text-brand">
        💡 Analisis lengkap tersedia di <a href="/admin/sales/summary" className="font-semibold underline hover:no-underline">Ringkasan Penjualan</a>
      </div>
    </div>
  )
}
