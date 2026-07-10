import { redis } from '../redisClient';
import MatchHistory from '../models/matchHistory.model';

export class MatchService {
  private static QUEUE_KEY = 'matches:queue';

  static async queueMatchResult(
    playerOneId: number,
    playerTwoId: number,
    playerOneScore: number,
    playerTwoScore: number,
    winnerId: number
  ) {
    if (winnerId !== playerOneId && winnerId !== playerTwoId) {
      throw new Error('Winner ID must match one of the participating players.');
    }

    const firstId = Math.min(playerOneId, playerTwoId);
    const secondId = Math.max(playerOneId, playerTwoId);
    const matchSessionKey = `match:${firstId}:${secondId}`;

    const isMatchAuthorized = await redis.exists(matchSessionKey);
    if (isMatchAuthorized === 0) {
      throw new Error(
        'Match submission unauthorized. This game session was not initialized by the matchmaking pool or has expired.'
      );
    }

    await redis.del(matchSessionKey);
    console.log(`🎟️ Match session ticket ${matchSessionKey} successfully validated and consumed.`);

    const matchPayload = {
      playerOneId,
      playerTwoId,
      playerOneScore,
      playerTwoScore,
      winnerId,
      playedAt: new Date().toISOString(),
    };

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

  static async getQueueLength() {
    return await redis.llen(this.QUEUE_KEY);
  }

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
