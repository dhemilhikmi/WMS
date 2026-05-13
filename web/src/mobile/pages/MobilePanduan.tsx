import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { tenantSettingsAPI, suppliersAPI, purchaseOrdersAPI, serviceMaterialsAPI, workshopsAPI } from '../../services/api'
import { MobileSubHeader } from '../MobileLayout'

interface SetupState {
  step1_supplier: boolean
  step2_po: boolean
  step3_receive: boolean
  step4_service: boolean
  step5_bom: boolean
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
    desc: 'Tambahkan supplier bahan yang Anda gunakan. Pemasok diperlukan saat membuat PO.',
    tip: 'Contoh: PT Autofilm Indo — isi nama, kontak, dan kategori.',
    path: '/m/lainnya/pemasok',
    label: 'Buka Pemasok',
  },
  {
    key: 'step2_po' as keyof SetupState,
    no: 2,
    title: 'Buat Pesanan Pembelian (PO)',
    desc: 'Buat PO dengan pemasok yang sudah terdaftar. Pilih material dari dropdown agar terhubung ke inventaris.',
    tip: 'Item harus dipilih dari daftar agar batch FIFO terhubung.',
    path: '/m/lainnya/po',
    label: 'Buka PO',
  },
  {
    key: 'step3_receive' as keyof SetupState,
    no: 3,
    title: 'Terima PO — Masukkan Stok',
    desc: 'Setelah barang datang, buka PO dan klik "Terima". Sistem otomatis buat batch FIFO dengan harga beli aktual.',
    tip: 'Setiap receive dari supplier berbeda atau harga berbeda dicatat sebagai batch terpisah.',
    path: '/m/lainnya/po',
    label: 'Buka PO',
  },
  {
    key: 'step4_service' as keyof SetupState,
    no: 4,
    title: 'Buat Daftar Paket/Layanan',
    desc: 'Tambahkan paket layanan yang ditawarkan bengkel beserta sub-layanan dan harganya.',
    tip: 'Contoh: Paket Coating → sub: Full Body, Hood, Bumper. Harga per sub-layanan.',
    path: '/m/lainnya/services',
    label: 'Buka Daftar Layanan',
  },
  {
    key: 'step5_bom' as keyof SetupState,
    no: 5,
    title: 'Setup BOM (Bill of Materials)',
    desc: 'Tentukan material dan jumlah yang dipakai tiap layanan. HPP akan dihitung otomatis saat servis selesai.',
    tip: 'BOM adalah resep per layanan. Tanpa BOM, HPP tidak terhitung.',
    path: '/m/lainnya/services/hpp',
    label: 'Buka Setup HPP',
  },
]

export default function MobilePanduan() {
  const { tenant } = useAuth()
  const navigate = useNavigate()
  const [state, setState] = useState<SetupState>(defaultState)
  const [loading, setLoading] = useState(true)

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
      await tenantSettingsAPI.set(SETUP_KEY, next)
    } catch {}
    finally { setLoading(false) }
  }, [tenant?.id])

  useEffect(() => { checkProgress() }, [checkProgress])

  const completedCount = [state.step1_supplier, state.step2_po, state.step3_receive, state.step4_service, state.step5_bom].filter(Boolean).length
  const allDone = completedCount === 5

  return (
    <>
      <MobileSubHeader title="Panduan" subtitle="4 langkah setup HPP FIFO" />
      <div className="px-4 pt-4 pb-8 space-y-4">

        {/* Progress */}
        <div className="rounded-2xl border border-wm-line bg-white p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[13px] font-semibold text-ink">Progres Setup</p>
            <p className="text-[13px] font-bold text-brand">{completedCount}/5 selesai</p>
          </div>
          <div className="h-2 rounded-full bg-wm-bg overflow-hidden">
            <div
              className="h-full rounded-full bg-brand transition-all duration-500"
              style={{ width: `${(completedCount / 5) * 100}%` }}
            />
          </div>
          {allDone && (
            <p className="mt-2 text-[12px] font-semibold text-[#16a34a]">✓ Semua langkah selesai! HPP FIFO sudah aktif.</p>
          )}
          {!allDone && (
            <p className="mt-2 text-[11px] text-ink-4">Selesaikan semua langkah agar HPP terhitung otomatis.</p>
          )}
        </div>

        {/* Steps */}
        {loading ? (
          <p className="text-center text-[12px] text-[#aaa] py-6">Memeriksa progres...</p>
        ) : (
          steps.map((step, i) => {
            const done = state[step.key] as boolean
            const isNext = !done && steps.slice(0, i).every(s => state[s.key] as boolean)
            return (
              <div
                key={step.key}
                className={`rounded-2xl border p-4 space-y-2 transition ${
                  done
                    ? 'border-[#bbf7d0] bg-[#f0fdf4]'
                    : isNext
                    ? 'border-[#1E4FD8] bg-white shadow-sm'
                    : 'border-wm-line bg-white opacity-60'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold ${
                    done ? 'bg-[#16a34a] text-white' : isNext ? 'bg-brand text-white' : 'bg-[#e2e8f0] text-ink-4'
                  }`}>
                    {done ? '✓' : step.no}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[14px] font-bold ${done ? 'text-[#15803d]' : 'text-ink'}`}>{step.title}</p>
                    <p className="text-[12px] text-ink-3 mt-0.5 leading-relaxed">{step.desc}</p>
                    <p className="text-[11px] text-[#f59e0b] mt-1">💡 {step.tip}</p>
                  </div>
                </div>
                {!done && (
                  <button
                    onClick={() => navigate(step.path)}
                    className={`w-full rounded-xl py-2.5 text-[13px] font-bold transition ${
                      isNext
                        ? 'bg-brand text-white active:bg-[#1A45BF]'
                        : 'bg-wm-bg text-ink-3'
                    }`}
                  >
                    {step.label} →
                  </button>
                )}
              </div>
            )
          })
        )}
      </div>
    </>
  )
}
