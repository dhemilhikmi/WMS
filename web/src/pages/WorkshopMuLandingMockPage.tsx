import { Link } from 'react-router-dom'

const blue = '#1E4FD8'
const amber = '#f59e0b'

const kpis = [
  ['Booking Bulanan', '+24%', 'Pertumbuhan booking dibanding bulan lalu', blue],
  ['Konversi Selesai', '78%', 'Booking yang menjadi pekerjaan selesai', '#16a34a'],
  ['Repeat Customer', '31%', 'Customer yang kembali untuk layanan lanjutan', amber],
  ['Margin Terbaca', '67%', 'Laba layanan setelah HPP material', '#0f766e'],
]

const features = [
  ['Booking & Kalender', 'Semua booking masuk, jadwal customer, dan slot kerja teknisi kebaca dalam satu layar.'],
  ['Layanan Berjalan', 'Terima customer, pilih teknisi, proses, QC, sampai selesai dengan status yang jelas.'],
  ['Stok & BOM Material', 'Kebutuhan material dari paket layanan dibandingkan dengan stok aktual sebelum pekerjaan dimulai.'],
  ['Penjualan & Pembayaran', 'Invoice, cicilan, lunas, dan riwayat transaksi tersimpan rapi tanpa hitung manual.'],
  ['Garansi Digital', 'Kartu garansi otomatis dari layanan selesai dan bisa diunduh sebagai JPG.'],
  ['Analitik Bengkel', 'Lihat pendapatan, HPP, pengeluaran, margin, top layanan, dan repeat customer.'],
]

const signals = [
  ['PPF Matte', 'Stok kurang untuk booking minggu ini', 'Buat PO'],
  ['Full Detailing', 'Margin paket di atas rata-rata bulan ini', 'Promosikan'],
  ['Coating 2 Tahun', 'Customer lama siap ditawari maintenance', 'Follow-up'],
]

