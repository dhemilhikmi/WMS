import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { registrationsAPI } from '../services/api'

const DAY_NAMES = ['M', 'S', 'S', 'R', 'K', 'J', 'S']
const HOURS = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00']

const STATUS_STYLE: Record<string, { color: string; border: string; label: string }> = {
  pending:     { color: '#fef9c3', border: '#ca8a04', label: 'Pending' },
  confirmed:   { color: '#dbeafe', border: '#1E4FD8', label: 'Antri' },
  in_progress: { color: '#e0e7ff', border: '#6366f1', label: 'Proses' },
  qc_check:    { color: '#f3e8ff', border: '#8b5cf6', label: 'QC' },
  completed:   { color: '#dcfce7', border: '#16a34a', label: 'Selesai' },
  cancelled:   { color: '#fee2e2', border: '#ef4444', label: 'Batal' },
}

const MONTH_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

interface Booking {
  id: string
  label: string
  status: string
  top: number
  height: number
  scheduledDate: string
}

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function getTimeTop(scheduledDate: string, index: number): number {
  const d = new Date(scheduledDate)
  let hour = d.getHours()
  let minute = d.getMinutes()
  if (hour < 8) {
    hour = 8 + Math.floor(index * 1.5)
    minute = (index % 2) * 30
    if (hour > 16) hour = 16
  }
  return (hour - 8) * 60 + minute
}

function readInitialDate(searchParams: URLSearchParams): Date {
  const tanggal = searchParams.get('tanggal')
  if (tanggal) {
    const parsed = new Date(`${tanggal}T00:00:00`)
    if (!Number.isNaN(parsed.getTime())) return parsed
  }

  const bulan = Number(searchParams.get('bulan'))
  const tahun = Number(searchParams.get('tahun'))
  if (Number.isInteger(bulan) && bulan >= 1 && bulan <= 12 && Number.isInteger(tahun) && tahun >= 2000 && tahun <= 2100) {
    return new Date(tahun, bulan - 1, 1)
  }

  return new Date()
}

