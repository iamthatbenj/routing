import { createClient } from '@libsql/client';
import { env } from '$env/dynamic/private';

const url = env.TURSO_DATABASE_URL ?? env.DATABASE_URL ?? 'file:local.db';
const authToken = env.TURSO_AUTH_TOKEN ?? env.DATABASE_AUTH_TOKEN;

export const db = createClient({ url, authToken });
