import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { tenantSettingsAPI, warrantiesAPI } from '../../services/api'
import { MobileSubHeader } from '../MobileLayout'

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

interface CardDesign {
  workshopName: string
  tagline: string
  primaryColor: string
  secondaryColor: string
  logoUrl: string
  footerText: string
  templateId: string
}

const DEFAULT_DESIGN: CardDesign = {
  workshopName: '',
  tagline: 'Kami menjamin kualitas terbaik untuk kendaraan Anda',
  primaryColor: '#1E4FD8',
  secondaryColor: '#1e40af',
  logoUrl: '',
  footerText: 'Garansi berlaku sesuai ketentuan yang tertera.',
  templateId: 'classic',
}

const STATUS_CONFIG = {
  active: { label: 'Aktif', bg: '#dcfce7', color: '#16a34a' },
  expired: { label: 'Habis', bg: '#fee2e2', color: '#dc2626' },
  void: { label: 'Dibatal', bg: '#f1f5f9', color: '#64748b' },
}

function fmtDate(d?: string) {
  return d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'
}

function shortDate(d: string) {
  const dt = new Date(d)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des']
  return `${String(dt.getDate()).padStart(2, '0')} ${months[dt.getMonth()]} ${String(dt.getFullYear()).slice(-2)}`
}

function daysLeft(endDate: string) {
  return Math.ceil((new Date(endDate).getTime() - Date.now()) / 86400000)
}

