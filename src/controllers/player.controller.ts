import { Request, Response } from 'express';
import { PlayerService } from '../services/player.service';
import { AuthRequest } from '../middlewares/auth.middleware';

export class PlayerController {
  /**
   * POST /api/players/register
   */
  static async register(req: Request, res: Response): Promise<any> {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required.' });
    }

    try {
      const newPlayer = await PlayerService.register(username, email, password);
      return res.status(201).json({
        message: 'Player registered successfully!',
        player: newPlayer,
      });
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  }

  /**
   * GET /api/players/:id
   */
  static async getProfile(req: Request, res: Response): Promise<any> {
    const playerId = parseInt(req.params.id as string, 10);
    console.log("PlayerId,",playerId);
    

    if (isNaN(playerId)) {
      return res.status(400).json({ error: 'Invalid Player ID.' });
    }

    try {
      const profile = await PlayerService.getPlayerProfile(playerId);
      console.log("Profile", profile);
      
      return res.json(profile);
    } catch (error: any) {
      return res.status(404).json({ error: error.message });
    }
  }

  /**
   * PUT /api/players/:id
   */
  static async update(req: Request, res: Response): Promise<any> {
    const playerId = parseInt(req.params.id as string, 10);
    const { username, level, totalWins, totalLosses } = req.body;

    if (isNaN(playerId)) {
      return res.status(400).json({ error: 'Invalid Player ID.' });
    }

    try {
      const updatedPlayer = await PlayerService.updatePlayer(playerId, {
        username,
        level,
        totalWins,
        totalLosses,
      });
      return res.json({
        message: 'Player updated successfully!',
        player: updatedPlayer,
      });
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  }

  /**
   * POST /api/players/login
   */
  static async login(req: Request, res: Response): Promise<any> {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    try {
      const result = await PlayerService.login(email, password);
      return res.json({
        message: 'Login successful!',
        ...result,
      });
    } catch (error: any) {
      return res.status(401).json({ error: error.message });
    }
  }

  /**
   * POST /api/players/logout
   */
  static async logout(req: Request, res: Response): Promise<any> {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No active session token provided.' });
    }

    const token = authHeader.split(' ')[1];

    try {
      const success = await PlayerService.logout(token);
      if (!success) {
        return res.status(400).json({ error: 'Session was already expired or invalid.' });
      }
      return res.json({ message: 'Logged out successfully!' });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/players/me
   */
  static async getMe(req: AuthRequest, res: Response): Promise<any> {
    try {
      // req.playerId is populated by the authMiddleware from the Redis session token lookup
      const profile = await PlayerService.getPlayerProfile(req.playerId!);
      return res.json(profile);
    } catch (error: any) {
      return res.status(404).json({ error: error.message });
    }
  }
}


