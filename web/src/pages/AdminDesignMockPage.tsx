const statCards = [
  {
    label: 'Booking Hari Ini',
    value: '24',
    note: '+6 dari kemarin',
    tone: 'text-teal-700 bg-teal-50 border-teal-100',
  },
  {
    label: 'Check-in Selesai',
    value: '18',
    note: '75% sudah diproses',
    tone: 'text-slate-900 bg-white border-slate-200',
  },
  {
    label: 'Pendapatan Harian',
    value: 'Rp4,8jt',
    note: 'Dominan dari detailing',
    tone: 'text-amber-700 bg-amber-50 border-amber-100',
  },
]

const todayQueue = [
  {
    customer: 'Rizky Pratama',
    service: 'Detailing Premium',
    time: '09.00',
    vehicle: 'HR-V B 2145 KCI',
    status: 'Checked in',
    statusTone: 'bg-emerald-100 text-emerald-700',
  },
  {
    customer: 'Nadia Putri',
    service: 'Paint Protection Film',
    time: '11.30',
    vehicle: 'CX-5 B 1880 AAY',
    status: 'Menunggu',
    statusTone: 'bg-amber-100 text-amber-700',
  },
  {
    customer: 'Bagas Saputra',
    service: 'Cuci + Interior Deep Clean',
    time: '14.00',
    vehicle: 'Vespa Sprint B 4991 QA',
    status: 'Terjadwal',
    statusTone: 'bg-slate-100 text-slate-700',
  },
]

const serviceHealth = [
  { name: 'Detailing', load: '12 job', trend: 'Paling ramai', color: 'bg-teal-500', width: '78%' },
  { name: 'PPF', load: '5 job', trend: 'Ticket tinggi', color: 'bg-slate-800', width: '42%' },
  { name: 'Coating', load: '7 job', trend: 'Naik 18%', color: 'bg-amber-500', width: '56%' },
]

const quickActions = [
  'Booking pelanggan baru',
  'Tambah layanan',
  'Buka jadwal teknisi',
  'Cetak invoice hari ini',
]

