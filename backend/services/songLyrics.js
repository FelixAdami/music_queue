const LRCLIB_API_URL = "https://lrclib.net/api/get";
const USER_AGENT = "music-queue/1.0.0";

function getSongDetails(songOrTitle, artistName, durationMs) {
  if (typeof songOrTitle === "string") {
    return {
      title: songOrTitle.trim(),
      artist: typeof artistName === "string" ? artistName.trim() : "",
      durationMs,
    };
  }

  if (!songOrTitle || typeof songOrTitle !== "object") {
    throw new TypeError("A queue song or song title is required");
  }

  return {
    title: typeof songOrTitle.title === "string" ? songOrTitle.title.trim() : "",
    artist: typeof songOrTitle.artist === "string" ? songOrTitle.artist.trim() : "",
    durationMs: songOrTitle.durationMs,
  };
}

/**
 * Fetch lyrics for a queue song (or for a title, artist, and optional duration).
 * Returns null when LRCLIB has no matching lyrics record.
 */
async function getSongLyrics(songOrTitle, artistName, durationMs) {
  const song = getSongDetails(songOrTitle, artistName, durationMs);

  if (!song.title) {
    throw new TypeError("Song title is required");
  }
  if (!song.artist) {
    throw new TypeError("Song artist is required for an LRCLIB lookup");
  }

  const params = new URLSearchParams({
    track_name: song.title,
    artist_name: song.artist,
  });

  if (Number.isFinite(song.durationMs) && song.durationMs > 0) {
    params.set("duration", String(Math.round(song.durationMs / 1000)));
  }

  const response = await fetch(`${LRCLIB_API_URL}?${params}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const details = await response.text();
    const error = new Error(
      `LRCLIB lyrics lookup failed (${response.status})${details ? `: ${details}` : ""}`,
    );

    if (response.status === 429) {
      error.retryAfter = response.headers.get("retry-after");
    }

    throw error;
  }

  let record;
  try {
    record = await response.json();
  } catch {
    throw new Error("LRCLIB returned invalid JSON");
  }

  const plainLyrics =
    typeof record.plainLyrics === "string" ? record.plainLyrics : null;
  const syncedLyrics =
    typeof record.syncedLyrics === "string" ? record.syncedLyrics : null;

  if (!plainLyrics && !syncedLyrics) {
    return null;
  }

  return {
    title: record.trackName ?? song.title,
    artist: record.artistName ?? song.artist,
    lyrics: plainLyrics || syncedLyrics,
    plainLyrics,
    syncedLyrics,
    instrumental: Boolean(record.instrumental),
  };
}

module.exports = { getSongLyrics };