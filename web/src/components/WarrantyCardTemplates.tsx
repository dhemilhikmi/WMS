// Shared warranty card templates — dipakai di GaransiPage dan DocumentsPage

export interface CardDesign {
  workshopName: string
  tagline: string
  primaryColor: string
  secondaryColor: string
  logoUrl: string
  footerText: string
  templateId: string
}

export const DEFAULT_DESIGN: CardDesign = {
  workshopName: '',
  tagline: 'Kami menjamin kualitas terbaik untuk kendaraan Anda',
  primaryColor: '#1E4FD8',
  secondaryColor: '#1e40af',
  logoUrl: '',
  footerText: 'Garansi berlaku sesuai ketentuan yang tertera. Hubungi kami jika ada pertanyaan.',
  templateId: 'classic',
}

export interface CardTemplate {
  id: string
  name: string
  defaultPrimary: string
  defaultSecondary: string
  previewBg: string
}

export const CARD_TEMPLATES: CardTemplate[] = [
  { id: 'classic',  name: 'Classic',    defaultPrimary: '#1E4FD8', defaultSecondary: '#1e40af', previewBg: 'linear-gradient(135deg,#1E4FD8,#1e40af)' },
  { id: 'noir',     name: 'Noir',       defaultPrimary: '#18181b', defaultSecondary: '#27272a', previewBg: 'linear-gradient(135deg,#18181b,#27272a)' },
  { id: 'rosegold', name: 'Rose Gold',  defaultPrimary: '#be185d', defaultSecondary: '#9d174d', previewBg: 'linear-gradient(135deg,#be185d,#9d174d)' },
  { id: 'forest',   name: 'Forest',     defaultPrimary: '#065f46', defaultSecondary: '#064e3b', previewBg: 'linear-gradient(135deg,#065f46,#064e3b)' },
  { id: 'slate',    name: 'Slate Tech', defaultPrimary: '#334155', defaultSecondary: '#1e293b', previewBg: 'linear-gradient(135deg,#334155,#1e293b)' },
  { id: 'ivory',    name: 'Ivory',      defaultPrimary: '#1E4FD8', defaultSecondary: '#1e40af', previewBg: '#f8fafc' },
]

export const CARD_W = 342
export const CARD_H = 216

export function shortDate(d: string) {
  const dt = new Date(d)
  const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des']
  return `${String(dt.getDate()).padStart(2,'0')} ${months[dt.getMonth()]} ${String(dt.getFullYear()).slice(-2)}`
}

function LogoBox({ url, bg, size = 22 }: { url: string; bg: string; size?: number }) {
  return url ? (
    <img src={url} alt="logo" style={{ height: size, width: size, borderRadius: 5, objectFit: 'cover', background: '#fff', flexShrink: 0 }} />
  ) : (
    <div style={{ height: size, width: size, borderRadius: 5, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.55, flexShrink: 0 }}>🛡</div>
  )
}

