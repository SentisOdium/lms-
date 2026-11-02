import http from 'http';
import { config } from '../src/config/index.js';

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
  console.log('🧪 Testing Student Join Flow...\n');
  const port = config.port;

  // 1. Instructor registers & creates session
  const instructorEmail = `prof_test_${Date.now()}@example.com`;
  const regRes = await request({
    hostname: 'localhost', port, path: '/api/auth/register', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { name: 'Dr. Turing', email: instructorEmail, password: 'password123' });
  const token = regRes.data.token;

  const sessionRes = await request({
    hostname: 'localhost', port, path: '/api/sessions', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
  }, { session_name: 'CS101 Supervised Exam' });
  const sessionCode = sessionRes.data.session.session_code;
  console.log(`✅ Session created with code: ${sessionCode}`);

  // 2. Student joins with invalid code
  const invalidRes = await request({
    hostname: 'localhost', port, path: '/api/student/join', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { session_code: 'INVALID-CODE', student_id: 'STU-999' });
  if (invalidRes.status !== 404) throw new Error('Expected 404 for invalid code');
  console.log('✅ Invalid session code rejected with 404');

  // 3. Student joins with valid code
  const joinRes = await request({
    hostname: 'localhost', port, path: '/api/student/join', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { session_code: sessionCode, student_id: 'STU-001', student_name: 'Alice Johnson' });

  if (joinRes.status !== 200 || !joinRes.data.token) {
    throw new Error(`Student join failed: ${JSON.stringify(joinRes.data)}`);
  }
  console.log(`✅ Student successfully joined: ${joinRes.data.participant.student_name} (${joinRes.data.participant.student_id})`);

  console.log('\n🎉 ALL SESSION CREATION & STUDENT ENROLLMENT CHECKS PASSED!\n');
}

run().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});

