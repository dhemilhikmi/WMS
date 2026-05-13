import { useEffect, useState } from 'react'
import { superadminAPI } from '../services/api'

interface Tenant {
  id: string
  name: string
  email: string
  phone?: string
  address?: string
  isActive: boolean
  plan: 'free' | 'pro' | string
  planExpiry?: string | null
  partnerType?: 'standard' | 'ppf_partner' | string | null
  subscription: {
    status: string
    endDate?: string
    plan?: { name: string; price: number }
  } | null
  _count: { users: number; workshops: number }
}

interface SubscriptionPlan {
  id: string
  name: string
  description?: string
  price: number
  maxUsers: number
  maxServices: number
  isActive: boolean
}

const inputCls = 'w-full rounded border border-[#cbd5e1] bg-white px-3 py-2 text-sm text-[#111] outline-none focus:border-[#1E4FD8] focus:ring-2 focus:ring-[#dbeafe] transition'
const labelCls = 'block text-[11px] font-semibold text-[#555] mb-1'

const initialForm = { name: '', email: '', phone: '', address: '', planId: '', trialDays: 30 }

const SUB_COLOR: Record<string, string> = {
  active:    'bg-[#dcfce7] text-[#15803d]',
  trial:     'bg-[#dbeafe] text-[#1A45BF]',
  suspended: 'bg-[#fee2e2] text-[#b91c1c]',
}

const PLAN_COLOR: Record<string, string> = {
  free: 'bg-[#f1f5f9] text-[#64748b]',
  pro: 'bg-[#dbeafe] text-[#1A45BF]',
  partner: 'bg-[#fef9c3] text-[#a16207]',
}

function fmt(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)
}

function addDays(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString()
}

