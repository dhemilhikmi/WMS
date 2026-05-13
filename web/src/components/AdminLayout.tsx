import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AdminSidebar from './AdminSidebar'

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  '/dashboard': {
    title: 'Dashboard',
    subtitle: 'Ringkasan aktivitas harian dan status layanan.',
  },
  '/admin/dashboard': {
    title: 'Dashboard Operasional',
    subtitle: 'Pantau booking, progres layanan, dan ritme bengkel.',
  },
  '/admin/design-mock': {
    title: 'Design Direction',
    subtitle: 'Arah visual baru untuk admin workspace.',
  },
  '/admin/services': {
    title: 'Daftar Paket/Layanan',
    subtitle: 'Kelola kategori, paket, harga, dan struktur layanan.',
  },
  '/admin/sales/registration': {
    title: 'Booking',
    subtitle: 'Kelola booking pelanggan dan jadwal layanan.',
  },
  '/admin/customers': {
    title: 'Pelanggan',
    subtitle: 'Data pelanggan, riwayat servis, dan kontak.',
  },
  '/admin/teknisi': {
    title: 'Teknisi',
    subtitle: 'Kelola data teknisi dan spesialisasi.',
  },
  '/admin/layanan/berjalan': {
    title: 'Layanan Berjalan',
    subtitle: 'Pantau layanan yang sedang aktif dan teknisi yang menangani.',
  },
  '/admin/layanan/riwayat': {
    title: 'Riwayat Layanan',
    subtitle: 'Histori layanan yang telah selesai beserta detail teknisi.',
  },
  '/admin/garansi': {
    title: 'Manajemen Garansi',
    subtitle: 'Kelola garansi pelanggan dan buat kartu garansi digital.',
  },
  '/admin/settings/workshop': {
    title: 'Pengaturan Workshop',
    subtitle: 'Atur nama workshop dan jam kerja harian.',
  },
  '/admin/settings/license': {
    title: 'License',
    subtitle: 'Lihat paket aktif dan masa berlaku tenant.',
  },
  '/admin/sales/summary': {
    title: 'Ringkasan Penjualan',
    subtitle: 'Analisis omset, top layanan, dan performa teknisi.',
  },
  '/admin/dokumen/invoice':         { title: 'Invoice',              subtitle: 'Buat dan cetak invoice layanan.' },
  '/admin/dokumen/po':              { title: 'Surat Pembelian',      subtitle: 'Buat Purchase Order ke pemasok.' },
  '/admin/dokumen/lap-penjualan':   { title: 'Laporan Penjualan',    subtitle: 'Laporan transaksi dan penjualan.' },
  '/admin/dokumen/lap-pendapatan':  { title: 'Laporan Pendapatan',   subtitle: 'Laporan pendapatan kotor dan bersih.' },
  '/admin/dokumen/lap-pengeluaran': { title: 'Laporan Pengeluaran',  subtitle: 'Laporan pengeluaran vs anggaran.' },
  '/admin/dokumen/lap-labarugi':    { title: 'Laporan Laba Rugi',    subtitle: 'Profit & Loss statement.' },
  '/admin/users': {
    title: 'Tim',
    subtitle: 'Atur akses user dan peran internal workshop.',
  },
  '/admin/finance/income': {
    title: 'Laporan Pendapatan',
    subtitle: 'Analisis pendapatan bruto, neto, dan tren per bulan.',
  },
  '/admin/finance/expense': {
    title: 'Laporan Pengeluaran',
    subtitle: 'Pantau pengeluaran operasional bengkel.',
  },
  '/admin/finance/cashflow': {
    title: 'Aliran Kas',
    subtitle: 'Pantau kas masuk, keluar, dan saldo kas harian.',
  },
  '/admin/finance/summary': {
    title: 'Ringkasan Keuangan',
    subtitle: 'Overview laba rugi, margin, dan rekap tahunan.',
  },
  '/superadmin/dashboard': { title: 'Dashboard Platform', subtitle: 'Pantau tenant, revenue, plan, dan status sistem.' },
  '/superadmin/workshops': { title: 'Manajemen Workshop', subtitle: 'Kelola onboarding tenant, trial, dan langganan.' },
  '/superadmin/users':     { title: 'Superadmin Users', subtitle: 'Kelola akun yang memiliki akses platform console.' },
  '/superadmin/settings':   { title: 'Pengaturan Platform', subtitle: 'Konfigurasi SMTP dan layanan email platform.' },
  '/superadmin/api-status': { title: 'API Status', subtitle: 'Monitoring real-time layanan, latency, dan endpoint.' },
  '/admin/purchases/inventory': {
    title: 'Inventaris',
    subtitle: 'Kelola stok barang, mutasi masuk dan keluar.',
  },
  '/admin/purchases/suppliers': {
    title: 'Pemasok',
    subtitle: 'Data pemasok bahan dan suku cadang bengkel.',
  },
  '/admin/purchases/orders': {
    title: 'Pesanan Pembelian',
    subtitle: 'Kelola pesanan pembelian ke pemasok.',
  },
  '/admin/analytics': {
    title: 'Analitik Bengkel',
    subtitle: 'Performa layanan, pendapatan, dan insight bisnis.',
  },
}

