import http from 'http';
import { config } from '../src/config/index.js';
import { readJson, readJsonl } from '../src/storage/jsonStore.js';
import path from 'path';

async function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let json;
        try {
          json = JSON.parse(data);
        } catch (_) {
          json = data;
        }
        resolve({ status: res.statusCode, data: json });
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function run() {
  console.log('🧪 Starting Phase 3 Student Extension & Enrollment Tests...\n');
  const port = config.port;

  // 1. Instructor registration & session creation
  console.log('1️⃣ Creating test monitoring session...');
  const instructorEmail = `prof_p3_${Date.now()}@example.com`;
  const regRes = await request({
    hostname: 'localhost', port, path: '/api/auth/register', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { name: 'Prof. Grace Hopper', email: instructorEmail, password: 'password123' });
  const instructorToken = regRes.data.token;

  const sessionRes = await request({
    hostname: 'localhost', port, path: '/api/sessions', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${instructorToken}` }
  }, { session_name: 'Operating Systems Lab' });
  const session = sessionRes.data.session;
  console.log(`   ✅ Session created: "${session.session_name}" (Code: ${session.session_code})`);

  // 2. Student joins with invalid code
  console.log('2️⃣ Testing join with invalid code...');
  const invalidRes = await request({
    hostname: 'localhost', port, path: '/api/student/join', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { session_code: 'BAD-CODE-999', student_id: 'STU-999' });
  if (invalidRes.status !== 404) throw new Error(`Expected 404, got ${invalidRes.status}`);
  console.log('   ✅ Invalid session code properly rejected with 404.');

  // 3. Student joins valid active session
  console.log('3️⃣ Testing student enrollment into active session...');
  const joinRes = await request({
    hostname: 'localhost', port, path: '/api/student/join', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    session_code: session.session_code,
    student_id: 'STU-101',
    student_name: 'Grace Hopper Student'
  });
  if (joinRes.status !== 200 || !joinRes.data.token) {
    throw new Error(`Enrollment failed: ${JSON.stringify(joinRes.data)}`);
  }
  const studentToken = joinRes.data.token;
  console.log(`   ✅ Student enrolled successfully. Token received.`);

  // 4. Validate session via GET /api/student/session
  console.log('4️⃣ Testing session status validation (GET /api/student/session)...');
  const validRes = await request({
    hostname: 'localhost', port, path: '/api/student/session', method: 'GET',
    headers: { 'Authorization': `Bearer ${studentToken}` }
  });
  if (validRes.status !== 200 || !validRes.data.active) {
    throw new Error(`Validation failed: ${JSON.stringify(validRes.data)}`);
  }
  console.log(`   ✅ Session validated as active.`);

  // 5. Verify SESSION_STARTED event in JSONL
  console.log('5️⃣ Verifying activity event persistence in session JSONL...');
  const activityFile = path.join(config.activityDir, `session_${session.session_id}.jsonl`);
  const events = await readJsonl(activityFile);
  const startEvent = events.find(e => e.student_id === 'STU-101' && e.event_type === 'SESSION_STARTED');
  if (!startEvent) throw new Error('SESSION_STARTED event missing from activity stream');
  console.log(`   ✅ SESSION_STARTED event verified in ${path.basename(activityFile)}`);

  // 6. Student leaves session
  console.log('6️⃣ Testing student leave session (POST /api/student/leave)...');
  const leaveRes = await request({
    hostname: 'localhost', port, path: '/api/student/leave', method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${studentToken}`
    },
  }, { session_id: session.session_id, student_id: 'STU-101' });
  if (leaveRes.status !== 200) {
    throw new Error(`Leave failed: ${JSON.stringify(leaveRes.data)}`);
  }
  console.log(`   ✅ Student successfully left session.`);

  // 7. Verify SESSION_LEFT event in JSONL
  const updatedEvents = await readJsonl(activityFile);
  const leaveEvent = updatedEvents.find(e => e.student_id === 'STU-101' && e.event_type === 'SESSION_LEFT');
  if (!leaveEvent) throw new Error('SESSION_LEFT event missing from activity stream');
  console.log(`   ✅ SESSION_LEFT event verified in activity stream.`);

  // 8. End session from instructor and verify student validation detects ended state
  console.log('7️⃣ Testing ended session detection...');
  await request({
    hostname: 'localhost', port, path: `/api/sessions/${session.session_id}/end`, method: 'POST',
    headers: { 'Authorization': `Bearer ${instructorToken}` }
  });

  const endedCheckRes = await request({
    hostname: 'localhost', port, path: '/api/student/session', method: 'GET',
    headers: { 'Authorization': `Bearer ${studentToken}` }
  });
  if (endedCheckRes.data.active !== false || !endedCheckRes.data.session_ended) {
    throw new Error('Expected session_ended: true');
  }
  console.log(`   ✅ Ended session detected by student validation endpoint.`);

  console.log('\n🎉 ALL PHASE 3 CHROME EXTENSION & ENROLLMENT TESTS PASSED!\n');
}

run().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});

