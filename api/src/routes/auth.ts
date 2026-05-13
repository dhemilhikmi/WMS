import { Router, Request, Response } from 'express';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import prisma from '../lib/prisma';
import { isSmtpConfigured, sendVerificationEmail } from '../services/email';
import { createPaymentOrder } from '../services/midtrans';
import { JWT_SECRET, JWT_EXPIRY, PAYMENT_ENABLED } from '../config';

const BCRYPT_ROUNDS = 12;

const router = Router();

function toSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'workshop';
}

async function createUniqueTenantSlug(name: string) {
  const baseSlug = toSlug(name);
  let slug = baseSlug;
  let suffix = 2;

  while (await prisma.tenant.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return slug;
}

interface RegisterBody {
  tenantName: string;
  tenantEmail?: string;
  email: string;
  name: string;
  password: string;
  planId?: string;
}

interface LoginBody {
  email: string;
  password: string;
}

router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantName, tenantEmail, email, name, password } = req.body as RegisterBody;
    const accountEmail = email?.trim();
    const workshopEmail = tenantEmail?.trim() || accountEmail;

    if (!tenantName || !accountEmail || !name || !password) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields: tenantName, email, name, password',
      });
      return;
    }

    const existingTenantEmail = await prisma.tenant.findUnique({
      where: { email: workshopEmail },
    });

    if (existingTenantEmail) {
      res.status(409).json({
        success: false,
        message: 'Email ini sudah terdaftar sebagai workshop. Silakan login atau gunakan email lain.',
      });
      return;
    }

    const slug = await createUniqueTenantSlug(tenantName);

    // Create tenant
    const tenant = await prisma.tenant.create({
      data: {
        name: tenantName,
        slug,
        email: workshopEmail,
      },
    });

    const trialExpiry = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
    const trialTenant = await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        plan: 'pro',
        planExpiry: trialExpiry,
      },
    });

    // Hash password
    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: accountEmail,
        name,
        password: hashedPassword,
        role: 'admin',
        tenantId: tenant.id,
      },
    });

    // Auto-enable default features for new tenant
    const defaultFeatures = await prisma.feature.findMany({ where: { isDefault: true } });
    await prisma.tenantFeature.createMany({
      data: defaultFeatures.map((f) => ({
        tenantId: tenant.id,
        featureId: f.id,
        enabled: true,
      })),
      skipDuplicates: true,
    });

    // Create default services for new tenant
    const defaultServices = [
      {
        title: 'Detailing',
        description: 'Professional car detailing service',
        price: '0',
      },
      {
        title: 'Paint Protection Film (PPF)',
        description: 'Paint protection film application service',
        price: '0',
      },
    ];

    const now = new Date();
    const oneYearLater = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

    await Promise.all(
      defaultServices.map((service) =>
        prisma.workshop.create({
          data: {
            title: service.title,
            description: service.description,
            price: service.price,
            type: 'main_service',
            tenantId: tenant.id,
            startDate: now,
            endDate: oneYearLater,
            maxCapacity: 10,
            status: 'published',
          },
        })
      )
    );

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Check if SMTP is configured
    const smtpReady = await isSmtpConfigured();

    let emailSent = false;
    let emailVerifiedNow = false;
    let emailDeliveryFailed = false;

    if (smtpReady) {
      // Update user with token
      await prisma.user.update({
        where: { id: user.id },
        data: { verificationToken, verificationTokenExpiry },
      });
      // Send verification email (fire and forget with error handling)
      try {
        await sendVerificationEmail(user.email, user.name, verificationToken);
        emailSent = true;
      } catch (emailErr) {
        console.error('Failed to send verification email:', emailErr);
        emailDeliveryFailed = true;
        // Fall through: emailSent = false, emailVerifiedNow = true
        emailVerifiedNow = true;
        await prisma.user.update({
          where: { id: user.id },
          data: { emailVerified: true, verificationToken: null, verificationTokenExpiry: null },
        });
        await prisma.tenant.update({ where: { id: tenant.id }, data: { isActive: true } });
      }
    } else {
      // SMTP not configured - auto-verify so dev/unconfigured setups are not blocked
      emailVerifiedNow = true;
      await prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: true },
      });
      await prisma.tenant.update({ where: { id: tenant.id }, data: { isActive: true } });
    }

    // If planId provided, create payment order
    let paymentData = null;
    if (PAYMENT_ENABLED && req.body.planId) {
      try {
        paymentData = await createPaymentOrder(
          tenant.id,
          req.body.planId,
          tenantName,
          workshopEmail,
          name,
          accountEmail
        );
      } catch (paymentErr: any) {
        console.error('Payment order creation error:', paymentErr);
        // Don't fail registration if payment order fails - user can retry payment
      }
    }

    res.status(201).json({
      success: true,
      message: emailSent
        ? 'Registration successful. Please check your email to verify your account.'
        : 'Registration successful.',
      data: {
        tenant: {
          id: trialTenant.id,
          name: trialTenant.name,
          email: trialTenant.email,
          plan: trialTenant.plan,
          planExpiry: trialTenant.planExpiry,
          partnerType: trialTenant.partnerType,
        },
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
        emailSent,
        emailVerified: emailVerifiedNow,
        emailDeliveryFailed,
        ...(paymentData && { payment: paymentData }),
      },
    });
  } catch (err: any) {
    console.error('Register error:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Registration failed',
    });
  }
});

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body as LoginBody;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: 'Email and password required',
      });
      return;
    }

    const users = await prisma.user.findMany({
      where: { email },
      include: { tenant: true },
    });

    let user = null;
    for (const candidate of users) {
      if (typeof candidate.password !== 'string') continue;
      const passwordMatch = await bcrypt.compare(password, candidate.password);
      if (passwordMatch) {
        user = candidate;
        break;
      }
    }

    if (!user) {
      res.status(401).json({ success: false, message: 'Email atau password salah' });
      return;
    }

    if (!user.emailVerified) {
      res.status(403).json({
        success: false,
        message: 'Email not verified. Please check your inbox.',
        code: 'EMAIL_NOT_VERIFIED',
        email: user.email,
      });
      return;
    }

    const token = jwt.sign(
      { userId: user.id, tenantId: user.tenantId, email: user.email, role: user.role },
      JWT_SECRET as string,
      { expiresIn: JWT_EXPIRY } as jwt.SignOptions
    );

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        tenant: {
          id: user.tenant.id,
          name: user.tenant.name,
          email: user.tenant.email,
          plan: user.tenant.plan,
          planExpiry: user.tenant.planExpiry,
          partnerType: user.tenant.partnerType,
        },
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
        token,
      },
    });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Login failed',
    });
  }
});

