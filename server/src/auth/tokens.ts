import { createHmac, randomBytes, randomUUID, timingSafeEqual, createHash } from 'node:crypto';
import { config } from '../config.js';
import { ApiError } from '../utils/http.js';

type AccessTokenPayload = {
  sub: string;
  iat: number;
  exp: number;
  jti: string;
  v: number;
};

function encodeJson(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function signature(input: string): string {
  return createHmac('sha256', config.jwtSecret).update(input).digest('base64url');
}

export function issueAccessToken(userId: string, authVersion: number) {
  const now = Math.floor(Date.now() / 1000);
  const expiresAtSeconds = now + config.accessTokenMinutes * 60;
  const header = encodeJson({ alg: 'HS256', typ: 'JWT' });
  const payload = encodeJson({ sub: userId, iat: now, exp: expiresAtSeconds, jti: randomUUID(), v: authVersion } satisfies AccessTokenPayload);
  const input = `${header}.${payload}`;
  return {
    token: `${input}.${signature(input)}`,
    expiresAt: new Date(expiresAtSeconds * 1000).toISOString(),
  };
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const parts = token.split('.');
  if (parts.length !== 3) throw new ApiError(401, 'Invalid session token.');
  const [header, payload, suppliedSignature] = parts;
  if (!header || !payload || !suppliedSignature) throw new ApiError(401, 'Invalid session token.');

  const expected = Buffer.from(signature(`${header}.${payload}`));
  const supplied = Buffer.from(suppliedSignature);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
    throw new ApiError(401, 'Invalid session token.');
  }

  let parsed: AccessTokenPayload;
  try {
    parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as AccessTokenPayload;
  } catch {
    throw new ApiError(401, 'Invalid session token.');
  }
  if (!parsed.sub || !parsed.exp || !Number.isInteger(parsed.v) || parsed.v < 1 || parsed.exp <= Math.floor(Date.now() / 1000)) {
    throw new ApiError(401, 'Your session has expired.');
  }
  return parsed;
}

export function createOpaqueToken() {
  const token = randomBytes(48).toString('base64url');
  return { token, hash: hashOpaqueToken(token) };
}

export function hashOpaqueToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
