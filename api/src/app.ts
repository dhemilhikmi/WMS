import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3001',
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

// API Routes (to be implemented)
app.use('/api/auth', require('./routes/auth').default || {});
app.use('/api/workshops', require('./routes/workshops').default || {});
app.use('/api/registrations', require('./routes/registrations').default || {});

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
