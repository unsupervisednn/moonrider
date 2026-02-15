const COVER_IMAGE_HOST = 'https://cdn.beatsaver.com/';

export default function normalizeCoverURL (coverURL, fallbackHash = '') {
  if (!coverURL && !fallbackHash) { return ''; }

  const value = (coverURL || '').trim();
  const fallback = (fallbackHash || '').trim();
  const rawName = value ? value.substring(value.lastIndexOf('/') + 1) : '';
  const fileName = rawName.split('?')[0].split('#')[0];

  if (fileName) {
    if (/\.[a-z0-9]+$/i.test(fileName)) { return COVER_IMAGE_HOST + fileName; }
    return COVER_IMAGE_HOST + fileName + '.jpg';
  }

  if (fallback) {
    if (/\.[a-z0-9]+$/i.test(fallback)) { return COVER_IMAGE_HOST + fallback; }
    return COVER_IMAGE_HOST + fallback + '.jpg';
  }

  return '';
}
