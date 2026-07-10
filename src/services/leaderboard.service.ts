import { redis } from '../redisClient';
import { PlayerService } from './player.service';

export class LeaderboardService {
  private static LEADERBOARD_KEY = 'tournament:leaderboard';

  /**
   * Submits/increments a player's score on the leaderboard.
   */
  static async addScore(playerId: number, scoreDelta: number) {
    // 1. Verify player exists (loads from cache/DB)
    const player = await PlayerService.getPlayerProfile(playerId);

    // 2. Increment score in Redis Sorted Set (ZSET)
    // ZINCRBY key increment member
    // If the member doesn't exist, it is added with scoreDelta as the initial score.
    const newScoreString = await redis.zincrby(
      this.LEADERBOARD_KEY,
      scoreDelta,
      playerId.toString()
    );

    const newScore = parseFloat(newScoreString);
    console.log(`📈 Score updated for ${player.username} (ID: ${playerId}): +${scoreDelta}. New Score: ${newScore}`);

    // 3. Fetch their updated rank
    // ZREVRANK returns the 0-indexed rank of a member sorted from highest to lowest score
    const rank = await redis.zrevrank(this.LEADERBOARD_KEY, playerId.toString());

    return {
      playerId,
      username: player.username,
      score: newScore,
      rank: rank !== null ? rank + 1 : null, // 1-indexed for humans
    };
  }

  /**
   * Retrieves the top N players on the leaderboard.
   */
  static async getTopPlayers(limit: number = 10) {
    // 1. Fetch top players from Redis Sorted Set (highest score first)
    // ZREVRANGE key start stop WITHSCORES
    // 0 is the first element, limit - 1 is the stop index.
    const rawLeaderboard = await redis.zrevrange(
      this.LEADERBOARD_KEY,
      0,
      limit - 1,
      'WITHSCORES'
    );

    // 2. Parse the flat array ['playerId1', 'score1', 'playerId2', 'score2', ...]
    const leaderboard = [];
    for (let i = 0; i < rawLeaderboard.length; i += 2) {
      const playerId = parseInt(rawLeaderboard[i], 10);
      const score = parseFloat(rawLeaderboard[i + 1]);
      const rank = i / 2 + 1;

      // Try to fetch player's cached username to return a clean payload
      let username = `Player ${playerId}`;
      try {
        const profile = await PlayerService.getPlayerProfile(playerId);
        username = profile.username;
      } catch (err) {
        console.error(`Could not resolve username for leaderboard player ${playerId}:`, err);
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

  /**
   * Retrieves the rank and score of a specific player.
   */
  static async getPlayerRank(playerId: number) {
    // 1. Get score using ZSCORE
    const scoreString = await redis.zscore(this.LEADERBOARD_KEY, playerId.toString());
    
    if (scoreString === null) {
      return {
        playerId,
        score: 0,
        rank: null,
        message: 'Player has not submitted any scores in this tournament yet.',
      };
    }

    // 2. Get rank using ZREVRANK
    const rank = await redis.zrevrank(this.LEADERBOARD_KEY, playerId.toString());

    return {
      playerId,
      score: parseFloat(scoreString),
      rank: rank !== null ? rank + 1 : null,
    };
  }

  /**
   * Clears the leaderboard (e.g. at the end of a tournament)
   */
  static async resetLeaderboard() {
    await redis.del(this.LEADERBOARD_KEY);
    console.log('🧹 Tournament leaderboard reset in Redis.');
    return { success: true, message: 'Leaderboard cleared successfully.' };
  }
}
