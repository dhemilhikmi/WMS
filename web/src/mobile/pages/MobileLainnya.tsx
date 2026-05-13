import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

type IconName =
  | 'dashboard' | 'chart' | 'calendar' | 'service' | 'history' | 'shield'
  | 'users' | 'technician' | 'cart' | 'invoice' | 'package' | 'box'
  | 'supplier' | 'money' | 'expense' | 'cashflow' | 'summary' | 'settings'
  | 'clock' | 'document' | 'desktop'

interface MenuItem {
  to: string
  icon: IconName
  label: string
  desc?: string
  external?: boolean
}

interface Section {
  title: string
  icon: IconName
  items: MenuItem[]
}

const ADMIN_SECTIONS: Section[] = [
  {
    title: 'Utama',
    icon: 'dashboard',
    items: [
      { to: '/m/dashboard', icon: 'dashboard', label: 'Dashboard', desc: 'Ringkasan operasional' },
      { to: '/m/lainnya/panduan', icon: 'desktop', label: 'Panduan', desc: 'Langkah setup HPP FIFO' },
      { to: '/m/lainnya/analitik', icon: 'chart', label: 'Analitik', desc: 'KPI & performa bengkel' },
      { to: '/m/booking', icon: 'calendar', label: 'Booking', desc: 'Booking dan jadwal customer' },
    ],
  },
  {
    title: 'Layanan',
    icon: 'service',
    items: [
      { to: '/m/layanan', icon: 'service', label: 'Layanan Berjalan', desc: 'Pekerjaan aktif' },
      { to: '/m/lainnya/services', icon: 'service', label: 'Daftar Paket/Layanan', desc: 'Katalog, paket, harga' },
      { to: '/m/lainnya/services/hpp', icon: 'summary', label: 'Setup HPP', desc: 'Material, jasa, margin' },
      { to: '/m/riwayat', icon: 'history', label: 'Riwayat Layanan', desc: 'Pekerjaan selesai' },
      { to: '/m/lainnya/garansi', icon: 'shield', label: 'Garansi', desc: 'Kartu garansi pelanggan' },
    ],
  },
  {
    title: 'Pelanggan & Tim',
    icon: 'users',
    items: [
      { to: '/m/lainnya/pelanggan', icon: 'users', label: 'Pelanggan', desc: 'CRM dan histori customer' },
      { to: '/m/lainnya/teknisi', icon: 'technician', label: 'Teknisi', desc: 'Tim dan spesialisasi' },
    ],
  },
  {
    title: 'Penjualan',
    icon: 'cart',
    items: [
      { to: '/m/lainnya/penjualan-ringkasan', icon: 'summary', label: 'Ringkasan Penjualan', desc: 'Top layanan dan teknisi' },
      { to: '/m/lainnya/penjualan', icon: 'invoice', label: 'Penjualan', desc: 'Invoice dan status bayar' },
    ],
  },
  {
    title: 'Pembelian',
    icon: 'package',
    items: [
      { to: '/m/lainnya/po', icon: 'package', label: 'Pesanan Pembelian', desc: 'PO ke pemasok' },
      { to: '/m/inventaris', icon: 'box', label: 'Stok Material', desc: 'Inventaris dan mutasi stok' },
      { to: '/m/lainnya/pemasok', icon: 'supplier', label: 'Pemasok', desc: 'Supplier dan histori PO' },
    ],
  },
  {
    title: 'Keuangan',
    icon: 'money',
    items: [
      { to: '/m/lainnya/pendapatan', icon: 'money', label: 'Pendapatan', desc: 'Laporan kas masuk' },
      { to: '/m/lainnya/pengeluaran', icon: 'expense', label: 'Pengeluaran', desc: 'Biaya dan pembelian' },
      { to: '/m/lainnya/aliran-kas', icon: 'cashflow', label: 'Aliran Kas', desc: 'Cash flow harian' },
      { to: '/m/lainnya/ringkasan-keuangan', icon: 'summary', label: 'Ringkasan Keuangan', desc: 'Laba rugi bulanan' },
    ],
  },
  {
    title: 'Pengaturan',
    icon: 'settings',
    items: [
      { to: '/m/lainnya/settings', icon: 'settings', label: 'Pengaturan Workshop', desc: 'Nama, jam kerja, dan jam operasional' },
      { to: '/m/lainnya/dokumen', icon: 'document', label: 'Dokumen', desc: 'Info template dan editor desktop' },
    ],
  },
]

const SUPERADMIN_SECTIONS: Section[] = [
  {
    title: 'Superadmin',
    icon: 'dashboard',
    items: [
      { to: '/admin/dashboard', icon: 'desktop', label: 'Beralih ke Desktop', desc: 'Buka console desktop', external: true },
    ],
  },
]

export default function MobileLainnya() {
  const { user, tenant, logout } = useAuth()
  const isSuperadmin = user?.role === 'superadmin'
  const sections = isSuperadmin ? SUPERADMIN_SECTIONS : ADMIN_SECTIONS

  return (
    <div className="bg-white min-h-full">
      <div className="sticky top-0 z-10 border-b border-wm-line bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-wm-md bg-brand-50 text-brand">
            <Icon name="dashboard" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[14px] font-bold text-ink">{tenant?.name || 'Workshop'}</p>
            <p className="truncate text-[10px] text-ink-4">{user?.name || 'Admin'} · {user?.role || 'member'}</p>
          </div>
        </div>
      </div>

      <nav className="px-3 py-3 pb-5">
        {sections.map(section => (
          <SidebarSection key={section.title} section={section} />
        ))}

        {!isSuperadmin && (
          <a
            href="/admin/dashboard"
            className="mt-2 flex items-center gap-3 rounded-wm-sm px-2.5 py-2 text-[12px] font-semibold text-ink-3 active:bg-brand-50"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-wm-sm bg-wm-bg text-ink-3">
              <Icon name="desktop" />
            </span>
            Tampilan Desktop
          </a>
        )}

        <button
          onClick={logout}
          className="mt-1 flex w-full items-center gap-3 rounded-wm-sm px-2.5 py-2 text-left text-[12px] font-semibold text-wm-danger active:bg-red-50"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-wm-sm bg-red-50 text-wm-danger">
            <Icon name="settings" />
          </span>
          Keluar
        </button>
      </nav>
    </div>
  )
}

