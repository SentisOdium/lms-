// SBAMS Extension Background Service Worker (Manifest V3)
const API_BASE_URL = 'http://localhost:5000/api';
const HEARTBEAT_INTERVAL_MS = 15000; // Check and send heartbeat every 15s

let activeSession = null;
let heartbeatTimer = null;
let currentStatus = 'active';

// Sequential event queue to eliminate async race conditions
let eventQueue = Promise.resolve();
function queueEvent(eventType, metadata = {}) {
  eventQueue = eventQueue
    .then(() => reportEvent(eventType, metadata))
    .catch((err) => console.warn('[SBAMS] Event queue error:', err));
  return eventQueue;
}

console.log('[SBAMS] Background service worker initialized.');

// Configure idle detection threshold to 5 minutes (300 seconds)
try {
  chrome.idle.setDetectionInterval(300);
} catch (e) {
  console.warn('[SBAMS] Could not set idle interval:', e);
}

// Check and validate active session on startup / install
chrome.runtime.onStartup.addListener(initSession);
chrome.runtime.onInstalled.addListener(initSession);

async function initSession() {
  chrome.storage.local.get(['sbams_session'], async (result) => {
    const session = result.sbams_session;
    if (session && session.active && session.token) {
      try {
        const response = await fetch(`${API_BASE_URL}/student/session`, {
          headers: { 'Authorization': `Bearer ${session.token}` }
        });
        const data = await response.json();
        if (!data.active) {
          console.log('[SBAMS] Session ended on server. Stopping local monitoring.');
          stopMonitoring();
        } else {
          startMonitoring(session);
        }
      } catch (err) {
        startMonitoring(session);
      }
    }
  });
}

function startMonitoring(session) {
  activeSession = session;
  currentStatus = 'active';

  if (heartbeatTimer) clearInterval(heartbeatTimer);

  sendHeartbeat();
  heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
  console.log('[SBAMS] Monitoring started for session:', session.session_id);
}

function stopMonitoring() {
  activeSession = null;
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  chrome.storage.local.remove(['sbams_session']);
  console.log('[SBAMS] Monitoring stopped.');
}

// 1. Tab Switching Detection (Direct & Queued)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  if (!activeSession) return;

  const isMonitoredTab = activeInfo.tabId === activeSession.monitored_tab_id;

  if (isMonitoredTab) {
    currentStatus = 'active';
    updateLocalStatus('active');
    queueEvent('TAB_RETURNED');
  } else {
    currentStatus = 'away';
    updateLocalStatus('away');

    let tabTitle = 'External Tab';
    let targetDomain = 'external';

    try {
      const targetTab = await chrome.tabs.get(activeInfo.tabId);
      if (targetTab) {
        tabTitle = targetTab.title || 'Untitled Tab';
        if (targetTab.url) {
          try {
            const parsed = new URL(targetTab.url);
            targetDomain = parsed.hostname || parsed.protocol;
          } catch (_) {
            targetDomain = targetTab.url.slice(0, 30);
          }
        }
      }
    } catch (err) {
      console.warn('[SBAMS] Could not get tab details:', err);
    }

    queueEvent('TAB_SWITCHED', {
      tab_title: tabTitle,
      target_domain: targetDomain
    });
  }
});

// 2. Browser Focus Detection
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (!activeSession) return;

  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // Entire browser lost OS focus
    currentStatus = 'away';
    updateLocalStatus('away');
    queueEvent('WINDOW_UNFOCUSED');
  } else {
    // Window gained focus — check if active tab in this window is the session tab
    chrome.tabs.query({ active: true, windowId }, (tabs) => {
      const activeTab = tabs && tabs[0];
      if (activeTab && activeTab.id === activeSession.monitored_tab_id) {
        currentStatus = 'active';
        updateLocalStatus('active');
        queueEvent('TAB_RETURNED');
      } else if (activeTab) {
        currentStatus = 'away';
        updateLocalStatus('away');
      }
    });
  }
});

// 3. System Inactivity / Idle Detection
chrome.idle.onStateChanged.addListener((newState) => {
  if (!activeSession) return;

  if (newState === 'idle' || newState === 'locked') {
    currentStatus = 'idle';
    updateLocalStatus('idle');
    queueEvent('IDLE_STARTED');
  } else if (newState === 'active') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs && tabs[0];
      const isMonitored = activeTab && activeTab.id === activeSession.monitored_tab_id;
      currentStatus = isMonitored ? 'active' : 'away';
      updateLocalStatus(currentStatus);
      queueEvent(isMonitored ? 'IDLE_ENDED' : 'TAB_SWITCHED');
    });
  }
});

// Send Heartbeat with Self-Healing Verification
async function sendHeartbeat() {
  if (!activeSession || !activeSession.token) return;

  // Self-heal: directly check current active tab state
  chrome.tabs.query({ active: true, lastFocusedWindow: true }, async (tabs) => {
    const activeTab = tabs && tabs[0];
    if (activeTab) {
      if (activeTab.id === activeSession.monitored_tab_id) {
        currentStatus = 'active';
      } else {
        currentStatus = 'away';
      }
      updateLocalStatus(currentStatus);
    }

    try {
      const res = await fetch(`${API_BASE_URL}/student/heartbeat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${activeSession.token}`
        },
        body: JSON.stringify({ status: currentStatus })
      });
      if (res.status === 401) {
        stopMonitoring();
      }
    } catch (err) {
      console.warn('[SBAMS] Heartbeat failed:', err);
    }
  });
}

// Low-level HTTP Event Reporter
async function reportEvent(eventType, metadata = {}) {
  if (!activeSession || !activeSession.token) return;

  try {
    await fetch(`${API_BASE_URL}/student/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${activeSession.token}`
      },
      body: JSON.stringify({
        event_type: eventType,
        tab_title: metadata.tab_title || null,
        target_domain: metadata.target_domain || null,
        timestamp: new Date().toISOString()
      })
    });
  } catch (err) {
    console.warn('[SBAMS] Failed to report event:', eventType, err);
  }
}

function updateLocalStatus(status) {
  if (activeSession) {
    activeSession.status = status;
    chrome.storage.local.set({ sbams_session: activeSession });
  }
}

// Message Listener from Popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'MONITORING_STARTED') {
    startMonitoring(message.session);
    sendResponse({ status: 'ok' });
  } else if (message.type === 'MONITORING_STOPPED') {
    stopMonitoring();
    sendResponse({ status: 'ok' });
  }
  return true;
});
