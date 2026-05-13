import { useState, useEffect } from 'react'
import api from '../services/api'

type Tab = 'hero' | 'stats' | 'trust' | 'plans' | 'cta'

interface PlanItem {
  name: string; price: string; period: string
  features: string[]; btnText: string; popular: boolean; badge?: string
}

interface LandingContent {
  hero: { badge: string; title1: string; titleAccent: string; title3: string; subtitle: string; btn1: string; btn2: string }
  stats: Array<{ num: string; unit: string; label: string }>
  trust: string[]
  cta: { title: string; subtitle: string; btn: string }
  plans: PlanItem[]
}

const DEFAULT: LandingContent = {
  hero: {
    badge: 'WorkshopMu untuk detailing, coating, dan PPF',
    title1: 'Kelola Workshop', titleAccent: 'Detailing & PPF', title3: 'Lebih Cerdas',
    subtitle: 'Satu platform untuk booking, order, stok material, dan laporan — dirancang khusus untuk workshop detailing dan paint protection film profesional.',
    btn1: 'Coba Gratis 14 Hari', btn2: 'Lihat Demo →',
  },
  stats: [
    { num: '98', unit: '%', label: 'Kepuasan Pengguna' },
    { num: '3',  unit: 'x', label: 'Lebih Efisien' },
    { num: '500', unit: '+', label: 'Workshop Aktif' },
  ],
  trust: ['SpeedMaster Detailing', 'AutoGloss Studio', 'PPF Indonesia', 'ShineKing Workshop', 'DetailPro Surabaya'],
  cta: {
    title: 'Siap Transformasi\nWorkshop Anda?',
    subtitle: 'Bergabung dengan workshop yang sudah lebih rapi mengelola booking, stok, teknisi, dan laporan bersama WorkshopMu.',
    btn: 'Mulai Coba Gratis → Tidak Perlu Kartu Kredit',
  },
  plans: [
    { name: 'Starter', price: '0', period: 'Gratis selamanya', popular: false, badge: '',
      features: ['Hingga 20 order/bulan', '1 teknisi', 'Booking online dasar', 'Laporan sederhana'], btnText: 'Mulai Gratis' },
    { name: 'Pro', price: '499rb', period: 'per bulan · tagih bulanan', popular: true, badge: '⭐ Paling Populer',
      features: ['Order tidak terbatas', 'Hingga 10 teknisi', 'Tracking kendaraan real-time', 'Manajemen stok PPF & coating', 'Notifikasi WhatsApp otomatis', 'Laporan & analitik lengkap', 'Integrasi Midtrans payment'], btnText: 'Coba Gratis 14 Hari' },
    { name: 'Enterprise', price: '1,2jt', period: 'per bulan · multi-cabang', popular: false, badge: '',
      features: ['Semua fitur Pro', 'Teknisi & cabang tidak terbatas', 'Custom branding & domain', 'Priority support 24/7', 'Onboarding & training tim', 'SLA & dedicated account manager'], btnText: 'Hubungi Sales' },
  ],
}

const inp = 'w-full rounded border border-[#cbd5e1] bg-white px-3 py-2 text-sm text-[#111] outline-none focus:border-[#1E4FD8] focus:ring-2 focus:ring-[#dbeafe] transition'
const lbl = 'block text-[11px] font-semibold text-[#555] mb-1'

// ── Live Preview Components ────────────────────────────────────────────────────

