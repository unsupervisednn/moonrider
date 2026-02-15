import { unzipSync } from 'fflate';

let activeRequestId = 0;

addEventListener('message', async evt => {
  if (evt.data.abort) { return; }

  const requestId = ++activeRequestId;
  const version = evt.data.version;
  const hash = evt.data.hash;

  try {
    const zipBytes = await fetchZipBytes(evt.data.directDownload, version, requestId);
    if (requestId !== activeRequestId) { return; }

    const archive = unzipSync(zipBytes);
    const data = buildBeatData(archive, evt.data.bpm);
    if (!data.audio || !data.info || !Object.keys(data.beats).length) {
      postMessage({ message: 'error', version, hash });
      return;
    }

    postMessage({ message: 'progress', progress: 1, version });
    postMessage({ message: 'load', data, version, hash });
  } catch (err) {
    console.error('[zip-worker] Failed to parse zip', err);
    postMessage({ message: 'error', version, hash });
  }
});

async function fetchZipBytes (url, version, requestId) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Zip fetch failed: ${response.status} ${response.statusText}`);
  }

  if (!response.body) {
    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
  }

  const total = Number(response.headers.get('content-length')) || 0;
  const reader = response.body.getReader();
  const chunks = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) { break; }
    if (requestId !== activeRequestId) { return new Uint8Array(0); }
    chunks.push(value);
    received += value.length;
    if (total) {
      postMessage({
        message: 'progress',
        version,
        progress: Math.min(received / total, 0.98)
      });
    }
  }

  const merged = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
}

function buildBeatData (archive, bpm) {
  const data = { audio: undefined, beats: {}, info: undefined };
  const beatFiles = {};

  for (const [entryPath, entryBytes] of Object.entries(archive)) {
    const lowerPath = entryPath.toLowerCase();
    const fileName = basename(entryPath);
    const lowerName = fileName.toLowerCase();

    if (!data.audio && (lowerPath.endsWith('.ogg') || lowerPath.endsWith('.egg'))) {
      data.audio = URL.createObjectURL(new Blob([entryBytes]));
      continue;
    }

    if (!lowerPath.endsWith('.dat')) { continue; }
    const value = parseDatFile(entryBytes);
    if (!value) { continue; }

    if (lowerName === 'info.dat') {
      data.info = value;
      continue;
    }

    value._beatsPerMinute = bpm;
    beatFiles[entryPath] = value;
    beatFiles[fileName] = value;
    beatFiles[lowerPath] = value;
    beatFiles[lowerName] = value;
  }

  if (!data.info) { return data; }

  const sets =
    data.info._difficultyBeatmapSets ||
    data.info.difficultyBeatmapSets ||
    [];

  for (const set of sets) {
    const characteristic =
      set._beatmapCharacteristicName ||
      set.beatmapCharacteristicName;
    const maps =
      set._difficultyBeatmaps ||
      set.difficultyBeatmaps ||
      [];

    for (const map of maps) {
      const difficulty = map._difficulty || map.difficulty;
      const beatmapFilename = map._beatmapFilename || map.beatmapFilename;
      const beat =
        beatFiles[beatmapFilename] ||
        beatFiles[String(beatmapFilename || '').toLowerCase()] ||
        beatFiles[basename(String(beatmapFilename || ''))] ||
        beatFiles[basename(String(beatmapFilename || '')).toLowerCase()];

      if (!beat || !characteristic || !difficulty) { continue; }
      data.beats[`${characteristic}-${difficulty}`] = beat;
    }
  }

  return data;
}

function parseDatFile (bytes) {
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  let parsed = tryParseJson(utf8);
  if (parsed) { return parsed; }

  const utf16 = new TextDecoder('utf-16le', { fatal: false }).decode(bytes);
  parsed = tryParseJson(utf16);
  return parsed;
}

function tryParseJson (raw) {
  if (!raw) { return null; }
  let text = raw.trim().replace(/\u0000/g, '').replace(/\uFFFD/g, '');
  const firstBrace = text.indexOf('{');
  if (firstBrace > 0) { text = text.slice(firstBrace); }

  try {
    return JSON.parse(text);
  } catch (_) {
    return null;
  }
}

function basename (path) {
  const normalized = path.replace(/\\/g, '/');
  const slashIdx = normalized.lastIndexOf('/');
  return slashIdx === -1 ? normalized : normalized.slice(slashIdx + 1);
}
