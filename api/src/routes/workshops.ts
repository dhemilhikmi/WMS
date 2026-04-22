import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

interface CreateWorkshopBody {
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  location?: string;
  maxCapacity?: number;
  tenantId: string;
}


router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = req.query;

    if (!tenantId) {
      res.status(400).json({
        success: false,
        message: 'tenantId required',
      });
      return;
    }

    const workshops = await prisma.workshop.findMany({
      where: { tenantId: tenantId as string },
      include: { _count: { select: { registrations: true } } },
      orderBy: { startDate: 'asc' },
    });

    res.json({
      success: true,
      data: workshops,
    });
  } catch (err: any) {
    console.error('Get workshops error:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to fetch workshops',
    });
  }
});

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { tenantId } = req.query;

    if (!tenantId) {
      res.status(400).json({
        success: false,
        message: 'tenantId required',
      });
      return;
    }

    const workshop = await prisma.workshop.findFirst({
      where: {
        id,
        tenantId: tenantId as string,
      },
      include: {
        registrations: {
          select: {
            id: true,
            status: true,
            user: { select: { id: true, name: true, email: true } },
          },
        },
        _count: { select: { registrations: true } },
      },
    });

    if (!workshop) {
      res.status(404).json({
        success: false,
        message: 'Workshop not found',
      });
      return;
    }

    res.json({
      success: true,
      data: workshop,
    });
  } catch (err: any) {
    console.error('Get workshop error:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to fetch workshop',
    });
  }
});

router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, description, startDate, endDate, location, maxCapacity, tenantId } =
      req.body as CreateWorkshopBody;

    if (!title || !startDate || !endDate || !tenantId) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields: title, startDate, endDate, tenantId',
      });
      return;
    }

    const workshop = await prisma.workshop.create({
      data: {
        title,
        description,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        location,
        maxCapacity: maxCapacity || 30,
        tenantId,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Workshop created successfully',
      data: workshop,
    });
  } catch (err: any) {
    console.error('Create workshop error:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to create workshop',
    });
  }
});

router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { tenantId, ...updateData } = req.body;

    if (!tenantId) {
      res.status(400).json({
        success: false,
        message: 'tenantId required',
      });
      return;
    }

    const workshop = await prisma.workshop.updateMany({
      where: {
        id,
        tenantId,
      },
      data: {
        ...updateData,
        ...(updateData.startDate && { startDate: new Date(updateData.startDate) }),
        ...(updateData.endDate && { endDate: new Date(updateData.endDate) }),
      },
    });

    if (workshop.count === 0) {
      res.status(404).json({
        success: false,
        message: 'Workshop not found',
      });
      return;
    }

    const updated = await prisma.workshop.findUnique({ where: { id } });

    res.json({
      success: true,
      message: 'Workshop updated successfully',
      data: updated,
    });
  } catch (err: any) {
    console.error('Update workshop error:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to update workshop',
    });
  }
});

router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { tenantId } = req.query;

    if (!tenantId) {
      res.status(400).json({
        success: false,
        message: 'tenantId required',
      });
      return;
    }

    const workshop = await prisma.workshop.findFirst({
      where: {
        id,
        tenantId: tenantId as string,
      },
    });

    if (!workshop) {
      res.status(404).json({
        success: false,
        message: 'Workshop not found',
      });
      return;
    }

    await prisma.workshop.delete({ where: { id } });

    res.json({
      success: true,
      message: 'Workshop deleted successfully',
    });
  } catch (err: any) {
    console.error('Delete workshop error:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to delete workshop',
    });
  }
});

export default router;
