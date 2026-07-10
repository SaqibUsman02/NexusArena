import { Request, Response } from 'express';
import { PlayerService } from '../services/player.service';

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
    const playerId = parseInt(req.params.id, 10);
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
    const playerId = parseInt(req.params.id, 10);
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
}

