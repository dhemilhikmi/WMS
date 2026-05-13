import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = Router();

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId;
    const items = await prisma.inventory.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: items });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to list inventory' });
  }
});

router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId;
    const { kode, nama, kategori, satuan, stok, stokMin, hargaSatuan, pemasok, notes, satuanPakai, isiPerUnit } = req.body;
    if (!nama || !kode) {
      res.status(400).json({ success: false, message: 'Kode dan nama wajib diisi' });
      return;
    }
    const stokAwal = parseFloat(stok || 0) || 0;
    const item = await prisma.inventory.create({
      data: {
        kode, nama,
        kategori: kategori || 'Lainnya',
        satuan: satuan || 'Pcs',
        satuanPakai: satuanPakai || null,
        isiPerUnit: isiPerUnit != null ? Number(isiPerUnit) : null,
        stok: stokAwal,
        stokMin: parseFloat(stokMin || 0) || 0,
        hargaSatuan: Math.round(Number(hargaSatuan) || 0),
        pemasok: pemasok || null,
        notes: notes || null,
        tenantId,
      },
    });
    if (stokAwal > 0) {
      await prisma.inventoryLog.create({
        data: {
          type: 'koreksi',
          qty: stokAwal,
          stokBefore: 0,
          stokAfter: stokAwal,
          keterangan: 'Stok awal saat item dibuat',
          inventoryId: item.id,
          tenantId,
        },
      });
    }
    res.json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to create inventory item' });
  }
});

router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId;
    const existing = await prisma.inventory.findFirst({ where: { id: req.params.id, tenantId } });
    if (!existing) { res.status(404).json({ success: false, message: 'Item not found' }); return; }

    const { kode, nama, kategori, satuan, stok, stokMin, hargaSatuan, pemasok, notes, satuanPakai, isiPerUnit } = req.body;
    const newStok = stok !== undefined ? parseFloat(stok) : existing.stok;
    const item = await prisma.inventory.update({
      where: { id: req.params.id },
      data: {
        kode: kode ?? existing.kode,
        nama: nama ?? existing.nama,
        kategori: kategori ?? existing.kategori,
        satuan: satuan ?? existing.satuan,
        satuanPakai: satuanPakai !== undefined ? (satuanPakai || null) : existing.satuanPakai,
        isiPerUnit: isiPerUnit !== undefined ? (isiPerUnit != null ? Number(isiPerUnit) : null) : existing.isiPerUnit,
        stok: newStok,
        stokMin: stokMin !== undefined ? parseFloat(stokMin) : existing.stokMin,
        hargaSatuan: hargaSatuan !== undefined ? Math.round(Number(hargaSatuan) || 0) : existing.hargaSatuan,
        pemasok: pemasok !== undefined ? pemasok : existing.pemasok,
        notes: notes !== undefined ? notes : existing.notes,
      },
    });
    // Catat log hanya jika stok berubah
    const stokBefore = Number(existing.stok);
    const stokAfter = Number(newStok);
    if (stok !== undefined && stokAfter !== stokBefore) {
      await prisma.inventoryLog.create({
        data: {
          type: 'koreksi',
          qty: Math.abs(stokAfter - stokBefore),
          stokBefore,
          stokAfter,
          keterangan: 'Koreksi stok manual',
          inventoryId: item.id,
          tenantId,
        },
      });
    }
    res.json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update inventory item' });
  }
});

// Mutasi stok: masuk atau keluar
router.post('/:id/mutasi', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId;
    const existing = await prisma.inventory.findFirst({ where: { id: req.params.id, tenantId } });
    if (!existing) { res.status(404).json({ success: false, message: 'Item not found' }); return; }

    const { type, jumlah, keterangan } = req.body;
    const qty = parseFloat(jumlah) || 0;
    if (!['masuk', 'keluar'].includes(type) || qty <= 0) {
      res.status(400).json({ success: false, message: 'Type (masuk/keluar) dan jumlah wajib diisi' });
      return;
    }

    const stokBefore = Number(existing.stok);
    const stokAfter = type === 'masuk' ? stokBefore + qty : Math.max(0, stokBefore - qty);

    const item = await prisma.inventory.update({
      where: { id: req.params.id },
      data: {
        stok: stokAfter,
        masuk: type === 'masuk' ? existing.masuk + qty : existing.masuk,
        keluar: type === 'keluar' ? existing.keluar + qty : existing.keluar,
      },
    });

    await prisma.inventoryLog.create({
      data: {
        type,
        qty,
        stokBefore,
        stokAfter,
        keterangan: keterangan || null,
        inventoryId: item.id,
        tenantId,
      },
    });

    res.json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to process mutasi' });
  }
});

// Audit log per item
router.get('/:id/log', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId;
    const existing = await prisma.inventory.findFirst({ where: { id: req.params.id, tenantId } });
    if (!existing) { res.status(404).json({ success: false, message: 'Item not found' }); return; }

    const logs = await prisma.inventoryLog.findMany({
      where: { inventoryId: req.params.id, tenantId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({ success: true, data: logs });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch inventory log' });
  }
});

router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId;
    const existing = await prisma.inventory.findFirst({ where: { id: req.params.id, tenantId } });
    if (!existing) { res.status(404).json({ success: false, message: 'Item not found' }); return; }
    await prisma.inventory.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete inventory item' });
  }
});

export default router;
