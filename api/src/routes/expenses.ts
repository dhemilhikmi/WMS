import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = Router();

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId;
    const expenses = await prisma.expense.findMany({
      where: { tenantId },
      orderBy: { tanggal: 'desc' },
    });
    res.json({ success: true, data: expenses });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to list expenses' });
  }
});

router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId;
    const { tanggal, kategori, keterangan, pemasok, refPO, jumlah, dicatat } = req.body;
    if (!keterangan || !jumlah) {
      res.status(400).json({ success: false, message: 'Keterangan dan jumlah wajib diisi' });
      return;
    }
    const expense = await prisma.expense.create({
      data: {
        tanggal: tanggal ? new Date(tanggal) : new Date(),
        kategori: kategori || 'Lainnya',
        keterangan,
        pemasok: pemasok || null,
        refPO: refPO || null,
        jumlah: Number(jumlah),
        dicatat: dicatat || null,
        tenantId,
      },
    });
    res.json({ success: true, data: expense });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to create expense' });
  }
});

router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId;
    const existing = await prisma.expense.findFirst({ where: { id: req.params.id, tenantId } });
    if (!existing) { res.status(404).json({ success: false, message: 'Expense not found' }); return; }

    const { tanggal, kategori, keterangan, pemasok, refPO, jumlah, dicatat } = req.body;
    const expense = await prisma.expense.update({
      where: { id: req.params.id },
      data: {
        tanggal: tanggal ? new Date(tanggal) : existing.tanggal,
        kategori: kategori ?? existing.kategori,
        keterangan: keterangan ?? existing.keterangan,
        pemasok: pemasok !== undefined ? pemasok : existing.pemasok,
        refPO: refPO !== undefined ? refPO : existing.refPO,
        jumlah: jumlah !== undefined ? Number(jumlah) : existing.jumlah,
        dicatat: dicatat !== undefined ? dicatat : existing.dicatat,
      },
    });
    res.json({ success: true, data: expense });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update expense' });
  }
});

router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId;
    const existing = await prisma.expense.findFirst({ where: { id: req.params.id, tenantId } });
    if (!existing) { res.status(404).json({ success: false, message: 'Expense not found' }); return; }
    await prisma.expense.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete expense' });
  }
});

export default router;
