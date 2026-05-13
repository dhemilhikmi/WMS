import { useState } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { authAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [emailNotVerified, setEmailNotVerified] = useState('')
  const [resendLoading, setResendLoading] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await authAPI.login({ email: email.trim(), password })
      const { data: userData } = response.data

      login(userData.user, userData.tenant, userData.token)
      if (userData.user.role === 'superadmin') {
        navigate('/superadmin/dashboard')
      } else if (userData.user.role === 'admin' || userData.user.role === 'moderator') {
        navigate('/admin/dashboard')
      } else {
        navigate('/dashboard')
      }
    } catch (err: any) {
      if (err.response?.data?.code === 'EMAIL_NOT_VERIFIED') {
        setEmailNotVerified(err.response?.data?.email || email)
        setError(err.response?.data?.message)
      } else {
        setError(err.response?.data?.message || 'Login failed')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleResendVerification = async () => {
    if (!emailNotVerified) return
    setResendLoading(true)
    try {
      await authAPI.resendVerification(emailNotVerified)
      navigate(`/email-sent?email=${encodeURIComponent(emailNotVerified)}`)
    } catch (err: any) {
      console.error('Resend error:', err)
    } finally {
      setResendLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-wm-bg">
      <div className="bg-white p-8 rounded-wm-xl shadow-wm-lg w-full max-w-md">

        {/* Logo + wordmark */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <img src="/workshopmu-logo.svg" alt="WorkshopMU" className="h-12 w-12" />
          <span className="wm-wordmark text-2xl">
            Workshop<span className="mu">MU</span>
          </span>
        </div>

        {searchParams.get('registered') === 'true' && (
          <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-wm-md text-sm">
            Registration successful! You can now log in.
          </div>
        )}

        {searchParams.get('reset') === 'success' && (
          <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-wm-md text-sm">
            Password berhasil diubah. Silakan login dengan password baru.
          </div>
        )}

        {error && !emailNotVerified && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-wm-md text-sm">
            {error}
          </div>
        )}

        {emailNotVerified && error && (
          <div className="mb-4 p-3 bg-yellow-100 text-yellow-800 rounded-wm-md text-sm">
            <p className="font-medium mb-2">{error}</p>
            <button
              type="button"
              onClick={handleResendVerification}
              disabled={resendLoading}
              className="text-yellow-800 underline hover:no-underline disabled:opacity-50"
            >
              {resendLoading ? 'Sending...' : 'Resend verification email'}
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-ink-2 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2.5 border border-wm-line rounded-wm-md text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-ink-2 mb-1.5">Password</label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2.5 border border-wm-line rounded-wm-md text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition"
              placeholder="••••••••"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowPassword(p => !p)}
            className="-mt-2 text-left text-xs font-semibold text-brand"
          >
            {showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
          </button>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand text-white py-2.5 rounded-wm-md hover:bg-brand-600 font-semibold text-sm disabled:opacity-50 transition"
          >
            {loading ? 'Masuk...' : 'Masuk'}
          </button>
        </form>

        <div className="mt-4 flex items-center justify-between text-sm">
          <Link to="/forgot-password" className="font-semibold text-brand hover:underline">Lupa password?</Link>
          <a href="mailto:support@workshopmu.com" className="font-semibold text-brand hover:underline">Contact us</a>
        </div>

        <p className="text-center text-ink-3 text-sm mt-5">
          Belum punya akun? <Link to="/register" className="text-brand font-semibold hover:underline">Daftar</Link>
        </p>
      </div>
    </div>
  )
}
