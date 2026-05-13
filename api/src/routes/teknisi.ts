import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = Router();

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId;
    const { status } = req.query;
    const list = await prisma.teknisi.findMany({
      where: { tenantId, ...(status && { status: status as string }) },
      orderBy: { name: 'asc' },
    });
    const parsed = list.map(t => ({
      ...t,
      spesialis: t.spesialis ? JSON.parse(t.spesialis) : [],
    }));
    res.json({ success: true, data: parsed });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId;
    const { name, phone, spesialis, status } = req.body;
    if (!name) { res.status(400).json({ success: false, message: 'name required' }); return; }
    const t = await prisma.teknisi.create({
      data: {
        name, phone: phone || null,
        spesialis: spesialis ? JSON.stringify(spesialis) : null,
        status: status || 'aktif',
        tenantId,
      },
    });
    res.status(201).json({ success: true, data: { ...t, spesialis: t.spesialis ? JSON.parse(t.spesialis) : [] } });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId;
    const existing = await prisma.teknisi.findFirst({ where: { id: req.params.id, tenantId } });
    if (!existing) { res.status(404).json({ success: false, message: 'Teknisi not found' }); return; }
    const { name, phone, spesialis, status } = req.body;
    const t = await prisma.teknisi.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(phone !== undefined && { phone }),
        ...(spesialis !== undefined && { spesialis: JSON.stringify(spesialis) }),
        ...(status !== undefined && { status }),
      },
    });

    // Kalau nama berubah, cascade update semua notes registrasi yang menyebut nama lama
    if (name !== undefined && name !== existing.name) {
      const oldName = existing.name.trim();
      const newName = name.trim();
      const regs = await prisma.registration.findMany({
        where: { tenantId, notes: { contains: oldName } },
        select: { id: true, notes: true },
      });
      for (const r of regs) {
        if (!r.notes) continue;
        const updatedNotes = r.notes.replace(
          new RegExp(`(teknisi:[^|]*?)\\b${oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'),
          (match: string) => match.replace(new RegExp(`\\b${oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), newName)
        );
        if (updatedNotes !== r.notes) {
          await prisma.registration.update({ where: { id: r.id }, data: { notes: updatedNotes } });
        }
      }
    }

    res.json({ success: true, data: { ...t, spesialis: t.spesialis ? JSON.parse(t.spesialis) : [] } });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId;
    const existing = await prisma.teknisi.findFirst({ where: { id: req.params.id, tenantId } });
    if (!existing) { res.status(404).json({ success: false, message: 'Teknisi not found' }); return; }
    await prisma.teknisi.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
