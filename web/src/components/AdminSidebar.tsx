import { Link, useLocation } from 'react-router-dom'
import { useMemo, useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { settingsAPI } from '../services/api'

interface SidebarItem {
  label: string
  path?: string
  icon?: string
  children?: SidebarItem[]
}

const ADMIN_SIDEBAR_ITEMS: SidebarItem[] = [
  { label: 'Dashboard', icon: '📊', path: '/admin/dashboard' },
  { label: 'Panduan', icon: '🧭', path: '/admin/setup' },
  { label: 'Analitik', icon: '📈', path: '/admin/analytics' },
  { label: 'Booking', icon: '📅', path: '/admin/sales/registration' },
  {
    label: 'Layanan',
    icon: '🔧',
    children: [
      { label: 'Layanan Berjalan', path: '/admin/layanan/berjalan' },
      { label: 'Daftar Paket/Layanan', path: '/admin/services' },
      { label: 'Setup HPP', path: '/admin/services/bom' },
      { label: 'Riwayat Layanan', path: '/admin/layanan/riwayat' },
      { label: '🛡 Garansi', path: '/admin/garansi' },
    ],
  },
  { label: 'Pelanggan', icon: '👥', path: '/admin/customers' },
  { label: 'Teknisi', icon: '👨‍🔧', path: '/admin/teknisi' },
  {
    label: 'Penjualan',
    icon: '🛒',
    children: [
      { label: 'Ringkasan Penjualan', path: '/admin/sales/summary' },
      { label: 'Penjualan', path: '/admin/sales' },
    ],
  },
  {
    label: 'Pembelian',
    icon: '📦',
    children: [
      { label: 'Pesanan Pembelian', path: '/admin/purchases/orders' },
      { label: 'Stok Material', path: '/admin/purchases/inventory' },
      { label: 'Pemasok', path: '/admin/purchases/suppliers' },
    ],
  },
  {
    label: 'Keuangan',
    icon: '💰',
    children: [
      { label: 'Pendapatan', path: '/admin/finance/income' },
      { label: 'Pengeluaran', path: '/admin/finance/expense' },
      { label: 'Aliran Kas', path: '/admin/finance/cashflow' },
      { label: 'Ringkasan Keuangan', path: '/admin/finance/summary' },
    ],
  },
  {
    label: 'Pengaturan',
    icon: '⚙️',
    children: [
      {
        label: 'Operasional',
        icon: '🕐',
        children: [
          { label: 'Jam Operasional', path: '/admin/settings/jam-operasional' },
          { label: 'Pengaturan Workshop', path: '/admin/settings/workshop' },
          { label: 'License', path: '/admin/settings/license' },
        ],
      },
      {
        label: 'Dokumen',
        icon: '🗂️',
        children: [
          { label: 'Invoice', path: '/admin/dokumen/invoice' },
          { label: 'Surat Pembelian', path: '/admin/dokumen/po' },
          { label: 'Laporan Penjualan', path: '/admin/dokumen/lap-penjualan' },
          { label: 'Laporan Pendapatan', path: '/admin/dokumen/lap-pendapatan' },
          { label: 'Laporan Pengeluaran', path: '/admin/dokumen/lap-pengeluaran' },
          { label: 'Laporan Laba Rugi', path: '/admin/dokumen/lap-labarugi' },
          { label: 'Kartu Garansi', path: '/admin/dokumen/kartu-garansi' },
        ],
      },
    ],
  },
]

const SUPERADMIN_SIDEBAR_ITEMS: SidebarItem[] = [
  { label: 'Dashboard', icon: '📊', path: '/superadmin/dashboard' },
  { label: 'Pengguna', icon: '👥', path: '/superadmin/users' },
  { label: 'Workshop', icon: '🏢', path: '/superadmin/workshops' },
  { label: 'API Status',    icon: '🟢', path: '/superadmin/api-status' },
  { label: 'Landing Page', icon: '🌐', path: '/superadmin/landing' },
  { label: 'Pengaturan',   icon: '⚙️', path: '/superadmin/settings' },
]

const REGULAR_SIDEBAR_ITEMS: SidebarItem[] = [
  { label: 'Dashboard', icon: '📊', path: '/dashboard' },
]

interface AdminSidebarProps {
  onClose?: () => void
  isOpen?: boolean
}

// ─── Recursive item renderer ───────────────────────────────────────────────────

function SidebarNavItem({
  item,
  depth = 0,
  location,
  expandedItems,
  toggleExpand,
  onClose,
}: {
  item: SidebarItem
  depth?: number
  location: { pathname: string }
  expandedItems: string[]
  toggleExpand: (key: string) => void
  onClose?: () => void
}) {
  const key = `${depth}:${item.label}`
  const isActive = (path?: string) => Boolean(path && location.pathname === path)
  const isParentActive = (i: SidebarItem): boolean =>
    Boolean(i.children?.some((c) => isActive(c.path) || isParentActive(c)))

  const active = isActive(item.path)
  const parentActive = isParentActive(item)
  const expanded = expandedItems.includes(key)

  const indent = depth * 12

  if (item.children) {
    return (
      <div>
        <button
          onClick={() => toggleExpand(key)}
          className={`flex w-full items-center justify-between rounded-wm-sm py-2 text-left transition ${parentActive ? 'text-brand font-semibold' : 'text-ink-3 hover:bg-brand-50 hover:text-ink'}`}
          style={{ paddingLeft: 9 + indent, paddingRight: 8 }}
        >
          <span className="flex items-center gap-2">
            {item.icon && <span className="text-sm">{item.icon}</span>}
            <span className={`font-semibold font-ui ${depth === 0 ? 'text-[13px]' : 'text-[12px]'}`}>{item.label}</span>
          </span>
          <span className="text-[10px] text-ink-4">{expanded ? '▾' : '▸'}</span>
        </button>

        {expanded && (
          <div className={depth === 0 ? 'ml-4 space-y-0.5' : 'ml-3 space-y-0.5'}>
            {item.children.map((child) => (
              <SidebarNavItem
                key={child.label}
                item={child}
                depth={depth + 1}
                location={location}
                expandedItems={expandedItems}
                toggleExpand={toggleExpand}
                onClose={onClose}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <Link
      to={item.path || '#'}
      onClick={() => onClose?.()}
      className={`flex items-center gap-2 rounded-wm-sm py-1.5 text-[12px] font-ui transition ${
        active
          ? 'bg-brand-50 font-semibold text-brand'
          : 'text-ink-3 hover:bg-brand-50 hover:text-ink'
      }`}
      style={{ paddingLeft: 9 + indent, paddingRight: 8 }}
    >
      {item.icon && <span className="text-sm">{item.icon}</span>}
      {item.label}
    </Link>
  )
}

// ─── Sidebar ───────────────────────────────────────────────────────────────────

export default function AdminSidebar({ onClose, isOpen = true }: AdminSidebarProps) {
  const location = useLocation()
  const { user, tenant } = useAuth()
  const isSuperadmin = user?.role === 'superadmin'
  const isAdmin = user?.role === 'admin' || user?.role === 'moderator'

  const sidebarItems = useMemo(() => {
    if (isSuperadmin) return SUPERADMIN_SIDEBAR_ITEMS
    if (isAdmin) return ADMIN_SIDEBAR_ITEMS
    return REGULAR_SIDEBAR_ITEMS
  }, [isAdmin, isSuperadmin])

  // Auto-expand parents that contain the active path
  const defaultExpanded = useMemo(() => {
    const keys: string[] = []
    const walk = (items: SidebarItem[], depth: number) => {
      items.forEach((item) => {
        if (item.children) {
          const hasActive = (i: SidebarItem): boolean =>
            Boolean(i.path === location.pathname || i.children?.some(hasActive))
          if (hasActive(item)) keys.push(`${depth}:${item.label}`)
          walk(item.children, depth + 1)
        }
      })
    }
    walk(sidebarItems, 0)
    return keys
  }, [location.pathname, sidebarItems])

  const [expandedItems, setExpandedItems] = useState<string[]>(defaultExpanded)
  const [appName, setAppName] = useState('')

  useEffect(() => {
    if (!isSuperadmin) {
      setAppName('')
      return
    }
    settingsAPI.get()
      .then(res => { if (res.data.data?.app_name) setAppName(res.data.data.app_name) })
      .catch(() => {})
  }, [isSuperadmin])

  const toggleExpand = (key: string) => {
    setExpandedItems((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )
  }

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex w-[240px] flex-col border-r border-wm-line bg-white transition-transform duration-200 md:sticky md:top-0 md:h-screen md:translate-x-0 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      {/* Brand */}
      <div className="border-b border-wm-line px-5 py-4">
        <div className="flex items-center gap-2.5">
          <img src="/workshopmu-logo.svg" alt="WorkshopMU" className="h-7 w-7 flex-shrink-0" />
          {appName ? (
            <span className="font-display text-[15px] font-bold tracking-tight text-ink">{appName}</span>
          ) : (
            <span className="wm-wordmark text-[15px]">
              Workshop<span className="mu">MU</span>
            </span>
          )}
        </div>
        {tenant?.name && (
          <p className="mt-2 text-[13px] font-semibold text-ink-2 truncate">{tenant.name}</p>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        {sidebarItems.map((item) => (
          <SidebarNavItem
            key={item.label}
            item={item}
            depth={0}
            location={location}
            expandedItems={expandedItems}
            toggleExpand={toggleExpand}
            onClose={onClose}
          />
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-wm-line px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-2 w-2 rounded-full bg-wm-success" />
          <p className="text-[11px] text-ink-4">Operasional aktif</p>
        </div>
      </div>
    </aside>
  )
}
