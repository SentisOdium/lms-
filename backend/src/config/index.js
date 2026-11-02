import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'sbams_dev_jwt_secret_change_me',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  
  // Storage paths
  dataDir: path.resolve(rootDir, process.env.DATA_DIR || './data'),
  exportsDir: path.resolve(rootDir, process.env.EXPORTS_DIR || './exports'),
  activityDir: path.resolve(rootDir, (process.env.DATA_DIR || './data') + '/activity'),

  // Files
  instructorsFile: path.resolve(rootDir, (process.env.DATA_DIR || './data') + '/instructors.json'),
  sessionsFile: path.resolve(rootDir, (process.env.DATA_DIR || './data') + '/sessions.json'),
  participantsFile: path.resolve(rootDir, (process.env.DATA_DIR || './data') + '/participants.json'),

  // Timeouts & thresholds
  heartbeatIntervalSec: parseInt(process.env.HEARTBEAT_INTERVAL_SEC || '30', 10),
  disconnectThresholdSec: parseInt(process.env.DISCONNECT_THRESHOLD_SEC || '90', 10),
  idleThresholdSec: parseInt(process.env.IDLE_THRESHOLD_SEC || '300', 10),
};