function CardClassic({ warranty, design, days, isActive }: any) {
  return (
    <div style={{ width: CARD_W, height: CARD_H, borderRadius: 14, overflow: 'hidden', fontFamily: "'Segoe UI',Arial,sans-serif", boxShadow: '0 12px 40px rgba(0,0,0,0.22)', position: 'relative', background: `linear-gradient(135deg,${design.primaryColor},${design.secondaryColor})`, color: '#fff', userSelect: 'none' }}>
      <div style={{ position:'absolute', top:-30, right:-30, width:120, height:120, borderRadius:'50%', background:'rgba(255,255,255,0.07)' }} />
      <div style={{ position:'absolute', bottom:-20, left:60, width:90, height:90, borderRadius:'50%', background:'rgba(255,255,255,0.05)' }} />
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 14px 0', position:'relative', zIndex:1 }}>
        <div style={{ display:'flex', alignItems:'center', gap:7 }}>
          <LogoBox url={design.logoUrl} bg="rgba(255,255,255,0.2)" />
          <span style={{ fontSize:11, fontWeight:800, letterSpacing:'0.3px' }}>{design.workshopName || 'Workshop'}</span>
        </div>
      </div>
      <div style={{ padding:'8px 14px 4px', position:'relative', zIndex:1, fontSize:9, color:'rgba(255,255,255,0.6)', letterSpacing:'0.5px' }}>KARTU GARANSI DIGITAL</div>
      <div style={{ padding:'0 14px', position:'relative', zIndex:1, fontSize:15, fontWeight:800, letterSpacing:'0.5px', textTransform:'uppercase', textShadow:'0 1px 4px rgba(0,0,0,0.2)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{warranty.customer.name}</div>
      <div style={{ display:'flex', gap:8, padding:'5px 14px', position:'relative', zIndex:1 }}>
        {[['LAYANAN', warranty.workshop.title], ['KENDARAAN', `${warranty.registration.vehicleName || '—'}${warranty.registration.licensePlate ? ' · '+warranty.registration.licensePlate : ''}`]].map(([label, val]) => (
          <div key={label} style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:8, color:'rgba(255,255,255,0.55)', marginBottom:1 }}>{label}</div>
            <div style={{ fontSize:10, fontWeight:700, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{val}</div>
          </div>
        ))}
      </div>
      <div style={{ position:'absolute', bottom:0, left:0, right:0, background:'rgba(0,0,0,0.25)', backdropFilter:'blur(4px)', padding:'7px 14px', display:'flex', alignItems:'center', justifyContent:'space-between', zIndex:2 }}>
        <div style={{ fontSize:11, fontWeight:700, letterSpacing:'2px' }}>{warranty.code}</div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontSize:8, color:'rgba(255,255,255,0.55)' }}>BERLAKU</div>
          <div style={{ fontSize:10, fontWeight:600, color: isActive&&days<=7?'#fca5a5':'#fff' }}>{shortDate(warranty.startDate)} — {shortDate(warranty.endDate)}</div>
        </div>
      </div>
    </div>
  )
}

