import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = Router();

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId;
    const orders = await prisma.purchaseOrder.findMany({
      where: { tenantId },
      orderBy: { orderDate: 'desc' },
    });
    res.json({ success: true, data: orders });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to list purchase orders' });
  }
});

router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId;
    const { supplierName, orderDate, totalAmount, notes, items, status } = req.body;

    // Hard block: supplier wajib diisi
    if (!supplierName || !supplierName.trim()) {
      res.status(400).json({ success: false, message: 'Nama pemasok wajib diisi untuk membuat PO' });
      return;
    }

    // Auto-generate PO number
    const count = await prisma.purchaseOrder.count({ where: { tenantId } });
    const noPO = `PO-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${String(count + 1).padStart(3, '0')}`;

    const order = await prisma.purchaseOrder.create({
      data: {
        noPO,
        supplierName: supplierName.trim(),
        status: status || 'draft',
        orderDate: orderDate ? new Date(orderDate) : new Date(),
        totalAmount: Number(totalAmount) || 0,
        notes: notes || null,
        items: items ? JSON.stringify(items) : null,
        tenantId,
      },
    });
    res.json({ success: true, data: order });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to create purchase order' });
  }
});

router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId;
    const existing = await prisma.purchaseOrder.findFirst({ where: { id: req.params.id, tenantId } });
    if (!existing) { res.status(404).json({ success: false, message: 'PO not found' }); return; }

    const { supplierName, orderDate, totalAmount, notes, items, status } = req.body;
    const order = await prisma.purchaseOrder.update({
      where: { id: req.params.id },
      data: {
        supplierName: supplierName !== undefined ? supplierName : existing.supplierName,
        status: status ?? existing.status,
        orderDate: orderDate ? new Date(orderDate) : existing.orderDate,
        totalAmount: totalAmount !== undefined ? Number(totalAmount) : existing.totalAmount,
        notes: notes !== undefined ? notes : existing.notes,
        items: items !== undefined ? JSON.stringify(items) : existing.items,
      },
    });
    res.json({ success: true, data: order });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update purchase order' });
  }
});

