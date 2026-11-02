import http from 'http';
import fs from 'fs';
import path from 'path';
import { config } from '../src/config/index.js';
import { createDataBackup } from '../src/services/exportService.js';

async function singleRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data
        });
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function request(options, body = null, retries = 5) {
  for (let i = 0; i < retries; i++) {
    try {
      return await singleRequest(options, body);
    } catch (err) {
      if (i < retries - 1 && (err.code === 'ECONNRESET' || err.code === 'ECONNREFUSED')) {
        await new Promise(r => setTimeout(r, 800));
        continue;
      }
      throw err;
    }
  }
}

async function run() {
  console.log('🧪 Starting Phase 6 CSV Reporting & Data Management Tests...\n');
  const port = config.port;

  // 1. Instructor registration & session
  console.log('1️⃣ Creating session with activity data...');
  const instructorEmail = `prof_csv_${Date.now()}@example.com`;
  const regRes = await request({
    hostname: 'localhost', port, path: '/api/auth/register', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { name: 'Dr. Ada Lovelace', email: instructorEmail, password: 'password123' });
  const instructorToken = JSON.parse(regRes.data).token;

  const sessionRes = await request({
    hostname: 'localhost', port, path: '/api/sessions', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${instructorToken}` }
  }, { session_name: 'Compiler Architecture Final Exam' });
  const session = JSON.parse(sessionRes.data).session;
  console.log(`   ✅ Session created: ${session.session_id}`);

  // 2. Student with formula injection attempt in Student ID
  console.log('2️⃣ Enrolling student with potential formula injection payload...');
  const suspiciousStudentId = '=SUM(1,2)';
  const joinRes = await request({
    hostname: 'localhost', port, path: '/api/student/join', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    session_code: session.session_code,
    student_id: suspiciousStudentId,
    student_name: 'Security Tester'
  });
  const studentToken = JSON.parse(joinRes.data).token;
  console.log('   ✅ Student enrolled.');

  // 3. Submit activity events (Tab switch, Return)
  console.log('3️⃣ Generating simulated activity stream...');
  await request({
    hostname: 'localhost', port, path: '/api/student/events', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${studentToken}` }
  }, { event_type: 'TAB_SWITCHED' });

  await new Promise(r => setTimeout(r, 200));

  await request({
    hostname: 'localhost', port, path: '/api/student/events', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${studentToken}` }
  }, { event_type: 'TAB_RETURNED' });

  // 4. Test Summary CSV Export (GET /api/sessions/:id/export?type=summary)
  console.log('4️⃣ Testing Summary CSV export endpoint...');
  const summaryRes = await request({
    hostname: 'localhost', port, path: `/api/sessions/${session.session_id}/export?type=summary`, method: 'GET',
    headers: { 'Authorization': `Bearer ${instructorToken}` }
  });

  if (summaryRes.status !== 200) {
    throw new Error(`Summary CSV export failed: ${summaryRes.status} ${summaryRes.data}`);
  }

  const summaryCsv = summaryRes.data;
  console.log('   Preview of Summary CSV:\n   ---');
  console.log('  ', summaryCsv.replace(/\r?\n/g, '\n   '));
  console.log('   ---');

  if (!summaryCsv.includes('student_id,session_id,session_duration_seconds')) {
    throw new Error('Summary CSV missing expected header columns');
  }

  // Formula injection check: '=SUM(1,2)' must be sanitized to "'=SUM(1,2)"
  if (!summaryCsv.includes("'=SUM(1,2)")) {
    throw new Error('Formula injection was not sanitized! Cell must be escaped with single quote.');
  }
  console.log('   ✅ Formula injection sanitization verified.');

  // 5. Test Detailed Activity CSV Export (GET /api/sessions/:id/export?type=detailed)
  console.log('5️⃣ Testing Detailed Activity CSV export endpoint...');
  const detailRes = await request({
    hostname: 'localhost', port, path: `/api/sessions/${session.session_id}/export?type=detailed`, method: 'GET',
    headers: { 'Authorization': `Bearer ${instructorToken}` }
  });

  if (detailRes.status !== 200) {
    throw new Error(`Detailed CSV export failed: ${detailRes.status}`);
  }

  const detailCsv = detailRes.data;
  if (!detailCsv.includes('event_id,student_id,session_id,event_type,timestamp')) {
    throw new Error('Detailed CSV missing expected header columns');
  }
  if (!detailCsv.includes('TAB_SWITCHED') || !detailCsv.includes('TAB_RETURNED')) {
    throw new Error('Detailed CSV missing recorded events');
  }
  console.log('   ✅ Detailed activity CSV verified with all event rows.');

  // 6. Test Data Backup Utility
  console.log('6️⃣ Testing Automatic Data Backup Utility...');
  const backupPath = await createDataBackup();
  if (!fs.existsSync(backupPath)) {
    throw new Error(`Backup directory not created: ${backupPath}`);
  }
  const backedUpFiles = fs.readdirSync(backupPath);
  console.log(`   ✅ Backup created at: ${path.basename(backupPath)} containing [${backedUpFiles.join(', ')}]`);

  console.log('\n🎉 ALL PHASE 6 CSV REPORTING & DATA BACKUP TESTS PASSED!\n');
}

run().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
