import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { authAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { login } = useAuth()
  const token = searchParams.get('token') || ''
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const [countdown, setCountdown] = useState(3)

  useEffect(() => {
    const verify = async () => {
      if (!token) {
        setStatus('error')
        setMessage('No verification token provided')
        return
      }

      try {
        const response = await authAPI.verifyEmail(token)
        const { data: userData } = response.data
        setStatus('success')
        setMessage('Email verified successfully!')
        login(userData.user, userData.tenant, userData.token)
      } catch (err: any) {
        setStatus('error')
        setMessage(err.response?.data?.message || 'Email verification failed')
      }
    }

    verify()
  }, [token, login])

  useEffect(() => {
    if (status === 'success' && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    } else if (status === 'success' && countdown === 0) {
      navigate('/dashboard')
    }
  }, [status, countdown, navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-lg shadow w-full max-w-md text-center">
        {status === 'loading' && (
          <>
            <div className="inline-block animate-spin text-4xl mb-4">⏳</div>
            <h2 className="text-2xl font-bold mb-2">Verifying Email</h2>
            <p className="text-gray-600">Please wait while we verify your email address...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="text-6xl mb-4">✅</div>
            <h2 className="text-2xl font-bold mb-2 text-green-600">{message}</h2>
            <p className="text-gray-600">Redirecting to dashboard in {countdown}s...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="text-6xl mb-4">❌</div>
            <h2 className="text-2xl font-bold mb-2 text-red-600">Verification Failed</h2>
            <p className="text-gray-600 mb-6">{message}</p>
            <button
              onClick={() => navigate('/login')}
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 font-medium"
            >
              Back to login
            </button>
          </>
        )}
      </div>
    </div>
  )
}
