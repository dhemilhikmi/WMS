import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = Router();

async function buildAvailability(registrationId: string, tenantId: string) {
  const reg = await prisma.registration.findFirst({
    where: { id: registrationId, tenantId },
    include: {
      customer: { select: { name: true } },
      workshop: { select: { title: true } },
    },
  });
  if (!reg) return null;

  const materials = await prisma.serviceMaterial.findMany({
    where: { workshopId: reg.workshopId, tenantId },
    include: { inventory: true },
  });

  const shortages = materials
    .map(m => {
      const required = Number(m.qty);
      const stock = Number(m.inventory.stok);
      return {
        inventoryId: m.inventoryId,
        nama: m.inventory.nama,
        satuan: m.inventory.satuan,
        required,
        stock,
        shortage: Math.max(0, required - stock),
      };
    })
    .filter(row => row.shortage > 0);

  return {
    registrationId: reg.id,
    customer: reg.customer?.name || 'Pelanggan',
    service: reg.workshop?.title || 'Layanan',
    scheduledDate: reg.scheduledDate,
    ok: shortages.length === 0,
    shortages,
    materials: materials.map(m => ({
      inventoryId: m.inventoryId,
      nama: m.inventory.nama,
      satuan: m.inventory.satuan,
      required: Number(m.qty),
      stock: Number(m.inventory.stok),
    })),
  };
}

function parseRecordedHpp(notes?: string | null) {
  const match = notes?.match(/(?:^|\|)hpp:(\d+(?:\.\d+)?)/i);
  return match ? Math.round(Number(match[1]) || 0) : 0;
}

function inventoryUnitCost(inv: { hargaSatuan: any; satuan?: string | null; notes?: string | null; isiPerUnit?: number | null }) {
  const factor = inventoryUnitFactor(inv);
  return Number(inv.hargaSatuan) / factor;
}

function inventoryUnitFactor(inv: { satuan?: string | null; notes?: string | null; isiPerUnit?: number | null }) {
  if (inv.isiPerUnit && inv.isiPerUnit > 0) return Number(inv.isiPerUnit);
  const satuan = String(inv.satuan || '').toLowerCase();
  if (satuan === 'liter') return 1000;
  if (satuan === 'kg') return 1000;
  if (satuan === 'roll') {
    const legacyFactor = Number(inv.notes);
    return legacyFactor > 0 ? legacyFactor : 1;
  }
  return 1;
}

async function ensureHppExpense(reg: {
  id: string;
  tenantId: string;
  workshop?: { title: string } | null;
  customer?: { name: string } | null;
}, hpp: number) {
  if (hpp <= 0) return;

  const refPO = `HPP-REG-${reg.id}`;
  const existing = await prisma.expense.findFirst({
    where: { tenantId: reg.tenantId, refPO },
  });

  const data = {
    tanggal: new Date(),
    kategori: 'Bahan & Material',
    keterangan: `HPP layanan ${reg.workshop?.title || 'Layanan'} - ${reg.customer?.name || 'Pelanggan'}`,
    pemasok: null,
    refPO,
    jumlah: hpp,
    dicatat: 'Sistem - HPP layanan selesai',
  };

  if (existing) {
    await prisma.expense.update({
      where: { id: existing.id },
      data,
    });
    return;
  }

  await prisma.expense.create({
    data: {
      ...data,
      tenantId: reg.tenantId,
    },
  });
}

// GET /api/service-materials?workshopId=xxx — get BOM for a service
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId;
    const { workshopId } = req.query;

    const materials = await prisma.serviceMaterial.findMany({
      where: {
        tenantId,
        ...(workshopId && { workshopId: workshopId as string }),
      },
      include: {
        inventory: {
          select: { id: true, kode: true, nama: true, satuan: true, satuanPakai: true, isiPerUnit: true, hargaSatuan: true, stok: true, notes: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // ServiceMaterial.qty is stored in usage/stock unit; hargaSatuan is per purchase unit.
    const hpp = materials.reduce((sum, m) => {
      return sum + Number(m.qty) * inventoryUnitCost(m.inventory);
    }, 0);

    res.json({ success: true, data: materials, hpp });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to list service materials' });
  }
});

// GET /api/service-materials/hpp-real/:workshopId — HPP berdasarkan harga batch FIFO saat ini
router.get('/hpp-real/:workshopId', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId;
    const { workshopId } = req.params;

    const materials = await prisma.serviceMaterial.findMany({
      where: { workshopId, tenantId },
      include: {
        inventory: { select: { id: true, nama: true, satuan: true, satuanPakai: true, isiPerUnit: true, hargaSatuan: true, notes: true } },
      },
    });

    let hppReal = 0;
    const breakdown: { inventoryId: string; nama: string; qty: number; hargaPerUnit: number; method: string }[] = [];

    for (const m of materials) {
      const qtyNeeded = Number(m.qty);
      const batches = await prisma.inventoryBatch.findMany({
        where: { inventoryId: m.inventoryId, tenantId, qtySisa: { gt: 0 } },
        orderBy: { createdAt: 'asc' },
      });

      if (batches.length > 0) {
        let remaining = qtyNeeded;
        let cost = 0;
        for (const b of batches) {
          if (remaining <= 0) break;
          const take = Math.min(remaining, b.qtySisa);
          cost += take * Number(b.hargaPerUnit);
          remaining -= take;
        }
        if (remaining > 0) cost += remaining * inventoryUnitCost(m.inventory);
        hppReal += cost;
        breakdown.push({ inventoryId: m.inventoryId, nama: m.inventory.nama, qty: qtyNeeded, hargaPerUnit: cost / qtyNeeded, method: 'fifo' });
      } else {
        const unitCost = inventoryUnitCost(m.inventory);
        const cost = qtyNeeded * unitCost;
        hppReal += cost;
        breakdown.push({ inventoryId: m.inventoryId, nama: m.inventory.nama, qty: qtyNeeded, hargaPerUnit: unitCost, method: 'legacy' });
      }
    }

    res.json({ success: true, hppReal: Math.round(hppReal), breakdown });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to calculate real HPP' });
  }
});

