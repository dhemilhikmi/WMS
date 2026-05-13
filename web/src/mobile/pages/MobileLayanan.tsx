import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { registrationsAPI, serviceMaterialsAPI, teknisiAPI } from '../../services/api'

type Status = 'ANTRI' | 'PROSES' | 'QC' | 'SELESAI'
const STEPS: Status[] = ['ANTRI', 'PROSES', 'QC', 'SELESAI']
const COLOR: Record<Status, string> = {
  ANTRI: '#f59e0b',
  PROSES: '#1E4FD8',
  QC: '#8b5cf6',
  SELESAI: '#16a34a',
}
const DB_TO_STATUS: Record<string, Status> = {
  confirmed: 'ANTRI',
  in_progress: 'PROSES',
  qc_check: 'QC',
  completed: 'SELESAI',
}
const STATUS_TO_DB: Record<Status, string> = {
  ANTRI: 'confirmed',
  PROSES: 'in_progress',
  QC: 'qc_check',
  SELESAI: 'completed',
}

interface Item {
  id: string
  customer: string
  plat: string
  kendaraan: string
  layanan: string
  status: Status
  mulai: string
  mulaiTimestamp: string
  teknisi: string[]
  notes: string
}

interface Teknisi {
  id: string
  name: string
  spesialis: string[]
}
type TeknisiLoad = { active: number; status: 'available' | 'light' | 'busy' }

function parseTeknisi(notes?: string): string[] {
  const match = notes?.match(/^teknisi:([^|]+)/)
  return match ? match[1].split(',').map(t => t.trim()).filter(Boolean) : []
}

