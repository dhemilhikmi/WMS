import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

interface UpgradeEventDetail {
  message?: string
  quotaExceeded?: boolean
  upgradeRequired?: boolean
}

export default function UpgradePrompt() {
  const [detail, setDetail] = useState<UpgradeEventDetail | null>(null)

  useEffect(() => {
    const handleUpgradeRequired = (event: Event) => {
      const customEvent = event as CustomEvent<UpgradeEventDetail>
      setDetail(customEvent.detail || {})
    }

    window.addEventListener('wms:upgrade-required', handleUpgradeRequired)
    return () => window.removeEventListener('wms:upgrade-required', handleUpgradeRequired)
  }, [])

  if (!detail) return null

  const message = detail.quotaExceeded
    ? 'Limit transaksi paket Free sudah tercapai bulan ini.'
    : detail.message || 'Fitur ini tersedia di paket Pro.'

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl border border-[#e2e8f0] bg-white p-5 shadow-xl">
        <h2 className="text-base font-bold text-[#111]">Upgrade ke Pro</h2>
        <p className="mt-2 text-sm leading-6 text-[#555]">
          {message} Fitur ini tersedia di paket Pro.
        </p>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={() => setDetail(null)}
            className="flex-1 rounded-lg bg-[#f1f5f9] px-4 py-2 text-sm font-semibold text-[#555] hover:bg-[#e2e8f0]"
          >
            Tutup
          </button>
          <Link
            to="/#pricing"
            onClick={() => setDetail(null)}
            className="flex-1 rounded-lg bg-[#1E4FD8] px-4 py-2 text-center text-sm font-semibold text-white hover:bg-[#1A45BF]"
          >
            Lihat Pricing
          </Link>
        </div>
      </div>
    </div>
  )
}
