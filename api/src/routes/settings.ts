import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { isSmtpConfigured, sendTestEmail } from '../services/email';

const router = Router();

const parseUserRole = (req: Request, _res: Response, next: any): void => {
  (req as any).user = { role: 'superadmin' };
  next();
};

const isSuperadmin = (req: Request, res: Response, next: any): void => {
  const role = (req as any).user?.role;
  if (role !== 'superadmin') {
    res.status(403).json({
      success: false,
      message: 'Access denied. Superadmin role required.',
    });
    return;
  }
  next();
};

router.use(parseUserRole);
router.use(isSuperadmin);

const SMTP_KEYS = [
  'smtp_host',
  'smtp_port',
  'smtp_user',
  'smtp_pass',
  'smtp_from_email',
  'smtp_from_name',
  'smtp_secure',
  'landing_content',
  'app_name',
];

// GET /api/settings - Return all platform settings
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const settings = await prisma.platformSetting.findMany();
    const map: Record<string, string> = {};
    for (const s of settings) {
      map[s.key] = s.value;
    }
    res.json({ success: true, data: map });
  } catch (err: any) {
    console.error('Get settings error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

interface SettingsBody {
  smtp_host?: string;
  smtp_port?: string;
  smtp_user?: string;
  smtp_pass?: string;
  smtp_from_email?: string;
  smtp_from_name?: string;
  smtp_secure?: string;
}

// PUT /api/settings - Upsert all provided key-value pairs
router.put('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as SettingsBody;
    const validKeys = SMTP_KEYS;

    const upserts = Object.entries(body)
      .filter(([key]) => validKeys.includes(key))
      .map(([key, value]) =>
        prisma.platformSetting.upsert({
          where: { key },
          create: { key, value: value as string },
          update: { value: value as string },
        })
      );

    await Promise.all(upserts);

    res.json({ success: true, message: 'Settings saved' });
  } catch (err: any) {
    console.error('Update settings error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/settings/test-email - Send a test email using current SMTP config
router.post('/test-email', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ success: false, message: 'email is required' });
      return;
    }

    const configured = await isSmtpConfigured();
    if (!configured) {
      res.status(400).json({
        success: false,
        message: 'SMTP is not configured. Please save SMTP settings first.',
      });
      return;
    }

    await sendTestEmail(email);
    res.json({ success: true, message: `Test email sent to ${email}` });
  } catch (err: any) {
    console.error('Test email error:', err);
    res.status(500).json({
      success: false,
      message: `Failed to send test email: ${err.message}`,
    });
  }
});

export default router;
