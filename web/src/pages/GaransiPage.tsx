import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { tenantSettingsAPI, warrantiesAPI } from '../services/api'
import api from '../services/api'
import { CardDesign, DEFAULT_DESIGN, CARD_W, CARD_H, WarrantyCard } from '../components/WarrantyCardTemplates'

interface Warranty {
  id: string
  code: string
  startDate: string
  endDate: string
  status: 'active' | 'expired' | 'void'
  customer: { id: string; name: string; phone: string }
  workshop: { id: string; title: string; notes?: string }
  registration: { id: string; vehicleName?: string; licensePlate?: string; scheduledDate?: string }
}


const STATUS_CONFIG = {
  active:  { label: 'Aktif',   bg: '#dcfce7', color: '#16a34a' },
  expired: { label: 'Habis',   bg: '#fee2e2', color: '#dc2626' },
  void:    { label: 'Dibatal', bg: '#f1f5f9', color: '#64748b' },
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}

function daysLeft(endDate: string) {
  const diff = Math.ceil((new Date(endDate).getTime() - Date.now()) / 86400000)
  return diff
}


// ── Main Page ────────────────────────────────────────────────────────────────
export default function GaransiPage() {
  const { tenant } = useAuth()
  const [warranties, setWarranties]     = useState<Warranty[]>([])
  const [loading, setLoading]           = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [search, setSearch]             = useState('')
  const [selectedWarranty, setSelectedWarranty] = useState<Warranty | null>(null)
  const [showCardModal, setShowCardModal]       = useState(false)
  const [design, setDesign]             = useState<CardDesign>(DEFAULT_DESIGN)
  const [voidConfirm, setVoidConfirm]   = useState<Warranty | null>(null)
  const [submitting, setSubmitting]     = useState(false)
  const [syncError, setSyncError]       = useState<string | null>(null)
  const printRef = useRef<HTMLDivElement>(null)

  const fetchWarranties = useCallback(async () => {
    if (!tenant?.id) return
    try {
      setLoading(true)
      const res = await api.get('/api/warranties')
      setWarranties(res.data.data || [])
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [tenant?.id])

  // Load design dari TenantSetting
  useEffect(() => {
    tenantSettingsAPI.get('warranty_card_design')
      .then(res => {
        if (res.data.data) setDesign({ ...DEFAULT_DESIGN, ...res.data.data })
      })
      .catch(() => {})
  }, [])

  // Pre-fill workshopName dari nama tenant
  useEffect(() => {
    if (tenant?.name && !design.workshopName) {
      setDesign(d => ({ ...d, workshopName: tenant.name }))
    }
  }, [tenant?.name])

  useEffect(() => { fetchWarranties() }, [fetchWarranties])

  const handleVoid = async () => {
    if (!voidConfirm) return
    setSubmitting(true)
    try {
      await api.put(`/api/warranties/${voidConfirm.id}/void`)
      setVoidConfirm(null)
      await fetchWarranties()
    } catch { /* silent */ }
    finally { setSubmitting(false) }
  }

  const handleSyncDuration = async (warranty: Warranty) => {
    setSubmitting(true)
    try {
      const res = await warrantiesAPI.syncDuration(warranty.id)
      const updated = res.data.data
      setWarranties(prev => prev.map(w => w.id === warranty.id ? updated : w))
      setSelectedWarranty(prev => prev?.id === warranty.id ? updated : prev)
    } catch (err: any) {
      setSyncError(err.response?.data?.message || 'Gagal sinkron durasi garansi')
    } finally {
      setSubmitting(false)
    }
  }

  const handlePrint = () => {
    if (!printRef.current) return
    const html = printRef.current.outerHTML
    const win = window.open('', '_blank')
    if (!win) return
    // At CSS 96dpi: 85.6mm ≈ 323px, 53.98mm ≈ 204px
    // Card screen size: 342×216px → scale factor ≈ 0.944
    win.document.write(`
      <html><head><title>Kartu Garansi</title>
      <style>
        @page { size: 85.6mm 53.98mm; margin: 0; }
        * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        @media print {
          body { margin: 0; padding: 0; width: 85.6mm; height: 53.98mm; overflow: hidden; background: transparent; }
          #wrap { transform: scale(0.944); transform-origin: top left; width: ${CARD_W}px; height: ${CARD_H}px; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
        }
        @media screen {
          body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #e2e8f0; }
          #wrap {}
        }
      </style>
      </head><body><div id="wrap">${html}</div></body></html>`)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print() }, 300)
  }

  const filtered = warranties.filter(w => {
    if (filterStatus !== 'all' && w.status !== filterStatus) return false
    if (search) {
      const q = search.toLowerCase()
      if (!w.customer.name.toLowerCase().includes(q) &&
          !w.workshop.title.toLowerCase().includes(q) &&
          !w.code.toLowerCase().includes(q) &&
          !(w.registration.licensePlate || '').toLowerCase().includes(q)) return false
    }
    return true
  })

  const counts = {
    all: warranties.length,
    active: warranties.filter(w => w.status === 'active').length,
    expired: warranties.filter(w => w.status === 'expired').length,
    void: warranties.filter(w => w.status === 'void').length,
  }

  return (
    <div className="p-6 space-y-5">

      {/* Sync error modal */}
      {syncError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg border border-[#e2e8f0] bg-white p-6 shadow-xl">
            <p className="text-base font-bold text-[#dc2626] mb-2">Gagal Sinkron Garansi</p>
            <p className="text-sm text-[#555] mb-5">{syncError}</p>
            <button onClick={() => setSyncError(null)}
              className="w-full rounded bg-[#dc2626] py-2 text-sm font-semibold text-white hover:bg-[#b91c1c]">
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* Void confirm modal */}
      {voidConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg border border-[#e2e8f0] bg-white p-6 shadow-xl">
            <h3 className="text-base font-bold text-[#111]">Batalkan Garansi?</h3>
            <p className="mt-2 text-sm text-[#666]">
              Garansi <span className="font-semibold text-[#111]">{voidConfirm.code}</span> milik{' '}
              <span className="font-semibold">{voidConfirm.customer.name}</span> akan dibatalkan.
            </p>
            <div className="mt-5 flex gap-2">
              <button onClick={handleVoid} disabled={submitting}
                className="flex-1 rounded bg-[#dc2626] px-4 py-2 text-sm font-semibold text-white hover:bg-[#b91c1c] disabled:opacity-50">
                {submitting ? 'Membatalkan...' : 'Batalkan Garansi'}
              </button>
              <button onClick={() => setVoidConfirm(null)}
                className="flex-1 rounded border border-[#e2e8f0] px-4 py-2 text-sm text-[#555] hover:bg-[#f8fafc]">
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Card modal */}
      {showCardModal && selectedWarranty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-4xl rounded-xl border border-[#e2e8f0] bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#f1f5f9]">
              <div>
                <p className="text-sm font-bold text-[#111]">Kartu Garansi Digital</p>
                <p className="text-[11px] text-[#888] mt-0.5">
                  Ubah desain di{' '}
                  <a href="/admin/documents" className="text-[#1E4FD8] hover:underline font-semibold">Pengaturan Dokumen</a>
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={handlePrint}
                  className="px-3 py-1.5 rounded bg-[#1E4FD8] text-white text-[12px] font-semibold hover:bg-[#1A45BF]">
                  PDF
                </button>
                <button onClick={() => setShowCardModal(false)}
                  className="px-3 py-1.5 rounded border border-[#e2e8f0] text-[12px] text-[#888] hover:bg-[#f8fafc]">
                  ✕
                </button>
              </div>
            </div>

            <div className="flex">
              {/* Card Preview */}
              <div className="flex-1 flex flex-col items-center justify-center p-10 bg-[#f1f5f9] gap-4">
                <div ref={printRef}>
                  <WarrantyCard warranty={selectedWarranty} design={design} />
                </div>
                <div className="flex items-center gap-2 text-[11px] text-[#888]">
                  <span className="inline-flex items-center gap-1 rounded border border-[#e2e8f0] bg-white px-2.5 py-1 font-mono font-semibold text-[#555]">
                    85.6 × 53.98 mm
                  </span>
                  <span>·</span>
                  <span>ISO 7810 ID-1 (ukuran kartu ATM)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {warranties.length === 0 && !loading && (
        <div className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3 flex items-center gap-3">
          <span className="text-base">💡</span>
          <p className="text-[12px] text-[#888]">
            Belum ada garansi. Garansi dibuat otomatis saat servis ditandai <strong>Selesai</strong> dan layanannya memiliki durasi garansi.
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { key: 'all', label: 'Total Garansi', color: '#1E4FD8' },
          { key: 'active', label: 'Aktif', color: '#16a34a' },
          { key: 'expired', label: 'Habis', color: '#dc2626' },
          { key: 'void', label: 'Dibatal', color: '#64748b' },
        ].map(s => (
          <div key={s.key} className="rounded-lg border border-[#e2e8f0] bg-white p-5 cursor-pointer hover:border-[#1E4FD8] transition"
            onClick={() => setFilterStatus(s.key)}
            style={{ borderColor: filterStatus === s.key ? s.color : undefined }}>
            <p className="text-xs text-[#999]">{s.label}</p>
            <p className="mt-2 text-4xl font-bold" style={{ color: filterStatus === s.key ? s.color : '#111' }}>
              {counts[s.key as keyof typeof counts]}
            </p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-[#e2e8f0] bg-white overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-[#f1f5f9]">
          <div>
            <p className="text-sm font-bold text-[#111]">Daftar Garansi</p>
            <p className="text-[11px] text-[#888] mt-0.5">Garansi otomatis dibuat saat servis selesai</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari nama, layanan, kode..."
              className="rounded border border-[#e2e8f0] px-3 py-1.5 text-[12px] text-[#111] outline-none focus:border-[#1E4FD8] w-52"
            />
            <button onClick={fetchWarranties}
              className="px-3 py-1.5 text-[11px] text-[#1E4FD8] border border-[#e2e8f0] rounded hover:bg-[#f8fafc]">
              ↻ Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-[#888]">Memuat garansi...</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm font-semibold text-[#888]">Belum ada garansi</p>
            <p className="mt-1 text-[12px] text-[#aaa]">
              Garansi dibuat otomatis saat servis selesai dan layanan memiliki durasi garansi.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#f1f5f9] bg-[#f8fafc]">
                  {['Kode', 'Pelanggan', 'Layanan', 'Kendaraan', 'Mulai', 'Berakhir', 'Sisa', 'Status', 'Aksi'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold text-[#888] uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(w => {
                  const days = daysLeft(w.endDate)
                  const cfg = STATUS_CONFIG[w.status]
                  return (
                    <tr key={w.id} className="border-b border-[#f1f5f9] last:border-b-0 hover:bg-[#fafbfc]">
                      <td className="px-4 py-3">
                        <span className="text-[11px] font-bold tracking-wide text-[#1E4FD8]">{w.code}</span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-[12px] font-semibold text-[#111]">{w.customer.name}</p>
                        <p className="text-[10px] text-[#888]">{w.customer.phone}</p>
                      </td>
                      <td className="px-4 py-3 text-[12px] text-[#555]">{w.workshop.title}</td>
                      <td className="px-4 py-3 text-[12px] text-[#555]">
                        {w.registration.vehicleName || '—'}
                        {w.registration.licensePlate && <span className="ml-1 text-[#888]">· {w.registration.licensePlate}</span>}
                      </td>
                      <td className="px-4 py-3 text-[11px] text-[#888]">{fmtDate(w.startDate)}</td>
                      <td className="px-4 py-3 text-[11px] text-[#888]">{fmtDate(w.endDate)}</td>
                      <td className="px-4 py-3">
                        {w.status === 'active' ? (
                          <span className={`text-[11px] font-bold ${days <= 7 ? 'text-[#dc2626]' : days <= 30 ? 'text-[#f59e0b]' : 'text-[#16a34a]'}`}>
                            {days > 0 ? `${days} hari` : 'Hari ini'}
                          </span>
                        ) : <span className="text-[11px] text-[#aaa]">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold"
                          style={{ background: cfg.bg, color: cfg.color }}>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => { setSelectedWarranty(w); setShowCardModal(true) }}
                            className="px-2.5 py-1 rounded border border-[#1E4FD8] bg-[#EEF3FE] text-[11px] font-semibold text-[#1E4FD8] hover:bg-[#dbeafe] transition">
                            🛡 Kartu
                          </button>
                          <button
                            onClick={() => handleSyncDuration(w)}
                            disabled={submitting}
                            className="px-2.5 py-1 rounded border border-[#D9E3FC] bg-white text-[11px] font-semibold text-[#1E4FD8] hover:bg-[#EEF3FE] transition disabled:opacity-50">
                            Sync
                          </button>
                          {w.status === 'active' && (
                            <button onClick={() => setVoidConfirm(w)}
                              className="px-2.5 py-1 rounded border border-[#fecaca] bg-[#fee2e2] text-[11px] text-[#dc2626] hover:bg-[#fecaca] transition">
                              Batalkan
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
