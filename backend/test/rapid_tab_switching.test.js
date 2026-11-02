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
  console.log('🧪 Testing Rapid Tab-Switching & State Recovery...\n');
  const port = config.port;

  // 1. Instructor & session
  const instructorEmail = `prof_rapid_${Date.now()}@example.com`;
  const regRes = await request({
    hostname: 'localhost', port, path: '/api/auth/register', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { name: 'Prof. Rapid Test', email: instructorEmail, password: 'password123' });
  const instructorToken = regRes.data.token;

  const sessionRes = await request({
    hostname: 'localhost', port, path: '/api/sessions', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${instructorToken}` }
  }, { session_name: 'Rapid Switching Verification' });
  const session = sessionRes.data.session;

  // 2. Student joins
  const joinRes = await request({
    hostname: 'localhost', port, path: '/api/student/join', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    session_code: session.session_code,
    student_id: 'STU-RAPID',
    student_name: 'Rapid Switcher'
  });
  const studentToken = joinRes.data.token;

  // 3. Perform 10 rapid switches: away -> active -> away -> active...
  console.log('🔄 Executing 10 rapid switches in sequence...');
  for (let i = 1; i <= 5; i++) {
    // Switch away
    await request({
      hostname: 'localhost', port, path: '/api/student/events', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${studentToken}` }
    }, {
      event_type: 'TAB_SWITCHED',
      target_domain: 'google.com',
      tab_title: `Google Search #${i}`
    });

    // Return to tab
    await request({
      hostname: 'localhost', port, path: '/api/student/events', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${studentToken}` }
    }, {
      event_type: 'TAB_RETURNED'
    });
  }

  // 4. Check final participant state
  const partRes = await request({
    hostname: 'localhost', port, path: `/api/sessions/${session.session_id}/participants`, method: 'GET',
    headers: { 'Authorization': `Bearer ${instructorToken}` }
  });

  const p = partRes.data.participants.find(x => x.student_id === 'STU-RAPID');
  console.log(`   Final Participant Status: ${p.status}`);
  console.log(`   Total Tab Switches Count: ${p.tab_switches}`);

  if (p.status !== 'active') {
    throw new Error(`Expected final status 'active', but got '${p.status}'`);
  }
  if (p.tab_switches !== 5) {
    throw new Error(`Expected tab_switches 5, got ${p.tab_switches}`);
  }
  if (p.current_domain !== null) {
    throw new Error(`Expected current_domain to be null, got ${p.current_domain}`);
  }

  console.log('\n🎉 RAPID TAB-SWITCHING & STATE RECOVERY FULLY VERIFIED!\n');
}

run().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});

