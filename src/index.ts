import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import { connectDB } from './config/db';
import sequelize from './config/db';
import playerRoutes from './routes/player.routes';

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Register routes
app.use('/api/players', playerRoutes);

// Base route info
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'Welcome to the Real-Time Gaming Tournament API! 🏆',
    activeModules: {
      players: [
        'POST /api/players/register -> Register a player (hashes stats to Redis, saves account to MySQL)',
        'GET  /api/players/:id      -> Fetch player profile (checks Redis cache first, falls back to MySQL)',
      ],
      upcomingModules: [
        'Leaderboard (Sorted Sets)',
        'Matchmaking (Sets)',
        'Match Processing (Lists)',
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

  // 3. Start listening
  app.listen(PORT, () => {
    console.log(`\n🚀 Gaming Tournament Server listening on http://localhost:${PORT}`);
    console.log(`👉 Hit http://localhost:${PORT} in Postman to test User Registration!\n`);
  });
};

startServer();