function CardNoir({ warranty, design, days, isActive }: any) {
  const accent = design.primaryColor === '#18181b' ? '#d4a843' : design.primaryColor
  return (
    <div style={{ width:CARD_W, height:CARD_H, borderRadius:14, overflow:'hidden', fontFamily:"'Segoe UI',Arial,sans-serif", boxShadow:'0 12px 40px rgba(0,0,0,0.5)', position:'relative', background:`linear-gradient(160deg,${design.primaryColor} 0%,${design.secondaryColor} 100%)`, color:'#fff', userSelect:'none' }}>
      <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:`linear-gradient(90deg,transparent,${accent},transparent)` }} />
      <div style={{ position:'absolute', inset:0, backgroundImage:'radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)', backgroundSize:'18px 18px' }} />
      <div style={{ position:'relative', zIndex:1, height:'100%', display:'flex', flexDirection:'column', padding:'14px 16px 0' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <LogoBox url={design.logoUrl} bg={`${accent}33`} size={20} />
            <div>
              <div style={{ fontSize:11, fontWeight:800, color:'#fff', letterSpacing:'0.5px' }}>{design.workshopName || 'Workshop'}</div>
              <div style={{ fontSize:8, color:'rgba(255,255,255,0.4)', letterSpacing:'1px' }}>KARTU GARANSI</div>
            </div>
          </div>
        </div>
        <div style={{ fontSize:17, fontWeight:800, letterSpacing:'1px', textTransform:'uppercase', color:'#fff', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', marginBottom:6 }}>{warranty.customer.name}</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px 12px', flex:1 }}>
          {[['LAYANAN', warranty.workshop.title], ['KENDARAAN', `${warranty.registration.vehicleName||'—'}${warranty.registration.licensePlate?' · '+warranty.registration.licensePlate:''}`], ['MULAI', shortDate(warranty.startDate)], ['BERAKHIR', shortDate(warranty.endDate)]].map(([label, val]) => (
            <div key={label}>
              <div style={{ fontSize:8, color:'rgba(255,255,255,0.35)', letterSpacing:'1px', marginBottom:1 }}>{label}</div>
              <div style={{ fontSize:10, fontWeight:600, color: label==='BERAKHIR'&&isActive&&days<=7?'#fca5a5':'rgba(255,255,255,0.85)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{val}</div>
            </div>
          ))}
        </div>
        <div style={{ borderTop:`1px solid rgba(255,255,255,0.08)`, marginTop:6, paddingTop:6, paddingBottom:10, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontSize:11, fontWeight:700, letterSpacing:'2.5px', color:accent }}>{warranty.code}</div>
          <div style={{ fontSize:8, color:'rgba(255,255,255,0.3)', letterSpacing:'0.5px' }}>WARRANTY CARD</div>
        </div>
      </div>
    </div>
  )
}

function CardRoseGold({ warranty, design, days, isActive }: any) {
  const gold = '#e8c97e'
  return (
    <div style={{ width:CARD_W, height:CARD_H, borderRadius:14, overflow:'hidden', fontFamily:"'Segoe UI',Arial,sans-serif", boxShadow:'0 12px 40px rgba(190,24,93,0.35)', position:'relative', background:`linear-gradient(135deg,${design.primaryColor} 0%,${design.secondaryColor} 100%)`, color:'#fff', userSelect:'none' }}>
      <div style={{ position:'absolute', inset:0, background:'linear-gradient(45deg,rgba(255,255,255,0) 40%,rgba(255,255,255,0.06) 50%,rgba(255,255,255,0) 60%)' }} />
      <div style={{ position:'absolute', top:-50, right:-50, width:180, height:180, borderRadius:'50%', background:'rgba(255,255,255,0.06)' }} />
      <div style={{ position:'absolute', bottom:-40, left:-20, width:100, height:100, borderRadius:'50%', background:'rgba(255,255,255,0.04)' }} />
      <div style={{ position:'relative', zIndex:1, height:'100%', display:'flex', flexDirection:'column', padding:'12px 14px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
          <div style={{ display:'flex', alignItems:'center', gap:7 }}>
            <LogoBox url={design.logoUrl} bg="rgba(255,255,255,0.2)" size={20} />
            <div style={{ fontSize:11, fontWeight:800, letterSpacing:'0.3px', color:'#fff' }}>{design.workshopName||'Workshop'}</div>
          </div>
        </div>
        <div style={{ height:1, background:`linear-gradient(90deg,${gold}00,${gold}88,${gold}00)`, marginBottom:8 }} />
        <div style={{ fontSize:8, color:'rgba(255,255,255,0.5)', letterSpacing:'1.5px', marginBottom:2 }}>NAMA PEMILIK</div>
        <div style={{ fontSize:16, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.5px', color:'#fff', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', marginBottom:8 }}>{warranty.customer.name}</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'4px 10px', flex:1 }}>
          {[['LAYANAN', warranty.workshop.title], ['KENDARAAN', `${warranty.registration.vehicleName||'—'}${warranty.registration.licensePlate?' · '+warranty.registration.licensePlate:''}`]].map(([l,v]) => (
            <div key={l}>
              <div style={{ fontSize:8, color:'rgba(255,255,255,0.45)', letterSpacing:'0.8px' }}>{l}</div>
              <div style={{ fontSize:10, fontWeight:700, color:'#fff', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', paddingTop:6 }}>
          <div>
            <div style={{ fontSize:8, color:gold, letterSpacing:'1px', marginBottom:1 }}>KODE GARANSI</div>
            <div style={{ fontSize:11, fontWeight:700, letterSpacing:'2px', color:gold }}>{warranty.code}</div>
          </div>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:8, color:'rgba(255,255,255,0.45)' }}>BERLAKU S/D</div>
            <div style={{ fontSize:10, fontWeight:700, color: isActive&&days<=7?'#fca5a5':'#fff' }}>{shortDate(warranty.endDate)}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function CardForest({ warranty, design, days, isActive }: any) {
  return (
    <div style={{ width:CARD_W, height:CARD_H, borderRadius:14, overflow:'hidden', fontFamily:"'Segoe UI',Arial,sans-serif", boxShadow:'0 12px 40px rgba(6,95,70,0.4)', position:'relative', background:`linear-gradient(150deg,${design.primaryColor} 0%,${design.secondaryColor} 100%)`, color:'#fff', userSelect:'none' }}>
      <svg style={{ position:'absolute', bottom:0, left:0, right:0, zIndex:0 }} viewBox="0 0 342 80" preserveAspectRatio="none" width="342" height="80">
        <path d="M0,40 C60,10 120,70 180,40 C240,10 300,60 342,35 L342,80 L0,80 Z" fill="rgba(255,255,255,0.05)" />
        <path d="M0,55 C80,30 160,70 240,45 C290,30 320,55 342,50 L342,80 L0,80 Z" fill="rgba(255,255,255,0.04)" />
      </svg>
      <div style={{ position:'absolute', top:-20, right:-20, width:100, height:100, borderRadius:'0 14px 0 100%', background:'rgba(255,255,255,0.06)' }} />
      <div style={{ position:'relative', zIndex:1, height:'100%', display:'flex', flexDirection:'column', padding:'12px 14px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
          <div style={{ display:'flex', alignItems:'center', gap:7 }}>
            <LogoBox url={design.logoUrl} bg="rgba(255,255,255,0.2)" size={20} />
            <div>
              <div style={{ fontSize:11, fontWeight:800 }}>{design.workshopName||'Workshop'}</div>
              <div style={{ fontSize:8, color:'rgba(255,255,255,0.5)', letterSpacing:'0.8px' }}>KARTU GARANSI</div>
            </div>
          </div>
        </div>
        <div style={{ height:1, background:'rgba(255,255,255,0.15)', marginBottom:8 }} />
        <div style={{ fontSize:16, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.5px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', marginBottom:6 }}>{warranty.customer.name}</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'5px 10px', flex:1 }}>
          {[['LAYANAN', warranty.workshop.title], ['KENDARAAN', `${warranty.registration.vehicleName||'—'}${warranty.registration.licensePlate?' · '+warranty.registration.licensePlate:''}`], ['MULAI', shortDate(warranty.startDate)], ['BERAKHIR', shortDate(warranty.endDate)]].map(([l,v]) => (
            <div key={l}>
              <div style={{ fontSize:8, color:'rgba(255,255,255,0.45)', letterSpacing:'0.8px', marginBottom:1 }}>{l}</div>
              <div style={{ fontSize:10, fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', color: l==='BERAKHIR'&&isActive&&days<=7?'#fca5a5':'#fff' }}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{ borderTop:'1px solid rgba(255,255,255,0.12)', paddingTop:6, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontSize:11, fontWeight:700, letterSpacing:'2px', color:'rgba(255,255,255,0.9)' }}>{warranty.code}</div>
          <div style={{ fontSize:8, color:'rgba(255,255,255,0.35)' }}>GARANSI DIGITAL</div>
        </div>
      </div>
    </div>
  )
}

function CardSlate({ warranty, design, days, isActive }: any) {
  const accent = design.primaryColor === '#334155' ? '#38bdf8' : design.primaryColor
  return (
    <div style={{ width:CARD_W, height:CARD_H, borderRadius:14, overflow:'hidden', fontFamily:"'Segoe UI',Arial,sans-serif", boxShadow:'0 12px 40px rgba(0,0,0,0.4)', position:'relative', background:`linear-gradient(150deg,${design.primaryColor},${design.secondaryColor})`, color:'#fff', userSelect:'none' }}>
      <div style={{ position:'absolute', inset:0, backgroundImage:'repeating-linear-gradient(0deg,rgba(255,255,255,0.015) 0px,rgba(255,255,255,0.015) 1px,transparent 1px,transparent 8px)' }} />
      <div style={{ position:'absolute', top:0, right:0, width:60, height:60, background:`linear-gradient(225deg,${accent}33,transparent)` }} />
      <div style={{ position:'absolute', top:0, right:0, width:3, height:40, background:accent }} />
      <div style={{ position:'absolute', top:0, right:0, width:40, height:3, background:accent }} />
      <div style={{ position:'relative', zIndex:1, height:'100%', display:'flex', flexDirection:'column', padding:'12px 14px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
          <div style={{ display:'flex', alignItems:'center', gap:7 }}>
            <LogoBox url={design.logoUrl} bg={`${accent}22`} size={20} />
            <div>
              <div style={{ fontSize:11, fontWeight:800, letterSpacing:'0.5px' }}>{design.workshopName||'Workshop'}</div>
              <div style={{ fontSize:8, color:accent, letterSpacing:'1.5px' }}>KARTU GARANSI</div>
            </div>
          </div>
        </div>
        <div style={{ fontSize:17, fontWeight:800, textTransform:'uppercase', letterSpacing:'1px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', color:'#fff', marginBottom:8 }}>{warranty.customer.name}</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'5px 12px', flex:1 }}>
          {[['LAYANAN', warranty.workshop.title], ['KENDARAAN', `${warranty.registration.vehicleName||'—'}${warranty.registration.licensePlate?' · '+warranty.registration.licensePlate:''}`], ['MULAI', shortDate(warranty.startDate)], ['BERAKHIR', shortDate(warranty.endDate)]].map(([l,v]) => (
            <div key={l}>
              <div style={{ fontSize:8, color:'rgba(255,255,255,0.4)', letterSpacing:'1px', marginBottom:1 }}>{l}</div>
              <div style={{ fontSize:10, fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', color: l==='BERAKHIR'&&isActive&&days<=7?'#fca5a5':'rgba(255,255,255,0.9)' }}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', borderTop:`1px solid rgba(255,255,255,0.08)`, paddingTop:6 }}>
          <div style={{ fontSize:11, fontWeight:700, letterSpacing:'2.5px', color:accent, fontVariantNumeric:'tabular-nums' }}>{warranty.code}</div>
          <div style={{ fontSize:8, color:'rgba(255,255,255,0.25)', letterSpacing:'0.5px' }}>DIGITAL WARRANTY</div>
        </div>
      </div>
    </div>
  )
}

function CardIvory({ warranty, design, days, isActive }: any) {
  const accentColor = design.primaryColor
  return (
    <div style={{ width:CARD_W, height:CARD_H, borderRadius:14, overflow:'hidden', fontFamily:"'Segoe UI',Arial,sans-serif", boxShadow:'0 12px 40px rgba(0,0,0,0.14)', position:'relative', background:'#f8fafc', color:'#111', userSelect:'none', display:'flex' }}>
      <div style={{ width:8, flexShrink:0, background:`linear-gradient(180deg,${accentColor},${design.secondaryColor})` }} />
      <div style={{ flex:1, display:'flex', flexDirection:'column', padding:'12px 14px 10px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
          <div style={{ display:'flex', alignItems:'center', gap:7 }}>
            <LogoBox url={design.logoUrl} bg={`${accentColor}18`} size={20} />
            <div>
              <div style={{ fontSize:11, fontWeight:800, color:'#111', letterSpacing:'0.3px' }}>{design.workshopName||'Workshop'}</div>
              <div style={{ fontSize:8, color:'#94a3b8', letterSpacing:'0.8px' }}>KARTU GARANSI DIGITAL</div>
            </div>
          </div>
        </div>
        <div style={{ height:1, background:'#e2e8f0', marginBottom:8 }} />
        <div style={{ fontSize:8, color:'#94a3b8', letterSpacing:'1px', marginBottom:2 }}>NAMA PEMILIK</div>
        <div style={{ fontSize:15, fontWeight:800, textTransform:'uppercase', color:`${accentColor}`, letterSpacing:'0.5px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', marginBottom:8 }}>{warranty.customer.name}</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'4px 10px', flex:1 }}>
          {[['LAYANAN', warranty.workshop.title, '#111'], ['KENDARAAN', `${warranty.registration.vehicleName||'—'}${warranty.registration.licensePlate?' · '+warranty.registration.licensePlate:''}`, '#111'], ['MULAI', shortDate(warranty.startDate), '#555'], ['BERAKHIR', shortDate(warranty.endDate), isActive&&days<=7?'#dc2626':'#555']].map(([l,v,c]) => (
            <div key={l as string}>
              <div style={{ fontSize:8, color:'#94a3b8', letterSpacing:'0.8px', marginBottom:1 }}>{l}</div>
              <div style={{ fontSize:10, fontWeight:700, color: c as string, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{ borderTop:'1px solid #e2e8f0', paddingTop:6, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontSize:11, fontWeight:800, letterSpacing:'2px', color:accentColor }}>{warranty.code}</div>
          <div style={{ fontSize:8, color:'#cbd5e1' }}>ID-1 · ISO 7810</div>
        </div>
      </div>
    </div>
  )
}

export function WarrantyCard({ warranty, design }: { warranty: any; design: CardDesign }) {
  const days     = Math.ceil((new Date(warranty.endDate).getTime() - Date.now()) / 86400000)
  const isActive = warranty.status === 'active'
  const props    = { warranty, design, days, isActive }
  switch (design.templateId) {
    case 'noir':     return <CardNoir     {...props} />
    case 'rosegold': return <CardRoseGold {...props} />
    case 'forest':   return <CardForest  {...props} />
    case 'slate':    return <CardSlate   {...props} />
    case 'ivory':    return <CardIvory   {...props} />
    default:         return <CardClassic {...props} />
  }
}
