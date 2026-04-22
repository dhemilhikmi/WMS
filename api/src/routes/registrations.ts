import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

interface CreateRegistrationBody {
  userId: string;
  workshopId: string;
  tenantId: string;
}

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId, workshopId } = req.query;

    if (!tenantId) {
      res.status(400).json({
        success: false,
        message: 'tenantId required',
      });
      return;
    }

    const registrations = await prisma.registration.findMany({
      where: {
        tenantId: tenantId as string,
        ...(workshopId && { workshopId: workshopId as string }),
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        workshop: { select: { id: true, title: true } },
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
    const { tenantId } = req.query;

    if (!tenantId) {
      res.status(400).json({
        success: false,
        message: 'tenantId required',
      });
      return;
    }

    const registration = await prisma.registration.findFirst({
      where: {
        id,
        tenantId: tenantId as string,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        workshop: { select: { id: true, title: true, startDate: true, endDate: true } },
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

router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, workshopId, tenantId } = req.body as CreateRegistrationBody;

    if (!userId || !workshopId || !tenantId) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields: userId, workshopId, tenantId',
      });
      return;
    }

    const existing = await prisma.registration.findUnique({
      where: {
        userId_workshopId: {
          userId,
          workshopId,
        },
      },
    });

    if (existing) {
      res.status(400).json({
        success: false,
        message: 'User already registered for this workshop',
      });
      return;
    }

    const registration = await prisma.registration.create({
      data: {
        userId,
        workshopId,
        tenantId,
        status: 'confirmed',
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        workshop: { select: { id: true, title: true } },
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

    const registration = await prisma.registration.findFirst({
      where: {
        id,
        tenantId: tenantId as string,
      },
    });

    if (!registration) {
      res.status(404).json({
        success: false,
        message: 'Registration not found',
      });
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
