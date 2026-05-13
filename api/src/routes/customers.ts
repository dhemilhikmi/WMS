import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = Router();

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId;
    const customers = await prisma.customer.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: customers });
  } catch (error) {
    console.error('Error listing customers:', error);
    res.status(500).json({ success: false, message: 'Failed to list customers' });
  }
});

router.get('/phone/:phone', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId;
    const customer = await prisma.customer.findUnique({
      where: { phone_tenantId: { phone: req.params.phone, tenantId } },
    });
    if (!customer) {
      res.status(404).json({ success: false, message: 'Customer not found' });
      return;
    }
    res.json({ success: true, data: customer });
  } catch (error) {
    console.error('Error getting customer:', error);
    res.status(500).json({ success: false, message: 'Failed to get customer' });
  }
});

router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId;
    const { name, address, phone, satuan } = req.body;

    if (!name || !phone) {
      res.status(400).json({ success: false, message: 'Name and phone required' });
      return;
    }

    const customer = await prisma.customer.create({
      data: { name, address: address || null, phone, satuan: satuan || 'Ibu', tenantId },
    });
    res.json({ success: true, data: customer });
  } catch (error: any) {
    console.error('Error creating customer:', error);
    if (error.code === 'P2002') {
      res.status(400).json({ success: false, message: 'Nomor HP sudah terdaftar' });
      return;
    }
    res.status(500).json({ success: false, message: 'Failed to create customer' });
  }
});

router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId;
    const { name, address, phone } = req.body;

    // Ensure customer belongs to this tenant
    const existing = await prisma.customer.findFirst({ where: { id: req.params.id, tenantId } });
    if (!existing) {
      res.status(404).json({ success: false, message: 'Customer not found' });
      return;
    }

    const customer = await prisma.customer.update({
      where: { id: req.params.id },
      data: {
        name: name || undefined,
        address: address !== undefined ? address : undefined,
        phone: phone || undefined,
      },
    });
    res.json({ success: true, data: customer });
  } catch (error: any) {
    console.error('Error updating customer:', error);
    if (error.code === 'P2025') {
      res.status(404).json({ success: false, message: 'Customer not found' });
      return;
    }
    res.status(500).json({ success: false, message: 'Failed to update customer' });
  }
});

export default router;