function SidebarSection({ section }: { section: Section }) {
  return (
    <div className="mb-2">
      <div className="flex items-center gap-2 px-2.5 pb-1.5 pt-2 text-[10px] font-bold uppercase tracking-wide text-ink-4">
        <Icon name={section.icon} small />
        <span>{section.title}</span>
      </div>
      <div className="space-y-0.5">
        {section.items.map(item => (
          <MenuRow key={item.to + item.label} item={item} />
        ))}
      </div>
    </div>
  )
}

function MenuRow({ item }: { item: MenuItem }) {
  const content = ({ active = false }: { active?: boolean } = {}) => (
    <div
      className={`flex items-center gap-3 rounded-wm-sm px-2.5 py-2 transition ${
        active ? 'bg-brand-50 text-brand' : 'text-ink-3 active:bg-brand-50'
      }`}
    >
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-wm-sm ${active ? 'bg-white text-brand' : 'bg-wm-bg text-ink-3'}`}>
        <Icon name={item.icon} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-[13px] ${active ? 'font-bold text-brand' : 'font-semibold text-ink'}`}>{item.label}</span>
        {item.desc && <span className="block truncate text-[10px] text-ink-4">{item.desc}</span>}
      </span>
      <span className="text-[13px] text-ink-4">{'›'}</span>
    </div>
  )

  if (item.external) return <a href={item.to}>{content()}</a>
  return (
    <NavLink to={item.to}>
      {({ isActive }) => content({ active: isActive })}
    </NavLink>
  )
}

function Icon({ name, small }: { name: IconName; small?: boolean }) {
  const size = small ? 14 : 18
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }

  const paths: Record<IconName, ReactNode> = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    chart: <><path d="M4 19V5" /><path d="M4 19h16" /><path d="m7 15 4-4 3 3 5-7" /></>,
    calendar: <><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M8 2v4M16 2v4M3 10h18" /></>,
    service: <><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4l-3 3-3-3z" /></>,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v6h6" /><path d="M12 7v5l3 2" /></>,
    shield: <><path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6z" /><path d="m9 12 2 2 4-4" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.9" /><path d="M16 3.1a4 4 0 0 1 0 7.8" /></>,
    technician: <><circle cx="12" cy="7" r="4" /><path d="M5.5 21a6.5 6.5 0 0 1 13 0" /><path d="m16 11 4 4-2 2-4-4" /></>,
    cart: <><circle cx="9" cy="20" r="1" /><circle cx="18" cy="20" r="1" /><path d="M2 3h3l3 12h10l3-8H6" /></>,
    invoice: <><path d="M6 2h12v20l-3-2-3 2-3-2-3 2z" /><path d="M9 7h6M9 11h6M9 15h4" /></>,
    package: <><path d="m21 8-9-5-9 5 9 5z" /><path d="M3 8v8l9 5 9-5V8" /><path d="M12 13v8" /></>,
    box: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M8 5v14" /></>,
    supplier: <><path d="M3 21h18" /><path d="M5 21V7l7-4 7 4v14" /><path d="M9 21v-6h6v6" /></>,
    money: <><rect x="3" y="6" width="18" height="12" rx="2" /><circle cx="12" cy="12" r="3" /><path d="M6 12h.01M18 12h.01" /></>,
    expense: <><path d="M12 3v18" /><path d="M17 8a4 4 0 0 0-4-2H9a3 3 0 0 0 0 6h6a3 3 0 0 1 0 6h-4a4 4 0 0 1-4-2" /></>,
    cashflow: <><path d="M7 7h11l-3-3" /><path d="M17 17H6l3 3" /><path d="M18 7 6 19" /></>,
    summary: <><path d="M4 19h16" /><path d="M7 16V9" /><path d="M12 16V5" /><path d="M17 16v-4" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2 3-.2-.1a1.7 1.7 0 0 0-2 .2 1.7 1.7 0 0 0-.9 1.7V22h-3.4v-.2a1.7 1.7 0 0 0-.9-1.7 1.7 1.7 0 0 0-2-.2l-.2.1-2-3 .1-.1A1.7 1.7 0 0 0 4.6 15 1.7 1.7 0 0 0 3 13.8H2v-3.6h1a1.7 1.7 0 0 0 1.6-1.2 1.7 1.7 0 0 0-.3-1.9l-.1-.1 2-3 .2.1a1.7 1.7 0 0 0 2-.2A1.7 1.7 0 0 0 9.3 2.2V2h3.4v.2a1.7 1.7 0 0 0 .9 1.7 1.7 1.7 0 0 0 2 .2l.2-.1 2 3-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1.2h1v3.6h-1a1.7 1.7 0 0 0-1.6 1.2z" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    document: <><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v5h5" /><path d="M9 13h6M9 17h6" /></>,
    desktop: <><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></>,
  }

  return <svg {...common}>{paths[name]}</svg>
}
