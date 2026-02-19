import { createAuthClient } from 'better-auth/client';

const authBaseURL = import.meta.env.VITE_AUTH_BASE_URL || window.location.origin;

export const authClient = createAuthClient({
  baseURL: authBaseURL
});

export async function getCurrentSession () {
  const response = await fetch('/api/session', {
    credentials: 'include',
    headers: {
      Accept: 'application/json'
    }
  });

  let body = null;
  try {
    body = await response.json();
  } catch (error) {}

  if (!response.ok) {
    throw new Error(body?.error || `Failed to fetch auth session (${response.status})`);
  }

  if (!body || !body.session) {
    return null;
  }

  if (body.session.user && body.session.session) {
    return body.session;
  }

  return { user: body.session.user || null, session: body.session.session || null };
}

export async function signInWithDiscord () {
  const result = await authClient.signIn.social({
    provider: 'discord',
    callbackURL: window.location.href
  });

  if (result.error) {
    throw new Error(result.error.message || 'Failed to start Discord sign-in');
  }

  return result.data;
}
