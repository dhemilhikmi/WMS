import { useEffect, useState } from 'react'

const MOBILE_BREAKPOINT = 768
const VIEW_MODE_KEY = 'wms_view_mode'

export type ViewMode = 'mobile' | 'desktop' | 'auto'

export function getViewMode(): ViewMode {
  const v = localStorage.getItem(VIEW_MODE_KEY)
  if (v === 'mobile' || v === 'desktop') return v
  return 'auto'
}

export function setViewMode(mode: ViewMode) {
  if (mode === 'auto') localStorage.removeItem(VIEW_MODE_KEY)
  else localStorage.setItem(VIEW_MODE_KEY, mode)
}

function detectMobileByUA(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
}

export function shouldUseMobile(): boolean {
  const mode = getViewMode()
  if (mode === 'mobile') return true
  if (mode === 'desktop') return false
  // Auto: use UA OR width
  return detectMobileByUA() || window.innerWidth < MOBILE_BREAKPOINT
}

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() => shouldUseMobile())

  useEffect(() => {
    const onResize = () => setIsMobile(shouldUseMobile())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return isMobile
}

// Map desktop path → mobile equivalent (for redirect)
export function desktopToMobilePath(pathname: string): string | null {
  const map: Record<string, string> = {
    '/admin/dashboard': '/m/dashboard',
    '/dashboard': '/m/dashboard',
    '/admin/sales/registration': '/m/booking',
    '/admin/layanan/berjalan': '/m/layanan',
    '/admin/layanan/riwayat': '/m/riwayat',
    '/admin/purchases/inventory': '/m/inventaris',
    '/admin/customers': '/m/lainnya/pelanggan',
    '/admin/teknisi': '/m/lainnya/teknisi',
    '/admin/sales': '/m/lainnya/penjualan',
    '/admin/sales/summary': '/m/lainnya/penjualan-ringkasan',
    '/admin/purchases/orders': '/m/lainnya/po',
    '/admin/purchases/suppliers': '/m/lainnya/pemasok',
    '/admin/garansi': '/m/lainnya/garansi',
    '/admin/finance/income': '/m/lainnya/pendapatan',
    '/admin/finance/expense': '/m/lainnya/pengeluaran',
    '/admin/finance/cashflow': '/m/lainnya/aliran-kas',
    '/admin/finance/summary': '/m/lainnya/ringkasan-keuangan',
    '/admin/services/bom': '/m/lainnya/services/hpp',
    '/admin/services': '/m/lainnya/services',
    '/admin/analytics': '/m/lainnya/analitik',
    '/admin/dokumen/invoice': '/m/lainnya/dokumen',
  }
  return map[pathname] || null
}

export function mobileToDesktopPath(pathname: string): string {
  const map: Record<string, string> = {
    '/m/dashboard': '/admin/dashboard',
    '/m/booking': '/admin/sales/registration',
    '/m/layanan': '/admin/layanan/berjalan',
    '/m/riwayat': '/admin/layanan/riwayat',
    '/m/inventaris': '/admin/purchases/inventory',
    '/m/lainnya': '/admin/dashboard',
    '/m/lainnya/pelanggan': '/admin/customers',
    '/m/lainnya/teknisi': '/admin/teknisi',
    '/m/lainnya/penjualan': '/admin/sales',
    '/m/lainnya/penjualan-ringkasan': '/admin/sales/summary',
    '/m/lainnya/po': '/admin/purchases/orders',
    '/m/lainnya/pemasok': '/admin/purchases/suppliers',
    '/m/lainnya/garansi': '/admin/garansi',
    '/m/lainnya/pendapatan': '/admin/finance/income',
    '/m/lainnya/pengeluaran': '/admin/finance/expense',
    '/m/lainnya/aliran-kas': '/admin/finance/cashflow',
    '/m/lainnya/ringkasan-keuangan': '/admin/finance/summary',
    '/m/lainnya/services/hpp': '/admin/services/bom',
    '/m/lainnya/services': '/admin/services',
    '/m/lainnya/analitik': '/admin/analytics',
    '/m/lainnya/dokumen': '/admin/dokumen/invoice',
  }
  return map[pathname] || '/admin/dashboard'
}
