import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = Router();

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId;
    const suppliers = await prisma.supplier.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: suppliers });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to list suppliers' });
  }
});

router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId;
    const { nama, kontak, phone, email, alamat, kategori, status } = req.body;
    if (!nama) { res.status(400).json({ success: false, message: 'Nama pemasok wajib diisi' }); return; }
    const supplier = await prisma.supplier.create({
      data: {
        nama, kontak: kontak || null, phone: phone || null,
        email: email || null, alamat: alamat || null,
        kategori: kategori || 'Lainnya',
        status: status || 'aktif',
        tenantId,
      },
    });
    res.json({ success: true, data: supplier });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to create supplier' });
  }
});

router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId;
    const existing = await prisma.supplier.findFirst({ where: { id: req.params.id, tenantId } });
    if (!existing) { res.status(404).json({ success: false, message: 'Supplier not found' }); return; }

    const { nama, kontak, phone, email, alamat, kategori, status } = req.body;
    const supplier = await prisma.supplier.update({
      where: { id: req.params.id },
      data: {
        nama: nama ?? existing.nama,
        kontak: kontak !== undefined ? kontak : existing.kontak,
        phone: phone !== undefined ? phone : existing.phone,
        email: email !== undefined ? email : existing.email,
        alamat: alamat !== undefined ? alamat : existing.alamat,
        kategori: kategori ?? existing.kategori,
        status: status ?? existing.status,
      },
    });
    res.json({ success: true, data: supplier });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update supplier' });
  }
});

router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId;
    const existing = await prisma.supplier.findFirst({ where: { id: req.params.id, tenantId } });
    if (!existing) { res.status(404).json({ success: false, message: 'Supplier not found' }); return; }
    await prisma.supplier.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete supplier' });
  }
});

export default router;
