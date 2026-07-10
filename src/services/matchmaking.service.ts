import { redis } from '../redisClient';
import { PlayerService } from './player.service';

export class MatchmakingService {
  /**
   * Helper to get matchmaking tier based on player level
   */
  private static getTier(level: number): number {
    if (level <= 5) return 1;
    if (level <= 10) return 2;
    return 3;
  }

  /**
   * Adds a player to the matchmaking Set and attempts to match them.
   */
  static async joinPool(playerId: number) {
    // 1. Fetch player details to get their level (uses Redis Hash cache-aside)
    const player = await PlayerService.getPlayerProfile(playerId);
    const tier = this.getTier(player.level);
    const redisKey = `matchmaking:tier:${tier}`;

    // 2. Check if player is already searching in this tier
    const isSearching = await redis.sismember(redisKey, playerId.toString());
    if (isSearching === 1) {
      return {
        matched: false,
        message: 'You are already searching for a match.',
        tier,
      };
    }

    // 3. Add player to the Set
    // SADD adds a unique element to a Redis Set. If player is already there, it won't duplicate.
    await redis.sadd(redisKey, playerId.toString());
    console.log(`🎮 Player ${player.username} (ID: ${playerId}, Level: ${player.level}) joined matchmaking Tier ${tier}`);

    // 4. Retrieve all players currently searching in this tier Set
    // SMEMBERS returns all elements stored in the Set
    const members = await redis.smembers(redisKey);

    // 5. Look for opponents (players other than themselves)
    const opponents = members.filter((id) => parseInt(id, 10) !== playerId);

    if (opponents.length > 0) {
      // Opponent found! Let's match with the first one
      const opponentId = parseInt(opponents[0], 10);

      // Get opponent username for friendlier response
      let opponentUsername = `Player ${opponentId}`;
      try {
        const opponentProfile = await PlayerService.getPlayerProfile(opponentId);
        opponentUsername = opponentProfile.username;
      } catch (err) {
        console.error('Failed to get opponent profile info:', err);
      }

      // 6. Match found! Remove both players from the matchmaking Set
      // SREM removes one or more elements from the Set
      await redis.srem(redisKey, playerId.toString(), opponentId.toString());

      // 🎟️ TIE-IN: Create an authorized match session ticket in Redis with a 30-minute TTL
      // We sort the IDs so the key is the same no matter who submits (e.g., match:1:2)
      const firstId = Math.min(playerId, opponentId);
      const secondId = Math.max(playerId, opponentId);
      const matchSessionKey = `match:${firstId}:${secondId}`;
      
      try {
        await redis.set(matchSessionKey, 'active', 'EX', 1800);
        console.log(`🎟️ Match session ticket created in Redis: ${matchSessionKey}`);
      } catch (redisErr) {
        console.error('⚠️ Failed to save match session ticket in Redis:', redisErr);
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
    }

    // No opponent found yet. Player remains in the Set waiting.
    return {
      matched: false,
      message: 'Searching for an opponent in your skill tier...',
      tier,
    };
  }

  /**
   * Removes a player from their matchmaking pool.
   */
  static async leavePool(playerId: number) {
    const player = await PlayerService.getPlayerProfile(playerId);
    const tier = this.getTier(player.level);
    const redisKey = `matchmaking:tier:${tier}`;

    // SREM returns number of items removed (1 if removed, 0 if not found)
    const removedCount = await redis.srem(redisKey, playerId.toString());

    if (removedCount > 0) {
      console.log(`🚪 Player ${player.username} (ID: ${playerId}) left the matchmaking pool.`);
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

  /**
   * Debug helper: Returns the list of waiting player IDs in all matchmaking tiers.
   */
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
