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
                WorkshopMu
              </Link>
              {isAuthenticated && tenant && (
                <span className="ml-6 text-sm text-gray-600">
                  Organization: <span className="font-semibold">{tenant.name}</span>
                </span>
              )}
            </div>
            <div className="flex items-center space-x-8">
              {!isAuthenticated && (
                <Link to="/" className="text-gray-700 hover:text-gray-900">
                  Home
                </Link>
              )}
              {isAuthenticated && (
                <>
                  {user?.role === 'superadmin' ? (
                    <>
                      <Link to="/superadmin" className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 font-bold">
                        Dashboard
                      </Link>
                      <Link to="/superadmin/workshops" className="text-gray-700 hover:text-gray-900">
                        Workshops
                      </Link>
                      <Link to="/superadmin/users" className="text-gray-700 hover:text-gray-900">
                        Users
                      </Link>
                      <Link to="/superadmin/settings" className="text-gray-700 hover:text-gray-900">
                        Settings
                      </Link>
                    </>
                  ) : (
                    <>
                      <Link to="/dashboard" className="text-gray-700 hover:text-gray-900">
                        Dashboard
                      </Link>
                      {user?.role === 'admin' || user?.role === 'moderator' ? (
                        <Link to="/admin/dashboard" className="bg-purple-600 text-white px-3 py-1 rounded text-sm hover:bg-purple-700">
                          Admin
                        </Link>
                      ) : null}
                    </>
                  )}
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
          <p>&copy; 2024 WorkshopMu. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
