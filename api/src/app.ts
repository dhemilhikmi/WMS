import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import workshopsRoutes from './routes/workshops';
import registrationsRoutes from './routes/registrations';
import customersRoutes from './routes/customers';
import usersRoutes from './routes/users';
import featuresRoutes from './routes/features';
import tenantFeaturesRoutes from './routes/tenantFeatures';
import superadminRoutes from './routes/superadmin';
import settingsRoutes from './routes/settings';
import ordersRoutes from './routes/orders';
import publicRoutes from './routes/public';
import inventoryRoutes from './routes/inventory';
import suppliersRoutes from './routes/suppliers';
import purchaseOrdersRoutes from './routes/purchaseOrders';
import expensesRoutes from './routes/expenses';
import serviceMaterialsRoutes from './routes/serviceMaterials';
import tenantSettingsRoutes from './routes/tenantSettings';
import warrantiesRoutes from './routes/warranties';
import teknisiRoutes from './routes/teknisi';
import { checkTenantActive } from './middleware/tenantActive';
import { verifyToken, requireAdmin, requireSuperadmin } from './middleware/auth';
import { authLimiter, emailLimiter } from './middleware/rateLimit';
import { requireFeature } from './middleware/featureGate';

dotenv.config();

const app = express();
const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.MAIN_DOMAIN && `https://${process.env.MAIN_DOMAIN}`,
  process.env.ROOT_DOMAIN && `https://${process.env.ROOT_DOMAIN}`,
  'https://workshopmu.web.app',
  'https://workshopmu.com',
  'https://www.workshopmu.com',
].filter(Boolean);

// Middleware
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    // Allow localhost and private LAN origins for development
    if (!origin || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1') || /^http:\/\/(192\.168\.|10\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(origin)) {
      callback(null, true);
    } else if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Tenant middleware - extract tenant from subdomain
app.use((_req: Request, _res: Response, next: NextFunction) => {
  const host = _req.get('host') || '';
  const parts = host.split('.');

  if (parts.length > 2 || (parts.length === 2 && parts[0] !== 'localhost')) {
    const tenant = parts[0];
    (_req as any).tenant = tenant;
  }

  next();
});

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/resend-verification', emailLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/orders', ordersRoutes);

// Protected tenant routes — require valid JWT + active tenant
app.use('/api/workshops',      verifyToken, checkTenantActive, workshopsRoutes);
app.use('/api/registrations',  verifyToken, checkTenantActive, registrationsRoutes);
app.use('/api/customers',      verifyToken, checkTenantActive, customersRoutes);
app.use('/api/users',          verifyToken, requireAdmin, checkTenantActive, usersRoutes);
app.use('/api/features',       verifyToken, checkTenantActive, featuresRoutes);
app.use('/api/tenant-features',verifyToken, checkTenantActive, tenantFeaturesRoutes);
app.use('/api/inventory',      verifyToken, checkTenantActive, inventoryRoutes);
app.use('/api/suppliers',      verifyToken, checkTenantActive, suppliersRoutes);
app.use('/api/purchase-orders',verifyToken, checkTenantActive, purchaseOrdersRoutes);
app.use('/api/expenses',          verifyToken, checkTenantActive, expensesRoutes);
app.use('/api/service-materials', verifyToken, checkTenantActive, requireFeature('bom_hpp'), serviceMaterialsRoutes);
app.use('/api/tenant-settings',  verifyToken, checkTenantActive, tenantSettingsRoutes);
app.use('/api/warranties',       verifyToken, checkTenantActive, warrantiesRoutes);
app.use('/api/teknisi',          verifyToken, checkTenantActive, teknisiRoutes);

// Superadmin-only routes
app.use('/api/superadmin', verifyToken, requireSuperadmin, superadminRoutes);
app.use('/api/settings',   verifyToken, requireSuperadmin, settingsRoutes);

// 404 Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.path,
  });
});

// Error Handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

export default app;
