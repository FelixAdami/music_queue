const baseUrl = (process.env.GENRE_SERVICE_URL || "http://127.0.0.1:3001").replace(/\/+$/, "");
const REQUEST_TIMEOUT_MS = 120_000;

class GenreServiceError extends Error {
  constructor(message, statusCode = 502, code = "GENRE_SERVICE_UNAVAILABLE") {
    super(message);
    this.name = "GenreServiceError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

async function getSongGenre(song) {
  const payload = {
    title: typeof song?.title === "string" ? song.title.trim() : "",
    artist: typeof song?.artist === "string" ? song.artist.trim() : "",
    ...(Number.isFinite(song?.durationMs)
      ? { durationMs: song.durationMs }
      : {}),
  };

  let response;
  try {
    response = await fetch(`${baseUrl}/api/v1/genre/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new GenreServiceError("Genre analysis service is unavailable");
  }

  let result;
  try {
    result = await response.json();
  } catch {
    throw new GenreServiceError(
      "Genre analysis service returned an invalid response",
    );
  }

  if (response.status === 404 && result?.code === "LYRICS_NOT_FOUND") {
    return null;
  }
  if (!response.ok) {
    throw new GenreServiceError(
      "Genre analysis service is unavailable",
      502,
      typeof result?.code === "string" ? result.code : "GENRE_SERVICE_FAILURE",
    );
  }
  if (
    !result ||
    !Array.isArray(result.genres) ||
    !result.genres.every((item) => typeof item === "string") ||
    !Array.isArray(result.themes) ||
    !result.themes.every((item) => typeof item === "string")
  ) {
    throw new GenreServiceError("Genre analysis service returned an invalid response");
  }

  return { genres: result.genres, themes: result.themes };
}

module.exports = { getSongGenre, GenreServiceError };
