import unzip from 'unzip-js';

function chunksToUtf8 (chunks) {
  let totalLength = 0;
  for (const chunk of chunks) { totalLength += chunk.length; }
  const merged = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder('utf-8').decode(merged);
}

addEventListener('message', function (evt) {
  const version = evt.data.version;
  const hash = evt.data.hash;

  unzip(evt.data.directDownload, function (err, zipFile) {
    if (err) { return console.error(err); }

    zipFile.readEntries(function (entryError, entries) {
      if (entryError) { return console.error(entryError); }

      const data = { audio: undefined, beats: {} };
      const beatFiles = {};

      entries.forEach(function (entry) {
        const chunks = [];

        zipFile.readEntryData(entry, false, function (readError, readStream) {
          if (readError) { return console.error(readError); }

          readStream.on('data', function (chunk) { chunks.push(chunk); });
          readStream.on('end', function () {
            if (entry.name.endsWith('.egg') || entry.name.endsWith('.ogg')) {
              data.audio = URL.createObjectURL(new Blob(chunks));
            } else {
              const filename = entry.name;
              if (!filename.toLowerCase().endsWith('.dat')) { return; }

              const value = JSON.parse(chunksToUtf8(chunks));
              if (filename.toLowerCase() === 'info.dat') {
                data.info = value;
              } else {
                value._beatsPerMinute = evt.data.bpm;
                beatFiles[filename] = value;
              }
            }

            if (data.audio === undefined || data.info === undefined) { return; }

            for (const difficultyBeatmapSet of data.info._difficultyBeatmapSets) {
              const beatmapCharacteristicName = difficultyBeatmapSet._beatmapCharacteristicName;
              for (const difficultyBeatmap of difficultyBeatmapSet._difficultyBeatmaps) {
                const difficulty = difficultyBeatmap._difficulty;
                const beatmapFilename = difficultyBeatmap._beatmapFilename;
                if (beatFiles[beatmapFilename] === undefined) { return; }

                const id = `${beatmapCharacteristicName}-${difficulty}`;
                if (data.beats[id] === undefined) {
                  data.beats[id] = beatFiles[beatmapFilename];
                }
              }
            }

            postMessage({ message: 'load', data, version, hash });
          });
        });
      });
    });
  });
});
