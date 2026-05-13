import { Router, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';

const router = Router();

// verifyToken + requireSuperadmin already applied in app.ts

// GET /api/superadmin/tenants - List all tenants (excluding platform)
router.get('/tenants', async (_req: Request, res: Response): Promise<void> => {
  try {
    const tenants = await prisma.tenant.findMany({
      where: { slug: { not: 'platform' } },
      include: {
        subscription: {
          include: { plan: true },
        },
        _count: {
          select: { users: true, workshops: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: tenants,
    });
  } catch (err: any) {
    console.error('Get tenants error:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to fetch tenants',
    });
  }
});

// POST /api/superadmin/tenants - Create new tenant
interface CreateTenantBody {
  name: string;
  email: string;
  phone?: string;
  address?: string;
  planId?: string;
}

router.post('/tenants', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, phone, address, planId } = req.body as CreateTenantBody;

    if (!name || !email) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields: name, email',
      });
      return;
    }

    // Check if tenant email already exists
    const existing = await prisma.tenant.findUnique({
      where: { email },
    });

    if (existing) {
      res.status(409).json({
        success: false,
        message: 'Tenant with this email already exists',
      });
      return;
    }

    const slug = name.toLowerCase().replace(/\s+/g, '-');

    const tenant = await prisma.tenant.create({
      data: {
        name,
        email,
        slug,
        phone,
        address,
        subscription: {
          create: {
            status: 'active',
            planId: planId || null,
          },
        },
      },
      include: {
        subscription: {
          include: { plan: true },
        },
      },
    });

    res.status(201).json({
      success: true,
      data: tenant,
    });
  } catch (err: any) {
    console.error('Create tenant error:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to create tenant',
    });
  }
});

// PUT /api/superadmin/tenants/:id/plan - Update tenant plan fields
interface UpdateTenantPlanBody {
  plan?: string;
  planExpiry?: string | null;
  partnerType?: string | null;
}

router.put('/tenants/:id/plan', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { plan, planExpiry, partnerType } = req.body as UpdateTenantPlanBody;

    const allowedPlans = ['free', 'pro'];
    const allowedPartnerTypes = ['standard', 'ppf_partner'];

    if (!plan || !allowedPlans.includes(plan)) {
      res.status(400).json({
        success: false,
        message: 'Invalid plan',
      });
      return;
    }

    if (
      partnerType !== undefined &&
      partnerType !== null &&
      !allowedPartnerTypes.includes(partnerType)
    ) {
      res.status(400).json({
        success: false,
        message: 'Invalid partnerType',
      });
      return;
    }

    let parsedExpiry: Date | null = null;
    if (planExpiry) {
      parsedExpiry = new Date(planExpiry);
      if (Number.isNaN(parsedExpiry.getTime())) {
        res.status(400).json({
          success: false,
          message: 'Invalid planExpiry',
        });
        return;
      }
    }

    const tenant = await prisma.tenant.findUnique({ where: { id } });
    if (!tenant) {
      res.status(404).json({
        success: false,
        message: 'Tenant not found',
      });
      return;
    }

    const updated = await prisma.tenant.update({
      where: { id },
      data: {
        plan,
        planExpiry: parsedExpiry,
        partnerType: partnerType ?? null,
      },
      include: {
        subscription: {
          include: { plan: true },
        },
        _count: {
          select: { users: true, workshops: true },
        },
      },
    });

    console.log('[superadmin-plan-update]', {
      actorUserId: (req as any).user?.userId,
      tenantId: id,
      before: {
        plan: tenant.plan,
        planExpiry: tenant.planExpiry,
        partnerType: tenant.partnerType,
      },
      after: {
        plan: updated.plan,
        planExpiry: updated.planExpiry,
        partnerType: updated.partnerType,
      },
    });

    res.json({
      success: true,
      data: updated,
    });
  } catch (err: any) {
    console.error('Update tenant plan error:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to update tenant plan',
    });
  }
});

// PUT /api/superadmin/tenants/:id - Update tenant
interface UpdateTenantBody {
  name?: string;
  phone?: string;
  address?: string;
}

router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, phone, address } = req.body as UpdateTenantBody;

    const tenant = await prisma.tenant.findUnique({
      where: { id },
    });

    if (!tenant) {
      res.status(404).json({
        success: false,
        message: 'Tenant not found',
      });
      return;
    }

    const updated = await prisma.tenant.update({
      where: { id },
      data: {
        ...(name && { name, slug: name.toLowerCase().replace(/\s+/g, '-') }),
        ...(phone && { phone }),
        ...(address && { address }),
      },
      include: {
        subscription: {
          include: { plan: true },
        },
      },
    });

    res.json({
      success: true,
      data: updated,
    });
  } catch (err: any) {
    console.error('Update tenant error:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to update tenant',
    });
  }
});

