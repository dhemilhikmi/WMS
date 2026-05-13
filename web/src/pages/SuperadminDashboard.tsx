import { useEffect, useState } from 'react'
import { superadminAPI } from '../services/api'

interface SubscriptionPlan {
  id: string
  name: string
  description?: string
  price: number
  maxUsers: number
  maxServices: number
  isActive: boolean
}

interface Analytics {
  totalTenants: number
  activeTenants: number
  trialTenants: number
  suspendedTenants: number
  totalRevenue: number
  monthlyRevenue: number
  totalUsers: number
  totalWorkshops: number
  totalEndCustomers: number
}

interface SystemStatus {
  timestamp: string
  uptime: number
  nodeVersion: string
  environment: string
  totalLatency: number
  services: {
    api:      { status: string; latency: number }
    database: { status: string; latency: number; records: { tenants: number; users: number; workshops: number } }
    smtp:     { status: string }
    midtrans: { status: string }
    jwt:      { status: string; expiresIn: string }
  }
}

const inputCls = 'w-full rounded border border-[#cbd5e1] bg-white px-3 py-2 text-sm text-[#111] outline-none focus:border-[#1E4FD8] focus:ring-2 focus:ring-[#dbeafe] transition'
const labelCls = 'block text-[11px] font-semibold text-[#555] mb-1'

function fmt(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)
}

function planPriceLabel(plan: SubscriptionPlan): string {
  if (plan.name.toLowerCase() === 'starter') return 'Rp 0 / forever'
  if (plan.name.toLowerCase() === 'pro') return `${fmt(plan.price)} / tahun`
  return fmt(plan.price)
}

function planQuotaLabel(plan: SubscriptionPlan): string {
  if (plan.name.toLowerCase() === 'starter') return '50 transaksi/bulan'
  if (plan.name.toLowerCase() === 'pro') return 'Unlimited'
  return plan.maxServices === 999 ? 'Unlimited' : `${plan.maxServices} layanan`
}

function planTechnicianLabel(plan: SubscriptionPlan): string {
  if (plan.name.toLowerCase() === 'starter') return '2 teknisi'
  if (plan.name.toLowerCase() === 'pro') return 'Unlimited'
  return plan.maxUsers === 999 ? 'Unlimited' : `${plan.maxUsers} users`
}

