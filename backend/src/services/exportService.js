import fs from 'fs';
import path from 'path';
import { calculateStudentMetrics } from './calculationService.js';
import { config } from '../config/index.js';
import { ensureDir } from '../storage/jsonStore.js';

/**
 * Sanitize cell content against CSV injection (formula injection).
 * Prepend single quote if cell starts with =, +, -, @, or tab/return.
 */
function sanitizeCell(value) {
  if (value === null || value === undefined) return '';
  let str = String(value);

  // Formula injection prevention
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // Escape quotes and wrap with double quotes if needed
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    str = `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generate Session Summary CSV string
 * Format: student_id,session_id,session_duration_seconds,active_seconds,away_seconds,idle_seconds,tab_switches,connection_status
 */
export function generateSummaryCsv(session, participants, allEvents) {
  const headers = [
    'student_id',
    'session_id',
    'session_duration_seconds',
    'active_seconds',
    'away_seconds',
    'idle_seconds',
    'tab_switches',
    'connection_status'
  ];

  const rows = [headers.join(',')];

  for (const p of participants) {
    const studentEvents = allEvents.filter(e => e.student_id === p.student_id);
    const metrics = calculateStudentMetrics(studentEvents, session);

    const row = [
      sanitizeCell(p.student_id),
      sanitizeCell(session.session_id),
      metrics.session_duration_seconds,
      metrics.active_seconds,
      metrics.away_seconds,
      metrics.idle_seconds,
      metrics.tab_switches,
      sanitizeCell(metrics.connection_status || p.status)
    ];

    rows.push(row.join(','));
  }

  // Prepend UTF-8 BOM (\uFEFF) for Excel compatibility
  return '\uFEFF' + rows.join('\r\n');
}

/**
 * Generate Detailed Activity CSV string
 * Format: event_id,student_id,session_id,event_type,target_domain,tab_title,timestamp
 */
export function generateDetailedActivityCsv(session, events, studentIdFilter = null) {
  const headers = [
    'event_id',
    'student_id',
    'session_id',
    'event_type',
    'target_domain',
    'tab_title',
    'timestamp'
  ];

  let filtered = events;
  if (studentIdFilter) {
    filtered = events.filter(e => e.student_id === studentIdFilter);
  }

  const rows = [headers.join(',')];

  for (const evt of filtered) {
    const row = [
      sanitizeCell(evt.event_id),
      sanitizeCell(evt.student_id),
      sanitizeCell(session.session_id),
      sanitizeCell(evt.event_type),
      sanitizeCell(evt.target_domain || ''),
      sanitizeCell(evt.tab_title || ''),
      sanitizeCell(evt.timestamp)
    ];
    rows.push(row.join(','));
  }

  return '\uFEFF' + rows.join('\r\n');
}

/**
 * Create a timestamped backup of the core JSON data files
 */
export async function createDataBackup() {
  const backupTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(config.dataDir, 'backups', `backup_${backupTimestamp}`);
  await ensureDir(backupDir);

  const filesToBackup = [
    config.instructorsFile,
    config.sessionsFile,
    config.participantsFile
  ];

  for (const file of filesToBackup) {
    try {
      if (fs.existsSync(file)) {
        await fs.promises.copyFile(file, path.join(backupDir, path.basename(file)));
      }
    } catch (err) {
      console.warn(`[Backup Warning] Could not copy ${file}:`, err);
    }
  }

  return backupDir;
}

