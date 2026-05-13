import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = Router();

// GET /api/features - List all available features
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const features = await prisma.feature.findMany({
      orderBy: { name: 'asc' },
    });

    res.json({
      success: true,
      data: features,
    });
  } catch (err: any) {
    console.error('Get features error:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to fetch features',
    });
  }
});

export default router;