function formatUptime(s: number) {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60)
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m ${s % 60}s`
}

export default function SuperadminDashboard() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreatePlan, setShowCreatePlan] = useState(false)
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null)
  const [planForm, setPlanForm] = useState({ name: '', description: '', price: 0, maxUsers: 5, maxServices: 10 })
  const [planSubmitting, setPlanSubmitting] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
    fetchSystemStatus()
    const iv = setInterval(fetchSystemStatus, 30000)
    return () => clearInterval(iv)
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [plansRes, analyticsRes] = await Promise.all([superadminAPI.getPlans(), superadminAPI.getAnalytics()])
      setPlans((plansRes.data.data || []).filter((plan: SubscriptionPlan) => plan.isActive))
      setAnalytics(analyticsRes.data.data || null)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Gagal memuat data')
    } finally { setLoading(false) }
  }

  const fetchSystemStatus = async () => {
    try {
      setStatusLoading(true)
      const res = await superadminAPI.getSystemStatus()
      setSystemStatus(res.data.data)
      setLastChecked(new Date())
    } catch { setSystemStatus(null) }
    finally { setStatusLoading(false) }
  }

  const resetPlanForm = () => {
    setEditingPlan(null)
    setPlanForm({ name: '', description: '', price: 0, maxUsers: 5, maxServices: 10 })
  }

  const handlePlanSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setPlanSubmitting(true)
    try {
      if (editingPlan) await superadminAPI.updatePlan(editingPlan.id, planForm)
      else await superadminAPI.createPlan(planForm)
      resetPlanForm()
      setShowCreatePlan(false)
      fetchData()
    } catch (err: any) { setError(err.response?.data?.message || 'Gagal menyimpan plan') }
    finally { setPlanSubmitting(false) }
  }

  const handleEditPlan = (plan: SubscriptionPlan) => {
    setEditingPlan(plan)
    setPlanForm({ name: plan.name, description: plan.description || '', price: plan.price, maxUsers: plan.maxUsers, maxServices: plan.maxServices })
    setShowCreatePlan(true)
  }

  const handleDeletePlan = async (id: string) => {
    try { await superadminAPI.deletePlan(id); setDeleteConfirm(null); fetchData() }
    catch (err: any) { setError(err.response?.data?.message || 'Gagal menghapus plan') }
  }

  if (loading) return <div className="p-6 text-sm text-[#888]">Memuat dashboard...</div>

  return (
    <div className="p-6 space-y-5">

      {/* Stat Cards */}
      {analytics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total Tenant', value: analytics.totalTenants, sub: `${analytics.activeTenants} aktif · ${analytics.trialTenants} trial`, color: '#1E4FD8' },
            { label: 'Total Users', value: analytics.totalUsers, sub: 'seluruh tenant', color: '#111' },
            { label: 'Total Workshops', value: analytics.totalWorkshops, sub: 'layanan terdaftar', color: '#7c3aed' },
            { label: 'End Customers', value: analytics.totalEndCustomers, sub: `${analytics.suspendedTenants} tenant suspended`, color: '#0891b2' },
          ].map(c => (
            <div key={c.label} className="bg-white rounded-xl border border-[#e2e8f0] p-4">
              <p className="text-[11px] text-[#888] font-medium">{c.label}</p>
              <p className="text-2xl font-bold mt-1" style={{ color: c.color }}>{c.value}</p>
              <p className="text-[11px] text-[#aaa] mt-0.5">{c.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Revenue */}
      {analytics && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl border border-[#e2e8f0] p-4">
            <p className="text-[11px] text-[#888] font-medium">Monthly Revenue</p>
            <p className="text-2xl font-bold text-[#16a34a] mt-1">{fmt(analytics.monthlyRevenue)}</p>
            <p className="text-[11px] text-[#aaa] mt-0.5">dari tenant aktif</p>
          </div>
          <div className="bg-white rounded-xl border border-[#e2e8f0] p-4">
            <p className="text-[11px] text-[#888] font-medium">Total Revenue</p>
            <p className="text-2xl font-bold text-[#1E4FD8] mt-1">{fmt(analytics.totalRevenue)}</p>
            <p className="text-[11px] text-[#aaa] mt-0.5">akumulasi semua plan</p>
          </div>
        </div>
      )}

      {error && <div className="bg-[#fee2e2] border border-[#fca5a5] text-[#b91c1c] text-sm px-4 py-3 rounded-xl">{error}</div>}

      {/* System Status */}
      <div className="bg-white rounded-xl border border-[#e2e8f0] p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[11px] text-[#888] font-medium uppercase tracking-wide">Infrastructure</p>
            <h2 className="text-base font-bold text-[#111] mt-0.5">Status Sistem</h2>
          </div>
          <div className="flex items-center gap-3">
            {lastChecked && <span className="text-[11px] text-[#aaa]">Update: {lastChecked.toLocaleTimeString('id-ID')}</span>}
            <button onClick={fetchSystemStatus} disabled={statusLoading}
              className="text-xs px-3 py-1.5 rounded-lg border border-[#e2e8f0] text-[#555] hover:bg-[#f8fafc] transition disabled:opacity-50">
              {statusLoading ? '...' : '↻ Refresh'}
            </button>
          </div>
        </div>

        {statusLoading && !systemStatus ? (
          <p className="text-sm text-[#aaa] py-2">Memeriksa layanan...</p>
        ) : systemStatus ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
              {[
                { label: 'API Server',   status: systemStatus.services.api.status,      detail: `${systemStatus.services.api.latency}ms`,       sub: `Node ${systemStatus.nodeVersion}`, icon: '⚡' },
                { label: 'Database',     status: systemStatus.services.database.status,  detail: `${systemStatus.services.database.latency}ms`,  sub: `${systemStatus.services.database.records.tenants} tenants`, icon: '🗄️' },
                { label: 'SMTP Email',   status: systemStatus.services.smtp.status,      detail: systemStatus.services.smtp.status === 'configured' ? 'Aktif' : 'Belum diset', sub: 'Kirim email', icon: '✉️' },
                { label: 'Midtrans',     status: systemStatus.services.midtrans.status,  detail: systemStatus.services.midtrans.status === 'configured' ? 'Production' : 'Sandbox', sub: 'Payment', icon: '💳' },
                { label: 'JWT Auth',     status: systemStatus.services.jwt.status,       detail: systemStatus.services.jwt.status === 'secure' ? 'Aman' : 'Lemah', sub: `Expire: ${systemStatus.services.jwt.expiresIn}`, icon: '🔐' },
              ].map(s => {
                const ok   = s.status === 'ok' || s.status === 'configured' || s.status === 'secure'
                const warn = s.status === 'sandbox' || s.status === 'weak'
                return (
                  <div key={s.label} className={`rounded-xl border p-3.5 ${ok ? 'bg-[#f0fdf4] border-[#bbf7d0]' : warn ? 'bg-[#fffbeb] border-[#fde68a]' : 'bg-[#fef2f2] border-[#fecaca]'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-base">{s.icon}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ok ? 'bg-[#dcfce7] text-[#15803d]' : warn ? 'bg-[#fef3c7] text-[#b45309]' : 'bg-[#fee2e2] text-[#b91c1c]'}`}>
                        {ok ? 'OK' : warn ? 'WARN' : 'ERR'}
                      </span>
                    </div>
                    <p className="text-[11px] font-bold text-[#555]">{s.label}</p>
                    <p className={`text-sm font-bold mt-0.5 ${ok ? 'text-[#15803d]' : warn ? 'text-[#b45309]' : 'text-[#b91c1c]'}`}>{s.detail}</p>
                    <p className="text-[10px] text-[#aaa] mt-0.5">{s.sub}</p>
                  </div>
                )
              })}
            </div>
            <div className="flex flex-wrap gap-4 border-t border-[#f1f5f9] pt-3 text-xs text-[#888]">
              <span>Uptime: <strong className="text-[#555]">{formatUptime(systemStatus.uptime)}</strong></span>
              <span>Env: <strong className="text-[#555]">{systemStatus.environment}</strong></span>
              <span>Response: <strong className="text-[#555]">{systemStatus.totalLatency}ms</strong></span>
              <span>DB — Tenants: <strong className="text-[#555]">{systemStatus.services.database.records.tenants}</strong> · Users: <strong className="text-[#555]">{systemStatus.services.database.records.users}</strong> · Workshops: <strong className="text-[#555]">{systemStatus.services.database.records.workshops}</strong></span>
            </div>
          </>
        ) : (
          <div className="bg-[#fef2f2] border border-[#fecaca] text-[#b91c1c] text-sm px-4 py-3 rounded-lg">
            ⚠ Tidak dapat mengambil status sistem dari API.
          </div>
        )}
      </div>

      {/* Subscription Plans */}
      <div className="bg-white rounded-xl border border-[#e2e8f0] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#e2e8f0]">
          <div>
            <p className="text-[11px] text-[#888] font-medium uppercase tracking-wide">Plan Management</p>
            <h2 className="text-base font-bold text-[#111] mt-0.5">Paket Langganan</h2>
          </div>
          <button onClick={() => { setShowCreatePlan(!showCreatePlan); if (showCreatePlan) resetPlanForm() }}
            className="flex items-center gap-1.5 bg-[#1E4FD8] hover:bg-[#1A45BF] text-white text-sm font-semibold px-4 py-2 rounded-lg transition">
            {showCreatePlan ? '✕ Tutup' : '+ Plan Baru'}
          </button>
        </div>

        {showCreatePlan && (
          <div className="px-5 py-4 border-b border-[#e2e8f0] bg-[#f8fafc]">
            <h3 className="text-sm font-bold text-[#111] mb-4">{editingPlan ? 'Edit Plan' : 'Buat Plan Baru'}</h3>
            <form onSubmit={handlePlanSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Nama Plan *</label>
                  <input type="text" className={inputCls} placeholder="Pro" required
                    value={planForm.name} onChange={e => setPlanForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Harga Paket (Rp) *</label>
                  <input type="number" min={0} className={inputCls} required
                    value={planForm.price} onChange={e => setPlanForm(f => ({ ...f, price: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className={labelCls}>Teknisi / Users *</label>
                  <input type="number" min={1} className={inputCls} required
                    value={planForm.maxUsers} onChange={e => setPlanForm(f => ({ ...f, maxUsers: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className={labelCls}>Kuota Transaksi / Layanan *</label>
                  <input type="number" min={1} className={inputCls} required
                    value={planForm.maxServices} onChange={e => setPlanForm(f => ({ ...f, maxServices: Number(e.target.value) }))} />
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Deskripsi</label>
                  <input type="text" className={inputCls} placeholder="Untuk bengkel menengah..."
                    value={planForm.description} onChange={e => setPlanForm(f => ({ ...f, description: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={planSubmitting}
                  className="text-sm px-4 py-2 rounded-lg bg-[#1E4FD8] text-white hover:bg-[#1A45BF] font-semibold transition disabled:opacity-40">
                  {planSubmitting ? 'Menyimpan...' : editingPlan ? 'Simpan Perubahan' : 'Buat Plan'}
                </button>
                <button type="button" onClick={() => { setShowCreatePlan(false); resetPlanForm() }}
                  className="text-sm px-4 py-2 rounded-lg bg-[#f1f5f9] text-[#555] hover:bg-[#e2e8f0] transition">
                  Batal
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#f8fafc] text-[#555] text-[11px] font-semibold uppercase tracking-wide border-b border-[#e2e8f0]">
                <th className="px-4 py-3 text-left">Nama</th>
                <th className="px-4 py-3 text-left">Deskripsi</th>
                <th className="px-4 py-3 text-right">Harga</th>
                <th className="px-4 py-3 text-center">Teknisi</th>
                <th className="px-4 py-3 text-center">Kuota</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {plans.length === 0 && (
                <tr><td colSpan={7} className="text-center py-10 text-[#aaa]">Belum ada plan. Buat plan pertama.</td></tr>
              )}
              {plans.map(plan => (
                <tr key={plan.id} className="border-b border-[#f1f5f9] hover:bg-[#f8fafc] transition">
                  <td className="px-4 py-3 font-semibold text-[#111]">{plan.name}</td>
                  <td className="px-4 py-3 text-[#555]">{plan.description || '—'}</td>
                  <td className="px-4 py-3 text-right font-semibold text-[#1E4FD8]">{planPriceLabel(plan)}</td>
                  <td className="px-4 py-3 text-center text-[#555]">{planTechnicianLabel(plan)}</td>
                  <td className="px-4 py-3 text-center text-[#555]">{planQuotaLabel(plan)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${plan.isActive ? 'bg-[#dcfce7] text-[#15803d]' : 'bg-[#f1f5f9] text-[#888]'}`}>
                      {plan.isActive ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => handleEditPlan(plan)}
                        className="text-xs px-2.5 py-1 rounded border border-[#1E4FD8] text-[#1E4FD8] hover:bg-[#EEF3FE] transition">Edit</button>
                      <button onClick={() => setDeleteConfirm(`plan-${plan.id}`)}
                        className="text-xs px-2.5 py-1 rounded border border-[#fca5a5] text-[#dc2626] hover:bg-[#fef2f2] transition">Hapus</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirm */}
      {deleteConfirm?.startsWith('plan-') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-bold text-[#111]">Hapus Plan?</h3>
            <p className="text-sm text-[#666]">Plan yang dihapus tidak bisa dikembalikan.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="text-sm px-4 py-2 rounded-lg bg-[#f1f5f9] text-[#555]">Batal</button>
              <button onClick={() => handleDeletePlan(deleteConfirm.replace('plan-', ''))}
                className="text-sm px-4 py-2 rounded-lg bg-[#dc2626] text-white font-semibold">Hapus</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

