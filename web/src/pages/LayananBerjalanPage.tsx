import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { registrationsAPI, serviceMaterialsAPI, teknisiAPI } from '../services/api'

type Status = 'ANTRI' | 'PROSES' | 'QC' | 'SELESAI'

const STEPS: Status[] = ['ANTRI', 'PROSES', 'QC', 'SELESAI']
const STEP_COLOR: Record<Status, string> = {
  ANTRI:   '#f59e0b',
  PROSES:  '#1E4FD8',
  QC:      '#8b5cf6',
  SELESAI: '#16a34a',
}
const DB_TO_STATUS: Record<string, Status> = {
  confirmed:   'ANTRI',
  in_progress: 'PROSES',
  qc_check:    'QC',
  completed:   'SELESAI',
}
const STATUS_TO_DB: Record<Status, string> = {
  ANTRI:   'confirmed',
  PROSES:  'in_progress',
  QC:      'qc_check',
  SELESAI: 'completed',
}

interface Teknisi { id: string; name: string }
interface LayananItem {
  id: string          // registration id
  customer: string
  plat: string
  kendaraan: string
  layanan: string
  status: Status
  mulai: string
  mulaiTimestamp: string
  teknisi: Teknisi[]
  notes: string
}

function parseTeknisi(notes?: string): Teknisi[] {
  const m = notes?.match(/(?:^|\|)teknisi:([^|]+)/)
  if (!m) return []
  return m[1].split(',').map((name, i) => ({ id: `api-t${i}`, name: name.trim() }))
}

