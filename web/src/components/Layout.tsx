import { Outlet, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Layout() {
  const { user, tenant, isAuthenticated, logout } = useAuth()

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link to="/" className="text-2xl font-bold text-blue-600">
                WMS
              </Link>
              {isAuthenticated && tenant && (
                <span className="ml-6 text-sm text-gray-600">
                  Organization: <span className="font-semibold">{tenant.name}</span>
                </span>
              )}
            </div>
            <div className="flex items-center space-x-8">
              <Link to="/" className="text-gray-700 hover:text-gray-900">
                Home
              </Link>
              {isAuthenticated && (
                <>
                  <Link to="/workshops" className="text-gray-700 hover:text-gray-900">
                    Workshops
                  </Link>
                  <Link to="/dashboard" className="text-gray-700 hover:text-gray-900">
                    Dashboard
                  </Link>
                </>
              )}
              <div className="flex items-center space-x-4 border-l pl-8">
                {isAuthenticated && user ? (
                  <>
                    <span className="text-sm text-gray-700">{user.name}</span>
                    <button
                      onClick={logout}
                      className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 text-sm"
                    >
                      Logout
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      to="/login"
                      className="text-gray-700 hover:text-gray-900"
                    >
                      Login
                    </Link>
                    <Link
                      to="/register"
                      className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                    >
                      Sign Up
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="bg-gray-800 text-white py-8 mt-12">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p>&copy; 2024 Workshop Management System. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
