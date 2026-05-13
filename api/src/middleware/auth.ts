import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config';

export function verifyToken(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'Token tidak ditemukan' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as unknown as {
      userId: string;
      tenantId: string;
      email: string;
      role: string;
    };

    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Token tidak valid atau sudah kadaluarsa' });
  }
}

export function requireSuperadmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== 'superadmin') {
    res.status(403).json({ success: false, message: 'Akses ditolak: hanya superadmin' });
    return;
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || !['admin', 'moderator', 'superadmin'].includes(req.user.role)) {
    res.status(403).json({ success: false, message: 'Akses ditolak: hanya admin' });
    return;
  }
  next();
}
