
const { getValidAccessToken } = require("../utils/spotifyAuth");

// Share recent playback status between the frontend and playback monitor.
const CACHE_MS = 5000;
const QUOTA_COOLDOWN_MS = 15 * 60 * 1000;

const statusCache = new Map();
const pendingRequests = new Map();
const blockedUntil = new Map();

async function getSpotifyPlaybackStatus(hostSpotifyId) {
  const now = Date.now();

  // Avoid repeated Spotify requests while rate-limited.
  const retryAt = blockedUntil.get(hostSpotifyId) ?? 0;

  if (now < retryAt) {
    throw new Error("Spotify API temporarily rate-limited");
  }

  // Reuse a recent response.
  const cached = statusCache.get(hostSpotifyId);

  if (cached && now - cached.timestamp < CACHE_MS) {
    return cached.data;
  }

  // Reuse an ongoing request instead of starting another.
  if (pendingRequests.has(hostSpotifyId)) {
    return pendingRequests.get(hostSpotifyId);
  }

  const request = (async () => {
    const accessToken = await getValidAccessToken(hostSpotifyId);

    const response = await fetch(
      "https://api.spotify.com/v1/me/player",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (response.status === 429) {
      const retryAfter = Number(
        response.headers.get("retry-after")
      );

      const details = await response.text();

      let errorCode = "";

      try {
        const parsed = JSON.parse(details);
        errorCode =
          parsed.error?.reason ??
          parsed.error?.code ??
          parsed.error?.message ??
          "";
      } catch {
        // The response may not contain JSON.
      }

      const quotaExceeded =
        String(errorCode).includes("QUOTA_EXCEEDED") ||
        details.includes("QUOTA_EXCEEDED");

      const cooldownMs = quotaExceeded
        ? QUOTA_COOLDOWN_MS
        : Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : 60 * 1000;

      blockedUntil.set(
        hostSpotifyId,
        Date.now() + cooldownMs
      );

      statusCache.delete(hostSpotifyId);

      console.warn(
        `Spotify API rate limited (${quotaExceeded
          ? "QUOTA_EXCEEDED"
          : "429"}). Status requests blocked for ${Math.ceil(
          cooldownMs / 1000
        )} seconds.`
      );

      throw new Error("Spotify API rate limit exceeded");
    }

    if (response.status === 204) {
      statusCache.set(hostSpotifyId, {
        data: null,
        timestamp: Date.now(),
      });

      return null;
    }

    if (!response.ok) {
      throw new Error(
        `Spotify playback status failed: ${response.status}`
      );
    }

    const data = await response.json();

    const playback = {
      isPlaying: data.is_playing,
      spotifyId: data.item?.id ?? null,
      progressMs: data.progress_ms,
      durationMs: data.item?.duration_ms ?? null,
    };

    statusCache.set(hostSpotifyId, {
      data: playback,
      timestamp: Date.now(),
    });

    return playback;
  })();

  pendingRequests.set(hostSpotifyId, request);

  try {
    return await request;
  } finally {
    pendingRequests.delete(hostSpotifyId);
  }
}

module.exports = { getSpotifyPlaybackStatus };
