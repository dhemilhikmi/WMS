import { useState, useEffect } from 'react'
import { tenantSettingsAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'
import ChangePasswordForm from '../components/ChangePasswordForm'

export default function WorkshopSettingsPage({ view = 'settings' }: { view?: 'settings' | 'license' }) {
  const { tenant, updateTenant } = useAuth()
  const [workshopName, setWorkshopName] = useState('')
  const [jamKerja, setJamKerja] = useState('8')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const license = getLicenseInfo(tenant)

  useEffect(() => {
    if (!tenant?.id) return
    Promise.all([
      tenantSettingsAPI.get('workshop_name').catch(() => null),
      tenantSettingsAPI.get('jam_kerja_per_hari').catch(() => null),
    ]).then(([nameRes, jamRes]) => {
      const name = nameRes?.data?.data?.value
      setWorkshopName(name || tenant.name || '')
      const jam = jamRes?.data?.data?.value
      if (jam) setJamKerja(String(jam))
      setLoading(false)
    })
  }, [tenant?.id])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    try {
      await Promise.all([
        tenantSettingsAPI.set('workshop_name', { value: workshopName }),
        tenantSettingsAPI.set('jam_kerja_per_hari', { value: Number(jamKerja) }),
      ])
      updateTenant({ name: workshopName })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      alert('Gagal menyimpan pengaturan. Coba lagi.')
    } finally { setSaving(false) }
  }

  if (loading) {
    return <div className="p-6 text-sm text-[#888]">Memuat pengaturan...</div>
  }

  return (
    <div className="p-6 max-w-xl">
      <form onSubmit={handleSave} className="space-y-5">
        {view === 'license' && (
          <>
            {/* License */}
            <div className="rounded-lg border border-[#e2e8f0] bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-[#111] mb-1">License yang Digunakan</p>
                  <p className="text-[11px] text-[#888]">
                    Informasi paket aktif untuk tenant workshop ini.
                  </p>
                </div>
                <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${license.badgeClass}`}>
                  {license.badge}
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <InfoBox label="Paket" value={license.planName} />
                <InfoBox label="Masa Aktif" value={license.expiryText} />
                <InfoBox label="Status" value={license.statusText} />
              </div>

              <div className="mt-4 rounded-lg bg-[#f8fafc] px-3 py-3 text-[12px] leading-5 text-[#555]">
                {license.description}
              </div>
            </div>

            <p className="text-[11px] text-[#888]">
              Pengaturan nama workshop dan jam kerja tersedia di menu Pengaturan Workshop.
            </p>
          </>
        )}

        {view === 'settings' && (
          <>
        {/* Nama Workshop */}
        <div className="rounded-lg border border-[#e2e8f0] bg-white p-5">
          <p className="text-sm font-bold text-[#111] mb-1">Nama Workshop</p>
          <p className="text-[11px] text-[#888] mb-4">
            Nama ini ditampilkan pada kartu garansi, invoice, dan dokumen lainnya.
          </p>
          <input
            type="text"
            value={workshopName}
            onChange={e => setWorkshopName(e.target.value)}
            required
            placeholder="mis. AutoKing Detailing"
            className="w-full rounded border border-[#cbd5e1] bg-white px-3 py-2 text-sm text-[#111] outline-none focus:border-[#1E4FD8] focus:ring-2 focus:ring-[#dbeafe]"
          />
        </div>

        {/* Jam Kerja */}
        <div className="rounded-lg border border-[#e2e8f0] bg-white p-5">
          <p className="text-sm font-bold text-[#111] mb-1">Jam Kerja per Hari</p>
          <p className="text-[11px] text-[#888] mb-4">
            Digunakan untuk kalkulasi SLA dan estimasi durasi pengerjaan. Default 8 jam.
          </p>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={1}
              max={24}
              value={jamKerja}
              onChange={e => setJamKerja(e.target.value)}
              required
              className="w-24 rounded border border-[#cbd5e1] bg-white px-3 py-2 text-sm text-[#111] outline-none focus:border-[#1E4FD8] focus:ring-2 focus:ring-[#dbeafe] text-center"
            />
            <span className="text-sm text-[#555]">jam / hari</span>
            {jamKerja && (
              <span className="text-[11px] text-[#888] bg-[#f1f5f9] px-2 py-1 rounded">
                = {Number(jamKerja) * 60} menit
              </span>
            )}
          </div>
        </div>

        {/* Save */}
        <button
          type="submit"
          disabled={saving}
          className={`w-full rounded-xl py-3 text-sm font-bold transition disabled:opacity-40 ${
            saved
              ? 'bg-[#dcfce7] text-[#16a34a] border border-[#bbf7d0]'
              : 'bg-[#1E4FD8] text-white hover:bg-[#1A45BF]'
          }`}
        >
          {saving ? 'Menyimpan...' : saved ? '✓ Pengaturan Tersimpan' : 'Simpan Pengaturan'}
        </button>
          </>
        )}
      </form>
      {view === 'settings' && (
        <div className="mt-5 rounded-lg border border-[#e2e8f0] bg-white p-5">
          <p className="text-sm font-bold text-[#111] mb-1">Keamanan Akun</p>
          <p className="text-[11px] text-[#888] mb-4">
            Ubah password akun yang sedang login. Setelah berhasil, Anda akan diminta login ulang.
          </p>
          <ChangePasswordForm />
        </div>
      )}
    </div>
  )
}

function getLicenseInfo(tenant: ReturnType<typeof useAuth>['tenant']) {
  if (tenant?.partnerType === 'ppf_partner') {
    return {
      badge: 'Partner',
      badgeClass: 'bg-[#fef3c7] text-[#b45309]',
      planName: 'PPF Partner',
      expiryText: 'Lifetime',
      statusText: 'Aktif',
      description: 'Tenant partner mendapat akses fitur Pro tanpa batas masa aktif.',
    }
  }

  if (tenant?.plan === 'pro') {
    if (!tenant.planExpiry) {
      return {
        badge: 'Pro',
        badgeClass: 'bg-[#dcfce7] text-[#15803d]',
        planName: 'Pro Annual',
        expiryText: 'Lifetime',
        statusText: 'Aktif',
        description: 'Paket Pro aktif tanpa tanggal berakhir. Semua fitur Pro tersedia.',
      }
    }

    const expiry = new Date(tenant.planExpiry)
    const daysLeft = Math.max(0, Math.ceil((expiry.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
    const annual = daysLeft > 90
    return {
      badge: annual ? 'Pro Annual' : 'Pro Trial',
      badgeClass: annual ? 'bg-[#dcfce7] text-[#15803d]' : 'bg-[#dbeafe] text-[#1A45BF]',
      planName: annual ? 'Pro Annual' : 'Pro Trial 60 Hari',
      expiryText: `${expiry.toLocaleDateString('id-ID')} (${daysLeft} hari)`,
      statusText: daysLeft > 0 ? 'Aktif' : 'Expired',
      description: annual
        ? 'Paket Pro tahunan aktif. Fitur Pro tersedia sampai masa aktif berakhir.'
        : 'Trial Pro aktif. Setelah masa trial habis, tenant otomatis turun ke paket Free.',
    }
  }

  return {
    badge: 'Free',
    badgeClass: 'bg-[#f1f5f9] text-[#64748b]',
    planName: 'Starter / Free',
    expiryText: 'Tidak ada',
    statusText: 'Aktif',
    description: 'Paket Free aktif dengan batas 50 transaksi per bulan dan 2 teknisi.',
  }
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#e2e8f0] bg-white px-3 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#888]">{label}</p>
      <p className="mt-1 text-sm font-bold text-[#111]">{value}</p>
    </div>
  )
}
