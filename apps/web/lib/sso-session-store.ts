import 'server-only';
import type { SessionStore, StoredSession } from '@vuteq/sso-client-react';
import Redis from 'ioredis';
import { randomUUID } from 'node:crypto';

const PREFIX = `${process.env.VUTEQ_SSO_REDIS_KEY_PREFIX ?? ''}mtc:sso:`;
const GLOBAL_KEY = '__mtcSsoRedis';
function client(): Redis { const scope = globalThis as typeof globalThis & { [GLOBAL_KEY]?: Redis }; if (!scope[GLOBAL_KEY]) scope[GLOBAL_KEY] = new Redis({ host: process.env.REDIS_HOST ?? 'localhost', port: Number(process.env.REDIS_PORT ?? 6379), password: process.env.REDIS_PASSWORD || undefined, db: Number(process.env.VUTEQ_SSO_REDIS_DB ?? 0), connectionName: 'mtc-web-sso', maxRetriesPerRequest: 2 }); return scope[GLOBAL_KEY]; }
const entry = (key: string) => `${PREFIX}entry:${key}`;
async function parse(redis: Redis, key: string, raw: string): Promise<StoredSession | null> { try { const value = JSON.parse(raw) as StoredSession; if (value.expiresAt <= Date.now()) { await redis.del(key); return null; } return value; } catch { await redis.del(key); return null; } }
export const ssoSessionStore: SessionStore = {
  async get(key) { const redis = client(); const raw = await redis.get(entry(key)); return raw ? parse(redis, entry(key), raw) : null; },
  async set(key, value) { await client().set(entry(key), JSON.stringify(value), 'PX', Math.max(1, value.expiresAt - Date.now())); },
  async take(key) { const redis = client(); const storageKey = entry(key); const raw = await redis.eval("local v=redis.call('GET',KEYS[1]); if v then redis.call('DEL',KEYS[1]); end; return v", 1, storageKey) as string | null; return raw ? parse(redis, storageKey, raw) : null; },
  async delete(key) { await client().del(entry(key)); },
  async deleteMatching(clientId, subject, sid) { const redis = client(); let cursor = '0'; let deleted = 0; do { const [next, keys] = await redis.scan(cursor, 'MATCH', `${PREFIX}entry:*`, 'COUNT', 100); cursor = next; for (const key of keys) { const raw = await redis.get(key); if (!raw) continue; const session = await parse(redis, key, raw); if (session?.clientId === clientId && ((subject && session.subject === subject) || (sid && session.sid === sid))) deleted += await redis.del(key); } } while (cursor !== '0'); return deleted; },
  async withLock(key, operation) { const redis = client(); const lock = `${PREFIX}lock:${key}`; const owner = randomUUID(); const deadline = Date.now() + 5000; while (await redis.set(lock, owner, 'PX', 30000, 'NX') !== 'OK') { if (Date.now() >= deadline) throw new Error('SSO session lock timed out'); await new Promise((resolve) => setTimeout(resolve, 50)); } try { return await operation(); } finally { await redis.eval("if redis.call('GET',KEYS[1]) == ARGV[1] then return redis.call('DEL',KEYS[1]) else return 0 end", 1, lock, owner); } },
};
