import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { tenantSettingsAPI, purchaseOrdersAPI, serviceMaterialsAPI, suppliersAPI, workshopsAPI } from '../services/api'

interface SetupState {
  step1_supplier: boolean  // sudah tambah min 1 pemasok
  step2_po: boolean        // sudah buat PO
  step3_receive: boolean   // sudah receive PO (ada batch)
  step4_service: boolean   // sudah tambah min 1 paket/layanan
  step5_bom: boolean       // sudah setup BOM min 1 layanan
  dismissed: boolean
}

const SETUP_KEY = 'hpp_setup_checklist'

const defaultState: SetupState = {
  step1_supplier: false,
  step2_po: false,
  step3_receive: false,
  step4_service: false,
  step5_bom: false,
  dismissed: false,
}

const steps = [
  {
    key: 'step1_supplier' as keyof SetupState,
    no: 1,
    title: 'Tambah Pemasok',
    desc: 'Buka daftar Pemasok dan tambahkan supplier bahan yang Anda gunakan. Pemasok diperlukan saat membuat PO.',
    action: 'Buka Pemasok',
    path: '/admin/purchases/suppliers',
    tip: 'Contoh: PT Autofilm Indo — isi nama, kontak, dan kategori agar mudah dicari saat buat PO.',
  },
  {
    key: 'step2_po' as keyof SetupState,
    no: 2,
    title: 'Buat Pesanan Pembelian (PO)',
    desc: 'Buat PO dengan nama pemasok yang jelas. Pilih material dari dropdown agar item terhubung ke inventaris (warna hijau).',
    action: 'Buka Pesanan Pembelian',
    path: '/admin/purchases/orders',
    tip: 'Nama pemasok wajib diisi. Item harus dipilih dari daftar agar batch FIFO terhubung.',
  },
  {
    key: 'step3_receive' as keyof SetupState,
    no: 3,
    title: 'Terima PO — Masukkan Stok',
    desc: 'Setelah barang datang, buka PO dan klik "Terima". Sistem akan otomatis buat batch FIFO dengan harga beli aktual.',
    action: 'Buka Pesanan Pembelian',
    path: '/admin/purchases/orders',
    tip: 'Setiap kali receive PO dari supplier berbeda atau harga berbeda, sistem catat sebagai batch terpisah.',
  },
  {
    key: 'step4_service' as keyof SetupState,
    no: 4,
    title: 'Buat Daftar Paket/Layanan',
    desc: 'Tambahkan paket layanan yang ditawarkan bengkel beserta sub-layanan dan harganya.',
    action: 'Buka Daftar Layanan',
    path: '/admin/services',
    tip: 'Contoh: Paket Coating → sub: Full Body, Hood, Bumper. Harga per sub-layanan.',
  },
  {
    key: 'step5_bom' as keyof SetupState,
    no: 5,
    title: 'Setup BOM (Bill of Materials)',
    desc: 'Buka Setup HPP dan tentukan material + jumlah yang dipakai tiap layanan. HPP akan dihitung otomatis saat servis selesai.',
    action: 'Buka Setup HPP',
    path: '/admin/services/bom',
    tip: 'BOM adalah resep per layanan. Tanpa BOM, HPP tidak terhitung saat servis selesai.',
  },
]

