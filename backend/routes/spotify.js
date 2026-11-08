const express = require("express");
const crypto = require("node:crypto");
const SpotifyToken = require("../models/SpotifyToken");
const { encrypt } = require("../utils/encryption");
const { getValidAccessToken } = require("../utils/spotifyAuth");

const router = express.Router();

function getFrontendUrl(path) {
  const frontendOrigin = (
    process.env.FRONTEND_URL ||
    process.env.FRONTEND_ORIGINS ||
    "http://localhost:5173"
  )
    .split(",")[0]
    .trim();

  return new URL(path, frontendOrigin).toString();
}

// 1. Redirect user to Spotify login
router.get("/login", (req, res) => {
  const state = crypto.randomBytes(16).toString("hex");

  // Save state in a cookie for CSRF protection
  res.cookie("spotify_auth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 10 * 60 * 1000,
  });

  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.SPOTIFY_CLIENT_ID,
    scope:
      "streaming user-read-private user-read-email user-read-playback-state user-modify-playback-state",
    redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
    state: state,
  });

  res.redirect(`https://accounts.spotify.com/authorize?${params.toString()}`);
});

// 2. Handle Spotify authorization callback
router.get("/callback", async (req, res) => {
  const { code, state, error } = req.query;

  // Read state from cookie
  const cookies = Object.fromEntries(
    (req.headers.cookie || "")
      .split(";")
      .map((cookie) => cookie.trim().split("="))
      .filter((parts) => parts.length === 2),
  );

  const savedState = cookies.spotify_auth_state;

  // Delete state cookie after use
  res.clearCookie("spotify_auth_state", {
    httpOnly: true,
    sameSite: "lax",
  });

  // Verify state to prevent CSRF attacks
  if (!savedState || typeof state !== "string" || state !== savedState) {
    return res.status(400).send("Invalid authorization state");
  }

  // Handle denied or failed Spotify authorization
  if (error) {
    console.warn("Spotify authorization denied or failed:", error);
    return res.redirect(getFrontendUrl("/host?spotify=denied"));
  }

  if (typeof code !== "string") {
    return res.status(400).send("Authorization code missing");
  }

  try {
    // 3. Exchange authorization code for tokens
    const credentials = Buffer.from(
      `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`,
    ).toString("base64");

    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: code,
        redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
      }),
    });

    if (!response.ok) {
      console.error("Spotify token request failed:", response.status);

      return res.status(502).send("Spotify token request failed");
    }

    const tokens = await response.json();

    // Validate tokens before using or storing them
    if (
      typeof tokens.access_token !== "string" ||
      !tokens.access_token ||
      typeof tokens.refresh_token !== "string" ||
      !tokens.refresh_token ||
      !Number.isFinite(tokens.expires_in) ||
      tokens.expires_in <= 0
    ) {
      console.error("Spotify returned an invalid token response");

      return res.status(502).send("Invalid Spotify token response");
    }

    // 4. Fetch Spotify user information
    const userResponse = await fetch("https://api.spotify.com/v1/me", {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    if (!userResponse.ok) {
      console.error("Failed to fetch Spotify user:", userResponse.status);

      return res.status(502).send("Failed to fetch Spotify user");
    }

    const spotifyUser = await userResponse.json();

    console.log("Spotify user ID:", spotifyUser.id);

    // 5. Calculate access token expiration
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    // 6. Encrypt and save tokens in MongoDB
    await SpotifyToken.findOneAndUpdate(
      { spotifyUserId: spotifyUser.id },
      {
        $set: {
          accessToken: encrypt(tokens.access_token),
          refreshToken: encrypt(tokens.refresh_token),
          expiresAt: expiresAt,
        },
      },
      {
        upsert: true,
        returnDocument: "after",
        runValidators: true,
      },
    );

    console.log("Spotify tokens saved successfully");

    // 7. Regenerate session after successful authentication
    await new Promise((resolve, reject) => {
      req.session.regenerate((error) => {
        if (error) {
          return reject(error);
        }
        resolve();
      });
    });

    // Store the authenticated Spotify user
    req.session.spotifyUserId = spotifyUser.id;

    // Save the new session before redirecting
    await new Promise((resolve, reject) => {
      req.session.save((error) => {
        if (error) {
          return reject(error);
        }
        resolve();
      });
    });

    console.log("Spotify user session saved successfully");

    console.log("Spotify authorization successful", {
      accessTokenReceived: Boolean(tokens.access_token),
      refreshTokenReceived: Boolean(tokens.refresh_token),
    });

    return res.redirect(getFrontendUrl("/host?spotify=connected"));
  } catch (error) {
    console.error("Spotify authorization error:", error.message);

    return res.status(500).send("Authorization failed");
  }
});

