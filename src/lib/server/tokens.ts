import { createHash, randomBytes } from 'node:crypto';

export function createSecretToken() {
  return randomBytes(32).toString('base64url');
}

export function hashSecretToken(token: string) {
  return createHash('sha256').update(token, 'utf8').digest('base64url');
}
