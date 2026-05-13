import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = Router();

function genCode(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `WR-${date}-${rand}`
}

type WarrantyDuration = { value: number; unit: 'hari' | 'bulan' | 'tahun' }

function parseWarrantyDuration(notes?: string | null): WarrantyDuration | null {
  if (!notes) return null
  const m = notes.match(/garansi:(\d+):(hari|bulan|tahun)/i)
  if (!m) return null
  const value = Number(m[1])
  if (!value || value <= 0) return null
  return { value, unit: m[2].toLowerCase() as WarrantyDuration['unit'] }
}

function addWarrantyDuration(startDate: Date, duration: WarrantyDuration): Date {
  const endDate = new Date(startDate)
  if (duration.unit === 'hari') endDate.setDate(endDate.getDate() + duration.value)
  else if (duration.unit === 'bulan') endDate.setMonth(endDate.getMonth() + duration.value)
  else endDate.setFullYear(endDate.getFullYear() + duration.value)
  return endDate
}

// List semua garansi tenant, dengan filter status
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId
    const { status } = req.query

    const warranties = await prisma.warranty.findMany({
      where: {
        tenantId,
        ...(status && { status: status as string }),
      },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        workshop:  { select: { id: true, title: true, notes: true } },
        registration: { select: { id: true, vehicleName: true, licensePlate: true, scheduledDate: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Auto-update status expired
    const now = new Date()
    const toExpire = warranties.filter(w => w.status === 'active' && new Date(w.endDate) < now)
    if (toExpire.length > 0) {
      await prisma.warranty.updateMany({
        where: { id: { in: toExpire.map(w => w.id) } },
        data: { status: 'expired' },
      })
      toExpire.forEach(w => { w.status = 'expired' })
    }

    res.json({ success: true, data: warranties })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch warranties' })
  }
})

// Get single warranty by ID atau by code (untuk kartu garansi)
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId
    const warranty = await prisma.warranty.findFirst({
      where: {
        tenantId,
        OR: [{ id: req.params.id }, { code: req.params.id }],
      },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        workshop:  { select: { id: true, title: true, notes: true } },
        registration: { select: { id: true, vehicleName: true, licensePlate: true, scheduledDate: true } },
      },
    })
    if (!warranty) {
      res.status(404).json({ success: false, message: 'Warranty not found' })
      return
    }
    res.json({ success: true, data: warranty })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch warranty' })
  }
})

// Create manual (biasanya dipanggil otomatis dari registrations route)
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId
    const { registrationId, workshopId, customerId, startDate, endDate } = req.body

    if (!registrationId || !workshopId || !customerId || !startDate || !endDate) {
      res.status(400).json({ success: false, message: 'registrationId, workshopId, customerId, startDate, endDate required' })
      return
    }

    const existing = await prisma.warranty.findUnique({ where: { registrationId } })
    if (existing) {
      res.json({ success: true, data: existing, message: 'Garansi sudah ada' })
      return
    }

    const warranty = await prisma.warranty.create({
      data: {
        code: genCode(),
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        status: 'active',
        registrationId,
        workshopId,
        customerId,
        tenantId,
      },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        workshop:  { select: { id: true, title: true } },
      },
    })
    res.status(201).json({ success: true, data: warranty })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to create warranty' })
  }
})

// Void warranty
router.put('/:id/void', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId
    const warranty = await prisma.warranty.findFirst({ where: { id: req.params.id, tenantId } })
    if (!warranty) {
      res.status(404).json({ success: false, message: 'Warranty not found' })
      return
    }
    const updated = await prisma.warranty.update({
      where: { id: req.params.id },
      data: { status: 'void' },
    })
    res.json({ success: true, data: updated })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to void warranty' })
  }
})

// Sync warranty end date from current package warranty setting
router.put('/:id/sync-duration', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId
    const warranty = await prisma.warranty.findFirst({
      where: {
        tenantId,
        OR: [{ id: req.params.id }, { code: req.params.id }],
      },
      include: { workshop: { select: { id: true, title: true, notes: true } } },
    })
    if (!warranty) {
      res.status(404).json({ success: false, message: 'Warranty not found' })
      return
    }

    const duration = parseWarrantyDuration(warranty.workshop?.notes)
    if (!duration) {
      res.status(400).json({ success: false, message: 'Paket layanan belum punya durasi garansi' })
      return
    }

    const endDate = addWarrantyDuration(warranty.startDate, duration)
    const status = warranty.status === 'void' ? 'void' : (endDate < new Date() ? 'expired' : 'active')
    const updated = await prisma.warranty.update({
      where: { id: warranty.id },
      data: { endDate, status },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        workshop:  { select: { id: true, title: true, notes: true } },
        registration: { select: { id: true, vehicleName: true, licensePlate: true, scheduledDate: true } },
      },
    })
    res.json({ success: true, data: updated })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to sync warranty duration' })
  }
})

export default router
