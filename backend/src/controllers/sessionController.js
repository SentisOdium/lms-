import crypto from 'crypto';
import path from 'path';
import { config } from '../config/index.js';
import { readJson, updateJson, readJsonl } from '../storage/jsonStore.js';
import { emitSessionEnded, getIO } from '../sockets/socketHandler.js';
import { generateSummaryCsv, generateDetailedActivityCsv } from '../services/exportService.js';

/**
 * Generate a clean, human-readable session code like "PW-82K9Q"
 */
function generateSessionCode() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // exclude ambiguous I, O
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  
  let prefix = '';
  for (let i = 0; i < 2; i++) {
    prefix += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  
  let suffix = '';
  for (let i = 0; i < 5; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return `${prefix}-${suffix}`;
}

/**
 * Create a new monitoring session
 */
export async function createSession(req, res, next) {
  try {
    const { session_name, status = 'active' } = req.body;

    if (!session_name || !session_name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Session name is required.'
      });
    }

    const sessions = await readJson(config.sessionsFile, []);

    // Generate unique session code
    let code;
    let attempts = 0;
    do {
      code = generateSessionCode();
      attempts++;
    } while (sessions.some(s => s.session_code === code && s.status !== 'ended') && attempts < 10);

    const sessionId = `SESSION-${Date.now().toString().slice(-6)}`;
    const now = new Date().toISOString();

    const newSession = {
      session_id: sessionId,
      session_name: session_name.trim(),
      session_code: code,
      instructor_id: req.instructor.instructor_id,
      status: status === 'scheduled' ? 'scheduled' : 'active',
      created_at: now,
      started_at: status === 'scheduled' ? null : now,
      ended_at: null
    };

    await updateJson(config.sessionsFile, (list) => {
      list.push(newSession);
      return list;
    });

    res.status(201).json({
      success: true,
      message: 'Monitoring session created successfully.',
      session: newSession
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get all sessions owned by the authenticated instructor
 */
export async function getSessions(req, res, next) {
  try {
    const instructorId = req.instructor.instructor_id;
    const allSessions = await readJson(config.sessionsFile, []);
    const allParticipants = await readJson(config.participantsFile, []);

    const mySessions = allSessions
      .filter(s => s.instructor_id === instructorId)
      .map(s => {
        const sessionParticipants = allParticipants.filter(p => p.session_id === s.session_id);
        const activeCount = sessionParticipants.filter(p => p.status === 'active').length;
        return {
          ...s,
          participant_count: sessionParticipants.length,
          active_count: activeCount
        };
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json({
      success: true,
      sessions: mySessions
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get details for a single session
 */
export async function getSessionById(req, res, next) {
  try {
    const { id } = req.params;
    const instructorId = req.instructor.instructor_id;
    const allSessions = await readJson(config.sessionsFile, []);
    const session = allSessions.find(s => s.session_id === id);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found.'
      });
    }

    if (session.instructor_id !== instructorId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access to this session.'
      });
    }

    const allParticipants = await readJson(config.participantsFile, []);
    const participants = allParticipants.filter(p => p.session_id === id);

    res.json({
      success: true,
      session: {
        ...session,
        participants
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Start a scheduled session
 */
export async function startSession(req, res, next) {
  try {
    const { id } = req.params;
    const instructorId = req.instructor.instructor_id;

    let updatedSession = null;
    await updateJson(config.sessionsFile, (sessions) => {
      const idx = sessions.findIndex(s => s.session_id === id);
      if (idx === -1) return sessions;
      if (sessions[idx].instructor_id !== instructorId) return sessions;

      sessions[idx].status = 'active';
      if (!sessions[idx].started_at) {
        sessions[idx].started_at = new Date().toISOString();
      }
      updatedSession = sessions[idx];
      return sessions;
    });

    if (!updatedSession) {
      return res.status(404).json({
        success: false,
        message: 'Session not found or unauthorized.'
      });
    }

    res.json({
      success: true,
      message: 'Session started.',
      session: updatedSession
    });
  } catch (err) {
    next(err);
  }
}

/**
 * End an active session
 */
export async function endSession(req, res, next) {
  try {
    const { id } = req.params;
    const instructorId = req.instructor.instructor_id;

    let endedSession = null;
    await updateJson(config.sessionsFile, (sessions) => {
      const idx = sessions.findIndex(s => s.session_id === id);
      if (idx === -1) return sessions;
      if (sessions[idx].instructor_id !== instructorId) return sessions;

      sessions[idx].status = 'ended';
      sessions[idx].ended_at = new Date().toISOString();
      endedSession = sessions[idx];
      return sessions;
    });

    if (!endedSession) {
      return res.status(404).json({
        success: false,
        message: 'Session not found or unauthorized.'
      });
    }

    // Broadcast session termination to student extensions & instructor dashboard
    emitSessionEnded(id);

    res.json({
      success: true,
      message: 'Session ended successfully.',
      session: endedSession
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get all participants for a session
 */
export async function getSessionParticipants(req, res, next) {
  try {
    const { id } = req.params;
    const allParticipants = await readJson(config.participantsFile, []);
    const participants = allParticipants.filter(p => p.session_id === id);

    res.json({
      success: true,
      count: participants.length,
      participants
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get activity events stream for a session, optionally filtered by student_id
 */
export async function getSessionActivity(req, res, next) {
  try {
    const { id } = req.params;
    const { student_id } = req.query;

    const activityFile = path.join(config.activityDir, `session_${id}.jsonl`);
    let events = await readJsonl(activityFile);

    if (student_id) {
      events = events.filter(e => e.student_id === student_id);
    }

    res.json({
      success: true,
      count: events.length,
      events
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Export session activity data as CSV (summary or detailed)
 */
export async function exportSessionCsv(req, res, next) {
  try {
    const { id } = req.params;
    const { type = 'summary', student_id } = req.query;
    const instructorId = req.instructor.instructor_id;

    const allSessions = await readJson(config.sessionsFile, []);
    const session = allSessions.find(s => s.session_id === id);

    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    if (session.instructor_id !== instructorId) {
      return res.status(403).json({ success: false, message: 'Unauthorized access to session' });
    }

    const activityFile = path.join(config.activityDir, `session_${id}.jsonl`);
    const events = await readJsonl(activityFile);

    let csvContent = '';
    let filename = '';

    if (type === 'detailed') {
      filename = student_id
        ? `session_activity_${id}_${student_id}.csv`
        : `session_activity_${id}.csv`;
      csvContent = generateDetailedActivityCsv(session, events, student_id);
    } else {
      filename = `session_summary_${id}.csv`;
      const allParticipants = await readJson(config.participantsFile, []);
      let participants = allParticipants.filter(p => p.session_id === id);
      if (student_id) {
        participants = participants.filter(p => p.student_id === student_id);
      }
      csvContent = generateSummaryCsv(session, participants, events);
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (err) {
    next(err);
  }
}



