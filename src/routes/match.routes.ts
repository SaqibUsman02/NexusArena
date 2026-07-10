import { Router } from 'express';
import { MatchController } from '../controllers/match.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// Submit game match results to queue (requires authentication token)
router.post('/submit', authMiddleware, MatchController.submit);

// Get match history records (public lookup from MySQL)
router.get('/history', MatchController.getHistory);

export default router;
