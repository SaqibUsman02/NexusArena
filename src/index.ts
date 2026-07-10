import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { connectDB } from './config/db';
import sequelize from './config/db';
import playerRoutes from './routes/player.routes';
import matchmakingRoutes from './routes/matchmaking.routes';
import leaderboardRoutes from './routes/leaderboard.routes';
import matchRoutes from './routes/match.routes';
import { startMatchProcessor } from './workers/matchProcessor';

dotenv.config();

const app = express();
app.use(express.json());

// Serve static files from Frontend directory
app.use(express.static(path.join(__dirname, '../Frontend')));

const PORT = process.env.PORT || 3000;

// Register routes
app.use('/api/players', playerRoutes);
app.use('/api/matchmaking', matchmakingRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/matches', matchRoutes);

// Base route info
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'Welcome to the Real-Time Gaming Tournament API! 🏆',
    activeModules: {
      players: [
        'POST /api/players/register -> Register a player (hashes stats to Redis, saves account to MySQL)',
        'GET  /api/players/:id      -> Fetch player profile (checks Redis cache first, falls back to MySQL)',
        'PUT  /api/players/:id      -> Alter player profile (updates MySQL and Redis in sync)',
        'POST /api/players/login    -> Log in player (caches session token in Redis Strings)',
        'GET  /api/players/me       -> Retrieve current profile (auth via Redis session)',
        'POST /api/players/logout   -> Log out player (invalidates session in Redis)',
      ],
      matchmaking: [
        'POST /api/matchmaking/join   -> Join queue (Redis Sets)',
        'POST /api/matchmaking/leave  -> Leave queue (Redis Sets)',
        'GET  /api/matchmaking/status -> View matchmaking pools status',
      ],
      leaderboard: [
        'POST /api/leaderboard/submit       -> Submit score (increments player score in Redis Sorted Set)',
        'GET  /api/leaderboard/top?limit=10  -> Get top players (WITHSCORES from Redis Sorted Set)',
        'GET  /api/leaderboard/rank/:id      -> Get rank and score of a player',
        'DELETE /api/leaderboard/reset      -> Clear leaderboard in Redis',
      ],
      matches: [
        'POST /api/matches/submit   -> Submit match result (LPUSH to Redis List queue)',
        'GET  /api/matches/history  -> View permanent match history (from MySQL)',
      ],
    },
  });
});

// Start server after connecting to MySQL and syncing models
const startServer = async () => {
  // 1. Connect to MySQL database
  await connectDB();

  // 2. Synchronize Sequelize database models with MySQL (automatically creates tables if they do not exist)
  try {
    await sequelize.sync({ force: false }); // force: false preserves existing data
    console.log('✅ MySQL tables synchronized successfully.');
  } catch (syncErr) {
    console.error('❌ Failed to synchronize MySQL database tables:', syncErr);
    process.exit(1);
  }

  // 3. Start the background Redis queue processor worker
  startMatchProcessor();

  // 4. Start listening
  app.listen(PORT, () => {
    console.log(`\n🚀 Gaming Tournament Server listening on http://localhost:${PORT}`);
    console.log(`👉 Hit http://localhost:${PORT} in Postman to test User Registration!\n`);
  });
};

startServer();
