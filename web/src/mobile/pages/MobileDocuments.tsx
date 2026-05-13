import { useState } from 'react'
import { MobileSubHeader } from '../MobileLayout'

const docTypes = [
  { label: 'Invoice', desc: 'Template invoice penjualan' },
  { label: 'Purchase Order', desc: 'Template pesanan pembelian' },
  { label: 'Laporan Penjualan', desc: 'Format laporan penjualan' },
  { label: 'Laporan Pendapatan', desc: 'Format laporan pendapatan' },
  { label: 'Laporan Pengeluaran', desc: 'Format laporan pengeluaran' },
  { label: 'Laporan Laba Rugi', desc: 'Format laporan laba rugi' },
]

export default function MobileDocuments() {
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null)

  return (
    <>
      <MobileSubHeader title="Dokumen" subtitle="Template tersedia di desktop" />
      <div className="space-y-3 px-4 pt-3 pb-6">
        <section className="rounded-2xl border border-[#D9E3FC] bg-brand-50 p-4">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-white text-brand">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <path d="M14 2v6h6" />
              <path d="M8 13h8M8 17h6" />
            </svg>
          </div>
          <p className="text-[15px] font-bold text-ink">Edit dokumen tersedia di versi desktop</p>
          <p className="mt-1.5 text-[12px] leading-relaxed text-[#475569]">
            Pengaturan template, kop surat, tanda tangan, tabel, dan layout print lebih aman diedit dari layar desktop.
          </p>
        </section>

        <section className="rounded-2xl border border-wm-line bg-white p-4">
          <p className="text-[13px] font-bold text-ink">Dokumen yang dikelola</p>
          <div className="mt-3 space-y-2">
            {docTypes.map(doc => (
              <button key={doc.label} onClick={() => setSelectedDoc(doc.label)} className="block w-full rounded-xl border border-[#f1f5f9] bg-wm-bg px-3 py-2.5 text-left active:bg-brand-50">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[12px] font-bold text-ink">{doc.label}</p>
                    <p className="mt-0.5 text-[10px] text-ink-3">{doc.desc}</p>
                  </div>
                  <span className="shrink-0 text-[16px] text-ink-4">›</span>
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>

      {selectedDoc && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={() => setSelectedDoc(null)}>
          <div className="w-full rounded-t-3xl bg-white p-5 pb-8" onClick={e => e.stopPropagation()}>
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#e2e8f0]" />
            <p className="text-center text-[16px] font-bold text-ink">{selectedDoc}</p>
            <p className="mt-2 text-center text-[12px] leading-relaxed text-ink-3">
              Edit dokumen hanya tersedia di versi desktop.
            </p>
            <button onClick={() => setSelectedDoc(null)} className="mt-5 w-full rounded-2xl bg-brand py-3 text-[14px] font-bold text-white">
              Mengerti
            </button>
          </div>
        </div>
      )}
    </>
  )
}
