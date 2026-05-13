import { Link } from 'react-router-dom'

const kpis = [
  { label: 'Pertumbuhan Booking', value: '+24%', text: 'Booking bulan ini dibanding bulan lalu', color: '#1E4FD8' },
  { label: 'Konversi Selesai', value: '78%', text: 'Booking yang berubah menjadi pekerjaan selesai', color: '#16a34a' },
  { label: 'Repeat Customer', value: '31%', text: 'Customer yang kembali untuk layanan lanjutan', color: '#f59e0b' },
  { label: 'Margin Terbaca', value: '67%', text: 'Rp 18,4jt laba layanan setelah HPP', color: '#0f766e' },
]

const signals = [
  ['PPF Matte', 'Stok kurang 2 roll untuk booking minggu ini', 'Buat PO'],
  ['Coating 2 Tahun', 'Customer 11 bulan lalu siap ditawari maintenance', 'Follow-up'],
  ['Full Detailing XL', 'Margin lebih tinggi dari rata-rata paket lain', 'Promosikan'],
]

const features = [
  ['Booking & Kalender', 'Pantau booking masuk, customer datang, batal, dan jadwal pekerjaan dalam satu layar.'],
  ['Layanan Berjalan', 'Terima customer, pilih teknisi, proses pekerjaan, QC, sampai selesai dengan status yang jelas.'],
  ['Stok & BOM Material', 'Kebutuhan material dari paket layanan dibandingkan dengan stok aktual sebelum customer datang.'],
  ['Penjualan & Pembayaran', 'Invoice, status pembayaran, cicilan, lunas, dan riwayat transaksi tersimpan rapi.'],
  ['Garansi Digital', 'Kartu garansi otomatis dari layanan selesai, bisa di-print dan di-download sebagai JPG.'],
  ['Analitik Bengkel', 'Lihat pendapatan, HPP, pengeluaran, margin, top layanan, teknisi, dan repeat customer.'],
]

const outcomes = [
  {
    title: 'Marketing tidak lagi berdasarkan feeling',
    text: 'Owner tahu layanan mana yang paling sering dipilih, mana yang marginnya bagus, dan paket apa yang layak dipromosikan.',
    tag: 'Layanan terlaris + margin',
  },
  {
    title: 'Customer follow-up lebih tepat waktu',
    text: 'Histori layanan, kendaraan, dan garansi membantu tim tahu customer mana yang perlu dihubungi kembali.',
    tag: 'Repeat order + garansi',
  },
  {
    title: 'Stok siap sebelum pekerjaan dimulai',
    text: 'Booking mendatang dibaca terhadap BOM layanan agar material kurang muncul lebih awal dan bisa langsung dibuat PO.',
    tag: 'Booking + BOM + PO',
  },
]

const plans: Array<[string, string, string, string[]]> = [
  ['Starter', '0', 'Untuk mulai merapikan booking', ['20 order/bulan', '1 teknisi', 'Booking dasar', 'Laporan sederhana']],
  ['Pro', '499rb', 'Untuk bengkel yang ingin tumbuh terukur', ['Order tidak terbatas', 'Stok & BOM', 'Garansi digital', 'Analitik marketing']],
  ['Enterprise', '1,2jt', 'Untuk multi-cabang dan tim besar', ['Multi-cabang', 'Custom branding', 'Priority support', 'Onboarding tim']],
]

