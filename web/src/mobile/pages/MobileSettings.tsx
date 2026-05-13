import { useEffect, useState } from 'react'
import { tenantSettingsAPI } from '../../services/api'
import ChangePasswordForm from '../../components/ChangePasswordForm'
import { MobileSubHeader } from '../MobileLayout'

const inputCls = 'w-full rounded-xl border border-[#cbd5e1] bg-white px-3 py-2.5 text-[13px] text-ink outline-none focus:border-[#1E4FD8]'
const labelCls = 'mb-1 block text-[11px] font-semibold text-[#475569]'
const helpCls = 'mt-1 text-[10px] leading-relaxed text-ink-4'
const dayOptions = [
  ['senin', 'Senin'],
  ['selasa', 'Selasa'],
  ['rabu', 'Rabu'],
  ['kamis', 'Kamis'],
  ['jumat', 'Jumat'],
  ['sabtu', 'Sabtu'],
  ['minggu', 'Minggu'],
]

export default function MobileSettings() {
  const [workshopName, setWorkshopName] = useState('')
  const [jamKerja, setJamKerja] = useState('8')
  const [days, setDays] = useState<string[]>(['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'])
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('17:00')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    Promise.all([
      tenantSettingsAPI.get('workshop_name').catch(() => null),
      tenantSettingsAPI.get('jam_kerja_per_hari').catch(() => null),
      tenantSettingsAPI.get('operating_schedule').catch(() => null),
    ]).then(([nameRes, jamRes, scheduleRes]) => {
      const name = nameRes?.data?.data
      const jam = jamRes?.data?.data
      const schedule = scheduleRes?.data?.data
      // workshop_name: tersimpan sebagai {value: "..."} atau string langsung
      if (name) setWorkshopName(typeof name === 'string' ? name : (name.value ?? ''))
      // jam_kerja: tersimpan sebagai {value: 8} atau number langsung
      if (jam != null) setJamKerja(String(typeof jam === 'object' ? (jam.value ?? 8) : jam))
      if (schedule?.days) setDays(schedule.days)
      if (schedule?.startTime) setStartTime(schedule.startTime)
      if (schedule?.endTime) setEndTime(schedule.endTime)
    })
  }, [])

  const toggleDay = (day: string) => {
    setDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])
  }

  const save = async () => {
    setSaving(true)
    setMessage('')
    try {
      await Promise.all([
        tenantSettingsAPI.set('workshop_name', { value: workshopName }),
        tenantSettingsAPI.set('jam_kerja_per_hari', { value: Number(jamKerja) || 8 }),
        tenantSettingsAPI.set('operating_schedule', { days, startTime, endTime }),
      ])
      setMessage('Pengaturan tersimpan ✓')
      setTimeout(() => setMessage(''), 2500)
    } catch (e: any) {
      setMessage('Gagal menyimpan: ' + (e?.response?.data?.message || e?.message || 'Coba lagi'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <MobileSubHeader title="Pengaturan" subtitle="Workshop dan jam operasional" />
      <div className="space-y-3 px-4 pt-3 pb-6">
        {message && (
          <div className="rounded-2xl border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-3 text-[12px] font-semibold text-[#15803d]">
            {message}
          </div>
        )}
        <section className="rounded-2xl border border-wm-line bg-white p-4 space-y-3">
          <p className="text-[13px] font-bold text-ink">Workshop</p>
          <div>
            <label className={labelCls}>Nama Workshop</label>
            <input value={workshopName} onChange={e => setWorkshopName(e.target.value)} placeholder="Nama workshop" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Jam Kerja per Hari</label>
            <div className="flex items-center gap-2">
              <input type="number" min={1} max={24} value={jamKerja} onChange={e => setJamKerja(e.target.value)} placeholder="8" className={inputCls + ' flex-1'} />
              <span className="shrink-0 rounded-xl bg-wm-bg px-3 py-2.5 text-[12px] font-bold text-ink-3">jam</span>
            </div>
            <p className={helpCls}>Dipakai untuk hitung SLA dan durasi paket dalam satuan hari kerja.</p>
          </div>
        </section>
        <section className="rounded-2xl border border-wm-line bg-white p-4 space-y-3">
          <p className="text-[13px] font-bold text-ink">Jam Operasional</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Buka</label>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Tutup</label>
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className={inputCls} />
            </div>
          </div>
          <p className={labelCls}>Hari Operasional</p>
          <div className="grid grid-cols-2 gap-2">
            {dayOptions.map(([key, label]) => (
              <button key={key} onClick={() => toggleDay(key)} className={`rounded-xl border px-3 py-2 text-[12px] font-bold ${days.includes(key) ? 'border-[#1E4FD8] bg-brand-50 text-brand' : 'border-wm-line bg-white text-ink-3'}`}>
                {label}
              </button>
            ))}
          </div>
        </section>
        <section className="rounded-2xl border border-wm-line bg-white p-4 space-y-3">
          <div>
            <p className="text-[13px] font-bold text-ink">Keamanan Akun</p>
            <p className={helpCls}>Ubah password akun yang sedang login.</p>
          </div>
          <ChangePasswordForm variant="mobile" />
        </section>
        <button onClick={save} disabled={saving} className="w-full rounded-2xl bg-brand py-3 text-[14px] font-bold text-white disabled:opacity-60">
          {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
        </button>
      </div>
    </>
  )
}
