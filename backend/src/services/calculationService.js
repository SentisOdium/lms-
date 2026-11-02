/**
 * Calculation Service
 * Calculates accurate durations (Active, Away, Idle) from chronological activity streams.
 */

/**
 * Calculate activity durations for a specific student's event stream
 * @param {Array<object>} events Chronological list of events for a student
 * @param {object} session Session metadata (created_at, started_at, ended_at, status)
 * @returns {object} { active_seconds, away_seconds, idle_seconds, session_duration_seconds, tab_switches, status }
 */
export function calculateStudentMetrics(events, session) {
  if (!events || events.length === 0) {
    return {
      session_duration_seconds: 0,
      active_seconds: 0,
      away_seconds: 0,
      idle_seconds: 0,
      tab_switches: 0,
      connection_status: 'unknown'
    };
  }

  // Sort chronologically just in case
  const sorted = [...events].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  const sessionStartTime = new Date(session.started_at || session.created_at || sorted[0].timestamp).getTime();
  const sessionEndTime = session.ended_at
    ? new Date(session.ended_at).getTime()
    : Date.now();

  const firstEventTime = new Date(sorted[0].timestamp).getTime();
  const startTime = Math.max(sessionStartTime, firstEventTime);

  let activeSeconds = 0;
  let awaySeconds = 0;
  let idleSeconds = 0;
  let tabSwitches = 0;

  let currentState = 'active';
  let lastTime = startTime;
  let finalStatus = session.status === 'ended' ? 'completed' : 'active';

  for (let i = 0; i < sorted.length; i++) {
    const evt = sorted[i];
    const eventTime = new Date(evt.timestamp).getTime();

    // Compute elapsed seconds in currentState
    if (eventTime > lastTime) {
      const elapsed = Math.round((eventTime - lastTime) / 1000);
      if (currentState === 'active') activeSeconds += elapsed;
      else if (currentState === 'away') awaySeconds += elapsed;
      else if (currentState === 'idle') idleSeconds += elapsed;
      lastTime = eventTime;
    }

    // Process event transition
    switch (evt.event_type) {
      case 'TAB_SWITCHED':
        tabSwitches += 1;
        currentState = 'away';
        break;
      case 'WINDOW_UNFOCUSED':
        currentState = 'away';
        break;
      case 'IDLE_STARTED':
        currentState = 'idle';
        break;
      case 'TAB_RETURNED':
      case 'WINDOW_FOCUSED':
      case 'IDLE_ENDED':
        currentState = 'active';
        break;
      case 'DISCONNECTED':
        finalStatus = 'disconnected';
        break;
      case 'SESSION_LEFT':
        finalStatus = 'left';
        break;
      case 'SESSION_STARTED':
        currentState = 'active';
        break;
      default:
        break;
    }
  }

  // Add remaining duration until session end or now
  if (finalStatus !== 'left' && finalStatus !== 'disconnected' && sessionEndTime > lastTime) {
    const elapsed = Math.round((sessionEndTime - lastTime) / 1000);
    if (currentState === 'active') activeSeconds += elapsed;
    else if (currentState === 'away') awaySeconds += elapsed;
    else if (currentState === 'idle') idleSeconds += elapsed;
  }

  const totalDuration = activeSeconds + awaySeconds + idleSeconds;

  return {
    session_duration_seconds: totalDuration,
    active_seconds: activeSeconds,
    away_seconds: awaySeconds,
    idle_seconds: idleSeconds,
    tab_switches: tabSwitches,
    connection_status: finalStatus
  };
}

