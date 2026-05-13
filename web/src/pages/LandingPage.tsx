import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'

interface PlanItem {
  name: string; price: string; period: string; popular: boolean; badge?: string
  features: string[]; btnText: string
}
interface LandingContent {
  hero: { badge: string; title1: string; titleAccent: string; title3: string; subtitle: string; btn1: string; btn2: string }
  stats: Array<{ num: string; unit: string; label: string }>
  trust: string[]
  cta: { title: string; subtitle: string; btn: string }
  plans: PlanItem[]
}

const DEFAULT_CONTENT: LandingContent = {
  hero: {
    badge: 'Untuk detailing, coating, dan PPF',
    title1: 'Kelola Workshop', titleAccent: 'Detailing & PPF', title3: 'Lebih Cerdas',
    subtitle: 'Atur booking, stok, teknisi, dan laporan bengkel jadi gampang.',
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
    subtitle: 'Bergabung dengan workshop yang sudah lebih rapi mengelola booking, stok, teknisi, dan laporan bersama WorkshopMU.',
    btn: 'Mulai Coba Gratis — Tidak Perlu Kartu Kredit',
  },
  plans: [
    { name: 'Starter', price: '0', period: 'forever', popular: false, badge: '',
      features: ['Hingga 50 transaksi/bulan', '2 teknisi', 'Customer & inventaris unlimited', '1 template kartu garansi', 'Laporan pendapatan dasar', 'Akses mobile web'], btnText: 'Mulai Gratis' },
    { name: 'Pro', price: '2.499.000', period: 'per tahun (~Rp 208rb/bulan)', popular: true, badge: '⭐ EARLY ADOPTER — Diskon 50%',
      features: ['Semua fitur Starter', 'Transaksi & teknisi unlimited', 'Setup HPP per layanan (BOM)', '6 template kartu garansi premium', 'Custom logo di kartu garansi', 'Laporan keuangan lengkap (laba rugi, aliran kas, ringkasan)', 'Analitik bengkel', 'Riwayat layanan unlimited', 'Priority support'], btnText: 'Coba Pro Gratis 60 Hari' },
  ],
}

/* ─── Brand tokens (mirrors index.css) ──────────────────────────────────── */
const C = {
  primary:    '#1E4FD8',
  primary600: '#1A45BF',
  primary50:  '#EEF3FE',
  primary100: '#D9E3FC',
  accent:     '#FF6A1F',
  ink:        '#0E1530',
  ink2:       '#2B324A',
  ink3:       '#5A6178',
  ink4:       '#9097A8',
  line:       '#E5E8EE',
  bg:         '#F4F1EB',
  success:    '#1F8A5B',
  warning:    '#E5A50A',
}

