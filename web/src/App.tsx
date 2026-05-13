import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import AdminLayout from './components/AdminLayout'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import EmailSentPage from './pages/EmailSentPage'
import VerifyEmailPage from './pages/VerifyEmailPage'
import UserDashboard from './pages/UserDashboard'
import AdminMainDashboard from './pages/AdminMainDashboard'
import AdminDesignMockPage from './pages/AdminDesignMockPage'
import AdminServicesPage from './pages/AdminServicesPage'
import UserManagementPage from './pages/UserManagementPage'
import CustomerRegistrationPage from './pages/CustomerRegistrationPage'
import BookingTimelinePage from './pages/BookingTimelinePage'
import CRMCustomerPage from './pages/CRMCustomerPage'
import SalesInvoicePage from './pages/SalesInvoicePage'
import SuperadminTenantsPage from './pages/SuperadminTenantsPage'
import LandingPage from './pages/LandingPage'
import TekniisiPage from './pages/TekniisiPage'
import LayananBerjalanPage from './pages/LayananBerjalanPage'
import RiwayatLayananPage from './pages/RiwayatLayananPage'
import SalesSummaryPage from './pages/SalesSummaryPage'
import DocumentsPage from './pages/DocumentsPage'
import PemasokPage from './pages/PemasokPage'
import InventarisPage from './pages/InventarisPage'
import PesananPembelianPage from './pages/PesananPembelianPage'
import LaporanPendapatanPage from './pages/LaporanPendapatanPage'
import LaporanPengeluaranPage from './pages/LaporanPengeluaranPage'
import AliranKasPage from './pages/AliranKasPage'
import RingkasanKeuanganPage from './pages/RingkasanKeuanganPage'
import AdminPlaceholder from './pages/AdminPlaceholder'
import SuperadminDashboard from './pages/SuperadminDashboard'
import SuperadminUsersPage from './pages/SuperadminUsersPage'
import SuperadminWorkshopsPage from './pages/SuperadminWorkshopsPage'
import SuperadminSettingsPage from './pages/SuperadminSettingsPage'
import SuperadminApiStatusPage from './pages/SuperadminApiStatusPage'
import SuperadminLandingPage from './pages/SuperadminLandingPage'
import MarketingValueMockPage from './pages/MarketingValueMockPage'
import WorkshopMuLandingMockPage from './pages/WorkshopMuLandingMockPage'
import ServiceBOMPage from './pages/ServiceBOMPage'
import AdminSetupPage from './pages/AdminSetupPage'
import JamOperasionalPage from './pages/JamOperasionalPage'
import GaransiPage from './pages/GaransiPage'
import WorkshopSettingsPage from './pages/WorkshopSettingsPage'
import TenantAnalyticsPage from './pages/TenantAnalyticsPage'
import MobileLayout from './mobile/MobileLayout'
import MobileDashboard from './mobile/pages/MobileDashboard'
import MobileBooking from './mobile/pages/MobileBooking'
import MobileLayanan from './mobile/pages/MobileLayanan'
import MobileRiwayat from './mobile/pages/MobileRiwayat'
import MobileInventaris from './mobile/pages/MobileInventaris'
import MobileLainnya from './mobile/pages/MobileLainnya'
import MobilePanduan from './mobile/pages/MobilePanduan'
import MobileGenericList from './mobile/pages/MobileGenericList'
import MobilePurchaseOrders from './mobile/pages/MobilePurchaseOrders'
import MobileServiceBOM from './mobile/pages/MobileServiceBOM'
import MobileGaransi from './mobile/pages/MobileGaransi'
import MobilePenjualan from './mobile/pages/MobilePenjualan'
import MobilePemasok from './mobile/pages/MobilePemasok'
import MobileTeknisi from './mobile/pages/MobileTeknisi'
import MobileFinanceRouter from './mobile/pages/MobileFinancePages'
import MobileAnalyticsRouter from './mobile/pages/MobileAnalyticsPages'
import MobileSettings from './mobile/pages/MobileSettings'
import MobileDocuments from './mobile/pages/MobileDocuments'
import UpgradePrompt from './components/UpgradePrompt'
import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { shouldUseMobile, desktopToMobilePath } from './mobile/hooks/useIsMobile'
import ErrorBoundary from './components/ErrorBoundary'

const ProtectedRoute = ({ element }: { element: React.ReactNode }) => {
  const { isAuthenticated, isInitialized } = useAuth()

  if (!isInitialized) {
    return <div className="flex items-center justify-center h-screen"><p>Loading...</p></div>
  }

  return isAuthenticated ? element : <Navigate to="/login" replace />
}

const DashboardContent = () => {
  const { user } = useAuth()

  if (user?.role === 'admin' || user?.role === 'moderator') {
    return <AdminMainDashboard />
  }
  return <UserDashboard />
}

function MobileRedirect() {
  const location = useLocation()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()

  useEffect(() => {
    if (!isAuthenticated) return
    // Only redirect /admin/* and /dashboard, never /m/* or auth pages
    const path = location.pathname
    if (location.search.includes('desktop=1')) return
    if (path.startsWith('/m/') || path.startsWith('/login') || path.startsWith('/register') || path.startsWith('/verify') || path.startsWith('/email-sent') || path === '/') return
    if (shouldUseMobile()) {
      const mobile = desktopToMobilePath(path)
      const search = location.search || ''
      if (mobile) navigate(`${mobile}${search}`, { replace: true })
      else if (path.startsWith('/admin/') || path === '/dashboard') navigate(`/m/dashboard${search}`, { replace: true })
    }
  }, [location.pathname, location.search, isAuthenticated, navigate])

  return null
}

