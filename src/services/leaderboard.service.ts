import { redis } from '../redisClient';
import { PlayerService } from './player.service';

export class LeaderboardService {
  private static LEADERBOARD_KEY = 'tournament:leaderboard';

  static async addScore(playerId: number, scoreDelta: number) {
    const player = await PlayerService.getPlayerProfile(playerId);

    const newScoreString = await redis.zincrby(
      this.LEADERBOARD_KEY,
      scoreDelta,
      playerId.toString()
    );

    const newScore = parseFloat(newScoreString);
    console.log(`📈 Score updated for ${player.username} (ID: ${playerId}): +${scoreDelta}. New Score: ${newScore}`);

    const rank = await redis.zrevrank(this.LEADERBOARD_KEY, playerId.toString());

    return {
      playerId,
      username: player.username,
      score: newScore,
      rank: rank !== null ? rank + 1 : null,
    };
  }

  static async getTopPlayers(limit: number = 10) {
    const rawLeaderboard = await redis.zrevrange(
      this.LEADERBOARD_KEY,
      0,
      limit - 1,
      'WITHSCORES'
    );

    const leaderboard = [];
    for (let i = 0; i < rawLeaderboard.length; i += 2) {
      const playerId = parseInt(rawLeaderboard[i], 10);
      const score = parseFloat(rawLeaderboard[i + 1]);
      const rank = i / 2 + 1;

      let username = `Player ${playerId}`;
      try {
        const profile = await PlayerService.getPlayerProfile(playerId);
        username = profile.username;
      } catch (err) {
        console.error(`Could not resolve username for player ${playerId}:`, err);
      }

      leaderboard.push({
        rank,
        playerId,
        username,
        score,
      });
    }

    return leaderboard;
  }

  static async getPlayerRank(playerId: number) {
    const scoreString = await redis.zscore(this.LEADERBOARD_KEY, playerId.toString());
    
    if (scoreString === null) {
      return {
        playerId,
        score: 0,
        rank: null,
        message: 'Player has not submitted any scores in this tournament yet.',
      };
    }

    const rank = await redis.zrevrank(this.LEADERBOARD_KEY, playerId.toString());

    return {
      playerId,
      score: parseFloat(scoreString),
      rank: rank !== null ? rank + 1 : null,
    };
  }

  static async resetLeaderboard() {
    await redis.del(this.LEADERBOARD_KEY);
    console.log('🧹 Tournament leaderboard reset in Redis.');
    return { success: true, message: 'Leaderboard cleared successfully.' };
  }
}
