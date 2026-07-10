import { redis } from '../redisClient';
import { PlayerService } from './player.service';

export class MatchmakingService {
  private static getTier(level: number): number {
    if (level <= 5) return 1;
    if (level <= 10) return 2;
    return 3;
  }

  static async joinPool(playerId: number) {
    const player = await PlayerService.getPlayerProfile(playerId);
    const tier = this.getTier(player.level);
    const redisKey = `matchmaking:tier:${tier}`;

    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      attempts++;

      // WATCH key to implement optimistic locking
      await redis.watch(redisKey);

      const isSearching = await redis.sismember(redisKey, playerId.toString());
      if (isSearching === 1) {
        await redis.unwatch();
        return {
          matched: false,
          message: 'You are already searching for a match.',
          tier,
        };
      }

      const members = await redis.smembers(redisKey);
      const opponents = members.filter((id) => parseInt(id, 10) !== playerId);

      if (opponents.length > 0) {
        const opponentId = parseInt(opponents[0], 10);
        let opponentUsername = `Player ${opponentId}`;
        try {
          const opponentProfile = await PlayerService.getPlayerProfile(opponentId);
          opponentUsername = opponentProfile.username;
        } catch (err) {
          console.error('Failed to get opponent profile info:', err);
        }

        // Atomically match and remove both players
        const multi = redis.multi();
        multi.srem(redisKey, playerId.toString(), opponentId.toString());
        const execResult = await multi.exec();

        if (execResult === null) {
          console.log(`⚠️ Matchmaking collision detected for Player ${playerId}. Retrying... (Attempt ${attempts}/${maxAttempts})`);
          continue;
        }

        // Create match verification ticket
        const firstId = Math.min(playerId, opponentId);
        const secondId = Math.max(playerId, opponentId);
        const matchSessionKey = `match:${firstId}:${secondId}`;
        
        try {
          await redis.set(matchSessionKey, 'active', 'EX', 1800);
          console.log(`🎟️ Match session ticket created: ${matchSessionKey}`);
        } catch (redisErr) {
          console.error('⚠️ Failed to save match session ticket:', redisErr);
        }

        console.log(`⚔️ Match Found! Player ${playerId} vs Player ${opponentId} in Tier ${tier}`);

        return {
          matched: true,
          message: 'Match found successfully!',
          opponent: {
            id: opponentId,
            username: opponentUsername,
          },
          tier,
        };
      } else {
        // No opponent found, add to pool
        const multi = redis.multi();
        multi.sadd(redisKey, playerId.toString());
        const execResult = await multi.exec();

        if (execResult === null) {
          console.log(`⚠️ Matchmaking pool add collision for Player ${playerId}. Retrying... (Attempt ${attempts}/${maxAttempts})`);
          continue;
        }

        return {
          matched: false,
          message: 'Searching for an opponent in your skill tier...',
          tier,
        };
      }
    }

    return {
      matched: false,
      message: 'Server busy processing matchmaking queue. Please try again.',
      tier,
    };
  }

  static async leavePool(playerId: number) {
    const player = await PlayerService.getPlayerProfile(playerId);
    const tier = this.getTier(player.level);
    const redisKey = `matchmaking:tier:${tier}`;

    const removedCount = await redis.srem(redisKey, playerId.toString());

    if (removedCount > 0) {
      console.log(`🚪 Player ${player.username} (ID: ${playerId}) left matchmaking pool.`);
      return {
        success: true,
        message: 'Successfully left the matchmaking pool.',
      };
    }

    return {
      success: false,
      message: 'You were not in the matchmaking pool.',
    };
  }

  static async getPoolsStatus() {
    const pool1 = await redis.smembers('matchmaking:tier:1');
    const pool2 = await redis.smembers('matchmaking:tier:2');
    const pool3 = await redis.smembers('matchmaking:tier:3');

    return {
      tier1: pool1.map((id) => parseInt(id, 10)),
      tier2: pool2.map((id) => parseInt(id, 10)),
      tier3: pool3.map((id) => parseInt(id, 10)),
    };
  }
}
