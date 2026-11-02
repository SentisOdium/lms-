import http from 'http';
import { io } from 'socket.io-client';
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
  console.log('🧪 Starting Phase 4 & 5 Real-Time Monitoring & Activity Engine Tests...\n');
  const port = config.port;

  // 1. Instructor registration & session
  console.log('1️⃣ Setting up instructor & active session...');
  const instructorEmail = `prof_realtime_${Date.now()}@example.com`;
  const regRes = await request({
    hostname: 'localhost', port, path: '/api/auth/register', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { name: 'Dr. Claude Shannon', email: instructorEmail, password: 'password123' });
  const instructorToken = regRes.data.token;

  const sessionRes = await request({
    hostname: 'localhost', port, path: '/api/sessions', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${instructorToken}` }
  }, { session_name: 'Information Theory Lab' });
  const session = sessionRes.data.session;
  console.log(`   ✅ Session: "${session.session_name}" (${session.session_code})`);

  // 2. Connect Socket.IO client to simulate instructor live dashboard
  console.log('2️⃣ Connecting Socket.IO client to instructor room...');
  const socket = io(`http://localhost:${port}`);
  const receivedStatusUpdates = [];

  await new Promise((resolve) => {
    socket.on('connect', () => {
      socket.emit('instructor:join', { sessionId: session.session_id });
      resolve();
    });
  });

  socket.on('student:status', (p) => {
    receivedStatusUpdates.push(p);
  });
  console.log('   ✅ Socket.IO connected & listening.');

  // 3. Student joins
  console.log('3️⃣ Student STU-201 joining session...');
  const joinRes = await request({
    hostname: 'localhost', port, path: '/api/student/join', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    session_code: session.session_code,
    student_id: 'STU-201',
    student_name: 'Bob Smith'
  });
  const studentToken = joinRes.data.token;
  console.log('   ✅ Student enrolled.');

  // 4. Student switches tab (TAB_SWITCHED)
  console.log('4️⃣ Simulating TAB_SWITCHED event from extension...');
  const tabSwitchRes = await request({
    hostname: 'localhost', port, path: '/api/student/events', method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${studentToken}`
    }
  }, {
    event_type: 'TAB_SWITCHED',
    timestamp: new Date().toISOString()
  });

  if (tabSwitchRes.status !== 200 || tabSwitchRes.data.participant.status !== 'away') {
    throw new Error(`Expected status 'away', got ${tabSwitchRes.data.participant.status}`);
  }
  if (tabSwitchRes.data.participant.tab_switches !== 1) {
    throw new Error(`Expected tab_switches 1, got ${tabSwitchRes.data.participant.tab_switches}`);
  }
  console.log('   ✅ Status updated to AWAY. Tab switches incremented to 1.');

  // 5. Student returns to tab (TAB_RETURNED)
  console.log('5️⃣ Simulating TAB_RETURNED event...');
  const tabReturnRes = await request({
    hostname: 'localhost', port, path: '/api/student/events', method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${studentToken}`
    }
  }, {
    event_type: 'TAB_RETURNED',
    timestamp: new Date().toISOString()
  });

  if (tabReturnRes.status !== 200 || tabReturnRes.data.participant.status !== 'active') {
    throw new Error(`Expected status 'active', got ${tabReturnRes.data.participant.status}`);
  }
  console.log('   ✅ Status restored to ACTIVE.');

  // 6. Student sends heartbeat ping
  console.log('6️⃣ Simulating 30-second heartbeat...');
  const beatRes = await request({
    hostname: 'localhost', port, path: '/api/student/heartbeat', method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${studentToken}`
    }
  }, { status: 'active' });
  if (beatRes.status !== 200) throw new Error('Heartbeat failed');
  console.log('   ✅ Heartbeat registered by server.');

  // 7. Verify instructor can fetch participants list
  console.log('7️⃣ Testing GET /api/sessions/:id/participants...');
  const partRes = await request({
    hostname: 'localhost', port, path: `/api/sessions/${session.session_id}/participants`, method: 'GET',
    headers: { 'Authorization': `Bearer ${instructorToken}` }
  });
  if (partRes.status !== 200 || partRes.data.participants.length !== 1) {
    throw new Error(`Expected 1 participant, got ${partRes.data.participants.length}`);
  }
  console.log(`   ✅ Participant verified: ${partRes.data.participants[0].student_name} (${partRes.data.participants[0].status})`);

  // 8. Verify instructor can fetch full event history
  console.log('8️⃣ Testing GET /api/sessions/:id/activity...');
  const actRes = await request({
    hostname: 'localhost', port, path: `/api/sessions/${session.session_id}/activity?student_id=STU-201`, method: 'GET',
    headers: { 'Authorization': `Bearer ${instructorToken}` }
  });
  if (actRes.status !== 200 || actRes.data.events.length < 3) {
    throw new Error(`Expected at least 3 events (START, SWITCH, RETURN), got ${actRes.data.events.length}`);
  }
  console.log(`   ✅ Activity event stream verified: ${actRes.data.events.length} chronological events logged.`);

  // 9. Verify Socket.IO updates arrived
  console.log('9️⃣ Verifying Socket.IO live updates received by client...');
  await new Promise(r => setTimeout(r, 200));
  if (receivedStatusUpdates.length === 0) {
    throw new Error('No Socket.IO status updates received');
  }
  console.log(`   ✅ Received ${receivedStatusUpdates.length} real-time Socket.IO broadcasts.`);

  socket.disconnect();
  console.log('\n🎉 ALL REAL-TIME MONITORING & ACTIVITY TESTS PASSED!\n');
}

run().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});

