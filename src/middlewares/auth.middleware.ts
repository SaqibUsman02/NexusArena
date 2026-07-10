import { Request, Response, NextFunction } from 'express';
import { redis } from '../redisClient';

export interface AuthRequest extends Request {
  playerId?: number;
}

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<any> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access denied. No active session token provided.' });
  }

  const token = authHeader.split(' ')[1];
  const sessionKey = `session:${token}`;

  try {
    // Check if the session exists in Redis and get the Player ID associated with it
    const playerId = await redis.get(sessionKey);

    if (!playerId) {
      return res.status(401).json({ error: 'Access denied. Session is invalid or has expired.' });
    }

    // Store the authenticated Player ID in the request context for downstream routes
    req.playerId = parseInt(playerId, 10);
    
    console.log(`🔑 Redis Session authenticated for Player ID ${req.playerId}`);
    next();
  } catch (redisErr) {
    console.error('⚠️ Redis auth check failed:', redisErr);
    return res.status(500).json({ error: 'Authentication service temporarily unavailable.' });
  }
};
