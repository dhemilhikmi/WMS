import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { authAPI } from '../services/api'

export default function EmailSentPage() {
  const [searchParams] = useSearchParams()
  const email = searchParams.get('email') || ''
  const emailSent = searchParams.get('sent') === '1'
  const emailVerified = searchParams.get('verified') === '1'
  const emailDeliveryFailed = searchParams.get('deliveryFailed') === '1'
  const [resendLoading, setResendLoading] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [resendCooldown])

  const handleResend = async () => {
    if (resendCooldown > 0 || !email) return
    setResendLoading(true)
    setMessage('')

    try {
      await authAPI.resendVerification(email)
      setMessage('Email verifikasi sudah dikirim ulang. Silakan cek inbox atau folder spam.')
      setResendCooldown(60)
    } catch (err: any) {
      console.error('Resend error:', err)
      setMessage(err.response?.data?.message || 'Gagal mengirim ulang email. Coba beberapa saat lagi.')
    } finally {
      setResendLoading(false)
    }
  }

  const showEmailInstruction = emailSent && !emailVerified
  const showDeliveryFailure = emailDeliveryFailed && emailVerified

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="bg-white p-8 rounded-lg shadow w-full max-w-md text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-2xl">
          {showEmailInstruction ? '@' : 'OK'}
        </div>

        <h2 className="text-2xl font-bold mb-2 text-gray-900">
          {showEmailInstruction ? 'Cek Email Anda' : 'Akun Berhasil Dibuat'}
        </h2>

        {showEmailInstruction ? (
          <>
            <p className="text-gray-600 mb-4">
              Kami sudah mengirim link konfirmasi ke{' '}
              <span className="font-semibold text-gray-900">{email}</span>.
            </p>
            <div className="mb-6 rounded-lg border border-blue-100 bg-blue-50 p-4 text-left text-sm text-blue-900">
              Silakan buka email tersebut dan klik link verifikasi untuk mengaktifkan akun workshop.
              Jika tidak terlihat, cek folder spam atau promotions.
            </div>
          </>
        ) : showDeliveryFailure ? (
          <>
            <p className="text-gray-600 mb-4">
              Akun trial Pro 60 hari sudah aktif untuk{' '}
              <span className="font-semibold text-gray-900">{email || 'email Anda'}</span>.
            </p>
            <div className="mb-6 rounded-lg border border-amber-100 bg-amber-50 p-4 text-left text-sm text-amber-900">
              Email verifikasi belum berhasil dikirim dari SMTP. Untuk sementara akun dibuat auto-verifikasi,
              jadi Anda bisa langsung login. Cek kembali konfigurasi SMTP atau alamat pengirim.
            </div>
          </>
        ) : (
          <>
            <p className="text-gray-600 mb-4">
              Akun trial Pro 60 hari sudah aktif untuk{' '}
              <span className="font-semibold text-gray-900">{email || 'email Anda'}</span>.
            </p>
            <div className="mb-6 rounded-lg border border-green-100 bg-green-50 p-4 text-left text-sm text-green-800">
              Email service belum aktif, jadi akun dibuat dalam mode auto-verifikasi. Anda bisa langsung login.
            </div>
          </>
        )}

        {message && (
          <div className={`mb-4 p-3 rounded-lg text-sm ${message.includes('Gagal') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            {message}
          </div>
        )}

        {showEmailInstruction && (
          <button
            onClick={handleResend}
            disabled={resendLoading || resendCooldown > 0}
            className="mb-3 w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
          >
            {resendLoading ? 'Mengirim...' : resendCooldown > 0 ? `Kirim ulang dalam ${resendCooldown}s` : 'Kirim Ulang Email Verifikasi'}
          </button>
        )}

        <Link
          to="/login"
          className="block w-full rounded-lg bg-gray-100 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
        >
          Ke Halaman Login
        </Link>
      </div>
    </div>
  )
}