export default function MobileLayanan() {
  const { tenant } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState<Item[]>([])
  const [teknisi, setTeknisi] = useState<Teknisi[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Status | 'ALL'>('ALL')
  const [finishConfirm, setFinishConfirm] = useState<{ id: string } | null>(null)
  const [statusConfirm, setStatusConfirm] = useState<{ item: Item; next: Status } | null>(null)
  const [checkIn, setCheckIn] = useState<Item | null>(null)
  const [selectedTeknisi, setSelectedTeknisi] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [hppResult, setHppResult] = useState<{ hpp: number; deducted: { nama: string; qty: number }[] } | null>(null)

  const fetch = useCallback(async () => {
    if (!tenant?.id) return
    setLoading(true)
    try {
      const res = await registrationsAPI.list(tenant.id)
      const regs: any[] = res.data.data || []
      setItems(regs
        .filter(r => ['confirmed', 'in_progress', 'qc_check'].includes(r.status))
        .map(r => {
          const mulaiDate = new Date(r.updatedAt || r.createdAt)
          return {
            id: r.id,
            customer: r.customer?.name || '-',
            plat: r.licensePlate || '-',
            kendaraan: r.vehicleName || '',
            layanan: r.workshop?.title || '-',
            status: DB_TO_STATUS[r.status] || 'ANTRI',
            mulai: mulaiDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
            mulaiTimestamp: mulaiDate.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
            teknisi: parseTeknisi(r.notes),
            notes: r.notes || '',
          }
        }))
    } finally {
      setLoading(false)
    }
  }, [tenant?.id])

  useEffect(() => { fetch() }, [fetch])

  useEffect(() => {
    teknisiAPI.list('aktif')
      .then(res => setTeknisi((res.data.data || []).map((t: any) => ({ id: t.id, name: t.name, spesialis: t.spesialis || [] }))))
      .catch(() => setTeknisi([]))
  }, [])

  const advance = async (item: Item, next: Status) => {
    if (next === 'PROSES') {
      setCheckIn(item)
      setSelectedTeknisi(item.teknisi || [])
      return
    }
    if (next === 'SELESAI') {
      setFinishConfirm({ id: item.id })
      return
    }
    setStatusConfirm({ item, next })
  }

  const confirmAdvance = async () => {
    if (!statusConfirm) return
    const { item, next } = statusConfirm
    setSaving(true)
    try {
      await registrationsAPI.update(item.id, { tenantId: tenant!.id, status: STATUS_TO_DB[next] })
      setStatusConfirm(null)
      fetch()
    } catch {
      alert('Gagal update status')
    } finally {
      setSaving(false)
    }
  }

  const toggleTeknisi = (name: string) => {
    setSelectedTeknisi(prev => prev.includes(name) ? prev.filter(t => t !== name) : [...prev, name])
  }

  const confirmCheckIn = async () => {
    if (!checkIn || selectedTeknisi.length === 0) return
    setSaving(true)
    try {
      const availabilityRes = await serviceMaterialsAPI.availability(checkIn.id)
      const availability = availabilityRes.data.data
      if (availability?.shortages?.length > 0) {
        alert('Stok belum cukup:\n' + availability.shortages.map((s: any) => `${s.nama}: kurang ${Number(s.shortage).toLocaleString('id-ID')} ${s.satuan}`).join('\n'))
        return
      }
      const existingDp = checkIn.notes?.match(/(?:^|\|)(dp:\d+(?:\.\d+)?)/i)?.[1]
      const teknisiPart = `teknisi:${selectedTeknisi.join(',')}`
      const mergedNotes = existingDp ? `${teknisiPart}|${existingDp}` : teknisiPart
      await registrationsAPI.update(checkIn.id, {
        tenantId: tenant!.id,
        status: 'in_progress',
        notes: mergedNotes,
      })
      setCheckIn(null)
      setSelectedTeknisi([])
      fetch()
    } catch {
      alert('Gagal menerima customer')
    } finally {
      setSaving(false)
    }
  }

  const finishJob = async () => {
    if (!finishConfirm) return
    setSaving(true)
    try {
      const hppRes = await serviceMaterialsAPI.calculate(finishConfirm.id)
      const { hpp = 0, deducted = [] } = hppRes.data || {}
      await registrationsAPI.update(finishConfirm.id, { tenantId: tenant!.id, status: 'completed' })
      setFinishConfirm(null)
      setHppResult({ hpp, deducted })
      fetch()
    } catch {
      alert('Gagal selesaikan')
    } finally {
      setSaving(false)
    }
  }

  const counts = STEPS.reduce((acc, s) => {
    acc[s] = items.filter(i => i.status === s).length
    return acc
  }, {} as Record<Status, number>)
  const teknisiLoad = useMemo(() => {
    const map: Record<string, { active: number }> = {}
    teknisi.forEach(t => { map[t.name] = { active: 0 } })
    items.forEach(item => {
      if (!['PROSES', 'QC'].includes(item.status)) return
      item.teknisi.forEach(name => {
        if (!map[name]) map[name] = { active: 0 }
        map[name].active += 1
      })
    })
    const min = Math.min(...Object.values(map).map(v => v.active), 0)
    return Object.fromEntries(Object.entries(map).map(([name, data]) => [
      name,
      { active: data.active, status: data.active === 0 ? 'available' : data.active === min ? 'light' : 'busy' },
    ])) as Record<string, TeknisiLoad>
  }, [items, teknisi])
  const filtered = filter === 'ALL' ? items : items.filter(i => i.status === filter)

  return (
    <div className="px-4 pt-3 space-y-3">
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4" style={{ scrollbarWidth: 'none' }}>
        <Chip active={filter === 'ALL'} onClick={() => setFilter('ALL')} label={`Semua (${items.length})`} color="#475569" />
        {STEPS.filter(s => s !== 'SELESAI').map(s => (
          <Chip key={s} active={filter === s} onClick={() => setFilter(s)} label={`${s} (${counts[s]})`} color={COLOR[s]} />
        ))}
      </div>

      {loading && <p className="text-center text-[12px] text-ink-4 py-6">Memuat...</p>}
      {!loading && filtered.length === 0 && (
        <div className="bg-white rounded-2xl border border-wm-line p-8 text-center">
          <p className="text-[13px] text-[#666]">Tidak ada layanan {filter !== 'ALL' ? `dengan status ${filter}` : 'aktif'}</p>
        </div>
      )}

      <div className="space-y-2.5">
        {filtered.map(it => {
          const idx = STEPS.indexOf(it.status)
          const nextStatus = STEPS[idx + 1]
          return (
            <div key={it.id} className="bg-white rounded-2xl border border-wm-line p-3.5">
              <div className="flex items-start justify-between gap-3 mb-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-bold truncate">{it.customer}</p>
                  <p className="text-[11px] text-ink-4">{it.plat} - {it.kendaraan || it.layanan}</p>
                </div>
                <span className="text-[9px] font-bold px-2 py-1 rounded-full flex-shrink-0" style={{ background: COLOR[it.status] + '22', color: COLOR[it.status] }}>
                  {it.status}
                </span>
              </div>

              <div className="mb-2.5">
                <p className="text-[11px] text-[#666]">{it.mulai} - {it.layanan}</p>
                <p className="text-[10px] text-ink-4">Mulai Progress: {it.mulaiTimestamp}</p>
              </div>

              {it.teknisi.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2.5">
                  {it.teknisi.map(t => (
                    <span key={t} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand-50 text-brand">{t}</span>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between gap-1 mb-3">
                {STEPS.map((step, i) => (
                  <div key={step} className="flex items-center flex-1">
                    <div className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                      style={{ background: i <= idx ? COLOR[step] : '#e2e8f0', color: i <= idx ? '#fff' : '#aaa' }}>
                      {i < idx ? '✓' : i + 1}
                    </div>
                    {i < STEPS.length - 1 && <div className="flex-1 h-0.5 mx-1 rounded" style={{ background: i < idx ? COLOR[step] : '#e2e8f0' }} />}
                  </div>
                ))}
              </div>

              {nextStatus && (
                <button onClick={() => advance(it, nextStatus)} disabled={saving} className="w-full bg-brand text-white text-[13px] font-semibold py-2.5 rounded-xl disabled:opacity-50">
                  {nextStatus === 'PROSES' ? 'Terima Customer' : `Lanjut ke ${nextStatus}`}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {statusConfirm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end" onClick={() => setStatusConfirm(null)}>
          <div className="bg-white w-full rounded-t-3xl p-5 pb-8" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-[#e2e8f0] rounded-full mx-auto mb-4" />
            <p className="text-[16px] font-bold text-center mb-2">Ubah status?</p>
            <p className="text-[12px] text-[#666] text-center mb-5">
              {statusConfirm.item.customer} akan dipindahkan ke status <span className="font-bold text-brand">{statusConfirm.next}</span>.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setStatusConfirm(null)} disabled={saving} className="flex-1 bg-wm-bg text-ink-3 text-[14px] font-semibold py-3 rounded-xl disabled:opacity-50">Batal</button>
              <button onClick={confirmAdvance} disabled={saving} className="flex-1 bg-brand text-white text-[14px] font-semibold py-3 rounded-xl disabled:opacity-50">
                {saving ? 'Menyimpan...' : 'Ya, Ubah'}
              </button>
            </div>
          </div>
        </div>
      )}

      {checkIn && (
        <TeknisiSheet
          title="Terima Customer"
          subtitle={`${checkIn.customer} - ${checkIn.layanan}`}
          teknisi={teknisi}
          loads={teknisiLoad}
          selected={selectedTeknisi}
          onToggle={toggleTeknisi}
          onClose={() => setCheckIn(null)}
          onConfirm={confirmCheckIn}
          saving={saving}
        />
      )}

      {finishConfirm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end" onClick={() => setFinishConfirm(null)}>
          <div className="bg-white w-full rounded-t-3xl p-5 pb-8" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-[#e2e8f0] rounded-full mx-auto mb-4" />
            <p className="text-[16px] font-bold text-center mb-2">Selesaikan layanan?</p>
            <p className="text-[12px] text-[#666] text-center mb-5">Stok material akan dikurangi otomatis sesuai BOM. Pembayaran tidak otomatis lunas.</p>
            <div className="flex gap-2">
              <button onClick={() => setFinishConfirm(null)} className="flex-1 bg-wm-bg text-ink-3 text-[14px] font-semibold py-3 rounded-xl">Batal</button>
              <button onClick={finishJob} disabled={saving} className="flex-1 bg-[#16a34a] text-white text-[14px] font-semibold py-3 rounded-xl disabled:opacity-50">
                {saving ? 'Menyimpan...' : 'Ya, Selesaikan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {hppResult && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end" onClick={() => setHppResult(null)}>
          <div className="bg-white w-full rounded-t-3xl p-5 pb-8" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-[#e2e8f0] rounded-full mx-auto mb-4" />
            <p className="text-[16px] font-bold text-center mb-2">Material Keluar</p>
            <div className="mb-4 rounded-2xl border border-[#D9E3FC] bg-brand-50 px-3 py-2.5">
              <p className="text-[12px] font-semibold text-[#1e40af]">Pembayaran belum otomatis lunas.</p>
              <p className="mt-0.5 text-[11px] text-[#475569]">
                Cek halaman Penjualan untuk konfirmasi nominal pembayaran dan update status invoice.
              </p>
            </div>
            {hppResult.deducted.length === 0 ? (
              <p className="text-[12px] text-[#666] text-center mb-5">Layanan ini belum punya setup BOM, jadi tidak ada stok material yang dikurangi.</p>
            ) : (
              <>
                <p className="text-[12px] text-[#666] text-center mb-4">Stok otomatis dikurangi sesuai BOM.</p>
                <div className="space-y-2 mb-4">
                  {hppResult.deducted.map((d, i) => (
                    <div key={i} className="flex items-center justify-between rounded-xl bg-wm-bg px-3 py-2">
                      <span className="text-[12px] font-semibold text-ink">{d.nama}</span>
                      <span className="text-[12px] font-bold text-[#dc2626]">-{d.qty}</span>
                    </div>
                  ))}
                </div>
                <div className="rounded-xl bg-brand-50 px-3 py-2 mb-4 flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-[#1e40af]">HPP Material</span>
                  <span className="text-[13px] font-bold text-[#1A45BF]">Rp {Math.round(hppResult.hpp).toLocaleString('id-ID')}</span>
                </div>
              </>
            )}
            <div className="flex gap-2">
              <button onClick={() => setHppResult(null)} className="flex-1 bg-wm-bg text-ink-3 text-[14px] font-semibold py-3 rounded-xl">
                Nanti
              </button>
              <button onClick={() => { setHppResult(null); navigate('/m/lainnya/penjualan') }} className="flex-1 bg-brand text-white text-[14px] font-semibold py-3 rounded-xl">
                Cek Penjualan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TeknisiSheet({
  title,
  subtitle,
  teknisi,
  loads,
  selected,
  onToggle,
  onClose,
  onConfirm,
  saving,
}: {
  title: string
  subtitle: string
  teknisi: Teknisi[]
  loads: Record<string, TeknisiLoad>
  selected: string[]
  onToggle: (name: string) => void
  onClose: () => void
  onConfirm: () => void
  saving: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end" onClick={onClose}>
      <div className="bg-white w-full rounded-t-3xl p-5 pb-8 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 bg-[#e2e8f0] rounded-full mx-auto mb-4" />
        <p className="text-[16px] font-bold text-center mb-1">{title}</p>
        <p className="text-[12px] text-[#666] text-center mb-4">{subtitle}</p>
        <p className="text-[11px] font-semibold text-ink-3 mb-2">Pilih Teknisi</p>
        <div className="space-y-2 mb-5">
          {teknisi.length === 0 && <p className="text-[12px] text-ink-4 text-center py-3">Belum ada teknisi aktif</p>}
          {[...teknisi].sort((a, b) => (loads[a.name]?.active || 0) - (loads[b.name]?.active || 0)).map(t => (
            <button
              key={t.id}
              onClick={() => onToggle(t.name)}
              className="w-full text-left rounded-xl border px-3 py-2.5"
              style={selected.includes(t.name) ? { borderColor: '#1E4FD8', background: '#EEF3FE' } : { borderColor: '#e2e8f0' }}
            >
              <div className="flex items-start gap-2">
                <span className="mt-0.5 h-4 w-4 rounded border flex-shrink-0 flex items-center justify-center text-[10px]"
                  style={selected.includes(t.name) ? { background: '#1E4FD8', borderColor: '#1E4FD8', color: '#fff' } : { borderColor: '#cbd5e1' }}>
                  {selected.includes(t.name) ? '✓' : ''}
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-ink">{t.name}</p>
                  {t.spesialis.length > 0 && <p className="text-[10px] text-ink-4 mt-0.5">{t.spesialis.join(', ')}</p>}
                  <TeknisiLoadMini load={loads[t.name] || { active: 0, status: 'available' }} />
                </div>
              </div>
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 bg-wm-bg text-ink-3 text-[14px] font-semibold py-3 rounded-xl">Batal</button>
          <button onClick={onConfirm} disabled={selected.length === 0 || saving} className="flex-1 bg-brand text-white text-[14px] font-semibold py-3 rounded-xl disabled:opacity-40">
            {saving ? 'Menyimpan...' : 'Mulai Proses'}
          </button>
        </div>
      </div>
    </div>
  )
}

function TeknisiLoadMini({ load }: { load: TeknisiLoad }) {
  const badge = load.status === 'available'
    ? { text: 'Available', bg: '#dcfce7', color: '#16a34a' }
    : load.status === 'light'
      ? { text: 'Kurang job', bg: '#EEF3FE', color: '#1E4FD8' }
      : { text: 'Sibuk', bg: '#fef3c7', color: '#b45309' }
  return (
    <div className="mt-1 flex items-center gap-1.5">
      <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: badge.bg, color: badge.color }}>{badge.text}</span>
      <span className="rounded-full bg-wm-bg px-2 py-0.5 text-[10px] text-ink-3">{load.active} aktif</span>
    </div>
  )
}

function Chip({ label, active, onClick, color }: { label: string; active: boolean; onClick: () => void; color: string }) {
  return (
    <button onClick={onClick} className="text-[12px] font-semibold px-3 py-1.5 rounded-full whitespace-nowrap transition flex-shrink-0"
      style={{ background: active ? color : '#fff', color: active ? '#fff' : '#666', border: `1px solid ${active ? color : '#e2e8f0'}` }}>
      {label}
    </button>
  )
}
