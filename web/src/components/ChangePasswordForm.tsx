import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authAPI } from '../services/api'

type Variant = 'desktop' | 'mobile'

export default function ChangePasswordForm({ variant = 'desktop' }: { variant?: Variant }) {
  const navigate = useNavigate()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const inputCls = variant === 'mobile'
    ? 'w-full rounded-xl border border-[#cbd5e1] bg-white px-3 py-2.5 text-[13px] text-ink outline-none focus:border-[#1E4FD8]'
    : 'w-full rounded border border-[#cbd5e1] bg-white px-3 py-2 text-sm text-[#111] outline-none transition focus:border-[#1E4FD8] focus:ring-2 focus:ring-[#dbeafe]'
  const labelCls = variant === 'mobile'
    ? 'mb-1 block text-[11px] font-semibold text-[#475569]'
    : 'mb-1 block text-[11px] font-semibold text-[#555]'
  const buttonCls = variant === 'mobile'
    ? 'w-full rounded-2xl bg-brand py-3 text-[14px] font-bold text-white disabled:opacity-60'
    : 'rounded-lg bg-[#1E4FD8] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1A45BF] disabled:opacity-40'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')
    setError('')

    if (newPassword.length < 8) {
      setError('Password baru minimal 8 karakter')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Konfirmasi password tidak sama')
      return
    }

    setSaving(true)
    try {
      await authAPI.changePassword({ currentPassword, newPassword })
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      localStorage.removeItem('tenant')
      setMessage('Password berhasil diubah. Silakan login kembali.')
      setTimeout(() => navigate('/login?passwordChanged=1', { replace: true }), 900)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Gagal mengubah password')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {message && (
        <div className="rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-3 text-[12px] font-semibold text-[#15803d]">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-[12px] font-semibold text-[#b91c1c]">
          {error}
        </div>
      )}
      <div>
        <label className={labelCls}>Password Lama</label>
        <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required className={inputCls} />
      </div>
      <div className={variant === 'mobile' ? 'space-y-3' : 'grid grid-cols-2 gap-3'}>
        <div>
          <label className={labelCls}>Password Baru</label>
          <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={8} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Konfirmasi Password</label>
          <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={8} className={inputCls} />
        </div>
      </div>
      <div className="pt-1">
        <button type="submit" disabled={saving} className={buttonCls}>
          {saving ? 'Menyimpan...' : 'Ubah Password'}
        </button>
      </div>
    </form>
  )
}
