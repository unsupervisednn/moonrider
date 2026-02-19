import { betterAuth } from 'better-auth';
import { getMigrations } from 'better-auth/db';

const MAX_LEADERBOARD_ROWS = 10;

export default {
  async fetch (request, env) {
    try {
      const url = new URL(request.url);
      const { pathname } = url;

      if (pathname === '/api/auth' || pathname.startsWith('/api/auth/')) {
        const auth = createAuth(env, request);
        return auth.handler(request);
      }

      if (pathname === '/api/session' && request.method === 'GET') {
        const auth = createAuth(env, request);
        const session = await auth.api.getSession({ headers: request.headers });
        return json({ session: session || null });
      }

      if (pathname === '/api/favorites' && request.method === 'GET') {
        return getFavorites(request, env);
      }

      if (pathname === '/api/favorites' && request.method === 'POST') {
        return addFavorite(request, env);
      }

      if (pathname.startsWith('/api/favorites/') && request.method === 'DELETE') {
        const challengeId = decodeURIComponent(pathname.replace('/api/favorites/', ''));
        return removeFavorite(request, env, challengeId);
      }

      if (pathname === '/api/high-scores' && request.method === 'GET') {
        return getHighScores(url, env);
      }

      if (pathname === '/api/high-scores' && request.method === 'POST') {
        return addHighScore(request, env);
      }

      if (pathname === '/api/admin/migrate' && request.method === 'POST') {
        return runMigrations(request, env);
      }

      if (env.ASSETS && typeof env.ASSETS.fetch === 'function') {
        return env.ASSETS.fetch(request);
      }

      return new Response('Not found', { status: 404 });
    } catch (error) {
      console.error('[worker]', error);
      return json({ error: 'Internal server error' }, 500);
    }
  }
};

function createAuthConfig (env, request) {
  const origin = new URL(request.url).origin;
  const trustedOrigins = (env.BETTER_AUTH_TRUSTED_ORIGINS || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);

  if (!trustedOrigins.includes(origin)) {
    trustedOrigins.push(origin);
  }

  const config = {
    baseURL: env.BETTER_AUTH_URL || origin,
    secret: env.BETTER_AUTH_SECRET,
    database: env.DB,
    trustedOrigins
  };

  if (env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET) {
    config.socialProviders = {
      discord: {
        clientId: env.DISCORD_CLIENT_ID,
        clientSecret: env.DISCORD_CLIENT_SECRET
      }
    };
  }

  return config;
}

function createAuth (env, request) {
  return betterAuth(createAuthConfig(env, request));
}

async function getAuthSession (request, env) {
  const auth = createAuth(env, request);
  return auth.api.getSession({ headers: request.headers });
}

async function getFavorites (request, env) {
  const session = await getAuthSession(request, env);
  if (!session?.user?.id) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const result = await env.DB.prepare(
    `SELECT challenge_json
     FROM favorites
     WHERE user_id = ?
     ORDER BY updated_at DESC`
  )
    .bind(session.user.id)
    .all();

  const favorites = [];
  for (const row of result.results || []) {
    try {
      favorites.push(JSON.parse(row.challenge_json));
    } catch (error) {
      console.warn('[favorites] invalid row skipped', error);
    }
  }

  return json({ favorites });
}

