import { useState, useEffect } from 'react'
import { tenantSettingsAPI } from '../services/api'

const DAYS = [
  { key: 'senin',  label: 'Senin' },
  { key: 'selasa', label: 'Selasa' },
  { key: 'rabu',   label: 'Rabu' },
  { key: 'kamis',  label: 'Kamis' },
  { key: 'jumat',  label: 'Jumat' },
  { key: 'sabtu',  label: 'Sabtu' },
  { key: 'minggu', label: 'Minggu' },
]

interface Schedule {
  days: string[]
  startTime: string
  endTime: string
}

const DEFAULT: Schedule = {
  days: ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'],
  startTime: '08:00',
  endTime: '17:00',
}

function workingHours(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return (eh * 60 + em - sh * 60 - sm) / 60
}

export default function JamOperasionalPage() {
  const [schedule, setSchedule] = useState<Schedule>(DEFAULT)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    tenantSettingsAPI.get('operating_schedule')
      .then(res => {
        if (res.data.data) setSchedule(res.data.data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const toggleDay = (key: string) => {
    setSchedule(s => ({
      ...s,
      days: s.days.includes(key) ? s.days.filter(d => d !== key) : [...s.days, key],
    }))
  }

  const handleSave = async () => {
    if (schedule.days.length === 0) { setError('Pilih minimal 1 hari operasional.'); return }
    if (schedule.startTime >= schedule.endTime) { setError('Jam buka harus lebih awal dari jam tutup.'); return }
    setError('')
    setSaving(true)
    try {
      await tenantSettingsAPI.set('operating_schedule', schedule)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {
      setError('Gagal menyimpan. Coba lagi.')
    } finally {
      setSaving(false)
    }
  }

  const hours = workingHours(schedule.startTime, schedule.endTime)

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <p className="text-[13px] text-[#aaa]">Memuat pengaturan...</p>
    </div>
  )

  return (
    <div className="p-6 max-w-xl space-y-6">
      <div>
        <h1 className="text-lg font-bold text-[#111]">Jam Operasional</h1>
        <p className="text-[12px] text-[#888] mt-0.5">
          Digunakan sebagai referensi perhitungan SLA waktu pengerjaan.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-[#fecaca] bg-[#fee2e2] px-4 py-3 text-sm text-[#dc2626]">
          {error}
        </div>
      )}

      {/* Hari operasional */}
      <div className="rounded-xl border border-[#e2e8f0] bg-white p-5 space-y-4">
        <p className="text-sm font-bold text-[#111]">Hari Operasional</p>
        <div className="flex flex-wrap gap-2">
          {DAYS.map(d => {
            const active = schedule.days.includes(d.key)
            return (
              <button
                key={d.key}
                onClick={() => toggleDay(d.key)}
                className={`rounded-lg px-4 py-2 text-[13px] font-semibold border transition ${
                  active
                    ? 'bg-[#1E4FD8] text-white border-[#1E4FD8]'
                    : 'bg-white text-[#555] border-[#e2e8f0] hover:border-[#1E4FD8] hover:text-[#1E4FD8]'
                }`}
              >
                {d.label}
              </button>
            )
          })}
        </div>
        <p className="text-[11px] text-[#aaa]">
          {schedule.days.length > 0
            ? `${schedule.days.length} hari/minggu — ${DAYS.filter(d => schedule.days.includes(d.key)).map(d => d.label).join(', ')}`
            : 'Belum ada hari dipilih'}
        </p>
      </div>

      {/* Jam kerja */}
      <div className="rounded-xl border border-[#e2e8f0] bg-white p-5 space-y-4">
        <p className="text-sm font-bold text-[#111]">Jam Kerja</p>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="block text-[11px] font-semibold text-[#555] mb-1">Jam Buka</label>
            <input
              type="time"
              value={schedule.startTime}
              onChange={e => setSchedule(s => ({ ...s, startTime: e.target.value }))}
              className="w-full rounded-lg border border-[#cbd5e1] bg-white px-3 py-2.5 text-sm text-[#111] outline-none focus:border-[#1E4FD8] focus:ring-2 focus:ring-[#dbeafe]"
            />
          </div>
          <div className="pt-5 text-[#aaa] font-bold">→</div>
          <div className="flex-1">
            <label className="block text-[11px] font-semibold text-[#555] mb-1">Jam Tutup</label>
            <input
              type="time"
              value={schedule.endTime}
              onChange={e => setSchedule(s => ({ ...s, endTime: e.target.value }))}
              className="w-full rounded-lg border border-[#cbd5e1] bg-white px-3 py-2.5 text-sm text-[#111] outline-none focus:border-[#1E4FD8] focus:ring-2 focus:ring-[#dbeafe]"
            />
          </div>
        </div>
        {hours > 0 && (
          <div className="flex items-center gap-2 rounded-lg bg-[#f8fafc] border border-[#e2e8f0] px-4 py-2.5">
            <span className="text-base">⏱</span>
            <p className="text-[13px] text-[#555]">
              <span className="font-bold text-[#111]">{hours} jam</span> kerja per hari ·{' '}
              <span className="font-bold text-[#111]">{(hours * schedule.days.length).toFixed(0)} jam</span> per minggu
            </p>
          </div>
        )}
      </div>

      {/* Ringkasan */}
      <div className="rounded-xl border border-[#dbeafe] bg-[#EEF3FE] p-4">
        <p className="text-[12px] text-[#1E4FD8]">
          💡 Setting ini digunakan di dashboard SLA untuk menghitung waktu pengerjaan hanya dalam jam kerja —
          waktu di luar jam operasional tidak dihitung.
        </p>
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving}
        className={`w-full rounded-xl py-3 text-sm font-bold transition disabled:opacity-40 ${
          saved
            ? 'bg-[#dcfce7] text-[#16a34a] border border-[#bbf7d0]'
            : 'bg-[#1E4FD8] text-white hover:bg-[#1A45BF]'
        }`}
      >
        {saving ? 'Menyimpan...' : saved ? '✓ Tersimpan' : 'Simpan Pengaturan'}
      </button>
    </div>
  )
}
