import { useState, useRef, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { registrationsAPI, expensesAPI, tenantSettingsAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useCompanySettings, type CompanySettings } from '../hooks/useCompanySettings'
import { CardDesign, DEFAULT_DESIGN, CARD_TEMPLATES, WarrantyCard } from '../components/WarrantyCardTemplates'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DocSettings {
  accentColor: string
  showLogo: boolean
  logoSize: number
  logoZoom: number
  companyNameFont: string
  showNpwp: boolean
  showTtd: boolean
  pajakRate: number
  diskonRate: number
  termin: string
  catatan: string
  ttd1Nama: string
  ttd1Jabatan: string
  ttd2Nama: string
  ttd2Jabatan: string
  ttd3Nama: string
  ttd3Jabatan: string
  periode: string
}


const defaultDoc: DocSettings = {
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
  periode: 'April 2026',
}

// ─── Doc type config ──────────────────────────────────────────────────────────

const DOC_TYPES: Record<string, { title: string; docTitle: string; ttd: [string, string, string] }> = {
  invoice:        { title: 'Invoice',            docTitle: 'INVOICE',            ttd: ['Disiapkan oleh', 'Disetujui oleh', 'Diterima oleh'] },
  po:             { title: 'Surat Pembelian',    docTitle: 'PURCHASE ORDER',     ttd: ['Dibuat oleh', 'Disetujui oleh', 'Dikonfirmasi Pemasok'] },
  'lap-penjualan':  { title: 'Laporan Penjualan',  docTitle: 'LAPORAN PENJUALAN',  ttd: ['Dibuat oleh', 'Diketahui oleh', ''] },
  'lap-pendapatan': { title: 'Laporan Pendapatan', docTitle: 'LAPORAN PENDAPATAN', ttd: ['Disiapkan oleh', 'Diverifikasi oleh', ''] },
  'lap-pengeluaran':{ title: 'Laporan Pengeluaran',docTitle: 'LAPORAN PENGELUARAN',ttd: ['Disiapkan oleh', 'Disetujui oleh', ''] },
  'lap-labarugi':   { title: 'Laporan Laba Rugi',  docTitle: 'LAPORAN LABA RUGI',  ttd: ['Disiapkan oleh', 'Diverifikasi oleh', ''] },
}

// ─── Input helpers ─────────────────────────────────────────────────────────────

const labelCls = 'block text-[11px] font-semibold text-[#555] mb-1'
const inputCls = 'w-full rounded border border-[#cbd5e1] bg-white px-3 py-2 text-[12px] text-[#111] outline-none focus:border-[#1E4FD8] transition'

// ─── Preview components ───────────────────────────────────────────────────────

function DocHeader({ company, doc, type, number }: { company: CompanySettings; doc: DocSettings; type: string; number: string }) {
  const cfg = DOC_TYPES[type]
  return (
    <div style={{ borderBottom: `2px solid ${doc.accentColor}`, paddingBottom: 14, marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div style={{ minWidth: 0 }}>
        {doc.showLogo && (company.logoDataUrl || true) && (
          <div
            style={{
              width: `${Number(doc.logoSize) || 140}px`,
              height: `${Math.round((Number(doc.logoSize) || 140) * 0.7)}px`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              marginBottom: 6,
              overflow: 'hidden',
            }}
          >
            <img
              src={company.logoDataUrl || '/workshopmu-logo.svg'}
              alt="Logo"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                display: 'block',
                transform: `scale(${Number(doc.logoZoom) || 1})`,
                transformOrigin: 'left center',
              }}
            />
          </div>
        )}
        <div>
        <div style={{ fontFamily: doc.companyNameFont, fontWeight: 800, fontSize: 18, color: '#111', marginBottom: 2 }}>{company.nama}</div>
        <div style={{ fontSize: 10, color: '#555', lineHeight: 1.6 }}>
          {company.alamat}<br />
          {company.kota}<br />
          {company.telp} · {company.email}
          {doc.showNpwp && <><br />NPWP: {company.npwp}</>}
        </div>
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: doc.accentColor, letterSpacing: -0.5 }}>{cfg.docTitle}</div>
        <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>No. {number}</div>
        <div style={{ display: 'inline-block', marginTop: 6, padding: '3px 10px', borderRadius: 4, background: doc.accentColor + '18', color: doc.accentColor, fontSize: 10, fontWeight: 700 }}>
          {type === 'invoice' ? 'BELUM DIBAYAR' : type === 'po' ? 'DIPROSES' : doc.periode}
        </div>
      </div>
    </div>
  )
}

