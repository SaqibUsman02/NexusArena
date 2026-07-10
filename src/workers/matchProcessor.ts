import { redis } from '../redisClient';
import Redis from 'ioredis';
import MatchHistory from '../models/matchHistory.model';
import User from '../models/user.model';
import { PlayerService } from '../services/player.service';

const useMock = process.env.REDIS_MOCK !== 'false';
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

const processMatch = async (payload: string) => {
  const matchData = JSON.parse(payload);
  console.log(`👷 Worker: Processing match between ${matchData.playerOneId} and ${matchData.playerTwoId}`);

  const newMatch = await MatchHistory.create({
    playerOneId: matchData.playerOneId,
    playerTwoId: matchData.playerTwoId,
    playerOneScore: matchData.playerOneScore,
    playerTwoScore: matchData.playerTwoScore,
    winnerId: matchData.winnerId,
    playedAt: new Date(matchData.playedAt),
  });

  console.log(`💾 Worker: Saved Match ID ${newMatch.id} to DB`);

  const winner = await User.findByPk(matchData.winnerId);
  const loserId = matchData.winnerId === matchData.playerOneId ? matchData.playerTwoId : matchData.playerOneId;
  const loser = await User.findByPk(loserId);

  if (winner) {
    winner.totalWins += 1;
    await winner.save();
    await PlayerService.updatePlayer(winner.id, { totalWins: winner.totalWins });
    
    const { LeaderboardService } = require('../services/leaderboard.service');
    await LeaderboardService.addScore(winner.id, 10);
  }

  if (loser) {
    loser.totalLosses += 1;
    await loser.save();
    await PlayerService.updatePlayer(loser.id, { totalLosses: loser.totalLosses });
  }

  console.log(`💾 Worker: Updated player wins/losses in MySQL and synced Redis caches.`);
};

export const startMatchProcessor = async () => {
  if (isRunning) return;
  isRunning = true;
  console.log('👷 Background Match Processor Worker started.');

  // Recovery run: check for unprocessed matches in matches:processing queue
  try {
    const orphanedMatches = await workerRedis.lrange('matches:processing', 0, -1);
    if (orphanedMatches.length > 0) {
      console.log(`👷 Worker Recovery: Processing ${orphanedMatches.length} orphaned matches...`);
      for (const payload of orphanedMatches) {
        try {
          await processMatch(payload);
          await workerRedis.lrem('matches:processing', 1, payload);
        } catch (recoverErr) {
          console.error('❌ Worker Recovery Error:', recoverErr);
        }
      }
    }
  } catch (recoveryErr) {
    console.error('❌ Worker Recovery: Failed to check for orphaned matches:', recoveryErr);
  }

  console.log('👷 Worker: Active queue listening started. Waiting for matches...');

  // Main processing loop
  while (isRunning) {
    try {
      let payload: string | null = null;

      if (useMock) {
        payload = await workerRedis.rpoplpush('matches:queue', 'matches:processing');
        if (!payload) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }
      } else {
        payload = await workerRedis.brpoplpush('matches:queue', 'matches:processing', 0);
      }

      if (payload) {
        await processMatch(payload);
        await workerRedis.lrem('matches:processing', 1, payload);
      }
    } catch (err) {
      console.error('❌ Worker: Error processing queue match:', err);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
};

export const stopMatchProcessor = () => {
  isRunning = false;
  console.log('👷 Background Match Processor Worker stopped.');
};
