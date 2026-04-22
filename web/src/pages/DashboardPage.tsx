import { useState, useEffect } from 'react'
import { workshopsAPI, registrationsAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'

interface Registration {
  id: string
  status: string
  createdAt: string
  workshop: { id: string; title: string; startDate: string }
  user: { id: string; name: string; email: string }
}

export default function DashboardPage() {
  const { user, tenant } = useAuth()
  const [workshops, setWorkshops] = useState<any[]>([])
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchDashboardData()
  }, [tenant?.id])

  const fetchDashboardData = async () => {
    if (!tenant?.id) return

    try {
      setLoading(true)
      const [workshopsRes, registrationsRes] = await Promise.all([
        workshopsAPI.list(tenant.id),
        registrationsAPI.list(tenant.id),
      ])

      setWorkshops(workshopsRes.data.data || [])
      setRegistrations(registrationsRes.data.data || [])
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch dashboard data')
    } finally {
      setLoading(false)
    }
  }

  const stats = {
    totalWorkshops: workshops.length,
    totalRegistrations: registrations.length,
    activeWorkshops: workshops.filter((w) => w.status === 'published').length,
    completedWorkshops: workshops.filter((w) => w.status === 'completed').length,
    userRegistrations: registrations.filter((r) => r.user.id === user?.id)
      .length,
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID')
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center">
        <p className="text-gray-600">Loading dashboard...</p>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>

      {error && (
        <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition">
          <p className="text-gray-600 text-sm">Total Workshops</p>
          <p className="text-3xl font-bold text-blue-600">{stats.totalWorkshops}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition">
          <p className="text-gray-600 text-sm">Active Workshops</p>
          <p className="text-3xl font-bold text-green-600">
            {stats.activeWorkshops}
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition">
          <p className="text-gray-600 text-sm">Completed</p>
          <p className="text-3xl font-bold text-purple-600">
            {stats.completedWorkshops}
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition">
          <p className="text-gray-600 text-sm">Total Registrations</p>
          <p className="text-3xl font-bold text-orange-600">
            {stats.totalRegistrations}
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition">
          <p className="text-gray-600 text-sm">Your Registrations</p>
          <p className="text-3xl font-bold text-indigo-600">
            {stats.userRegistrations}
          </p>
        </div>
      </div>

      {/* My Registrations */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-2xl font-bold mb-6">Your Registrations</h2>

        {stats.userRegistrations === 0 ? (
          <p className="text-gray-600 text-center py-8">
            You haven't registered for any workshops yet.
          </p>
        ) : (
          <div className="space-y-4">
            {registrations
              .filter((r) => r.user.id === user?.id)
              .map((registration) => (
                <div
                  key={registration.id}
                  className="flex justify-between items-center p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div>
                    <h3 className="font-semibold text-lg">
                      {registration.workshop.title}
                    </h3>
                    <p className="text-gray-600 text-sm">
                      📅 {formatDate(registration.workshop.startDate)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${
                        registration.status === 'confirmed'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {registration.status}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* All Registrations */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-6">All Registrations</h2>

        {registrations.length === 0 ? (
          <p className="text-gray-600 text-center py-8">
            No registrations yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Workshop</th>
                  <th className="px-4 py-3 text-left font-semibold">User</th>
                  <th className="px-4 py-3 text-left font-semibold">Date</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {registrations.slice(0, 10).map((registration) => (
                  <tr key={registration.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">{registration.workshop.title}</td>
                    <td className="px-4 py-3">{registration.user.name}</td>
                    <td className="px-4 py-3">
                      {formatDate(registration.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          registration.status === 'confirmed'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {registration.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {registrations.length > 10 && (
              <p className="text-gray-600 text-center py-4 text-sm">
                Showing 10 of {registrations.length} registrations
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
