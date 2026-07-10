import { redis } from '../redisClient';
import Redis from 'ioredis';
import MatchHistory from '../models/matchHistory.model';
import User from '../models/user.model';
import { PlayerService } from '../services/player.service';

const useMock = process.env.REDIS_MOCK !== 'false';

// If using the mock, share the connection to share the database memory.
// Otherwise, create a dedicated connection for blocking POP.
let workerRedis: any;

if (useMock) {
  workerRedis = redis;
} else {
  const host = process.env.REDIS_HOST || '127.0.0.1';
  const port = parseInt(process.env.DB_PORT || '6379', 10);
  const password = process.env.REDIS_PASSWORD || undefined;

  workerRedis = new Redis({
    host,
    port,
    password,
  });
}

let isRunning = false;

export const startMatchProcessor = async () => {
  if (isRunning) return;
  isRunning = true;
  console.log('👷 Background Match Processor Worker started. Waiting for matches...');

  // Running infinite loop to pop and process matches from the Redis list queue
  while (isRunning) {
    try {
      let payload: string | null = null;

      if (useMock) {
        // ioredis-mock does not support blocking BRPOP.
        // Fallback to standard RPOP (non-blocking) and poll every 1 second if empty.
        payload = await workerRedis.rpop('matches:queue');
        if (!payload) {
          // Sleep for 1 second before checking the queue again
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }
      } else {
        // Real Redis: BRPOP blocks/waits indefinitely until a match is pushed.
        // It returns [key, value] e.g. ['matches:queue', '{"playerOneId":1,...}']
        const result = await workerRedis.brpop('matches:queue', 0);
        if (result) {
          payload = result[1];
        }
      }

      if (payload) {
        const matchData = JSON.parse(payload);
        
        console.log(`👷 Worker: Received match to process. Player ${matchData.playerOneId} vs Player ${matchData.playerTwoId}`);

        // 1. Create Match Record in MySQL
        const newMatch = await MatchHistory.create({
          playerOneId: matchData.playerOneId,
          playerTwoId: matchData.playerTwoId,
          playerOneScore: matchData.playerOneScore,
          playerTwoScore: matchData.playerTwoScore,
          winnerId: matchData.winnerId,
          playedAt: new Date(matchData.playedAt),
        });

        console.log(`💾 Worker: Saved Match History to MySQL (ID: ${newMatch.id})`);

        // 2. Update winner and loser statistics in MySQL
        const winner = await User.findByPk(matchData.winnerId);
        const loserId = matchData.winnerId === matchData.playerOneId ? matchData.playerTwoId : matchData.playerOneId;
        const loser = await User.findByPk(loserId);

        if (winner) {
          winner.totalWins += 1;
          await winner.save();
          // Update/Sync the winner's Redis Hash profile cache
          await PlayerService.updatePlayer(winner.id, { totalWins: winner.totalWins });
          
          // 🏆 TIE-IN: Automatically award 10 points on the real-time leaderboard for a win!
          const { LeaderboardService } = require('../services/leaderboard.service');
          await LeaderboardService.addScore(winner.id, 10);
        }

        if (loser) {
          loser.totalLosses += 1;
          await loser.save();
          // Update/Sync the loser's Redis Hash profile cache
          await PlayerService.updatePlayer(loser.id, { totalLosses: loser.totalLosses });
        }

        console.log(`💾 Worker: Updated player wins/losses in MySQL and synced Redis caches.`);
      }
    } catch (err) {
      console.error('❌ Worker error processing queue:', err);
      // Wait a moment before retrying if there's an error (prevent CPU spinning)
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
};

export const stopMatchProcessor = () => {
  isRunning = false;
  console.log('👷 Background Match Processor Worker stopped.');
};
