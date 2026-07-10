import { Router } from 'express';
import { PlayerController } from '../controllers/player.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// Endpoint for registering players
router.post('/register', PlayerController.register);

// Endpoint for retrieving the currently logged-in player's profile (requires Redis session token)
router.get('/me', authMiddleware, PlayerController.getMe);

// Endpoint for retrieving player profiles (cached in Redis Hash)
router.get('/:id', PlayerController.getProfile);

// Endpoint for updating player profiles (updates MySQL & keeps Redis Hash in sync)
router.put('/:id', PlayerController.update);

// Session endpoints
router.post('/login', PlayerController.login);
router.post('/logout', PlayerController.logout);

export default router;
