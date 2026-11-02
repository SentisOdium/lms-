import { Server } from 'socket.io';
import { config } from '../config/index.js';

let ioInstance = null;

export function initSocketIO(httpServer) {
  ioInstance = new Server(httpServer, {
    cors: {
      origin: config.corsOrigin === '*' ? '*' : config.corsOrigin.split(','),
      methods: ['GET', 'POST']
    }
  });

  ioInstance.on('connection', (socket) => {
    // Instructor joins session monitoring room
    socket.on('instructor:join', ({ sessionId }) => {
      if (sessionId) {
        socket.join(`session:instructor:${sessionId}`);
        socket.emit('joined:room', { room: `session:instructor:${sessionId}` });
      }
    });

    // Student joins session room
    socket.on('student:join', ({ sessionId, studentId }) => {
      if (sessionId) {
        socket.join(`session:student:${sessionId}`);
        socket.emit('joined:room', { room: `session:student:${sessionId}` });
      }
    });

    socket.on('disconnect', () => {
      // Client disconnected
    });
  });

  return ioInstance;
}

export function getIO() {
  if (!ioInstance) {
    throw new Error('Socket.IO is not initialized yet');
  }
  return ioInstance;
}

/**
 * Emit student status change to instructor room
 */
export function emitStudentStatus(sessionId, participant) {
  if (ioInstance) {
    ioInstance.to(`session:instructor:${sessionId}`).emit('student:status', participant);
  }
}

/**
 * Emit raw student event to instructor room
 */
export function emitStudentEvent(sessionId, event) {
  if (ioInstance) {
    ioInstance.to(`session:instructor:${sessionId}`).emit('student:event', event);
  }
}

/**
 * Notify student room that session has ended
 */
export function emitSessionEnded(sessionId) {
  if (ioInstance) {
    ioInstance.to(`session:student:${sessionId}`).emit('session:ended', { sessionId });
    ioInstance.to(`session:instructor:${sessionId}`).emit('session:updated', { sessionId, status: 'ended' });
  }
}

