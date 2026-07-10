import { Router } from 'express';
import { PlayerController } from '../controllers/player.controller';

const router = Router();

// Endpoint for registering players
router.post('/register', PlayerController.register);

// Endpoint for retrieving player profiles (cached in Redis Hash)
router.get('/:id', PlayerController.getProfile);

// Endpoint for updating player profiles (updates MySQL & keeps Redis Hash in sync)
router.put('/:id', PlayerController.update);

export default router;
