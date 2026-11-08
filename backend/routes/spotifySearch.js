const express = require("express");

const router = express.Router();

// Cache the app access token in memory
let cachedAccessToken = null;
let tokenExpiresAt = 0;

async function getAppAccessToken() {
  // Reuse the token if it is still valid
  if (cachedAccessToken && Date.now() < tokenExpiresAt) {
    return cachedAccessToken;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Spotify configuration missing");
  }

  const tokenResponse = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " +
        Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error(`Spotify authentication failed: ${tokenResponse.status}`);
  }

  const tokenData = await tokenResponse.json();

  if (
    typeof tokenData.access_token !== "string" ||
    !tokenData.access_token ||
    !Number.isFinite(tokenData.expires_in) ||
    tokenData.expires_in <= 0
  ) {
    throw new Error("Invalid Spotify token response");
  }

  cachedAccessToken = tokenData.access_token;

  // Refresh at least 60 seconds before expiration
  const lifetimeSeconds = Math.max(0, tokenData.expires_in - 60);

  tokenExpiresAt = Date.now() + lifetimeSeconds * 1000;

  return cachedAccessToken;
}

// Search Spotify tracks
router.get("/search", async (req, res) => {
  try {
    const q = req.query.q;

    if (typeof q !== "string" || !q.trim()) {
      return res.status(400).json({
        error: "Search query is required",
      });
    }

    const query = q.trim();

    if (query.length > 200) {
      return res.status(400).json({
        error: "Search query is too long",
      });
    }

    const accessToken = await getAppAccessToken();

    const searchParams = new URLSearchParams({
      q: query,
      type: "track",
      limit: "10",
    });

    const searchResponse = await fetch(
      `https://api.spotify.com/v1/search?${searchParams}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!searchResponse.ok) {
      console.error("Spotify search failed:", searchResponse.status);

      return res.status(502).json({
        error: "Spotify search failed",
      });
    }

    const data = await searchResponse.json();

    if (!Array.isArray(data?.tracks?.items)) {
      return res.status(502).json({
        error: "Invalid Spotify search response",
      });
    }

    const songs = data.tracks.items
      .filter(
        (track) =>
          typeof track?.id === "string" &&
          typeof track?.name === "string" &&
          Array.isArray(track?.artists) &&
          Number.isFinite(track?.duration_ms),
      )
      .map((track) => ({
        spotifyId: track.id,
        title: track.name,
        artist: track.artists
          .map((artist) => artist.name)
          .filter(Boolean)
          .join(", "),
        durationMs: track.duration_ms,
        imageUrl: track.album?.images?.[0]?.url || null,
        spotifyUrl: track.external_urls?.spotify || null,
      }));

    return res.status(200).json(songs);
  } catch (error) {
    console.error("Spotify search error:", error);

    return res.status(502).json({
      error: "Failed to search Spotify",
    });
  }
});

module.exports = router;
