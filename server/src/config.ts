import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function positiveInteger(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer.`);
  return value;
}

const jwtSecret = required('JWT_SECRET');
if (jwtSecret.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters.');

export const config = {
  databaseUrl: required('DATABASE_URL'),
  jwtSecret,
  host: process.env.HOST?.trim() || '0.0.0.0',
  port: positiveInteger('PORT', 4000),
  accessTokenMinutes: positiveInteger('ACCESS_TOKEN_MINUTES', 15),
  refreshTokenDays: positiveInteger('REFRESH_TOKEN_DAYS', 30),
  returnDevelopmentResetToken: process.env.DEV_RETURN_PASSWORD_RESET_TOKEN === 'true' && process.env.NODE_ENV !== 'production',
  resendApiKey: process.env.RESEND_API_KEY?.trim() || '',
  passwordResetFrom: process.env.PASSWORD_RESET_FROM?.trim() || '',
  passwordResetLinkBase: process.env.PASSWORD_RESET_LINK_BASE?.trim() || 'togetherly://reset-password',
} as const;
