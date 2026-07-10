import { Router } from 'express';
import { LeaderboardController } from '../controllers/leaderboard.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// Submit/add score to logged-in player
router.post('/submit', authMiddleware, LeaderboardController.submitScore);

// Get top ranked players on the leaderboard
router.get('/top', LeaderboardController.getTop);

// Get specific player rank and score
router.get('/rank/:playerId', LeaderboardController.getRank);

// Clear/Reset the leaderboard
router.delete('/reset', LeaderboardController.reset);

export default router;
