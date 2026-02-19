import { createAuthClient } from 'better-auth/client';

const authBaseURL = import.meta.env.VITE_AUTH_BASE_URL || window.location.origin;

export const authClient = createAuthClient({
  baseURL: authBaseURL
});

export async function getCurrentSession () {
  const result = await authClient.getSession();
  if (result.error) {
    throw new Error(result.error.message || 'Failed to fetch auth session');
  }

  if (!result.data) {
    return null;
  }

  if (result.data.user && result.data.session) {
    return result.data;
  }

  return { user: result.data.user || null, session: result.data.session || null };
}

export function signInWithFacebook () {
  return authClient.signIn.social({
    provider: 'facebook',
    callbackURL: window.location.href
  });
}
