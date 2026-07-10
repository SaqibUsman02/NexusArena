import { Router } from 'express';
import { MatchmakingController } from '../controllers/matchmaking.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// Require session token to join matchmaking
router.post('/join', authMiddleware, MatchmakingController.join);

// Require session token to leave matchmaking
router.post('/leave', authMiddleware, MatchmakingController.leave);

// Get current state of matchmaking pools (who is waiting)
router.get('/status', MatchmakingController.getStatus);

export default router;
