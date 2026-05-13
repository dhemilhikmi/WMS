import { useEffect, useState } from 'react'
import { settingsAPI } from '../services/api'
import ChangePasswordForm from '../components/ChangePasswordForm'

const inputCls = 'w-full rounded border border-[#cbd5e1] bg-white px-3 py-2 text-sm text-[#111] outline-none focus:border-[#1E4FD8] focus:ring-2 focus:ring-[#dbeafe] transition'
const labelCls = 'block text-[11px] font-semibold text-[#555] mb-1'

export default function SuperadminSettingsPage() {
  const [smtp, setSmtp] = useState({
    smtp_host: '', smtp_port: '', smtp_user: '', smtp_pass: '',
    smtp_from_email: '', smtp_from_name: '', smtp_secure: 'true',
    app_name: '',
  })
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [msgType, setMsgType] = useState<'ok' | 'err'>('ok')
  const [testEmail, setTestEmail] = useState('')
  const [testLoading, setTestLoading] = useState(false)
  const [testResult, setTestResult] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    settingsAPI.get()
      .then(res => { if (res.data.data) setSmtp(p => ({ ...p, ...res.data.data })) })
      .catch(err => console.error('Failed to load settings:', err))
      .finally(() => setLoading(false))
  }, [])

  const showMsg = (text: string, type: 'ok' | 'err') => {
    setMessage(text); setMsgType(type)
    setTimeout(() => setMessage(''), 3500)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setSmtp(s => ({ ...s, [e.target.name]: e.target.value }))

  const handleSave = async () => {
    setSaving(true)
    try {
      await settingsAPI.update(smtp)
      showMsg('Pengaturan berhasil disimpan. Gunakan Kirim Email Tes untuk validasi SMTP.', 'ok')
    } catch (err: any) {
      showMsg(err.response?.data?.message || 'Gagal menyimpan pengaturan.', 'err')
    } finally { setSaving(false) }
  }

  const handleTestEmail = async () => {
    if (!testEmail) { showMsg('Masukkan alamat email tujuan tes.', 'err'); return }
    setTestLoading(true)
    setTestResult(null)
    try {
      await settingsAPI.testEmail(testEmail)
      const text = `Email tes berhasil dikirim ke ${testEmail}. Cek Inbox atau Spam/Junk folder.`
      setTestResult({ type: 'ok', text })
      showMsg(text, 'ok')
    } catch (err: any) {
      const text = err.response?.data?.message || 'Gagal mengirim email tes. Cek host, port, username, password, dan enkripsi SMTP.'
      setTestResult({ type: 'err', text })
      showMsg(text, 'err')
    } finally { setTestLoading(false) }
  }

  const smtpConfigured = !!(smtp.smtp_host && smtp.smtp_port && smtp.smtp_user && smtp.smtp_pass)

  if (loading) return <div className="p-6 text-sm text-[#888]">Memuat pengaturan...</div>

  return (
    <div className="p-6 space-y-5">

      {/* Nama Aplikasi */}
      <div className="bg-white rounded-xl border border-[#e2e8f0] p-5">
        <p className="text-sm font-bold text-[#111] mb-1">Nama Aplikasi</p>
        <p className="text-[11px] text-[#aaa] mb-4">Ditampilkan di sidebar admin sebagai identitas platform.</p>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className={labelCls}>Nama Aplikasi</label>
            <input name="app_name" value={smtp.app_name} onChange={handleChange}
              placeholder="Contoh: BengkelPro, AutoCare System..."
              className={inputCls} />
          </div>
          <div className="flex items-end">
            <button onClick={handleSave} disabled={saving}
              className="rounded bg-[#1E4FD8] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1A45BF] disabled:opacity-50 transition">
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </div>
        {smtp.app_name && (
          <div className="mt-3 flex items-center gap-2 text-[12px] text-[#555]">
            <span className="text-[#aaa]">Preview sidebar:</span>
            <span className="text-xl font-bold text-[#1E4FD8]">◈</span>
            <span className="font-bold text-[#111]">{smtp.app_name}</span>
          </div>
        )}
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-[#e2e8f0] p-4">
          <p className="text-[11px] text-[#888] font-medium">SMTP Host</p>
          <p className="text-sm font-bold text-[#111] mt-1 truncate">{smtp.smtp_host || '—'}</p>
          <p className="text-[11px] text-[#aaa] mt-0.5">port: {smtp.smtp_port || '—'}</p>
        </div>
        <div className="bg-white rounded-xl border border-[#e2e8f0] p-4">
          <p className="text-[11px] text-[#888] font-medium">Status SMTP</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={`w-2 h-2 rounded-full ${smtpConfigured ? 'bg-[#22c55e]' : 'bg-[#f59e0b]'}`} />
            <p className={`text-sm font-bold ${smtpConfigured ? 'text-[#15803d]' : 'text-[#b45309]'}`}>
              {smtpConfigured ? 'Terkonfigurasi' : 'Belum diset'}
            </p>
          </div>
          <p className="text-[11px] text-[#aaa] mt-0.5">{smtpConfigured ? 'Email siap dikirim' : 'Isi form di bawah'}</p>
        </div>
        <div className="bg-white rounded-xl border border-[#e2e8f0] p-4">
          <p className="text-[11px] text-[#888] font-medium">Enkripsi</p>
          <p className="text-sm font-bold text-[#111] mt-1">{smtp.smtp_secure === 'true' ? 'TLS (Aman)' : 'STARTTLS'}</p>
          <p className="text-[11px] text-[#aaa] mt-0.5">{smtp.smtp_from_name || 'Nama pengirim belum diset'}</p>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`flex items-start gap-3 rounded-xl border px-5 py-4 shadow-sm ${msgType === 'ok' ? 'bg-[#ecfdf5] border-[#86efac] text-[#166534]' : 'bg-[#fef2f2] border-[#fca5a5] text-[#991b1b]'}`}>
          <span>{msgType === 'ok' ? '✓' : '!'}</span> {message}
        </div>
      )}

      <div className="bg-white rounded-xl border border-[#e2e8f0] overflow-hidden">
        <div className="px-5 py-3 border-b border-[#e2e8f0]">
          <p className="text-[11px] text-[#888] font-medium uppercase tracking-wide">Security</p>
          <h2 className="text-base font-bold text-[#111] mt-0.5">Ubah Password</h2>
        </div>
        <div className="px-5 py-5">
          <ChangePasswordForm />
        </div>
      </div>

      {/* SMTP Form */}
      <div className="bg-white rounded-xl border border-[#e2e8f0] overflow-hidden">
        <div className="px-5 py-3 border-b border-[#e2e8f0]">
          <p className="text-[11px] text-[#888] font-medium uppercase tracking-wide">Email</p>
          <h2 className="text-base font-bold text-[#111] mt-0.5">Konfigurasi SMTP</h2>
        </div>
        <div className="px-5 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>SMTP Host *</label>
              <input type="text" name="smtp_host" className={inputCls} placeholder="smtp.gmail.com"
                value={smtp.smtp_host} onChange={handleChange} />
            </div>
            <div>
              <label className={labelCls}>SMTP Port *</label>
              <input type="text" name="smtp_port" className={inputCls} placeholder="587"
                value={smtp.smtp_port} onChange={handleChange} />
            </div>
            <div>
              <label className={labelCls}>Username *</label>
              <input type="text" name="smtp_user" className={inputCls} placeholder="email@gmail.com"
                value={smtp.smtp_user} onChange={handleChange} />
            </div>
            <div>
              <label className={labelCls}>Password *</label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} name="smtp_pass"
                  className={inputCls + ' pr-24'} placeholder="App password"
                  value={smtp.smtp_pass} onChange={handleChange} />
                <button type="button" onClick={() => setShowPass(p => !p)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[#888] hover:text-[#555] border border-[#e2e8f0] rounded px-2 py-0.5 bg-white">
                  {showPass ? 'Sembunyikan' : 'Tampilkan'}
                </button>
              </div>
            </div>
            <div>
              <label className={labelCls}>From Email</label>
              <input type="email" name="smtp_from_email" className={inputCls} placeholder="noreply@workshop.id"
                value={smtp.smtp_from_email} onChange={handleChange} />
            </div>
            <div>
              <label className={labelCls}>From Name</label>
                  <input type="text" name="smtp_from_name" className={inputCls} placeholder="WorkshopMu"
                value={smtp.smtp_from_name} onChange={handleChange} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Enkripsi</label>
              <select name="smtp_secure" className={inputCls} value={smtp.smtp_secure} onChange={handleChange}>
                <option value="true">TLS (Port 465 — Aman)</option>
                <option value="false">STARTTLS (Port 587)</option>
              </select>
            </div>
          </div>

          <div className="pt-1">
            <button onClick={handleSave} disabled={saving}
              className="bg-[#1E4FD8] hover:bg-[#1A45BF] text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition disabled:opacity-40">
              {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
            </button>
          </div>
        </div>
      </div>

      {/* Test Email */}
      <div className="bg-white rounded-xl border border-[#e2e8f0] overflow-hidden">
        <div className="px-5 py-3 border-b border-[#e2e8f0]">
          <p className="text-[11px] text-[#888] font-medium uppercase tracking-wide">Test</p>
          <h2 className="text-base font-bold text-[#111] mt-0.5">Kirim Email Tes</h2>
        </div>
        <div className="px-5 py-5 space-y-3">
          <p className="text-sm text-[#555]">
            Verifikasi konfigurasi SMTP dengan mengirim email percobaan. Pastikan pengaturan sudah disimpan terlebih dahulu.
          </p>
          <div className="flex gap-2">
            <input type="email" className={inputCls} placeholder="tujuan@email.com"
              value={testEmail} onChange={e => setTestEmail(e.target.value)} />
            <button onClick={handleTestEmail} disabled={testLoading || !smtpConfigured}
              className="flex-shrink-0 bg-[#1E4FD8] hover:bg-[#1A45BF] text-white text-sm font-semibold px-4 py-2 rounded-lg transition disabled:opacity-40 whitespace-nowrap">
              {testLoading ? 'Mengirim...' : 'Kirim Tes'}
            </button>
          </div>
          {!smtpConfigured && (
            <p className="text-[11px] text-[#f59e0b]">⚠ SMTP belum dikonfigurasi. Isi dan simpan form di atas terlebih dahulu.</p>
          )}
          {testResult && (
            <div className={`rounded-xl border px-4 py-3 text-sm font-semibold ${testResult.type === 'ok' ? 'border-[#86efac] bg-[#ecfdf5] text-[#166534]' : 'border-[#fca5a5] bg-[#fef2f2] text-[#991b1b]'}`}>
              {testResult.text}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
