import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { setViewMode } from './hooks/useIsMobile'

const TABS = [
  { to: '/m/dashboard',  label: 'Beranda',   icon: '🏠' },
  { to: '/m/booking',    label: 'Booking',   icon: '📅' },
  { to: '/m/layanan',    label: 'Layanan',   icon: '🔧' },
  { to: '/m/inventaris', label: 'Stok',      icon: '📦' },
  { to: '/m/lainnya',    label: 'Lainnya',   icon: '⋯' },
]

export default function MobileLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, tenant, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  const isTabRoute = TABS.some(t => t.to === location.pathname)

  useEffect(() => {
    if (!menuOpen) return
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [menuOpen])

  return (
    <div className="min-h-screen bg-wm-bg text-ink flex flex-col overflow-x-hidden" style={{ WebkitTapHighlightColor: 'transparent' }}>
      {/* Top bar — only on tab routes (sub-pages have their own back header) */}
      {isTabRoute && (
        <header className="sticky top-0 z-30 bg-white border-b border-wm-line">
          <div className="flex items-center justify-between px-4 h-14">
            <div className="flex items-center gap-2.5 min-w-0">
              <img src="/workshopmu-logo.svg" alt="WorkshopMU" className="h-7 w-7 flex-shrink-0" />
              <div className="min-w-0">
                <p className="wm-wordmark text-[13px] leading-tight truncate">
                  Workshop<span className="mu">MU</span>
                </p>
                {tenant?.name && <p className="text-[13px] font-semibold text-ink-2 leading-tight truncate">{tenant.name}</p>}
              </div>
            </div>

            <div ref={menuRef} className="relative">
              <button
                onClick={() => setMenuOpen(o => !o)}
                className="flex items-center gap-1.5 rounded-full bg-brand-50 px-2 py-1.5 active:bg-brand-100"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-brand font-ui">
                  {(user?.name || 'A').charAt(0).toUpperCase()}
                </span>
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-2 min-w-[200px] rounded-wm-lg border border-wm-line bg-white shadow-wm-md py-1 z-50">
                  <div className="px-3 py-2 border-b border-wm-line">
                    <p className="text-[13px] font-semibold text-ink truncate">{user?.name || 'Admin'}</p>
                    <p className="text-[10px] text-ink-4">{user?.role || 'member'}</p>
                  </div>
                  <button
                    onClick={() => { setMenuOpen(false); setViewMode('desktop'); window.location.href = '/admin/dashboard' }}
                    className="w-full text-left px-3 py-2.5 text-[13px] text-ink-3 active:bg-brand-50"
                  >
                    🖥 Tampilan Desktop
                  </button>
                  <button
                    onClick={() => { setMenuOpen(false); logout(); navigate('/login') }}
                    className="w-full text-left px-3 py-2.5 text-[13px] text-wm-danger active:bg-red-50"
                  >
                    Keluar
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
      )}

      {/* Content — pad bottom for tab bar */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden pb-[72px]">
        <Outlet />
      </main>

      {/* Bottom nav */}
      <nav
        className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-wm-line"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)' }}
      >
        <div className="grid grid-cols-5 h-[60px]">
          {TABS.map(tab => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium font-ui transition ${
                  isActive ? 'text-brand' : 'text-ink-4 active:bg-brand-50'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`text-[20px] leading-none ${isActive ? 'drop-shadow-[0_0_6px_rgba(30,79,216,0.3)]' : ''}`}>{tab.icon}</span>
                  <span>{tab.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}

// Reusable sub-page header (back button + title) for non-tab routes
export function MobileSubHeader({ title, subtitle, onBack }: { title: string; subtitle?: string; onBack?: () => void }) {
  const navigate = useNavigate()
  return (
    <header className="sticky top-0 z-30 bg-white border-b border-wm-line">
      <div className="flex items-center gap-3 px-3 h-14">
        <button
          onClick={() => onBack ? onBack() : navigate(-1)}
          className="h-10 w-10 flex items-center justify-center rounded-full active:bg-brand-50 text-ink-3"
          aria-label="Kembali"
        >
          <span className="text-[22px]">‹</span>
        </button>
        <div className="min-w-0">
          <p className="text-[15px] font-bold leading-tight truncate text-ink">{title}</p>
          {subtitle && <p className="text-[10px] text-ink-4 truncate">{subtitle}</p>}
        </div>
      </div>
    </header>
  )
}
