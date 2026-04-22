import { useState, useEffect } from 'react'
import { registrationsAPI, workshopsAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { Link } from 'react-router-dom'

interface Registration {
  id: string
  status: string
  createdAt: string
  workshop: { id: string; title: string; startDate: string }
}

export default function UserDashboard() {
  const { user, tenant } = useAuth()
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchUserData()
  }, [tenant?.id, user?.id])

  const fetchUserData = async () => {
    if (!tenant?.id || !user?.id) return

    try {
      setLoading(true)
      const response = await registrationsAPI.list(tenant.id)
      const userRegs = response.data.data.filter(
        (r: any) => r.user.id === user.id
      )
      setRegistrations(userRegs)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch registrations')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12 text-center">
        <p className="text-gray-600">Loading dashboard...</p>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">Welcome, {user?.name}!</h1>
      <p className="text-gray-600 mb-8">
        Organization: <span className="font-semibold">{tenant?.name}</span>
      </p>

      {error && (
        <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-lg border border-blue-200">
          <p className="text-blue-600 text-sm font-semibold">Total Registrations</p>
          <p className="text-3xl font-bold text-blue-700 mt-2">
            {registrations.length}
          </p>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-lg border border-green-200">
          <p className="text-green-600 text-sm font-semibold">Confirmed</p>
          <p className="text-3xl font-bold text-green-700 mt-2">
            {registrations.filter((r) => r.status === 'confirmed').length}
          </p>
        </div>
        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 p-6 rounded-lg border border-yellow-200">
          <p className="text-yellow-600 text-sm font-semibold">Pending</p>
          <p className="text-3xl font-bold text-yellow-700 mt-2">
            {registrations.filter((r) => r.status === 'pending').length}
          </p>
        </div>
      </div>

      {/* My Registrations */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">My Registrations</h2>
          <Link
            to="/workshops"
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm"
          >
            Browse More Workshops
          </Link>
        </div>

        {registrations.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 mb-4">You haven't registered for any workshops yet.</p>
            <Link
              to="/workshops"
              className="inline-block bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
            >
              Explore Workshops
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {registrations.map((registration) => (
              <Link
                key={registration.id}
                to={`/workshops/${registration.workshop.id}`}
                className="block p-4 border rounded-lg hover:bg-gray-50 transition"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg hover:text-blue-600">
                      {registration.workshop.title}
                    </h3>
                    <p className="text-gray-600 text-sm">
                      📅 {formatDate(registration.workshop.startDate)}
                    </p>
                    <p className="text-gray-600 text-sm mt-1">
                      Registered: {formatDate(registration.createdAt)}
                    </p>
                  </div>
                  <span
                    className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ml-4 ${
                      registration.status === 'confirmed'
                        ? 'bg-green-100 text-green-800'
                        : registration.status === 'pending'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {registration.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