export default function AdminLayout() {
  const { user, tenant, logout } = useAuth()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement | null>(null)

  const pageMeta = useMemo(() => {
    return (
      pageTitles[location.pathname] || {
        title: 'Admin Workspace',
        subtitle: 'Area kerja utama untuk mengelola operasional workshop.',
      }
    )
  }, [location.pathname])

  const userInitials = useMemo(() => {
    const source = user?.name?.trim() || 'Admin'
    return source
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('')
  }, [user?.name])

  const userManagementPath = useMemo(() => {
    if (user?.role === 'superadmin') return '/superadmin/users'
    if (user?.role === 'admin' || user?.role === 'moderator') return '/admin/users'
    return '/dashboard'
  }, [user?.role])

  const planBadge = useMemo(() => {
    if (!tenant) return null

    if (tenant.partnerType === 'ppf_partner') {
      return {
        label: 'Partner',
        className: 'border-[#facc15] bg-[#fef9c3] text-[#a16207]',
      }
    }

    if (tenant.plan === 'pro') {
      if (!tenant.planExpiry) {
        return {
          label: 'Pro Annual',
          className: 'border-[#bbf7d0] bg-[#dcfce7] text-[#15803d]',
        }
      }

      const expiry = new Date(tenant.planExpiry)
      const daysLeft = Math.max(0, Math.ceil((expiry.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
      if (daysLeft > 90) {
        return {
          label: 'Pro Annual',
          className: 'border-[#bbf7d0] bg-[#dcfce7] text-[#15803d]',
        }
      }

      return {
        label: `Pro Trial - ${daysLeft} hari tersisa`,
        className: 'border-[#D9E3FC] bg-[#dbeafe] text-[#1A45BF]',
      }
    }

    return {
      label: 'Free Plan',
      className: 'border-[#e2e8f0] bg-[#f1f5f9] text-[#64748b]',
    }
  }, [tenant])

  useEffect(() => {
    if (!userMenuOpen) return
    const handlePointerDown = (event: MouseEvent) => {
      if (!userMenuRef.current) return
      if (!userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [userMenuOpen])

  return (
    <div className="flex min-h-screen bg-[#f8fafc]">
      <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex min-h-screen flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-30 h-[56px] border-b border-[#e2e8f0] bg-white">
          <div className="flex h-full items-center justify-between gap-4 px-5">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#e2e8f0] bg-white text-[#555] hover:bg-[#f8fafc] md:hidden"
                aria-label="Toggle sidebar"
              >
                <span className="text-lg">☰</span>
              </button>

              <div>
                <h1 className="text-base font-bold text-[#111]">{pageMeta.title}</h1>
                <p className="text-[11px] text-[#888]">{pageMeta.subtitle}</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              {tenant?.name && (
                <div className="hidden items-center gap-1.5 rounded-md border border-[#e2e8f0] bg-white px-2.5 py-1.5 md:flex">
                  <span className="text-xs">🏢</span>
                  <span className="text-[12px] font-semibold text-[#555]">{tenant.name}</span>
                </div>
              )}
              {planBadge && (
                <span
                  className={`hidden rounded-md border px-2.5 py-1.5 text-[11px] font-bold md:inline-flex ${planBadge.className}`}
                >
                  {planBadge.label}
                </span>
              )}
              <div ref={userMenuRef} className="relative">
                <button
                  onClick={() => setUserMenuOpen((open) => !open)}
                  className="flex items-center gap-2 rounded-md border border-[#e2e8f0] bg-white px-2 py-1.5 transition hover:bg-[#f8fafc]"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#dbeafe] text-[11px] font-bold text-[#1E4FD8]">
                    {userInitials}
                  </div>
                  <div className="hidden text-left md:block">
                    <p className="text-[12px] font-semibold text-[#111]">
                      {user?.name || 'Admin'}
                    </p>
                    <p className="text-[10px] text-[#888]">{user?.role || 'member'}</p>
                  </div>
                  <span className="text-xs text-[#aaa]">▾</span>
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 top-[calc(100%+6px)] z-40 min-w-[180px] rounded-md border border-[#e2e8f0] bg-white p-1 shadow-lg">
                    <Link
                      to={userManagementPath}
                      onClick={() => setUserMenuOpen(false)}
                      className="block rounded px-3 py-2 text-[12px] font-medium text-[#555] hover:bg-[#f8fafc]"
                    >
                      Manajemen User
                    </Link>
                    <button
                      onClick={() => {
                        setUserMenuOpen(false)
                        localStorage.setItem('wms_view_mode', 'mobile')
                        window.location.href = '/m/dashboard'
                      }}
                      className="block w-full rounded px-3 py-2 text-left text-[12px] font-medium text-[#555] hover:bg-[#f8fafc]"
                    >
                      📱 Tampilan Mobile
                    </button>
                    <button
                      onClick={() => {
                        setUserMenuOpen(false)
                        logout()
                      }}
                      className="block w-full rounded px-3 py-2 text-left text-[12px] font-medium text-[#dc2626] hover:bg-[#fef2f2]"
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>

      {sidebarOpen && (
        <button
          aria-label="Close sidebar overlay"
          className="fixed inset-0 z-20 bg-black/30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  )
}
