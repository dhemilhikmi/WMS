import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { authAPI } from '../services/api'

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') || ''
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('Password minimal 8 karakter')
      return
    }
    if (password !== confirmPassword) {
      setError('Konfirmasi password tidak sama')
      return
    }
    setLoading(true)
    try {
      await authAPI.resetPassword({ token, password })
      navigate('/login?reset=success')
    } catch (err: any) {
      setError(err.response?.data?.message || 'Gagal mengubah password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-wm-bg px-4">
      <div className="w-full max-w-md rounded-wm-xl bg-white p-8 shadow-wm-lg">
        <div className="mb-7 text-center">
          <img src="/workshopmu-logo.svg" alt="WorkshopMU" className="mx-auto mb-3 h-12 w-12" />
          <h1 className="text-xl font-bold text-ink">Reset Password</h1>
          <p className="mt-1 text-sm text-ink-3">Buat password baru untuk akun WorkshopMU Anda.</p>
        </div>

        {!token && <div className="mb-4 rounded-wm-md bg-red-100 p-3 text-sm text-red-700">Token reset password tidak ditemukan.</div>}
        {error && <div className="mb-4 rounded-wm-md bg-red-100 p-3 text-sm text-red-700">{error}</div>}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-ink-2">Password Baru</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={!token} className="w-full rounded-wm-md border border-wm-line px-4 py-2.5 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-ink-2">Konfirmasi Password</label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required disabled={!token} className="w-full rounded-wm-md border border-wm-line px-4 py-2.5 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20" />
          </div>
          <button disabled={loading || !token} className="w-full rounded-wm-md bg-brand py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50">
            {loading ? 'Menyimpan...' : 'Simpan Password Baru'}
          </button>
        </form>

        <div className="mt-5 text-center text-sm text-ink-3">
          <Link to="/login" className="font-semibold text-brand hover:underline">Kembali ke login</Link>
        </div>
      </div>
    </div>
  )
}
