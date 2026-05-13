import { useEffect, useState, useCallback } from 'react'
import { superadminAPI } from '../services/api'

interface ServiceStatus {
  status: string
  latency?: number
  records?: { tenants: number; users: number; workshops: number }
  expiresIn?: string
}

interface SystemStatus {
  timestamp: string
  uptime: number
  nodeVersion: string
  environment: string
  totalLatency: number
  services: {
    api:      ServiceStatus
    database: ServiceStatus
    smtp:     ServiceStatus
    midtrans: ServiceStatus
    jwt:      ServiceStatus
  }
}

interface HistoryEntry {
  timestamp: Date
  latency: number
  dbLatency: number
  ok: boolean
}

const MAX_HISTORY = 20

function formatUptime(s: number) {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60)
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m ${s % 60}s`
}

function statusMeta(_svc: string, status: string) {
  const ok   = status === 'ok' || status === 'configured' || status === 'secure'
  const warn = status === 'sandbox' || status === 'weak' || status === 'not_configured'
  const err  = !ok && !warn
  const label = ok ? 'Operational' : warn ? 'Warning' : 'Down'
  const dot   = ok ? 'bg-[#22c55e]' : warn ? 'bg-[#f59e0b]' : 'bg-[#ef4444]'
  const badge = ok ? 'bg-[#dcfce7] text-[#15803d]' : warn ? 'bg-[#fef3c7] text-[#b45309]' : 'bg-[#fee2e2] text-[#b91c1c]'
  const card  = ok ? 'border-[#bbf7d0] bg-[#f0fdf4]' : warn ? 'border-[#fde68a] bg-[#fffbeb]' : 'border-[#fecaca] bg-[#fef2f2]'
  return { ok, warn, err, label, dot, badge, card }
}

const SERVICE_META: Record<string, { label: string; icon: string; desc: string }> = {
  api:      { label: 'API Server',    icon: '⚡', desc: 'Express.js backend' },
  database: { label: 'Database',      icon: '🗄️', desc: 'PostgreSQL via Prisma' },
  smtp:     { label: 'SMTP Email',    icon: '✉️', desc: 'Nodemailer email service' },
  midtrans: { label: 'Midtrans',      icon: '💳', desc: 'Payment gateway' },
  jwt:      { label: 'JWT Auth',      icon: '🔐', desc: 'Token authentication' },
}

// s = connected, p = partial (some pages still mock), x = not connected, srv = server-side only
type EpStatus = 's' | 'p' | 'x' | 'srv'
interface Endpoint { method: string; path: string; status: EpStatus; note: string }
interface ApiGroup  { group: string; endpoints: Endpoint[] }

const API_LIST: ApiGroup[] = [
  { group: 'Auth', endpoints: [
    { method: 'POST',   path: '/api/auth/register',             status: 's',   note: 'RegisterPage' },
    { method: 'POST',   path: '/api/auth/login',                status: 's',   note: 'LoginPage' },
    { method: 'GET',    path: '/api/auth/verify-email',         status: 's',   note: 'VerifyEmailPage' },
    { method: 'POST',   path: '/api/auth/resend-verification',  status: 's',   note: 'LoginPage / EmailSentPage' },
  ]},
  { group: 'Registrations', endpoints: [
    { method: 'GET',    path: '/api/registrations',             status: 'p',   note: 'BookingPage ✓ — Dashboard & Sales masih mock' },
    { method: 'GET',    path: '/api/registrations/:id',         status: 's',   note: 'CustomerRegistrationPage' },
    { method: 'POST',   path: '/api/registrations',             status: 's',   note: 'CustomerRegistrationPage' },
    { method: 'PUT',    path: '/api/registrations/:id',         status: 'p',   note: 'BookingPage ✓ — check-in di Dashboard belum' },
    { method: 'DELETE', path: '/api/registrations/:id',         status: 's',   note: 'CustomerRegistrationPage' },
  ]},
  { group: 'Workshops', endpoints: [
    { method: 'GET',    path: '/api/workshops',                 status: 's',   note: 'AdminServicesPage, CustomerRegistrationPage' },
    { method: 'GET',    path: '/api/workshops/:id',             status: 's',   note: 'AdminServicesPage' },
    { method: 'POST',   path: '/api/workshops',                 status: 's',   note: 'AdminServicesPage' },
    { method: 'PUT',    path: '/api/workshops/:id',             status: 's',   note: 'AdminServicesPage' },
    { method: 'DELETE', path: '/api/workshops/:id',             status: 's',   note: 'AdminServicesPage' },
    { method: 'POST',   path: '/api/workshops/:id/sub-services',status: 's',   note: 'AdminServicesPage' },
    { method: 'GET',    path: '/api/workshops/:id/sub-services',status: 's',   note: 'AdminServicesPage' },
  ]},
  { group: 'Customers', endpoints: [
    { method: 'GET',    path: '/api/customers',                 status: 'p',   note: 'CustomerRegistrationPage ✓ — CRMCustomerPage masih mock' },
    { method: 'GET',    path: '/api/customers/phone/:phone',    status: 's',   note: 'CustomerRegistrationPage' },
    { method: 'POST',   path: '/api/customers',                 status: 's',   note: 'CustomerRegistrationPage' },
    { method: 'PUT',    path: '/api/customers/:id',             status: 'x',   note: 'CRMCustomerPage belum terhubung (masih mock)' },
  ]},
  { group: 'Users', endpoints: [
    { method: 'GET',    path: '/api/users',                     status: 's',   note: 'UserManagementPage, SuperadminUsersPage' },
    { method: 'POST',   path: '/api/users',                     status: 's',   note: 'UserManagementPage' },
    { method: 'PUT',    path: '/api/users/:id',                 status: 's',   note: 'UserManagementPage' },
    { method: 'DELETE', path: '/api/users/:id',                 status: 's',   note: 'UserManagementPage' },
  ]},
  { group: 'Superadmin', endpoints: [
    { method: 'GET',    path: '/api/superadmin/tenants',                  status: 's',   note: 'SuperadminWorkshopsPage' },
    { method: 'POST',   path: '/api/superadmin/tenants',                  status: 's',   note: 'SuperadminWorkshopsPage' },
    { method: 'PUT',    path: '/api/superadmin/tenants/:id',              status: 's',   note: 'SuperadminWorkshopsPage' },
    { method: 'DELETE', path: '/api/superadmin/tenants/:id',              status: 's',   note: 'SuperadminWorkshopsPage' },
    { method: 'GET',    path: '/api/superadmin/plans',                    status: 's',   note: 'SuperadminDashboard' },
    { method: 'POST',   path: '/api/superadmin/plans',                    status: 's',   note: 'SuperadminDashboard' },
    { method: 'PUT',    path: '/api/superadmin/plans/:id',                status: 's',   note: 'SuperadminDashboard' },
    { method: 'DELETE', path: '/api/superadmin/plans/:id',                status: 's',   note: 'SuperadminDashboard' },
    { method: 'POST',   path: '/api/superadmin/subscriptions',            status: 's',   note: 'SuperadminWorkshopsPage' },
    { method: 'PUT',    path: '/api/superadmin/subscriptions/:tenantId',  status: 's',   note: 'SuperadminWorkshopsPage' },
    { method: 'GET',    path: '/api/superadmin/analytics',                status: 's',   note: 'SuperadminDashboard' },
    { method: 'GET',    path: '/api/superadmin/system-status',            status: 's',   note: 'SuperadminApiStatusPage' },
  ]},
  { group: 'Settings', endpoints: [
    { method: 'GET',    path: '/api/settings',                  status: 's',   note: 'SuperadminSettingsPage' },
    { method: 'PUT',    path: '/api/settings',                  status: 's',   note: 'SuperadminSettingsPage' },
    { method: 'POST',   path: '/api/settings/test-email',       status: 's',   note: 'SuperadminSettingsPage' },
  ]},
  { group: 'Features', endpoints: [
    { method: 'GET',    path: '/api/features',                  status: 's',   note: 'AuthContext' },
    { method: 'GET',    path: '/api/tenant-features',           status: 's',   note: 'AuthContext' },
    { method: 'POST',   path: '/api/tenant-features',           status: 'x',   note: 'Belum ada UI untuk aktivasi fitur' },
    { method: 'DELETE', path: '/api/tenant-features/:featureId',status: 'x',   note: 'Belum ada UI untuk nonaktifkan fitur' },
  ]},
  { group: 'Orders', endpoints: [
    { method: 'POST',   path: '/api/orders/create',             status: 's',   note: 'RegisterPage (payment flow)' },
    { method: 'POST',   path: '/api/orders/webhook',            status: 'srv', note: 'Midtrans webhook — server-side only' },
  ]},
]

const EP_STATUS_META: Record<EpStatus, { label: string; cls: string }> = {
  s:   { label: 'Terhubung',    cls: 'bg-[#dcfce7] text-[#15803d]' },
  p:   { label: 'Parsial',      cls: 'bg-[#fef3c7] text-[#b45309]' },
  x:   { label: 'Belum',        cls: 'bg-[#fee2e2] text-[#b91c1c]' },
  srv: { label: 'Server-side',  cls: 'bg-[#f1f5f9] text-[#64748b]' },
}

export default function SuperadminApiStatusPage() {
  const [status, setStatus]         = useState<SystemStatus | null>(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(false)
  const [history, setHistory]       = useState<HistoryEntry[]>([])
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)
  const [countdown, setCountdown]   = useState(30)

  const fetchStatus = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await superadminAPI.getSystemStatus()
      const data: SystemStatus = res.data.data
      setStatus(data)
      setLastChecked(new Date())
      setCountdown(30)
      setHistory(prev => {
        const entry: HistoryEntry = {
          timestamp: new Date(),
          latency: data.totalLatency,
          dbLatency: data.services.database.latency ?? 0,
          ok: data.services.api.status === 'ok' && data.services.database.status === 'ok',
        }
        return [entry, ...prev].slice(0, MAX_HISTORY)
      })
    } catch {
      setError(true)
      setHistory(prev => [{ timestamp: new Date(), latency: 0, dbLatency: 0, ok: false }, ...prev].slice(0, MAX_HISTORY))
    } finally { setLoading(false) }
  }, [])

  // Initial fetch
  useEffect(() => { fetchStatus() }, [fetchStatus])

  // Auto-refresh countdown
  useEffect(() => {
    if (!autoRefresh) return
    const iv = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { fetchStatus(); return 30 }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(iv)
  }, [autoRefresh, fetchStatus])

  const overallOk   = status && !error && status.services.api.status === 'ok' && status.services.database.status === 'ok'
  const uptimePct   = history.length ? Math.round((history.filter(h => h.ok).length / history.length) * 100) : 100
  const avgLatency  = history.length ? Math.round(history.filter(h => h.ok).reduce((s, h) => s + h.latency, 0) / Math.max(history.filter(h => h.ok).length, 1)) : 0
  const maxBarH     = Math.max(...history.map(h => h.latency), 1)

  return (
    <div className="p-6 space-y-5">

      {/* Overall status banner */}
      <div className={`rounded-xl border px-5 py-4 flex items-center justify-between ${
        error             ? 'bg-[#fef2f2] border-[#fecaca]' :
        loading && !status? 'bg-[#f8fafc] border-[#e2e8f0]' :
        overallOk         ? 'bg-[#f0fdf4] border-[#bbf7d0]' :
                            'bg-[#fffbeb] border-[#fde68a]'
      }`}>
        <div className="flex items-center gap-3">
          <span className={`relative flex h-3 w-3`}>
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${error ? 'bg-[#ef4444]' : overallOk ? 'bg-[#22c55e]' : 'bg-[#f59e0b]'}`} />
            <span className={`relative inline-flex rounded-full h-3 w-3 ${error ? 'bg-[#ef4444]' : overallOk ? 'bg-[#22c55e]' : 'bg-[#f59e0b]'}`} />
          </span>
          <div>
            <p className={`text-sm font-bold ${error ? 'text-[#b91c1c]' : overallOk ? 'text-[#15803d]' : 'text-[#b45309]'}`}>
              {error ? 'Sistem tidak dapat dijangkau' : loading && !status ? 'Memeriksa sistem...' : overallOk ? 'Semua sistem berjalan normal' : 'Ada layanan yang perlu perhatian'}
            </p>
            {lastChecked && <p className="text-[11px] text-[#888]">Update terakhir: {lastChecked.toLocaleTimeString('id-ID')}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh(a => !a)}
            className={`text-xs px-3 py-1.5 rounded-lg border font-semibold transition ${autoRefresh ? 'bg-[#EEF3FE] border-[#D9E3FC] text-[#1E4FD8]' : 'bg-white border-[#e2e8f0] text-[#555]'}`}
          >
            {autoRefresh ? `Auto ↻ ${countdown}s` : 'Auto: Off'}
          </button>
          <button onClick={fetchStatus} disabled={loading}
            className="text-xs px-3 py-1.5 rounded-lg border border-[#e2e8f0] bg-white text-[#555] hover:bg-[#f8fafc] transition disabled:opacity-50 font-semibold">
            {loading ? '...' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Uptime (sesi)', value: status ? formatUptime(status.uptime) : '—', sub: 'sejak server start', color: '#16a34a' },
          { label: 'Response Time', value: status ? `${status.totalLatency}ms` : '—', sub: 'round-trip API', color: status && status.totalLatency < 100 ? '#16a34a' : status && status.totalLatency < 300 ? '#f59e0b' : '#dc2626' },
          { label: 'DB Latency', value: status ? `${status.services.database.latency}ms` : '—', sub: 'PostgreSQL ping', color: '#1E4FD8' },
          { label: 'Success Rate', value: `${uptimePct}%`, sub: `${history.length} pengecekan terakhir`, color: uptimePct === 100 ? '#16a34a' : uptimePct >= 80 ? '#f59e0b' : '#dc2626' },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-xl border border-[#e2e8f0] p-4">
            <p className="text-[11px] text-[#888] font-medium">{c.label}</p>
            <p className="text-xl font-bold mt-1" style={{ color: c.color }}>{c.value}</p>
            <p className="text-[11px] text-[#aaa] mt-0.5">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Service cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {Object.entries(SERVICE_META).map(([key, meta]) => {
          const svc = status?.services[key as keyof typeof status.services]
          const s = svc?.status ?? (error ? 'error' : 'unknown')
          const m = statusMeta(key, s)
          return (
            <div key={key} className={`rounded-xl border p-4 ${m.card}`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xl">{meta.icon}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${m.badge}`}>{m.label}</span>
              </div>
              <p className="text-sm font-bold text-[#111]">{meta.label}</p>
              <p className="text-[11px] text-[#888] mt-0.5">{meta.desc}</p>
              {svc?.latency !== undefined && (
                <p className="text-xs font-semibold mt-2" style={{ color: svc.latency < 50 ? '#16a34a' : svc.latency < 200 ? '#f59e0b' : '#dc2626' }}>
                  {svc.latency}ms
                </p>
              )}
              {key === 'jwt' && svc?.expiresIn && (
                <p className="text-xs text-[#888] mt-1">Expire: {svc.expiresIn}</p>
              )}
              {key === 'database' && svc?.records && (
                <p className="text-[10px] text-[#888] mt-1">
                  {svc.records.tenants}T · {svc.records.users}U · {svc.records.workshops}W
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* Latency history chart */}
      {history.length > 0 && (
        <div className="bg-white rounded-xl border border-[#e2e8f0] p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[11px] text-[#888] font-medium uppercase tracking-wide">Historis</p>
              <h2 className="text-sm font-bold text-[#111]">Response Time — {history.length} pengecekan terakhir</h2>
            </div>
            <span className="text-xs font-semibold text-[#555]">Avg: {avgLatency}ms</span>
          </div>

          {/* Bar chart — satu bar per pengecekan, warna = status */}
          <div className="flex items-end gap-1" style={{ height: 72 }}>
            {[...history].reverse().map((h, i) => {
              const pct = maxBarH > 0 ? Math.max((h.latency / maxBarH) * 100, 8) : 8
              const color = !h.ok ? '#ef4444' : h.latency < 100 ? '#22c55e' : h.latency < 300 ? '#f59e0b' : '#ef4444'
              return (
                <div
                  key={i}
                  className="flex-1 rounded-t-sm transition-all"
                  style={{ height: `${pct}%`, background: color, minHeight: 4, opacity: 0.85 }}
                  title={`${h.timestamp.toLocaleTimeString('id-ID')} — ${h.ok ? `${h.latency}ms` : 'Error'}`}
                />
              )
            })}
          </div>

          {/* X-axis labels + legend */}
          <div className="flex justify-between mt-2 mb-3">
            <p className="text-[10px] text-[#aaa]">Terlama</p>
            <p className="text-[10px] text-[#aaa]">Terbaru</p>
          </div>
          <div className="border-t border-[#f1f5f9] pt-3 space-y-2">
            <p className="text-[11px] font-semibold text-[#555] mb-1">Keterangan Warna Bar</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div className="flex items-start gap-2 bg-[#f0fdf4] border border-[#bbf7d0] rounded-lg px-3 py-2">
                <span className="w-3 h-3 rounded-sm bg-[#22c55e] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[11px] font-bold text-[#15803d]">Hijau — &lt;100ms</p>
                  <p className="text-[10px] text-[#555] mt-0.5">API merespons sangat cepat. Server dan database dalam kondisi optimal.</p>
                </div>
              </div>
              <div className="flex items-start gap-2 bg-[#fffbeb] border border-[#fde68a] rounded-lg px-3 py-2">
                <span className="w-3 h-3 rounded-sm bg-[#f59e0b] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[11px] font-bold text-[#b45309]">Kuning — 100–300ms</p>
                  <p className="text-[10px] text-[#555] mt-0.5">Respons agak lambat. Bisa karena beban tinggi atau koneksi database.</p>
                </div>
              </div>
              <div className="flex items-start gap-2 bg-[#fef2f2] border border-[#fecaca] rounded-lg px-3 py-2">
                <span className="w-3 h-3 rounded-sm bg-[#ef4444] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[11px] font-bold text-[#b91c1c]">Merah — &gt;300ms / Error</p>
                  <p className="text-[10px] text-[#555] mt-0.5">Respons sangat lambat atau gagal. Perlu pengecekan server segera.</p>
                </div>
              </div>
            </div>
            <p className="text-[10px] text-[#aaa] pt-1">Tinggi bar menunjukkan durasi relatif — bar lebih tinggi = respons lebih lambat. Arahkan kursor ke bar untuk melihat waktu dan nilai ms.</p>
          </div>
        </div>
      )}

      {/* Server info */}
      {status && (
        <div className="bg-white rounded-xl border border-[#e2e8f0] p-5">
          <p className="text-[11px] text-[#888] font-medium uppercase tracking-wide mb-3">Server Info</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Node.js',      value: status.nodeVersion },
              { label: 'Environment',  value: status.environment },
              { label: 'Uptime',       value: formatUptime(status.uptime) },
              { label: 'Last Check',   value: new Date(status.timestamp).toLocaleTimeString('id-ID') },
            ].map(r => (
              <div key={r.label} className="bg-[#f8fafc] rounded-lg px-3 py-2.5">
                <p className="text-[10px] text-[#aaa] font-semibold uppercase">{r.label}</p>
                <p className="text-sm font-bold text-[#333] mt-0.5">{r.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* API Endpoint list */}
      <div className="bg-white rounded-xl border border-[#e2e8f0] overflow-hidden">
        <div className="px-5 py-3 border-b border-[#e2e8f0]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] text-[#888] font-medium uppercase tracking-wide">Dokumentasi</p>
              <h2 className="text-sm font-bold text-[#111] mt-0.5">
                Daftar API Endpoint — {API_LIST.reduce((s, g) => s + g.endpoints.length, 0)} total
              </h2>
            </div>
            {/* Legend */}
            <div className="flex flex-wrap gap-2 text-[10px] font-semibold flex-shrink-0">
              {(Object.entries(EP_STATUS_META) as [EpStatus, { label: string; cls: string }][]).map(([, m]) => (
                <span key={m.label} className={`px-2 py-0.5 rounded-full ${m.cls}`}>{m.label}</span>
              ))}
            </div>
          </div>
          {/* Summary counts */}
          <div className="flex gap-4 mt-2 text-[11px] text-[#888]">
            {(['s','p','x','srv'] as EpStatus[]).map(k => {
              const count = API_LIST.reduce((s, g) => s + g.endpoints.filter(e => e.status === k).length, 0)
              return <span key={k}><span className={`font-bold ${k==='s'?'text-[#15803d]':k==='p'?'text-[#b45309]':k==='x'?'text-[#b91c1c]':'text-[#64748b]'}`}>{count}</span> {EP_STATUS_META[k].label.toLowerCase()}</span>
            })}
          </div>
        </div>

        <div className="divide-y divide-[#f1f5f9]">
          {API_LIST.map(group => (
            <div key={group.group} className="px-5 py-3">
              <p className="text-[11px] font-bold text-[#1E4FD8] uppercase tracking-wide mb-2">{group.group}</p>
              <div className="space-y-1.5">
                {group.endpoints.map(ep => {
                  const methodColor: Record<string, string> = {
                    GET:    'bg-[#dbeafe] text-[#1A45BF]',
                    POST:   'bg-[#dcfce7] text-[#15803d]',
                    PUT:    'bg-[#fef3c7] text-[#b45309]',
                    DELETE: 'bg-[#fee2e2] text-[#b91c1c]',
                  }
                  const sm = EP_STATUS_META[ep.status]
                  return (
                    <div key={ep.path + ep.method} className="flex items-center gap-2 group">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded font-mono w-14 text-center flex-shrink-0 ${methodColor[ep.method] || 'bg-[#f1f5f9] text-[#555]'}`}>
                        {ep.method}
                      </span>
                      <span className={`text-[10px] font-semibold px-1.5 py-px rounded flex-shrink-0 ${sm.cls}`}>
                        {sm.label}
                      </span>
                      <span className="text-xs font-mono text-[#555] flex-1 min-w-0 truncate">{ep.path}</span>
                      <span className="text-[10px] text-[#bbb] flex-shrink-0 hidden group-hover:inline max-w-[220px] truncate italic">
                        {ep.note}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
