import { Router, Request, Response } from 'express';
import * as bcrypt from 'bcrypt';
import prisma from '../lib/prisma';

const router = Router();
const BCRYPT_ROUNDS = 12;
const ALLOWED_ROLES = ['user', 'member', 'moderator', 'admin'];

function canManageUsers(req: Request): boolean {
  return req.user?.role === 'admin' || req.user?.role === 'superadmin';
}

function validateRole(req: Request, res: Response, role: string): boolean {
  if (role === 'superadmin') {
    if (req.user!.role !== 'superadmin') {
      res.status(403).json({ success: false, message: 'Only superadmin can assign superadmin role' });
      return false;
    }
    return true;
  }
  if (!ALLOWED_ROLES.includes(role)) {
    res.status(400).json({ success: false, message: 'Invalid role' });
    return false;
  }
  return true;
}

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId;
    const users = await prisma.user.findMany({
      where: { tenantId },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: users });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch users' });
  }
});

router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!canManageUsers(req)) {
      res.status(403).json({ success: false, message: 'Akses ditolak: hanya admin' });
      return;
    }

    const tenantId = req.user!.tenantId;
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      res.status(400).json({ success: false, message: 'name, email, password, role required' });
      return;
    }
    if (!validateRole(req, res, role)) return;

    const existing = await prisma.user.findFirst({ where: { email, tenantId } });
    if (existing) {
      res.status(409).json({ success: false, message: 'Email sudah terdaftar di organisasi ini' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword, role, tenantId, emailVerified: true },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });
    res.status(201).json({ success: true, data: user });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to create user' });
  }
});

router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!canManageUsers(req)) {
      res.status(403).json({ success: false, message: 'Akses ditolak: hanya admin' });
      return;
    }

    const tenantId = req.user!.tenantId;
    const { name, role, password } = req.body;

    const user = await prisma.user.findFirst({ where: { id: req.params.id, tenantId } });
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    const updateData: { name?: string; role?: string; password?: string } = {};
    if (name !== undefined) updateData.name = name;
    if (role !== undefined) {
      if (!validateRole(req, res, role)) return;
      updateData.role = role;
    }
    if (password !== undefined && password !== '') {
      if (typeof password !== 'string' || password.length < 8) {
        res.status(400).json({ success: false, message: 'Password minimal 8 karakter' });
        return;
      }
      updateData.password = await bcrypt.hash(password, BCRYPT_ROUNDS);
    }

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: updateData,
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to update user' });
  }
});

router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!canManageUsers(req)) {
      res.status(403).json({ success: false, message: 'Akses ditolak: hanya admin' });
      return;
    }

    const tenantId = req.user!.tenantId;

    // Prevent deleting yourself
    if (req.params.id === req.user!.userId) {
      res.status(400).json({ success: false, message: 'Tidak bisa menghapus akun sendiri' });
      return;
    }

    const user = await prisma.user.findFirst({ where: { id: req.params.id, tenantId } });
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to delete user' });
  }
});

export default router;
