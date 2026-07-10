import bcrypt from 'bcryptjs';
import User from '../models/user.model';
import { redis } from '../redisClient';

export class PlayerService {
  /**
   * Registers a new player in MySQL and caches their stats in Redis.
   */
  static async register(username: string, email: string, passwordSecret: string) {
    // 1. Check if user already exists in MySQL
    const existingUser = await User.findOne({
      where: { email },
    });

    if (existingUser) {
      throw new Error('User with this email already exists.');
    }

    const existingUsername = await User.findOne({
      where: { username },
    });

    if (existingUsername) {
      throw new Error('Username is already taken.');
    }

    // 2. Hash the password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(passwordSecret, salt);

    // 3. Create user in MySQL
    const newUser = await User.create({
      username,
      email,
      passwordHash,
    });

    // 4. Cache user profile statistics in a Redis Hash
    // This allows fast real-time access to player data during matches
    const redisKey = `player:${newUser.id}`;
    
    try {
      await redis.hset(redisKey, {
        username: newUser.username,
        level: newUser.level.toString(),
        totalWins: newUser.totalWins.toString(),
        totalLosses: newUser.totalLosses.toString(),
      });
      
      // Set TTL to 1 hour to prevent orphaned cache data
      await redis.expire(redisKey, 3600);
      
      console.log(`💾 Cached player stats in Redis Hash: ${redisKey}`);
    } catch (redisErr) {
      // We don't fail the registration if Redis is down (high availability principle)
      console.error('⚠️ Redis caching failed during registration:', redisErr);
    }

    // Return user without password hash
    return {
      id: newUser.id,
      username: newUser.username,
      email: newUser.email,
      level: newUser.level,
      totalWins: newUser.totalWins,
      totalLosses: newUser.totalLosses,
      createdAt: newUser.createdAt,
    };
  }

  /**
   * Retrieves player stats, checking Redis cache first.
   */
  static async getPlayerProfile(id: number) {
    const redisKey = `player:${id}`;

    try {
      // Attempt to retrieve from Redis Hash
      const cachedPlayer = await redis.hgetall(redisKey);

      if (Object.keys(cachedPlayer).length > 0) {
        console.log(`⚡ Redis Cache HIT for player ${id}!`);
        return {
          id,
          username: cachedPlayer.username,
          level: parseInt(cachedPlayer.level, 10),
          totalWins: parseInt(cachedPlayer.totalWins, 10),
          totalLosses: parseInt(cachedPlayer.totalLosses, 10),
          source: 'Redis Cache (Instant)',
        };
      }
    } catch (redisErr) {
      console.error('⚠️ Redis fetch failed:', redisErr);
    }

    // Cache Miss: Query MySQL
    console.log(`🐢 Redis Cache MISS! Querying MySQL for player ${id}...`);
    const dbUser = await User.findByPk(id);

    if (!dbUser) {
      throw new Error('Player not found.');
    }

    // Write-back to Redis cache
    try {
      const redisKey = `player:${dbUser.id}`;
      await redis.hset(redisKey, {
        username: dbUser.username,
        level: dbUser.level.toString(),
        totalWins: dbUser.totalWins.toString(),
        totalLosses: dbUser.totalLosses.toString(),
      });
      await redis.expire(redisKey, 3600);
      console.log(`💾 Repopulated Redis cache for player ${dbUser.id}`);
    } catch (redisErr) {
      console.error('⚠️ Redis write failed:', redisErr);
    }

    return {
      id: dbUser.id,
      username: dbUser.username,
      level: dbUser.level,
      totalWins: dbUser.totalWins,
      totalLosses: dbUser.totalLosses,
      source: 'MySQL Database',
    };
  }

  /**
   * Updates player info in MySQL and keeps the Redis cache in sync.
   */
  static async updatePlayer(
    id: number,
    data: { username?: string; level?: number; totalWins?: number; totalLosses?: number }
  ) {
    // 1. Find player in MySQL
    const dbUser = await User.findByPk(id);
    if (!dbUser) {
      throw new Error('Player not found.');
    }

    // 2. Update MySQL
    if (data.username !== undefined) dbUser.username = data.username;
    if (data.level !== undefined) dbUser.level = data.level;
    if (data.totalWins !== undefined) dbUser.totalWins = data.totalWins;
    if (data.totalLosses !== undefined) dbUser.totalLosses = data.totalLosses;
    await dbUser.save();

    // 3. Update Redis cache if it exists
    const redisKey = `player:${id}`;
    try {
      const cacheExists = await redis.exists(redisKey);
      
      if (cacheExists === 1) {
        console.log(`💾 Redis Cache found. Direct-updating fields in Redis Hash for player ${id}...`);
        
        const hashUpdates: Record<string, string> = {};
        if (data.username !== undefined) hashUpdates.username = data.username;
        if (data.level !== undefined) hashUpdates.level = data.level.toString();
        if (data.totalWins !== undefined) hashUpdates.totalWins = data.totalWins.toString();
        if (data.totalLosses !== undefined) hashUpdates.totalLosses = data.totalLosses.toString();

        if (Object.keys(hashUpdates).length > 0) {
          // HSET can take an object and update only the specified keys
          await redis.hset(redisKey, hashUpdates);
          // Refresh the expiration time
          await redis.expire(redisKey, 3600);
        }
      } else {
        console.log(`⚠️ Redis cache not active for player ${id}. MySQL updated, cache will populate on next GET request.`);
      }
    } catch (redisErr) {
      console.error('⚠️ Redis update failed:', redisErr);
    }

    return {
      id: dbUser.id,
      username: dbUser.username,
      level: dbUser.level,
      totalWins: dbUser.totalWins,
      totalLosses: dbUser.totalLosses,
    };
  }
}

