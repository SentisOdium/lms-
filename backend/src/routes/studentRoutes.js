import { Router } from 'express';
import {
  joinSession,
  validateStudentSession,
  sendHeartbeat,
  submitEvents,
  leaveSession
} from '../controllers/studentController.js';

const router = Router();

router.post('/join', joinSession);
router.get('/session', validateStudentSession);
router.post('/heartbeat', sendHeartbeat);
router.post('/events', submitEvents);
router.post('/leave', leaveSession);

export default router;