router.get('/verify-email', async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      res.status(400).json({
        success: false,
        message: 'Verification token is required',
      });
      return;
    }

    const user = await prisma.user.findFirst({
      where: {
        verificationToken: token,
        verificationTokenExpiry: { gt: new Date() },
      },
      include: { tenant: true },
    });

    if (!user) {
      res.status(400).json({
        success: false,
        message: 'Invalid or expired verification token',
      });
      return;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verificationToken: null,
        verificationTokenExpiry: null,
      },
    });

    // If user is admin, activate tenant
    if (user.role === 'admin') {
      await prisma.tenant.update({
        where: { id: user.tenantId },
        data: { isActive: true },
      });
    }

    const jwtToken = jwt.sign(
      { userId: user.id, tenantId: user.tenantId, email: user.email, role: user.role },
      JWT_SECRET as string,
      { expiresIn: JWT_EXPIRY } as jwt.SignOptions
    );

    res.json({
      success: true,
      message: 'Email verified successfully',
      data: {
        tenant: {
          id: user.tenant.id,
          name: user.tenant.name,
          email: user.tenant.email,
          plan: user.tenant.plan,
          planExpiry: user.tenant.planExpiry,
          partnerType: user.tenant.partnerType,
        },
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
        token: jwtToken,
      },
    });
  } catch (err: any) {
    console.error('Verify email error:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Email verification failed',
    });
  }
});

router.post('/resend-verification', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({
        success: false,
        message: 'Email is required',
      });
      return;
    }

    const user = await prisma.user.findFirst({
      where: { email },
    });

    if (!user || user.emailVerified) {
      res.status(200).json({
        success: true,
        message: 'If an account exists and is not verified, a verification email will be sent shortly.',
      });
      return;
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: { verificationToken, verificationTokenExpiry },
    });

    const smtpReady = await isSmtpConfigured();

    if (smtpReady) {
      try {
        await sendVerificationEmail(user.email, user.name, verificationToken);
      } catch (emailErr) {
        console.error('Failed to send verification email:', emailErr);
      }
    }

    res.status(200).json({
      success: true,
      message: 'If an account exists and is not verified, a verification email will be sent shortly.',
    });
  } catch (err: any) {
    console.error('Resend verification error:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to resend verification email',
    });
  }
});

export default router;
