import { useState, useEffect } from 'react'
import { teknisiAPI, registrationsAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'

interface Teknisi {
  id: string
  name: string
  phone: string
  spesialis: string[]
  status: 'aktif' | 'cuti' | 'nonaktif'
}

const DEFAULT_SPESIALIS = ['Detailing', 'PPF', 'Coating', 'Poles', 'Interior', 'Ceramic', 'Cuci Mobil', 'Engine Bay']

const BAR_COLORS = ['#1E4FD8', '#3b82f6', '#60a5fa', '#93c5fd', '#D9E3FC']

function parseTeknisiNames(notes?: string): string[] {
  const m = notes?.match(/^teknisi:([^|]+)/)
  if (!m) return []
  return m[1].split(',').map(n => n.trim()).filter(Boolean)
}

function statusStyle(status: string) {
  if (status === 'aktif') return { bg: '#dcfce7', fg: '#16a34a' }
  if (status === 'cuti') return { bg: '#fef3c7', fg: '#f59e0b' }
  return { bg: '#f1f5f9', fg: '#888' }
}

const inputClass = 'w-full rounded border border-[#cbd5e1] bg-white px-3 py-2 text-sm text-[#111] outline-none focus:border-brand focus:ring-2 focus:ring-[#dbeafe] transition'
const labelClass = 'block text-[11px] font-semibold text-[#555] mb-1'

function SpesialisInput({ selected, onChange, allOptions, onAddOption }: {
  selected: string[]
  onChange: (v: string[]) => void
  allOptions: string[]
  onAddOption: (v: string) => void
}) {
  const [newVal, setNewVal] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const toggle = (s: string) =>
    onChange(selected.includes(s) ? selected.filter(x => x !== s) : [...selected, s])
  const handleAdd = () => {
    const val = newVal.trim()
    if (!val || allOptions.includes(val)) return
    onAddOption(val); onChange([...selected, val]); setNewVal(''); setShowAdd(false)
  }
  return (
    <div>
      <label className={labelClass}>Spesialisasi</label>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {allOptions.map(s => (
          <button key={s} type="button" onClick={() => toggle(s)}
            className="px-2.5 py-1 rounded-full text-[11px] font-medium border transition"
            style={selected.includes(s)
              ? { background: 'var(--wm-primary)', color: '#fff', borderColor: 'var(--wm-primary)' }
              : { background: '#fff', color: 'var(--wm-ink-3)', borderColor: 'var(--wm-line)' }}>
            {s}
          </button>
        ))}
        <button type="button" onClick={() => setShowAdd(!showAdd)}
          style={{ padding:'4px 10px', borderRadius:999, fontSize:11, fontWeight:500, border:'1.5px dashed var(--wm-primary)', color:'var(--wm-primary)', background:'transparent', cursor:'pointer' }}>
          + Lainnya
        </button>
      </div>
      {showAdd && (
        <div className="flex gap-2">
          <input value={newVal} onChange={e => setNewVal(e.target.value)} placeholder="Spesialisasi baru..."
            className="flex-1 rounded border border-[#cbd5e1] bg-white px-3 py-1.5 text-sm outline-none focus:border-brand"
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAdd())} />
          <button type="button" onClick={handleAdd}
            style={{ background:"var(--wm-primary)",color:"#fff",padding:"6px 12px",borderRadius:6,fontSize:14,fontWeight:600,border:"none",cursor:"pointer" }}>Tambah</button>
        </div>
      )}
    </div>
  )
}

const emptyForm = { name: '', phone: '', spesialis: [] as string[], status: 'aktif' as Teknisi['status'] }

