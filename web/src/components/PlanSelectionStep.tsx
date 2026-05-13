import { useEffect, useState } from 'react'
import { superadminAPI } from '../services/api'

interface Plan {
  id: string
  name: string
  description?: string
  price: number
  maxUsers: number
  maxServices: number
}

interface PlanSelectionStepProps {
  selectedPlanId: string
  onPlanChange: (planId: string) => void
  loading?: boolean
}

export default function PlanSelectionStep({ selectedPlanId, onPlanChange, loading = false }: PlanSelectionStepProps) {
  const [plans, setPlans] = useState<Plan[]>([])
  const [planLoading, setPlanLoading] = useState(true)

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const response = await superadminAPI.getPlans()
        setPlans(response.data.data || [])
      } catch (err) {
        console.error('Failed to load plans:', err)
      } finally {
        setPlanLoading(false)
      }
    }

    fetchPlans()
  }, [])

  if (planLoading) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Loading plans...</p>
      </div>
    )
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price)
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-4">
        Select Your Subscription Plan
      </label>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.map((plan) => (
          <div
            key={plan.id}
            onClick={() => !loading && onPlanChange(plan.id)}
            className={`relative p-4 border-2 rounded-lg cursor-pointer transition-all ${
              selectedPlanId === plan.id
                ? 'border-blue-600 bg-blue-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
            } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {selectedPlanId === plan.id && (
              <div className="absolute top-2 right-2 text-blue-600 text-2xl">✓</div>
            )}

            <h3 className="text-lg font-bold text-gray-900 mb-1">{plan.name}</h3>

            <div className="text-2xl font-bold text-blue-600 mb-3">
              {formatPrice(plan.price)}
              <span className="text-sm text-gray-600">/bulan</span>
            </div>

            {plan.description && (
              <p className="text-sm text-gray-600 mb-3">{plan.description}</p>
            )}

            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-center">
                <span className="text-blue-600 mr-2">•</span>
                Max {plan.maxUsers} Users
              </li>
              <li className="flex items-center">
                <span className="text-blue-600 mr-2">•</span>
                {plan.maxServices} Services
              </li>
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