function AppRoutes() {
  return (
    <>
    <MobileRedirect />
    <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/email-sent" element={<EmailSentPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />

        <Route path="/" element={<LandingPage />} />
        <Route path="/marketing-value-mock" element={<MarketingValueMockPage />} />
        <Route path="/workshopmu-landing-mock" element={<WorkshopMuLandingMockPage />} />
        <Route element={<Layout />}>
          <Route path="/home-old" element={<HomePage />} />
        </Route>

        {/* Main Dashboard Layout - All Authenticated Users */}
        <Route
          element={
            <ProtectedRoute
              element={<AdminLayout />}
            />
          }
        >
          <Route path="/dashboard" element={<DashboardContent />} />
          <Route path="/admin/dashboard" element={<AdminMainDashboard />} />
          <Route path="/admin/design-mock" element={<AdminDesignMockPage />} />
          <Route path="/admin/upcoming" element={<AdminPlaceholder title="Upcoming Customer" />} />
          <Route path="/admin/services" element={<AdminServicesPage />} />
          <Route path="/admin/services/new" element={<AdminPlaceholder title="Add New Service" />} />
          <Route path="/admin/services/bom" element={<ServiceBOMPage />} />
          <Route path="/admin/setup" element={<AdminSetupPage />} />
          <Route path="/admin/users" element={<UserManagementPage />} />
          <Route path="/admin/purchases/orders" element={<PesananPembelianPage />} />
          <Route path="/admin/purchases/inventory" element={<InventarisPage />} />
          <Route path="/admin/purchases/suppliers" element={<PemasokPage />} />
          <Route path="/admin/finance/income" element={<LaporanPendapatanPage />} />
          <Route path="/admin/finance/expense" element={<LaporanPengeluaranPage />} />
          <Route path="/admin/finance/cashflow" element={<AliranKasPage />} />
          <Route path="/admin/finance/summary" element={<RingkasanKeuanganPage />} />
          <Route path="/admin/sales/summary" element={<SalesSummaryPage />} />
          <Route path="/admin/sales/registration" element={<CustomerRegistrationPage />} />
          <Route path="/admin/sales/schedule" element={<BookingTimelinePage />} />
          <Route path="/admin/sales" element={<SalesInvoicePage />} />
          <Route path="/admin/customers" element={<CRMCustomerPage />} />
          <Route path="/admin/teknisi" element={<TekniisiPage />} />
          <Route path="/admin/layanan/berjalan" element={<LayananBerjalanPage />} />
          <Route path="/admin/layanan/riwayat" element={<RiwayatLayananPage />} />
          <Route path="/admin/settings/jam-operasional" element={<JamOperasionalPage />} />
          <Route path="/admin/garansi" element={<GaransiPage />} />
          <Route path="/admin/settings/workshop" element={<WorkshopSettingsPage />} />
          <Route path="/admin/settings/license" element={<WorkshopSettingsPage view="license" />} />
          <Route path="/admin/analytics" element={<TenantAnalyticsPage />} />
          <Route path="/admin/dokumen/:docType" element={<DocumentsPage />} />
          <Route path="/superadmin/dashboard" element={<SuperadminDashboard />} />
          <Route path="/superadmin/users" element={<SuperadminUsersPage />} />
          <Route path="/superadmin/workshops" element={<SuperadminWorkshopsPage />} />
          <Route path="/superadmin/tenants" element={<SuperadminTenantsPage />} />
          <Route path="/superadmin/settings" element={<SuperadminSettingsPage />} />
          <Route path="/superadmin/api-status" element={<SuperadminApiStatusPage />} />
          <Route path="/superadmin/landing" element={<SuperadminLandingPage />} />
        </Route>

        {/* Mobile-only routes (separate layout, still protected) */}
        <Route element={<ProtectedRoute element={<MobileLayout />} />}>
          <Route path="/m/dashboard"  element={<MobileDashboard />} />
          <Route path="/m/booking"    element={<MobileBooking />} />
          <Route path="/m/layanan"    element={<MobileLayanan />} />
          <Route path="/m/riwayat"    element={<MobileRiwayat />} />
          <Route path="/m/inventaris" element={<MobileInventaris />} />
          <Route path="/m/lainnya"    element={<MobileLainnya />} />
          <Route path="/m/lainnya/panduan"             element={<MobilePanduan />} />
          <Route path="/m/lainnya/penjualan-ringkasan" element={<MobileAnalyticsRouter />} />
          <Route path="/m/lainnya/pendapatan"          element={<MobileFinanceRouter />} />
          <Route path="/m/lainnya/pengeluaran"         element={<MobileFinanceRouter />} />
          <Route path="/m/lainnya/aliran-kas"          element={<MobileFinanceRouter />} />
          <Route path="/m/lainnya/ringkasan-keuangan"  element={<MobileFinanceRouter />} />
          <Route path="/m/lainnya/analitik"            element={<MobileAnalyticsRouter />} />
          <Route path="/m/lainnya/penjualan"           element={<MobilePenjualan />} />
          <Route path="/m/lainnya/po"                  element={<MobilePurchaseOrders />} />
          <Route path="/m/lainnya/pemasok"             element={<MobilePemasok />} />
          <Route path="/m/lainnya/teknisi"             element={<MobileTeknisi />} />
          <Route path="/m/lainnya/services/hpp"        element={<MobileServiceBOM />} />
          <Route path="/m/lainnya/garansi"             element={<MobileGaransi />} />
          <Route path="/m/lainnya/settings"            element={<MobileSettings />} />
          <Route path="/m/lainnya/dokumen"             element={<MobileDocuments />} />
          <Route path="/m/lainnya/:type" element={<MobileGenericList />} />
        </Route>
      </Routes>
    </>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <AuthProvider>
          <UpgradePrompt />
          <AppRoutes />
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  )
}

export default App
