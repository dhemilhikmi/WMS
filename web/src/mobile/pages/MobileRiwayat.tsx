import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { registrationsAPI } from '../../services/api'
import { MobileSubHeader } from '../MobileLayout'

const PAY_LABEL: Record<string, string> = { LUNAS: 'Lunas', PENDING: 'Belum Lunas', OVERDUE: 'Telat' }
const PAY_COLOR: Record<string, string> = { LUNAS: '#16a34a', PENDING: '#f59e0b', OVERDUE: '#dc2626' }

export default function MobileRiwayat() {
  const { tenant } = useAuth()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const fetch = useCallback(async () => {
    if (!tenant?.id) return
    setLoading(true)
    try {
      const res = await registrationsAPI.list(tenant.id)
      const regs: any[] = res.data.data || []
      const completed = regs
        .filter(r => r.status === 'completed')
        .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
      setItems(completed)
    } finally { setLoading(false) }
  }, [tenant?.id])

  useEffect(() => { fetch() }, [fetch])

  const filtered = items.filter(r => {
    if (!search) return true
    const q = search.toLowerCase()
    return (r.customer?.name || '').toLowerCase().includes(q) ||
           (r.licensePlate || '').toLowerCase().includes(q) ||
           (r.workshop?.title || '').toLowerCase().includes(q)
  })

  return (
    <>
      <MobileSubHeader title="Riwayat Layanan" subtitle={`${items.length} layanan selesai`} />
      <div className="px-4 pt-3 space-y-3 pb-4">
        <div className="relative">
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Cari pelanggan, plat, layanan..."
            className="w-full bg-white border border-wm-line rounded-2xl pl-10 pr-3 py-2.5 text-[13px] outline-none focus:border-[#1E4FD8]"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#aaa] text-[14px]">🔍</span>
        </div>

        {loading && <p className="text-center text-[12px] text-ink-4 py-6">Memuat...</p>}
        {!loading && filtered.length === 0 && (
          <div className="bg-white rounded-2xl border border-wm-line p-8 text-center">
            <p className="text-[36px] mb-2">📋</p>
            <p className="text-[13px] text-[#666]">Belum ada riwayat</p>
          </div>
        )}

        <div className="space-y-2.5">
          {filtered.map(r => (
            <div key={r.id} className="bg-white rounded-2xl border border-wm-line p-3.5">
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-[14px] font-bold truncate">{r.customer?.name || '—'}</p>
                <span className="text-[9px] font-bold px-2 py-1 rounded-full flex-shrink-0"
                  style={{ background: (PAY_COLOR[r.paymentStatus] || '#94a3b8') + '22', color: PAY_COLOR[r.paymentStatus] || '#94a3b8' }}>
                  {PAY_LABEL[r.paymentStatus] || 'Belum Lunas'}
                </span>
              </div>
              <p className="text-[12px] text-ink-3 truncate">🚗 {r.licensePlate || '—'} · {r.vehicleName || '—'}</p>
              <p className="text-[12px] text-ink-3 truncate">🔧 {r.workshop?.title || '—'}</p>
              <div className="flex items-center justify-between mt-1.5">
                <p className="text-[11px] text-ink-4">
                  ✓ {new Date(r.updatedAt || r.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
                <p className="text-[12px] font-bold text-[#16a34a]">
                  Rp {Number(r.workshop?.price || 0).toLocaleString('id-ID')}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
