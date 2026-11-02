import http from 'http';
import { config } from '../src/config/index.js';
import { readJsonl } from '../src/storage/jsonStore.js';
import path from 'path';

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
  console.log('🧪 Testing Option 2: Domain & Tab Title Tracking Pipeline...\n');
  const port = config.port;

  // 1. Instructor registers & creates session
  const instructorEmail = `prof_tab_${Date.now()}@example.com`;
  const regRes = await request({
    hostname: 'localhost', port, path: '/api/auth/register', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { name: 'Prof. Tracking', email: instructorEmail, password: 'password123' });
  const instructorToken = regRes.data.token;

  const sessionRes = await request({
    hostname: 'localhost', port, path: '/api/sessions', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${instructorToken}` }
  }, { session_name: 'Advanced Security Exam' });
  const session = sessionRes.data.session;
  console.log(`✅ Session created: ${session.session_id}`);

  // 2. Student joins
  const joinRes = await request({
    hostname: 'localhost', port, path: '/api/student/join', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    session_code: session.session_code,
    student_id: 'STU-990',
    student_name: 'John Test'
  });
  const studentToken = joinRes.data.token;
  console.log('✅ Student enrolled.');

  // 3. Student switches tab to chatgpt.com
  console.log('✅ Reporting TAB_SWITCHED with domain chatgpt.com and title "ChatGPT"...');
  const switchRes = await request({
    hostname: 'localhost', port, path: '/api/student/events', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${studentToken}` }
  }, {
    event_type: 'TAB_SWITCHED',
    target_domain: 'chatgpt.com',
    tab_title: 'ChatGPT - AI Assistant'
  });

  if (switchRes.status !== 200) throw new Error('Failed to submit event');
  const participant = switchRes.data.participant;
  if (participant.current_domain !== 'chatgpt.com' || participant.current_tab_title !== 'ChatGPT - AI Assistant') {
    throw new Error(`Participant missing domain/title: ${JSON.stringify(participant)}`);
  }
  console.log(`   ✅ Live participant state updated: ${participant.current_domain} ("${participant.current_tab_title}")`);

  // 4. Check JSONL event persistence
  const activityFile = path.join(config.activityDir, `session_${session.session_id}.jsonl`);
  const events = await readJsonl(activityFile);
  const switchEvent = events.find(e => e.event_type === 'TAB_SWITCHED');
  if (!switchEvent || switchEvent.target_domain !== 'chatgpt.com') {
    throw new Error('Event missing target_domain in JSONL');
  }
  console.log(`   ✅ Event log contains target_domain="${switchEvent.target_domain}", tab_title="${switchEvent.tab_title}"`);

  // 5. Check Detailed Activity CSV export
  const csvRes = await request({
    hostname: 'localhost', port, path: `/api/sessions/${session.session_id}/export?type=detailed`, method: 'GET',
    headers: { 'Authorization': `Bearer ${instructorToken}` }
  });
  if (typeof csvRes.data !== 'string' || !csvRes.data.includes('target_domain,tab_title')) {
    throw new Error('CSV headers missing target_domain or tab_title');
  }
  if (!csvRes.data.includes('chatgpt.com') || !csvRes.data.includes('ChatGPT - AI Assistant')) {
    throw new Error('CSV missing recorded domain or tab title');
  }
  console.log('   ✅ Detailed Activity CSV verified with target_domain and tab_title columns & data.');

  // 6. Student returns to tab
  console.log('✅ Reporting TAB_RETURNED...');
  const returnRes = await request({
    hostname: 'localhost', port, path: '/api/student/events', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${studentToken}` }
  }, { event_type: 'TAB_RETURNED' });

  if (returnRes.data.participant.current_domain !== null) {
    throw new Error('Expected current_domain to be cleared upon return');
  }
  console.log('   ✅ current_domain cleared upon returning to session tab.');

  console.log('\n🎉 ALL DOMAIN & TAB TITLE TRACKING TESTS PASSED!\n');
}

run().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});

