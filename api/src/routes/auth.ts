import { Router, Request, Response } from 'express';
import * as jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

interface RegisterBody {
  tenantName: string;
  tenantEmail: string;
  email: string;
  name: string;
  password: string;
}

interface LoginBody {
  email: string;
  password: string;
}

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '7d';

router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantName, tenantEmail, email, name, password } = req.body as RegisterBody;

    if (!tenantName || !tenantEmail || !email || !name || !password) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields: tenantName, tenantEmail, email, name, password',
      });
      return;
    }

    // Create tenant
    const tenant = await prisma.tenant.create({
      data: {
        name: tenantName,
        slug: tenantName.toLowerCase().replace(/\s+/g, '-'),
        email: tenantEmail,
      },
    });

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        name,
        password,
        role: 'admin',
        tenantId: tenant.id,
      },
    });

    const token = jwt.sign(
      { userId: user.id, tenantId: tenant.id, email: user.email },
      JWT_SECRET as string,
      { expiresIn: JWT_EXPIRY } as jwt.SignOptions
    );

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        tenant: { id: tenant.id, name: tenant.name },
        user: { id: user.id, email: user.email, name: user.name },
        token,
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

    const user = await prisma.user.findFirst({
      where: { email },
      include: { tenant: true },
    });

    if (!user || user.password !== password) {
      res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
      return;
    }

    const token = jwt.sign(
      { userId: user.id, tenantId: user.tenantId, email: user.email },
      JWT_SECRET as string,
      { expiresIn: JWT_EXPIRY } as jwt.SignOptions
    );

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        tenant: { id: user.tenant.id, name: user.tenant.name },
        user: { id: user.id, email: user.email, name: user.name },
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

export default router;
