import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { readJson, updateJson, appendJsonl } from '../storage/jsonStore.js';
import { emitStudentStatus, emitStudentEvent } from '../sockets/socketHandler.js';
import path from 'path';

/**
 * Helper to get student authentication from request
 */
function getStudentAuth(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  try {
    return jwt.verify(authHeader.split(' ')[1], config.jwtSecret);
  } catch (_) {
    return null;
  }
}

/**
 * Student joins an active monitoring session using session code
 */
export async function joinSession(req, res, next) {
  try {
    const { session_code, student_id, student_name } = req.body;

    if (!session_code || !student_id) {
      return res.status(400).json({
        success: false,
        message: 'Session code and Student ID are required.'
      });
    }

    const cleanCode = session_code.trim().toUpperCase();
    const cleanStudentId = student_id.trim();
    const cleanStudentName = (student_name || student_id).trim();

    // 1. Validate session
    const sessions = await readJson(config.sessionsFile, []);
    const session = sessions.find(s => s.session_code === cleanCode);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Invalid session code. Please verify and try again.'
      });
    }

    if (session.status === 'ended') {
      return res.status(400).json({
        success: false,
        message: 'This monitoring session has already ended.'
      });
    }

    if (session.status === 'scheduled') {
      return res.status(400).json({
        success: false,
        message: 'This session is scheduled but has not been started by the instructor yet.'
      });
    }

    const now = new Date().toISOString();

    // 2. Register/update participant in participants.json
    let participantRecord = null;
    await updateJson(config.participantsFile, (participants) => {
      let existing = participants.find(
        p => p.session_id === session.session_id && p.student_id === cleanStudentId
      );

      if (existing) {
        existing.status = 'active';
        existing.student_name = cleanStudentName;
        existing.last_heartbeat = now;
        participantRecord = existing;
      } else {
        participantRecord = {
          participant_id: `PART-${Date.now().toString().slice(-6)}`,
          session_id: session.session_id,
          student_id: cleanStudentId,
          student_name: cleanStudentName,
          status: 'active',
          tab_switches: 0,
          joined_at: now,
          last_heartbeat: now
        };
        participants.push(participantRecord);
      }
      return participants;
    });

    // 3. Log SESSION_STARTED event in session JSONL
    const activityFile = path.join(config.activityDir, `session_${session.session_id}.jsonl`);
    const joinEvent = {
      event_id: `EVT-${Date.now()}`,
      session_id: session.session_id,
      student_id: cleanStudentId,
      event_type: 'SESSION_STARTED',
      timestamp: now
    };
    await appendJsonl(activityFile, joinEvent);

    // 4. Issue student token
    const token = jwt.sign(
      {
        session_id: session.session_id,
        student_id: cleanStudentId,
        student_name: cleanStudentName,
        role: 'student'
      },
      config.jwtSecret,
      { expiresIn: '12h' }
    );

    // 5. Notify instructor via Socket.IO
    emitStudentStatus(session.session_id, participantRecord);
    emitStudentEvent(session.session_id, joinEvent);

    res.json({
      success: true,
      message: 'Joined monitoring session successfully.',
      token,
      session: {
        session_id: session.session_id,
        session_name: session.session_name,
        session_code: session.session_code,
        status: session.status
      },
      participant: participantRecord
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Validate active student session state (used on extension reload/startup)
 */
export async function validateStudentSession(req, res, next) {
  try {
    const auth = getStudentAuth(req);
    if (!auth) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const sessions = await readJson(config.sessionsFile, []);
    const session = sessions.find(s => s.session_id === auth.session_id);

    if (!session || session.status === 'ended') {
      return res.json({
        success: true,
        active: false,
        session_ended: true,
        message: 'This session has ended.'
      });
    }

    res.json({
      success: true,
      active: session.status === 'active',
      session: {
        session_id: session.session_id,
        session_name: session.session_name,
        session_code: session.session_code,
        status: session.status
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Student periodic heartbeat ping
 */
export async function sendHeartbeat(req, res, next) {
  try {
    const auth = getStudentAuth(req);
    if (!auth) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { status: reportedStatus } = req.body;
    const now = new Date().toISOString();

    let updatedParticipant = null;
    await updateJson(config.participantsFile, (participants) => {
      const idx = participants.findIndex(
        p => p.session_id === auth.session_id && p.student_id === auth.student_id
      );

      if (idx !== -1) {
        participants[idx].last_heartbeat = now;
        
        // Sync status from client heartbeat (self-healing for rapid tab switches or disconnections)
        if (reportedStatus) {
          if (reportedStatus === 'active' && participants[idx].status !== 'active') {
            participants[idx].status = 'active';
            participants[idx].current_domain = null;
            participants[idx].current_tab_title = null;
          } else if (participants[idx].status === 'disconnected') {
            participants[idx].status = reportedStatus;
          }
        }
        updatedParticipant = participants[idx];
      }
      return participants;
    });

    if (updatedParticipant) {
      emitStudentStatus(auth.session_id, updatedParticipant);
    }

    res.json({
      success: true,
      timestamp: now,
      status: updatedParticipant?.status || 'active'
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Submit activity events (Tab switches, focus changes, idle states)
 */
export async function submitEvents(req, res, next) {
  try {
    const auth = getStudentAuth(req);
    if (!auth) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { events } = req.body;
    const eventList = Array.isArray(events) ? events : [req.body];

    if (!eventList || eventList.length === 0) {
      return res.status(400).json({ success: false, message: 'No events provided' });
    }

    const activityFile = path.join(config.activityDir, `session_${auth.session_id}.jsonl`);
    const now = new Date().toISOString();

    let tabSwitchIncrement = 0;
    let nextStatus = null;
    let latestTabTitle = null;
    let latestTargetDomain = null;

    for (const item of eventList) {
      const eventType = item.event_type;
      const timestamp = item.timestamp || now;
      const tabTitle = item.tab_title || null;
      const targetDomain = item.target_domain || null;

      // Calculate state changes & metrics
      if (eventType === 'TAB_SWITCHED') {
        tabSwitchIncrement += 1;
        nextStatus = 'away';
        latestTabTitle = tabTitle;
        latestTargetDomain = targetDomain;
      } else if (eventType === 'WINDOW_UNFOCUSED') {
        nextStatus = 'away';
      } else if (eventType === 'IDLE_STARTED') {
        nextStatus = 'idle';
      } else if (eventType === 'TAB_RETURNED' || eventType === 'WINDOW_FOCUSED' || eventType === 'IDLE_ENDED') {
        nextStatus = 'active';
        latestTabTitle = null;
        latestTargetDomain = null;
      }

      const eventRecord = {
        event_id: `EVT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        session_id: auth.session_id,
        student_id: auth.student_id,
        event_type: eventType,
        tab_title: tabTitle,
        target_domain: targetDomain,
        timestamp
      };

      await appendJsonl(activityFile, eventRecord);
      emitStudentEvent(auth.session_id, eventRecord);
    }

    // Update participant status in participants.json
    let updatedParticipant = null;
    await updateJson(config.participantsFile, (participants) => {
      const idx = participants.findIndex(
        p => p.session_id === auth.session_id && p.student_id === auth.student_id
      );

      if (idx !== -1) {
        if (tabSwitchIncrement > 0) {
          participants[idx].tab_switches = (participants[idx].tab_switches || 0) + tabSwitchIncrement;
        }
        if (nextStatus) {
          participants[idx].status = nextStatus;
          if (nextStatus === 'away') {
            if (latestTabTitle) participants[idx].current_tab_title = latestTabTitle;
            if (latestTargetDomain) participants[idx].current_domain = latestTargetDomain;
          } else if (nextStatus === 'active') {
            participants[idx].current_tab_title = null;
            participants[idx].current_domain = null;
          }
        }
        participants[idx].last_heartbeat = now;
        updatedParticipant = participants[idx];
      }
      return participants;
    });

    if (updatedParticipant) {
      emitStudentStatus(auth.session_id, updatedParticipant);
    }

    res.json({
      success: true,
      processed: eventList.length,
      participant: updatedParticipant
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Student leaves monitoring session gracefully
 */
export async function leaveSession(req, res, next) {
  try {
    const auth = getStudentAuth(req);
    const sessionId = auth?.session_id || req.body.session_id;
    const studentId = auth?.student_id || req.body.student_id;

    if (!sessionId || !studentId) {
      return res.status(400).json({ success: false, message: 'Session ID and Student ID are required.' });
    }

    const now = new Date().toISOString();

    // 1. Update participant status to 'left'
    let updatedParticipant = null;
    await updateJson(config.participantsFile, (participants) => {
      const idx = participants.findIndex(p => p.session_id === sessionId && p.student_id === studentId);
      if (idx !== -1) {
        participants[idx].status = 'left';
        participants[idx].left_at = now;
        updatedParticipant = participants[idx];
      }
      return participants;
    });

    // 2. Log SESSION_LEFT event
    const activityFile = path.join(config.activityDir, `session_${sessionId}.jsonl`);
    const leaveEvent = {
      event_id: `EVT-${Date.now()}`,
      session_id: sessionId,
      student_id: studentId,
      event_type: 'SESSION_LEFT',
      timestamp: now
    };
    await appendJsonl(activityFile, leaveEvent);

    // 3. Emit updates to instructor room
    if (updatedParticipant) {
      emitStudentStatus(sessionId, updatedParticipant);
    }
    emitStudentEvent(sessionId, leaveEvent);

    res.json({
      success: true,
      message: 'Successfully left session.'
    });
  } catch (err) {
    next(err);
  }
}