export default function AdminSetupPage() {
  const { tenant } = useAuth()
  const navigate = useNavigate()
  const [state, setState] = useState<SetupState>(defaultState)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const checkProgress = useCallback(async () => {
    if (!tenant?.id) return
    try {
      const [settingRes, supplierRes, poRes, workshopRes, bomRes] = await Promise.all([
        tenantSettingsAPI.get(SETUP_KEY).catch(() => ({ data: { data: null } })),
        suppliersAPI.list(),
        purchaseOrdersAPI.list(),
        workshopsAPI.list(tenant!.id),
        serviceMaterialsAPI.list(),
      ])

      const saved: Partial<SetupState> = settingRes.data.data || {}

      const supplierItems: any[] = supplierRes.data.data || []
      const poItems: any[] = poRes.data.data || []
      const workshopItems: any[] = workshopRes.data.data || []
      const bomItems: any[] = bomRes.data.data || []

      const next: SetupState = {
        step1_supplier: supplierItems.length > 0,
        step2_po: poItems.length > 0,
        step3_receive: poItems.some((p: any) => p.status === 'received'),
        step4_service: workshopItems.length > 0,
        step5_bom: bomItems.length > 0,
        dismissed: saved.dismissed ?? false,
      }
      setState(next)

      // auto-save progress
      await tenantSettingsAPI.set(SETUP_KEY, next)
    } catch (err) {
      console.error('Setup check failed:', err)
    } finally {
      setLoading(false)
    }
  }, [tenant?.id])

  useEffect(() => { checkProgress() }, [checkProgress])

  const handleDismiss = async () => {
    setSaving(true)
    try {
      const next = { ...state, dismissed: true }
      await tenantSettingsAPI.set(SETUP_KEY, next)
      setState(next)
      navigate('/admin/dashboard')
    } finally {
      setSaving(false)
    }
  }

  const completedCount = [state.step1_supplier, state.step2_po, state.step3_receive, state.step4_service, state.step5_bom].filter(Boolean).length
  const allDone = completedCount === 5

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <p className="text-sm text-[#aaa]">Memeriksa progres setup...</p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <p className="text-xs text-[#888] font-semibold uppercase tracking-wide mb-1">Panduan</p>
        <h1 className="text-2xl font-black text-[#111]">Panduan Memulai</h1>
        <p className="text-sm text-[#666] mt-1">
          Ikuti 4 langkah ini agar HPP dihitung otomatis dengan metode FIFO berdasarkan harga beli aktual.
        </p>
      </div>

      {/* Progress bar */}
      <div className="rounded-xl border border-[#e2e8f0] bg-white p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-[#111]">Progres Setup</p>
          <p className="text-sm font-bold text-[#1E4FD8]">{completedCount}/5 selesai</p>
        </div>
        <div className="w-full bg-[#f1f5f9] rounded-full h-2.5">
          <div
            className="h-2.5 rounded-full transition-all duration-500"
            style={{
              width: `${(completedCount / 5) * 100}%`,
              background: allDone ? '#16a34a' : '#1E4FD8',
            }}
          />
        </div>
        {allDone && (
          <p className="text-[12px] text-[#16a34a] font-semibold mt-2">
            ✓ Semua langkah selesai! Sistem HPP FIFO siap digunakan.
          </p>
        )}
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {steps.map((step, idx) => {
          const done = state[step.key] as boolean
          const prev = idx === 0 ? true : (state[steps[idx - 1].key] as boolean)
          const isNext = !done && prev

          return (
            <div
              key={step.key}
              className={`rounded-xl border p-4 transition-all ${
                done
                  ? 'border-[#bbf7d0] bg-[#f0fdf4]'
                  : isNext
                  ? 'border-[#D9E3FC] bg-[#EEF3FE] shadow-sm'
                  : 'border-[#e2e8f0] bg-white opacity-60'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Status icon */}
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  done ? 'bg-[#16a34a] text-white' : isNext ? 'bg-[#1E4FD8] text-white' : 'bg-[#e2e8f0] text-[#94a3b8]'
                }`}>
                  {done ? '✓' : step.no}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className={`text-sm font-bold ${done ? 'text-[#15803d]' : 'text-[#111]'}`}>
                      {step.title}
                    </p>
                    {done && <span className="text-[11px] font-semibold text-[#16a34a] bg-[#dcfce7] px-2 py-0.5 rounded-full">Selesai</span>}
                    {isNext && <span className="text-[11px] font-semibold text-[#1E4FD8] bg-[#dbeafe] px-2 py-0.5 rounded-full">Langkah berikutnya</span>}
                  </div>
                  <p className="text-[12px] text-[#555] mt-1">{step.desc}</p>
                  <div className="mt-2 flex items-start gap-2">
                    <span className="text-[10px] text-[#94a3b8] mt-0.5 flex-shrink-0">💡</span>
                    <p className="text-[11px] text-[#94a3b8] italic">{step.tip}</p>
                  </div>
                  {!done && (
                    <button
                      onClick={() => navigate(step.path)}
                      className={`mt-3 text-[12px] font-semibold px-4 py-1.5 rounded-lg transition ${
                        isNext
                          ? 'bg-[#1E4FD8] text-white hover:bg-[#1A45BF]'
                          : 'border border-[#cbd5e1] text-[#555] hover:bg-[#f8fafc]'
                      }`}
                    >
                      {step.action} →
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={checkProgress}
          disabled={loading}
          className="text-sm text-[#1E4FD8] hover:underline disabled:opacity-40"
        >
          🔄 Refresh status
        </button>
        <div className="flex gap-2">
          {allDone ? (
            <button
              onClick={handleDismiss}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-[#16a34a] text-white text-sm font-semibold hover:bg-[#15803d] transition disabled:opacity-40"
            >
              Selesai — Kembali ke Dashboard
            </button>
          ) : (
            <button
              onClick={handleDismiss}
              disabled={saving}
              className="px-4 py-2 rounded-lg border border-[#e2e8f0] text-sm text-[#888] hover:bg-[#f8fafc] transition disabled:opacity-40"
            >
              Lewati untuk sekarang
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
