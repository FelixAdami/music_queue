const { getSongLyrics } = require("./songLyrics");
const { analyzeLyricsGenre } = require("./gemmaAi");

const analysisCache = new Map();
const pendingAnalyses = new Map();

async function getSongGenre(song) {
  const cacheKey = String(song?._id ?? "");
  if (!cacheKey) {
    throw new TypeError("A saved queue song is required for genre analysis");
  }
  if (analysisCache.has(cacheKey)) return analysisCache.get(cacheKey);
  if (pendingAnalyses.has(cacheKey)) return pendingAnalyses.get(cacheKey);

  const analysisPromise = (async () => {
    const lyricsResult = await getSongLyrics(song);
    if (!lyricsResult?.lyrics) {
      analysisCache.set(cacheKey, null);
      return null;
    }

    const analysis = await analyzeLyricsGenre(lyricsResult.lyrics);
    analysisCache.set(cacheKey, analysis);
    return analysis;
  })();

  pendingAnalyses.set(cacheKey, analysisPromise);
  try {
    return await analysisPromise;
  } finally {
    pendingAnalyses.delete(cacheKey);
  }
}

module.exports = { getSongGenre };