export default function MarketingValueMockPage() {
  return (
    <div className="min-h-screen bg-white text-[#0f172a]">
      <header className="fixed inset-x-0 top-0 z-30 border-b border-[#e2e8f0] bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5">
          <a href="#" className="flex items-center gap-2 no-underline">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#1E4FD8] text-[17px] font-black text-white">E</span>
            <span className="text-[16px] font-black text-[#1e293b]">Workshop<span className="text-[#f59e0b]">Mu</span></span>
          </a>
          <nav className="hidden items-center gap-7 text-[13px] font-semibold text-[#64748b] md:flex">
            <a href="#fitur">Fitur</a>
            <a href="#marketing">Marketing KPI</a>
            <a href="#harga">Harga</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login" className="rounded-md px-3 py-2 text-[13px] font-bold text-[#475569]">Masuk</Link>
            <Link to="/register" className="rounded-md bg-[#1E4FD8] px-4 py-2 text-[13px] font-bold text-white">Coba Gratis</Link>
          </div>
        </div>
      </header>

      <main className="pt-[72px]">
        <section className="relative overflow-hidden bg-[#f8fafc]">
          <img
            src="https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?w=1800&q=80"
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-[0.13]"
          />
          <div className="relative mx-auto grid min-h-[calc(100vh-72px)] max-w-7xl gap-8 px-5 py-12 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
            <div>
              <p className="mb-4 inline-flex rounded-full border border-[#D9E3FC] bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[#1E4FD8]">
                Workshop management untuk detailing, coating, dan PPF
              </p>
              <h1 className="max-w-2xl text-[40px] font-black leading-[1.04] tracking-tight text-[#0f172a] sm:text-[60px]">
                Kelola bengkel, naikkan booking, dan ukur profit dari satu dashboard.
              </h1>
              <p className="mt-5 max-w-xl text-[16px] leading-7 text-[#475569]">
                WorkshopMu membantu tenant mengelola booking, pekerjaan, teknisi, stok material, invoice,
                garansi, dan analitik marketing yang langsung bisa dipakai untuk mengambil keputusan.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link to="/register" className="rounded-md bg-[#1E4FD8] px-6 py-3 text-center text-[14px] font-black text-white shadow-[0_12px_30px_rgba(37,99,235,0.28)]">
                  Coba Gratis 14 Hari
                </Link>
                <a href="#marketing" className="rounded-md border border-[#cbd5e1] bg-white px-6 py-3 text-center text-[14px] font-black text-[#334155]">
                  Lihat Nilai Bisnis
                </a>
              </div>
              <div className="mt-10 grid max-w-xl grid-cols-3 gap-3 border-t border-[#dbe3ee] pt-6">
                {[
                  ['3x', 'Lebih rapi'],
                  ['24/7', 'Booking tercatat'],
                  ['1 app', 'Desktop & mobile'],
                ].map(([num, label]) => (
                  <div key={label}>
                    <p className="text-[26px] font-black text-[#0f172a]">{num}</p>
                    <p className="text-[11px] font-semibold text-[#64748b]">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-[#dbe3ee] bg-white p-4 shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
              <div className="mb-4 flex items-center justify-between border-b border-[#e2e8f0] pb-3">
                <div>
                  <p className="text-[13px] font-black">Dashboard Performa Bengkel</p>
                  <p className="text-[11px] text-[#64748b]">Contoh tampilan tenant</p>
                </div>
                <span className="rounded-full bg-[#dcfce7] px-2.5 py-1 text-[10px] font-bold text-[#16a34a]">Live KPI</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {kpis.map(kpi => (
                  <div key={kpi.label} className="rounded-md border border-[#e2e8f0] bg-[#fbfdff] p-3">
                    <p className="text-[10px] font-bold uppercase text-[#64748b]">{kpi.label}</p>
                    <p className="mt-1 text-[27px] font-black leading-tight" style={{ color: kpi.color }}>{kpi.value}</p>
                    <p className="mt-1 text-[10px] leading-4 text-[#64748b]">{kpi.text}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
                <div className="rounded-md border border-[#e2e8f0] p-3">
                  <p className="mb-3 text-[12px] font-black">Conversion Funnel</p>
                  {[
                    ['Booking Masuk', '120', '100%'],
                    ['Customer Datang', '96', '80%'],
                    ['Pekerjaan Selesai', '84', '70%'],
                    ['Lunas', '72', '60%'],
                  ].map(([label, value, width]) => (
                    <div key={label} className="mb-2.5">
                      <div className="mb-1 flex justify-between text-[10px] font-semibold text-[#475569]">
                        <span>{label}</span>
                        <span>{value}</span>
                      </div>
                      <div className="h-2 rounded-full bg-[#e2e8f0]">
                        <div className="h-2 rounded-full bg-[#1E4FD8]" style={{ width }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="rounded-md border border-[#e2e8f0] p-3">
                  <p className="mb-3 text-[12px] font-black">Sinyal Hari Ini</p>
                  <div className="space-y-2">
                    {signals.map(([title, text, action]) => (
                      <div key={title} className="flex items-center justify-between gap-3 rounded-md bg-[#f8fafc] px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-[11px] font-bold text-[#0f172a]">{title}</p>
                          <p className="truncate text-[10px] text-[#64748b]">{text}</p>
                        </div>
                        <span className="shrink-0 rounded bg-white px-2 py-1 text-[10px] font-bold text-[#1E4FD8]">{action}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-[#e2e8f0] bg-white">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-10 gap-y-3 px-5 py-5">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#94a3b8]">Cocok untuk</p>
            {['Detailing studio', 'PPF installer', 'Coating specialist', 'Car wash premium', 'Workshop multi-cabang'].map(item => (
              <span key={item} className="rounded-full border border-[#e2e8f0] px-3 py-1.5 text-[12px] font-bold text-[#64748b]">{item}</span>
            ))}
          </div>
        </section>

        <section id="fitur" className="mx-auto max-w-7xl px-5 py-14">
          <div className="mb-8 max-w-2xl">
            <p className="text-[12px] font-black uppercase tracking-[0.16em] text-[#1E4FD8]">Operasional lengkap</p>
            <h2 className="mt-2 text-[34px] font-black tracking-tight text-[#0f172a]">Semua pekerjaan bengkel tersambung dari booking sampai laporan.</h2>
            <p className="mt-3 text-[15px] leading-7 text-[#64748b]">
              Landing page utama menjual fitur, mock ini menambahkan hasil terukurnya: data operasional berubah menjadi data penjualan.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {features.map(([title, text]) => (
              <article key={title} className="rounded-lg border border-[#e2e8f0] bg-white p-5">
                <h3 className="text-[16px] font-black text-[#0f172a]">{title}</h3>
                <p className="mt-2 text-[13px] leading-6 text-[#64748b]">{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="marketing" className="bg-[#f8fafc] px-5 py-14">
          <div className="mx-auto max-w-7xl">
            <div className="mb-8 max-w-2xl">
              <p className="text-[12px] font-black uppercase tracking-[0.16em] text-[#1E4FD8]">Marketing KPI</p>
              <h2 className="mt-2 text-[34px] font-black tracking-tight text-[#0f172a]">Bukan cuma mencatat order. WorkshopMu membantu tenant melihat peluang tumbuh.</h2>
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              {outcomes.map(item => (
                <article key={item.title} className="rounded-lg border border-[#e2e8f0] bg-white p-5">
                  <p className="mb-4 inline-flex rounded bg-[#EEF3FE] px-2 py-1 text-[10px] font-black uppercase tracking-wide text-[#1E4FD8]">{item.tag}</p>
                  <h3 className="text-[18px] font-black text-[#0f172a]">{item.title}</h3>
                  <p className="mt-2 text-[13px] leading-6 text-[#64748b]">{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#0f172a] px-5 py-14 text-white">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
            <div>
              <p className="text-[12px] font-black uppercase tracking-[0.16em] text-[#93c5fd]">Alur nilai bisnis</p>
              <h2 className="mt-2 text-[32px] font-black tracking-tight">Dari booking hari ini menjadi keputusan marketing bulan depan.</h2>
              <p className="mt-4 text-[14px] leading-7 text-[#cbd5e1]">
                Tenant bisa melihat funnel booking, margin per layanan, stok yang perlu dibeli, dan customer yang perlu di-follow-up.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              {['Booking', 'Pekerjaan', 'Material', 'Invoice', 'Garansi', 'Analitik', 'Follow-up', 'Repeat order'].map((step, i) => (
                <div key={step} className="rounded-lg border border-white/10 bg-white/5 p-4">
                  <p className="text-[10px] font-black text-[#93c5fd]">{String(i + 1).padStart(2, '0')}</p>
                  <p className="mt-2 text-[13px] font-black">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="harga" className="mx-auto max-w-7xl px-5 py-14">
          <div className="mb-8 text-center">
            <p className="text-[12px] font-black uppercase tracking-[0.16em] text-[#1E4FD8]">Harga</p>
            <h2 className="mt-2 text-[34px] font-black tracking-tight text-[#0f172a]">Mulai dari operasional rapi, naik ke bisnis yang terukur.</h2>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {plans.map(([name, price, desc, items], i) => (
              <article key={name} className={`rounded-lg border p-6 ${i === 1 ? 'border-[#1E4FD8] bg-[#EEF3FE]' : 'border-[#e2e8f0] bg-white'}`}>
                {i === 1 && <p className="mb-3 inline-flex rounded-full bg-[#1E4FD8] px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-white">Paling cocok</p>}
                <h3 className="text-[20px] font-black">{name}</h3>
                <p className="mt-1 text-[13px] text-[#64748b]">{desc}</p>
                <p className="mt-5 text-[34px] font-black text-[#0f172a]">Rp {price}</p>
                <p className="text-[11px] text-[#64748b]">per bulan</p>
                <ul className="mt-5 space-y-2">
                  {(items as string[]).map(item => (
                    <li key={item} className="text-[13px] font-semibold text-[#475569]">- {item}</li>
                  ))}
                </ul>
                <Link to="/register" className={`mt-6 block rounded-md px-4 py-3 text-center text-[13px] font-black ${i === 1 ? 'bg-[#1E4FD8] text-white' : 'border border-[#cbd5e1] bg-white text-[#334155]'}`}>
                  Coba Paket Ini
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section className="relative overflow-hidden bg-[#1E4FD8] px-5 py-16 text-center text-white">
          <img
            src="https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=1800&q=70"
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-10"
          />
          <div className="relative mx-auto max-w-3xl">
            <h2 className="text-[34px] font-black tracking-tight">Siap ubah aktivitas harian bengkel menjadi data penjualan?</h2>
            <p className="mx-auto mt-3 max-w-2xl text-[15px] leading-7 text-white/80">
              Gunakan WorkshopMu untuk merapikan operasional, lalu pakai datanya untuk menaikkan booking, repeat order, dan margin layanan.
            </p>
            <Link to="/register" className="mt-7 inline-flex rounded-md bg-white px-6 py-3 text-[14px] font-black text-[#1E4FD8]">
              Mulai Coba Gratis
            </Link>
          </div>
        </section>
      </main>
    </div>
  )
}

