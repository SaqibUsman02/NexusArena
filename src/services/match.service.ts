import { redis } from '../redisClient';
import MatchHistory from '../models/matchHistory.model';

export class MatchService {
  private static QUEUE_KEY = 'matches:queue';

  /**
   * Pushes a match result to the Redis List queue for asynchronous database insertion.
   */
  static async queueMatchResult(
    playerOneId: number,
    playerTwoId: number,
    playerOneScore: number,
    playerTwoScore: number,
    winnerId: number
  ) {
    // 1. Basic validation
    if (winnerId !== playerOneId && winnerId !== playerTwoId) {
      throw new Error('Winner ID must match one of the participating players.');
    }

    // 2. Match ticket validation
    // We sort the IDs to retrieve the correct ticket key (e.g., match:1:2)
    const firstId = Math.min(playerOneId, playerTwoId);
    const secondId = Math.max(playerOneId, playerTwoId);
    const matchSessionKey = `match:${firstId}:${secondId}`;

    const isMatchAuthorized = await redis.exists(matchSessionKey);
    if (isMatchAuthorized === 0) {
      throw new Error(
        'Match submission unauthorized. This game session was not initialized by the matchmaking pool or has expired.'
      );
    }

    // Consume (delete) the ticket so it cannot be submitted again (anti-cheat measure)
    await redis.del(matchSessionKey);
    console.log(`🎟️ Match session ticket ${matchSessionKey} successfully validated and consumed.`);

    // 3. Prepare payload
    const matchPayload = {
      playerOneId,
      playerTwoId,
      playerOneScore,
      playerTwoScore,
      winnerId,
      playedAt: new Date().toISOString(),
    };

    // 3. Push to Redis List (acting as a queue)
    // LPUSH inserts the value at the head/left of the list
    const newQueueLength = await redis.lpush(
      this.QUEUE_KEY,
      JSON.stringify(matchPayload)
    );

    console.log(`📥 Match result queued in Redis. Current queue length: ${newQueueLength}`);

    return {
      success: true,
      message: 'Match result successfully submitted to queue.',
      queueLength: newQueueLength,
    };
  }

  /**
   * Gets the current size of the queue in Redis.
   */
  static async getQueueLength() {
    // LLEN returns the length of a Redis List
    return await redis.llen(this.QUEUE_KEY);
  }

  /**
   * Fetches match history logs from the database
   */
  static async getMatchHistory() {
    return await MatchHistory.findAll({
      include: [
        { association: 'PlayerOne', attributes: ['id', 'username', 'level'] },
        { association: 'PlayerTwo', attributes: ['id', 'username', 'level'] },
        { association: 'Winner', attributes: ['id', 'username'] },
      ],
      order: [['playedAt', 'DESC']],
    });
  }
}