// GET /api/service-materials/availability/:registrationId — cek BOM vs stok sebelum proses
router.get('/availability/:registrationId', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId;
    const availability = await buildAvailability(req.params.registrationId, tenantId);
    if (!availability) { res.status(404).json({ success: false, message: 'Registration not found' }); return; }
    res.json({ success: true, data: availability });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to check material availability' });
  }
});

// GET /api/service-materials/shortages/upcoming — total kebutuhan BOM untuk booking mendatang
router.get('/shortages/upcoming', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId;
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const regs = await prisma.registration.findMany({
      where: {
        tenantId,
        status: { in: ['pending', 'confirmed'] },
        scheduledDate: { gte: now },
      },
      include: {
        customer: { select: { name: true } },
        workshop: { select: { id: true, title: true } },
      },
      orderBy: { scheduledDate: 'asc' },
    });

    const workshopIds = Array.from(new Set(regs.map(r => r.workshopId)));
    const materials = await prisma.serviceMaterial.findMany({
      where: { tenantId, workshopId: { in: workshopIds } },
      include: { inventory: true },
    });

    const materialsByWorkshop = materials.reduce<Record<string, typeof materials>>((acc, mat) => {
      if (!acc[mat.workshopId]) acc[mat.workshopId] = [] as typeof materials;
      acc[mat.workshopId].push(mat);
      return acc;
    }, {});

    const requiredByInventory: Record<string, {
      inventoryId: string;
      nama: string;
      satuan: string;
      stock: number;
      required: number;
      jobs: { registrationId: string; customer: string; service: string; scheduledDate: Date | null; required: number }[];
    }> = {};

    regs.forEach(reg => {
      (materialsByWorkshop[reg.workshopId] || []).forEach(mat => {
        if (!requiredByInventory[mat.inventoryId]) {
          requiredByInventory[mat.inventoryId] = {
            inventoryId: mat.inventoryId,
            nama: mat.inventory.nama,
            satuan: mat.inventory.satuan,
            stock: Number(mat.inventory.stok),
            required: 0,
            jobs: [],
          };
        }
        const qty = Number(mat.qty);
        requiredByInventory[mat.inventoryId].required += qty;
        requiredByInventory[mat.inventoryId].jobs.push({
          registrationId: reg.id,
          customer: reg.customer?.name || 'Pelanggan',
          service: reg.workshop?.title || 'Layanan',
          scheduledDate: reg.scheduledDate,
          required: qty,
        });
      });
    });

    const shortages = Object.values(requiredByInventory)
      .map(row => ({ ...row, shortage: Math.max(0, row.required - row.stock) }))
      .filter(row => row.shortage > 0)
      .sort((a, b) => b.shortage - a.shortage);

    res.json({ success: true, data: { shortages, totalUpcoming: regs.length } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to calculate upcoming shortages' });
  }
});

// POST /api/service-materials — add/update material to BOM
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId;
    const { workshopId, inventoryId, qty, mode } = req.body;

    if (!workshopId || !inventoryId) {
      res.status(400).json({ success: false, message: 'workshopId dan inventoryId wajib diisi' });
      return;
    }

    const existing = await prisma.serviceMaterial.findUnique({
      where: { workshopId_inventoryId: { workshopId, inventoryId } },
    });
    const nextQty = Number(qty) || 1;
    const shouldReplace = mode === 'replace' || mode === 'set';
    const material = await prisma.serviceMaterial.upsert({
      where: { workshopId_inventoryId: { workshopId, inventoryId } },
      update: { qty: shouldReplace ? nextQty : (Number(existing?.qty) || 0) + nextQty },
      create: { workshopId, inventoryId, qty: nextQty, tenantId },
      include: {
        inventory: { select: { id: true, kode: true, nama: true, satuan: true, satuanPakai: true, isiPerUnit: true, hargaSatuan: true, stok: true, notes: true } },
      },
    });

    res.json({ success: true, data: material });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to save service material' });
  }
});

