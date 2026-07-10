import { Request, Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { LeaderboardService } from '../services/leaderboard.service';

export class LeaderboardController {
  /**
   * POST /api/leaderboard/submit
   * Submit/add points to the logged-in player's score.
   */
  static async submitScore(req: AuthRequest, res: Response): Promise<any> {
    const { score } = req.body;

    if (score === undefined || typeof score !== 'number') {
      return res.status(400).json({ error: 'Score delta (number) is required in body.' });
    }

    try {
      const result = await LeaderboardService.addScore(req.playerId!, score);
      return res.json({
        message: 'Score submitted successfully!',
        leaderboardEntry: result,
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/leaderboard/top
   * Retrieve the top players.
   */
  static async getTop(req: Request, res: Response): Promise<any> {
    const limit = parseInt(req.query.limit as string, 10) || 10;

    try {
      const top = await LeaderboardService.getTopPlayers(limit);
      return res.json({ leaderboard: top });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/leaderboard/rank/:playerId
   * Get the rank of a specific player.
   */
  static async getRank(req: Request, res: Response): Promise<any> {
    const playerId = parseInt(req.params.playerId, 10);

    if (isNaN(playerId)) {
      return res.status(400).json({ error: 'Invalid Player ID.' });
    }

    try {
      const rankInfo = await LeaderboardService.getPlayerRank(playerId);
      return res.json(rankInfo);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * DELETE /api/leaderboard/reset
   * Clears the active leaderboard.
   */
  static async reset(req: Request, res: Response): Promise<any> {
    try {
      const result = await LeaderboardService.resetLeaderboard();
      return res.json(result);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }
}
