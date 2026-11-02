import { Router } from 'express';
import {
  createSession,
  getSessions,
  getSessionById,
  startSession,
  endSession,
  getSessionParticipants,
  getSessionActivity,
  exportSessionCsv
} from '../controllers/sessionController.js';
import { requireInstructorAuth } from '../middleware/authMiddleware.js';

const router = Router();

// All session routes require instructor authentication
router.use(requireInstructorAuth);

router.post('/', createSession);
router.get('/', getSessions);
router.get('/:id', getSessionById);
router.post('/:id/start', startSession);
router.post('/:id/end', endSession);
router.get('/:id/participants', getSessionParticipants);
router.get('/:id/activity', getSessionActivity);
router.get('/:id/export', exportSessionCsv);

export default router;