// DELETE /api/service-materials/:id
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId;
    const existing = await prisma.serviceMaterial.findFirst({ where: { id: req.params.id, tenantId } });
    if (!existing) { res.status(404).json({ success: false, message: 'Not found' }); return; }
    await prisma.serviceMaterial.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete service material' });
  }
});

// POST /api/service-materials/calculate/:registrationId — hitung HPP & deduct stok
router.post('/calculate/:registrationId', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId;
    const reg = await prisma.registration.findFirst({
      where: { id: req.params.registrationId, tenantId },
      include: {
        customer: { select: { name: true } },
        workshop: { select: { title: true } },
      },
    });
    if (!reg) { res.status(404).json({ success: false, message: 'Registration not found' }); return; }

    const recordedHpp = parseRecordedHpp(reg.notes);
    if (recordedHpp > 0) {
      await ensureHppExpense(reg, recordedHpp);
      res.json({ success: true, hpp: recordedHpp, deducted: [], alreadyCalculated: true });
      return;
    }

    const materials = await prisma.serviceMaterial.findMany({
      where: { workshopId: reg.workshopId, tenantId },
      include: { inventory: true },
    });

    if (materials.length === 0) {
      res.json({ success: true, hpp: 0, deducted: [] });
      return;
    }

    const shortages = materials
      .map(m => {
        const required = Number(m.qty);
        const stock = Number(m.inventory.stok);
        return {
          inventoryId: m.inventoryId,
          nama: m.inventory.nama,
          satuan: m.inventory.satuan,
          required,
          stock,
          shortage: Math.max(0, required - stock),
        };
      })
      .filter(row => row.shortage > 0);

    if (shortages.length > 0) {
      res.status(409).json({
        success: false,
        message: 'Stok material belum cukup untuk menyelesaikan layanan ini',
        shortages,
      });
      return;
    }

    let hpp = 0;
    const deducted: { nama: string; qty: number; hargaPerUnit: number; method: string }[] = [];

    for (const m of materials) {
      let qtyNeeded = Number(m.qty);
      const inv = m.inventory;

      // ── FIFO dari batch ──────────────────────────────────────────────────
      const batches = await prisma.inventoryBatch.findMany({
        where: { inventoryId: m.inventoryId, tenantId, qtySisa: { gt: 0 } },
        orderBy: { createdAt: 'asc' }, // FIFO: terlama dulu
      });

      let hppMaterial = 0;
      let totalDeducted = 0;

      if (batches.length > 0) {
        // Ada batch → pakai FIFO
        for (const batch of batches) {
          if (qtyNeeded <= 0) break;
          const takeQty = Math.min(qtyNeeded, batch.qtySisa);
          const batchHpp = takeQty * Number(batch.hargaPerUnit);
          hppMaterial += batchHpp;
          totalDeducted += takeQty;
          qtyNeeded -= takeQty;

          // Update qtySisa batch
          await prisma.inventoryBatch.update({
            where: { id: batch.id },
            data: { qtySisa: batch.qtySisa - takeQty },
          });
        }

        // Fallback jika batch habis tapi masih butuh qty (edge case stok tidak konsisten)
        if (qtyNeeded > 0) {
          hppMaterial += qtyNeeded * inventoryUnitCost(inv);
          totalDeducted += qtyNeeded;
        }

        deducted.push({ nama: inv.nama, qty: totalDeducted, hargaPerUnit: hppMaterial / totalDeducted, method: 'fifo' });
      } else {
        // Tidak ada batch → fallback ke hargaSatuan lama
        const unitCost = inventoryUnitCost(inv);
        hppMaterial = Number(m.qty) * unitCost;
        totalDeducted = Number(m.qty);
        deducted.push({ nama: inv.nama, qty: totalDeducted, hargaPerUnit: unitCost, method: 'legacy' });
      }

      hpp += hppMaterial;

      // Deduct inventory stok
      await prisma.inventory.update({
        where: { id: m.inventoryId },
        data: {
          stok: Math.max(0, inv.stok - totalDeducted),
          keluar: inv.keluar + totalDeducted,
        },
      });

      // Tulis InventoryLog
      await prisma.inventoryLog.create({
        data: {
          inventoryId: m.inventoryId,
          tenantId,
          type: 'service_pakai',
          qty: totalDeducted,
          stokBefore: inv.stok,
          stokAfter: Math.max(0, inv.stok - totalDeducted),
          keterangan: `Layanan reg:${reg.id} | HPP: Rp ${Math.round(hppMaterial).toLocaleString('id-ID')}`,
        },
      });
    }

    // Store HPP in registration notes
    const existingNotes = reg.notes || '';
    const baseNotes = existingNotes.replace(/\|hpp:\d+(\.\d+)?/, '');
    const newNotes = `${baseNotes}|hpp:${Math.round(hpp)}`.replace(/^\|/, '');
    await prisma.registration.update({
      where: { id: reg.id },
      data: { notes: newNotes },
    });
    await ensureHppExpense(reg, Math.round(hpp));

    res.json({ success: true, hpp: Math.round(hpp), deducted });
  } catch (err) {
    console.error('Calculate HPP error:', err);
    res.status(500).json({ success: false, message: 'Failed to calculate HPP' });
  }
});

export default router;
