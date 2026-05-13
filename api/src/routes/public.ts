import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = Router();

// Default landing page content
const DEFAULT_LANDING = {
  hero: {
    badge: 'WorkshopMu untuk detailing, coating, dan PPF',
    title1: 'Kelola Workshop',
    titleAccent: 'Detailing & PPF',
    title3: 'Lebih Cerdas',
    subtitle: 'Atur booking, stok, teknisi, dan laporan bengkel jadi gampang.',
    btn1: 'Coba Gratis 14 Hari',
    btn2: 'Lihat Demo ->',
  },
  stats: [
    { num: '98', unit: '%', label: 'Kepuasan Pengguna' },
    { num: '3', unit: 'x', label: 'Lebih Efisien' },
    { num: '500', unit: '+', label: 'Workshop Aktif' },
  ],
  trust: ['SpeedMaster Detailing', 'AutoGloss Studio', 'PPF Indonesia', 'ShineKing Workshop', 'DetailPro Surabaya'],
  cta: {
    title: 'Siap Transformasi\nWorkshop Anda?',
    subtitle: 'Bergabung dengan workshop yang sudah lebih rapi mengelola booking, stok, teknisi, dan laporan bersama WorkshopMu.',
    btn: 'Mulai Coba Gratis -> Tidak Perlu Kartu Kredit',
  },
  plans: [
    {
      name: 'Starter',
      price: '0',
      period: 'forever',
      popular: false,
      badge: '',
      features: [
        'Hingga 50 transaksi/bulan',
        '2 teknisi',
        'Customer & inventaris unlimited',
        '1 template kartu garansi',
        'Laporan pendapatan dasar',
        'Akses mobile web',
      ],
      btnText: 'Mulai Gratis',
    },
    {
      name: 'Pro',
      price: '2.499.000',
      period: 'per tahun (~Rp 208rb/bulan)',
      popular: true,
      badge: '⭐ EARLY ADOPTER — Diskon 50%',
      features: [
        'Semua fitur Starter',
        'Transaksi & teknisi unlimited',
        'Setup HPP per layanan (BOM)',
        '6 template kartu garansi premium',
        'Custom logo di kartu garansi',
        'Laporan keuangan lengkap (laba rugi, aliran kas, ringkasan)',
        'Analitik bengkel',
        'Riwayat layanan unlimited',
        'Priority support',
      ],
      btnText: 'Coba Pro Gratis 60 Hari',
    },
  ],
};

router.get('/landing', async (_req: Request, res: Response): Promise<void> => {
  try {
    const setting = await prisma.platformSetting.findUnique({
      where: { key: 'landing_content' },
    });
    const content = setting ? JSON.parse(setting.value) : DEFAULT_LANDING;
    res.json({ success: true, data: content, isDefault: !setting });
  } catch (err) {
    res.json({ success: true, data: DEFAULT_LANDING, isDefault: true });
  }
});

export { DEFAULT_LANDING };
export default router;