async function addFavorite (request, env) {
  const session = await getAuthSession(request, env);
  if (!session?.user?.id) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const payload = await request.json();
  const challenge = payload?.challenge;
  if (!challenge || typeof challenge !== 'object' || !challenge.id) {
    return json({ error: 'Missing challenge payload' }, 400);
  }

  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO favorites (user_id, challenge_id, challenge_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (user_id, challenge_id)
     DO UPDATE SET challenge_json = excluded.challenge_json, updated_at = excluded.updated_at`
  )
    .bind(
      session.user.id,
      challenge.id,
      JSON.stringify(challenge),
      now,
      now
    )
    .run();

  return json({ ok: true });
}

async function removeFavorite (request, env, challengeId) {
  const session = await getAuthSession(request, env);
  if (!session?.user?.id) {
    return json({ error: 'Unauthorized' }, 401);
  }

  if (!challengeId) {
    return json({ error: 'Missing challenge id' }, 400);
  }

  await env.DB.prepare(
    'DELETE FROM favorites WHERE user_id = ? AND challenge_id = ?'
  )
    .bind(session.user.id, challengeId)
    .run();

  return json({ ok: true });
}

async function getHighScores (url, env) {
  const challengeId = url.searchParams.get('challengeId') || '';
  const difficulty = url.searchParams.get('difficulty') || '';
  const beatmapCharacteristic = url.searchParams.get('beatmapCharacteristic') || 'Standard';
  const gameMode = url.searchParams.get('gameMode') || '';

  if (!challengeId || !difficulty || !gameMode) {
    return json({ scores: [] });
  }

  const result = await env.DB.prepare(
    `SELECT score, accuracy, username, challenge_id AS challengeId,
            difficulty, beatmap_characteristic AS beatmapCharacteristic,
            game_mode AS gameMode, created_at AS time
     FROM high_scores
     WHERE challenge_id = ?
       AND difficulty = ?
       AND beatmap_characteristic = ?
       AND game_mode = ?
     ORDER BY score DESC, created_at ASC
     LIMIT ?`
  )
    .bind(challengeId, difficulty, beatmapCharacteristic, gameMode, MAX_LEADERBOARD_ROWS)
    .all();

  return json({ scores: result.results || [] });
}

async function addHighScore (request, env) {
  const session = await getAuthSession(request, env);
  if (!session?.user?.id) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const payload = await request.json();
  const challengeId = payload?.challengeId;
  const difficulty = payload?.difficulty;
  const beatmapCharacteristic = payload?.beatmapCharacteristic || 'Standard';
  const gameMode = payload?.gameMode;
  const accuracy = Number(payload?.accuracy);
  const score = Number(payload?.score);
  const username = sanitizeUsername(payload?.username, session.user.name);

  if (!challengeId || !difficulty || !gameMode || Number.isNaN(score)) {
    return json({ error: 'Invalid score payload' }, 400);
  }

  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO high_scores
      (id, user_id, challenge_id, difficulty, beatmap_characteristic, game_mode, score, accuracy, username, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      crypto.randomUUID(),
      session.user.id,
      challengeId,
      difficulty,
      beatmapCharacteristic,
      gameMode,
      score,
      Number.isNaN(accuracy) ? null : accuracy,
      username,
      now
    )
    .run();

  return json({
    score: {
      accuracy: Number.isNaN(accuracy) ? 0 : accuracy,
      challengeId,
      difficulty,
      beatmapCharacteristic,
      gameMode,
      score,
      username,
      time: now
    }
  });
}

async function runMigrations (request, env) {
  if (!env.MIGRATION_API_KEY) {
    return json({ error: 'MIGRATION_API_KEY is not configured' }, 503);
  }

  if (request.headers.get('x-migration-key') !== env.MIGRATION_API_KEY) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const migrations = getMigrations(createAuthConfig(env, request));
  for (const migration of migrations) {
    const sql = migration.sql || migration.up;
    if (!sql) { continue; }
    await env.DB.exec(sql);
  }

  await env.DB.exec(`
    CREATE TABLE IF NOT EXISTS favorites (
      user_id TEXT NOT NULL,
      challenge_id TEXT NOT NULL,
      challenge_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, challenge_id)
    );
  `);

  await env.DB.exec(`
    CREATE TABLE IF NOT EXISTS high_scores (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      challenge_id TEXT NOT NULL,
      difficulty TEXT NOT NULL,
      beatmap_characteristic TEXT NOT NULL,
      game_mode TEXT NOT NULL,
      score INTEGER NOT NULL,
      accuracy REAL,
      username TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  await env.DB.exec(`
    CREATE INDEX IF NOT EXISTS idx_high_scores_lookup
    ON high_scores (challenge_id, difficulty, beatmap_characteristic, game_mode, score DESC, created_at ASC);
  `);

  return json({ ok: true, migrationsApplied: migrations.length });
}

function sanitizeUsername (value, fallback = 'Player') {
  if (!value || typeof value !== 'string') {
    return fallback || 'Player';
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return fallback || 'Player';
  }

  return trimmed.substring(0, 24);
}

function json (payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}