function planLabel(tenant: Tenant) {
  if (tenant.partnerType === 'ppf_partner') return 'PPF Partner'
  if (tenant.plan === 'pro') {
    if (!tenant.planExpiry) return 'Pro'
    const daysLeft = Math.ceil((new Date(tenant.planExpiry).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
    return daysLeft > 90 ? 'Pro Annual' : 'Pro Trial'
  }
  return 'Free'
}

function planColor(tenant: Tenant) {
  if (tenant.partnerType === 'ppf_partner') return PLAN_COLOR.partner
  return PLAN_COLOR[tenant.plan] || PLAN_COLOR.free
}

export default function SuperadminWorkshopsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('semua')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState(initialForm)
  const [submitting, setSubmitting] = useState(false)
  const [editingTrial, setEditingTrial] = useState<string | null>(null)
  const [trialDays, setTrialDays] = useState(30)
  const [assignModal, setAssignModal] = useState<{ tenantId: string; name: string } | null>(null)
  const [assignPlanId, setAssignPlanId] = useState('')

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [tRes, pRes] = await Promise.all([superadminAPI.getTenants(), superadminAPI.getPlans()])
      setTenants(tRes.data.data || [])
      setPlans(pRes.data.data || [])
    } catch (err: any) {
      setError(err.response?.data?.message || 'Gagal memuat data')
    } finally { setLoading(false) }
  }

  const filtered = tenants.filter(t => {
    const q = search.toLowerCase()
    const matchQ = !q || t.name.toLowerCase().includes(q) || t.email.toLowerCase().includes(q)
    const matchS = filterStatus === 'semua' || t.subscription?.status === filterStatus
    return matchQ && matchS
  })

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await superadminAPI.createTenant({ name: form.name, email: form.email, phone: form.phone, address: form.address, ...(form.planId && { planId: form.planId }) })
      const newTenant = res.data.data
      if (!form.planId && form.trialDays > 0) {
        const end = new Date(); end.setDate(end.getDate() + form.trialDays)
        await superadminAPI.updateSubscription(newTenant.id, { endDate: end.toISOString() })
      }
      setForm(initialForm); setShowCreate(false); fetchData()
    } catch (err: any) { setError(err.response?.data?.message || 'Gagal membuat workshop') }
    finally { setSubmitting(false) }
  }

  const handleExtendTrial = async () => {
    if (!editingTrial) return
    try {
      const end = new Date(); end.setDate(end.getDate() + trialDays)
      await superadminAPI.updateSubscription(editingTrial, { endDate: end.toISOString() })
      setEditingTrial(null); setTrialDays(30); fetchData()
    } catch (err: any) { setError(err.response?.data?.message || 'Gagal perpanjang trial') }
  }

  const handleAssignPlan = async () => {
    if (!assignModal || !assignPlanId) return
    try {
      await superadminAPI.assignSubscription({ tenantId: assignModal.tenantId, planId: assignPlanId, status: 'active' })
      setAssignModal(null); setAssignPlanId(''); fetchData()
    } catch (err: any) { setError(err.response?.data?.message || 'Gagal assign plan') }
  }

  const handlePlanAction = async (
    tenantId: string,
    data: { plan: 'free' | 'pro'; planExpiry: string | null; partnerType: 'standard' | 'ppf_partner' | null }
  ) => {
    try {
      await superadminAPI.updateTenantPlan(tenantId, data)
      fetchData()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Gagal update plan tenant')
    }
  }

  const countByStatus = (s: string) => tenants.filter(t => t.subscription?.status === s).length

  return (
    <div className="p-6 space-y-5">

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Tenant', value: tenants.length, sub: 'terdaftar', color: '#111' },
          { label: 'Aktif', value: countByStatus('active'), sub: 'berlangganan', color: '#16a34a' },
          { label: 'Trial', value: countByStatus('trial'), sub: 'masa percobaan', color: '#1A45BF' },
          { label: 'Suspended', value: countByStatus('suspended'), sub: 'ditangguhkan', color: '#dc2626' },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-xl border border-[#e2e8f0] p-4">
            <p className="text-[11px] text-[#888] font-medium">{c.label}</p>
            <p className="text-2xl font-bold mt-1" style={{ color: c.color }}>{c.value}</p>
            <p className="text-[11px] text-[#aaa] mt-0.5">{c.sub}</p>
          </div>
        ))}
      </div>

      {error && <div className="bg-[#fee2e2] border border-[#fca5a5] text-[#b91c1c] text-sm px-4 py-3 rounded-xl">{error}</div>}

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2">
          <input className="rounded border border-[#cbd5e1] px-3 py-1.5 text-sm outline-none focus:border-[#1E4FD8] w-52"
            placeholder="Cari nama / email..." value={search} onChange={e => setSearch(e.target.value)} />
          <select className="rounded border border-[#cbd5e1] px-3 py-1.5 text-sm outline-none focus:border-[#1E4FD8]"
            value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="semua">Semua Status</option>
            <option value="active">Aktif</option>
            <option value="trial">Trial</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
        <button onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1.5 bg-[#1E4FD8] hover:bg-[#1A45BF] text-white text-sm font-semibold px-4 py-2 rounded-lg transition">
          {showCreate ? '✕ Tutup' : '+ Workshop Baru'}
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="bg-[#f8fafc] rounded-xl border border-[#e2e8f0] p-5">
          <h3 className="text-sm font-bold text-[#111] mb-4">Tambah Workshop / Tenant Baru</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Nama Workshop *</label>
                <input type="text" className={inputCls} placeholder="Bengkel Jaya" required
                  value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Email *</label>
                <input type="email" className={inputCls} placeholder="admin@bengkel.com" required
                  value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Nomor HP</label>
                <input type="text" className={inputCls} placeholder="0812345678"
                  value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Paket Langganan</label>
                <select className={inputCls} value={form.planId} onChange={e => setForm(f => ({ ...f, planId: e.target.value }))}>
                  <option value="">Tanpa Plan (Trial)</option>
                  {plans.map(p => <option key={p.id} value={p.id}>{p.name} — {fmt(p.price)}/bln</option>)}
                </select>
              </div>
              {!form.planId && (
                <div>
                  <label className={labelCls}>Durasi Trial (hari)</label>
                  <input type="number" min={1} className={inputCls}
                    value={form.trialDays} onChange={e => setForm(f => ({ ...f, trialDays: Number(e.target.value) }))} />
                </div>
              )}
              <div className={form.planId ? 'col-span-2' : ''}>
                <label className={labelCls}>Alamat</label>
                <input type="text" className={inputCls} placeholder="Jl. Merdeka No. 1"
                  value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={submitting}
                className="text-sm px-4 py-2 rounded-lg bg-[#1E4FD8] text-white hover:bg-[#1A45BF] font-semibold transition disabled:opacity-40">
                {submitting ? 'Menyimpan...' : 'Buat Workshop'}
              </button>
              <button type="button" onClick={() => { setShowCreate(false); setForm(initialForm) }}
                className="text-sm px-4 py-2 rounded-lg bg-[#f1f5f9] text-[#555] hover:bg-[#e2e8f0] transition">Batal</button>
            </div>
          </form>
        </div>
      )}

      {/* Tenant Table */}
      <div className="bg-white rounded-xl border border-[#e2e8f0] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#f8fafc] text-[#555] text-[11px] font-semibold uppercase tracking-wide border-b border-[#e2e8f0]">
                <th className="px-4 py-3 text-left">Workshop</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-center">Plan</th>
                <th className="px-4 py-3 text-center">Users / WS</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-left">Expiry</th>
                <th className="px-4 py-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} className="text-center py-10 text-[#aaa]">Memuat data...</td></tr>}
              {!loading && filtered.length === 0 && <tr><td colSpan={7} className="text-center py-10 text-[#aaa]">Tidak ada workshop ditemukan.</td></tr>}
              {filtered.map(t => (
                <tr key={t.id} className="border-b border-[#f1f5f9] hover:bg-[#f8fafc] transition">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-[#111]">{t.name}</p>
                    {t.phone && <p className="text-[11px] text-[#888]">{t.phone}</p>}
                  </td>
                  <td className="px-4 py-3 text-[#555]">{t.email}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${planColor(t)}`}>
                      {planLabel(t)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-[#555]">{t._count.users} / {t._count.workshops}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${SUB_COLOR[t.subscription?.status || ''] || 'bg-[#f1f5f9] text-[#888]'}`}>
                      {t.subscription?.status || 'N/A'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#555] text-xs">
                    {t.planExpiry ? new Date(t.planExpiry).toLocaleDateString('id-ID') : 'Lifetime / -'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center justify-center gap-1">
                      <button
                        onClick={() => handlePlanAction(t.id, { plan: 'free', planExpiry: null, partnerType: null })}
                        className="text-xs px-2.5 py-1 rounded border border-[#cbd5e1] text-[#555] hover:bg-[#f1f5f9] transition">
                        Free
                      </button>
                      <button
                        onClick={() => handlePlanAction(t.id, { plan: 'pro', planExpiry: addDays(60), partnerType: null })}
                        className="text-xs px-2.5 py-1 rounded border border-[#1E4FD8] text-[#1E4FD8] hover:bg-[#EEF3FE] transition">
                        Pro 60d
                      </button>
                      <button
                        onClick={() => handlePlanAction(t.id, { plan: 'pro', planExpiry: addDays(365), partnerType: null })}
                        className="text-xs px-2.5 py-1 rounded border border-[#16a34a] text-[#15803d] hover:bg-[#f0fdf4] transition">
                        Pro 1y
                      </button>
                      <button
                        onClick={() => handlePlanAction(t.id, { plan: 'pro', planExpiry: null, partnerType: 'ppf_partner' })}
                        className="text-xs px-2.5 py-1 rounded border border-[#facc15] text-[#a16207] hover:bg-[#fefce8] transition">
                        Partner
                      </button>
                      <button onClick={() => { setAssignModal({ tenantId: t.id, name: t.name }); setAssignPlanId('') }}
                        className="text-xs px-2.5 py-1 rounded border border-[#94a3b8] text-[#475569] hover:bg-[#f8fafc] transition">
                        Legacy
                      </button>
                      {t.subscription?.status === 'trial' && (
                        <button onClick={() => { setEditingTrial(t.id); setTrialDays(30) }}
                          className="text-xs px-2.5 py-1 rounded border border-[#cbd5e1] text-[#555] hover:bg-[#f1f5f9] transition">
                          +Trial
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assign Plan Modal */}
      {assignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-bold text-[#111]">Assign Plan — {assignModal.name}</h3>
            <div>
              <label className={labelCls}>Paket Langganan</label>
              <select className={inputCls} value={assignPlanId} onChange={e => setAssignPlanId(e.target.value)}>
                <option value="">Pilih plan...</option>
                {plans.map(p => <option key={p.id} value={p.id}>{p.name} — {fmt(p.price)}/bln</option>)}
              </select>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setAssignModal(null)} className="text-sm px-4 py-2 rounded-lg bg-[#f1f5f9] text-[#555]">Batal</button>
              <button onClick={handleAssignPlan} disabled={!assignPlanId}
                className="text-sm px-4 py-2 rounded-lg bg-[#1E4FD8] text-white font-semibold disabled:opacity-40">Simpan</button>
            </div>
          </div>
        </div>
      )}

      {/* Extend Trial Modal */}
      {editingTrial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-bold text-[#111]">Perpanjang Trial</h3>
            <div>
              <label className={labelCls}>Tambah (hari)</label>
              <input type="number" min={1} className={inputCls} value={trialDays} onChange={e => setTrialDays(Number(e.target.value))} />
              <p className="text-[11px] text-[#888] mt-1">
                Berakhir: {new Date(new Date().setDate(new Date().getDate() + trialDays)).toLocaleDateString('id-ID')}
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setEditingTrial(null); setTrialDays(30) }} className="text-sm px-4 py-2 rounded-lg bg-[#f1f5f9] text-[#555]">Batal</button>
              <button onClick={handleExtendTrial} className="text-sm px-4 py-2 rounded-lg bg-[#1E4FD8] text-white font-semibold">Perpanjang</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