export default function TekniisiPage() {
  const { tenant } = useAuth()
  const [teknisiList, setTeknisiList] = useState<Teknisi[]>([])
  const [rawRegs, setRawRegs]         = useState<any[]>([])
  const [loading, setLoading]         = useState(true)
  const [submitting, setSubmitting]   = useState(false)
  const [error, setError]             = useState('')
  const [spesialisList, setSpesialisList] = useState<string[]>(DEFAULT_SPESIALIS)
  const [showAdd, setShowAdd]         = useState(false)
  const [editingId, setEditingId]     = useState<string | null>(null)
  const [form, setForm]               = useState(emptyForm)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  useEffect(() => { fetchAll() }, [tenant?.id])

  const fetchAll = async () => {
    if (!tenant?.id) return
    try {
      setLoading(true)
      const [tekRes, regRes] = await Promise.all([
        teknisiAPI.list(),
        registrationsAPI.list(tenant.id),
      ])
      const list: Teknisi[] = tekRes.data.data || []
      setTeknisiList(list)
      setRawRegs(regRes.data.data || [])
      const allSpesialis = new Set(DEFAULT_SPESIALIS)
      list.forEach(t => t.spesialis.forEach(s => allSpesialis.add(s)))
      setSpesialisList(Array.from(allSpesialis))
    } catch { setError('Gagal memuat data teknisi') }
    finally { setLoading(false) }
  }

  const fetchTeknisi = async () => {
    try {
      const res = await teknisiAPI.list()
      const list: Teknisi[] = res.data.data || []
      setTeknisiList(list)
      const allSpesialis = new Set(DEFAULT_SPESIALIS)
      list.forEach(t => t.spesialis.forEach(s => allSpesialis.add(s)))
      setSpesialisList(Array.from(allSpesialis))
    } catch { setError('Gagal memuat data teknisi') }
  }

  const resetForm = () => { setForm(emptyForm); setShowAdd(false); setEditingId(null) }

  const openEdit = (t: Teknisi) => {
    setEditingId(t.id)
    setShowAdd(false)
    setForm({ name: t.name, phone: t.phone || '', spesialis: t.spesialis, status: t.status })
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      if (editingId) {
        await teknisiAPI.update(editingId, { name: form.name, phone: form.phone, spesialis: form.spesialis, status: form.status })
      } else {
        await teknisiAPI.create({ name: form.name, phone: form.phone, spesialis: form.spesialis, status: form.status })
      }
      resetForm()
      await fetchTeknisi()
    } catch { setError('Gagal menyimpan teknisi') }
    finally { setSubmitting(false) }
  }

  const handleDelete = async (id: string) => {
    setSubmitting(true)
    try {
      await teknisiAPI.delete(id)
      setDeleteConfirmId(null)
      await fetchTeknisi()
    } catch { setError('Gagal menghapus teknisi') }
    finally { setSubmitting(false) }
  }

  const aktif = teknisiList.filter(t => t.status === 'aktif').length
  const cuti  = teknisiList.filter(t => t.status === 'cuti').length

  const now = new Date()
  const [filterMonth, setFilterMonth] = useState(now.getMonth())
  const [filterYear, setFilterYear]   = useState(now.getFullYear())

  // Build year options from available registrations
  const availableYears = Array.from(new Set([
    now.getFullYear(),
    ...rawRegs.map((r: any) => new Date(r.updatedAt).getFullYear()),
  ])).sort((a, b) => b - a)
  if (!availableYears.includes(filterYear)) availableYears.unshift(filterYear)

  const MONTH_NAMES = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']

  // Performa Teknisi computation
  const todayStr = now.toDateString()
  const isFilteringCurrentMonth = filterMonth === now.getMonth() && filterYear === now.getFullYear()
  const teknisiJobMap: Record<string, { jobsToday: number; jobsMonth: number }> = {}
  teknisiList.forEach(t => { teknisiJobMap[t.name] = { jobsToday: 0, jobsMonth: 0 } })
  rawRegs.forEach((r: any) => {
    const names = parseTeknisiNames(r.notes)
    if (names.length === 0) return
    const d = new Date(r.updatedAt)
    const isToday = d.toDateString() === todayStr
    const isMonth = d.getMonth() === filterMonth && d.getFullYear() === filterYear
    names.forEach(name => {
      if (!teknisiJobMap[name]) teknisiJobMap[name] = { jobsToday: 0, jobsMonth: 0 }
      if (isFilteringCurrentMonth && isToday && ['in_progress', 'qc_check', 'completed'].includes(r.status)) teknisiJobMap[name].jobsToday++
      if (isMonth && r.status === 'completed') teknisiJobMap[name].jobsMonth++
    })
  })
  const realTeknisi = Object.entries(teknisiJobMap)
    .sort((a, b) => b[1].jobsMonth - a[1].jobsMonth)
    .slice(0, 5)
    .map(([name, data], i) => ({ name, ...data, color: BAR_COLORS[i] || '#D9E3FC' }))
  const maxJobsMonth = Math.max(realTeknisi[0]?.jobsMonth || 0, 1)

  return (
    <div className="p-6 space-y-5">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold" style={{ fontFamily: 'var(--wm-font-display)', color: 'var(--wm-ink)' }}>Teknisi</h1>
        <button
          onClick={() => { setShowAdd(!showAdd); setEditingId(null); setForm(emptyForm) }}
          style={{ background: 'var(--wm-primary)', color: '#fff', borderRadius: '10px', padding: '8px 16px', fontSize: '14px', fontWeight: 600, border: 'none', cursor: 'pointer' }}
        >
          {showAdd ? 'Tutup' : '+ Tambah Teknisi'}
        </button>
      </div>

      {/* Onboarding banner */}
      {!loading && teknisiList.length === 0 && (
        <div className="rounded-xl border border-[#D9E3FC] bg-brand-50 px-5 py-4 flex gap-4 items-start">
          <span className="text-2xl flex-shrink-0">👨‍🔧</span>
          <div>
            <p className="text-[14px] font-bold text-[#1e40af] mb-1">Belum ada teknisi terdaftar</p>
            <p className="text-[12px] text-[#3b82f6] leading-relaxed">
              Tambahkan teknisi bengkel Anda agar bisa di-assign ke setiap pekerjaan. Teknisi akan muncul sebagai pilihan saat buat booking, dan performanya bisa dipantau di laporan.
            </p>
            <ul className="mt-2 space-y-1 text-[11px] text-brand">
              <li>• Isi nama dan nomor HP (opsional)</li>
              <li>• Pilih spesialisasi (PPF, Coating, Detailing, dll.)</li>
              <li>• Status bisa diubah sewaktu-waktu (aktif / cuti)</li>
            </ul>
            <button onClick={() => setShowAdd(true)} style={{ marginTop:12, background:'var(--wm-primary)', color:'#fff', padding:'8px 16px', borderRadius:8, fontSize:12, fontWeight:700, border:'none', cursor:'pointer' }}>
              + Tambah Teknisi Pertama
            </button>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg border border-wm-line bg-white p-6 shadow-xl">
            <p className="text-base font-bold text-[#111]">Hapus Teknisi?</p>
            <p className="mt-2 text-sm text-[#666]">Data teknisi akan dihapus permanen.</p>
            <div className="mt-5 flex gap-2">
              <button onClick={() => handleDelete(deleteConfirmId)} disabled={submitting}
                className="flex-1 rounded bg-[#dc2626] py-2 text-sm font-semibold text-white hover:bg-[#b91c1c] disabled:opacity-50">
                {submitting ? 'Menghapus...' : 'Hapus'}
              </button>
              <button onClick={() => setDeleteConfirmId(null)}
                className="flex-1 rounded border border-wm-line py-2 text-sm text-[#555] hover:bg-[#f8fafc]">Batal</button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-[#fecaca] bg-[#fee2e2] px-4 py-3 text-sm text-[#dc2626]">{error}</div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-wm-line bg-white p-5">
          <p className="text-xs text-[#999]">Total Teknisi</p>
          <p className="mt-2 text-4xl font-bold text-[#111]">{teknisiList.length}</p>
        </div>
        <div className="rounded-lg border border-wm-line bg-white p-5">
          <p className="text-xs text-[#999]">Aktif</p>
          <p className="mt-2 text-4xl font-bold text-brand">{aktif}</p>
          {cuti > 0 && <p className="mt-1 text-xs text-[#f59e0b]">{cuti} cuti</p>}
        </div>
        <div className="rounded-lg border border-wm-line bg-white p-5">
          <p className="text-xs text-[#999]">Nonaktif</p>
          <p className="mt-2 text-4xl font-bold text-[#111]">{teknisiList.filter(t => t.status === 'nonaktif').length}</p>
        </div>
      </div>

      {/* Performa Teknisi */}
      <div className="rounded-lg border border-wm-line bg-white p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <p className="text-sm font-bold text-[#111]">Performa Teknisi</p>
          <div className="flex items-center gap-2">
            <select
              value={filterMonth}
              onChange={e => setFilterMonth(Number(e.target.value))}
              className="rounded border border-wm-line bg-white px-2 py-1 text-[12px] text-[#333] outline-none focus:border-brand">
              {MONTH_NAMES.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
            <select
              value={filterYear}
              onChange={e => setFilterYear(Number(e.target.value))}
              className="rounded border border-wm-line bg-white px-2 py-1 text-[12px] text-[#333] outline-none focus:border-brand">
              {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
        {realTeknisi.length === 0 || realTeknisi.every(t => t.jobsMonth === 0) ? (
          <p className="text-[12px] text-[#aaa] text-center py-4">Belum ada data teknisi bulan ini.</p>
        ) : (
          <div className="space-y-2.5">
            {realTeknisi.map((t, i) => (
              <div key={t.name} className="flex items-center gap-2">
                <span className="text-[10px] text-[#bbb] w-3">{i + 1}</span>
                <div className="h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: t.color + '33' }}>
                  <span className="text-[10px] font-bold" style={{ color: t.color }}>{t.name[0]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-0.5">
                    <p className="text-[11px] font-semibold text-[#111] truncate">{t.name.split(' ')[0]}</p>
                    {t.jobsToday > 0 && (
                      <p className="text-[10px] text-[#16a34a] font-semibold flex-shrink-0 ml-1">{t.jobsToday} hari ini</p>
                    )}
                  </div>
                  <div className="h-1.5 rounded-full bg-[#f1f5f9]">
                    <div className="h-1.5 rounded-full transition-all" style={{ width: `${Math.round((t.jobsMonth / maxJobsMonth) * 100)}%`, background: t.color }} />
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[11px] font-bold text-[#555]">{t.jobsMonth}</p>
                  <p className="text-[9px] text-[#aaa]">job/bln</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-wm-line bg-white overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#f1f5f9]">
          <div>
            <p className="text-sm font-bold text-[#111]">Daftar Teknisi</p>
            <p className="text-[11px] text-[#888] mt-0.5">Nama teknisi ini akan muncul di pilihan check-in</p>
          </div>
          <button onClick={() => { setShowAdd(!showAdd); setEditingId(null); setForm(emptyForm) }}
            style={{ background:"var(--wm-primary)",color:"#fff",padding:"8px 16px",borderRadius:6,fontSize:14,fontWeight:600,border:"none",cursor:"pointer" }}>
            {showAdd ? 'Tutup' : '+ Tambah Teknisi'}
          </button>
        </div>

        {showAdd && (
          <div className="px-5 py-4 border-b border-[#f1f5f9] bg-[#f8fafc]">
            <p className="text-[12px] font-bold text-[#111] mb-3">Tambah Teknisi Baru</p>
            <form onSubmit={handleSave} className="space-y-3">
              <div className="grid gap-3 md:grid-cols-3">
                <div><label className={labelClass}>Nama</label>
                  <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Nama teknisi" className={inputClass} /></div>
                <div><label className={labelClass}>Nomor HP</label>
                  <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="0812-xxxx-xxxx" className={inputClass} /></div>
                <div><label className={labelClass}>Status</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as Teknisi['status'] })} className={inputClass}>
                    <option value="aktif">Aktif</option>
                    <option value="cuti">Cuti</option>
                    <option value="nonaktif">Nonaktif</option>
                  </select></div>
              </div>
              <SpesialisInput selected={form.spesialis} onChange={v => setForm({ ...form, spesialis: v })} allOptions={spesialisList} onAddOption={v => setSpesialisList(p => [...p, v])} />
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={submitting}
                  style={{ background:"var(--wm-primary)",color:"#fff",padding:"8px 16px",borderRadius:6,fontSize:14,fontWeight:600,border:"none",cursor:"pointer" }}>
                  {submitting ? 'Menyimpan...' : 'Simpan'}
                </button>
                <button type="button" onClick={resetForm} className="px-4 py-2 rounded border border-wm-line text-sm text-[#555] hover:bg-[#f8fafc]">Batal</button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center text-sm text-[#888]">Memuat teknisi...</div>
        ) : teknisiList.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm font-semibold text-[#888]">Belum ada teknisi</p>
            <p className="mt-1 text-[12px] text-[#aaa]">Tambah teknisi agar bisa dipilih saat check-in servis.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-[1.4fr_1fr_2fr_0.8fr_1fr] px-5 py-2.5 bg-[#f8fafc] border-b border-[#f1f5f9]">
              {['Nama', 'No. HP', 'Spesialisasi', 'Status', 'Aksi'].map(h => (
                <p key={h} className="text-[11px] font-bold text-[#888]">{h}</p>
              ))}
            </div>

            {teknisiList.map(t => {
              const sc = statusStyle(t.status)
              const isEditing = editingId === t.id
              return (
                <div key={t.id}>
                  <div className="grid grid-cols-[1.4fr_1fr_2fr_0.8fr_1fr] items-center px-5 py-3 border-b border-[#f1f5f9] last:border-b-0 hover:bg-[#fafbfc]">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-[#dbeafe] flex items-center justify-center flex-shrink-0">
                        <span className="text-[11px] font-bold text-brand">{t.name[0]}</span>
                      </div>
                      <p className="text-[13px] font-semibold text-[#111]">{t.name}</p>
                    </div>
                    <p className="text-[12px] text-[#666]">{t.phone || '—'}</p>
                    <div className="flex flex-wrap gap-1">
                      {t.spesialis.length > 0
                        ? t.spesialis.map(s => <span key={s} className="inline-block px-2 py-0.5 rounded-full bg-[#f1f5f9] text-[10px] text-[#555]">{s}</span>)
                        : <span className="text-[11px] text-[#bbb]">—</span>}
                    </div>
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold w-fit capitalize"
                      style={{ background: sc.bg, color: sc.fg }}>{t.status}</span>
                    <div className="flex gap-1.5">
                      <button onClick={() => openEdit(t)}
                        className="px-2.5 py-1 rounded border border-wm-line text-[11px] text-[#555] hover:bg-[#f8fafc]">Edit</button>
                      <button onClick={() => setDeleteConfirmId(t.id)}
                        className="px-2.5 py-1 rounded border border-[#fecaca] bg-[#fee2e2] text-[11px] text-[#dc2626] hover:bg-[#fecaca]">Hapus</button>
                    </div>
                  </div>

                  {isEditing && (
                    <div className="px-5 py-4 border-b border-[#f1f5f9] bg-[#f8fafc]">
                      <p className="text-[12px] font-bold text-[#111] mb-3">Edit Teknisi</p>
                      <form onSubmit={handleSave} className="space-y-3">
                        <div className="grid gap-3 md:grid-cols-3">
                          <div><label className={labelClass}>Nama</label>
                            <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputClass} /></div>
                          <div><label className={labelClass}>Nomor HP</label>
                            <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className={inputClass} /></div>
                          <div><label className={labelClass}>Status</label>
                            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as Teknisi['status'] })} className={inputClass}>
                              <option value="aktif">Aktif</option>
                              <option value="cuti">Cuti</option>
                              <option value="nonaktif">Nonaktif</option>
                            </select></div>
                        </div>
                        <SpesialisInput selected={form.spesialis} onChange={v => setForm({ ...form, spesialis: v })} allOptions={spesialisList} onAddOption={v => setSpesialisList(p => [...p, v])} />
                        <div className="flex gap-2 pt-1">
                          <button type="submit" disabled={submitting}
                            style={{ background:"var(--wm-primary)",color:"#fff",padding:"8px 16px",borderRadius:6,fontSize:14,fontWeight:600,border:"none",cursor:"pointer" }}>
                            {submitting ? 'Menyimpan...' : 'Simpan'}
                          </button>
                          <button type="button" onClick={() => setEditingId(null)}
                            className="px-4 py-2 rounded border border-wm-line text-sm text-[#555] hover:bg-[#f8fafc]">Batal</button>
                        </div>
                      </form>
                    </div>
                  )}
                </div>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}
