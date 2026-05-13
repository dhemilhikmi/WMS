import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { checkTransactionQuota } from '../middleware/featureGate';

const router = Router();

interface CreateRegistrationBody {
  customerId: string;
  workshopId: string;
  tenantId: string;
  scheduledDate?: string;
  notes?: string;
  vehicleType?: string;
  vehicleBrand?: string;
  vehicleName?: string;
  licensePlate?: string;
}

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId;
    const { workshopId } = req.query;

    const registrations = await prisma.registration.findMany({
      where: {
        tenantId,
        ...(workshopId && { workshopId: workshopId as string }),
      },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        workshop: { select: { id: true, title: true, price: true, duration: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: registrations,
    });
  } catch (err: any) {
    console.error('Get registrations error:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to fetch registrations',
    });
  }
});

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;

    const registration = await prisma.registration.findFirst({
      where: { id, tenantId },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        workshop: { select: { id: true, title: true, price: true, startDate: true, endDate: true } },
      },
    });

    if (!registration) {
      res.status(404).json({
        success: false,
        message: 'Registration not found',
      });
      return;
    }

    res.json({
      success: true,
      data: registration,
    });
  } catch (err: any) {
    console.error('Get registration error:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to fetch registration',
    });
  }
});

router.post('/', checkTransactionQuota, async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId;
    const { customerId, workshopId, scheduledDate, notes, vehicleType, vehicleBrand, vehicleName, licensePlate } = req.body as CreateRegistrationBody;

    if (!customerId || !workshopId) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields: customerId, workshopId',
      });
      return;
    }

    const [customer, workshop] = await Promise.all([
      prisma.customer.findFirst({ where: { id: customerId, tenantId }, select: { id: true } }),
      prisma.workshop.findFirst({ where: { id: workshopId, tenantId }, select: { id: true } }),
    ]);

    if (!customer || !workshop) {
      res.status(400).json({
        success: false,
        message: 'Customer atau layanan tidak valid untuk tenant ini',
      });
      return;
    }

    const registration = await prisma.registration.create({
      data: {
        customerId,
        workshopId,
        tenantId,
        scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
        notes: notes || null,
        vehicleType: vehicleType || null,
        vehicleBrand: vehicleBrand || null,
        vehicleName: vehicleName || null,
        licensePlate: licensePlate || null,
        status: 'confirmed',
      },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        workshop: { select: { id: true, title: true, price: true } },
      },
    });

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: registration,
    });
  } catch (err: any) {
    console.error('Create registration error:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to register',
    });
  }
});

function genWarrantyCode(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `WR-${date}-${rand}`
}

function parseWarrantyDuration(notes?: string | null): { value: number; unit: 'hari' | 'bulan' | 'tahun' } | null {
  if (!notes) return null
  const m = notes.match(/garansi:(\d+):(hari|bulan|tahun)/i)
  if (!m) return null
  const value = Number(m[1])
  if (!value || value <= 0) return null
  return { value, unit: m[2].toLowerCase() as 'hari' | 'bulan' | 'tahun' }
}

function addWarrantyDuration(startDate: Date, duration: { value: number; unit: 'hari' | 'bulan' | 'tahun' }): Date {
  const endDate = new Date(startDate)
  if (duration.unit === 'hari') endDate.setDate(endDate.getDate() + duration.value)
  else if (duration.unit === 'bulan') endDate.setMonth(endDate.getMonth() + duration.value)
  else endDate.setFullYear(endDate.getFullYear() + duration.value)
  return endDate
}

router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;
    const { workshopId, scheduledDate, status, notes, vehicleType, vehicleBrand, vehicleName, licensePlate, paymentStatus } = req.body;

    const registration = await prisma.registration.findFirst({
      where: { id, tenantId },
      include: { workshop: true },
    });

    if (!registration) {
      res.status(404).json({ success: false, message: 'Registration not found' });
      return;
    }

    if (workshopId) {
      const workshop = await prisma.workshop.findFirst({
        where: { id: workshopId, tenantId },
      });
      if (!workshop) {
        res.status(400).json({ success: false, message: 'Invalid workshop' });
        return;
      }
    }

    // Jaga konsistensi: completed ↔ LUNAS selalu bersamaan
    let finalStatus = status || undefined
    let finalPaymentStatus = paymentStatus ? paymentStatus.toUpperCase() : undefined
    if (finalStatus === 'completed') finalPaymentStatus = 'LUNAS'
    if (finalPaymentStatus === 'LUNAS') finalStatus = 'completed'

    // Pertahankan dp: dari notes lama saat notes baru dikirim
    let mergedNotes: string | undefined = undefined
    if (notes !== undefined) {
      const existingDp = registration.notes?.match(/(?:^|\|)(dp:\d+(?:\.\d+)?)/i)?.[1]
      const newNoteStripped = String(notes || '').replace(/(?:^|\|)dp:\d+(?:\.\d+)?/gi, '').replace(/^\|+|\|+$/g, '').trim()
      if (existingDp && !String(notes).includes('dp:')) {
        mergedNotes = newNoteStripped ? `${newNoteStripped}|${existingDp}` : existingDp
      } else {
        mergedNotes = notes || undefined
      }
    }

    const updated = await prisma.registration.update({
      where: { id },
      data: {
        workshopId: workshopId || undefined,
        scheduledDate: scheduledDate ? new Date(scheduledDate) : undefined,
        status: finalStatus,
        notes: mergedNotes,
        vehicleType: vehicleType || undefined,
        vehicleBrand: vehicleBrand || undefined,
        vehicleName: vehicleName || undefined,
        licensePlate: licensePlate || undefined,
        paymentStatus: finalPaymentStatus,
      },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        workshop: { select: { id: true, title: true, price: true, notes: true } },
      },
    });

    // Auto-buat garansi saat status berubah ke completed
    if (finalStatus === 'completed' && registration.status !== 'completed') {
      const workshop = updated.workshop as any
      const warrantyDuration = parseWarrantyDuration(workshop?.notes)
      if (warrantyDuration) {
        const existing = await prisma.warranty.findUnique({ where: { registrationId: id } })
        if (!existing) {
          const startDate = new Date()
          const endDate = addWarrantyDuration(startDate, warrantyDuration)
          await prisma.warranty.create({
            data: {
              code: genWarrantyCode(),
              startDate,
              endDate,
              status: 'active',
              registrationId: id,
              workshopId: updated.workshopId,
              customerId: updated.customerId,
              tenantId,
            },
          })
        }
      }
    }

    res.json({ success: true, message: 'Registration updated successfully', data: updated });
  } catch (err: any) {
    console.error('Update registration error:', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to update registration' });
  }
});

router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;

    const registration = await prisma.registration.findFirst({ where: { id, tenantId } });

    if (!registration) {
      res.status(404).json({ success: false, message: 'Registration not found' });
      return;
    }

    await prisma.registration.delete({ where: { id } });

    res.json({
      success: true,
      message: 'Registration cancelled successfully',
    });
  } catch (err: any) {
    console.error('Delete registration error:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to cancel registration',
    });
  }
});

export default router;
