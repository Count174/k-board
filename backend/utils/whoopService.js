const crypto = require('crypto');
const db = require('../db/db');

const WHOOP_AUTH_URL = 'https://api.prod.whoop.com/oauth/oauth2/auth';
const WHOOP_TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token';
const WHOOP_API_BASE = 'https://api.prod.whoop.com/developer/v2';

const STATE_TTL_MS = 15 * 60 * 1000;

const all = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
  });

const get = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row || null)));
  });

const run = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });

function isConfigured() {
  return Boolean(
    process.env.WHOOP_CLIENT_ID &&
      process.env.WHOOP_CLIENT_SECRET &&
      process.env.WHOOP_REDIRECT_URI
  );
}

function getScopes() {
  return process.env.WHOOP_SCOPES || 'read:recovery read:profile read:sleep read:workout';
}

async function createOAuthState(userId) {
  const state = crypto.randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + STATE_TTL_MS).toISOString();
  await run(
    `INSERT INTO whoop_oauth_states (state, user_id, expires_at)
     VALUES (?, ?, ?)`,
    [state, userId, expiresAt]
  );
  return state;
}

async function consumeOAuthState(state) {
  const row = await get(
    `SELECT state, user_id, expires_at
       FROM whoop_oauth_states
      WHERE state = ?`,
    [state]
  );

  if (!row) return null;
  await run('DELETE FROM whoop_oauth_states WHERE state = ?', [state]);

  if (!row.expires_at || new Date(row.expires_at).getTime() < Date.now()) {
    return null;
  }
  return row.user_id;
}

async function getConnectUrl(userId) {
  if (!isConfigured()) {
    throw new Error('whoop_not_configured');
  }
  const state = await createOAuthState(userId);
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.WHOOP_CLIENT_ID,
    redirect_uri: process.env.WHOOP_REDIRECT_URI,
    scope: getScopes(),
    state,
  });
  return `${WHOOP_AUTH_URL}?${params.toString()}`;
}

async function fetchWhoopToken(bodyParams) {
  const body = new URLSearchParams({
    client_id: process.env.WHOOP_CLIENT_ID,
    client_secret: process.env.WHOOP_CLIENT_SECRET,
    ...bodyParams,
  });

  const response = await fetch(WHOOP_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const details = data?.error_description || data?.error || 'token_exchange_failed';
    throw new Error(details);
  }
  return data;
}

async function saveConnection(userId, tokenData) {
  const expiresIn = Number(tokenData.expires_in || 3600);
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  await run(
    `INSERT INTO whoop_connections
      (user_id, access_token, refresh_token, token_type, scope, expires_at, whoop_user_id, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(user_id) DO UPDATE SET
       access_token = excluded.access_token,
       refresh_token = excluded.refresh_token,
       token_type = excluded.token_type,
       scope = excluded.scope,
       expires_at = excluded.expires_at,
       whoop_user_id = excluded.whoop_user_id,
       updated_at = CURRENT_TIMESTAMP`,
    [
      userId,
      tokenData.access_token || '',
      tokenData.refresh_token || '',
      tokenData.token_type || 'Bearer',
      tokenData.scope || '',
      expiresAt,
      tokenData.user_id ? String(tokenData.user_id) : null,
    ]
  );
}

async function connectByCode(userId, code) {
  const tokenData = await fetchWhoopToken({
    grant_type: 'authorization_code',
    code,
    redirect_uri: process.env.WHOOP_REDIRECT_URI,
  });
  await saveConnection(userId, tokenData);
}

async function getConnection(userId) {
  return get(
    `SELECT user_id, access_token, refresh_token, token_type, scope, expires_at, whoop_user_id
       FROM whoop_connections
      WHERE user_id = ?`,
    [userId]
  );
}

async function refreshIfNeeded(connection) {
  if (!connection) return null;
  const expTs = connection.expires_at ? new Date(connection.expires_at).getTime() : 0;
  const shouldRefresh = !expTs || expTs - Date.now() < 60 * 1000;
  if (!shouldRefresh) return connection;

  if (!connection.refresh_token) return connection;

  const tokenData = await fetchWhoopToken({
    grant_type: 'refresh_token',
    refresh_token: connection.refresh_token,
  });
  await saveConnection(connection.user_id, tokenData);
  return getConnection(connection.user_id);
}

