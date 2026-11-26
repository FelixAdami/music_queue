const { getSongLyrics } = require("./songLyrics");
const { analyzeLyricsGenre } = require("./gemmaAi");

const pendingAnalyses = new Map();

async function getSongGenre(song) {
  const title = typeof song?.title === "string" ? song.title.trim() : "";
  const artist = typeof song?.artist === "string" ? song.artist.trim() : "";
  const durationMs = song?.durationMs;
  if (!title || !artist) {
    throw new TypeError("Song title and artist are required for genre analysis");
  }
  const cacheKey = JSON.stringify([
    title.toLowerCase(),
    artist.toLowerCase(),
    durationMs ?? null,
  ]);
  if (pendingAnalyses.has(cacheKey)) return pendingAnalyses.get(cacheKey);

  const analysisPromise = (async () => {
    const lyricsResult = await getSongLyrics({ title, artist, durationMs });
    if (!lyricsResult?.lyrics) return null;

    return analyzeLyricsGenre(lyricsResult.lyrics);
  })();

  pendingAnalyses.set(cacheKey, analysisPromise);
  try {
    return await analysisPromise;
  } finally {
    pendingAnalyses.delete(cacheKey);
  }
}

module.exports = { getSongGenre };
