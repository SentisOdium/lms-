// SBAMS Extension Popup Controller
const API_BASE_URL = 'http://localhost:5000/api';

document.addEventListener('DOMContentLoaded', async () => {
  const joinView = document.getElementById('joinView');
  const activeView = document.getElementById('activeView');
  const joinBtn = document.getElementById('joinBtn');
  const leaveBtn = document.getElementById('leaveBtn');
  const studentIdInput = document.getElementById('studentId');
  const studentNameInput = document.getElementById('studentName');
  const sessionCodeInput = document.getElementById('sessionCode');
  const connBadge = document.getElementById('connBadge');
  const headerStatusDot = document.getElementById('headerStatusDot');
  const displaySessionName = document.getElementById('displaySessionName');
  const displayStudentId = document.getElementById('displayStudentId');
  const displayTabTitle = document.getElementById('displayTabTitle');
  const statusPill = document.getElementById('statusPill');
  const statusDesc = document.getElementById('statusDesc');

  // Load existing session state
  chrome.storage.local.get(['sbams_session'], async (result) => {
    const session = result.sbams_session;
    if (session && session.active && session.token) {
      // Validate session with backend to check if still active
      try {
        const checkRes = await fetch(`${API_BASE_URL}/student/session`, {
          headers: { 'Authorization': `Bearer ${session.token}` }
        });
        const checkData = await checkRes.json();

        if (checkData.active) {
          showActiveView(session);
        } else {
          // Session ended by instructor or expired
          alert(checkData.message || 'The instructor has ended this monitoring session.');
          chrome.storage.local.remove(['sbams_session'], () => {
            showJoinView();
          });
        }
      } catch (err) {
        // Offline or connection error, show active view from cache
        showActiveView(session);
      }
    } else {
      showJoinView();
    }
  });

  function showActiveView(session) {
    joinView.classList.add('hidden');
    activeView.classList.remove('hidden');
    connBadge.textContent = 'Connected';
    connBadge.classList.add('connected');
    headerStatusDot.classList.add('active');

    displaySessionName.textContent = session.session_name || 'Active Session';
    displayStudentId.textContent = session.student_id || '-';
    displayTabTitle.textContent = session.monitored_tab_title || 'Selected Session Tab';

    // Update status if present
    const status = session.status || 'Active';
    updateStatusDisplay(status);
  }

  function showJoinView() {
    joinView.classList.remove('hidden');
    activeView.classList.add('hidden');
    connBadge.textContent = 'Disconnected';
    connBadge.classList.remove('connected');
    headerStatusDot.classList.remove('active');
  }

  function updateStatusDisplay(status) {
    statusPill.className = 'status-pill';
    if (status.toLowerCase() === 'active') {
      statusPill.classList.add('active');
      statusPill.textContent = 'Active';
      statusDesc.textContent = 'Your session tab is selected and browser window is focused.';
    } else if (status.toLowerCase() === 'away') {
      statusPill.classList.add('away');
      statusPill.textContent = 'Away';
      statusDesc.textContent = 'You switched away from the monitored tab or minimized the browser.';
    } else if (status.toLowerCase() === 'idle') {
      statusPill.classList.add('idle');
      statusPill.textContent = 'Idle';
      statusDesc.textContent = 'No mouse or keyboard interaction detected on your system.';
    }
  }

  // Handle Join Session
  joinBtn.addEventListener('click', async () => {
    const studentId = studentIdInput.value.trim();
    const studentName = studentNameInput.value.trim() || studentId;
    const sessionCode = sessionCodeInput.value.trim().toUpperCase();

    if (!studentId || !sessionCode) {
      alert('Please enter both your Student ID and Session Code.');
      return;
    }

    joinBtn.disabled = true;
    joinBtn.textContent = 'Verifying...';

    try {
      const response = await fetch(`${API_BASE_URL}/student/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          student_name: studentName,
          session_code: sessionCode
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        alert(data.message || 'Failed to join session. Please check the code.');
        return;
      }

      // Query current active tab to lock as the monitored target tab
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const currentTab = tabs[0];
        const sessionState = {
          active: true,
          token: data.token,
          session_id: data.session.session_id,
          session_name: data.session.session_name,
          student_id: studentId,
          student_name: studentName,
          monitored_tab_id: currentTab ? currentTab.id : null,
          monitored_window_id: currentTab ? currentTab.windowId : null,
          monitored_tab_title: currentTab ? currentTab.title : 'Selected Tab',
          joined_at: new Date().toISOString(),
          status: 'Active'
        };

        chrome.storage.local.set({ sbams_session: sessionState }, () => {
          // Notify background worker that monitoring started
          chrome.runtime.sendMessage({ type: 'MONITORING_STARTED', session: sessionState });
          showActiveView(sessionState);
        });
      });
    } catch (err) {
      alert('Error connecting to SBAMS server: ' + err.message);
    } finally {
      joinBtn.disabled = false;
      joinBtn.textContent = 'Join Session';
    }
  });

  // Handle Leave Session
  leaveBtn.addEventListener('click', async () => {
    if (!confirm('Are you sure you want to stop monitoring and leave this session?')) {
      return;
    }

    leaveBtn.disabled = true;
    leaveBtn.textContent = 'Leaving...';

    chrome.storage.local.get(['sbams_session'], async (result) => {
      const session = result.sbams_session;
      if (session) {
        try {
          await fetch(`${API_BASE_URL}/student/leave`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.token}`
            },
            body: JSON.stringify({
              session_id: session.session_id,
              student_id: session.student_id
            })
          });
        } catch (_) {}

        // Notify background worker to stop monitoring
        chrome.runtime.sendMessage({ type: 'MONITORING_STOPPED' });
        chrome.storage.local.remove(['sbams_session'], () => {
          leaveBtn.disabled = false;
          leaveBtn.textContent = 'Leave Session';
          showJoinView();
        });
      }
    });
  });
});
