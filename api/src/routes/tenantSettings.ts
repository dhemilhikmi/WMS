import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = Router();

// GET /api/tenant-settings/:key
router.get('/:key', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId;
    const { key } = req.params;
    const setting = await prisma.tenantSetting.findUnique({
      where: { tenantId_key: { tenantId, key } },
    });
    res.json({ success: true, data: setting ? JSON.parse(setting.value) : null });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to get setting' });
  }
});

// PUT /api/tenant-settings/:key
router.put('/:key', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId;
    const { key } = req.params;
    const value = JSON.stringify(req.body);
    const setting = await prisma.tenantSetting.upsert({
      where: { tenantId_key: { tenantId, key } },
      update: { value },
      create: { tenantId, key, value },
    });
    res.json({ success: true, data: JSON.parse(setting.value) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to save setting' });
  }
});

export default router;