// DELETE /api/superadmin/tenants/:id - Delete/deactivate tenant
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Prevent deleting platform tenant
    const tenant = await prisma.tenant.findUnique({
      where: { id },
    });

    if (!tenant) {
      res.status(404).json({
        success: false,
        message: 'Tenant not found',
      });
      return;
    }

    if (tenant.slug === 'platform') {
      res.status(403).json({
        success: false,
        message: 'Cannot delete platform tenant',
      });
      return;
    }

    // Suspend the subscription instead of hard delete
    await prisma.tenantSubscription.update({
      where: { tenantId: id },
      data: { status: 'suspended' },
    });

    res.json({
      success: true,
      message: 'Tenant subscription suspended',
    });
  } catch (err: any) {
    console.error('Delete tenant error:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to delete tenant',
    });
  }
});

// GET /api/superadmin/plans - List all subscription plans
router.get('/plans', async (_req: Request, res: Response): Promise<void> => {
  try {
    const plans = await prisma.subscriptionPlan.findMany({
      orderBy: { price: 'asc' },
    });

    res.json({
      success: true,
      data: plans,
    });
  } catch (err: any) {
    console.error('Get plans error:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to fetch plans',
    });
  }
});

// POST /api/superadmin/plans - Create new subscription plan
interface CreatePlanBody {
  name: string;
  description?: string;
  price: number;
  maxUsers: number;
  maxServices: number;
}

router.post('/plans', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, price, maxUsers, maxServices } = req.body as CreatePlanBody;

    if (!name || price === undefined || !maxUsers || !maxServices) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields: name, price, maxUsers, maxServices',
      });
      return;
    }

    const plan = await prisma.subscriptionPlan.create({
      data: {
        name,
        description,
        price: new Prisma.Decimal(price),
        maxUsers,
        maxServices,
      },
    });

    res.status(201).json({
      success: true,
      data: plan,
    });
  } catch (err: any) {
    console.error('Create plan error:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to create plan',
    });
  }
});

// PUT /api/superadmin/plans/:id - Update subscription plan
interface UpdatePlanBody {
  name?: string;
  description?: string;
  price?: number;
  maxUsers?: number;
  maxServices?: number;
  isActive?: boolean;
}

router.put('/plans/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, description, price, maxUsers, maxServices, isActive } = req.body as UpdatePlanBody;

    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id },
    });

    if (!plan) {
      res.status(404).json({
        success: false,
        message: 'Plan not found',
      });
      return;
    }

    const updated = await prisma.subscriptionPlan.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description && { description }),
        ...(price && { price: new Prisma.Decimal(price) }),
        ...(maxUsers && { maxUsers }),
        ...(maxServices && { maxServices }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    res.json({
      success: true,
      data: updated,
    });
  } catch (err: any) {
    console.error('Update plan error:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to update plan',
    });
  }
});

// DELETE /api/superadmin/plans/:id - Delete subscription plan
router.delete('/plans/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id },
    });

    if (!plan) {
      res.status(404).json({
        success: false,
        message: 'Plan not found',
      });
      return;
    }

    // Mark as inactive instead of hard delete
    await prisma.subscriptionPlan.update({
      where: { id },
      data: { isActive: false },
    });

    res.json({
      success: true,
      message: 'Plan deactivated',
    });
  } catch (err: any) {
    console.error('Delete plan error:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to delete plan',
    });
  }
});

// POST /api/superadmin/subscriptions - Assign/change plan for a tenant
interface AssignSubscriptionBody {
  tenantId: string;
  planId: string;
  status?: string;
}

router.post(
  '/subscriptions',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId, planId, status } = req.body as AssignSubscriptionBody;

      if (!tenantId || !planId) {
        res.status(400).json({
          success: false,
          message: 'Missing required fields: tenantId, planId',
        });
        return;
      }

      const subscription = await prisma.tenantSubscription.upsert({
        where: { tenantId },
        create: {
          tenantId,
          planId,
          status: status || 'active',
        },
        update: {
          planId,
          ...(status && { status }),
        },
        include: {
          plan: true,
          tenant: true,
        },
      });

      res.status(201).json({
        success: true,
        data: subscription,
      });
    } catch (err: any) {
      console.error('Assign subscription error:', err);
      res.status(500).json({
        success: false,
        message: err.message || 'Failed to assign subscription',
      });
    }
  }
);

