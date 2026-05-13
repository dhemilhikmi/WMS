import { useState, useEffect } from 'react'
import { workshopsAPI, registrationsAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'

interface Reg {
  id: string
  status: string
  scheduledDate?: string
  createdAt: string
  updatedAt: string
  notes?: string
  vehicleName?: string
  customer: { id: string; name: string; phone: string }
  workshop: { id: string; title: string; duration?: number }
}

function formatDuration(minutes: number): string {
  if (minutes < 1) return '< 1 menit'
  if (minutes < 60) return `${Math.round(minutes)} menit`
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (h < 24) return m > 0 ? `${h} jam ${m} menit` : `${h} jam`
  const d = Math.floor(h / 24)
  const rh = h % 24
  return rh > 0 ? `${d} hari ${rh} jam` : `${d} hari`
}

function getSLAColor(avgMinutes: number): string {
  if (avgMinutes <= 120) return '#16a34a'   // ≤ 2 jam: hijau
  if (avgMinutes <= 480) return '#f59e0b'   // ≤ 8 jam: kuning
  return '#dc2626'                           // > 8 jam: merah
}

export default function DashboardPage() {
  const { tenant } = useAuth()
  const [workshops, setWorkshops] = useState<any[]>([])
  const [registrations, setRegistrations] = useState<Reg[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => { fetchDashboardData() }, [tenant?.id])

  const fetchDashboardData = async () => {
    if (!tenant?.id) return
    try {
      setLoading(true)
      const [wsRes, regRes] = await Promise.all([
        workshopsAPI.list(tenant.id),
        registrationsAPI.list(tenant.id),
      ])
      setWorkshops(wsRes.data.data || [])
      setRegistrations(regRes.data.data || [])
    } catch (err: any) {
      setError(err.response?.data?.message || 'Gagal memuat data dashboard')
    } finally {
      setLoading(false)
    }
  }

  // SLA calculation — hanya registrasi completed yang punya scheduledDate
  const completedRegs = registrations.filter(
    r => r.status === 'completed' && r.scheduledDate
  )
  const durations = completedRegs.map(r => {
    const start = new Date(r.scheduledDate!).getTime()
    const end = new Date(r.updatedAt).getTime()
    return (end - start) / 60000 // in minutes
  }).filter(d => d > 0 && d < 60 * 24 * 30) // abaikan data aneh (> 30 hari)

  const avgMinutes = durations.length > 0
    ? durations.reduce((a, b) => a + b, 0) / durations.length
    : 0
  const minMinutes = durations.length > 0 ? Math.min(...durations) : 0
  const maxMinutes = durations.length > 0 ? Math.max(...durations) : 0
  const slaColor = getSLAColor(avgMinutes)

  // SLA per layanan
  const slaByService: Record<string, { title: string; durations: number[] }> = {}
  completedRegs.forEach(r => {
    const dur = (new Date(r.updatedAt).getTime() - new Date(r.scheduledDate!).getTime()) / 60000
    if (dur <= 0 || dur > 60 * 24 * 30) return
    if (!slaByService[r.workshop.id]) slaByService[r.workshop.id] = { title: r.workshop.title, durations: [] }
    slaByService[r.workshop.id].durations.push(dur)
  })
  const slaRows = Object.values(slaByService).map(s => ({
    title: s.title,
    avg: s.durations.reduce((a, b) => a + b, 0) / s.durations.length,
    count: s.durations.length,
  })).sort((a, b) => a.avg - b.avg)

  const stats = {
    total: registrations.length,
    pending: registrations.filter(r => r.status === 'pending').length,
    confirmed: registrations.filter(r => r.status === 'confirmed').length,
    completed: registrations.filter(r => r.status === 'completed').length,
    cancelled: registrations.filter(r => r.status === 'cancelled').length,
  }

  const recentCompleted = [...registrations]
    .filter(r => r.status === 'completed')
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5)

  // Layanan aktif yang melebihi estimasi durasi paket
  const now = Date.now()
  const overdueActive = registrations
    .filter(r => ['in_progress', 'confirmed'].includes(r.status))
    .map(r => {
      // duration dari API (kalau server sudah restart) atau dari workshops state
      const wsData = workshops.find((w: any) => w.id === r.workshop.id)
      const duration: number | null = r.workshop.duration ?? wsData?.duration ?? null
      if (!duration) return null
      const elapsed = (now - new Date(r.createdAt).getTime()) / 60000
      const overBy = elapsed - duration
      return { ...r, elapsed, duration, overBy }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null && r.overBy > 0)
    .sort((a, b) => b.overBy - a.overBy)

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <p className="text-[13px] text-[#aaa]">Memuat dashboard...</p>
    </div>
  )

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <h1 className="font-display text-xl font-bold text-ink">Dashboard</h1>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Banner overdue */}
      {overdueActive.length > 0 && (
        <div className="rounded-xl border border-[#fecaca] bg-[#fef2f2] px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">⚠️</span>
            <p className="text-sm font-bold text-[#dc2626]">
              {overdueActive.length} Layanan Melebihi Estimasi Waktu
            </p>
          </div>
          <div className="space-y-2">
            {overdueActive.map(r => (
              <div key={r.id} className="flex items-center justify-between bg-white rounded-lg px-4 py-2.5 border border-[#fecaca]">
                <div>
                  <p className="text-[13px] font-semibold text-[#111]">
                    {r.customer.name}
                    {r.vehicleName ? <span className="text-[#888] font-normal"> · {r.vehicleName}</span> : null}
                  </p>
                  <p className="text-[11px] text-[#888]">{r.workshop.title}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[12px] font-bold text-[#dc2626]">
                    +{formatDuration(r.overBy)} terlambat
                  </p>
                  <p className="text-[10px] text-[#aaa]">
                    Estimasi {formatDuration(r.duration)} · Sudah {formatDuration(r.elapsed)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-[#e2e8f0] bg-white p-4">
          <p className="text-[11px] text-[#888] font-semibold uppercase tracking-wide">Total</p>
          <p className="text-3xl font-black text-[#111] mt-1">{stats.total}</p>
        </div>
        <div className="rounded-xl border border-[#fde68a] bg-[#fffbeb] p-4">
          <p className="text-[11px] text-[#92400e] font-semibold uppercase tracking-wide">Menunggu</p>
          <p className="text-3xl font-black text-[#f59e0b] mt-1">{stats.pending + stats.confirmed}</p>
        </div>
        <div className="rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] p-4">
          <p className="text-[11px] text-[#166534] font-semibold uppercase tracking-wide">Selesai</p>
          <p className="text-3xl font-black text-[#16a34a] mt-1">{stats.completed}</p>
        </div>
        <div className="rounded-xl border border-[#e2e8f0] bg-white p-4">
          <p className="text-[11px] text-[#888] font-semibold uppercase tracking-wide">Dibatalkan</p>
          <p className="text-3xl font-black text-[#dc2626] mt-1">{stats.cancelled}</p>
        </div>
      </div>

      {/* SLA Card */}
      <div className="rounded-xl border border-[#e2e8f0] bg-white p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">⏱</span>
          <h2 className="text-sm font-bold text-[#111]">SLA — Waktu Pengerjaan</h2>
          <span className="ml-auto text-[11px] text-[#aaa]">
            {durations.length > 0 ? `${durations.length} pekerjaan · waktu kalender` : 'Belum ada data'}
          </span>
        </div>

        {durations.length === 0 ? (
          <p className="text-center text-[13px] text-[#aaa] py-6">
            Belum ada data — tandai pekerjaan sebagai <strong>Selesai</strong> untuk mulai melacak SLA.
          </p>
        ) : (
          <>
            {/* Main metric */}
            <div className="flex items-end gap-4 mb-5">
              <div>
                <p className="text-[11px] text-[#888] mb-0.5">Rata-rata</p>
                <p className="text-4xl font-black" style={{ color: slaColor }}>
                  {formatDuration(avgMinutes)}
                </p>
              </div>
              <div className="flex gap-6 pb-1">
                <div>
                  <p className="text-[10px] text-[#aaa]">Tercepat</p>
                  <p className="text-[13px] font-bold text-[#16a34a]">{formatDuration(minMinutes)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-[#aaa]">Terlama</p>
                  <p className="text-[13px] font-bold text-[#dc2626]">{formatDuration(maxMinutes)}</p>
                </div>
              </div>
            </div>

            {/* Progress bar — posisi rata-rata vs max */}
            {maxMinutes > 0 && (
              <div className="mb-5">
                <div className="h-2 rounded-full bg-[#f1f5f9] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, (avgMinutes / maxMinutes) * 100)}%`, backgroundColor: slaColor }}
                  />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-[#aaa]">0</span>
                  <span className="text-[10px] text-[#aaa]">{formatDuration(maxMinutes)}</span>
                </div>
              </div>
            )}

            {/* Per service breakdown */}
            {slaRows.length > 0 && (
              <div className="border-t border-[#f1f5f9] pt-4 space-y-2">
                <p className="text-[11px] font-semibold text-[#888] uppercase tracking-wide mb-3">Per Layanan</p>
                {slaRows.map(row => (
                  <div key={row.title} className="flex items-center gap-3">
                    <p className="text-[12px] text-[#333] w-40 truncate flex-shrink-0">{row.title}</p>
                    <div className="flex-1 h-1.5 rounded-full bg-[#f1f5f9] overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(100, (row.avg / maxMinutes) * 100)}%`,
                          backgroundColor: getSLAColor(row.avg),
                        }}
                      />
                    </div>
                    <p className="text-[12px] font-semibold text-[#555] w-24 text-right flex-shrink-0">
                      {formatDuration(row.avg)}
                    </p>
                    <p className="text-[10px] text-[#aaa] w-12 text-right flex-shrink-0">
                      {row.count}x
                    </p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Recent completed */}
      {recentCompleted.length > 0 && (
        <div className="rounded-xl border border-[#e2e8f0] bg-white p-5">
          <h2 className="text-sm font-bold text-[#111] mb-4">Pekerjaan Selesai Terakhir</h2>
          <div className="space-y-2">
            {recentCompleted.map(r => {
              const dur = r.scheduledDate
                ? (new Date(r.updatedAt).getTime() - new Date(r.scheduledDate).getTime()) / 60000
                : null
              return (
                <div key={r.id} className="flex items-center justify-between py-2 border-b border-[#f8fafc] last:border-0">
                  <div>
                    <p className="text-[13px] font-semibold text-[#111]">{r.customer.name}</p>
                    <p className="text-[11px] text-[#aaa]">{r.workshop.title}{r.vehicleName ? ` · ${r.vehicleName}` : ''}</p>
                  </div>
                  <div className="text-right">
                    {dur && dur > 0 && dur < 60 * 24 * 30 ? (
                      <p className="text-[12px] font-bold" style={{ color: getSLAColor(dur) }}>
                        {formatDuration(dur)}
                      </p>
                    ) : (
                      <p className="text-[12px] text-[#aaa]">—</p>
                    )}
                    <p className="text-[10px] text-[#aaa]">
                      {new Date(r.updatedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
