import http from 'http';
import path from 'path';
import express from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import { ensureDir, readJson, updateJson, appendJsonl } from './storage/jsonStore.js';
import { initSocketIO, emitStudentStatus, emitStudentEvent } from './sockets/socketHandler.js';
import { errorHandler, notFoundHandler } from './middleware/errorMiddleware.js';
import authRoutes from './routes/authRoutes.js';
import sessionRoutes from './routes/sessionRoutes.js';
import studentRoutes from './routes/studentRoutes.js';

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
initSocketIO(server);

// Middleware
app.use(cors({
  origin: config.corsOrigin === '*' ? '*' : config.corsOrigin.split(','),
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure required directories exist at boot
await ensureDir(config.dataDir);
await ensureDir(config.activityDir);
await ensureDir(config.exportsDir);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'SBAMS Backend API',
    storage: {
      type: 'JSON & JSONL',
      dataDir: config.dataDir,
      exportsDir: config.exportsDir
    }
  });
});

// Mounted API routes
app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/student', studentRoutes);

// Error handlers
app.use(notFoundHandler);
app.use(errorHandler);

// Background Watchdog: check for disconnected students (missing heartbeat > 90s)
const WATCHDOG_INTERVAL_MS = 15000;
setInterval(async () => {
  try {
    const sessions = await readJson(config.sessionsFile, []);
    const activeSessionIds = new Set(
      sessions.filter(s => s.status === 'active').map(s => s.session_id)
    );

    if (activeSessionIds.size === 0) return;

    const thresholdMs = config.disconnectThresholdSec * 1000;
    const now = Date.now();
    const disconnectedList = [];

    await updateJson(config.participantsFile, async (participants) => {
      for (const p of participants) {
        if (!activeSessionIds.has(p.session_id)) continue;
        if (p.status === 'disconnected' || p.status === 'left') continue;

        const lastBeatTime = p.last_heartbeat ? new Date(p.last_heartbeat).getTime() : 0;
        if (now - lastBeatTime > thresholdMs) {
          p.status = 'disconnected';
          disconnectedList.push(p);

          // Append disconnect event
          const activityFile = path.join(config.activityDir, `session_${p.session_id}.jsonl`);
          const discEvent = {
            event_id: `EVT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            session_id: p.session_id,
            student_id: p.student_id,
            event_type: 'DISCONNECTED',
            timestamp: new Date().toISOString()
          };
          await appendJsonl(activityFile, discEvent);
          emitStudentEvent(p.session_id, discEvent);
        }
      }
      return participants;
    });

    for (const p of disconnectedList) {
      emitStudentStatus(p.session_id, p);
    }
  } catch (err) {
    console.error('[Watchdog Error]', err);
  }
}, WATCHDOG_INTERVAL_MS);

// Start server
server.listen(config.port, () => {
  console.log(`===============================================`);
  console.log(`🚀 SBAMS Backend Server running on port ${config.port}`);
  console.log(`   Health: http://localhost:${config.port}/api/health`);
  console.log(`   Storage: Zero-SQL JSON/JSONL at ${config.dataDir}`);
  console.log(`   Environment: ${config.nodeEnv}`);
  console.log(`===============================================`);
});

export { app, server };