function PreviewHero({ c }: { c: LandingContent }) {
  return (
    <div style={{ background: 'radial-gradient(ellipse 100% 80% at 60% 50%, #EFF6FF 0%, #fff 70%)', padding: '40px 36px 36px', borderRadius: 12 }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#EFF6FF', border: '1px solid #D9E3FC', borderRadius: 100, padding: '4px 12px', fontSize: 11, fontWeight: 600, color: '#2563EB', marginBottom: 18 }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#2563EB', display: 'inline-block' }} />
        {c.hero.badge || '—'}
      </div>
      <h1 style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.1, color: '#0F172A', letterSpacing: '-0.5px', marginBottom: 14 }}>
        {c.hero.title1}<br />
        <span style={{ color: '#2563EB' }}>{c.hero.titleAccent}</span><br />
        {c.hero.title3}
      </h1>
      <p style={{ fontSize: 13, lineHeight: 1.65, color: '#475569', marginBottom: 22, maxWidth: 380 }}>{c.hero.subtitle}</p>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ background: '#2563EB', color: '#fff', padding: '9px 18px', borderRadius: 8, fontSize: 12, fontWeight: 700, boxShadow: '0 4px 14px rgba(37,99,235,0.3)' }}>{c.hero.btn1}</div>
        <div style={{ background: '#fff', color: '#374151', border: '1.5px solid #E2E8F0', padding: '9px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600 }}>{c.hero.btn2}</div>
      </div>
      <div style={{ display: 'flex', gap: 28, marginTop: 28, paddingTop: 22, borderTop: '1px solid #E2E8F0' }}>
        {c.stats.map((s, i) => (
          <div key={i}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>
              {s.num}<span style={{ color: '#2563EB' }}>{s.unit}</span>
            </div>
            <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function PreviewStats({ c }: { c: LandingContent }) {
  return (
    <div style={{ background: '#fff', padding: '28px 24px', borderRadius: 12, border: '1px solid #E2E8F0' }}>
      <p style={{ fontSize: 11, color: '#94A3B8', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>Statistik (tampil di Hero)</p>
      <div style={{ display: 'flex', gap: 16 }}>
        {c.stats.map((s, i) => (
          <div key={i} style={{ flex: 1, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: '16px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>
              {s.num}<span style={{ color: '#2563EB' }}>{s.unit}</span>
            </div>
            <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 6 }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function PreviewTrust({ c }: { c: LandingContent }) {
  return (
    <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: '20px 24px' }}>
      <p style={{ fontSize: 10, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>Dipercaya oleh</p>
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        {c.trust.map((t, i) => (
          <span key={i} style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8' }}>{t}</span>
        ))}
      </div>
    </div>
  )
}

function PreviewPlans({ c }: { c: LandingContent }) {
  return (
    <div style={{ background: '#EFF6FF', padding: '24px 20px', borderRadius: 12 }}>
      <p style={{ fontSize: 11, color: '#2563EB', marginBottom: 16, fontWeight: 600, textAlign: 'center' }}>Paket Harga</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        {c.plans.map((p, i) => (
          <div key={i} style={{
            background: p.popular ? '#2563EB' : '#fff',
            border: p.popular ? '2px solid #2563EB' : '1.5px solid #E2E8F0',
            borderRadius: 10, padding: '16px 14px', position: 'relative',
            boxShadow: p.popular ? '0 6px 24px rgba(37,99,235,0.25)' : '0 1px 6px rgba(0,0,0,0.05)',
          }}>
            {p.badge && (
              <div style={{ position: 'absolute', top: -9, left: '50%', transform: 'translateX(-50%)', background: '#F59E0B', color: '#fff', fontSize: 8, fontWeight: 700, padding: '2px 8px', borderRadius: 100, whiteSpace: 'nowrap' }}>{p.badge}</div>
            )}
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: p.popular ? 'rgba(255,255,255,0.7)' : '#64748B', marginBottom: 4 }}>{p.name}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: p.popular ? '#fff' : '#0F172A', lineHeight: 1, marginBottom: 2 }}>
              <span style={{ fontSize: 10, fontWeight: 500 }}>Rp </span>{p.price}
            </div>
            <div style={{ fontSize: 9, color: p.popular ? 'rgba(255,255,255,0.6)' : '#94A3B8', marginBottom: 10 }}>{p.period}</div>
            <div style={{ height: 1, background: p.popular ? 'rgba(255,255,255,0.2)' : '#F1F5F9', marginBottom: 10 }} />
            {p.features.slice(0, 4).map((f, fi) => (
              <div key={fi} style={{ display: 'flex', gap: 5, alignItems: 'flex-start', marginBottom: 5 }}>
                <span style={{ width: 13, height: 13, borderRadius: '50%', background: p.popular ? 'rgba(255,255,255,0.25)' : '#DBEAFE', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, color: p.popular ? '#fff' : '#2563EB', fontWeight: 800 }}>✓</span>
                <span style={{ fontSize: 9, color: p.popular ? 'rgba(255,255,255,0.85)' : '#374151', lineHeight: 1.4 }}>{f}</span>
              </div>
            ))}
            {p.features.length > 4 && <div style={{ fontSize: 9, color: p.popular ? 'rgba(255,255,255,0.5)' : '#94A3B8', marginTop: 2 }}>+{p.features.length - 4} lainnya</div>}
            <div style={{ marginTop: 12, background: p.popular ? '#fff' : '#2563EB', color: p.popular ? '#2563EB' : '#fff', borderRadius: 6, padding: '6px 0', textAlign: 'center', fontSize: 9, fontWeight: 700 }}>{p.btnText}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function PreviewCta({ c }: { c: LandingContent }) {
  return (
    <div style={{ background: 'linear-gradient(135deg, #1A45BF 0%, #3B82F6 100%)', borderRadius: 12, padding: '36px 32px', textAlign: 'center' }}>
      <p style={{ fontSize: 20, fontWeight: 800, color: '#fff', lineHeight: 1.2, marginBottom: 10, whiteSpace: 'pre-line' }}>{c.cta.title}</p>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.72)', marginBottom: 20, maxWidth: 360, margin: '0 auto 20px' }}>{c.cta.subtitle}</p>
      <div style={{ display: 'inline-block', background: '#fff', color: '#2563EB', fontWeight: 700, fontSize: 12, padding: '10px 24px', borderRadius: 8 }}>{c.cta.btn}</div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function SuperadminLandingPage() {
  const [tab, setTab] = useState<Tab>('hero')
  const [content, setContent] = useState<LandingContent>(DEFAULT)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [isDefault, setIsDefault] = useState(true)

  useEffect(() => {
    api.get('/api/public/landing')
      .then(res => { setContent(res.data.data); setIsDefault(res.data.isDefault) })
      .catch(() => setContent(DEFAULT))
      .finally(() => setLoading(false))
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      await api.put('/api/settings', { landing_content: JSON.stringify(content) })
      setSaved(true); setIsDefault(false)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) { console.error('Save failed:', err) }
    finally { setSaving(false) }
  }

  const reset = async () => {
    if (!confirm('Reset ke konten default?')) return
    setSaving(true)
    try {
      await api.put('/api/settings', { landing_content: JSON.stringify(DEFAULT) })
      setContent(DEFAULT); setIsDefault(true)
      setSaved(true); setTimeout(() => setSaved(false), 2000)
    } catch (err) { console.error('Reset failed:', err) }
    finally { setSaving(false) }
  }

  const setHero = (f: keyof LandingContent['hero'], v: string) =>
    setContent(c => ({ ...c, hero: { ...c.hero, [f]: v } }))
  const setStat = (i: number, f: 'num' | 'unit' | 'label', v: string) =>
    setContent(c => ({ ...c, stats: c.stats.map((s, idx) => idx === i ? { ...s, [f]: v } : s) }))
  const setTrust = (i: number, v: string) =>
    setContent(c => ({ ...c, trust: c.trust.map((t, idx) => idx === i ? v : t) }))
  const setCta = (f: keyof LandingContent['cta'], v: string) =>
    setContent(c => ({ ...c, cta: { ...c.cta, [f]: v } }))
  const setPlan = (i: number, f: keyof PlanItem, v: string | boolean) =>
    setContent(c => ({ ...c, plans: c.plans.map((p, idx) => idx === i ? { ...p, [f]: v } : p) }))
  const setPlanFeature = (pi: number, fi: number, v: string) =>
    setContent(c => ({ ...c, plans: c.plans.map((p, idx) => idx === pi ? { ...p, features: p.features.map((f, fIdx) => fIdx === fi ? v : f) } : p) }))
  const addFeature = (pi: number) =>
    setContent(c => ({ ...c, plans: c.plans.map((p, idx) => idx === pi ? { ...p, features: [...p.features, ''] } : p) }))
  const removeFeature = (pi: number, fi: number) =>
    setContent(c => ({ ...c, plans: c.plans.map((p, idx) => idx === pi ? { ...p, features: p.features.filter((_, fIdx) => fIdx !== fi) } : p) }))

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: 'hero',  label: 'Hero',      icon: '🏠' },
    { key: 'stats', label: 'Statistik', icon: '📊' },
    { key: 'trust', label: 'Trust Bar', icon: '🏢' },
    { key: 'plans', label: 'Paket',     icon: '💳' },
    { key: 'cta',   label: 'CTA',       icon: '📣' },
  ]

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <p className="text-[13px] text-[#aaa]">Memuat konten...</p>
    </div>
  )

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-[#e2e8f0] bg-white flex-shrink-0">
        <div>
          <h1 className="text-sm font-bold text-[#111]">Edit Landing Page</h1>
          <p className="text-[11px] text-[#aaa]">
            {isDefault ? 'Default — belum pernah diedit' : 'Konten kustom aktif'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {saved && <span className="text-[12px] text-[#16a34a] font-semibold">✓ Tersimpan</span>}
          <button onClick={reset} disabled={saving || isDefault}
            className="px-3 py-1.5 rounded border border-[#e2e8f0] text-[12px] text-[#888] hover:bg-[#f8fafc] disabled:opacity-40 transition">
            Reset
          </button>
          <a href="/" target="_blank" rel="noreferrer"
            className="px-3 py-1.5 rounded border border-[#e2e8f0] text-[12px] text-[#555] hover:bg-[#f8fafc] transition">
            Buka Landing ↗
          </a>
          <button onClick={save} disabled={saving}
            className="px-4 py-1.5 rounded bg-[#1E4FD8] text-white text-[12px] font-semibold hover:bg-[#1A45BF] disabled:opacity-40 transition">
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>

      {/* ── Split layout ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT: Editor ── */}
        <div className="w-[420px] flex-shrink-0 flex flex-col border-r border-[#e2e8f0] bg-white overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-[#e2e8f0] px-2 pt-1 flex-shrink-0">
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`px-3 py-2 text-[12px] font-semibold border-b-2 transition -mb-px mr-1 ${
                  tab === t.key ? 'border-[#1E4FD8] text-[#1E4FD8]' : 'border-transparent text-[#888] hover:text-[#555]'
                }`}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {/* Form */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">

            {/* HERO */}
            {tab === 'hero' && <>
              <div className="rounded-lg border border-[#e2e8f0] p-4 space-y-3">
                <p className="text-[11px] font-bold text-[#888] uppercase tracking-wide">Badge</p>
                <div>
                  <label className={lbl}>Teks Badge</label>
                  <input value={content.hero.badge} onChange={e => setHero('badge', e.target.value)} className={inp} />
                </div>
              </div>
              <div className="rounded-lg border border-[#e2e8f0] p-4 space-y-3">
                <p className="text-[11px] font-bold text-[#888] uppercase tracking-wide">Judul H1</p>
                <div>
                  <label className={lbl}>Baris 1</label>
                  <input value={content.hero.title1} onChange={e => setHero('title1', e.target.value)} className={inp} />
                </div>
                <div>
                  <label className={lbl}>Baris 2 (biru)</label>
                  <input value={content.hero.titleAccent} onChange={e => setHero('titleAccent', e.target.value)} className={inp} />
                </div>
                <div>
                  <label className={lbl}>Baris 3</label>
                  <input value={content.hero.title3} onChange={e => setHero('title3', e.target.value)} className={inp} />
                </div>
              </div>
              <div className="rounded-lg border border-[#e2e8f0] p-4 space-y-3">
                <p className="text-[11px] font-bold text-[#888] uppercase tracking-wide">Subtitle & Tombol</p>
                <div>
                  <label className={lbl}>Subtitle</label>
                  <textarea value={content.hero.subtitle} onChange={e => setHero('subtitle', e.target.value)} rows={3} className={inp + ' resize-none'} />
                </div>
                <div>
                  <label className={lbl}>Tombol Utama</label>
                  <input value={content.hero.btn1} onChange={e => setHero('btn1', e.target.value)} className={inp} />
                </div>
                <div>
                  <label className={lbl}>Tombol Sekunder</label>
                  <input value={content.hero.btn2} onChange={e => setHero('btn2', e.target.value)} className={inp} />
                </div>
              </div>
            </>}

            {/* STATS */}
            {tab === 'stats' && (
              <div className="rounded-lg border border-[#e2e8f0] p-4 space-y-4">
                <p className="text-[11px] text-[#aaa]">3 angka statistik di bawah hero.</p>
                {content.stats.map((s, i) => (
                  <div key={i} className="space-y-2 pb-4 border-b border-[#f1f5f9] last:border-b-0 last:pb-0">
                    <p className="text-[11px] font-semibold text-[#555]">Statistik {i + 1}</p>
                    <div className="grid grid-cols-[1fr_70px] gap-2">
                      <div>
                        <label className={lbl}>Angka</label>
                        <input value={s.num} onChange={e => setStat(i, 'num', e.target.value)} className={inp} placeholder="98" />
                      </div>
                      <div>
                        <label className={lbl}>Satuan</label>
                        <input value={s.unit} onChange={e => setStat(i, 'unit', e.target.value)} className={inp} placeholder="%" />
                      </div>
                    </div>
                    <div>
                      <label className={lbl}>Label</label>
                      <input value={s.label} onChange={e => setStat(i, 'label', e.target.value)} className={inp} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* TRUST */}
            {tab === 'trust' && (
              <div className="rounded-lg border border-[#e2e8f0] p-4 space-y-3">
                <p className="text-[11px] text-[#aaa]">Nama brand di trust bar.</p>
                {content.trust.map((t, i) => (
                  <div key={i}>
                    <label className={lbl}>Brand {i + 1}</label>
                    <input value={t} onChange={e => setTrust(i, e.target.value)} className={inp} />
                  </div>
                ))}
              </div>
            )}

            {/* PLANS */}
            {tab === 'plans' && (content.plans || DEFAULT.plans).map((plan, pi) => (
              <div key={pi} className={`rounded-lg border bg-white p-4 space-y-3 ${plan.popular ? 'border-[#1E4FD8]' : 'border-[#e2e8f0]'}`}>
                <div className="flex items-center justify-between">
                  <p className="text-[12px] font-bold text-[#111] flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${plan.popular ? 'bg-[#1E4FD8]' : 'bg-[#cbd5e1]'}`} />
                    {plan.name || `Paket ${pi + 1}`}
                  </p>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={plan.popular}
                      onChange={e => setPlan(pi, 'popular', e.target.checked)}
                      className="h-3 w-3 accent-[#1E4FD8]" />
                    <span className="text-[11px] text-[#888]">Populer</span>
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className={lbl}>Nama</label><input value={plan.name} onChange={e => setPlan(pi, 'name', e.target.value)} className={inp} /></div>
                  <div><label className={lbl}>Badge</label><input value={plan.badge || ''} onChange={e => setPlan(pi, 'badge', e.target.value)} className={inp} placeholder="⭐ Paling Populer" /></div>
                  <div><label className={lbl}>Harga</label><input value={plan.price} onChange={e => setPlan(pi, 'price', e.target.value)} className={inp} /></div>
                  <div><label className={lbl}>Keterangan</label><input value={plan.period} onChange={e => setPlan(pi, 'period', e.target.value)} className={inp} /></div>
                  <div className="col-span-2"><label className={lbl}>Tombol</label><input value={plan.btnText} onChange={e => setPlan(pi, 'btnText', e.target.value)} className={inp} /></div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className={lbl + ' mb-0'}>Fitur</label>
                    <button onClick={() => addFeature(pi)} className="text-[11px] text-[#1E4FD8] hover:underline">+ Tambah</button>
                  </div>
                  <div className="space-y-1.5">
                    {plan.features.map((f, fi) => (
                      <div key={fi} className="flex items-center gap-1.5">
                        <span className="text-[#1E4FD8] text-[9px] font-bold">✓</span>
                        <input value={f} onChange={e => setPlanFeature(pi, fi, e.target.value)} className={inp + ' flex-1'} />
                        <button onClick={() => removeFeature(pi, fi)} className="text-[#ccc] hover:text-[#ef4444] text-sm">×</button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}

            {/* CTA */}
            {tab === 'cta' && (
              <div className="rounded-lg border border-[#e2e8f0] p-4 space-y-3">
                <p className="text-[11px] text-[#aaa]">Banner di bagian bawah halaman.</p>
                <div>
                  <label className={lbl}>Judul (\\n = baris baru)</label>
                  <textarea value={content.cta.title} onChange={e => setCta('title', e.target.value)} rows={2} className={inp + ' resize-none'} />
                </div>
                <div>
                  <label className={lbl}>Subtitle</label>
                  <textarea value={content.cta.subtitle} onChange={e => setCta('subtitle', e.target.value)} rows={2} className={inp + ' resize-none'} />
                </div>
                <div>
                  <label className={lbl}>Teks Tombol</label>
                  <input value={content.cta.btn} onChange={e => setCta('btn', e.target.value)} className={inp} />
                </div>
              </div>
            )}

          </div>
        </div>

        {/* ── RIGHT: Live Preview ── */}
        <div className="flex-1 overflow-y-auto bg-[#f1f5f9] p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-2 w-2 rounded-full bg-[#ef4444]" />
            <div className="h-2 w-2 rounded-full bg-[#f59e0b]" />
            <div className="h-2 w-2 rounded-full bg-[#22c55e]" />
            <span className="ml-2 text-[11px] text-[#94a3b8] font-medium">Live Preview — {TABS.find(t => t.key === tab)?.label}</span>
          </div>

          <div className="space-y-3">
            {tab === 'hero'  && <PreviewHero  c={content} />}
            {tab === 'stats' && <PreviewStats c={content} />}
            {tab === 'trust' && <PreviewTrust c={content} />}
            {tab === 'plans' && <PreviewPlans c={content} />}
            {tab === 'cta'   && <PreviewCta   c={content} />}

            {/* Section label */}
            <div className="flex items-center gap-3 mt-4">
              <div className="h-px flex-1 bg-[#e2e8f0]" />
              <p className="text-[11px] text-[#94a3b8]">Preview section · perubahan langsung terlihat</p>
              <div className="h-px flex-1 bg-[#e2e8f0]" />
            </div>

            {/* Mini full page hint */}
            <div className="rounded-lg border border-[#e2e8f0] bg-white p-3 text-center">
              <p className="text-[11px] text-[#aaa]">Untuk melihat tampilan lengkap →</p>
              <a href="/" target="_blank" rel="noreferrer"
                className="inline-block mt-1.5 px-4 py-1.5 rounded bg-[#f8fafc] border border-[#e2e8f0] text-[12px] font-semibold text-[#555] hover:bg-[#EEF3FE] hover:text-[#1E4FD8] transition">
                Buka Landing Page ↗
              </a>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
