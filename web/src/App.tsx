import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import WorkshopsPage from './pages/WorkshopsPage'
import WorkshopDetailPage from './pages/WorkshopDetailPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import UserDashboard from './pages/UserDashboard'
import AdminDashboard from './pages/AdminDashboard'

const ProtectedRoute = ({ element }: { element: React.ReactNode }) => {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? element : <Navigate to="/login" replace />
}

const AdminRoute = ({ element }: { element: React.ReactNode }) => {
  const { isAuthenticated, user } = useAuth()
  return isAuthenticated && (user?.role === 'admin' || user?.role === 'moderator') ? (
    element
  ) : (
    <Navigate to="/dashboard" replace />
  )
}

const RoleDashboard = () => {
  const { user } = useAuth()

  if (user?.role === 'admin' || user?.role === 'moderator') {
    return <AdminDashboard />
  }
  return <UserDashboard />
}

function AppContent() {
  const { isAuthenticated } = useAuth()

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route
            path="/workshops"
            element={<ProtectedRoute element={<WorkshopsPage />} />}
          />
          <Route
            path="/workshops/:id"
            element={<ProtectedRoute element={<WorkshopDetailPage />} />}
          />
          <Route
            path="/dashboard"
            element={<ProtectedRoute element={<RoleDashboard />} />}
          />
          <Route
            path="/admin"
            element={<AdminRoute element={<AdminDashboard />} />}
          />
        </Route>
      </Routes>
    </Router>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
