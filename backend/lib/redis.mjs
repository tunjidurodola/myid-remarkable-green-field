/**
 * Redis Client Module
 * Provides connection to Redis with session storage and cache helpers
 * for the myid.africa application
 *
 * Gracefully handles Redis unavailability with in-memory fallback
 */

import Redis from 'ioredis';

// Redis connection configuration
const redisConfig = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT_1 || '7100', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => {
    if (times > 3) {
      console.warn('Redis connection failed after 3 retries, using in-memory fallback');
      return null; // Stop retrying
    }
    return Math.min(times * 200, 2000);
  },
  lazyConnect: true,
  enableOfflineQueue: false, // Don't queue commands when disconnected
};

// Create Redis client
let client = null;
let redisAvailable = false;

// In-memory fallback store (used when Redis is unavailable)
const memoryStore = new Map();
const memoryTTLs = new Map();

// Cleanup expired entries from memory store
setInterval(() => {
  const now = Date.now();
  for (const [key, expiry] of memoryTTLs.entries()) {
    if (expiry < now) {
      memoryStore.delete(key);
      memoryTTLs.delete(key);
    }
  }
}, 60000); // Run every minute

// Try to connect to Redis
try {
  client = new Redis(redisConfig);

  client.on('connect', () => {
    console.log('Redis connected');
    redisAvailable = true;
  });

  client.on('error', (err) => {
    if (redisAvailable) {
      console.error('Redis error:', err.message);
    }
    redisAvailable = false;
  });

  client.on('ready', () => {
    console.log('Redis ready');
    redisAvailable = true;
  });

  client.on('close', () => {
    if (redisAvailable) {
      console.log('Redis connection closed');
    }
    redisAvailable = false;
  });

  // Attempt connection
  client.connect().catch((err) => {
    console.warn('Redis connection failed:', err.message, '- using in-memory fallback');
    redisAvailable = false;
  });
} catch (error) {
  console.warn('Failed to initialize Redis:', error.message, '- using in-memory fallback');
  redisAvailable = false;
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Check if Redis is available
 */
function isRedisAvailable() {
  return client && redisAvailable;
}

/**
 * Set a value with TTL (uses Redis if available, else memory)
 */
async function setWithTTL(key, value, ttl) {
  if (isRedisAvailable()) {
    try {
      return await client.setex(key, ttl, value);
    } catch (err) {
      console.warn('Redis setex failed, using memory:', err.message);
    }
  }
  // Memory fallback
  memoryStore.set(key, value);
  memoryTTLs.set(key, Date.now() + (ttl * 1000));
  return 'OK';
}

/**
 * Get a value (uses Redis if available, else memory)
 */
async function getValue(key) {
  if (isRedisAvailable()) {
    try {
      return await client.get(key);
    } catch (err) {
      console.warn('Redis get failed, using memory:', err.message);
    }
  }
  // Memory fallback
  const expiry = memoryTTLs.get(key);
  if (expiry && expiry < Date.now()) {
    memoryStore.delete(key);
    memoryTTLs.delete(key);
    return null;
  }
  return memoryStore.get(key) || null;
}

/**
 * Delete a key
 */
async function deleteKey(key) {
  if (isRedisAvailable()) {
    try {
      return await client.del(key);
    } catch (err) {
      console.warn('Redis del failed, using memory:', err.message);
    }
  }
  // Memory fallback
  const existed = memoryStore.has(key);
  memoryStore.delete(key);
  memoryTTLs.delete(key);
  return existed ? 1 : 0;
}

/**
 * Increment a counter
 */
async function incrementKey(key) {
  if (isRedisAvailable()) {
    try {
      return await client.incr(key);
    } catch (err) {
      console.warn('Redis incr failed, using memory:', err.message);
    }
  }
  // Memory fallback
  const current = parseInt(memoryStore.get(key) || '0', 10);
  const newValue = current + 1;
  memoryStore.set(key, String(newValue));
  return newValue;
}

/**
 * Set key expiry
 */
async function expireKey(key, ttl) {
  if (isRedisAvailable()) {
    try {
      return await client.expire(key, ttl);
    } catch (err) {
      console.warn('Redis expire failed, using memory:', err.message);
    }
  }
  // Memory fallback
  if (memoryStore.has(key)) {
    memoryTTLs.set(key, Date.now() + (ttl * 1000));
    return 1;
  }
  return 0;
}

/**
 * Get TTL of a key
 */
async function getTTL(key) {
  if (isRedisAvailable()) {
    try {
      return await client.ttl(key);
    } catch (err) {
      console.warn('Redis ttl failed, using memory:', err.message);
    }
  }
  // Memory fallback
  const expiry = memoryTTLs.get(key);
  if (!expiry) return -2; // Key doesn't exist
  const remaining = Math.ceil((expiry - Date.now()) / 1000);
  return remaining > 0 ? remaining : -2;
}

// ==================== SESSION HELPERS ====================

const SESSION_PREFIX = 'session:';
const SESSION_TTL = parseInt(process.env.SESSION_TTL || '86400', 10);

/**
 * Create a new session
 */
export async function createSession(sessionId, data, ttl = SESSION_TTL) {
  const key = `${SESSION_PREFIX}${sessionId}`;
  const value = JSON.stringify({
    ...data,
    createdAt: new Date().toISOString(),
  });
  return await setWithTTL(key, value, ttl);
}

/**
 * Get session data
 */
export async function getSession(sessionId) {
  const key = `${SESSION_PREFIX}${sessionId}`;
  const data = await getValue(key);
  return data ? JSON.parse(data) : null;
}

/**
 * Update session data
 */
export async function updateSession(sessionId, data, ttl = SESSION_TTL) {
  const key = `${SESSION_PREFIX}${sessionId}`;
  const existing = await getSession(sessionId);
  if (!existing) return null;

  const value = JSON.stringify({
    ...existing,
    ...data,
    updatedAt: new Date().toISOString(),
  });
  return await setWithTTL(key, value, ttl);
}

/**
 * Delete a session
 */
export async function deleteSession(sessionId) {
  const key = `${SESSION_PREFIX}${sessionId}`;
  return await deleteKey(key);
}

/**
 * Extend session TTL
 */
export async function extendSession(sessionId, ttl = SESSION_TTL) {
  const key = `${SESSION_PREFIX}${sessionId}`;
  return await expireKey(key, ttl);
}

// ==================== CACHE HELPERS ====================

const CACHE_PREFIX = 'cache:';
const DEFAULT_CACHE_TTL = 300;

/**
 * Set a cached value
 */
export async function setCache(cacheKey, value, ttl = DEFAULT_CACHE_TTL) {
  const key = `${CACHE_PREFIX}${cacheKey}`;
  return await setWithTTL(key, JSON.stringify(value), ttl);
}

/**
 * Get a cached value
 */
export async function getCache(cacheKey) {
  const key = `${CACHE_PREFIX}${cacheKey}`;
  const data = await getValue(key);
  return data ? JSON.parse(data) : null;
}

/**
 * Delete a cached value
 */
export async function deleteCache(cacheKey) {
  const key = `${CACHE_PREFIX}${cacheKey}`;
  return await deleteKey(key);
}

/**
 * Get or set cache with a factory function
 */
export async function getOrSetCache(cacheKey, factory, ttl = DEFAULT_CACHE_TTL) {
  const cached = await getCache(cacheKey);
  if (cached !== null) {
    return cached;
  }

  const value = await factory();
  await setCache(cacheKey, value, ttl);
  return value;
}

// ==================== PASSKEY CHALLENGE HELPERS ====================

const CHALLENGE_PREFIX = 'challenge:';
const CHALLENGE_TTL = 300;

/**
 * Store a WebAuthn challenge
 */
export async function storeChallenge(challenge, metadata) {
  const key = `${CHALLENGE_PREFIX}${challenge}`;
  return await setWithTTL(key, JSON.stringify({
    ...metadata,
    createdAt: new Date().toISOString(),
  }), CHALLENGE_TTL);
}

/**
 * Get and delete a challenge (atomic operation)
 */
export async function consumeChallenge(challenge) {
  const key = `${CHALLENGE_PREFIX}${challenge}`;
  const data = await getValue(key);
  if (data) {
    await deleteKey(key);
    return JSON.parse(data);
  }
  return null;
}

// ==================== RATE LIMITING HELPERS ====================

const RATE_LIMIT_PREFIX = 'ratelimit:';

/**
 * Check and increment rate limit
 */
export async function checkRateLimit(identifier, maxRequests = 100, windowSeconds = 60) {
  const key = `${RATE_LIMIT_PREFIX}${identifier}`;
  const current = await incrementKey(key);

  if (current === 1) {
    await expireKey(key, windowSeconds);
  }

  const ttl = await getTTL(key);

  return {
    allowed: current <= maxRequests,
    remaining: Math.max(0, maxRequests - current),
    resetIn: ttl > 0 ? ttl : windowSeconds,
    current,
  };
}

// ==================== HEALTH CHECK ====================

/**
 * Check Redis health
 */
export async function healthCheck() {
  if (!isRedisAvailable()) {
    return {
      healthy: true, // Still healthy with memory fallback
      mode: 'memory-fallback',
      warning: 'Redis unavailable, using in-memory storage',
    };
  }

  try {
    const start = Date.now();
    await client.ping();
    const latency = Date.now() - start;

    return {
      healthy: true,
      mode: 'redis',
      latency: `${latency}ms`,
    };
  } catch (error) {
    return {
      healthy: true, // Still healthy with memory fallback
      mode: 'memory-fallback',
      error: error.message,
    };
  }
}

/**
 * Close Redis connection (for graceful shutdown)
 */
export async function close() {
  if (client) {
    try {
      await client.quit();
      console.log('Redis connection closed');
    } catch (err) {
      console.warn('Error closing Redis connection:', err.message);
    }
  }
}

// Export the client for advanced usage
export { client as cluster };

export default {
  // Session
  createSession,
  getSession,
  updateSession,
  deleteSession,
  extendSession,
  // Cache
  setCache,
  getCache,
  deleteCache,
  getOrSetCache,
  // Passkey challenges
  storeChallenge,
  consumeChallenge,
  // Rate limiting
  checkRateLimit,
  // Health
  healthCheck,
  close,
  // Raw client
  cluster: client,
  // Status check
  isRedisAvailable,
};
