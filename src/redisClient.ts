import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

// Default to using the in-memory mock so there is zero setup required.
// Set REDIS_MOCK=false in your .env file to connect to a real Redis server.
const useMock = process.env.REDIS_MOCK !== 'false';

let redis: Redis;

if (useMock) {
  console.log('🔌 Connecting to: In-memory mock Redis (no server needed)');
  // We dynamically import/require ioredis-mock to keep it separated.
  const RedisMock = require('ioredis-mock');
  redis = new RedisMock();
} else {
  const host = process.env.REDIS_HOST || '127.0.0.1';
  const port = parseInt(process.env.REDIS_PORT || '6379', 10);
  const password = process.env.REDIS_PASSWORD || undefined;

  console.log(`🔌 Connecting to real Redis server at ${host}:${port}...`);
  redis = new Redis({
    host,
    port,
    password,
    maxRetriesPerRequest: 3,
  });

  redis.on('connect', () => {
    console.log('✅ Connected to Redis server successfully!');
  });

  redis.on('error', (err) => {
    console.error('❌ Redis Connection Error:', err);
  });
}

export { redis };
