import { Request, Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { MatchService } from '../services/match.service';

export class MatchController {
  /**
   * POST /api/matches/submit
   * Submits a match result to the Redis Queue.
   */
  static async submit(req: AuthRequest, res: Response): Promise<any> {
    const { playerOneId, playerTwoId, playerOneScore, playerTwoScore, winnerId } = req.body;

    if (
      playerOneId === undefined ||
      playerTwoId === undefined ||
      playerOneScore === undefined ||
      playerTwoScore === undefined ||
      winnerId === undefined
    ) {
      return res.status(400).json({
        error: 'playerOneId, playerTwoId, playerOneScore, playerTwoScore, and winnerId are required.',
      });
    }

    try {
      const result = await MatchService.queueMatchResult(
        playerOneId,
        playerTwoId,
        playerOneScore,
        playerTwoScore,
        winnerId
      );
      return res.json(result);
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  }

  /**
   * GET /api/matches/history
   * Retrieves permanent match history logs from MySQL.
   */
  static async getHistory(req: Request, res: Response): Promise<any> {
    try {
      const history = await MatchService.getMatchHistory();
      return res.json({ history });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }
}

