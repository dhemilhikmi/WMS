import { useState } from 'react'
import { Link } from 'react-router-dom'
import { authAPI } from '../services/api'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    setError('')
    try {
      const response = await authAPI.forgotPassword(email)
      setMessage(response.data.message || 'Jika email terdaftar, instruksi reset password akan dikirim.')
    } catch (err: any) {
      setError(err.response?.data?.message || 'Gagal memproses reset password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-wm-bg px-4">
      <div className="w-full max-w-md rounded-wm-xl bg-white p-8 shadow-wm-lg">
        <div className="mb-7 text-center">
          <img src="/workshopmu-logo.svg" alt="WorkshopMU" className="mx-auto mb-3 h-12 w-12" />
          <h1 className="text-xl font-bold text-ink">Lupa Password</h1>
          <p className="mt-1 text-sm text-ink-3">Masukkan email akun Anda untuk menerima link reset password.</p>
        </div>

        {message && <div className="mb-4 rounded-wm-md bg-green-100 p-3 text-sm text-green-700">{message}</div>}
        {error && <div className="mb-4 rounded-wm-md bg-red-100 p-3 text-sm text-red-700">{error}</div>}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-ink-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-wm-md border border-wm-line px-4 py-2.5 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
              placeholder="you@example.com"
            />
          </div>
          <button disabled={loading} className="w-full rounded-wm-md bg-brand py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50">
            {loading ? 'Mengirim...' : 'Kirim Link Reset'}
          </button>
        </form>

        <div className="mt-5 text-center text-sm text-ink-3">
          <Link to="/login" className="font-semibold text-brand hover:underline">Kembali ke login</Link>
        </div>
      </div>
    </div>
  )
}
