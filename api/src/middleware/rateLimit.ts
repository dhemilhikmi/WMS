import rateLimit from 'express-rate-limit';

function rateLimitResponse(message: string) {
  return {
    success: false,
    message,
  };
}

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitResponse('Terlalu banyak percobaan login atau registrasi. Coba lagi dalam 15 menit.'),
});

export const emailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitResponse('Terlalu banyak permintaan email verifikasi. Coba lagi dalam 1 jam.'),
});
