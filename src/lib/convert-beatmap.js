import normalizeCoverURL from './normalize-cover-url';

export default function convertBeatmap (src) {
  if (src.converted) { return src; }

  if (src['map']) { src = src['map']; }

  src['version'] = src['versions'][0]['hash'];

  src['directDownload'] = src['versions'][0]['downloadURL'];

  src['coverURL'] = normalizeCoverURL(src['versions'][0]['coverURL'], src['versions'][0]['hash']);

  let diffs = src['versions'][0]['diffs'];

  src.metadata.characteristics = {};

  for (const item of diffs) {

    if (src.metadata.characteristics[item['characteristic']] === undefined) {
      src.metadata.characteristics[item['characteristic']] = {};
    }

    src.metadata.characteristics[item['characteristic']][item['difficulty']] = item;
  }
  src.metadata.characteristics = JSON.stringify(src.metadata.characteristics);

  src.converted = true;

  return src;
}