export default function LandingPage() {
  const [lp, setLp] = useState<LandingContent>(DEFAULT_CONTENT)

  useEffect(() => {
    api.get('/api/public/landing')
      .then(res => { if (res.data?.data) setLp(res.data.data) })
      .catch(() => {})
  }, [])

  const { hero, stats, trust, cta } = lp

  return (
    <div style={{ minHeight: '100vh', background: '#fff', fontFamily: '"Manrope", system-ui, sans-serif' }}>
      <style>{`
        .lp * { box-sizing: border-box; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.45} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        .lp-btn-primary { background:${C.primary}; color:#fff; font-weight:700; border:none; cursor:pointer; transition:background .15s,transform .1s; }
        .lp-btn-primary:hover { background:${C.primary600}; transform:translateY(-1px); }
        .lp-feat-card:hover { border-color:${C.primary} !important; transform:translateY(-4px); }
        .lp-nav-link { color:${C.ink3}; text-decoration:none; font-size:14px; font-weight:500; transition:color .15s; }
        .lp-nav-link:hover { color:${C.ink}; }
        a.lp-ghost-btn:hover { background:${C.primary50} !important; }
        @media(max-width:768px){
          .lp-nav{padding:0 16px!important;height:60px!important}
          .lp-nav-logo-text{font-size:14px!important}
          .lp-nav-logo img{width:28px!important;height:28px!important}
          .lp-nav-actions a:first-child{padding:6px 10px!important;font-size:13px!important}
          .lp-nav-actions a:last-child{padding:8px 12px!important;font-size:13px!important}
          .lp-nav-actions{gap:6px!important}
          .lp-nav-links{display:none!important}
          .lp-hero-visual{display:none!important}
          .lp-hero{padding-top:60px!important}
          .lp-hero-content{padding:48px 24px 64px!important}
          .lp-hero-content h1{font-size:38px!important;letter-spacing:-0.5px!important}
          .lp-hero-actions{flex-direction:column!important;width:100%!important}
          .lp-hero-actions a{text-align:center!important;width:100%!important}
          .lp-stats{flex-wrap:wrap!important;gap:24px!important}
          .lp-trust{flex-direction:column!important;gap:16px!important;padding:20px 24px!important}
          .lp-section{padding:64px 24px!important}
          .lp-section h2{font-size:30px!important}
          .lp-grid-3{grid-template-columns:1fr!important}
          .lp-grid-2{grid-template-columns:1fr!important}
          .lp-feat-span2{grid-column:auto!important}
          .lp-step-line{display:none!important}
          .lp-cta{padding:64px 24px!important}
          .lp-cta h2{font-size:30px!important}
          .lp-footer-cols{flex-direction:column!important;gap:32px!important}
          .lp-coming-soon-grid{grid-template-columns:1fr!important}
          .lp-kpi-grid{grid-template-columns:1fr 1fr!important;gap:8px!important}
          .lp-kpi-grid .lp-kpi-value{font-size:22px!important}
          .lp-kpi-bottom{grid-template-columns:1fr!important}
          .lp-kpi-preview{padding:14px!important}
        }
      `}</style>

      {/* ── NAV ── */}
      <nav className="lp-nav" style={{
        position:'fixed', top:0, left:0, right:0, zIndex:100,
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'0 64px', height:72,
        background:'rgba(255,255,255,0.93)',
        backdropFilter:'blur(20px)',
        borderBottom:`1px solid ${C.line}`,
      }}>
        <a href="#" className="lp-nav-logo" style={{ display:'flex', alignItems:'center', gap:10, textDecoration:'none', flexShrink:0 }}>
          <img src="/workshopmu-logo.svg" alt="WorkshopMU" style={{ width:36, height:36 }} />
          <span className="lp-nav-logo-text" style={{ fontFamily:'"Sora",system-ui,sans-serif', fontSize:16, fontWeight:700, letterSpacing:'-0.03em', color:C.ink, whiteSpace:'nowrap' }}>
            Workshop<span style={{ color:C.accent, fontWeight:800 }}>MU</span>
          </span>
        </a>

        <ul className="lp-nav-links" style={{ display:'flex', gap:36, listStyle:'none', margin:0, padding:0 }}>
          {['Fitur','Cara Kerja','Marketing KPI','Harga'].map(item => (
            <li key={item}>
              <a href={`#${item.toLowerCase().replace(' ','-')}`} className="lp-nav-link">{item}</a>
            </li>
          ))}
        </ul>

        <div className="lp-nav-actions" style={{ display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
          <Link to="/login" style={{ fontSize:14, fontWeight:600, color:C.ink3, textDecoration:'none', padding:'8px 16px', whiteSpace:'nowrap' }}>Masuk</Link>
          <Link to="/register" className="lp-btn-primary" style={{ fontSize:14, padding:'10px 22px', borderRadius:8, textDecoration:'none', whiteSpace:'nowrap' }}>Coba Gratis</Link>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="lp-hero" style={{ position:'relative', minHeight:'100vh', display:'flex', alignItems:'center', overflow:'hidden', background:'#fff', paddingTop:72 }}>
        {/* bg gradients — brand colours */}
        <div style={{ position:'absolute', inset:0,
          background:`radial-gradient(ellipse 80% 60% at 60% 40%, ${C.primary50} 0%, #fff 70%)` }} />
        <div style={{ position:'absolute', top:-200, right:-200, width:600, height:600, borderRadius:'50%',
          background:`radial-gradient(circle, rgba(30,79,216,0.09) 0%, transparent 70%)` }} />
        <div style={{ position:'absolute', bottom:-100, left:-100, width:400, height:400, borderRadius:'50%',
          background:`radial-gradient(circle, rgba(255,106,31,0.06) 0%, transparent 70%)` }} />

        <div className="lp-hero-content" style={{ position:'relative', zIndex:1, maxWidth:660, padding:'80px 64px 100px', display:'flex', flexDirection:'column', alignItems:'flex-start' }}>
          {/* badge */}
          <div style={{ display:'inline-flex', alignItems:'center', gap:8,
            background:C.primary50, border:`1px solid ${C.primary100}`,
            borderRadius:100, padding:'6px 14px', fontSize:12, fontWeight:600, color:C.primary, marginBottom:24 }}>
            <span style={{ width:6, height:6, borderRadius:'50%', background:C.primary, display:'inline-block', animation:'pulse 2s infinite' }} />
            {hero.badge}
          </div>

          <h1 style={{ fontFamily:'"Sora",system-ui,sans-serif', fontSize:'clamp(40px,5vw,62px)', fontWeight:800, lineHeight:1.06,
            color:C.ink, letterSpacing:'-1.5px', marginBottom:24 }}>
            {hero.title1}<br />
            <span style={{ color:C.primary }}>{hero.titleAccent}</span><br />
            {hero.title3}
          </h1>

          <p style={{ fontSize:18, lineHeight:1.7, color:C.ink3, marginBottom:40, maxWidth:520 }}>
            {hero.subtitle}
          </p>

          <div className="lp-hero-actions" style={{ display:'flex', gap:14, alignItems:'center' }}>
            <Link to="/register" className="lp-btn-primary" style={{
              fontSize:16, padding:'15px 32px', borderRadius:10, textDecoration:'none',
              boxShadow:`0 4px 20px rgba(30,79,216,0.3)`,
            }}>{hero.btn1}</Link>
            <a href="#fitur" className="lp-ghost-btn" style={{
              fontSize:15, fontWeight:600, background:'#fff', color:C.ink2,
              border:`1.5px solid ${C.line}`, padding:'15px 28px', borderRadius:10,
              cursor:'pointer', textDecoration:'none', transition:'background .15s',
            }}>{hero.btn2}</a>
          </div>

          {/* stats */}
          <div className="lp-stats" style={{ display:'flex', gap:40, marginTop:64, paddingTop:48, borderTop:`1px solid ${C.line}` }}>
            {stats.map(s => (
              <div key={s.label}>
                <div style={{ fontFamily:'"Sora",system-ui,sans-serif', fontSize:32, fontWeight:800, color:C.ink, letterSpacing:'-1px', lineHeight:1 }}>
                  {s.num}<span style={{ color:C.accent }}>{s.unit}</span>
                </div>
                <div style={{ fontSize:13, color:C.ink4, marginTop:4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* hero visual */}
        <div className="lp-hero-visual" style={{ position:'absolute', right:0, top:0, bottom:0, width:'45%', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1 }}>
          <div style={{ position:'relative', width:480, height:520 }}>
            <div style={{ position:'absolute', width:300, height:320, top:40, left:80, zIndex:2, borderRadius:16, overflow:'hidden', boxShadow:'0 32px 80px rgba(0,0,0,0.55)' }}>
              <img src="https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?w=600&q=80" alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
            </div>
            <div style={{ position:'absolute', width:240, height:200, bottom:40, right:20, zIndex:3, borderRadius:16, overflow:'hidden', boxShadow:'0 32px 80px rgba(0,0,0,0.55)', border:`3px solid rgba(30,79,216,0.4)` }}>
              <img src="https://images.unsplash.com/photo-1601362840469-51e4d8d58785?w=480&q=80" alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
            </div>
            <div style={{ position:'absolute', width:180, height:160, top:20, right:30, zIndex:1, borderRadius:16, overflow:'hidden', boxShadow:'0 32px 80px rgba(0,0,0,0.5)', opacity:0.7 }}>
              <img src="https://images.unsplash.com/photo-1607860108855-64acf2078ed9?w=400&q=80" alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
            </div>
            {/* float cards */}
            <div style={{ position:'absolute', bottom:110, left:20, zIndex:4, background:'rgba(255,255,255,0.97)', borderRadius:12, padding:'12px 16px', boxShadow:'0 16px 40px rgba(0,0,0,0.25)' }}>
              <div style={{ fontSize:10, fontWeight:600, color:C.ink4, textTransform:'uppercase', letterSpacing:'0.5px' }}>Pendapatan Bulan Ini</div>
              <div style={{ fontFamily:'"Sora",system-ui,sans-serif', fontSize:18, fontWeight:800, color:C.ink, lineHeight:1.2, marginTop:2 }}>Rp 48,5 Jt</div>
              <div style={{ fontSize:11, color:C.success, fontWeight:600, display:'flex', alignItems:'center', gap:3, marginTop:2 }}>↑ 23% dari bulan lalu</div>
            </div>
            <div style={{ position:'absolute', top:20, left:0, zIndex:4, background:'rgba(255,255,255,0.97)', borderRadius:12, padding:'12px 16px', boxShadow:'0 16px 40px rgba(0,0,0,0.25)' }}>
              <div style={{ fontSize:10, fontWeight:600, color:C.ink4, textTransform:'uppercase', letterSpacing:'0.5px' }}>Order Aktif</div>
              <div style={{ fontFamily:'"Sora",system-ui,sans-serif', fontSize:18, fontWeight:800, color:C.ink, lineHeight:1.2, marginTop:2 }}>12 Kendaraan</div>
              <div style={{ fontSize:11, color:C.success, fontWeight:600, marginTop:2 }}>✓ 4 selesai hari ini</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TRUST BAR ── */}
      <div className="lp-trust" style={{ background:C.bg, borderTop:`1px solid ${C.line}`, borderBottom:`1px solid ${C.line}`, padding:'22px 64px', display:'flex', alignItems:'center', gap:40 }}>
        <span style={{ fontSize:11, fontWeight:700, color:C.ink4, textTransform:'uppercase', letterSpacing:1, whiteSpace:'nowrap' }}>Dipercaya oleh</span>
        <div style={{ display:'flex', gap:48, alignItems:'center', flex:1, flexWrap:'wrap' }}>
          {trust.map(b => (
            <span key={b} style={{ fontSize:13, fontWeight:700, color:C.ink4 }}>{b}</span>
          ))}
        </div>
      </div>

      {/* ── FEATURES ── */}
      <section id="fitur" className="lp-section" style={{ padding:'100px 64px', background:'#fff' }}>
        <div style={{ marginBottom:64 }}>
          <span style={{ display:'inline-block', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'1.5px',
            color:C.primary, background:C.primary50, borderRadius:100, padding:'5px 14px', marginBottom:16 }}>Fitur Unggulan</span>
          <h2 style={{ fontFamily:'"Sora",system-ui,sans-serif', fontSize:'clamp(32px,3.5vw,44px)', fontWeight:800, letterSpacing:'-1px', lineHeight:1.12, color:C.ink, marginBottom:16 }}>
            Semua yang Anda Butuhkan<br />dalam Satu Dashboard
          </h2>
          <p style={{ fontSize:18, color:C.ink3, maxWidth:560, lineHeight:1.7 }}>
            Dirancang untuk kebutuhan nyata workshop detailing dan PPF — dari booking pertama hingga laporan akhir bulan.
          </p>
        </div>

        <div className="lp-grid-3" style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:24 }}>
          {/* featured — span 2 */}
          <div className="lp-feat-span2" style={{
            background:`linear-gradient(135deg, #0E2A6E 0%, ${C.primary} 100%)`,
            border:`1px solid ${C.primary}`, borderRadius:14, padding:32, gridColumn:'span 2',
          }}>
            <div style={{ width:'100%', height:200, borderRadius:8, overflow:'hidden', marginBottom:20 }}>
              <img src="https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?w=800&q=80" alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
            </div>
            <div style={{ width:48, height:48, background:'rgba(255,255,255,0.18)', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, marginBottom:16 }}>🚗</div>
            <div style={{ fontFamily:'"Sora",system-ui,sans-serif', fontSize:18, fontWeight:700, color:'#fff', marginBottom:8 }}>Manajemen Layanan Berjalan Real-time</div>
            <div style={{ fontSize:14, color:'rgba(255,255,255,0.75)', lineHeight:1.65, marginBottom:16 }}>
              Pantau setiap tahap pengerjaan kendaraan pelanggan — dari pre-inspection, paint correction, PPF installation, hingga quality check.
            </div>
            <ul style={{ listStyle:'none', display:'flex', flexDirection:'column', gap:8 }}>
              {['Status update otomatis per tahap','Foto dokumentasi setiap proses','Notifikasi WhatsApp ke customer'].map(f => (
                <li key={f} style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:'rgba(255,255,255,0.85)' }}>
                  <span style={{ width:18, height:18, background:'rgba(255,255,255,0.25)', color:'#fff', borderRadius:'50%', fontSize:10, fontWeight:800, display:'inline-flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>✓</span>
                  {f}
                </li>
              ))}
            </ul>
          </div>

          <FeatureCard icon="📅" title="Booking & Scheduling Online" desc="Terima booking 24/7 tanpa telepon. Kelola jadwal teknisi dan bay service dengan kalender visual." items={['Form booking customer mandiri','Konfirmasi otomatis via email','Slot management per teknisi']} />
          <FeatureCard icon="📦" title="Stok Material PPF & Coating" desc="Pantau inventaris film, coating, dan consumables. Notifikasi otomatis saat stok mendekati minimum." items={['Tracking per SKU & batch','Alert stok minimum','Laporan pemakaian material']} />
          <FeatureCard icon="📋" title="Manajemen Order & Work Order" desc="Buat work order detail untuk setiap kendaraan. Catat kondisi awal, checklist pengerjaan, dan dokumentasi foto." items={[]} />
          <FeatureCard icon="📊" title="Laporan & Analitik Bisnis" desc="Dashboard lengkap pendapatan, performa teknisi, layanan terpopuler, dan tren pelanggan." items={[]} />
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="cara-kerja" className="lp-section" style={{ padding:'100px 64px', background:C.bg }}>
        <div style={{ textAlign:'center', marginBottom:64 }}>
          <span style={{ display:'inline-block', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'1.5px',
            color:C.primary, background:C.primary50, borderRadius:100, padding:'5px 14px', marginBottom:16 }}>Cara Kerja</span>
          <h2 style={{ fontFamily:'"Sora",system-ui,sans-serif', fontSize:'clamp(28px,3.5vw,44px)', fontWeight:800, letterSpacing:'-1px', color:C.ink, marginBottom:16 }}>
            Mulai dalam 3 Langkah Mudah
          </h2>
          <p style={{ fontSize:18, color:C.ink3, maxWidth:480, margin:'0 auto', lineHeight:1.7 }}>
            Setup workshop Anda dalam hitungan menit, bukan jam. Tidak butuh skill IT.
          </p>
        </div>

        <div className="lp-grid-3" style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:32, position:'relative' }}>
          <div className="lp-step-line" style={{ position:'absolute', top:28, left:'15%', right:'15%', height:2,
            background:`repeating-linear-gradient(90deg, ${C.primary} 0 12px, transparent 12px 20px)`, zIndex:0 }} />
          {[
            { n:'1', img:'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=600&q=80', title:'Daftarkan Workshop', desc:'Buat akun gratis, isi profil workshop, tambahkan layanan, harga, dan tim teknisi Anda dalam beberapa menit.' },
            { n:'2', img:'https://images.unsplash.com/photo-1614026480418-bd11fdb9fa06?w=600&q=80', title:'Terima & Kelola Order', desc:'Customer booking online, sistem otomatis membuat work order. Assign ke teknisi dan update progress.' },
            { n:'3', img:'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&q=80', title:'Analisis & Kembangkan', desc:'Pantau performa workshop via dashboard. Lihat layanan paling laris, teknisi terbaik, dan peluang tumbuh.' },
          ].map(s => (
            <div key={s.n} style={{ textAlign:'center', position:'relative', zIndex:1 }}>
              <div style={{ width:56, height:56, background:C.primary, color:'#fff', borderRadius:'50%',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontFamily:'"Sora",system-ui,sans-serif', fontSize:22, fontWeight:800, margin:'0 auto 20px',
                boxShadow:`0 0 0 8px rgba(30,79,216,0.1)` }}>{s.n}</div>
              <div style={{ width:'100%', height:180, borderRadius:10, overflow:'hidden', marginBottom:20 }}>
                <img src={s.img} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
              </div>
              <div style={{ fontFamily:'"Sora",system-ui,sans-serif', fontSize:18, fontWeight:700, marginBottom:8, color:C.ink }}>{s.title}</div>
              <div style={{ fontSize:14, color:C.ink3, lineHeight:1.65 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── MARKETING KPI ── */}
      <section id="marketing-kpi" className="lp-section" style={{ padding:'100px 64px', background:'#fff' }}>
        <div style={{ marginBottom:48 }}>
          <span style={{ display:'inline-block', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'1.5px',
            color:C.primary, background:C.primary50, borderRadius:100, padding:'5px 14px', marginBottom:16 }}>Marketing KPI</span>
          <h2 style={{ fontFamily:'"Sora",system-ui,sans-serif', fontSize:'clamp(32px,3.5vw,44px)', fontWeight:800, letterSpacing:'-1px', lineHeight:1.12, color:C.ink, marginBottom:16 }}>
            Operasional Rapi,<br />Keputusan Marketing Lebih Terukur
          </h2>
          <p style={{ fontSize:18, color:C.ink3, maxWidth:620, lineHeight:1.7 }}>
            Lihat pertumbuhan booking, konversi selesai, repeat customer, dan margin layanan dari data harian bengkel.
          </p>
        </div>

        <div className="lp-grid-2" style={{ display:'grid', gridTemplateColumns:'0.82fr 1.18fr', gap:32, alignItems:'center' }}>
          <div>
            {[
              ['Naikkan booking dengan data', 'Pantau booking bulan ini dibanding bulan lalu dan lihat titik drop-off dari booking sampai lunas.'],
              ['Follow-up customer lebih tepat', 'Histori layanan dan garansi membantu tim tahu customer mana yang waktunya ditawarkan layanan lanjutan.'],
              ['Promo tidak menggerus margin', 'Layanan terlaris bisa dibandingkan dengan HPP material supaya owner tahu paket mana yang benar-benar profit.'],
            ].map(([title, text]) => (
              <div key={title} style={{ borderBottom:`1px solid ${C.line}`, padding:'18px 0' }}>
                <div style={{ fontFamily:'"Sora",system-ui,sans-serif', fontSize:16, fontWeight:800, color:C.ink, marginBottom:6 }}>{title}</div>
                <div style={{ fontSize:14, color:C.ink3, lineHeight:1.65 }}>{text}</div>
              </div>
            ))}
          </div>
          <MarketingKpiPreview />
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="harga" className="lp-section" style={{ padding:'100px 64px', background:C.primary50 }}>
        <div style={{ textAlign:'center', marginBottom:64 }}>
          <span style={{ display:'inline-block', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'1.5px',
            color:C.primary, background:C.primary100, borderRadius:100, padding:'5px 14px', marginBottom:16 }}>Harga</span>
          <h2 style={{ fontFamily:'"Sora",system-ui,sans-serif', fontSize:'clamp(28px,3.5vw,44px)', fontWeight:800, letterSpacing:'-1px', color:C.ink, marginBottom:16 }}>
            Investasi yang Tepat<br />untuk Workshop Anda
          </h2>
          <p style={{ fontSize:18, color:C.ink3, maxWidth:480, margin:'0 auto', lineHeight:1.7 }}>
            Mulai gratis, upgrade kapan saja. Tidak ada biaya setup, tidak ada kontrak panjang.
          </p>
        </div>

        <div className="lp-grid-2" style={{ display:'grid', gridTemplateColumns:'repeat(2,minmax(0,1fr))', gap:24, maxWidth:920, margin:'0 auto' }}>
          {(lp.plans || DEFAULT_CONTENT.plans).map((plan, i) => (
            <PlanCard key={i}
              name={plan.name} price={plan.price} period={plan.period}
              popular={plan.popular} badge={plan.badge}
              features={plan.features} btnText={plan.btnText}
              btnTo="/register" outline={!plan.popular} />
          ))}
        </div>

        <div style={{ maxWidth:920, margin:'32px auto 0', border:`1px solid ${C.primary100}`, background:'#fff', borderRadius:14, padding:24 }}>
          <div style={{ fontFamily:'"Sora",system-ui,sans-serif', fontSize:15, fontWeight:800, color:C.ink, marginBottom:10 }}>
            📋 Sedang dalam pengembangan untuk Pro:
          </div>
          <div className="lp-coming-soon-grid" style={{ display:'grid', gridTemplateColumns:'repeat(3,minmax(0,1fr))', gap:12 }}>
            {['WhatsApp blast & reminder otomatis','Multi-cabang support','Custom branding (white-label)'].map(item => (
              <div key={item} style={{ border:`1px solid ${C.line}`, borderRadius:10, padding:'12px 14px', fontSize:13, fontWeight:600, color:C.ink3, background:C.bg }}>{item}</div>
            ))}
          </div>
          <p style={{ marginTop:16, fontSize:14, color:C.primary, fontWeight:800 }}>💼 Punya bengkel besar / multi-cabang? Hubungi kami.</p>
        </div>
      </section>

      {/* ── CTA BANNER ── */}
      <div className="lp-cta" style={{
        background:`linear-gradient(135deg, #0E2A6E 0%, ${C.primary} 55%, #3B7DE8 100%)`,
        padding:'100px 64px', textAlign:'center', position:'relative', overflow:'hidden',
      }}>
        <div style={{ position:'absolute', inset:0,
          backgroundImage:"url('https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=1600&q=60')",
          backgroundSize:'cover', backgroundPosition:'center', opacity:0.07 }} />
        {/* accent glow */}
        <div style={{ position:'absolute', top:-200, right:'30%', width:400, height:400, borderRadius:'50%',
          background:`radial-gradient(circle, rgba(255,106,31,0.18) 0%, transparent 70%)` }} />
        <div style={{ position:'relative', zIndex:1 }}>
          <h2 style={{ fontFamily:'"Sora",system-ui,sans-serif', fontSize:'clamp(32px,4vw,48px)', fontWeight:800, color:'#fff', letterSpacing:'-1px', lineHeight:1.1, marginBottom:16, whiteSpace:'pre-line' }}>
            {cta.title}
          </h2>
          <p style={{ fontSize:18, color:'rgba(255,255,255,0.72)', marginBottom:40 }}>{cta.subtitle}</p>
          <Link to="/register" style={{
            fontFamily:'"Sora",system-ui,sans-serif', fontSize:16, fontWeight:800,
            background:'#fff', color:C.primary, border:'none',
            padding:'16px 40px', borderRadius:10, cursor:'pointer', textDecoration:'none',
            display:'inline-block', transition:'transform .15s',
          }}>{cta.btn}</Link>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <footer style={{ background:C.bg, padding:'48px 64px 32px', borderTop:`1px solid ${C.line}` }}>
        <div className="lp-footer-cols" style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:40, flexWrap:'wrap', gap:32 }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <img src="/workshopmu-logo.svg" alt="WorkshopMU" style={{ width:36, height:36 }} />
              <span style={{ fontFamily:'"Sora",system-ui,sans-serif', fontSize:17, fontWeight:700, letterSpacing:'-0.03em', color:C.ink }}>
                Workshop<span style={{ color:C.accent, fontWeight:800 }}>MU</span>
              </span>
            </div>
            <p style={{ fontSize:13, color:C.ink4, marginTop:8, maxWidth:260, lineHeight:1.6 }}>
              Platform manajemen workshop detailing & PPF terlengkap untuk bisnis otomotif Indonesia.
            </p>
          </div>
          <div style={{ display:'flex', gap:64, flexWrap:'wrap' }}>
            {[
              { title:'Produk', links:['Fitur','Harga','Changelog','API Docs'] },
              { title:'Perusahaan', links:['Tentang Kami','Blog','Karir','Kontak'] },
              { title:'Support', links:['Panduan','FAQ','Status','WhatsApp'] },
            ].map(col => (
              <div key={col.title}>
                <h4 style={{ fontSize:11, fontWeight:700, color:C.ink4, textTransform:'uppercase', letterSpacing:1, marginBottom:16 }}>{col.title}</h4>
                {col.links.map(l => (
                  <a key={l} href="#" style={{ display:'block', fontSize:14, color:C.ink3, textDecoration:'none', marginBottom:10, transition:'color .15s' }}
                    onMouseEnter={e => (e.currentTarget.style.color = C.ink)}
                    onMouseLeave={e => (e.currentTarget.style.color = C.ink3)}>
                    {l}
                  </a>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div style={{ borderTop:`1px solid ${C.line}`, paddingTop:24, display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12 }}>
          <p style={{ fontSize:13, color:C.ink4 }}>© 2026 WorkshopMU. All rights reserved.</p>
          <span style={{ fontFamily:'"JetBrains Mono",ui-monospace,monospace', fontSize:11, color:C.ink4 }}>React 18 · Node.js · PostgreSQL · AWS</span>
        </div>
      </footer>
    </div>
  )
}

/* ── Sub-components ─────────────────────────────────────────────────────── */

function MarketingKpiPreview() {
  const kpis = [
    { label:'Pertumbuhan Booking', value:'+24%', text:'Bulan ini vs bulan lalu', color:C.primary },
    { label:'Konversi Selesai', value:'78%', text:'Booking menjadi pekerjaan selesai', color:C.success },
    { label:'Repeat Customer', value:'31%', text:'Customer kembali layanan lanjutan', color:C.warning },
    { label:'Margin Terbaca', value:'67%', text:'Rp 18,4jt laba setelah HPP', color:'#0F766E' },
  ]
  const funnel = [
    ['Booking Masuk','120','100%'],
    ['Customer Datang','96','80%'],
    ['Pekerjaan Selesai','84','70%'],
    ['Lunas','72','60%'],
  ]
  const insights = [
    ['Layanan Terlaris','Full Detailing XL menjadi paket paling banyak selesai'],
    ['Pendapatan & HPP','Margin layanan terbaca dari omzet dikurangi HPP material'],
    ['Repeat Customer','Customer dengan riwayat layanan berulang terlihat di analitik'],
  ]

  return (
    <div className="lp-kpi-preview" style={{ border:`1px solid ${C.line}`, borderRadius:18, background:'#fff', padding:18, boxShadow:'0 24px 70px rgba(14,21,48,0.12)', overflow:'hidden' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:`1px solid ${C.line}`, paddingBottom:14, marginBottom:16 }}>
        <div>
          <p style={{ fontFamily:'"Sora",system-ui,sans-serif', fontSize:13, fontWeight:800, color:C.ink }}>Dashboard Marketing Bengkel</p>
          <p style={{ fontSize:11, color:C.ink3, marginTop:2 }}>Contoh visual KPI tenant</p>
        </div>
        <span style={{ borderRadius:999, background:'#DCFCE7', color:C.success, fontSize:10, fontWeight:800, padding:'5px 10px' }}>Live KPI</span>
      </div>

      <div className="lp-kpi-grid" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
        {kpis.map(kpi => (
          <div key={kpi.label} style={{ border:`1px solid ${C.line}`, borderRadius:10, background:'#FBFDFF', padding:12 }}>
            <p style={{ fontSize:10, fontWeight:800, textTransform:'uppercase', color:C.ink3, lineHeight:1.3 }}>{kpi.label}</p>
            <p className="lp-kpi-value" style={{ fontFamily:'"Sora",system-ui,sans-serif', marginTop:8, fontSize:26, fontWeight:900, lineHeight:1, color:kpi.color }}>{kpi.value}</p>
            <p style={{ marginTop:8, fontSize:10, lineHeight:1.45, color:C.ink3 }}>{kpi.text}</p>
          </div>
        ))}
      </div>

      <div className="lp-kpi-bottom" style={{ display:'grid', gridTemplateColumns:'0.9fr 1.1fr', gap:14, marginTop:14 }}>
        <div style={{ border:`1px solid ${C.line}`, borderRadius:10, padding:14 }}>
          <p style={{ fontFamily:'"Sora",system-ui,sans-serif', fontSize:12, fontWeight:800, color:C.ink, marginBottom:12 }}>Conversion Funnel</p>
          {funnel.map(([label, value, width]) => (
            <div key={label} style={{ marginBottom:10 }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, fontWeight:700, color:C.ink3, marginBottom:5 }}>
                <span>{label}</span><span>{value}</span>
              </div>
              <div style={{ height:8, borderRadius:999, background:C.line }}>
                <div style={{ height:8, borderRadius:999, background:C.primary, width }} />
              </div>
            </div>
          ))}
        </div>

        <div style={{ border:`1px solid ${C.line}`, borderRadius:10, padding:14 }}>
          <p style={{ fontFamily:'"Sora",system-ui,sans-serif', fontSize:12, fontWeight:800, color:C.ink, marginBottom:12 }}>Insight Analitik</p>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {insights.map(([title, text]) => (
              <div key={title} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, borderRadius:10, background:C.bg, padding:'10px 12px' }}>
                <div style={{ minWidth:0 }}>
                  <p style={{ fontSize:11, fontWeight:800, color:C.ink, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{title}</p>
                  <p style={{ fontSize:10, color:C.ink3, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', marginTop:2 }}>{text}</p>
                </div>
                <span style={{ flexShrink:0, width:8, height:8, borderRadius:999, background:C.primary }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function FeatureCard({ icon, title, desc, items }: { icon: string; title: string; desc: string; items: string[] }) {
  return (
    <div className="lp-feat-card" style={{ background:C.bg, border:`1px solid ${C.line}`, borderRadius:14, padding:32, transition:'border-color .2s,transform .2s' }}>
      <div style={{ width:48, height:48, background:C.primary50, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, marginBottom:16 }}>{icon}</div>
      <div style={{ fontFamily:'"Sora",system-ui,sans-serif', fontSize:17, fontWeight:700, color:C.ink, marginBottom:8 }}>{title}</div>
      <div style={{ fontSize:14, color:C.ink3, lineHeight:1.65 }}>{desc}</div>
      {items.length > 0 && (
        <ul style={{ listStyle:'none', marginTop:16, display:'flex', flexDirection:'column', gap:8 }}>
          {items.map(f => (
            <li key={f} style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:C.ink3 }}>
              <span style={{ width:18, height:18, background:C.success, color:'#fff', borderRadius:'50%', fontSize:10, fontWeight:800, display:'inline-flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>✓</span>
              {f}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function PlanCard({ name, price, period, popular, badge, features, btnText, btnTo, outline }: {
  name: string; price: string; period: string; popular?: boolean; badge?: string
  features: string[]; btnText: string; btnTo: string; outline?: boolean
}) {
  return (
    <div style={{
      background: popular ? C.primary : '#fff',
      border: popular ? `2px solid ${C.primary}` : `1.5px solid ${C.line}`,
      borderRadius:16, padding:'36px 32px', position:'relative',
      boxShadow: popular ? `0 8px 40px rgba(30,79,216,0.28)` : '0 2px 12px rgba(14,21,48,0.06)',
    }}>
      {badge && (
        <div style={{ position:'absolute', top:-12, left:'50%', transform:'translateX(-50%)',
          background:C.accent, color:'#fff', fontSize:11, fontWeight:700,
          padding:'4px 14px', borderRadius:100, textTransform:'uppercase', letterSpacing:'0.5px', whiteSpace:'nowrap' }}>{badge}</div>
      )}
      <div style={{ fontFamily:'"Sora",system-ui,sans-serif', fontSize:13, fontWeight:700, textTransform:'uppercase', letterSpacing:1, color: popular ? 'rgba(255,255,255,0.8)' : C.ink3, marginBottom:8 }}>{name}</div>
      <div style={{ fontFamily:'"Sora",system-ui,sans-serif', fontSize:40, fontWeight:800, color: popular ? '#fff' : C.ink, letterSpacing:'-1px', lineHeight:1, marginBottom:4 }}>
        <sub style={{ fontSize:16, fontWeight:500, verticalAlign:'baseline' }}>Rp </sub>{price}
      </div>
      <div style={{ fontSize:13, color: popular ? 'rgba(255,255,255,0.65)' : C.ink4, marginBottom:24 }}>{period}</div>
      {popular && (
        <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:24 }}>
          <div style={{ borderRadius:8, background:'rgba(255,255,255,0.14)', padding:'9px 10px', color:'#fff', fontSize:12, fontWeight:700 }}>
            Diskon 50% untuk 100 user pertama
          </div>
          <div style={{ borderRadius:8, background:'#FEF3C7', padding:'9px 10px', color:'#92400E', fontSize:12, fontWeight:800 }}>
            🎁 60 hari trial Pro untuk semua user baru
          </div>
        </div>
      )}
      <div style={{ height:1, background: popular ? 'rgba(255,255,255,0.2)' : C.line, marginBottom:24 }} />
      <ul style={{ listStyle:'none', display:'flex', flexDirection:'column', gap:12, marginBottom:32 }}>
        {features.map(f => (
          <li key={f} style={{ display:'flex', alignItems:'flex-start', gap:10, fontSize:14, color: popular ? 'rgba(255,255,255,0.9)' : C.ink2, lineHeight:1.4 }}>
            <span style={{ width:18, height:18, borderRadius:'50%',
              background: popular ? 'rgba(255,255,255,0.25)' : C.primary100,
              flexShrink:0, display:'inline-flex', alignItems:'center', justifyContent:'center',
              fontSize:9, color: popular ? '#fff' : C.primary, fontWeight:800, marginTop:1 }}>✓</span>
            {f}
          </li>
        ))}
      </ul>
      <Link to={btnTo} style={{
        display:'block', textAlign:'center', width:'100%',
        fontFamily:'"Sora",system-ui,sans-serif', fontSize:15, fontWeight:700,
        padding:'14px', borderRadius:9, cursor:'pointer', textDecoration:'none',
        background: popular ? '#fff' : outline ? 'transparent' : C.primary,
        color: popular ? C.primary : outline ? C.ink2 : '#fff',
        border: outline && !popular ? `1.5px solid ${C.line}` : 'none',
        boxSizing:'border-box',
      }}>{btnText}</Link>
    </div>
  )
}
