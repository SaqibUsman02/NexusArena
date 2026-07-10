import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { MatchmakingService } from '../services/matchmaking.service';

export class MatchmakingController {
  /**
   * POST /api/matchmaking/join
   */
  static async join(req: AuthRequest, res: Response): Promise<any> {
    try {
      const result = await MatchmakingService.joinPool(req.playerId!);
      return res.json(result);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/matchmaking/leave
   */
  static async leave(req: AuthRequest, res: Response): Promise<any> {
    try {
      const result = await MatchmakingService.leavePool(req.playerId!);
      return res.json(result);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/matchmaking/status
   * Public/Debug endpoint to see the matchmaking pools
   */
  static async getStatus(req: AuthRequest, res: Response): Promise<any> {
    try {
      const status = await MatchmakingService.getPoolsStatus();
      return res.json(status);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }
}
