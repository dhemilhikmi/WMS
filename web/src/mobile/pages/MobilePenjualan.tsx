import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { registrationsAPI } from '../../services/api'
import { MobileSubHeader } from '../MobileLayout'
import { loadCompanySettings } from '../../hooks/useCompanySettings'

type InvoiceStatus = 'LUNAS' | 'PENDING' | 'OVERDUE'

interface Invoice {
  no: string
  name: string
  service: string
  totalNum: number
  dpAmount: number
  date: string
  status: InvoiceStatus
  teknisi: string
  phone: string
  kendaraan: string
  plat: string
  regId: string
}

const parseDP = (notes?: string) =>
  Number(notes?.match(/(?:^|\|)dp:(\d+(?:\.\d+)?)/i)?.[1] || notes?.match(/DP:\s*Rp\s*([\d.]+)/i)?.[1]?.replace(/\./g, '') || 0)

const FILTERS = ['Semua', 'Lunas', 'Pending', 'Overdue'] as const


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
  ttd1Nama: 'Admin',
  ttd1Jabatan: 'Staf Admin',
  ttd2Nama: 'Manager',
  ttd2Jabatan: 'Manajer Workshop',
  ttd3Nama: '',
  ttd3Jabatan: '',
}

function loadSaved<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback
  } catch { return fallback }
}

function fmtRp(n: number) {
  return 'Rp ' + Math.round(n).toLocaleString('id-ID')
}

