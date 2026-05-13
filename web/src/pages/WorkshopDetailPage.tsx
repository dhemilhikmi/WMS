import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { workshopsAPI, registrationsAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'

interface Workshop {
  id: string
  title: string
  description?: string
  startDate: string
  endDate: string
  location?: string
  maxCapacity: number
  status: string
  _count: { registrations: number }
  registrations?: any[]
}

export default function WorkshopDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, tenant } = useAuth()
  const [workshop, setWorkshop] = useState<Workshop | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [registering, setRegistering] = useState(false)
  const [registered, setRegistered] = useState(false)

  useEffect(() => {
    fetchWorkshop()
  }, [id, tenant?.id])

  const fetchWorkshop = async () => {
    if (!id || !tenant?.id) return

    try {
      setLoading(true)
      const response = await workshopsAPI.get(id, tenant.id)
      setWorkshop(response.data.data)

      // Check if user already registered
      if (user && response.data.data.registrations) {
        const isRegistered = response.data.data.registrations.some(
          (reg: any) => reg.userId === user.id
        )
        setRegistered(isRegistered)
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch workshop')
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async () => {
    if (!user || !workshop || !tenant?.id) return

    setRegistering(true)
    try {
      await registrationsAPI.create({
        customerId: user.id,
        workshopId: workshop.id,
        tenantId: tenant.id,
      })
      setRegistered(true)
      setWorkshop({
        ...workshop,
        _count: { registrations: workshop._count.registrations + 1 },
      })
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to register')
    } finally {
      setRegistering(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const availableSeats = workshop
    ? workshop.maxCapacity - workshop._count.registrations
    : 0

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <p className="text-gray-600">Loading workshop...</p>
      </div>
    )
  }

  if (!workshop) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <p className="text-gray-600 mb-4">Workshop not found</p>
        <button
          onClick={() => navigate('/workshops')}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Back to Workshops
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <button
        onClick={() => navigate('/workshops')}
        className="text-blue-600 hover:underline mb-6"
      >
        ← Back to Workshops
      </button>

      {error && (
        <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-4xl font-bold mb-2">{workshop.title}</h1>
            <div className="flex items-center space-x-4 text-gray-600">
              <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                {workshop.status}
              </span>
            </div>
          </div>
        </div>

        {workshop.description && (
          <p className="text-gray-700 text-lg mb-8">{workshop.description}</p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <div>
            <h3 className="text-xl font-bold mb-4">📋 Details</h3>
            <div className="space-y-4">
              <div>
                <p className="text-gray-600 text-sm">Start Date</p>
                <p className="text-lg font-semibold">
                  {formatDate(workshop.startDate)}
                </p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">End Date</p>
                <p className="text-lg font-semibold">
                  {formatDate(workshop.endDate)}
                </p>
              </div>
              {workshop.location && (
                <div>
                  <p className="text-gray-600 text-sm">📍 Location</p>
                  <p className="text-lg font-semibold">{workshop.location}</p>
                </div>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-xl font-bold mb-4">👥 Capacity</h3>
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-6 rounded-lg">
              <p className="text-gray-600 text-sm mb-2">Registered Participants</p>
              <p className="text-3xl font-bold text-blue-600 mb-4">
                {workshop._count.registrations}/{workshop.maxCapacity}
              </p>
              <p className="text-gray-600">
                {availableSeats > 0 ? (
                  <span className="text-green-600 font-semibold">
                    ✓ {availableSeats} seats available
                  </span>
                ) : (
                  <span className="text-red-600 font-semibold">
                    ✗ Workshop full
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        {user && (
          <div className="border-t pt-8">
            {registered ? (
              <div className="p-4 bg-green-100 text-green-700 rounded-lg text-center">
                <p className="font-semibold">✓ You are registered for this workshop</p>
              </div>
            ) : (
              <button
                onClick={handleRegister}
                disabled={registering || availableSeats === 0}
                className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {registering ? 'Registering...' : 'Register for Workshop'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
