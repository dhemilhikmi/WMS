import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = Router();

interface EnableFeatureBody {
  tenantId: string;
  featureId: string;
}

function resolveTenantId(req: Request, requestedTenantId?: unknown): string | null {
  if (req.user?.role === 'superadmin' && typeof requestedTenantId === 'string') {
    return requestedTenantId;
  }
  return req.user?.tenantId || null;
}

// GET /api/tenant-features - Get enabled features for a tenant
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = resolveTenantId(req, req.query.tenantId);

    if (!tenantId) {
      res.status(400).json({
        success: false,
        message: 'Tenant tidak valid',
      });
      return;
    }

    const tenantFeatures = await prisma.tenantFeature.findMany({
      where: { tenantId },
      include: {
        feature: true,
      },
      orderBy: { feature: { name: 'asc' } },
    });

    res.json({
      success: true,
      data: tenantFeatures,
    });
  } catch (err: any) {
    console.error('Get tenant features error:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to fetch tenant features',
    });
  }
});

// POST /api/tenant-features - Enable a feature for a tenant
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId, featureId } = req.body as EnableFeatureBody;

    if (req.user?.role !== 'superadmin') {
      res.status(403).json({
        success: false,
        message: 'Akses ditolak: hanya superadmin yang dapat mengubah fitur tenant',
      });
      return;
    }

    if (!tenantId || !featureId) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields: tenantId, featureId',
      });
      return;
    }

    // Verify tenant exists
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      res.status(404).json({
        success: false,
        message: 'Tenant not found',
      });
      return;
    }

    // Verify feature exists
    const feature = await prisma.feature.findUnique({
      where: { id: featureId },
    });

    if (!feature) {
      res.status(404).json({
        success: false,
        message: 'Feature not found',
      });
      return;
    }

    const tenantFeature = await prisma.tenantFeature.upsert({
      where: {
        tenantId_featureId: {
          tenantId,
          featureId,
        },
      },
      create: {
        tenantId,
        featureId,
        enabled: true,
      },
      update: {
        enabled: true,
      },
      include: {
        feature: true,
      },
    });

    res.status(201).json({
      success: true,
      data: tenantFeature,
    });
  } catch (err: any) {
    console.error('Enable feature error:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to enable feature',
    });
  }
});

// DELETE /api/tenant-features/:featureId - Disable a feature for a tenant
router.delete('/:featureId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { featureId } = req.params;
    const tenantId = resolveTenantId(req, req.query.tenantId);

    if (req.user?.role !== 'superadmin') {
      res.status(403).json({
        success: false,
        message: 'Akses ditolak: hanya superadmin yang dapat mengubah fitur tenant',
      });
      return;
    }

    if (!tenantId) {
      res.status(400).json({
        success: false,
        message: 'tenantId query parameter is required',
      });
      return;
    }

    // Verify the tenant feature exists
    const tenantFeature = await prisma.tenantFeature.findFirst({
      where: {
        tenantId,
        featureId,
      },
    });

    if (!tenantFeature) {
      res.status(404).json({
        success: false,
        message: 'Tenant feature not found',
      });
      return;
    }

    await prisma.tenantFeature.delete({
      where: {
        tenantId_featureId: {
          tenantId,
          featureId,
        },
      },
    });

    res.json({
      success: true,
      message: 'Feature disabled successfully',
    });
  } catch (err: any) {
    console.error('Disable feature error:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to disable feature',
    });
  }
});

export default router;