function fmtShortRp(n: number) {
  if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1)}JT`
  if (n >= 1_000) return `Rp ${(n / 1_000).toFixed(0)}K`
  return fmtRp(n)
}

function fmtDate(s?: string) {
  return s ? new Date(s).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'
}

function parseTeknisi(notes?: string) {
  const match = notes?.match(/^teknisi:([^|]+)/)
  return match ? match[1].split(',').map(t => t.trim()).filter(Boolean).join(', ') : '-'
}

function normalizeStatus(paymentStatus?: string, _workStatus?: string): InvoiceStatus {
  const raw = (paymentStatus || '').toUpperCase()
  if (raw === 'PAID') return 'LUNAS'
  if (raw === 'UNPAID') return 'PENDING'
  if (raw === 'LUNAS' || raw === 'PENDING' || raw === 'OVERDUE') return raw
  return 'PENDING'
}

function statusStyle(status: InvoiceStatus) {
  if (status === 'LUNAS') return { bg: '#dcfce7', fg: '#16a34a', label: 'Lunas' }
  if (status === 'OVERDUE') return { bg: '#fee2e2', fg: '#dc2626', label: 'Overdue' }
  return { bg: '#fef3c7', fg: '#f59e0b', label: 'Pending' }
}

function regToInvoice(r: any): Invoice {
  const totalNum = Number(r.workshop?.price || 0)
  const dpAmount = Math.min(parseDP(r.notes), totalNum)
  return {
    no: 'INV-' + String(r.id || '').slice(-6).toUpperCase(),
    name: r.customer?.name || 'Pelanggan',
    service: r.workshop?.title || 'Layanan',
    totalNum,
    dpAmount,
    date: fmtDate(r.updatedAt || r.createdAt),
    status: normalizeStatus(r.paymentStatus, r.status),
    teknisi: parseTeknisi(r.notes),
    phone: r.customer?.phone || '-',
    kendaraan: r.vehicleName || '-',
    plat: r.licensePlate || '-',
    regId: r.id,
  }
}

async function printInvoice(inv: Invoice) {
  const company = await loadCompanySettings()
  const doc = loadSaved('wms_doc_settings_invoice', defaultDoc)
  const afterDp = Math.max(0, inv.totalNum - inv.dpAmount)
  const pajak = Math.round(afterDp * (Number(doc.pajakRate || 0) / 100))
  const diskon = Math.round(afterDp * (Number(doc.diskonRate || 0) / 100))
  const grandTotal = afterDp - diskon + pajak
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

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${inv.no}</title><style>
*{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
body{font-family:'Segoe UI',Arial,sans-serif;padding:32px;color:#111;font-size:12px}
@page{margin:12mm;size:A4 portrait}
@media print{body{padding:0}}
table{display:table!important;width:100%!important;border-collapse:collapse!important}
thead{display:table-header-group!important}tbody{display:table-row-group!important}tr{display:table-row!important}
th,td{display:table-cell!important;padding:5px 7px!important;text-align:left!important;vertical-align:top!important;word-break:break-word}
th{background:${accent}!important;color:#fff!important;font-size:10px!important;font-weight:700!important}
td{font-size:10px!important;border-bottom:1px solid #f1f5f9}
</style></head><body><div style="width:794px;min-height:1123px;background:#fff;padding:40px 48px;font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#111;line-height:1.5;margin:0 auto;">
<div style="border-bottom:2px solid ${accent};padding-bottom:14px;margin-bottom:16px;display:flex;justify-content:space-between;gap:16px">
  <div>
    ${logoHtml}
    <div style="font-family:'${companyFont}','Segoe UI',Arial,sans-serif;font-size:18px;font-weight:800">${company.nama}</div>
    <div style="font-size:10px;color:#555;margin-top:4px">${company.alamat}<br>${company.kota}<br>${company.telp} - ${company.email}${doc.showNpwp ? `<br>NPWP: ${company.npwp}` : ''}</div>
  </div>
  <div style="text-align:right">
    <div style="font-size:24px;font-weight:900;color:${accent}">INVOICE</div>
    <div style="font-size:11px;color:#888">No. ${inv.no}</div>
    <div style="display:inline-block;margin-top:7px;padding:4px 10px;border-radius:4px;background:${accent}18;color:${accent};font-size:10px;font-weight:700">${inv.status}</div>
  </div>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
  <div style="border:1px solid #e2e8f0;border-radius:4px;padding:10px">
    <div style="font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;margin-bottom:6px">Tagihan Kepada</div>
    <div style="font-weight:700">${inv.name}</div>
    <div style="font-size:10px;color:#555">${inv.phone}<br>${inv.kendaraan} - ${inv.plat}</div>
  </div>
  <div style="border:1px solid #e2e8f0;border-radius:4px;padding:10px">
    <div style="font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;margin-bottom:6px">Detail Invoice</div>
    <div style="display:flex;justify-content:space-between;font-size:10px"><span>Tanggal</span><b>${inv.date}</b></div>
    <div style="display:flex;justify-content:space-between;font-size:10px"><span>Termin</span><b>${doc.termin}</b></div>
    <div style="display:flex;justify-content:space-between;font-size:10px"><span>Teknisi</span><b>${inv.teknisi}</b></div>
  </div>
</div>
<table><thead><tr><th>#</th><th>Deskripsi Layanan</th><th>Qty</th><th>Harga</th><th>Jumlah</th></tr></thead>
<tbody><tr><td>1</td><td><b>${inv.service}</b></td><td>1</td><td>${fmtRp(inv.totalNum)}</td><td><b>${fmtRp(inv.totalNum)}</b></td></tr></tbody></table>
<div style="margin-left:auto;width:240px;margin-top:12px;font-size:10px">
  <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #f1f5f9"><span>Subtotal</span><span>${fmtRp(inv.totalNum)}</span></div>
  ${diskon > 0 ? `<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #f1f5f9"><span>Diskon</span><span>- ${fmtRp(diskon)}</span></div>` : ''}
  ${inv.dpAmount > 0 ? `<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #f1f5f9"><span>DP / Uang Muka</span><span>- ${fmtRp(inv.dpAmount)}</span></div>` : ''}
  <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #f1f5f9"><span>PPN ${doc.pajakRate}%</span><span>${fmtRp(pajak)}</span></div>
  <div style="display:flex;justify-content:space-between;padding:8px;margin-top:5px;background:#f1f5f9;border-radius:4px;font-size:12px;font-weight:800"><span>TOTAL</span><span style="color:${accent}">${fmtRp(grandTotal)}</span></div>
