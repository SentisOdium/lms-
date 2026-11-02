import http from 'http';
import { config } from '../src/config/index.js';

async function singleRequest(options, body = null) {
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

async function request(options, body = null, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await singleRequest(options, body);
    } catch (err) {
      if (i < retries - 1 && (err.code === 'ECONNRESET' || err.code === 'ECONNREFUSED')) {
        await new Promise(r => setTimeout(r, 600));
        continue;
      }
      throw err;
    }
  }
}

async function runTests() {
  console.log('🧪 Starting Phase 2 Auth & Session Management Tests against running server...\n');

  try {
    const port = config.port;

    // 1. Register instructor
    console.log('1️⃣ Testing Instructor Registration...');
    const testEmail = `prof_${Date.now()}@example.com`;
    const regRes = await request({
      hostname: 'localhost',
      port,
      path: '/api/auth/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      name: 'Professor John Doe',
      email: testEmail,
      password: 'SecurePassword123!'
    });

    if (regRes.status !== 201 || !regRes.data.token) {
      throw new Error(`Registration failed (${regRes.status}): ${JSON.stringify(regRes.data)}`);
    }
    const token = regRes.data.token;
    console.log('   ✅ Instructor registered. JWT token received.');

    // 2. Duplicate registration rejection
    console.log('2️⃣ Testing Duplicate Registration Rejection...');
    const dupRes = await request({
      hostname: 'localhost',
      port,
      path: '/api/auth/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      name: 'Professor Duplicate',
      email: testEmail,
      password: 'AnotherPassword'
    });
    if (dupRes.status !== 409) {
      throw new Error(`Expected 409 Conflict, got ${dupRes.status}`);
    }
    console.log('   ✅ Duplicate email rejected with 409 Conflict.');

    // 3. Login
    console.log('3️⃣ Testing Instructor Login...');
    const loginRes = await request({
      hostname: 'localhost',
      port,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      email: testEmail,
      password: 'SecurePassword123!'
    });
    if (loginRes.status !== 200 || !loginRes.data.token) {
      throw new Error(`Login failed: ${JSON.stringify(loginRes.data)}`);
    }
    console.log('   ✅ Login successful. JWT token verified.');

    // 4. Authenticated profile check (GET /api/auth/me)
    console.log('4️⃣ Testing Authenticated Profile (GET /api/auth/me)...');
    const meRes = await request({
      hostname: 'localhost',
      port,
      path: '/api/auth/me',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (meRes.status !== 200 || meRes.data.instructor.email !== testEmail) {
      throw new Error(`Profile check failed: ${JSON.stringify(meRes.data)}`);
    }
    console.log('   ✅ Profile verified via JWT.');

    // 5. Create monitoring session
    console.log('5️⃣ Testing Session Creation (POST /api/sessions)...');
    const createRes = await request({
      hostname: 'localhost',
      port,
      path: '/api/sessions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }, {
      session_name: 'Introduction to Algorithms'
    });
    if (createRes.status !== 201 || !createRes.data.session.session_code) {
      throw new Error(`Session creation failed: ${JSON.stringify(createRes.data)}`);
    }
    const createdSession = createRes.data.session;
    console.log(`   ✅ Session created: "${createdSession.session_name}" (Code: ${createdSession.session_code})`);

    // 6. List sessions
    console.log('6️⃣ Testing List Sessions (GET /api/sessions)...');
    const listRes = await request({
      hostname: 'localhost',
      port,
      path: '/api/sessions',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (listRes.status !== 200 || !listRes.data.sessions.some(s => s.session_id === createdSession.session_id)) {
      throw new Error(`Session not found in list: ${JSON.stringify(listRes.data)}`);
    }
    console.log(`   ✅ Session verified in instructor's session list.`);

    // 7. End session
    console.log('7️⃣ Testing End Session (POST /api/sessions/:id/end)...');
    const endRes = await request({
      hostname: 'localhost',
      port,
      path: `/api/sessions/${createdSession.session_id}/end`,
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (endRes.status !== 200 || endRes.data.session.status !== 'ended') {
      throw new Error(`Failed to end session: ${JSON.stringify(endRes.data)}`);
    }
    console.log(`   ✅ Session ended successfully. Status set to 'ended'.`);

    console.log('\n🎉 ALL PHASE 2 AUTH & SESSION TESTS PASSED!\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ TEST FAILED:', err);
    process.exit(1);
  }
}

runTests();
