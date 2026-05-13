import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = Router();

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId;
    const workshops = await prisma.workshop.findMany({
      where: { tenantId },
      include: { _count: { select: { registrations: true } } },
      orderBy: { startDate: 'asc' },
    });
    res.json({ success: true, data: workshops });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch workshops' });
  }
});

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId;
    const workshop = await prisma.workshop.findFirst({
      where: { id: req.params.id, tenantId },
      include: {
        _count: { select: { registrations: true } },
      },
    });
    if (!workshop) {
      res.status(404).json({ success: false, message: 'Workshop not found' });
      return;
    }
    res.json({ success: true, data: workshop });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch workshop' });
  }
});

router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId;
    const { title, description, startDate, endDate, location, maxCapacity, price, duration, type, notes } = req.body;

    if (!title || !startDate || !endDate) {
      res.status(400).json({ success: false, message: 'title, startDate, endDate required' });
      return;
    }

    const workshop = await prisma.workshop.create({
      data: {
        title, description,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        location,
        maxCapacity: maxCapacity || 30,
        price: price ? parseFloat(price) : 0,
        duration: duration ? parseInt(duration) : null,
        type: type || 'main_service',
        notes: notes || null,
        tenantId,
      },
    });
    res.status(201).json({ success: true, data: workshop });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to create workshop' });
  }
});

router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId;
    const allowed = ['title', 'description', 'startDate', 'endDate', 'location', 'maxCapacity', 'price', 'duration', 'type', 'notes', 'content', 'status'];
    const updateData = Object.fromEntries(
      Object.entries(req.body).filter(([k]) => allowed.includes(k))
    ) as Record<string, any>;

    const result = await prisma.workshop.updateMany({
      where: { id: req.params.id, tenantId },
      data: {
        ...updateData,
        ...(updateData.price !== undefined && { price: parseFloat(updateData.price) }),
        ...(updateData.duration !== undefined && { duration: updateData.duration !== null ? parseInt(updateData.duration) : null }),
        ...(updateData.startDate && { startDate: new Date(updateData.startDate) }),
        ...(updateData.endDate && { endDate: new Date(updateData.endDate) }),
      },
    });
    if (result.count === 0) {
      res.status(404).json({ success: false, message: 'Workshop not found' });
      return;
    }
    const updated = await prisma.workshop.findUnique({ where: { id: req.params.id } });
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to update workshop' });
  }
});

router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId;
    const workshop = await prisma.workshop.findFirst({ where: { id: req.params.id, tenantId } });
    if (!workshop) {
      res.status(404).json({ success: false, message: 'Workshop not found' });
      return;
    }
    await prisma.workshop.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Workshop deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to delete workshop' });
  }
});

router.post('/:parentId/sub-services', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId;
    const { parentId } = req.params;
    const { title, description, startDate, endDate, location, maxCapacity, price, duration, notes } = req.body;

    if (!title || !startDate || !endDate) {
      res.status(400).json({ success: false, message: 'title, startDate, endDate required' });
      return;
    }

    const parentService = await prisma.workshop.findFirst({
      where: { id: parentId, tenantId, type: 'main_service' },
    });
    if (!parentService) {
      res.status(404).json({ success: false, message: 'Parent service not found' });
      return;
    }

    const subService = await prisma.workshop.create({
      data: {
        title, description,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        location,
        maxCapacity: maxCapacity || 10,
        price: price ? parseFloat(price) : 0,
        duration: duration ? parseInt(duration) : null,
        type: 'sub_service',
        parentId,
        notes: notes || null,
        tenantId,
      },
    });
    res.status(201).json({ success: true, data: subService });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to create sub-service' });
  }
});

router.get('/:parentId/sub-services', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId;
    const subServices = await prisma.workshop.findMany({
      where: { parentId: req.params.parentId, tenantId, type: 'sub_service' },
      include: { _count: { select: { registrations: true } } },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ success: true, data: subServices });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch sub-services' });
  }
});

export default router;
