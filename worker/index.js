import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { drizzle } from 'drizzle-orm/d1';
import { authSchema } from './auth-schema';

const MAX_LEADERBOARD_ROWS = 10;

export default {
  async fetch (request, env) {
    try {
      const url = new URL(request.url);
      const { pathname } = url;

      if (pathname === '/api/auth' || pathname.startsWith('/api/auth/')) {
        const configError = getMissingConfigError(env, ['BETTER_AUTH_SECRET', 'DB']);
        if (configError) { return configError; }

        const socialConfigError = getSocialProviderConfigError(pathname, env);
        if (socialConfigError) { return socialConfigError; }

        const authTablesError = await getAuthTablesError(pathname, env);
        if (authTablesError) { return authTablesError; }

        const auth = createAuth(env, request);
        try {
          return await auth.handler(request);
        } catch (error) {
          console.error('[auth]', error);
          return json({ error: error?.message || 'Auth handler failed' }, 500);
        }
      }

      if (pathname === '/api/session' && request.method === 'GET') {
        const configError = getMissingConfigError(env, ['BETTER_AUTH_SECRET', 'DB']);
        if (configError) { return configError; }

        const authTablesError = await getAuthTablesError(pathname, env);
        if (authTablesError) { return authTablesError; }

        const auth = createAuth(env, request);
        const session = await auth.api.getSession({ headers: request.headers });
        return json({ session: session || null });
      }

      if (pathname === '/api/favorites' && request.method === 'GET') {
        const configError = getMissingConfigError(env, ['BETTER_AUTH_SECRET', 'DB']);
        if (configError) { return configError; }
        return getFavorites(request, env);
      }

      if (pathname === '/api/favorites' && request.method === 'POST') {
        const configError = getMissingConfigError(env, ['BETTER_AUTH_SECRET', 'DB']);
        if (configError) { return configError; }
        return addFavorite(request, env);
      }

      if (pathname.startsWith('/api/favorites/') && request.method === 'DELETE') {
        const configError = getMissingConfigError(env, ['BETTER_AUTH_SECRET', 'DB']);
        if (configError) { return configError; }
        const challengeId = decodeURIComponent(pathname.replace('/api/favorites/', ''));
        return removeFavorite(request, env, challengeId);
      }

      if (pathname === '/api/high-scores' && request.method === 'GET') {
        const configError = getMissingConfigError(env, ['DB']);
        if (configError) { return configError; }
        return getHighScores(url, env);
      }

      if (pathname === '/api/high-scores' && request.method === 'POST') {
        const configError = getMissingConfigError(env, ['BETTER_AUTH_SECRET', 'DB']);
        if (configError) { return configError; }
        return addHighScore(request, env);
      }

      if (pathname === '/api/admin/migrate' && request.method === 'POST') {
        const configError = getMissingConfigError(env, ['BETTER_AUTH_SECRET', 'DB', 'MIGRATION_API_KEY']);
        if (configError) { return configError; }
        return runMigrations(request, env);
      }

      if (env.ASSETS && typeof env.ASSETS.fetch === 'function') {
        return env.ASSETS.fetch(request);
      }

      return new Response('Not found', { status: 404 });
    } catch (error) {
      console.error('[worker]', error);
      return json({ error: error?.message || 'Internal server error' }, 500);
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
    database: drizzleAdapter(drizzle(env.DB, { schema: authSchema }), {
      provider: 'sqlite',
      schema: authSchema
    }),
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
  if (request.headers.get('x-migration-key') !== env.MIGRATION_API_KEY) {
    return json({ error: 'Unauthorized' }, 401);
  }

  try {
    await env.DB.exec(`
      CREATE TABLE IF NOT EXISTS "user" (
        "id" TEXT PRIMARY KEY NOT NULL,
        "name" TEXT NOT NULL,
        "email" TEXT NOT NULL,
        "emailVerified" INTEGER NOT NULL DEFAULT 0,
        "image" TEXT,
        "createdAt" INTEGER NOT NULL,
        "updatedAt" INTEGER NOT NULL
      );
    `);

    await env.DB.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_user_email"
      ON "user" ("email");
    `);

    await env.DB.exec(`
      CREATE TABLE IF NOT EXISTS "session" (
        "id" TEXT PRIMARY KEY NOT NULL,
        "expiresAt" INTEGER NOT NULL,
        "token" TEXT NOT NULL,
        "createdAt" INTEGER NOT NULL,
        "updatedAt" INTEGER NOT NULL,
        "ipAddress" TEXT,
        "userAgent" TEXT,
        "userId" TEXT NOT NULL,
        FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE
      );
    `);

    await env.DB.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_session_token"
      ON "session" ("token");
    `);

    await env.DB.exec(`
      CREATE INDEX IF NOT EXISTS "idx_session_user_id"
      ON "session" ("userId");
    `);

    await env.DB.exec(`
      CREATE TABLE IF NOT EXISTS "account" (
        "id" TEXT PRIMARY KEY NOT NULL,
        "accountId" TEXT NOT NULL,
        "providerId" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "accessToken" TEXT,
        "refreshToken" TEXT,
        "idToken" TEXT,
        "accessTokenExpiresAt" INTEGER,
        "refreshTokenExpiresAt" INTEGER,
        "scope" TEXT,
        "password" TEXT,
        "createdAt" INTEGER NOT NULL,
        "updatedAt" INTEGER NOT NULL,
        FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE
      );
    `);

    await env.DB.exec(`
      CREATE INDEX IF NOT EXISTS "idx_account_user_id"
      ON "account" ("userId");
    `);

    await env.DB.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_account_provider_account"
      ON "account" ("providerId", "accountId");
    `);

    await env.DB.exec(`
      CREATE TABLE IF NOT EXISTS "verification" (
        "id" TEXT PRIMARY KEY NOT NULL,
        "identifier" TEXT NOT NULL,
        "value" TEXT NOT NULL,
        "expiresAt" INTEGER NOT NULL,
        "createdAt" INTEGER NOT NULL,
        "updatedAt" INTEGER NOT NULL
      );
    `);

    await env.DB.exec(`
      CREATE INDEX IF NOT EXISTS "idx_verification_identifier"
      ON "verification" ("identifier");
    `);

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

    return json({ ok: true });
  } catch (error) {
    console.error('[migrations]', error);
    return json({ error: `Migration failed: ${error?.message || 'Unknown error'}` }, 500);
  }
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

function getMissingConfigError (env, keys) {
  const missing = keys.filter(key => !env[key]);
  if (!missing.length) { return null; }
  return json({ error: `Missing Worker config: ${missing.join(', ')}` }, 503);
}

function getSocialProviderConfigError (pathname, env) {
  if (!pathname.startsWith('/api/auth/sign-in/social')) {
    return null;
  }

  const missing = [];
  if (!env.DISCORD_CLIENT_ID) { missing.push('DISCORD_CLIENT_ID'); }
  if (!env.DISCORD_CLIENT_SECRET) { missing.push('DISCORD_CLIENT_SECRET'); }

  if (!missing.length) { return null; }
  return json({ error: `Discord auth is not configured in Worker secrets/vars: ${missing.join(', ')}` }, 503);
}

async function getAuthTablesError (pathname, env) {
  const requiresAuthTables =
    pathname === '/api/session' ||
    pathname.startsWith('/api/auth/sign-in/') ||
    pathname.startsWith('/api/auth/callback/');

  if (!requiresAuthTables) {
    return null;
  }

  const expectedTables = ['user', 'session', 'account', 'verification'];
  const placeholders = expectedTables.map(() => '?').join(', ');
  const result = await env.DB.prepare(
    `SELECT name
     FROM sqlite_master
     WHERE type = 'table'
       AND name IN (${placeholders})`
  )
    .bind(...expectedTables)
    .all();

  const present = new Set((result.results || []).map(row => row.name));
  const missing = expectedTables.filter(table => !present.has(table));
  if (!missing.length) {
    return null;
  }

  return json({ error: `Missing auth tables: ${missing.join(', ')}. Run POST /api/admin/migrate first.` }, 503);
}