export default function BookingTimelinePage() {
  const { tenant } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialDate = readInitialDate(searchParams)
  const today = new Date()
  const [calYear, setCalYear]   = useState(initialDate.getFullYear())
  const [calMonth, setCalMonth] = useState(initialDate.getMonth())
  const [selectedDate, setSelectedDate] = useState(initialDate.getDate())
  const [allRegs, setAllRegs]   = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [activeView, setActiveView] = useState<'Timeline' | 'List'>('Timeline')
  const navigate = useNavigate()

  const fetchRegs = useCallback(async () => {
    if (!tenant?.id) return
    try {
      setLoading(true)
      const res = await registrationsAPI.list(tenant.id)
      setAllRegs(res.data.data || [])
    } catch (err) {
      console.error('Failed to fetch registrations:', err)
    } finally {
      setLoading(false)
    }
  }, [tenant?.id])

  useEffect(() => { fetchRegs() }, [fetchRegs])

  useEffect(() => {
    const next = new URLSearchParams(searchParams)
    next.set('tanggal', toDateKey(new Date(calYear, calMonth, selectedDate)))
    next.set('bulan', String(calMonth + 1))
    next.set('tahun', String(calYear))
    setSearchParams(next, { replace: true })
  }, [calYear, calMonth, selectedDate])

  // Calendar navigation
  const prevMonth = () => {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11) }
    else setCalMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0) }
    else setCalMonth(m => m + 1)
  }

  // Build calendar grid
  const firstDay = new Date(calYear, calMonth, 1).getDay() // 0=Sun
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
  // Shift so Mon=0
  const startOffset = (firstDay + 6) % 7

  // Dates that have bookings in current month
  const bookedDates = new Set<number>()
  allRegs.forEach((r: any) => {
    const d = new Date(r.scheduledDate || r.createdAt)
    if (d.getFullYear() === calYear && d.getMonth() === calMonth) {
      bookedDates.add(d.getDate())
    }
  })

  // Bookings for selected date
  const selectedKey = toDateKey(new Date(calYear, calMonth, selectedDate))
  const dayRegs = allRegs.filter((r: any) => {
    const d = new Date(r.scheduledDate || r.createdAt)
    return toDateKey(d) === selectedKey
  })

  const bookings: Booking[] = dayRegs.map((r: any, idx: number) => {
    return {
      id: r.id,
      label: `${r.customer?.name || 'Pelanggan'} — ${r.workshop?.title || 'Layanan'}`,
      status: r.status,
      top: getTimeTop(r.scheduledDate || r.createdAt, idx),
      height: 75,
      scheduledDate: r.scheduledDate || r.createdAt,
    }
  })

  const todayKey = toDateKey(today)

  return (
    <div className="flex h-[calc(100vh-56px)]">
      {/* Left panel */}
      <div className="w-[280px] border-r border-[#e2e8f0] bg-white p-4 space-y-4 overflow-y-auto">
        <div>
          <h2 className="text-base font-bold text-[#111] mb-3">Jadwal Booking</h2>

          {/* Month nav */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-[#888]">{MONTH_NAMES[calMonth]} {calYear}</p>
            <div className="flex gap-1">
              <button onClick={prevMonth} className="h-7 w-7 rounded hover:bg-[#f8fafc] text-[#888] text-sm">‹</button>
              <button onClick={nextMonth} className="h-7 w-7 rounded hover:bg-[#f8fafc] text-[#888] text-sm">›</button>
            </div>
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-0.5">
            {DAY_NAMES.map((d, i) => (
              <div key={i} className="text-center text-[10px] text-[#aaa] py-1">{d}</div>
            ))}
            {Array.from({ length: startOffset }, (_, i) => (
              <div key={`e${i}`} />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1
              const isSelected = day === selectedDate
              const isToday = toDateKey(new Date(calYear, calMonth, day)) === todayKey
              const hasBooking = bookedDates.has(day)
              return (
                <button key={day} onClick={() => setSelectedDate(day)}
                  className={`relative text-center py-1.5 rounded text-[11px] transition ${
                    isSelected
                      ? 'bg-[#1E4FD8] text-white font-semibold'
                      : isToday
                      ? 'border border-[#1E4FD8] text-[#1E4FD8] font-semibold'
                      : hasBooking
                      ? 'bg-[#dbeafe] text-[#1E4FD8]'
                      : 'text-[#666] hover:bg-[#f8fafc]'
                  }`}>
                  {day}
                  {hasBooking && !isSelected && (
                    <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-[#1E4FD8] opacity-60" />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <hr className="border-[#e2e8f0]" />

        {/* Legend */}
        <div>
          <p className="text-[11px] font-bold text-[#888] mb-2">Status</p>
          <div className="space-y-1.5">
            {Object.entries(STATUS_STYLE).filter(([k]) => k !== 'cancelled').map(([, s]) => (
              <div key={s.label} className="flex items-center gap-2">
                <div className="h-3 w-3 rounded flex-shrink-0" style={{ background: s.color, border: `1px solid ${s.border}` }} />
                <p className="text-[11px] text-[#666]">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <hr className="border-[#e2e8f0]" />

        <button onClick={fetchRegs}
          className="w-full text-center text-[11px] text-[#1E4FD8] hover:underline py-1">
          ↻ Refresh Data
        </button>
      </div>

      {/* Right: Timeline / List */}
      <div className="flex-1 overflow-auto p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-[#111]">
            {selectedDate} {MONTH_NAMES[calMonth]} {calYear}
            <span className="ml-2 text-sm font-normal text-[#888]">
              {loading ? 'Memuat...' : `${dayRegs.length} Booking`}
            </span>
            <span className="ml-2 text-[11px] font-normal text-[#aaa]">
              /admin/sales/schedule?tanggal={toDateKey(new Date(calYear, calMonth, selectedDate))}
            </span>
          </h2>
          <div className="flex gap-1.5">
            <button onClick={() => navigate('/admin/sales/registration')}
              className="px-3 py-1.5 rounded bg-[#1E4FD8] text-white text-[12px] font-semibold hover:bg-[#1A45BF] transition">
              + Booking Baru
            </button>
            {(['Timeline', 'List'] as const).map((v) => (
              <button key={v} onClick={() => setActiveView(v)}
                className={`px-3 py-1.5 rounded border text-[12px] font-medium transition ${
                  activeView === v
                    ? 'bg-[#1E4FD8] text-white border-[#1E4FD8]'
                    : 'bg-white text-[#888] border-[#e2e8f0] hover:border-[#cbd5e1]'
                }`}>
                {v}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <p className="text-[13px] text-[#aaa]">Memuat data...</p>
          </div>
        ) : activeView === 'Timeline' ? (
          <div className="flex gap-0 bg-white rounded-lg border border-[#e2e8f0] p-4">
            {/* Time axis */}
            <div className="w-14 flex-shrink-0">
              {HOURS.map((t, i) => (
                <div key={i} className="h-[60px] flex items-start">
                  <span className="text-[10px] text-[#ccc]">{t}</span>
                </div>
              ))}
            </div>

            {/* Grid + bookings */}
            <div className="flex-1 relative border-l border-[#f1f5f9]">
              {HOURS.map((_, i) => (
                <div key={i} className="h-[60px] border-b border-dashed border-[#f1f5f9]" />
              ))}

              {bookings.length === 0 ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <p className="text-[12px] text-[#ccc]">Tidak ada booking pada tanggal ini</p>
                </div>
              ) : (
                bookings.map((b) => {
                  const style = STATUS_STYLE[b.status] || STATUS_STYLE.confirmed
                  return (
                    <div key={b.id}
                      className="absolute left-2 right-2 rounded px-2 py-1.5 overflow-hidden cursor-pointer hover:shadow-md transition"
                      style={{ top: b.top, height: b.height, background: style.color, border: `1.5px solid ${style.border}` }}>
                      <p className="text-[12px] font-bold leading-snug" style={{ color: style.border }}>{b.label}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: style.border, opacity: 0.7 }}>
                        {style.label} · {new Date(b.scheduledDate).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        ) : (
          /* List view */
          <div className="rounded-lg border border-[#e2e8f0] bg-white overflow-hidden">
            <div className="grid grid-cols-[1.2fr_1.2fr_1fr_1fr_0.8fr] px-5 py-2.5 bg-[#f8fafc] border-b border-[#f1f5f9]">
              {['Pelanggan', 'Layanan', 'Kendaraan', 'Waktu', 'Status'].map(h => (
                <p key={h} className="text-[11px] font-bold text-[#888]">{h}</p>
              ))}
            </div>
            {dayRegs.length === 0 ? (
              <p className="px-5 py-8 text-center text-[12px] text-[#aaa]">Tidak ada booking pada tanggal ini</p>
            ) : (
              dayRegs.map((r: any) => {
                const style = STATUS_STYLE[r.status] || STATUS_STYLE.confirmed
                return (
                  <div key={r.id} className="grid grid-cols-[1.2fr_1.2fr_1fr_1fr_0.8fr] items-center px-5 py-3 border-b border-[#f1f5f9] last:border-b-0 hover:bg-[#fafbfc]">
                    <div>
                      <p className="text-[12px] font-semibold text-[#111]">{r.customer?.name || '—'}</p>
                      <p className="text-[10px] text-[#aaa]">{r.customer?.phone || ''}</p>
                    </div>
                    <p className="text-[12px] text-[#555]">{r.workshop?.title || '—'}</p>
                    <div>
                      <p className="text-[12px] text-[#555]">{r.vehicleName || '—'}</p>
                      <p className="text-[10px] text-[#aaa]">{r.licensePlate || ''}</p>
                    </div>
                    <p className="text-[11px] text-[#888]">
                      {new Date(r.scheduledDate || r.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold w-fit"
                      style={{ background: style.color, color: style.border }}>
                      {style.label}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>
    </div>
  )
}