</div>
${doc.catatan ? `<div style="margin-top:14px;padding:9px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px;font-size:10px;color:#555"><b>Catatan:</b> ${doc.catatan}</div>` : ''}
${doc.showTtd ? `<div style="margin-top:26px;display:flex;gap:12px"><div style="flex:1;border:1px solid #e2e8f0;border-radius:4px;padding:10px"><div style="font-size:10px;color:#888;margin-bottom:34px">Disiapkan oleh</div><b>${doc.ttd1Nama || '_______________'}</b><div style="font-size:9px;color:#888">${doc.ttd1Jabatan || ''}</div></div><div style="flex:1;border:1px solid #e2e8f0;border-radius:4px;padding:10px"><div style="font-size:10px;color:#888;margin-bottom:34px">Disetujui oleh</div><b>${doc.ttd2Nama || '_______________'}</b><div style="font-size:9px;color:#888">${doc.ttd2Jabatan || ''}</div></div></div>` : ''}
</div></body></html>`

  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 300)
}

export default function MobilePenjualan() {
  const { tenant } = useAuth()
  const [items, setItems] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('Semua')
  const [selected, setSelected] = useState<Invoice | null>(null)
  const [confirm, setConfirm] = useState<{ inv: Invoice; status: InvoiceStatus } | null>(null)
  const [saving, setSaving] = useState(false)

  const fetchInvoices = useCallback(async () => {
    if (!tenant?.id) return
    setLoading(true)
    try {
      const res = await registrationsAPI.list(tenant.id)
      const regs: any[] = res.data.data || []
      const checkedIn = regs.filter(r => ['in_progress', 'qc_check', 'completed'].includes(r.status))
      setItems(checkedIn.map(regToInvoice))
    } finally {
      setLoading(false)
    }
  }, [tenant?.id])

  useEffect(() => { fetchInvoices() }, [fetchInvoices])

  const stats = useMemo(() => {
    const lunas = items.filter(i => i.status === 'LUNAS')
    const pending = items.filter(i => i.status === 'PENDING')
    const overdue = items.filter(i => i.status === 'OVERDUE')
    const totalRev = lunas.reduce((s, i) => s + i.totalNum, 0)
    const outstanding = [...pending, ...overdue].reduce((s, i) => s + i.totalNum, 0)
    const avg = items.length ? Math.round(totalRev / Math.max(lunas.length, 1)) : 0
    return { lunas, pending, overdue, totalRev, outstanding, avg }
  }, [items])

  const filtered = useMemo(() => {
    const status = filter.toUpperCase()
    const q = search.toLowerCase()
    return items.filter(i => {
      if (filter !== 'Semua' && i.status !== status) return false
      if (!q) return true
      return `${i.no} ${i.name} ${i.service} ${i.plat} ${i.kendaraan}`.toLowerCase().includes(q)
    })
  }, [items, filter, search])

  const updateStatus = async () => {
    if (!tenant?.id || !confirm) return
    setSaving(true)
    try {
      await registrationsAPI.update(confirm.inv.regId, { tenantId: tenant.id, paymentStatus: confirm.status })
      setConfirm(null)
      setSelected(null)
      await fetchInvoices()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal mengubah status pembayaran')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <MobileSubHeader title="Penjualan" subtitle={loading ? 'Memuat...' : `${filtered.length} invoice`} />
      <div className="px-4 pt-3 pb-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Total Pendapatan" value={fmtShortRp(stats.totalRev)} sub={`${stats.lunas.length} invoice lunas`} color="#16a34a" />
          <StatCard label="Invoice Lunas" value={String(stats.lunas.length)} sub={`dari ${items.length} total`} color="#1E4FD8" />
          <StatCard label="Outstanding" value={fmtShortRp(stats.outstanding)} sub={`${stats.pending.length + stats.overdue.length} belum lunas`} color="#f59e0b" />
          <StatCard label="Avg. per Booking" value={fmtShortRp(stats.avg)} sub="rata-rata transaksi" color="#7c3aed" />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`shrink-0 rounded-full px-3 py-2 text-[12px] font-semibold border ${filter === f ? 'bg-brand text-white border-[#1E4FD8]' : 'bg-white text-ink-3 border-wm-line'}`}
            >
              {f}
            </button>
          ))}
        </div>

        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cari invoice, pelanggan, layanan, plat..."
          className="w-full bg-white border border-wm-line rounded-2xl px-3 py-2.5 text-[13px] outline-none focus:border-[#1E4FD8]"
        />

        {loading && <p className="text-center text-[12px] text-ink-4 py-6">Memuat...</p>}
        {!loading && filtered.length === 0 && (
          <div className="bg-white rounded-2xl border border-wm-line p-8 text-center">
            <p className="text-[13px] text-[#666]">Belum ada invoice</p>
          </div>
        )}

        <div className="space-y-2">
          {filtered.map(inv => {
            const st = statusStyle(inv.status)
            return (
              <button
                key={inv.regId}
                onClick={() => setSelected(inv)}
                className="w-full text-left bg-white rounded-2xl border border-wm-line p-3 active:bg-wm-bg"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-bold truncate">{inv.no}</p>
                      <span className="rounded-full px-2 py-0.5 text-[9px] font-bold" style={{ background: st.bg, color: st.fg }}>
                        {st.label}
                      </span>
                    </div>
                    <p className="text-[12px] text-ink font-semibold truncate mt-1">{inv.name}</p>
                    <p className="text-[11px] text-ink-3 truncate">{inv.plat} - {inv.service}</p>
                    <p className="text-[10px] text-ink-4 mt-1">{inv.date} - Teknisi: {inv.teknisi}</p>
                  </div>
                  <p className="shrink-0 text-[13px] font-extrabold text-[#16a34a]">{fmtRp(inv.totalNum)}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end" onClick={() => setSelected(null)}>
          <div className="w-full max-h-[88vh] overflow-y-auto bg-white rounded-t-3xl p-4 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] text-ink-3">Invoice</p>
                <h2 className="text-[18px] font-extrabold">{selected.no}</h2>
              </div>
              <span className="rounded-full px-3 py-1 text-[11px] font-bold" style={{ background: statusStyle(selected.status).bg, color: statusStyle(selected.status).fg }}>
                {statusStyle(selected.status).label}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[12px]">
              <Info label="Pelanggan" value={selected.name} />
              <Info label="Telepon" value={selected.phone} />
              <Info label="Kendaraan" value={selected.kendaraan} />
              <Info label="Plat" value={selected.plat} />
              <Info label="Layanan" value={selected.service} wide />
              <Info label="Teknisi" value={selected.teknisi} />
              <Info label="Tanggal" value={selected.date} />
            </div>

            <div className="rounded-2xl bg-wm-bg border border-wm-line p-3 flex items-center justify-between">
              <span className="text-[12px] text-ink-3">Total Invoice</span>
              <span className="text-[18px] font-extrabold text-[#16a34a]">{fmtRp(selected.totalNum)}</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {(['LUNAS', 'PENDING', 'OVERDUE'] as InvoiceStatus[]).map(s => (
                <button
                  key={s}
                  onClick={() => setConfirm({ inv: selected, status: s })}
                  disabled={selected.status === s}
                  className={`rounded-2xl py-2.5 text-[11px] font-bold border ${selected.status === s ? 'bg-wm-bg text-ink-4 border-wm-line' : 'bg-white text-ink border-[#cbd5e1]'}`}
                >
                  {statusStyle(s).label}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <button onClick={() => printInvoice(selected)} className="flex-1 rounded-2xl bg-brand text-white py-3 text-[13px] font-bold">
                PDF
              </button>
              <button onClick={() => setSelected(null)} className="w-24 rounded-2xl bg-wm-bg text-ink-3 py-3 text-[13px] font-bold">
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {confirm && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-end" onClick={() => setConfirm(null)}>
          <div className="w-full bg-white rounded-t-3xl p-4 space-y-3" onClick={e => e.stopPropagation()}>
            <h3 className="text-[16px] font-extrabold">Ubah status pembayaran?</h3>
            <p className="text-[12px] text-ink-3">
              {confirm.inv.no} akan diubah menjadi <b>{statusStyle(confirm.status).label}</b>.
            </p>
            <div className="flex gap-2">
              <button disabled={saving} onClick={updateStatus} className="flex-1 rounded-2xl bg-brand text-white py-3 text-[13px] font-bold disabled:opacity-60">
                {saving ? 'Menyimpan...' : 'Konfirmasi'}
              </button>
              <button disabled={saving} onClick={() => setConfirm(null)} className="w-24 rounded-2xl bg-wm-bg text-ink-3 py-3 text-[13px] font-bold">
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="bg-white rounded-2xl border border-wm-line p-3 min-w-0">
      <p className="text-[10px] text-ink-3 truncate">{label}</p>
      <p className="text-[18px] font-extrabold truncate mt-1" style={{ color }}>{value}</p>
      <p className="text-[10px] text-ink-4 truncate mt-1">{sub}</p>
    </div>
  )
}

function Info({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`rounded-2xl border border-wm-line bg-white p-3 min-w-0 ${wide ? 'col-span-2' : ''}`}>
      <p className="text-[10px] text-ink-4">{label}</p>
      <p className="text-[12px] font-semibold text-ink truncate mt-1">{value}</p>
    </div>
  )
}
