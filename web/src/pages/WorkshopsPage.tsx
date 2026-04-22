import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { workshopsAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'

interface Workshop {
  id: string
  title: string
  description?: string
  startDate: string
  location?: string
  _count: { registrations: number }
}

export default function WorkshopsPage() {
  const navigate = useNavigate()
  const { tenant } = useAuth()
  const [workshops, setWorkshops] = useState<Workshop[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchWorkshops()
  }, [tenant?.id])

  const fetchWorkshops = async () => {
    if (!tenant?.id) return

    try {
      setLoading(true)
      const response = await workshopsAPI.list(tenant.id)
      setWorkshops(response.data.data || [])
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch workshops')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center">
        <p className="text-gray-600">Loading workshops...</p>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Available Workshops</h1>
        <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          + Create Workshop
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {workshops.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-600 mb-4">No workshops found</p>
          <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
            Create Your First Workshop
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {workshops.map((workshop) => (
            <div
              key={workshop.id}
              className="bg-white rounded-lg shadow hover:shadow-lg transition cursor-pointer"
              onClick={() => navigate(`/workshops/${workshop.id}`)}
            >
              <div className="p-6">
                <h3 className="text-xl font-bold mb-2">{workshop.title}</h3>
                <p className="text-gray-600 mb-4 text-sm line-clamp-2">
                  {workshop.description || 'No description'}
                </p>
                <div className="flex justify-between items-center mb-4 text-sm text-gray-500">
                  <span>📅 {formatDate(workshop.startDate)}</span>
                  <span>👥 {workshop._count.registrations} registered</span>
                </div>
                {workshop.location && (
                  <p className="text-sm text-gray-500 mb-4">📍 {workshop.location}</p>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate(`/workshops/${workshop.id}`)
                  }}
                  className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 text-sm"
                >
                  View Details
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
