const stats = [
  { label: 'Total Tenant', value: '11', sub: '↑ 2 bulan ini', accent: false },
  { label: 'MAR (Recurring)', value: 'Rp 8.8JT', sub: '↑ 12% vs bulan lalu', accent: true },
  { label: 'Total Booking', value: '1,240', sub: 'bulan ini, semua tenant', accent: false },
  { label: 'Uptime', value: '99.9%', sub: '30 hari terakhir', accent: false },
]

const tenants = [
  { name: 'SpeedGarage', domain: 'speedgarage.wrks.id', plan: 'Pro', booking: '312', status: 'AKTIF' },
  { name: 'AutoPro Center', domain: 'autopro.wrks.id', plan: 'Business', booking: '245', status: 'AKTIF' },
  { name: 'Karya Motor', domain: 'karyamotor.wrks.id', plan: 'Starter', booking: '89', status: 'AKTIF' },
  { name: 'DetailKing', domain: 'detailking.wrks.id', plan: 'Pro', booking: '178', status: 'AKTIF' },
  { name: 'Motor Mas', domain: 'motormas.wrks.id', plan: 'Starter', booking: '54', status: 'TRIAL' },
  { name: 'PremiumAuto', domain: 'premiumauto.wrks.id', plan: 'Business', booking: '—', status: 'SUSPENDED' },
]

const whiteLabelConfig = [
  { key: 'Logo', value: '[Upload logo]' },
  { key: 'Primary Color', value: '#E85D04' },
  { key: 'App Name', value: 'SpeedGarage' },
  { key: 'Domain', value: 'speedgarage.wrks.id' },
]

function planColor(plan: string) {
  if (plan === 'Business') return { bg: '#ede9fe', fg: '#8b5cf6' }
  if (plan === 'Pro') return { bg: '#dbeafe', fg: '#1E4FD8' }
  return { bg: '#f1f5f9', fg: '#555' }
}

function statusColor(status: string) {
  if (status === 'AKTIF') return { bg: '#dcfce7', fg: '#16a34a' }
  if (status === 'TRIAL') return { bg: '#fef3c7', fg: '#f59e0b' }
  return { bg: '#fee2e2', fg: '#dc2626' }
}

export default function SuperadminTenantsPage() {
  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-xl font-bold text-[#111]">Manajemen Tenant</h1>
          <p className="text-[12px] text-[#888] mt-1">8 tenant aktif · 2 trial · 1 suspended</p>
        </div>
        <div className="flex gap-2">
          <button className="px-3 py-1.5 rounded border border-[#e2e8f0] bg-white text-[12px] text-[#555] hover:bg-[#f8fafc]">
            Export
          </button>
          <button className="px-3 py-1.5 rounded bg-[#1E4FD8] text-white text-[12px] font-semibold hover:bg-[#1A45BF]">
            + Tambah Tenant
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-[#e2e8f0] bg-white p-5">
            <p className="text-xs text-[#999]">{s.label}</p>
            <p className={`mt-2 text-3xl font-bold ${s.accent ? 'text-[#1E4FD8]' : 'text-[#111]'}`}>
              {s.value}
            </p>
            <p className="mt-1 text-xs text-[#16a34a]">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Tenant table */}
      <div className="rounded-lg border border-[#e2e8f0] bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-[#f1f5f9]">
          <p className="text-sm font-bold text-[#111]">Daftar Tenant</p>
        </div>

        <div className="grid grid-cols-[1.3fr_1.5fr_0.8fr_0.8fr_0.9fr_1.2fr] px-4 py-2.5 bg-[#f8fafc] border-b border-[#f1f5f9]">
          <p className="text-[11px] font-bold text-[#888]">Nama Bengkel</p>
          <p className="text-[11px] font-bold text-[#888]">Domain</p>
          <p className="text-[11px] font-bold text-[#888]">Paket</p>
          <p className="text-[11px] font-bold text-[#888]">Booking/Bln</p>
          <p className="text-[11px] font-bold text-[#888]">Status</p>
          <p className="text-[11px] font-bold text-[#888]">Aksi</p>
        </div>

        {tenants.map((t) => {
          const pc = planColor(t.plan)
          const sc = statusColor(t.status)
          return (
            <div
              key={t.domain}
              className="grid grid-cols-[1.3fr_1.5fr_0.8fr_0.8fr_0.9fr_1.2fr] px-4 py-3 border-b border-[#f1f5f9] last:border-b-0 hover:bg-[#fafbfc] items-center"
            >
              <p className="text-[12px] font-bold text-[#111]">{t.name}</p>
              <p className="text-[12px] text-[#1E4FD8]">{t.domain}</p>
              <p>
                <span
                  className="inline-block px-2 py-0.5 rounded text-[10px] font-bold"
                  style={{ background: pc.bg, color: pc.fg }}
                >
                  {t.plan}
                </span>
              </p>
              <p className="text-[12px] text-[#444]">{t.booking}</p>
              <p>
                <span
                  className="inline-block px-2 py-0.5 rounded text-[10px] font-bold"
                  style={{ background: sc.bg, color: sc.fg }}
                >
                  {t.status}
                </span>
              </p>
              <div className="flex gap-1">
                <button className="px-2 py-1 rounded border border-[#e2e8f0] text-[10px] text-[#666] hover:bg-[#f8fafc]">
                  Login As
                </button>
                <button className="px-2 py-1 rounded border border-[#e2e8f0] text-[10px] text-[#666] hover:bg-[#f8fafc]">
                  Konfigurasi
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* White-label hint */}
      <div className="rounded-lg border border-[#dbeafe] bg-[#EEF3FE] p-5 flex gap-5 flex-col md:flex-row">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <p className="text-sm font-bold text-[#1E4FD8]">🎨 White-label per Tenant</p>
            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-[#dbeafe] text-[#1E4FD8]">
              FITUR
            </span>
          </div>
          <p className="text-[12px] text-[#666]">
            Setiap tenant bisa custom: logo, nama app, warna brand, domain sendiri, email template, dan SMS branding.
          </p>
        </div>
        <div className="rounded border border-[#dbeafe] bg-white p-3 min-w-[240px]">
          {whiteLabelConfig.map((c) => (
            <div key={c.key} className="flex justify-between mb-1.5 last:mb-0">
              <p className="text-[11px] text-[#555]">{c.key}</p>
              <p className="text-[11px] text-[#60a5fa] font-medium">{c.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
