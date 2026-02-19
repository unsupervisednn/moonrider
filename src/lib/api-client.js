import convertBeatmap from './convert-beatmap';

export async function fetchFavorites () {
  const data = await request('/api/favorites');
  return (data.favorites || []).map(convertBeatmap);
}

export async function addFavorite (challenge) {
  await request('/api/favorites', {
    method: 'POST',
    body: JSON.stringify({ challenge })
  });
}

export async function removeFavorite (challengeId) {
  await request(`/api/favorites/${encodeURIComponent(challengeId)}`, {
    method: 'DELETE'
  });
}

export async function fetchHighScores (params) {
  const query = new URLSearchParams();
  query.set('challengeId', params.challengeId || '');
  query.set('difficulty', params.difficulty || '');
  query.set('beatmapCharacteristic', params.beatmapCharacteristic || 'Standard');
  query.set('gameMode', params.gameMode || '');

  const data = await request(`/api/high-scores?${query.toString()}`);
  return data.scores || [];
}

export async function submitHighScore (scoreData) {
  const data = await request('/api/high-scores', {
    method: 'POST',
    body: JSON.stringify(scoreData)
  });
  return data.score;
}

async function request (path, options = {}) {
  const headers = {
    Accept: 'application/json'
  };

  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(path, {
    ...options,
    credentials: 'include',
    headers: {
      ...headers,
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    let errorMessage = `Request failed (${response.status})`;
    try {
      const errorBody = await response.json();
      if (errorBody?.error) {
        errorMessage = errorBody.error;
      }
    } catch (error) {}

    const requestError = new Error(errorMessage);
    requestError.status = response.status;
    throw requestError;
  }

  if (response.status === 204) {
    return {};
  }

  return response.json();
}
