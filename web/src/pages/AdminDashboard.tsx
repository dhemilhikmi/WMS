import { useState, useEffect } from 'react'
import { workshopsAPI, registrationsAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { Link } from 'react-router-dom'

interface Workshop {
  id: string
  title: string
  status: string
  startDate: string
  maxCapacity: number
  _count: { registrations: number }
}

export default function AdminDashboard() {
  const { user, tenant } = useAuth()
  const [workshops, setWorkshops] = useState<Workshop[]>([])
  const [registrations, setRegistrations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startDate: '',
    endDate: '',
    location: '',
    maxCapacity: 30,
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchAdminData()
  }, [tenant?.id])

  const fetchAdminData = async () => {
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
      setError(err.response?.data?.message || 'Failed to fetch admin data')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateWorkshop = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tenant?.id) return

    setSubmitting(true)
    try {
      await workshopsAPI.create({
        ...formData,
        tenantId: tenant.id,
      })

      setFormData({
        title: '',
        description: '',
        startDate: '',
        endDate: '',
        location: '',
        maxCapacity: 30,
      })
      setShowCreateForm(false)
      fetchAdminData()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create workshop')
    } finally {
      setSubmitting(false)
    }
  }

  const stats = {
    totalWorkshops: workshops.length,
    publishedWorkshops: workshops.filter((w) => w.status === 'published').length,
    totalParticipants: registrations.length,
    confirmedRegistrations: registrations.filter(
      (r) => r.status === 'confirmed'
    ).length,
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
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-gray-600">Organization: {tenant?.name}</p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 font-bold"
        >
          + Create Workshop
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {/* Create Workshop Form */}
      {showCreateForm && (
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-bold mb-6">Create New Workshop</h2>
          <form onSubmit={handleCreateWorkshop} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Workshop Title"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                required
                className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="number"
                placeholder="Max Capacity"
                value={formData.maxCapacity}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    maxCapacity: parseInt(e.target.value),
                  })
                }
                className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <textarea
              placeholder="Description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <input
                type="datetime-local"
                placeholder="Start Date"
                value={formData.startDate}
                onChange={(e) =>
                  setFormData({ ...formData, startDate: e.target.value })
                }
                required
                className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="datetime-local"
                placeholder="End Date"
                value={formData.endDate}
                onChange={(e) =>
                  setFormData({ ...formData, endDate: e.target.value })
                }
                required
                className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="Location"
                value={formData.location}
                onChange={(e) =>
                  setFormData({ ...formData, location: e.target.value })
                }
                className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-4">
              <button
                type="submit"
                disabled={submitting}
                className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 font-bold disabled:opacity-50"
              >
                {submitting ? 'Creating...' : 'Create Workshop'}
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="bg-gray-400 text-white px-6 py-2 rounded hover:bg-gray-500 font-bold"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-gray-600 text-sm">Total Workshops</p>
          <p className="text-3xl font-bold text-blue-600">{stats.totalWorkshops}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-gray-600 text-sm">Published</p>
          <p className="text-3xl font-bold text-green-600">
            {stats.publishedWorkshops}
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-gray-600 text-sm">Total Registrations</p>
          <p className="text-3xl font-bold text-orange-600">
            {stats.totalParticipants}
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-gray-600 text-sm">Confirmed</p>
          <p className="text-3xl font-bold text-purple-600">
            {stats.confirmedRegistrations}
          </p>
        </div>
      </div>

      {/* Workshops Management */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
        <h2 className="text-2xl font-bold mb-6">All Workshops</h2>

        {workshops.length === 0 ? (
          <p className="text-gray-600 text-center py-8">
            No workshops created yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Title</th>
                  <th className="px-4 py-3 text-left font-semibold">Date</th>
                  <th className="px-4 py-3 text-left font-semibold">
                    Registrations
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-left font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {workshops.map((workshop) => (
                  <tr key={workshop.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold">{workshop.title}</td>
                    <td className="px-4 py-3">{formatDate(workshop.startDate)}</td>
                    <td className="px-4 py-3">
                      {workshop._count.registrations}/{workshop.maxCapacity}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          workshop.status === 'published'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {workshop.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/workshops/${workshop.id}`}
                        className="text-blue-600 hover:underline text-sm"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