function DocSignatures({ doc, type }: { doc: DocSettings; type: string }) {
  if (!doc.showTtd) return null
  const cfg = DOC_TYPES[type]
  const sigs = [
    { label: cfg.ttd[0], nama: doc.ttd1Nama, jabatan: doc.ttd1Jabatan },
    { label: cfg.ttd[1], nama: doc.ttd2Nama, jabatan: doc.ttd2Jabatan },
    ...(cfg.ttd[2] ? [{ label: cfg.ttd[2], nama: doc.ttd3Nama, jabatan: doc.ttd3Jabatan }] : []),
  ]
  return (
    <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
      {sigs.map((s) => (
        <div key={s.label} style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: 4, padding: '10px 12px' }}>
          <div style={{ fontSize: 10, color: '#888', marginBottom: 32 }}>{s.label}</div>
          <div style={{ borderTop: '1px solid #333', paddingTop: 4 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#111' }}>{s.nama || '_______________'}</div>
            <div style={{ fontSize: 9, color: '#888' }}>{s.jabatan || '_______________'}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

function DocFooter({ company, type: _type, doc: _doc }: { company: CompanySettings; type: string; doc: DocSettings }) {
  return (
    <div style={{ marginTop: 16, paddingTop: 8, borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
      <div style={{ fontSize: 9, color: '#aaa' }}>Dokumen ini diterbitkan oleh {company.nama}</div>
      <div style={{ fontSize: 9, color: '#aaa' }}>Cetak: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} · Hal. 1/1</div>
    </div>
  )
}

function TotalsBlock({ subtotal, doc }: { subtotal: number; doc: DocSettings }) {
  const diskon = subtotal * (doc.diskonRate / 100)
  const setelahDiskon = subtotal - diskon
  const pajak = setelahDiskon * (doc.pajakRate / 100)
  const total = setelahDiskon + pajak
  const fmt = (n: number) => 'Rp ' + n.toLocaleString('id-ID')

  return (
    <div style={{ marginLeft: 'auto', width: 220, marginTop: 8 }}>
      {[
        ['Subtotal', fmt(subtotal)],
        ...(doc.diskonRate > 0 ? [[`Diskon (${doc.diskonRate}%)`, `- ${fmt(diskon)}`]] : []),
        [`PPN ${doc.pajakRate}%`, fmt(pajak)],
      ].map(([label, val]) => (
        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 10, color: '#555', borderBottom: '1px solid #f1f5f9' }}>
          <span>{label}</span><span>{val}</span>
        </div>
      ))}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', background: '#f1f5f9', borderRadius: 4, marginTop: 4, fontWeight: 700, fontSize: 11 }}>
        <span>TOTAL</span><span style={{ color: doc.accentColor }}>{fmt(total)}</span>
      </div>
    </div>
  )
}

// ─── Individual document previews ─────────────────────────────────────────────

function InvoicePreview({ company, doc }: { company: CompanySettings; doc: DocSettings }) {
  const items = [
    { no: 1, desc: 'Full Detailing Premium', sku: 'SVC-001', qty: 1, sat: 'Unit', harga: 350000 },
    { no: 2, desc: 'PPF Bumper Depan', sku: 'SVC-002', qty: 1, sat: 'Unit', harga: 800000 },
    { no: 3, desc: 'Coating Ceramic 9H', sku: 'SVC-003', qty: 1, sat: 'Unit', harga: 1800000 },
  ]
  const subtotal = items.reduce((s, i) => s + i.harga * i.qty, 0)

  return (
    <div>
      <DocHeader company={company} doc={doc} type="invoice" number="INV-2026-04-0042" />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 4, padding: 10 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Tagihan Kepada</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#111' }}>Budi Santoso</div>
          <div style={{ fontSize: 10, color: '#555', lineHeight: 1.6 }}>Jl. Merpati No. 5, Jakarta<br />0812-3456-7890</div>
        </div>
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 4, padding: 10 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Detail Invoice</div>
          {[['Tanggal', '24 April 2026'], ['Termin', doc.termin], ['Kendaraan', 'Honda Civic · B 1234 ABC'], ['Teknisi', 'Budi / Andi']].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, padding: '1px 0' }}>
              <span style={{ color: '#888' }}>{k}</span><span style={{ color: '#111', fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Items table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, marginBottom: 8 }}>
        <thead>
          <tr style={{ background: doc.accentColor, color: '#fff' }}>
            {['#', 'Deskripsi Layanan', 'SKU', 'Qty', 'Satuan', 'Harga Satuan', 'Jumlah'].map((h) => (
              <th key={h} style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 700, fontSize: 9 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={item.no} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
              <td style={{ padding: '5px 8px', color: '#888' }}>{item.no}</td>
              <td style={{ padding: '5px 8px', fontWeight: 600, color: '#111' }}>{item.desc}</td>
              <td style={{ padding: '5px 8px', color: '#888' }}>{item.sku}</td>
              <td style={{ padding: '5px 8px' }}>{item.qty}</td>
              <td style={{ padding: '5px 8px', color: '#888' }}>{item.sat}</td>
              <td style={{ padding: '5px 8px' }}>Rp {item.harga.toLocaleString('id-ID')}</td>
              <td style={{ padding: '5px 8px', fontWeight: 700 }}>Rp {(item.harga * item.qty).toLocaleString('id-ID')}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <TotalsBlock subtotal={subtotal} doc={doc} />

      {doc.catatan && (
        <div style={{ marginTop: 12, padding: '8px 10px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 4, fontSize: 10, color: '#555' }}>
          <span style={{ fontWeight: 700 }}>Catatan: </span>{doc.catatan}
        </div>
      )}

      <DocSignatures doc={doc} type="invoice" />
      <DocFooter company={company} type="invoice" doc={doc} />
    </div>
  )
}

function POPreview({ company, doc }: { company: CompanySettings; doc: DocSettings }) {
  const items = [
    { no: 1, desc: 'Car Shampoo Premium 5L', kode: 'BHN-001', qty: 10, sat: 'Botol', harga: 85000 },
    { no: 2, desc: 'Microfiber Towel 40x40cm', kode: 'BHN-002', qty: 50, sat: 'Pcs', harga: 15000 },
    { no: 3, desc: 'Clay Bar Detailing Kit', kode: 'BHN-003', qty: 5, sat: 'Set', harga: 120000 },
  ]
  const subtotal = items.reduce((s, i) => s + i.harga * i.qty, 0)

  return (
    <div>
      <DocHeader company={company} doc={doc} type="po" number="PO-2026-04-0089" />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
        {[
          { title: 'Kepada Pemasok', lines: ['PT. Bahan Otomotif Jaya', 'Jl. Industri No. 22, Bekasi', '(021) 8800-1234'] },
          { title: 'Dikirim Ke', lines: [company.nama, company.alamat, company.telp] },
          { title: 'Detail PO', lines: [`Tgl PO: 24 Apr 2026`, `Tgl Kirim: 01 Mei 2026`, `Termin: ${doc.termin}`, 'Prioritas: Normal'] },
        ].map((col) => (
          <div key={col.title} style={{ border: '1px solid #e2e8f0', borderRadius: 4, padding: 10 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{col.title}</div>
            {col.lines.map((l, i) => (
              <div key={i} style={{ fontSize: 10, color: i === 0 ? '#111' : '#555', fontWeight: i === 0 ? 700 : 400, lineHeight: 1.6 }}>{l}</div>
            ))}
          </div>
        ))}
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, marginBottom: 8 }}>
        <thead>
          <tr style={{ background: doc.accentColor, color: '#fff' }}>
            {['#', 'Deskripsi Barang', 'Kode', 'Qty', 'Satuan', 'Harga Satuan', 'Total'].map((h) => (
              <th key={h} style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 700, fontSize: 9 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={item.no} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
              <td style={{ padding: '5px 8px', color: '#888' }}>{item.no}</td>
              <td style={{ padding: '5px 8px', fontWeight: 600, color: '#111' }}>{item.desc}</td>
              <td style={{ padding: '5px 8px', color: '#888' }}>{item.kode}</td>
              <td style={{ padding: '5px 8px' }}>{item.qty}</td>
              <td style={{ padding: '5px 8px', color: '#888' }}>{item.sat}</td>
              <td style={{ padding: '5px 8px' }}>Rp {item.harga.toLocaleString('id-ID')}</td>
              <td style={{ padding: '5px 8px', fontWeight: 700 }}>Rp {(item.harga * item.qty).toLocaleString('id-ID')}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <TotalsBlock subtotal={subtotal} doc={doc} />
      <DocSignatures doc={doc} type="po" />
      <DocFooter company={company} type="po" doc={doc} />
    </div>
  )
}

interface RegRow { id: string; customer: string; tanggal: string; layanan: string; harga: number; hpp: number; status: string; paymentStatus: string }

function parseHppNotes(notes?: string): number {
  const m = notes?.match(/hpp:([\d.]+)/)
  return m ? parseFloat(m[1]) : 0
}

function LapPenjualanPreview({ company, doc, regs }: { company: CompanySettings; doc: DocSettings; regs: RegRow[] }) {
  const fmt = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID')
  const totalTrx = regs.length
  const totalPenjualan = regs.reduce((s, r) => s + r.harga, 0)
  const rataRata = totalTrx > 0 ? totalPenjualan / totalTrx : 0
  const lunas = regs.filter(r => r.paymentStatus === 'LUNAS' || r.status === 'completed').length

  // Per kategori/layanan
  const byLayanan: Record<string, number> = {}
  regs.forEach(r => { byLayanan[r.layanan] = (byLayanan[r.layanan] || 0) + r.harga })
  const categories = Object.entries(byLayanan)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([kat, val]) => [kat, fmt(val), totalPenjualan > 0 ? Math.round((val / totalPenjualan) * 100) + '%' : '0%'])

  const statusColor = (s: string) => s === 'LUNAS' || s === 'completed' ? '#16a34a' : s === 'PARSIAL' ? '#f59e0b' : '#dc2626'
  const statusLabel = (r: RegRow) => r.paymentStatus === 'LUNAS' ? 'Lunas' : r.status === 'completed' ? 'Lunas' : r.paymentStatus === 'PARSIAL' ? 'Parsial' : 'Belum'

  const metrics = [
    { label: 'TOTAL TRANSAKSI', value: String(totalTrx), sub: `${lunas} selesai` },
    { label: 'TOTAL PENJUALAN', value: fmt(totalPenjualan), sub: `Periode: ${doc.periode}` },
    { label: 'SUDAH LUNAS', value: fmt(regs.filter(r => r.paymentStatus === 'LUNAS' || r.status === 'completed').reduce((s, r) => s + r.harga, 0)), sub: `${lunas} transaksi` },
    { label: 'RATA-RATA/TRANSAKSI', value: fmt(rataRata), sub: 'Per servis' },
  ]

  return (
    <div>
      <DocHeader company={company} doc={doc} type="lap-penjualan" number={`RPT-PJLN-${doc.periode.replace(' ', '-')}`} />

      <div className="metric-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 14 }}>
        {metrics.map((m) => (
          <div key={m.label} style={{ border: '1px solid #e2e8f0', borderRadius: 4, padding: 10 }}>
            <div style={{ fontSize: 8, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.5 }}>{m.label}</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: doc.accentColor, margin: '4px 0 2px' }}>{m.value}</div>
            <div style={{ fontSize: 9, color: '#888' }}>{m.sub}</div>
          </div>
        ))}
      </div>

      {categories.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#111', marginBottom: 6, borderBottom: `1.5px solid ${doc.accentColor}`, paddingBottom: 3 }}>PENJUALAN PER LAYANAN</div>
          {categories.map(([cat, val, pct]) => (
            <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: 10, color: '#555' }}>{cat}</span>
              <div style={{ display: 'flex', gap: 16 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#111' }}>{val}</span>
                <span style={{ fontSize: 10, color: doc.accentColor, fontWeight: 700, width: 32, textAlign: 'right' }}>{pct}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: 10, fontWeight: 700, color: '#111', marginBottom: 6, borderBottom: `1.5px solid ${doc.accentColor}`, paddingBottom: 3 }}>DETAIL TRANSAKSI</div>
      {regs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px', color: '#aaa', fontSize: 11 }}>Tidak ada transaksi pada periode ini</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9 }}>
          <thead>
            <tr style={{ background: doc.accentColor, color: '#fff' }}>
              {['#', 'Pelanggan', 'Tanggal', 'Layanan', 'Nilai', 'Status'].map((h) => (
                <th key={h} style={{ padding: '4px 6px', textAlign: 'left', fontWeight: 700 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {regs.map((r, i) => {
              const sc = statusColor(r.paymentStatus || r.status)
              return (
                <tr key={r.id} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                  <td style={{ padding: '4px 6px', color: '#aaa' }}>{i + 1}</td>
                  <td style={{ padding: '4px 6px', color: '#111', fontWeight: 600 }}>{r.customer}</td>
                  <td style={{ padding: '4px 6px', color: '#888' }}>{r.tanggal}</td>
                  <td style={{ padding: '4px 6px', color: '#555' }}>{r.layanan}</td>
                  <td style={{ padding: '4px 6px', fontWeight: 700 }}>{fmt(r.harga)}</td>
                  <td style={{ padding: '4px 6px' }}>
                    <span style={{ padding: '1px 6px', borderRadius: 3, background: sc + '22', color: sc, fontSize: 8, fontWeight: 700 }}>{statusLabel(r)}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      <DocSignatures doc={doc} type="lap-penjualan" />
      <DocFooter company={company} type="lap-penjualan" doc={doc} />
    </div>
  )
}

function LapPendapatanPreview({ company, doc, regs }: { company: CompanySettings; doc: DocSettings; regs: RegRow[] }) {
  const fmt = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID')
  const totalKotor = regs.reduce((s, r) => s + r.harga, 0)
  const totalLunas = regs.filter(r => r.paymentStatus === 'LUNAS' || r.status === 'completed').reduce((s, r) => s + r.harga, 0)
  const totalBersih = totalKotor * (1 - doc.pajakRate / 100)

  // Per layanan
  const byLayanan: Record<string, number> = {}
  regs.forEach(r => { byLayanan[r.layanan] = (byLayanan[r.layanan] || 0) + r.harga })
  const rows = Object.entries(byLayanan).sort((a, b) => b[1] - a[1])

  return (
    <div>
      <DocHeader company={company} doc={doc} type="lap-pendapatan" number={`RPT-PDT-${doc.periode.replace(' ', '-')}`} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 14 }}>
        {[
          { label: 'TOTAL PENDAPATAN', value: fmt(totalKotor), sub: `${regs.length} transaksi` },
          { label: 'SUDAH LUNAS', value: fmt(totalLunas), sub: `${regs.filter(r => r.paymentStatus === 'LUNAS' || r.status === 'completed').length} transaksi` },
          { label: 'PENDAPATAN BERSIH', value: fmt(totalBersih), sub: `Setelah pajak ${doc.pajakRate}%` },
        ].map((m) => (
          <div key={m.label} style={{ border: '1px solid #e2e8f0', borderRadius: 4, padding: 10 }}>
            <div style={{ fontSize: 8, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.5 }}>{m.label}</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: doc.accentColor, margin: '4px 0 2px' }}>{m.value}</div>
            <div style={{ fontSize: 9, color: '#888' }}>{m.sub}</div>
          </div>
        ))}
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9, marginBottom: 12 }}>
        <thead>
          <tr style={{ background: doc.accentColor, color: '#fff' }}>
            {['Layanan', 'Total', '%'].map((h) => (
              <th key={h} style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 700, fontSize: 9 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={3} style={{ padding: '12px 8px', color: '#aaa', textAlign: 'center' }}>Tidak ada data pendapatan pada periode ini</td></tr>
          ) : rows.map(([layanan, total], i) => (
            <tr key={layanan} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
              <td style={{ padding: '5px 8px', fontWeight: 600, color: '#111' }}>{layanan}</td>
              <td style={{ padding: '5px 8px', fontWeight: 700, color: '#111' }}>{fmt(total)}</td>
              <td style={{ padding: '5px 8px', color: doc.accentColor, fontWeight: 700 }}>{totalKotor > 0 ? Math.round((total / totalKotor) * 100) : 0}%</td>
            </tr>
          ))}
          <tr style={{ background: '#f1f5f9', fontWeight: 700 }}>
            <td style={{ padding: '5px 8px', fontSize: 10, fontWeight: 800 }}>TOTAL PENDAPATAN KOTOR</td>
            <td style={{ padding: '5px 8px', color: doc.accentColor, fontSize: 11 }}>{fmt(totalKotor)}</td>
            <td style={{ padding: '5px 8px', color: doc.accentColor }}>100%</td>
          </tr>
          <tr style={{ background: '#fff7ed' }}>
            <td style={{ padding: '5px 8px', color: '#888', fontSize: 9 }}>Pajak (PPh {doc.pajakRate}%)</td>
            <td style={{ padding: '5px 8px', color: '#f59e0b', fontWeight: 600, fontSize: 9 }}>- {fmt(totalKotor * doc.pajakRate / 100)}</td>
            <td />
          </tr>
          <tr style={{ background: '#f0fdf4', fontWeight: 700 }}>
            <td style={{ padding: '5px 8px', fontSize: 10, fontWeight: 800, color: '#16a34a' }}>TOTAL PENDAPATAN BERSIH</td>
            <td style={{ padding: '5px 8px', color: '#16a34a', fontSize: 11 }}>{fmt(totalBersih)}</td>
            <td />
          </tr>
        </tbody>
      </table>

      <DocSignatures doc={doc} type="lap-pendapatan" />
      <DocFooter company={company} type="lap-pendapatan" doc={doc} />
    </div>
  )
}

interface ExpenseRow { id: string; tanggal: string; kategori: string; keterangan: string; jumlah: number }

function LapPengeluaranPreview({ company, doc, expenses }: { company: CompanySettings; doc: DocSettings; expenses: ExpenseRow[] }) {
  const fmt = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID')
  const totalReal = expenses.reduce((s, e) => s + e.jumlah, 0)

  // Per kategori
  const byKat: Record<string, number> = {}
  expenses.forEach(e => { byKat[e.kategori] = (byKat[e.kategori] || 0) + e.jumlah })
  const rows = Object.entries(byKat).sort((a, b) => b[1] - a[1])

  const metrics = [
    { label: 'TOTAL PENGELUARAN', value: fmt(totalReal), sub: `${expenses.length} transaksi` },
    { label: 'TERBESAR', value: rows[0] ? fmt(rows[0][1]) : 'Rp 0', sub: rows[0]?.[0] || '-' },
    { label: 'RATA-RATA/ITEM', value: expenses.length > 0 ? fmt(totalReal / expenses.length) : 'Rp 0', sub: 'Per pengeluaran' },
    { label: 'KATEGORI', value: String(rows.length), sub: 'Jenis pengeluaran' },
  ]

  return (
    <div>
      <DocHeader company={company} doc={doc} type="lap-pengeluaran" number={`RPT-PGL-${doc.periode.replace(' ', '-')}`} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 14 }}>
        {metrics.map((m) => (
          <div key={m.label} style={{ border: '1px solid #e2e8f0', borderRadius: 4, padding: 10 }}>
            <div style={{ fontSize: 8, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.5 }}>{m.label}</div>
            <div style={{ fontSize: 12, fontWeight: 800, color: doc.accentColor, margin: '4px 0 2px' }}>{m.value}</div>
            <div style={{ fontSize: 9, color: '#888' }}>{m.sub}</div>
          </div>
        ))}
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9 }}>
        <thead>
          <tr style={{ background: doc.accentColor, color: '#fff' }}>
            {['Tanggal', 'Kategori', 'Keterangan', 'Jumlah', '%'].map((h) => (
              <th key={h} style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 700, fontSize: 9 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {expenses.length === 0 ? (
            <tr><td colSpan={5} style={{ padding: '12px 8px', color: '#aaa', textAlign: 'center' }}>Tidak ada pengeluaran pada periode ini</td></tr>
          ) : expenses.map((e, i) => (
            <tr key={e.id} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
              <td style={{ padding: '5px 8px', color: '#888' }}>{new Date(e.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</td>
              <td style={{ padding: '5px 8px', fontWeight: 600, color: '#111' }}>{e.kategori}</td>
              <td style={{ padding: '5px 8px', color: '#555' }}>{e.keterangan}</td>
              <td style={{ padding: '5px 8px', fontWeight: 700, color: '#111' }}>{fmt(e.jumlah)}</td>
              <td style={{ padding: '5px 8px', color: doc.accentColor }}>{totalReal > 0 ? Math.round((e.jumlah / totalReal) * 100) : 0}%</td>
            </tr>
          ))}
          <tr style={{ background: '#f1f5f9', fontWeight: 700 }}>
            <td colSpan={3} style={{ padding: '6px 8px', fontSize: 10, fontWeight: 800 }}>TOTAL PENGELUARAN</td>
            <td style={{ padding: '6px 8px', color: doc.accentColor, fontSize: 11 }}>{fmt(totalReal)}</td>
            <td style={{ padding: '6px 8px', color: doc.accentColor }}>100%</td>
          </tr>
        </tbody>
      </table>

      <DocSignatures doc={doc} type="lap-pengeluaran" />
      <DocFooter company={company} type="lap-pengeluaran" doc={doc} />
    </div>
  )
}

function LapLabaRugiPreview({ company, doc, regs, expenses }: { company: CompanySettings; doc: DocSettings; regs: RegRow[]; expenses: ExpenseRow[] }) {
  const fmt = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID')
  const pendapatan = regs.reduce((s, r) => s + r.harga, 0)
  const hppMaterial = regs.reduce((s, r) => s + (r.hpp || 0), 0)
  const hppRecorded = regs.filter(r => r.hpp > 0).length
  const biayaOps = expenses.reduce((s, e) => s + e.jumlah, 0)
  const labaKotor = pendapatan - hppMaterial
  const labaOps = labaKotor - biayaOps
  const pajak = labaOps > 0 ? labaOps * (doc.pajakRate / 100) : 0
  const labaBersih = labaOps - pajak

  const row = (label: string, val: number, bold = false, color = '#111', indent = false) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', borderBottom: '1px solid #f1f5f9', background: bold ? '#f8fafc' : '#fff' }}>
      <span style={{ fontSize: 10, fontWeight: bold ? 800 : 400, color, paddingLeft: indent ? 16 : 0 }}>{label}</span>
      <span style={{ fontSize: 10, fontWeight: bold ? 800 : 500, color }}>{fmt(val)}</span>
    </div>
  )

  // Per kategori pengeluaran
  const byKat: Record<string, number> = {}
  expenses.forEach(e => { byKat[e.kategori] = (byKat[e.kategori] || 0) + e.jumlah })

  return (
    <div>
      <DocHeader company={company} doc={doc} type="lap-labarugi" number={`RPT-LR-${doc.periode.replace(' ', '-')}`} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 14 }}>
        {[
          { label: 'TOTAL PENDAPATAN', value: fmt(pendapatan), color: doc.accentColor },
          { label: 'LABA KOTOR', value: fmt(labaKotor), sub: hppMaterial > 0 ? `HPP ${fmt(hppMaterial)}` : 'HPP belum tercatat', color: labaKotor >= 0 ? '#1E4FD8' : '#dc2626' },
          { label: 'LABA OPERASIONAL', value: fmt(labaOps), color: labaOps >= 0 ? '#8b5cf6' : '#dc2626' },
          { label: 'LABA BERSIH', value: fmt(labaBersih), color: labaBersih >= 0 ? '#16a34a' : '#dc2626' },
        ].map((m: any) => (
          <div key={m.label} style={{ border: '1px solid #e2e8f0', borderRadius: 4, padding: 10 }}>
            <div style={{ fontSize: 8, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.5 }}>{m.label}</div>
            <div style={{ fontSize: 12, fontWeight: 800, color: m.color, margin: '4px 0' }}>{m.value}</div>
            {m.sub && <div style={{ fontSize: 8, color: '#94a3b8' }}>{m.sub}</div>}
          </div>
        ))}
      </div>

      <div style={{ border: '1px solid #e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ padding: '6px 8px', background: doc.accentColor, color: '#fff', fontSize: 10, fontWeight: 700 }}>LAPORAN LABA RUGI — {doc.periode.toUpperCase()}</div>

        <div style={{ padding: '4px 8px', background: '#f1f5f9', fontSize: 9, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>Pendapatan</div>
        {row('Pendapatan Jasa / Servis', pendapatan, false, '#111', true)}
        {row('TOTAL PENDAPATAN', pendapatan, true, doc.accentColor)}

        <div style={{ padding: '4px 8px', background: '#f1f5f9', fontSize: 9, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>HPP Material (Harga Pokok)</div>
        {hppMaterial > 0
          ? row(`HPP Material (${hppRecorded} servis tercatat)`, hppMaterial, false, '#f59e0b', true)
          : row('HPP belum tercatat — setup BOM di menu Layanan → Setup HPP', 0, false, '#aaa', true)
        }
        {row('TOTAL HPP MATERIAL', hppMaterial, true, '#f59e0b')}
        {row('LABA KOTOR', labaKotor, true, labaKotor >= 0 ? '#1E4FD8' : '#dc2626')}

        <div style={{ padding: '4px 8px', background: '#f1f5f9', fontSize: 9, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>Biaya Operasional</div>
        {Object.entries(byKat).map(([kat, val]) => row(kat, val, false, '#111', true))}
        {biayaOps === 0 && row('(belum ada data pengeluaran)', 0, false, '#aaa', true)}
        {row('TOTAL BIAYA OPERASIONAL', biayaOps, true, '#dc2626')}
        {row('LABA OPERASIONAL', labaOps, true, labaOps >= 0 ? '#8b5cf6' : '#dc2626')}

        <div style={{ padding: '4px 8px', background: '#f1f5f9', fontSize: 9, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>Pajak</div>
        {row(`Pajak Penghasilan (${doc.pajakRate}%)`, pajak, false, '#f59e0b', true)}

        <div style={{ padding: '8px', background: labaBersih >= 0 ? '#f0fdf4' : '#fef2f2', display: 'flex', justifyContent: 'space-between', borderTop: `2px solid ${labaBersih >= 0 ? '#16a34a' : '#dc2626'}` }}>
          <span style={{ fontSize: 12, fontWeight: 900, color: labaBersih >= 0 ? '#16a34a' : '#dc2626' }}>LABA BERSIH</span>
          <span style={{ fontSize: 12, fontWeight: 900, color: labaBersih >= 0 ? '#16a34a' : '#dc2626' }}>{fmt(labaBersih)}</span>
        </div>
      </div>

      <DocSignatures doc={doc} type="lap-labarugi" />
      <DocFooter company={company} type="lap-labarugi" doc={doc} />
    </div>
  )
}

// ─── Preview renderer ─────────────────────────────────────────────────────────

function DocPreview({ type, company, doc, regs, expenses }: { type: string; company: CompanySettings; doc: DocSettings; regs: RegRow[]; expenses: ExpenseRow[] }) {
  const props = { company, doc }
  if (type === 'invoice')          return <InvoicePreview {...props} />
  if (type === 'po')               return <POPreview {...props} />
  if (type === 'lap-penjualan')    return <LapPenjualanPreview {...props} regs={regs} />
  if (type === 'lap-pendapatan')   return <LapPendapatanPreview {...props} regs={regs} />
  if (type === 'lap-pengeluaran')  return <LapPengeluaranPreview {...props} expenses={expenses} />
  if (type === 'lap-labarugi')     return <LapLabaRugiPreview {...props} regs={regs} expenses={expenses} />
  return <div />
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const STORAGE_KEY_DOC = (type: string) => `wms_doc_settings_${type}`

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback
  } catch { return fallback }
}

export default function DocumentsPage() {
  const { docType = 'invoice' } = useParams<{ docType: string }>()
  const { tenant } = useAuth()
  const { company, setCompany, saveCompany } = useCompanySettings()
  const [doc, setDoc] = useState<DocSettings>(() => loadFromStorage(STORAGE_KEY_DOC(docType), defaultDoc))
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [unsaved, setUnsaved] = useState(false)
  const [regs, setRegs] = useState<RegRow[]>([])
  const [expenses, setExpenses] = useState<ExpenseRow[]>([])
  const printRef = useRef<HTMLDivElement>(null)

  // Warranty card design state
  const [cardDesign, setCardDesign] = useState<CardDesign>(DEFAULT_DESIGN)
  const [savingCard, setSavingCard] = useState(false)
  const [cardSavedAt, setCardSavedAt] = useState<string | null>(null)

  const cfg = DOC_TYPES[docType] || DOC_TYPES['invoice']

  // Reload doc settings when switching document type
  useEffect(() => {
    setDoc(loadFromStorage(STORAGE_KEY_DOC(docType), defaultDoc))
    setUnsaved(false)
    setSavedAt(null)
  }, [docType])

  // Load warranty card design
  useEffect(() => {
    tenantSettingsAPI.get('warranty_card_design')
      .then(res => { if (res.data.data) setCardDesign({ ...DEFAULT_DESIGN, ...res.data.data }) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (tenant?.name && !cardDesign.workshopName) {
      setCardDesign(d => ({ ...d, workshopName: tenant.name }))
    }
  }, [tenant?.name])

  const saveCardDesign = async () => {
    setSavingCard(true)
    try {
      await tenantSettingsAPI.set('warranty_card_design', cardDesign as any)
      const now = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      setCardSavedAt(now)
    } catch {}
    finally { setSavingCard(false) }
  }

  // Fetch real data for laporan types
  useEffect(() => {
    const isLaporan = ['lap-penjualan','lap-pendapatan','lap-labarugi'].includes(docType)
    const needsExpenses = ['lap-pengeluaran','lap-labarugi'].includes(docType)
    if (!tenant?.id) return

    const MONTHS: Record<string, number> = { Januari:0,Februari:1,Maret:2,April:3,Mei:4,Juni:5,Juli:6,Agustus:7,September:8,Oktober:9,November:10,Desember:11 }
    const parts = doc.periode.trim().split(' ')
    const filterMonth = MONTHS[parts[0]] ?? -1
    const filterYear = Number(parts[1]) || new Date().getFullYear()
    if (filterMonth === -1) { setRegs([]); setExpenses([]); return }

    if (isLaporan) {
      registrationsAPI.list(tenant.id).then(res => {
        const all = res.data.data || []
        // Pakai updatedAt: pendapatan diakui saat servis selesai (status berubah ke completed)
        const filtered = all.filter((r: any) => {
          const d = new Date(r.updatedAt)
          return d.getMonth() === filterMonth && d.getFullYear() === filterYear && r.status !== 'cancelled'
        })
        setRegs(filtered.map((r: any) => ({
          id: r.id,
          customer: r.customer?.name || '-',
          tanggal: new Date(r.updatedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }),
          layanan: r.workshop?.title || '-',
          harga: Number(r.workshop?.price || 0),
          hpp: parseHppNotes(r.notes),
          status: r.status,
          paymentStatus: r.paymentStatus || '',
        })))
      }).catch(() => {})
    }

    if (needsExpenses) {
      expensesAPI.list().then(res => {
        const all = res.data.data || []
        const filtered = all.filter((e: any) => {
          const d = new Date(e.tanggal)
          if (d.getMonth() !== filterMonth || d.getFullYear() !== filterYear) return false
          // Laporan Laba Rugi: hanya biaya operasional, bukan material/PO (sudah masuk HPP)
          if (docType === 'lap-labarugi') {
            const kat = String(e.kategori || '').toLowerCase()
            if (kat === 'material' || e.refPO) return false
          }
          return true
        })
        setExpenses(filtered.map((e: any) => ({
          id: e.id,
          tanggal: e.tanggal,
          kategori: e.kategori || '-',
          keterangan: e.keterangan || '-',
          jumlah: Number(e.jumlah || 0),
        })))
      }).catch(() => {})
    }
  }, [docType, doc.periode, tenant?.id])

  // Mark unsaved on any change
  useEffect(() => { setUnsaved(true) }, [company, doc])

  const handleSave = async () => {
    await saveCompany(company)
    localStorage.setItem(STORAGE_KEY_DOC(docType), JSON.stringify(doc))
    const now = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    setSavedAt(now)
    setUnsaved(false)
  }

  const handleReset = () => {
    setDoc(defaultDoc)
    localStorage.removeItem(STORAGE_KEY_DOC(docType))
    setSavedAt(null)
    setUnsaved(false)
  }

  const handlePrint = () => {
    const content = printRef.current?.innerHTML
    if (!content) return
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <html>
      <head>
        <title>${cfg.title}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important; }
          body { font-family: 'Segoe UI', Arial, sans-serif; padding: 32px; color: #111; font-size: 12px; }
          @page { margin: 12mm; size: A4 portrait; }
          @media print { body { padding: 0; } }

          /* Tabel — explicit display agar tidak collapse */
          table  { display: table !important; width: 100% !important; border-collapse: collapse !important; }
          thead  { display: table-header-group !important; }
          tbody  { display: table-row-group !important; }
          tfoot  { display: table-footer-group !important; }
          tr     { display: table-row !important; }
          th, td { display: table-cell !important; padding: 5px 7px !important;
                   text-align: left !important; vertical-align: top !important; word-break: break-word; }

          /* Grid metric cards → inline-block supaya sejajar */
          .metric-grid { display: table !important; width: 100% !important; }
          .metric-grid > * { display: table-cell !important; vertical-align: top; padding: 8px !important; }
        </style>
      </head>
      <body>
        <div style="width:794px;min-height:1123px;background:#fff;padding:40px 48px;font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#111;line-height:1.5;margin:0 auto;">
          ${content}
        </div>
      </body>
      </html>
    `)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 500)
  }

  const setC = (k: keyof CompanySettings) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setCompany((prev) => ({ ...prev, [k]: e.target.value }))

  const setD = (k: keyof DocSettings) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const t = e.target.type
    const val = t === 'number' || t === 'range' ? Number(e.target.value)
      : t === 'checkbox' ? (e.target as HTMLInputElement).checked
      : e.target.value
    setDoc((prev) => ({ ...prev, [k]: val }))
  }

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return

    const reader = new FileReader()
    reader.onload = () => {
      setCompany((prev) => ({ ...prev, logoDataUrl: String(reader.result || '') }))
      setDoc((prev) => ({ ...prev, showLogo: true }))
    }
    reader.readAsDataURL(file)
  }

  // ── Kartu Garansi route ──────────────────────────────────────────────────────
  if (docType === 'kartu-garansi') {
    const dummyWarranty = {
      code: 'GRN-2026-0001',
      status: 'active',
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 365 * 86400000).toISOString(),
      customer: { id: '', name: 'Nama Pelanggan', phone: '' },
      workshop: { id: '', title: 'Nama Layanan' },
      registration: { id: '', vehicleName: 'Toyota Fortuner', licensePlate: 'B 1234 XYZ' },
    }
    return (
      <div className="flex h-[calc(100vh-56px)]">
        {/* Settings */}
        <div className="w-[300px] flex-shrink-0 border-r border-[#e2e8f0] bg-white overflow-y-auto">
          <div className="px-4 py-4 border-b border-[#f1f5f9]">
            <p className="text-sm font-bold text-[#111]">Kartu Garansi</p>
            <p className="text-[11px] text-[#888] mt-0.5">Template kartu garansi digital</p>
          </div>
          <div className="px-4 py-4 space-y-4">
            {/* Template picker */}
            <div>
              <p className="text-[11px] font-bold text-[#888] uppercase tracking-wide mb-2">Pilih Template</p>
              <div className="grid grid-cols-3 gap-2">
                {CARD_TEMPLATES.map(tpl => {
                  const active = (cardDesign.templateId || 'classic') === tpl.id
                  return (
                    <button key={tpl.id}
                      onClick={() => setCardDesign(d => ({ ...d, templateId: tpl.id, primaryColor: tpl.defaultPrimary, secondaryColor: tpl.defaultSecondary }))}
                      className={`rounded-lg overflow-hidden border-2 transition ${active ? 'border-[#1E4FD8] shadow-md' : 'border-transparent hover:border-[#cbd5e1]'}`}>
                      <div style={{ height: 38, background: tpl.previewBg }} />
                      <div className={`text-[10px] font-semibold py-1 text-center ${active ? 'bg-[#EEF3FE] text-[#1E4FD8]' : 'bg-[#f8fafc] text-[#666]'}`}>
                        {tpl.name}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="border-t border-[#f1f5f9] pt-3 space-y-3">
              <p className="text-[11px] font-bold text-[#888] uppercase tracking-wide">Kustomisasi</p>

              <div>
                <label className={labelCls}>Nama Workshop</label>
                <input type="text" value={cardDesign.workshopName}
                  onChange={e => setCardDesign(d => ({ ...d, workshopName: e.target.value }))}
                  placeholder="Auto Workshop" className={inputCls} />
              </div>

              <div>
                <label className={labelCls}>Logo Workshop</label>
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] flex items-center justify-center overflow-hidden flex-shrink-0">
                    {cardDesign.logoUrl ? <img src={cardDesign.logoUrl} alt="logo" className="h-full w-full object-cover" /> : <span className="text-[18px]">🛡</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <label className="cursor-pointer inline-flex items-center gap-1.5 rounded border border-[#cbd5e1] bg-white px-3 py-1.5 text-[12px] text-[#555] hover:bg-[#f8fafc] transition">
                      📁 Pilih Gambar
                      <input type="file" accept="image/*" className="hidden"
                        onChange={e => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          const reader = new FileReader()
                          reader.onload = ev => {
                            const img = new Image()
                            img.onload = () => {
                              const MAX = 200
                              const scale = Math.min(MAX / img.width, MAX / img.height, 1)
                              const canvas = document.createElement('canvas')
                              canvas.width = Math.round(img.width * scale)
                              canvas.height = Math.round(img.height * scale)
                              canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
                              setCardDesign(d => ({ ...d, logoUrl: canvas.toDataURL('image/jpeg', 0.8) }))
                            }
                            img.src = ev.target?.result as string
                          }
                          reader.readAsDataURL(file)
                        }} />
                    </label>
                    <p className="text-[10px] text-[#aaa] mt-1">PNG/JPG · otomatis dikompresi</p>
                    {cardDesign.logoUrl && (
                      <button onClick={() => setCardDesign(d => ({ ...d, logoUrl: '' }))} className="text-[10px] text-[#dc2626] hover:underline mt-0.5">Hapus logo</button>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[{ label: 'Warna Utama', key: 'primaryColor' }, { label: 'Warna Kedua', key: 'secondaryColor' }].map(f => (
                  <div key={f.key}>
                    <label className={labelCls}>{f.label}</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={(cardDesign as any)[f.key]}
                        onChange={e => setCardDesign(d => ({ ...d, [f.key]: e.target.value }))}
                        className="h-8 w-8 rounded border border-[#e2e8f0] cursor-pointer p-0.5" />
                      <span className="text-[11px] text-[#888]">{(cardDesign as any)[f.key]}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <label className={labelCls}>Teks Footer</label>
                <textarea value={cardDesign.footerText} rows={2}
                  onChange={e => setCardDesign(d => ({ ...d, footerText: e.target.value }))}
                  className={inputCls} />
              </div>
            </div>

            <button onClick={saveCardDesign} disabled={savingCard}
              className="w-full rounded bg-[#1E4FD8] py-2 text-sm font-semibold text-white hover:bg-[#1A45BF] disabled:opacity-50">
              {savingCard ? 'Menyimpan...' : '💾 Simpan Desain'}
            </button>
            {cardSavedAt && <p className="text-[10px] text-[#16a34a] text-center">✓ Disimpan pukul {cardSavedAt}</p>}
            <p className="text-[10px] text-[#aaa] text-center">Desain berlaku untuk semua kartu garansi yang dicetak</p>
          </div>
        </div>

        {/* Preview */}
        <div className="flex-1 bg-[#f0f2f5] overflow-auto flex flex-col items-center justify-center gap-6 p-10">
          <p className="text-[12px] text-[#888] font-semibold uppercase tracking-wide">Preview Kartu Garansi</p>
          <WarrantyCard warranty={dummyWarranty} design={cardDesign} />
          <div className="flex items-center gap-2 text-[11px] text-[#888]">
            <span className="inline-flex items-center gap-1 rounded border border-[#e2e8f0] bg-white px-2.5 py-1 font-mono font-semibold text-[#555]">
              85.6 × 53.98 mm
            </span>
            <span>·</span>
            <span>ISO 7810 ID-1 (ukuran kartu ATM)</span>
          </div>
          <p className="text-[11px] text-[#94a3b8] max-w-sm text-center">
            Data di atas adalah contoh. Kartu asli akan berisi data pelanggan, layanan, dan tanggal garansi yang sebenarnya.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-56px)]">
      {/* Settings panel */}
      <div className="w-[280px] flex-shrink-0 border-r border-[#e2e8f0] bg-white overflow-y-auto">
        <div className="px-4 py-4 border-b border-[#f1f5f9]">
          <p className="text-sm font-bold text-[#111]">{cfg.title}</p>
          <p className="text-[11px] text-[#888] mt-0.5">Kustomisasi format dokumen</p>
        </div>

        <div className="px-4 py-4 space-y-4">
          {/* Identitas */}
          <div>
            <p className="text-[11px] font-bold text-[#1E4FD8] uppercase tracking-wide mb-2">Identitas Perusahaan</p>
            <div className="space-y-2">
              <div><label className={labelCls}>Nama Perusahaan</label><input value={company.nama} onChange={setC('nama')} className={inputCls} /></div>
              <div><label className={labelCls}>Alamat</label><input value={company.alamat} onChange={setC('alamat')} className={inputCls} /></div>
              <div><label className={labelCls}>Kota & Kode Pos</label><input value={company.kota} onChange={setC('kota')} className={inputCls} /></div>
              <div><label className={labelCls}>Telepon</label><input value={company.telp} onChange={setC('telp')} className={inputCls} /></div>
              <div><label className={labelCls}>Email</label><input value={company.email} onChange={setC('email')} className={inputCls} /></div>
              <div><label className={labelCls}>NPWP</label><input value={company.npwp} onChange={setC('npwp')} className={inputCls} /></div>
              <div>
                <label className={labelCls}>Logo</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="w-full rounded border border-[#cbd5e1] bg-white px-2 py-2 text-[11px] text-[#555] file:mr-2 file:rounded file:border-0 file:bg-[#EEF3FE] file:px-2 file:py-1 file:text-[11px] file:font-semibold file:text-[#1E4FD8]"
                />
                <div className="mt-2 flex items-center gap-2 rounded border border-[#e2e8f0] bg-[#f8fafc] p-2">
                  <img src={company.logoDataUrl || '/workshopmu-logo.svg'} alt="Logo preview" className="h-9 w-9 rounded bg-white object-contain" />
                  {company.logoDataUrl ? (
                    <button
                      type="button"
                      onClick={() => setCompany((prev) => ({ ...prev, logoDataUrl: '' }))}
                      className="text-[11px] font-semibold text-[#dc2626] hover:underline"
                    >
                      Hapus logo
                    </button>
                  ) : (
                    <span className="text-[10px] text-[#94a3b8]">Default: logo WorkshopMU</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Tampilan */}
          <div>
            <p className="text-[11px] font-bold text-[#1E4FD8] uppercase tracking-wide mb-2">Tampilan</p>
            <div className="space-y-2">
              <div>
                <label className={labelCls}>Warna Aksen</label>
                <div className="flex gap-2 items-center">
                  <input type="color" value={doc.accentColor} onChange={setD('accentColor')} className="h-8 w-10 rounded border border-[#cbd5e1] cursor-pointer" />
                  <input value={doc.accentColor} onChange={setD('accentColor')} className={inputCls + ' flex-1'} />
                </div>
                <div className="flex gap-1.5 mt-1.5 flex-wrap">
                  {['#1E4FD8','#0d9488','#7c3aed','#dc2626','#ea580c','#111827'].map((c) => (
                    <button key={c} onClick={() => setDoc((p) => ({ ...p, accentColor: c }))}
                      className="h-5 w-5 rounded-full border-2 transition"
                      style={{ background: c, borderColor: doc.accentColor === c ? '#111' : 'transparent' }} />
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={doc.showNpwp} onChange={setD('showNpwp')} className="accent-[#1E4FD8]" />
                <span className="text-[12px] text-[#555]">Tampilkan NPWP</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={doc.showLogo} onChange={setD('showLogo')} className="accent-[#1E4FD8]" />
                <span className="text-[12px] text-[#555]">Tampilkan logo</span>
              </label>
              {doc.showLogo && (
                <div>
                  <div className="flex items-center justify-between">
                    <label className={labelCls}>Area Logo</label>
                    <span className="text-[11px] font-semibold text-[#64748b]">{doc.logoSize}px lebar</span>
                  </div>
                  <input
                    type="range"
                    min={40}
                    max={420}
                    value={doc.logoSize}
                    onChange={setD('logoSize')}
                    className="w-full accent-[#1E4FD8]"
                  />
                  <div className="mt-2 flex items-center justify-between">
                    <label className={labelCls}>Zoom Isi Logo</label>
                    <span className="text-[11px] font-semibold text-[#64748b]">{Math.round(doc.logoZoom * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={50}
                    max={400}
                    value={Math.round(doc.logoZoom * 100)}
                    onChange={(e) => setDoc((prev) => ({ ...prev, logoZoom: Number(e.target.value) / 100 }))}
                    className="w-full accent-[#f59e0b]"
                  />
                </div>
              )}
              <div>
                <label className={labelCls}>Font Nama Workshop</label>
                <select value={doc.companyNameFont} onChange={setD('companyNameFont')} className={inputCls}>
                  {[
                    ['Inter', 'Inter / Modern'],
                    ['Arial', 'Arial / Netral'],
                    ['Georgia', 'Georgia / Elegan'],
                    ['Times New Roman', 'Times / Formal'],
                    ['Trebuchet MS', 'Trebuchet / Friendly'],
                    ['Courier New', 'Courier / Teknis'],
                  ].map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={doc.showTtd} onChange={setD('showTtd')} className="accent-[#1E4FD8]" />
                <span className="text-[12px] text-[#555]">Tampilkan blok tanda tangan</span>
              </label>
            </div>
          </div>

          {/* Dokumen */}
          <div>
            <p className="text-[11px] font-bold text-[#1E4FD8] uppercase tracking-wide mb-2">Pengaturan Dokumen</p>
            <div className="space-y-2">
              <div><label className={labelCls}>Periode / Bulan</label><input value={doc.periode} onChange={setD('periode')} className={inputCls} /></div>
              <div><label className={labelCls}>Termin Bayar</label>
                <select value={doc.termin} onChange={setD('termin')} className={inputCls}>
                  {['Tunai','NET 7','NET 14','NET 30','NET 45','NET 60'].map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div><label className={labelCls}>Tarif Pajak (%)</label><input type="number" min="0" max="100" value={doc.pajakRate} onChange={setD('pajakRate')} className={inputCls} /></div>
              <div><label className={labelCls}>Diskon (%)</label><input type="number" min="0" max="100" value={doc.diskonRate} onChange={setD('diskonRate')} className={inputCls} /></div>
              <div><label className={labelCls}>Catatan</label>
                <textarea value={doc.catatan} onChange={setD('catatan')} rows={3} className={inputCls + ' resize-none'} />
              </div>
            </div>
          </div>

          {/* Tanda tangan */}
          {doc.showTtd && (
            <div>
              <p className="text-[11px] font-bold text-[#1E4FD8] uppercase tracking-wide mb-2">Tanda Tangan</p>
              <div className="space-y-2">
                {[
                  { label: cfg.ttd[0], n: 'ttd1Nama' as keyof DocSettings, j: 'ttd1Jabatan' as keyof DocSettings },
                  { label: cfg.ttd[1], n: 'ttd2Nama' as keyof DocSettings, j: 'ttd2Jabatan' as keyof DocSettings },
                  ...(cfg.ttd[2] ? [{ label: cfg.ttd[2], n: 'ttd3Nama' as keyof DocSettings, j: 'ttd3Jabatan' as keyof DocSettings }] : []),
                ].map((ttd) => (
                  <div key={ttd.label} className="rounded border border-[#e2e8f0] p-2 space-y-1.5">
                    <p className="text-[10px] font-semibold text-[#888]">{ttd.label}</p>
                    <input placeholder="Nama" value={doc[ttd.n] as string} onChange={setD(ttd.n)} className={inputCls} />
                    <input placeholder="Jabatan" value={doc[ttd.j] as string} onChange={setD(ttd.j)} className={inputCls} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Preview */}
      <div className="flex-1 bg-[#f0f2f5] overflow-auto">
        {/* Toolbar */}
        <div className="sticky top-0 z-10 bg-white border-b border-[#e2e8f0] px-5 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <p className="text-[12px] font-semibold text-[#555]">Preview — {cfg.title}</p>
            {unsaved && (
              <span className="text-[10px] text-[#f59e0b] font-semibold">● Belum disimpan</span>
            )}
            {!unsaved && savedAt && (
              <span className="text-[10px] text-[#16a34a] font-semibold">✓ Disimpan pukul {savedAt}</span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleReset}
              className="px-3 py-1.5 rounded border border-[#e2e8f0] text-[12px] text-[#555] hover:bg-[#f8fafc] transition"
            >
              ↺ Reset
            </button>
            <button
              onClick={handleSave}
              disabled={!unsaved}
              className="px-4 py-1.5 rounded border border-[#1E4FD8] text-[#1E4FD8] text-[12px] font-semibold hover:bg-[#EEF3FE] disabled:opacity-40 disabled:cursor-default transition"
            >
              💾 Simpan
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-1.5 rounded bg-[#1E4FD8] text-white text-[12px] font-semibold hover:bg-[#1A45BF] transition"
            >
              PDF
            </button>
          </div>
        </div>

        {/* A4 document */}
        <div className="p-8 flex justify-center">
          <div
            ref={printRef}
            style={{
              width: 794,
              minHeight: 1123,
              background: '#fff',
              padding: '40px 48px',
              boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
              fontFamily: "'Segoe UI', Arial, sans-serif",
              fontSize: 12,
              color: '#111',
              lineHeight: 1.5,
            }}
          >
            <DocPreview type={docType} company={company} doc={doc} regs={regs} expenses={expenses} />
          </div>
        </div>
      </div>
    </div>
  )
}