function BrandMark() {
  return (
    <Link to="/" className="flex items-center gap-2 no-underline">
      <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#1e40af] text-[15px] font-black text-white">
        WM
      </span>
      <span className="text-[17px] font-black tracking-tight text-[#1e293b]">
        Workshop<span className="text-[#f59e0b]">Mu</span>
      </span>
    </Link>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 inline-flex rounded-full border border-[#D9E3FC] bg-white px-3 py-1 text-[11px] font-black uppercase tracking-[0.15em] text-[#1E4FD8]">
      {children}
    </p>
  )
}

export default function WorkshopMuLandingMockPage() {
  return (
    <div className="min-h-screen bg-white text-[#0f172a]">
      <header className="fixed inset-x-0 top-0 z-40 border-b border-[#e2e8f0] bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5">
          <BrandMark />
          <nav className="hidden items-center gap-7 text-[13px] font-semibold text-[#64748b] md:flex">
            <a href="#fitur">Fitur</a>
            <a href="#kpi">Marketing KPI</a>
            <a href="#harga">Harga</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login" className="rounded-md px-3 py-2 text-[13px] font-bold text-[#475569]">
              Masuk
            </Link>
            <Link to="/register" className="rounded-md bg-[#1E4FD8] px-4 py-2 text-[13px] font-bold text-white shadow-[0_10px_24px_rgba(37,99,235,0.25)]">
              Coba Gratis
            </Link>
          </div>
        </div>
      </header>

      <main className="pt-[72px]">
        <section className="relative overflow-hidden bg-[#f8fafc]">
          <img
            src="https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?w=1800&q=80"
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-[0.12]"
          />
          <div className="relative mx-auto grid min-h-[calc(100vh-72px)] max-w-7xl gap-10 px-5 py-12 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
            <div>
              <SectionLabel>Workshop management untuk detailing, coating, dan PPF</SectionLabel>
              <h1 className="max-w-2xl text-[40px] font-black leading-[1.04] tracking-tight text-[#0f172a] sm:text-[62px]">
                Atur booking, stok, teknisi, dan laporan bengkel jadi gampang.
              </h1>
              <p className="mt-5 max-w-xl text-[16px] leading-7 text-[#475569]">
                WorkshopMu membantu owner bengkel melihat pekerjaan harian, material yang kurang,
                pembayaran, garansi, sampai margin layanan tanpa pindah-pindah catatan.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link to="/register" className="rounded-md bg-[#1E4FD8] px-6 py-3 text-center text-[14px] font-black text-white shadow-[0_12px_30px_rgba(37,99,235,0.28)]">
                  Coba Pro Gratis 60 Hari
                </Link>
                <a href="#kpi" className="rounded-md border border-[#cbd5e1] bg-white px-6 py-3 text-center text-[14px] font-black text-[#334155]">
                  Lihat Nilai Bisnis
                </a>
              </div>
              <div className="mt-10 grid max-w-xl grid-cols-3 gap-3 border-t border-[#dbe3ee] pt-6">
                {[
                  ['50', 'Transaksi gratis/bulan'],
                  ['60 hari', 'Trial Pro otomatis'],
                  ['1 app', 'Desktop & mobile'],
                ].map(([num, label]) => (
                  <div key={label}>
                    <p className="text-[25px] font-black text-[#0f172a]">{num}</p>
                    <p className="text-[11px] font-semibold leading-4 text-[#64748b]">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-[#dbe3ee] bg-white p-4 shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
              <div className="mb-4 flex items-center justify-between border-b border-[#e2e8f0] pb-3">
                <div>
                  <p className="text-[13px] font-black">Dashboard Performa Bengkel</p>
                  <p className="text-[11px] text-[#64748b]">Contoh insight yang bisa dibaca owner</p>
                </div>
                <span className="rounded-full bg-[#fef3c7] px-2.5 py-1 text-[10px] font-black text-[#b45309]">
                  Workshop<span className="text-[#f59e0b]">Mu</span>
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {kpis.map(([label, value, text, color]) => (
                  <div key={label} className="rounded-md border border-[#e2e8f0] bg-[#fbfdff] p-3">
                    <p className="text-[10px] font-bold uppercase text-[#64748b]">{label}</p>
                    <p className="mt-1 text-[28px] font-black leading-tight" style={{ color }}>{value}</p>
                    <p className="mt-1 text-[10px] leading-4 text-[#64748b]">{text}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
                <div className="rounded-md border border-[#e2e8f0] p-3">
                  <p className="mb-3 text-[12px] font-black">Pendapatan & Pengeluaran</p>
                  {[
                    ['Pendapatan', 'Rp 66,3jt', blue],
                    ['HPP Material', 'Rp 21,9jt', amber],
                    ['Laba Setelah Pengeluaran', 'Rp 24,4jt', '#16a34a'],
                  ].map(([label, value, color]) => (
                    <div key={label} className="mb-2 flex items-center justify-between rounded bg-[#f8fafc] px-3 py-2">
                      <span className="text-[11px] font-semibold text-[#64748b]">{label}</span>
                      <span className="text-[13px] font-black" style={{ color }}>{value}</span>
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
            <SectionLabel>Operasional lengkap</SectionLabel>
            <h2 className="text-[34px] font-black tracking-tight text-[#0f172a]">
              Semua pekerjaan bengkel tersambung dari booking sampai laporan.
            </h2>
            <p className="mt-3 text-[15px] leading-7 text-[#64748b]">
              Copy dibuat praktis dan langsung ke value, sesuai owner SMB yang butuh cepat paham.
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

        <section id="kpi" className="bg-[#f8fafc] px-5 py-14">
          <div className="mx-auto max-w-7xl">
            <div className="mb-8 max-w-2xl">
              <SectionLabel>Marketing KPI</SectionLabel>
              <h2 className="text-[34px] font-black tracking-tight text-[#0f172a]">
                Bukan cuma mencatat order. WorkshopMu bantu owner melihat peluang tumbuh.
              </h2>
            </div>
            <div className="grid gap-4 lg:grid-cols-4">
              {kpis.map(([label, value, text, color]) => (
                <article key={label} className="rounded-lg border border-[#e2e8f0] bg-white p-5">
                  <p className="text-[11px] font-black uppercase tracking-wide text-[#64748b]">{label}</p>
                  <p className="mt-2 text-[32px] font-black" style={{ color }}>{value}</p>
                  <p className="mt-2 text-[13px] leading-6 text-[#64748b]">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="harga" className="mx-auto max-w-5xl px-5 py-14">
          <div className="mb-8 text-center">
            <SectionLabel>Harga</SectionLabel>
            <h2 className="text-[34px] font-black tracking-tight text-[#0f172a]">
              Mulai gratis, upgrade saat bengkel butuh analitik dan kontrol penuh.
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {[
              ['Starter', 'Rp 0', 'forever', ['Hingga 50 transaksi/bulan', '2 teknisi', 'Customer & inventaris unlimited', 'Laporan pendapatan dasar', 'Akses mobile web'], false],
              ['Pro', 'Rp 2.499.000', 'per tahun', ['Semua fitur Starter', 'Transaksi & teknisi unlimited', 'Setup HPP per layanan (BOM)', 'Laporan keuangan lengkap', 'Analitik bengkel', 'Priority support'], true],
            ].map(([name, price, period, items, featured]) => (
              <article key={name as string} className={`rounded-lg border p-6 ${featured ? 'border-[#1E4FD8] bg-[#EEF3FE]' : 'border-[#e2e8f0] bg-white'}`}>
                {featured && <p className="mb-3 inline-flex rounded-full bg-[#f59e0b] px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-white">Early adopter diskon 50%</p>}
                <h3 className="text-[20px] font-black">{name as string}</h3>
                <p className="mt-5 text-[34px] font-black text-[#0f172a]">{price as string}</p>
                <p className="text-[12px] font-semibold text-[#64748b]">{period as string}</p>
                <ul className="mt-5 space-y-2">
                  {(items as string[]).map(item => (
                    <li key={item} className="text-[13px] font-semibold text-[#475569]">- {item}</li>
                  ))}
                </ul>
                <Link to="/register" className={`mt-6 block rounded-md px-4 py-3 text-center text-[13px] font-black ${featured ? 'bg-[#1E4FD8] text-white' : 'border border-[#cbd5e1] bg-white text-[#334155]'}`}>
                  {featured ? 'Coba Pro Gratis 60 Hari' : 'Mulai Gratis'}
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section className="bg-[#1e40af] px-5 py-16 text-center text-white">
          <p className="mx-auto max-w-2xl text-[34px] font-black leading-tight">
            Workshop<span className="text-[#fbbf24]">Mu</span> — operasional rapi, profit lebih kebaca.
          </p>
          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-7 text-blue-100">
            Dibuat untuk bengkel yang ingin tumbuh dengan data, bukan feeling.
          </p>
          <Link to="/register" className="mt-7 inline-flex rounded-md bg-white px-6 py-3 text-[14px] font-black text-[#1e40af]">
            Coba Gratis Sekarang
          </Link>
        </section>
      </main>
    </div>
  )
}