// 8. Get currently authenticated Spotify user
router.get("/me", async (req, res) => {
  // Check if the user has a Spotify session
  if (!req.session?.spotifyUserId) {
    return res.status(401).json({
      error: "Not authenticated with Spotify",
    });
  }

  try {
    const spotifyUserId = req.session.spotifyUserId;

    // Get valid access token (refresh automatically if expired)
    const accessToken = await getValidAccessToken(spotifyUserId);

    // Fetch user information from Spotify
    const response = await fetch("https://api.spotify.com/v1/me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: "Failed to fetch Spotify user",
      });
    }

    const user = await response.json();

    // Return only the information needed by the frontend
    return res.json({
      id: user.id,
      displayName: user.display_name,
      image: user.images?.[0]?.url || null,
    });
  } catch (error) {
    console.error("Spotify /me error:", error.message);

    return res.status(500).json({
      error: "Failed to retrieve Spotify user",
    });
  }
});

router.get("/devices", async (req, res) => {
  if (!req.session?.spotifyUserId) {
    return res.status(401).json({
      error: "Spotify login required",
    });
  }

  try {
    const accessToken = await getValidAccessToken(req.session.spotifyUserId);

    const response = await fetch(
      "https://api.spotify.com/v1/me/player/devices",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      return res.status(response.status).json({
        error: "Failed to fetch Spotify devices",
      });
    }

    const data = await response.json();

    return res.json({
      devices: data.devices,
    });
  } catch (error) {
    console.error("Spotify devices error:", error);

    return res.status(500).json({
      error: "Could not retrieve Spotify devices",
    });
  }
});

router.put("/play", async (req, res) => {
  if (!req.session?.spotifyUserId) {
    return res.status(401).json({
      error: "Spotify login required",
    });
  }

  const { spotifyId } = req.body;

  if (typeof spotifyId !== "string" || !/^[a-zA-Z0-9]{22}$/.test(spotifyId)) {
    return res.status(400).json({
      error: "Valid Spotify track ID required",
    });
  }

  try {
    const accessToken = await getValidAccessToken(req.session.spotifyUserId);

    const response = await fetch("https://api.spotify.com/v1/me/player/play", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        uris: [`spotify:track:${spotifyId}`],
      }),
    });

    if (!response.ok) {
      const details = await response.text();
      console.error("Spotify playback error:", response.status, details);

      return res.status(response.status).json({
        error: "Spotify could not start playback",
      });
    }

    return res.json({
      message: "Playback started",
    });
  } catch (error) {
    console.error("Spotify play error:", error);

    return res.status(500).json({
      error: "Failed to start playback",
    });
  }
});

router.put("/pause", async (req, res) => {
  if (!req.session?.spotifyUserId) {
    return res.status(401).json({
      error: "Spotify login required",
    });
  }

  try {
    const accessToken = await getValidAccessToken(req.session.spotifyUserId);

    const response = await fetch("https://api.spotify.com/v1/me/player/pause", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const details = await response.text();

      console.error("Spotify pause error:", response.status, details);

      return res.status(response.status).json({
        error: "Could not pause Spotify playback",
      });
    }

    return res.json({
      message: "Playback paused",
    });
  } catch (error) {
    console.error("Spotify pause error:", error);

    return res.status(500).json({
      error: "Failed to pause playback",
    });
  }
});

router.put("/resume", async (req, res) => {
  if (!req.session?.spotifyUserId) {
    return res.status(401).json({
      error: "Spotify login required",
    });
  }

  try {
    const accessToken = await getValidAccessToken(req.session.spotifyUserId);

    const response = await fetch("https://api.spotify.com/v1/me/player/play", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const details = await response.text();

      console.error("Spotify resume error:", response.status, details);

      return res.status(response.status).json({
        error: "Could not resume Spotify playback",
      });
    }

    return res.json({
      message: "Playback resumed",
    });
  } catch (error) {
    console.error("Spotify resume error:", error);

    return res.status(500).json({
      error: "Failed to resume playback",
    });
  }
});

router.get("/playback/status", async (req, res) => {
  try {
    const spotifyUserId = req.session?.spotifyUserId;

    if (!spotifyUserId) {
      return res.status(401).json({
        error: "Not logged in with Spotify",
      });
    }

    const accessToken = await getValidAccessToken(spotifyUserId);

    const response = await fetch("https://api.spotify.com/v1/me/player", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (response.status === 204) {
      return res.json({
        isPlaying: false,
        track: null,
      });
    }

    if (!response.ok) {
      return res.status(502).json({
        error: "Could not get Spotify playback status",
      });
    }

    const data = await response.json();

    return res.json({
      isPlaying: data.is_playing,
      progressMs: data.progress_ms,
      durationMs: data.item?.duration_ms ?? null,
      track: data.item
        ? {
            spotifyId: data.item.id,
            title: data.item.name,
            artist: data.item.artists.map((artist) => artist.name).join(", "),
          }
        : null,
    });
  } catch (error) {
    console.error("Playback status error:", error);
    return res.status(500).json({
      error: "Failed to get playback status",
    });
  }
});

module.exports = router;