// POST /receive/:id — terima PO: update stok inventory + buat InventoryBatch FIFO
router.post('/receive/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId;
    const po = await prisma.purchaseOrder.findFirst({ where: { id: req.params.id, tenantId } });
    if (!po) { res.status(404).json({ success: false, message: 'PO not found' }); return; }
    if (po.status === 'received') { res.status(400).json({ success: false, message: 'PO sudah diterima' }); return; }

    if (!po.supplierName) {
      res.status(400).json({ success: false, message: 'Nama pemasok belum diisi di PO ini' });
      return;
    }

    const rawItems: any[] = po.items ? JSON.parse(po.items as string) : [];
    const items = rawItems.map(i => ({
      ...i,
      harga: Number(i.harga ?? i.hargaSatuan ?? 0),
      qty: Number(i.qty) || 0,
    }));

    const batchResults: { nama: string; qty: number; hargaPerUnit: number }[] = [];

    for (const item of items) {
      if (!item.qty) continue;

      let inv = item.inventoryId
        ? await prisma.inventory.findFirst({ where: { id: item.inventoryId, tenantId } })
        : null;

      // Auto-create inventory jika item tidak ter-link
      if (!inv) {
        const namaItem = item.nama?.trim() || 'Item';
        const namaInventory = po.supplierName
          ? `${po.supplierName} - ${namaItem}`
          : namaItem;
        const kodeCount = await prisma.inventory.count({ where: { tenantId } });
        const kode = `BHN-${String(kodeCount + 1).padStart(3, '0')}`;

        // Parse panjangRoll → isiPerUnit + satuanPakai
        // format: "15m" atau "150cm"
        let isiPerUnitNew: number | null = null;
        let satuanPakaiNew: string | null = null;
        if (item.panjangRoll) {
          const m = String(item.panjangRoll).match(/^([\d.]+)\s*(cm|m)?$/i);
          if (m) {
            isiPerUnitNew = parseFloat(m[1]);
            satuanPakaiNew = m[2]?.toLowerCase() || 'm';
          }
        }

        inv = await prisma.inventory.create({
          data: {
            kode,
            nama: namaInventory,
            kategori: item.kategori || 'Lainnya',
            satuan: item.satuan || 'Pcs',
            ...(isiPerUnitNew && { isiPerUnit: isiPerUnitNew, satuanPakai: satuanPakaiNew }),
            hargaSatuan: item.harga,
            stok: 0,
            masuk: 0,
            keluar: 0,
            stokMin: 0,
            pemasok: po.supplierName || null,
            tenantId,
          },
        });
        // Patch item PO dengan inventoryId baru agar link tersimpan
        const currentItems: any[] = po.items ? JSON.parse(po.items as string) : [];
        const itemIdx = currentItems.findIndex(ci =>
          (ci.nama || ci.barang || '').toLowerCase() === namaItem.toLowerCase()
        );
        if (itemIdx >= 0) {
          currentItems[itemIdx].inventoryId = inv.id;
          await prisma.purchaseOrder.update({
            where: { id: po.id },
            data: { items: JSON.stringify(currentItems) },
          });
        }
        console.log(`[receive] auto-created inventory "${namaInventory}" (${inv.id}) for item "${namaItem}"`);
      }

      // Sync panjangRoll ke inventory yang sudah ada tapi belum punya isiPerUnit
      if (!inv.isiPerUnit && item.panjangRoll) {
        const m = String(item.panjangRoll).match(/^([\d.]+)\s*(cm|m)?$/i);
        if (m) {
          await prisma.inventory.update({
            where: { id: inv.id },
            data: { isiPerUnit: parseFloat(m[1]), satuanPakai: m[2]?.toLowerCase() || 'm' },
          });
          inv = { ...inv, isiPerUnit: parseFloat(m[1]), satuanPakai: m[2]?.toLowerCase() || 'm' };
        }
      }

      // Hitung qty dalam satuan PAKAI dan harga per satuan PAKAI
      const isiPerUnit = inv.isiPerUnit ?? 1;
      const qtyPakai = item.qty * isiPerUnit;
      const hargaPerUnit = item.harga > 0 ? item.harga / isiPerUnit : Number(inv.hargaSatuan) / isiPerUnit;

      // Buat batch FIFO
      await prisma.inventoryBatch.create({
        data: {
          inventoryId: inv.id,
          tenantId,
          qtyAwal: qtyPakai,
          qtySisa: qtyPakai,
          hargaPerUnit,
          noPO: po.noPO,
          pemasok: po.supplierName,
          isStokAwal: false,
        },
      });

      // Update stok inventory
      await prisma.inventory.update({
        where: { id: inv.id },
        data: {
          stok: inv.stok + qtyPakai,
          masuk: inv.masuk + qtyPakai,
          ...(item.harga > 0 && { hargaSatuan: item.harga }),
        },
      });

      // Tulis InventoryLog
      await prisma.inventoryLog.create({
        data: {
          inventoryId: inv.id,
          tenantId,
          type: 'po_terima',
          qty: qtyPakai,
          stokBefore: inv.stok,
          stokAfter: inv.stok + qtyPakai,
          keterangan: `${po.noPO} | ${po.supplierName} | Rp ${item.harga.toLocaleString('id-ID')}/${inv.satuan}`,
        },
      });

      batchResults.push({ nama: inv.nama, qty: qtyPakai, hargaPerUnit });
    }

    // Update status PO ke received
    await prisma.purchaseOrder.update({
      where: { id: po.id },
      data: { status: 'received' },
    });

    res.json({ success: true, message: 'PO diterima, stok & batch diperbarui', batches: batchResults });
  } catch (err) {
    console.error('Receive PO error:', err);
    res.status(500).json({ success: false, message: 'Failed to receive PO' });
  }
});

router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId;
    const existing = await prisma.purchaseOrder.findFirst({ where: { id: req.params.id, tenantId } });
    if (!existing) { res.status(404).json({ success: false, message: 'PO not found' }); return; }
    await prisma.purchaseOrder.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete purchase order' });
  }
});

export default router;
