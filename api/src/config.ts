import dotenv from 'dotenv';

dotenv.config();

const secret = process.env.JWT_SECRET;

if (!secret || secret.length < 32) {
  throw new Error('JWT_SECRET env var must be set and >= 32 chars');
}

const JWT_SECRET: string = secret;

export const JWT_EXPIRY = (process.env.JWT_EXPIRY || '7d') as import('jsonwebtoken').SignOptions['expiresIn'];
export const PAYMENT_ENABLED = process.env.PAYMENT_ENABLED === 'true';
export { JWT_SECRET };