async function whoopApiGet(path, accessToken) {
  const response = await fetch(`${WHOOP_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data?.error || `whoop_api_${response.status}`);
    err.status = response.status;
    err.path = path;
    err.details = data;
    throw err;
  }
  return data;
}

function mapRecovery(record) {
  if (!record) return null;
  const score = record.score || {};
  return {
    cycleId: record.cycle_id || null,
    scoreState: record.score_state || null,
    createdAt: record.created_at || null,
    recoveryScore: score.recovery_score ?? null,
    restingHeartRate: score.resting_heart_rate ?? null,
    hrvRmssd: score.hrv_rmssd_milli ?? null,
    spo2: score.spo2_percentage ?? null,
    skinTempCelsius: score.skin_temp_celsius ?? null,
  };
}

function mapSleep(record) {
  if (!record) return null;
  const score = record.score || {};
  const stage = score.stage_summary || {};
  const totalMs = Number(
    stage.total_in_bed_time_milli ||
    (
      Number(stage.total_light_sleep_time_milli || 0) +
      Number(stage.total_slow_wave_sleep_time_milli || 0) +
      Number(stage.total_rem_sleep_time_milli || 0) +
      Number(stage.total_awake_time_milli || 0)
    )
  );
  const sleepHours = totalMs > 0 ? Number((totalMs / 3600000).toFixed(2)) : null;
  return {
    id: record.id || null,
    cycleId: record.cycle_id || null,
    start: record.start || null,
    end: record.end || null,
    sleepHours,
    sleepPerformancePercentage: score.sleep_performance_percentage ?? null,
    sleepConsistencyPercentage: score.sleep_consistency_percentage ?? null,
    sleepEfficiencyPercentage: score.sleep_efficiency_percentage ?? null,
  };
}

function mapWorkout(record) {
  if (!record) return null;
  const score = record.score || {};
  return {
    id: record.id || null,
    v1Id: record.v1_id || null,
    start: record.start || null,
    end: record.end || null,
    sportName: record.sport_name || null,
    sportId: record.sport_id || null,
    strain: score.strain ?? null,
    averageHeartRate: score.average_heart_rate ?? null,
    maxHeartRate: score.max_heart_rate ?? null,
  };
}

async function getLatestRecovery(userId) {
  let conn = await getConnection(userId);
  if (!conn) return null;

  conn = await refreshIfNeeded(conn);
  if (!conn?.access_token) return null;

  try {
    const data = await whoopApiGet('/recovery?limit=1', conn.access_token);
    const record = Array.isArray(data?.records) ? data.records[0] : null;
    return mapRecovery(record);
  } catch (e) {
    if (e.status === 401 && conn.refresh_token) {
      console.warn('whoop recovery unauthorized, trying refresh', { user_id: userId, path: e.path || '/recovery?limit=1' });
      const refreshed = await refreshIfNeeded({
        ...conn,
        expires_at: new Date(0).toISOString(),
      });
      if (!refreshed?.access_token) return null;
      const data = await whoopApiGet('/recovery?limit=1', refreshed.access_token);
      const record = Array.isArray(data?.records) ? data.records[0] : null;
      return mapRecovery(record);
    }
    throw e;
  }
}

async function getLatestSleep(userId) {
  let conn = await getConnection(userId);
  if (!conn) return null;

  conn = await refreshIfNeeded(conn);
  if (!conn?.access_token) return null;

  try {
    const data = await whoopApiGet('/activity/sleep?limit=1', conn.access_token);
    const record = Array.isArray(data?.records) ? data.records[0] : null;
    return mapSleep(record);
  } catch (e) {
    if (e.status === 401 && conn.refresh_token) {
      console.warn('whoop sleep unauthorized, trying refresh', { user_id: userId, path: e.path || '/activity/sleep?limit=1' });
      const refreshed = await refreshIfNeeded({
        ...conn,
        expires_at: new Date(0).toISOString(),
      });
      if (!refreshed?.access_token) return null;
      const data = await whoopApiGet('/activity/sleep?limit=1', refreshed.access_token);
      const record = Array.isArray(data?.records) ? data.records[0] : null;
      return mapSleep(record);
    }
    throw e;
  }
}

async function getRecentWorkouts(userId, hoursBack = 8) {
  let conn = await getConnection(userId);
  if (!conn) return [];

  conn = await refreshIfNeeded(conn);
  if (!conn?.access_token) return [];

  const startIso = new Date(Date.now() - hoursBack * 3600 * 1000).toISOString();
  const data = await whoopApiGet(`/activity/workout?limit=25&start=${encodeURIComponent(startIso)}`, conn.access_token);
  const records = Array.isArray(data?.records) ? data.records : [];
  return records.map(mapWorkout).filter(Boolean);
}

async function disconnect(userId) {
  await run('DELETE FROM whoop_connections WHERE user_id = ?', [userId]);
}

async function clearExpiredStates() {
  await run(`DELETE FROM whoop_oauth_states WHERE datetime(expires_at) < datetime('now')`);
}

module.exports = {
  isConfigured,
  getConnectUrl,
  consumeOAuthState,
  connectByCode,
  getConnection,
  getLatestRecovery,
  getLatestSleep,
  getRecentWorkouts,
  disconnect,
  clearExpiredStates,
  mapRecovery,
  mapSleep,
  mapWorkout,
};