export default function MobileGaransi() {
  const { tenant } = useAuth()
  const [items, setItems] = useState<Warranty[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'expired' | 'void'>('all')
  const [selected, setSelected] = useState<Warranty | null>(null)
  const [voidTarget, setVoidTarget] = useState<Warranty | null>(null)
  const [saving, setSaving] = useState(false)
  const [design, setDesign] = useState<CardDesign>(DEFAULT_DESIGN)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await warrantiesAPI.list()
      setItems(res.data.data || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    tenantSettingsAPI.get('warranty_card_design')
      .then(res => {
        const saved = res.data.data || {}
        setDesign({ ...DEFAULT_DESIGN, workshopName: tenant?.name || '', ...saved })
      })
      .catch(() => setDesign(d => ({ ...d, workshopName: tenant?.name || '' })))
  }, [tenant?.name])

  const counts = useMemo(() => ({
    all: items.length,
    active: items.filter(w => w.status === 'active').length,
    expired: items.filter(w => w.status === 'expired').length,
    void: items.filter(w => w.status === 'void').length,
  }), [items])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return items.filter(w => {
      if (filter !== 'all' && w.status !== filter) return false
      if (!q) return true
      return w.code.toLowerCase().includes(q) ||
        w.customer.name.toLowerCase().includes(q) ||
        w.workshop.title.toLowerCase().includes(q) ||
        (w.registration.licensePlate || '').toLowerCase().includes(q) ||
        (w.registration.vehicleName || '').toLowerCase().includes(q)
    })
  }, [items, filter, search])

  const syncDuration = async (warranty: Warranty) => {
    setSaving(true)
    try {
      const res = await warrantiesAPI.syncDuration(warranty.id)
      const updated = res.data.data
      setItems(prev => prev.map(w => w.id === warranty.id ? updated : w))
      setSelected(prev => prev?.id === warranty.id ? updated : prev)
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal sinkron durasi garansi')
    } finally {
      setSaving(false)
    }
  }

  const voidWarranty = async () => {
    if (!voidTarget) return
    setSaving(true)
    try {
      await warrantiesAPI.void(voidTarget.id)
      setVoidTarget(null)
      setSelected(null)
      await fetchData()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal membatalkan garansi')
    } finally {
      setSaving(false)
    }
  }

  const openPrint = (warranty: Warranty) => {
    const html = cardHtml(warranty, design)
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <html><head><title>${warranty.code}</title>
      <style>
        @page { size: 85.6mm 53.98mm; margin: 0; }
        * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #e2e8f0; }
        @media print { body { width: 85.6mm; height: 53.98mm; min-height: 0; background: transparent; } #wrap { transform: scale(.944); transform-origin: top left; } }
      </style></head><body><div id="wrap">${html}</div></body></html>
    `)
    win.document.close()
    setTimeout(() => win.print(), 300)
  }

  const downloadCard = (warranty: Warranty) => {
    const svg = cardSvg(warranty, design)
    const svgUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
    const img = new Image()
    img.onload = () => {
      const scale = 3
      const canvas = document.createElement('canvas')
      canvas.width = 342 * scale
      canvas.height = 216 * scale
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        URL.revokeObjectURL(svgUrl)
        return
      }
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      const jpgUrl = canvas.toDataURL('image/jpeg', 0.95)
      const a = document.createElement('a')
      a.href = jpgUrl
      a.download = `${warranty.code}.jpg`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(svgUrl)
    }
    img.onerror = () => {
      URL.revokeObjectURL(svgUrl)
      alert('Gagal membuat JPG kartu garansi')
    }
    img.src = svgUrl
  }

  return (
    <>
      <MobileSubHeader title="Garansi" subtitle={loading ? 'Memuat...' : `${filtered.length} data`} />
      <div className="px-4 pt-3 pb-4 space-y-3">
        <div className="grid grid-cols-4 gap-2">
          {([
            ['all', 'Total', '#1E4FD8'],
            ['active', 'Aktif', '#16a34a'],
            ['expired', 'Habis', '#dc2626'],
            ['void', 'Void', '#64748b'],
          ] as const).map(([key, label, color]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`bg-white rounded-2xl border p-2 text-left ${filter === key ? 'border-[#1E4FD8]' : 'border-wm-line'}`}
            >
              <p className="text-[9px] text-ink-3">{label}</p>
              <p className="text-[18px] font-bold" style={{ color }}>{counts[key]}</p>
            </button>
          ))}
        </div>

        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cari kode, pelanggan, layanan, plat..."
          className="w-full bg-white border border-wm-line rounded-2xl px-3 py-2.5 text-[13px] outline-none focus:border-[#1E4FD8]"
        />

        {loading && <p className="text-center text-[12px] text-ink-4 py-6">Memuat...</p>}
        {!loading && filtered.length === 0 && (
          <div className="bg-white rounded-2xl border border-wm-line p-8 text-center">
            <p className="text-[13px] text-[#666]">Belum ada garansi</p>
            <p className="text-[11px] text-[#aaa] mt-1">Garansi dibuat otomatis saat servis selesai.</p>
          </div>
        )}

        <div className="space-y-2.5">
          {filtered.map(w => {
            const days = daysLeft(w.endDate)
            const cfg = STATUS_CONFIG[w.status] || STATUS_CONFIG.active
            return (
              <div key={w.id} className="bg-white rounded-2xl border border-wm-line p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold tracking-wide text-brand">{w.code}</p>
                    <p className="text-[14px] font-bold text-ink truncate mt-1">{w.customer.name}</p>
                    <p className="text-[11px] text-ink-3 truncate">{w.customer.phone}</p>
                  </div>
                  <span className="text-[9px] font-bold px-2 py-1 rounded-full flex-shrink-0" style={{ background: cfg.bg, color: cfg.color }}>
                    {cfg.label}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                  <Info label="Layanan" value={w.workshop.title} />
                  <Info label="Kendaraan" value={`${w.registration.vehicleName || '-'}${w.registration.licensePlate ? ' - ' + w.registration.licensePlate : ''}`} />
                  <Info label="Mulai" value={fmtDate(w.startDate)} />
                  <Info label="Berakhir" value={fmtDate(w.endDate)} />
                </div>

                <div className="mt-3 flex items-center justify-between">
                  {w.status === 'active' ? (
                    <p className={`text-[11px] font-bold ${days <= 7 ? 'text-[#dc2626]' : days <= 30 ? 'text-[#f59e0b]' : 'text-[#16a34a]'}`}>
                      {days > 0 ? `${days} hari tersisa` : 'Berakhir hari ini'}
                    </p>
                  ) : <p className="text-[11px] text-ink-4">Tidak aktif</p>}
                  <button onClick={() => setSelected(w)} className="bg-brand-50 text-brand text-[12px] font-semibold px-3 py-2 rounded-xl">
                    Detail
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end" onClick={() => setSelected(null)}>
          <div className="bg-white w-full rounded-t-3xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white px-5 pt-4 pb-3 border-b border-wm-line z-10">
              <div className="w-10 h-1 bg-[#e2e8f0] rounded-full mx-auto mb-3" />
              <div className="flex items-center justify-between">
                <p className="text-[16px] font-bold">Kartu Garansi</p>
                <button onClick={() => setSelected(null)} className="text-[12px] font-semibold text-[#666]">Tutup</button>
              </div>
            </div>

            <div className="px-5 py-4 space-y-4 pb-8">
              <WarrantyPreview warranty={selected} design={design} />

              <div className="rounded-2xl border border-[#dbeafe] bg-brand-50 px-3 py-2.5">
                <p className="text-[12px] font-semibold text-[#1A45BF]">Edit kartu garansi tersedia di versi desktop.</p>
              </div>

              <div className="bg-wm-bg rounded-2xl p-3 space-y-2">
                <InfoRow label="Kode" value={selected.code} />
                <InfoRow label="Pelanggan" value={`${selected.customer.name} - ${selected.customer.phone}`} />
                <InfoRow label="Layanan" value={selected.workshop.title} />
                <InfoRow label="Kendaraan" value={`${selected.registration.vehicleName || '-'}${selected.registration.licensePlate ? ' - ' + selected.registration.licensePlate : ''}`} />
                <InfoRow label="Masa Berlaku" value={`${fmtDate(selected.startDate)} - ${fmtDate(selected.endDate)}`} />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => openPrint(selected)} className="bg-brand text-white text-[13px] font-semibold py-3 rounded-xl">
                  PDF
                </button>
                <button onClick={() => downloadCard(selected)} className="bg-[#16a34a] text-white text-[13px] font-semibold py-3 rounded-xl">
                  Download
                </button>
                <button onClick={() => syncDuration(selected)} disabled={saving} className="bg-brand-50 text-brand text-[13px] font-semibold py-3 rounded-xl disabled:opacity-50">
                  Sync Durasi
                </button>
                <button onClick={() => setSelected(null)} className="bg-wm-bg text-[#475569] text-[13px] font-semibold py-3 rounded-xl">
                  Tutup
                </button>
              </div>
              {selected.status === 'active' && (
                <button onClick={() => setVoidTarget(selected)} className="w-full bg-[#fef2f2] text-[#dc2626] text-[13px] font-semibold py-3 rounded-xl">
                  Batalkan Garansi
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {voidTarget && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-end" onClick={() => setVoidTarget(null)}>
          <div className="bg-white w-full rounded-t-3xl p-5 pb-8" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-[#e2e8f0] rounded-full mx-auto mb-4" />
            <p className="text-[16px] font-bold text-center mb-1">Batalkan Garansi?</p>
            <p className="text-[12px] text-[#666] text-center mb-5">{voidTarget.code} akan dibatalkan.</p>
            <div className="flex gap-2">
              <button onClick={() => setVoidTarget(null)} className="flex-1 bg-wm-bg text-ink-3 text-[14px] font-semibold py-3 rounded-xl">Batal</button>
              <button onClick={voidWarranty} disabled={saving} className="flex-1 bg-[#dc2626] text-white text-[14px] font-semibold py-3 rounded-xl disabled:opacity-50">
                {saving ? 'Memproses...' : 'Batalkan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-wm-bg rounded-xl px-3 py-2 min-w-0">
      <p className="text-[9px] text-ink-3">{label}</p>
      <p className="text-[11px] font-semibold text-ink truncate">{value}</p>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-[12px]">
      <span className="text-ink-3 flex-shrink-0">{label}</span>
      <span className="font-semibold text-ink text-right">{value}</span>
    </div>
  )
}

function WarrantyPreview({ warranty, design }: { warranty: Warranty; design: CardDesign }) {
  return (
    <div className="overflow-x-auto pb-1">
      <div
        className="w-[342px] h-[216px] rounded-[14px] overflow-hidden shadow-xl text-white relative mx-auto"
        style={{ background: `linear-gradient(135deg, ${design.primaryColor}, ${design.secondaryColor})` }}
      >
        <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10" />
        <div className="absolute inset-x-0 bottom-0 bg-black/25 px-4 py-3 flex items-end justify-between">
          <p className="text-[11px] font-bold tracking-[2px]">{warranty.code}</p>
          <div className="text-right">
            <p className="text-[8px] text-white/60">BERLAKU</p>
            <p className="text-[10px] font-semibold">{shortDate(warranty.startDate)} - {shortDate(warranty.endDate)}</p>
          </div>
        </div>
        <div className="relative z-10 p-4">
          <div className="flex items-center gap-2 mb-4">
            {design.logoUrl ? <img src={design.logoUrl} className="w-6 h-6 rounded object-cover bg-white" /> : <div className="w-6 h-6 rounded bg-white/20" />}
            <p className="text-[12px] font-bold">{design.workshopName || 'Workshop'}</p>
          </div>
          <p className="text-[9px] text-white/60 tracking-wide">KARTU GARANSI DIGITAL</p>
          <p className="text-[17px] font-black uppercase truncate mt-1">{warranty.customer.name}</p>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <CardField label="LAYANAN" value={warranty.workshop.title} />
            <CardField label="KENDARAAN" value={`${warranty.registration.vehicleName || '-'}${warranty.registration.licensePlate ? ' - ' + warranty.registration.licensePlate : ''}`} />
          </div>
        </div>
      </div>
    </div>
  )
}

function CardField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[8px] text-white/55">{label}</p>
      <p className="text-[10px] font-bold truncate">{value}</p>
    </div>
  )
}

function cardHtml(warranty: Warranty, design: CardDesign) {
  const logo = design.logoUrl ? `<img src="${design.logoUrl}" style="width:22px;height:22px;border-radius:5px;object-fit:cover;background:#fff" />` : '<div style="width:22px;height:22px;border-radius:5px;background:rgba(255,255,255,.2)"></div>'
  const vehicle = `${warranty.registration.vehicleName || '-'}${warranty.registration.licensePlate ? ' - ' + warranty.registration.licensePlate : ''}`
  return `
    <div style="width:342px;height:216px;border-radius:14px;overflow:hidden;font-family:Segoe UI,Arial,sans-serif;position:relative;background:linear-gradient(135deg,${design.primaryColor},${design.secondaryColor});color:#fff;box-shadow:0 12px 40px rgba(0,0,0,.22)">
      <div style="position:absolute;top:-30px;right:-30px;width:120px;height:120px;border-radius:50%;background:rgba(255,255,255,.07)"></div>
      <div style="position:absolute;left:0;right:0;bottom:0;background:rgba(0,0,0,.25);padding:10px 14px;display:flex;justify-content:space-between;align-items:end">
        <div style="font-size:11px;font-weight:700;letter-spacing:2px">${warranty.code}</div>
        <div style="text-align:right"><div style="font-size:8px;color:rgba(255,255,255,.6)">BERLAKU</div><div style="font-size:10px;font-weight:600">${shortDate(warranty.startDate)} - ${shortDate(warranty.endDate)}</div></div>
      </div>
      <div style="position:relative;z-index:1;padding:14px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">${logo}<span style="font-size:12px;font-weight:800">${design.workshopName || 'Workshop'}</span></div>
        <div style="font-size:9px;color:rgba(255,255,255,.65);letter-spacing:.7px">KARTU GARANSI DIGITAL</div>
        <div style="font-size:17px;font-weight:900;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:4px">${warranty.customer.name}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:18px">
          <div><div style="font-size:8px;color:rgba(255,255,255,.55)">LAYANAN</div><div style="font-size:10px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${warranty.workshop.title}</div></div>
          <div><div style="font-size:8px;color:rgba(255,255,255,.55)">KENDARAAN</div><div style="font-size:10px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${vehicle}</div></div>
        </div>
      </div>
    </div>
  `
}

function xmlEscape(value: string) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function cardSvg(warranty: Warranty, design: CardDesign) {
  const vehicle = `${warranty.registration.vehicleName || '-'}${warranty.registration.licensePlate ? ' - ' + warranty.registration.licensePlate : ''}`
  const logo = design.logoUrl
    ? `<image href="${xmlEscape(design.logoUrl)}" x="14" y="13" width="22" height="22" preserveAspectRatio="xMidYMid slice" clip-path="url(#logoClip)" />`
    : '<rect x="14" y="13" width="22" height="22" rx="5" fill="rgba(255,255,255,.2)" />'

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="342" height="216" viewBox="0 0 342 216">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${xmlEscape(design.primaryColor)}"/>
      <stop offset="100%" stop-color="${xmlEscape(design.secondaryColor)}"/>
    </linearGradient>
    <clipPath id="logoClip"><rect x="14" y="13" width="22" height="22" rx="5"/></clipPath>
  </defs>
  <rect width="342" height="216" rx="14" fill="url(#bg)"/>
  <circle cx="342" cy="0" r="70" fill="rgba(255,255,255,.07)"/>
  <rect y="172" width="342" height="44" fill="rgba(0,0,0,.25)"/>
  ${logo}
  <text x="44" y="29" fill="#fff" font-family="Segoe UI, Arial, sans-serif" font-size="12" font-weight="800">${xmlEscape(design.workshopName || 'Workshop')}</text>
  <text x="14" y="60" fill="rgba(255,255,255,.65)" font-family="Segoe UI, Arial, sans-serif" font-size="9" letter-spacing=".7">KARTU GARANSI DIGITAL</text>
  <text x="14" y="84" fill="#fff" font-family="Segoe UI, Arial, sans-serif" font-size="17" font-weight="900">${xmlEscape(warranty.customer.name).slice(0, 30)}</text>
  <text x="14" y="122" fill="rgba(255,255,255,.55)" font-family="Segoe UI, Arial, sans-serif" font-size="8">LAYANAN</text>
  <text x="14" y="138" fill="#fff" font-family="Segoe UI, Arial, sans-serif" font-size="10" font-weight="700">${xmlEscape(warranty.workshop.title).slice(0, 34)}</text>
  <text x="184" y="122" fill="rgba(255,255,255,.55)" font-family="Segoe UI, Arial, sans-serif" font-size="8">KENDARAAN</text>
  <text x="184" y="138" fill="#fff" font-family="Segoe UI, Arial, sans-serif" font-size="10" font-weight="700">${xmlEscape(vehicle).slice(0, 28)}</text>
  <text x="14" y="198" fill="#fff" font-family="Segoe UI, Arial, sans-serif" font-size="11" font-weight="700" letter-spacing="2">${xmlEscape(warranty.code)}</text>
  <text x="328" y="188" fill="rgba(255,255,255,.6)" font-family="Segoe UI, Arial, sans-serif" font-size="8" text-anchor="end">BERLAKU</text>
  <text x="328" y="202" fill="#fff" font-family="Segoe UI, Arial, sans-serif" font-size="10" font-weight="600" text-anchor="end">${shortDate(warranty.startDate)} - ${shortDate(warranty.endDate)}</text>
</svg>`
}
