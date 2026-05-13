import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';


export async function checkTenantActive(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      res.status(401).json({
        success: false,
        message: 'Token tidak valid',
      });
      return;
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, isActive: true },
    });

    if (!tenant) {
      res.status(404).json({
        success: false,
        message: 'Tenant not found',
      });
      return;
    }

    if (!tenant.isActive) {
      res.status(403).json({
        success: false,
        message: 'Tenant account is not active. Please verify your email to activate your account.',
        code: 'TENANT_NOT_ACTIVE',
      });
      return;
    }

    next();
  } catch (err) {
    console.error('Tenant active check error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to verify tenant status',
    });
  }
}