export default function AdminDesignMockPage() {
  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-slate-950 text-white shadow-[0_32px_60px_rgba(15,23,42,0.18)]">
        <div className="grid gap-8 px-6 py-8 md:grid-cols-[1.4fr_0.9fr] md:px-8">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-teal-200">
              Modern Bengkel Dashboard
            </div>
            <div className="space-y-3">
              <h1 className="max-w-2xl text-3xl font-extrabold leading-tight md:text-4xl">
                Dashboard yang lebih tenang, cepat dibaca, dan fokus ke pekerjaan harian bengkel.
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-slate-300 md:text-base">
                Arah desain ini menekankan operasi harian: booking, antrian servis, pendapatan,
                dan quick action. Bukan dashboard yang ramai widget, tapi workspace yang terasa ringan.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button className="rounded-2xl bg-teal-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-400">
                Pakai arah ini
              </button>
              <button className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:bg-white/10">
                Lihat komponen
              </button>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-300">Moodboard singkat</p>
                <h2 className="mt-1 text-lg font-bold">Simple, premium, operasional</h2>
              </div>
              <div className="rounded-2xl bg-white/10 px-3 py-2 text-xs font-semibold text-slate-200">
                v1 Direction
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl bg-[#0f766e] p-4 font-semibold text-white">Primary</div>
              <div className="rounded-2xl bg-[#f59e0b] p-4 font-semibold text-slate-950">Accent</div>
              <div className="rounded-2xl bg-[#f8fafc] p-4 font-semibold text-slate-900">Surface</div>
              <div className="rounded-2xl bg-[#d7f3ef] p-4 font-semibold text-teal-900">Soft State</div>
            </div>
            <div className="mt-4 rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-sm text-slate-300">
              Typeface: <span className="font-semibold text-white">Plus Jakarta Sans</span>
              <br />
              Style: rounded cards, thin borders, high whitespace, status badges yang ringkas.
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {statCards.map((card) => (
          <article
            key={card.label}
            className={`rounded-[28px] border p-5 shadow-sm ${card.tone}`}
          >
            <p className="text-sm font-medium opacity-75">{card.label}</p>
            <div className="mt-3 flex items-end justify-between gap-3">
              <h2 className="text-3xl font-extrabold">{card.value}</h2>
              <span className="rounded-full bg-black/5 px-3 py-1 text-right text-xs font-semibold">
                {card.note}
              </span>
            </div>
          </article>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.9fr]">
        <article className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Main Workspace</p>
              <h2 className="mt-1 text-2xl font-bold text-slate-900">Jadwal Layanan Hari Ini</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700">
                Semua
              </button>
              <button className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-500">
                Menunggu
              </button>
              <button className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-500">
                Selesai
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {todayQueue.map((item) => (
              <div
                key={`${item.customer}-${item.time}`}
                className="grid gap-4 rounded-[24px] border border-slate-200 bg-slate-50/70 p-4 md:grid-cols-[96px_1.2fr_1fr_auto]"
              >
                <div className="rounded-2xl bg-white px-4 py-3 text-center shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Jam</p>
                  <p className="mt-1 text-xl font-bold text-slate-900">{item.time}</p>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{item.customer}</h3>
                  <p className="mt-1 text-sm text-slate-500">{item.vehicle}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700">{item.service}</p>
                  <p className="mt-2 text-sm text-slate-500">Catatan singkat dan konteks servis tampil di sini.</p>
                </div>
                <div className="flex items-start justify-start md:justify-end">
                  <span className={`rounded-full px-3 py-2 text-xs font-bold ${item.statusTone}`}>
                    {item.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </article>

        <div className="space-y-6">
          <article className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
            <p className="text-sm font-medium text-slate-500">Service Health</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">Layanan yang paling bergerak</h2>
            <div className="mt-5 space-y-4">
              {serviceHealth.map((service) => (
                <div key={service.name} className="rounded-[24px] border border-slate-200 p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-900">{service.name}</h3>
                    <span className="text-sm font-semibold text-slate-500">{service.load}</span>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-slate-100">
                    <div className={`h-2 rounded-full ${service.color}`} style={{ width: service.width }} />
                  </div>
                  <p className="mt-3 text-sm text-slate-500">{service.trend}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
            <p className="text-sm font-medium text-slate-500">Quick Actions</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">Action-first, bukan menu-first</h2>
            <div className="mt-5 grid gap-3">
              {quickActions.map((action) => (
                <button
                  key={action}
                  className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 text-left text-sm font-semibold text-slate-700 transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-800"
                >
                  {action}
                </button>
              ))}
            </div>
          </article>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <article className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
          <p className="text-sm font-medium text-slate-500">Design Direction</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900">Apa yang dipertahankan dari mock ini</h2>
          <div className="mt-5 space-y-4 text-sm leading-7 text-slate-600">
            <div className="rounded-[24px] bg-slate-50 p-4">
              <span className="font-bold text-slate-900">1. Satu fokus per blok.</span> Dashboard dibagi jadi status, jadwal, dan action. Tidak semua data dipaksa tampil sekaligus.
            </div>
            <div className="rounded-[24px] bg-slate-50 p-4">
              <span className="font-bold text-slate-900">2. Visual yang lebih dewasa.</span> Warna lebih tenang, icon tidak dominan, dan border lebih halus daripada dashboard lama.
            </div>
            <div className="rounded-[24px] bg-slate-50 p-4">
              <span className="font-bold text-slate-900">3. Operasional dulu.</span> Booking, check-in, dan service load jadi elemen utama karena itu yang paling sering dipakai harian.
            </div>
          </div>
        </article>

        <article className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Next Expansion</p>
              <h2 className="mt-1 text-2xl font-bold text-slate-900">Komponen turunan yang cocok</h2>
            </div>
            <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-700">
              Easy to scale
            </span>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {[
              'Customer drawer dengan histori servis',
              'Schedule board per teknisi',
              'Compact invoice card',
              'Filter bar sticky di atas tabel',
              'Status badge konsisten lintas halaman',
              'Right-side detail panel untuk edit cepat',
            ].map((item) => (
              <div key={item} className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-700">
                {item}
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  )
}