function MiniProgress({ status, onAdvance }: { status: Status; onAdvance: (next: Status) => void }) {
  const curIdx = STEPS.indexOf(status)
  return (
    <div className="flex items-center gap-1">
      {STEPS.map((step, i) => {
        const isCompleted = i < curIdx
        const isCurrent   = i === curIdx
        const isNext      = i === curIdx + 1
        const color = STEP_COLOR[step]
        return (
          <div key={step} className="flex items-center gap-1">
            <button onClick={() => isNext && onAdvance(step)} disabled={!isNext}
              title={isNext ? `→ ${step}` : undefined}
              className={`h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold transition-all flex-shrink-0 ${isNext ? 'cursor-pointer hover:scale-125' : 'cursor-default'}`}
              style={{
                background: isCompleted || isCurrent ? color : '#e2e8f0',
                color: isCompleted || isCurrent ? '#fff' : '#bbb',
                boxShadow: isCurrent ? `0 0 0 2px ${color}44` : isNext ? `0 1px 4px ${color}66` : undefined,
              }}>
              {isCompleted ? '✓' : i + 1}
            </button>
            {i < STEPS.length - 1 && (
              <div className="w-4 h-0.5 rounded-full"
                style={{ background: i < curIdx ? STEP_COLOR[STEPS[i]] : '#e2e8f0' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function LayananBerjalanPage() {
  const { tenant } = useAuth()
  const navigate = useNavigate()
  const [items, setItems]               = useState<LayananItem[]>([])
  const [loading, setLoading]           = useState(true)
  const [allTeknisi, setAllTeknisi]     = useState<Teknisi[]>([])
  const [editTeknisiId, setEditTeknisiId] = useState<string | null>(null)
  const [selectedTeknisi, setSelectedTeknisi] = useState<string[]>([])
  const [doneConfirmId, setDoneConfirmId] = useState<string | null>(null)
  const [statusConfirm, setStatusConfirm] = useState<{ id: string; next: Status } | null>(null)
  const [saving, setSaving]             = useState(false)
  const [hppResult, setHppResult]       = useState<{ hpp: number; deducted: { nama: string; qty: number }[] } | null>(null)
  const [stockAlert, setStockAlert]     = useState<{ shortages: any[] } | null>(null)
  const [cancelConfirm, setCancelConfirm] = useState<LayananItem | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [rescheduleItem, setRescheduleItem] = useState<LayananItem | null>(null)
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [rescheduleTime, setRescheduleTime] = useState('')

  // ── Fetch active registrations ──
  const fetchItems = useCallback(async () => {
    if (!tenant?.id) return
    try {
      setLoading(true)
      const res = await registrationsAPI.list(tenant.id)
      const regs: any[] = res.data.data || []

      const active = regs
        .filter(r => ['confirmed', 'in_progress', 'qc_check'].includes(r.status))
        .map(r => {
          const checkinTime = r.updatedAt || r.createdAt
          const mulaiDate = new Date(checkinTime)
          const mulai = mulaiDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
          const mulaiTimestamp = mulaiDate.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
          return {
            id: r.id,
            customer: r.customer?.name || 'Pelanggan',
            plat: r.licensePlate || '—',
            kendaraan: r.vehicleName || '—',
            layanan: r.workshop?.title || 'Layanan',
            status: DB_TO_STATUS[r.status] || 'ANTRI',
            mulai,
            mulaiTimestamp,
            teknisi: parseTeknisi(r.notes),
            notes: r.notes || '',
          } as LayananItem
        })
        .sort((a, b) => {
          const order: Record<Status, number> = { PROSES: 0, QC: 1, ANTRI: 2, SELESAI: 3 }
          return order[a.status] - order[b.status]
        })

      setItems(active)
    } catch (err) {
      console.error('Failed to fetch layanan:', err)
    } finally { setLoading(false) }
  }, [tenant?.id])

  useEffect(() => { fetchItems() }, [fetchItems])

  useEffect(() => {
    teknisiAPI.list().then(res => {
      const list = res.data.data || []
      setAllTeknisi(list.filter((t: any) => t.status === 'aktif').map((t: any) => ({ id: t.id, name: t.name })))
    }).catch(() => {})
  }, [])

  // ── Advance status ──
  const advance = async (id: string, next: Status) => {
    if (next === 'SELESAI') { setDoneConfirmId(id); return }
    setStatusConfirm({ id, next })
  }

  const confirmAdvance = async () => {
    if (!statusConfirm) return
    const { id, next } = statusConfirm
    setSaving(true)
    try {
      if (next === 'PROSES') {
        const availabilityRes = await serviceMaterialsAPI.availability(id)
        const availability = availabilityRes.data.data
        if (availability?.shortages?.length > 0) {
          setStockAlert({ shortages: availability.shortages })
          setSaving(false)
          return
        }
      }
      await registrationsAPI.update(id, { tenantId: tenant!.id, status: STATUS_TO_DB[next] })
      setItems(prev => prev.map(item => item.id === id ? { ...item, status: next } : item))
      setStatusConfirm(null)
    } catch (err) { console.error('Advance failed:', err) }
    finally { setSaving(false) }
  }

  // ── Cancel booking ──
  const confirmCancel = async () => {
    if (!cancelConfirm || !tenant?.id) return
    setSaving(true)
    try {
      await registrationsAPI.update(cancelConfirm.id, {
        tenantId: tenant.id,
        status: 'cancelled',
        notes: cancelReason ? `cancel:${cancelReason}` : undefined,
      })
      setItems(prev => prev.filter(i => i.id !== cancelConfirm.id))
      setCancelConfirm(null)
      setCancelReason('')
    } catch (err) { console.error('Cancel failed:', err) }
    finally { setSaving(false) }
  }

  // ── Reschedule ──
  const confirmReschedule = async () => {
    if (!rescheduleItem || !tenant?.id || !rescheduleDate) return
    setSaving(true)
    try {
      const dt = rescheduleTime
        ? new Date(`${rescheduleDate}T${rescheduleTime}`).toISOString()
        : new Date(`${rescheduleDate}T08:00`).toISOString()
      await registrationsAPI.update(rescheduleItem.id, {
        tenantId: tenant.id,
        scheduledDate: dt,
        status: 'confirmed',
      })
      setRescheduleItem(null)
      setRescheduleDate('')
      setRescheduleTime('')
      await fetchItems()
    } catch (err) { console.error('Reschedule failed:', err) }
    finally { setSaving(false) }
  }

  // ── Mark done + hitung HPP + deduct stok ──
  const markDone = async (id: string) => {
    setSaving(true)
    try {
      let hpp = 0, deducted: { nama: string; qty: number }[] = []
      try {
        const hppRes = await serviceMaterialsAPI.calculate(id)
        hpp = hppRes.data?.hpp || 0
        deducted = hppRes.data?.deducted || []
      } catch {
        // HPP calculation gagal — lanjut tandai selesai tanpa deduct
      }
      await registrationsAPI.update(id, { tenantId: tenant!.id, status: 'completed' })
      setItems(prev => prev.filter(item => item.id !== id))
      setHppResult({ hpp, deducted })
    } catch (err) { console.error('Mark done failed:', err) }
    finally { setSaving(false); setDoneConfirmId(null) }
  }

  // ── Edit teknisi ──
  const openEditTeknisi = (item: LayananItem) => {
    setEditTeknisiId(item.id)
    setSelectedTeknisi(item.teknisi.map(t => t.name))
  }

  const saveTeknisi = async () => {
    if (!editTeknisiId) return
    const item = items.find(i => i.id === editTeknisiId)
    // Pertahankan dp: dari notes lama
    const existingDp = item?.notes?.match(/(?:^|\|)(dp:\d+(?:\.\d+)?)/i)?.[1]
    const teknisiPart = selectedTeknisi.length > 0 ? `teknisi:${selectedTeknisi.join(',')}` : ''
    const notes = existingDp
      ? (teknisiPart ? `${teknisiPart}|${existingDp}` : existingDp)
      : teknisiPart
    setSaving(true)
    try {
      await registrationsAPI.update(editTeknisiId, { tenantId: tenant!.id, notes })
      setItems(prev => prev.map(item =>
        item.id === editTeknisiId
          ? { ...item, teknisi: selectedTeknisi.map((n, i) => ({ id: `t${i}`, name: n })), notes }
          : item
      ))
    } catch (err) { console.error('Save teknisi failed:', err) }
    finally { setSaving(false); setEditTeknisiId(null) }
  }

  const toggleTeknisi = (name: string) =>
    setSelectedTeknisi(prev => prev.includes(name) ? prev.filter(t => t !== name) : [...prev, name])

  const stats = [
    { label: 'Antri',  value: items.filter(i => i.status === 'ANTRI').length,  color: '#f59e0b' },
    { label: 'Proses', value: items.filter(i => i.status === 'PROSES').length, color: '#1E4FD8' },
    { label: 'QC',     value: items.filter(i => i.status === 'QC').length,     color: '#8b5cf6' },
  ]

  return (
    <div className="p-6 space-y-4">

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {stats.map(s => (
          <div key={s.label} className="rounded-lg border border-wm-line bg-white px-4 py-3 flex items-center gap-3">
            <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
            <p className="text-[12px] text-[#888]">{s.label}</p>
            <p className="ml-auto text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Stock shortage modal */}
      {stockAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg border border-wm-line bg-white p-5 shadow-xl">
            <p className="text-base font-bold text-[#dc2626] mb-1">Stok Tidak Cukup</p>
            <p className="text-[12px] text-[#888] mb-4">Material berikut belum mencukupi:</p>
            <div className="space-y-2 mb-5">
              {stockAlert.shortages.map((s: any, i: number) => (
                <div key={i} className="flex items-center justify-between rounded-lg bg-[#fef2f2] border border-[#fecaca] px-3 py-2">
                  <span className="text-[12px] font-semibold text-[#111]">{s.nama}</span>
                  <div className="text-right">
                    <p className="text-[11px] font-bold text-[#dc2626]">Kurang {Number(s.shortage).toLocaleString('id-ID')} {s.satuan}</p>
                    <p className="text-[10px] text-[#aaa]">Stok {Number(s.stock).toLocaleString('id-ID')} {s.satuan}</p>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setStockAlert(null)}
              className="w-full rounded bg-[#dc2626] py-2 text-sm font-semibold text-white hover:bg-[#b91c1c]">
              Mengerti
            </button>
          </div>
        </div>
      )}

      {/* HPP Result Modal */}
      {hppResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg border border-wm-line bg-white p-5 shadow-xl">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">✅</span>
              <p className="text-sm font-bold text-[#111]">Layanan Selesai</p>
            </div>
            <div className="mb-4 rounded-lg border border-[#D9E3FC] bg-brand-50 px-3 py-2.5">
              <p className="text-[12px] font-semibold text-[#1e40af]">Pembayaran belum otomatis lunas.</p>
              <p className="mt-0.5 text-[11px] text-[#475569]">
                Silakan cek halaman Penjualan untuk konfirmasi nominal pembayaran dan update status invoice.
              </p>
            </div>
            {hppResult.deducted.length > 0 ? (
              <>
                <p className="text-[12px] text-[#888] mb-3">Stok material otomatis dikurangi:</p>
                <div className="space-y-1.5 mb-4">
                  {hppResult.deducted.map((d, i) => (
                    <div key={i} className="flex justify-between text-[12px]">
                      <span className="text-[#555]">{d.nama}</span>
                      <span className="font-semibold text-[#f59e0b]">−{d.qty}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center px-3 py-2 rounded bg-[#fffbeb] border border-[#fde68a]">
                  <span className="text-[12px] font-semibold text-[#92400e]">Total HPP</span>
                  <span className="text-sm font-bold text-[#f59e0b]">
                    Rp {Math.round(hppResult.hpp).toLocaleString('id-ID')}
                  </span>
                </div>
              </>
            ) : (
              <p className="text-[12px] text-[#aaa] mb-4">BOM belum di-setup untuk layanan ini. HPP tidak dihitung.</p>
            )}
            <div className="mt-4 flex gap-2">
              <button onClick={() => setHppResult(null)}
                className="flex-1 rounded border border-wm-line py-2 text-sm text-[#555] hover:bg-[#f8fafc] transition">
                Nanti
              </button>
              <button onClick={() => { setHppResult(null); navigate('/admin/sales') }}
                className="flex-1 rounded bg-brand py-2 text-sm font-semibold text-white hover:bg-brand-600 transition">
                Cek Penjualan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal teknisi */}
      {editTeknisiId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xs rounded-lg border border-wm-line bg-white p-5 shadow-xl">
            <p className="text-sm font-bold text-[#111] mb-3">Pilih Teknisi</p>
            <div className="space-y-1.5 mb-4">
              {allTeknisi.map(t => (
                <label key={t.id} className="flex items-center gap-2.5 cursor-pointer rounded border border-wm-line px-3 py-2 hover:bg-[#f8fafc]">
                  <input type="checkbox" checked={selectedTeknisi.includes(t.name)}
                    onChange={() => toggleTeknisi(t.name)} className="h-3.5 w-3.5 accent-[#1E4FD8]" />
                  <span className="text-[12px] text-[#111]">{t.name}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={saveTeknisi} disabled={saving}
                className="flex-1 rounded bg-brand py-1.5 text-sm font-semibold text-white hover:bg-brand-600 transition disabled:opacity-40">
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
              <button onClick={() => setEditTeknisiId(null)}
                className="flex-1 rounded border border-wm-line py-1.5 text-sm text-[#555] hover:bg-[#f8fafc] transition">
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm pindah status */}
      {statusConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xs rounded-lg border border-wm-line bg-white p-5 shadow-xl">
            {(() => {
              const item = items.find(row => row.id === statusConfirm.id)
              return (
                <>
                  <p className="text-sm font-bold text-[#111]">Ubah Status?</p>
                  <p className="mt-1 text-[12px] text-[#666]">
                    {item?.customer || 'Layanan'} akan dipindahkan ke status <span className="font-bold text-brand">{statusConfirm.next}</span>.
                  </p>
                </>
              )
            })()}
            <div className="mt-4 flex gap-2">
              <button onClick={confirmAdvance} disabled={saving}
                className="flex-1 rounded bg-brand py-1.5 text-sm font-semibold text-white hover:bg-brand-600 transition disabled:opacity-40">
                {saving ? 'Menyimpan...' : 'Ya, Ubah'}
              </button>
              <button onClick={() => setStatusConfirm(null)} disabled={saving}
                className="flex-1 rounded border border-wm-line py-1.5 text-sm text-[#555] hover:bg-[#f8fafc] transition disabled:opacity-40">
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm selesai */}
      {doneConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xs rounded-lg border border-wm-line bg-white p-5 shadow-xl">
            <p className="text-sm font-bold text-[#111]">Tandai Selesai?</p>
            <p className="mt-1 text-[12px] text-[#666]">Layanan akan masuk ke riwayat dan muncul di Penjualan sebagai belum lunas sampai status pembayaran diupdate.</p>
            <div className="mt-4 flex gap-2">
              <button onClick={() => markDone(doneConfirmId)} disabled={saving}
                className="flex-1 rounded bg-[#16a34a] py-1.5 text-sm font-semibold text-white hover:bg-[#15803d] transition disabled:opacity-40">
                {saving ? 'Menyimpan...' : 'Selesai'}
              </button>
              <button onClick={() => setDoneConfirmId(null)}
                className="flex-1 rounded border border-wm-line py-1.5 text-sm text-[#555] hover:bg-[#f8fafc] transition">
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel confirm modal */}
      {cancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg border border-wm-line bg-white p-6 shadow-xl">
            <p className="text-base font-bold text-[#dc2626] mb-1">Batalkan Booking?</p>
            <p className="text-[13px] text-[#111] font-semibold">{cancelConfirm.customer}</p>
            <p className="text-[12px] text-[#888] mb-4">{cancelConfirm.layanan} · {cancelConfirm.plat}</p>
            <div className="mb-4">
              <label className="block text-[11px] font-semibold text-[#555] mb-1">Alasan pembatalan <span className="text-[#aaa] font-normal">(opsional)</span></label>
              <input
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && confirmCancel()}
                placeholder="Misal: customer tidak jadi datang"
                className="w-full rounded border border-[#cbd5e1] px-3 py-2 text-sm outline-none focus:border-[#dc2626] transition"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={confirmCancel} disabled={saving}
                className="flex-1 rounded bg-[#dc2626] py-2 text-sm font-semibold text-white hover:bg-[#b91c1c] disabled:opacity-50 transition">
                {saving ? 'Membatalkan...' : 'Ya, Batalkan'}
              </button>
              <button onClick={() => { setCancelConfirm(null); setCancelReason('') }} disabled={saving}
                className="flex-1 rounded border border-wm-line py-2 text-sm text-[#555] hover:bg-[#f8fafc] transition">
                Tidak
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule modal */}
      {rescheduleItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg border border-wm-line bg-white p-6 shadow-xl">
            <p className="text-base font-bold text-[#111] mb-1">Jadwal Ulang</p>
            <p className="text-[13px] text-[#111] font-semibold">{rescheduleItem.customer}</p>
            <p className="text-[12px] text-[#888] mb-4">{rescheduleItem.layanan} · {rescheduleItem.plat}</p>
            <div className="space-y-3 mb-5">
              <div>
                <label className="block text-[11px] font-semibold text-[#555] mb-1">Tanggal baru <span className="text-[#dc2626]">*</span></label>
                <input type="date" value={rescheduleDate} onChange={e => setRescheduleDate(e.target.value)}
                  className="w-full rounded border border-[#cbd5e1] px-3 py-2 text-sm outline-none focus:border-brand transition" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#555] mb-1">Jam <span className="text-[#aaa] font-normal">(opsional)</span></label>
                <input type="time" value={rescheduleTime} onChange={e => setRescheduleTime(e.target.value)}
                  className="w-full rounded border border-[#cbd5e1] px-3 py-2 text-sm outline-none focus:border-brand transition" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={confirmReschedule} disabled={saving || !rescheduleDate}
                className="flex-1 rounded bg-brand py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50 transition">
                {saving ? 'Menyimpan...' : 'Simpan Jadwal'}
              </button>
              <button onClick={() => { setRescheduleItem(null); setRescheduleDate(''); setRescheduleTime('') }} disabled={saving}
                className="flex-1 rounded border border-wm-line py-2 text-sm text-[#555] hover:bg-[#f8fafc] transition">
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border border-wm-line bg-white overflow-hidden">
        <div className="flex items-center justify-between px-5 py-2.5 bg-[#f8fafc] border-b border-[#f1f5f9]">
          <div className="grid grid-cols-[1.2fr_1fr_1.4fr_1.8fr_1fr_0.8fr] flex-1 gap-0">
            {['Pelanggan', 'Layanan', 'Teknisi', 'Progress', 'Mulai Progress', 'Aksi'].map((h, i) => (
              <p key={h} className={`text-[11px] font-bold text-[#888] ${i >= 3 ? 'text-center' : ''}`}>{h}</p>
            ))}
          </div>
          <button onClick={fetchItems}
            className="text-[11px] text-brand hover:underline ml-4 flex-shrink-0">
            ↻ Refresh
          </button>
        </div>

        {loading ? (
          <p className="px-5 py-8 text-center text-[12px] text-[#aaa]">Memuat data...</p>
        ) : items.length === 0 ? (
          <p className="px-5 py-8 text-center text-[12px] text-[#aaa]">
            Tidak ada layanan berjalan. Lakukan check-in booking dari dashboard.
          </p>
        ) : (
          items.map(item => {
            const curIdx = STEPS.indexOf(item.status)
            const nextStatus = STEPS[curIdx + 1] as Status | undefined
            return (
              <div key={item.id}
                className="grid grid-cols-[1.2fr_1fr_1.4fr_1.8fr_1fr_0.8fr] items-center px-5 py-3 border-b border-[#f1f5f9] last:border-b-0 hover:bg-[#fafbfc]">
                <div>
                  <p className="text-[12px] font-semibold text-[#111]">{item.customer}</p>
                  <p className="text-[10px] text-[#aaa]">{item.plat}</p>
                  {item.kendaraan !== '—' && <p className="text-[10px] text-[#888]">{item.kendaraan}</p>}
                </div>
                <p className="text-[12px] text-[#555]">{item.layanan}</p>
                <div>
                  {item.teknisi.length === 0 ? (
                    <button onClick={() => openEditTeknisi(item)}
                      className="text-[11px] text-brand hover:underline">+ Assign</button>
                  ) : (
                    <div className="flex flex-wrap gap-1 items-center">
                      {item.teknisi.map(t => (
                        <span key={t.id} className="inline-block px-1.5 py-0.5 rounded-full bg-[#dbeafe] text-[10px] text-brand">
                          {t.name.split(' ')[0]}
                        </span>
                      ))}
                      <button onClick={() => openEditTeknisi(item)}
                        className="text-[10px] text-[#aaa] hover:text-brand">✎</button>
                    </div>
                  )}
                </div>
                <div className="flex justify-center">
                  <MiniProgress status={item.status} onAdvance={(next) => advance(item.id, next)} />
                </div>
                <div className="min-w-0 text-center">
                  <p className="text-[11px] font-semibold text-[#555]">{item.mulai}</p>
                  <p className="text-[10px] text-[#888] truncate">{item.mulaiTimestamp}</p>
                </div>
                <div className="flex flex-col gap-1 items-center">
                  {nextStatus && (
                    <button onClick={() => advance(item.id, nextStatus)} disabled={saving}
                      className="px-2.5 py-1 rounded text-[10px] font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
                      style={{ background: STEP_COLOR[nextStatus] }}>
                      → {nextStatus}
                    </button>
                  )}
                  {item.status === 'ANTRI' && (
                    <div className="flex gap-1">
                      <button onClick={() => { setRescheduleItem(item); setRescheduleDate(''); setRescheduleTime('') }}
                        className="px-2 py-0.5 rounded border border-wm-line text-[9px] text-[#555] hover:bg-[#f8fafc] transition">
                        Jadwal Ulang
                      </button>
                      <button onClick={() => { setCancelConfirm(item); setCancelReason('') }}
                        className="px-2 py-0.5 rounded border border-[#fecaca] text-[9px] text-[#dc2626] hover:bg-[#fee2e2] transition">
                        Batalkan
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