// PUT /api/superadmin/subscriptions/:tenantId - Update subscription status
interface UpdateSubscriptionBody {
  status?: string;
  endDate?: string;
  notes?: string;
}

router.put(
  '/subscriptions/:tenantId',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId } = req.params;
      const { status, endDate, notes } = req.body as UpdateSubscriptionBody;

      const subscription = await prisma.tenantSubscription.findUnique({
        where: { tenantId },
      });

      if (!subscription) {
        res.status(404).json({
          success: false,
          message: 'Subscription not found',
        });
        return;
      }

      const updated = await prisma.tenantSubscription.update({
        where: { tenantId },
        data: {
          ...(status && { status }),
          ...(endDate && { endDate: new Date(endDate) }),
          ...(notes && { notes }),
        },
        include: {
          plan: true,
          tenant: true,
        },
      });

      res.json({
        success: true,
        data: updated,
      });
    } catch (err: any) {
      console.error('Update subscription error:', err);
      res.status(500).json({
        success: false,
        message: err.message || 'Failed to update subscription',
      });
    }
  }
);

// GET /api/superadmin/analytics - Platform-wide analytics
router.get('/analytics', async (_req: Request, res: Response): Promise<void> => {
  try {
    const tenants = await prisma.tenant.findMany({
      where: { slug: { not: 'platform' } },
      include: {
        subscription: true,
        _count: {
          select: { users: true, workshops: true },
        },
      },
    });

    const subscriptions = await prisma.tenantSubscription.findMany({
      where: { tenant: { slug: { not: 'platform' } } },
      include: { plan: true },
    });

    const activeSubs = subscriptions.filter((s) => s.status === 'active');
    const trialSubs = subscriptions.filter((s) => s.status === 'trial');
    const suspendedSubs = subscriptions.filter((s) => s.status === 'suspended');

    const totalRevenue = activeSubs.reduce((sum, sub) => {
      const price = sub.plan?.price ? Number(sub.plan.price) : 0;
      return sum + price;
    }, 0);

    // Count all users and workshops across all tenants
    const allUsers = tenants.reduce((sum, t) => sum + t._count.users, 0);
    const allWorkshops = tenants.reduce((sum, t) => sum + t._count.workshops, 0);

    const analytics = {
      totalTenants: tenants.length,
      activeTenants: activeSubs.length,
      trialTenants: trialSubs.length,
      suspendedTenants: suspendedSubs.length,
      totalRevenue,
      monthlyRevenue: activeSubs.reduce((sum, sub) => {
        const price = sub.plan?.price ? Number(sub.plan.price) : 0;
        return sum + price;
      }, 0),
      totalUsers: allUsers,
      totalWorkshops: allWorkshops,
      totalEndCustomers: await prisma.registration.count(),
    };

    res.json({
      success: true,
      data: analytics,
    });
  } catch (err: any) {
    console.error('Get analytics error:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to fetch analytics',
    });
  }
});

// GET /api/superadmin/system-status - Platform service health
router.get('/system-status', async (_req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();

  // Check database
  let dbStatus: 'ok' | 'error' = 'error';
  let dbLatency = 0;
  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbLatency = Date.now() - dbStart;
    dbStatus = 'ok';
  } catch {
    dbStatus = 'error';
  }

  // Check SMTP config
  const smtpConfigured = !!(
    process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  );

  // Check Midtrans config
  const midtransConfigured = !!(
    process.env.MIDTRANS_SERVER_KEY &&
    process.env.MIDTRANS_CLIENT_KEY &&
    !process.env.MIDTRANS_SERVER_KEY.includes('test-key')
  );

  // Check JWT secret strength
  const jwtSecret = process.env.JWT_SECRET || '';
  const jwtSecure = jwtSecret.length >= 64;

  // DB stats
  let dbStats = { tenants: 0, users: 0, workshops: 0 };
  try {
    const [tenants, users, workshops] = await Promise.all([
      prisma.tenant.count(),
      prisma.user.count(),
      prisma.workshop.count(),
    ]);
    dbStats = { tenants, users, workshops };
  } catch { /* ignore */ }

  const totalLatency = Date.now() - startTime;

  res.json({
    success: true,
    data: {
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || 'development',
      totalLatency,
      services: {
        api:       { status: 'ok',    latency: totalLatency },
        database:  { status: dbStatus, latency: dbLatency, records: dbStats },
        smtp:      { status: smtpConfigured ? 'configured' : 'not_configured' },
        midtrans:  { status: midtransConfigured ? 'configured' : 'sandbox' },
        jwt:       { status: jwtSecure ? 'secure' : 'weak', expiresIn: process.env.JWT_EXPIRY || '7d' },
      },
    },
  });
});

export default router;
