import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';


const FEATURE_REQUIRED_PLAN: Record<string, 'pro'> = {
  bom_hpp: 'pro',
  finance_full: 'pro',
  analytics: 'pro',
  garansi_premium: 'pro',
  unlimited_transactions: 'pro',
};

function isProTenant(tenant: { plan: string; planExpiry: Date | null; partnerType: string | null }) {
  if (tenant.partnerType === 'ppf_partner') return true;
  return tenant.plan === 'pro' && (!tenant.planExpiry || tenant.planExpiry > new Date());
}

export function requireFeature(featureKey: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        res.status(401).json({ success: false, message: 'Token tidak valid' });
        return;
      }

      const requiredPlan = FEATURE_REQUIRED_PLAN[featureKey];
      if (!requiredPlan) {
        next();
        return;
      }

      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { plan: true, planExpiry: true, partnerType: true },
      });

      if (!tenant) {
        res.status(404).json({ success: false, message: 'Tenant tidak ditemukan' });
        return;
      }

      if (isProTenant(tenant)) {
        next();
        return;
      }

      res.status(403).json({
        success: false,
        message: 'Fitur ini tersedia untuk paket Pro. Silakan upgrade untuk mengakses fitur ini.',
        upgradeRequired: true,
      });
    } catch (err) {
      next(err);
    }
  };
}

export async function checkTransactionQuota(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      res.status(401).json({ success: false, message: 'Token tidak valid' });
      return;
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { plan: true, planExpiry: true, partnerType: true },
    });

    if (!tenant) {
      res.status(404).json({ success: false, message: 'Tenant tidak ditemukan' });
      return;
    }

    if (isProTenant(tenant) || tenant.plan !== 'free') {
      next();
      return;
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const count = await prisma.registration.count({
      where: {
        tenantId,
        createdAt: {
          gte: startOfMonth,
          lt: startOfNextMonth,
        },
      },
    });

    if (count >= 50) {
      res.status(403).json({
        success: false,
        message: 'Kuota transaksi paket Free sudah mencapai 50 registrasi bulan ini. Silakan upgrade ke Pro.',
        quotaExceeded: true,
        upgradeRequired: true,
      });
      return;
    }

    next();
  } catch (err) {
    next(err);
  }
}
