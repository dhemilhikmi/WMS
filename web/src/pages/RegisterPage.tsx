import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { authAPI } from '../services/api'

type Step = 1 | 2

export default function RegisterPage() {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState<Step>(1)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [formData, setFormData] = useState({
    tenantName: '',
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const isStep1Valid = () =>
    formData.tenantName.trim() &&
    formData.name.trim() &&
    formData.email.trim() &&
    formData.password &&
    formData.password === formData.confirmPassword

  const handleNextStep = () => {
    setError('')

    if (!isStep1Valid()) {
      setError('Mohon isi semua field dan pastikan password cocok.')
      return
    }

    setCurrentStep(2)
  }

  const handlePrevStep = () => {
    if (currentStep === 1) {
      navigate('/')
      return
    }

    setCurrentStep(1)
    setError('')
  }

  const handleRegister = async () => {
    setError('')
    setSubmitting(true)

    try {
      const registerResponse = await authAPI.register({
        tenantName: formData.tenantName.trim(),
        tenantEmail: formData.email.trim(),
        email: formData.email.trim(),
        name: formData.name.trim(),
        password: formData.password,
      })

      const { data: registerData } = registerResponse.data
      const emailSent = Boolean(registerData.emailSent)
      const emailVerified = Boolean(registerData.emailVerified)
      const emailDeliveryFailed = Boolean(registerData.emailDeliveryFailed)
      const resultUrl = `/email-sent?email=${encodeURIComponent(formData.email.trim())}&sent=${emailSent ? '1' : '0'}&verified=${emailVerified ? '1' : '0'}&deliveryFailed=${emailDeliveryFailed ? '1' : '0'}`

      navigate(resultUrl)
    } catch (err: any) {
      const status = err.response?.status
      const message = err.response?.data?.message
      setError(message || `Registrasi gagal${status ? ` (${status})` : ''}. Coba beberapa saat lagi.`)
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="bg-white p-8 rounded-lg shadow w-full max-w-2xl">
        <h2 className="text-2xl font-bold mb-2 text-center">Buat Akun</h2>
        <p className="text-center text-gray-600 text-sm mb-6">
          Langkah {currentStep} dari 2
        </p>

        {error && (
          <div className="mb-6 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        {currentStep === 1 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold mb-4">Informasi Akun</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nama Workshop / Organisasi
              </label>
              <input
                type="text"
                name="tenantName"
                value={formData.tenantName}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder="Contoh: SpeedMaster Detailing"
              />
            </div>

            <div className="border-t pt-4 mt-4">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Akun Admin</h4>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="Nama lengkap Anda"
                />
              </div>

              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="email@example.com"
                />
              </div>

              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="Min. 8 karakter"
                />
              </div>

              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Konfirmasi Password
                </label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="Ulangi password"
                />
              </div>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold mb-4">Konfirmasi Trial Pro</h3>

            <div className="bg-gray-50 p-4 rounded-lg space-y-3">
              <div className="flex justify-between gap-4">
                <span className="text-gray-700">Workshop:</span>
                <span className="font-semibold text-right">{formData.tenantName}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-gray-700">Email Admin:</span>
                <span className="font-semibold text-right">{formData.email}</span>
              </div>
              <div className="border-t pt-3 flex justify-between gap-4">
                <span className="text-gray-700">Paket:</span>
                <span className="font-semibold text-right">Pro Trial 60 Hari</span>
              </div>
              <div className="flex justify-between gap-4 text-lg font-bold text-blue-600">
                <span>Biaya hari ini:</span>
                <span>Rp 0</span>
              </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-800">
              Akun akan langsung dibuat. Jika email verifikasi berhasil dikirim, silakan cek inbox untuk aktivasi.
            </div>
          </div>
        )}

        <div className="flex justify-between mt-8">
          <button
            onClick={handlePrevStep}
            disabled={submitting}
            className="px-6 py-2 border rounded-lg hover:bg-gray-50 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Kembali
          </button>

          {currentStep === 1 ? (
            <button
              onClick={handleNextStep}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              Lanjut
            </button>
          ) : (
            <button
              onClick={handleRegister}
              disabled={submitting}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Membuat Akun...' : 'Buat Akun Gratis'}
            </button>
          )}
        </div>

        <p className="text-center text-gray-600 text-sm mt-6">
          Sudah punya akun? <Link to="/login" className="text-blue-600 hover:underline">Masuk</Link>
        </p>
      </div>
    </div>
  )
}
