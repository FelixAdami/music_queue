
const SpotifyToken = require("../models/SpotifyToken");
const { encrypt, decrypt } = require("./encryption");

class SpotifyAuthError extends Error {
  constructor(code, message, status = 500) {
    super(message);
    this.name = "SpotifyAuthError";
    this.code = code;
    this.status = status;
  }
}

// Decrypt a stored token and provide a clear error if it fails
function decryptSpotifyToken(encryptedToken, tokenType) {
  if (typeof encryptedToken !== "string" || !encryptedToken) {
    throw new SpotifyAuthError(
      "TOKEN_MISSING",
      `Stored Spotify ${tokenType} token is missing`,
      401
    );
  }

  try {
    return decrypt(encryptedToken);
  } catch (error) {
    if (error.message === "Invalid TOKEN_ENCRYPTION_KEY") {
      throw new SpotifyAuthError(
        "ENCRYPTION_CONFIG_ERROR",
        "TOKEN_ENCRYPTION_KEY is missing or invalid",
        500
      );
    }

    throw new SpotifyAuthError(
      "TOKEN_DECRYPTION_FAILED",
      "Could not decrypt stored Spotify token. Check whether the encryption key matches the key used to encrypt it.",
      500
    );
  }
}

async function getValidAccessToken(spotifyUserId) {
  // 1. Check Spotify user ID
  if (!spotifyUserId) {
    throw new SpotifyAuthError(
      "NOT_AUTHENTICATED",
      "Spotify login required",
      401
    );
  }

  // 2. Find stored tokens
  const storedToken = await SpotifyToken.findOne({
    spotifyUserId,
  });

  if (!storedToken) {
    throw new SpotifyAuthError(
      "SPOTIFY_NOT_CONNECTED",
      "Spotify account is not connected. Please log in again.",
      401
    );
  }

  // 3. Validate token expiration
  if (
    !storedToken.expiresAt ||
    !Number.isFinite(storedToken.expiresAt.getTime())
  ) {
    throw new SpotifyAuthError(
      "INVALID_TOKEN_EXPIRATION",
      "Stored Spotify token has an invalid expiration",
      500
    );
  }

  const expiresAt = storedToken.expiresAt.getTime();

  // 4. Return existing access token if still valid
  if (Date.now() < expiresAt - 60_000) {
    return decryptSpotifyToken(
      storedToken.accessToken,
      "access"
    );
  }

  // 5. Decrypt refresh token
  const refreshToken = decryptSpotifyToken(
    storedToken.refreshToken,
    "refresh"
  );

  // 6. Check Spotify OAuth configuration
  if (
    !process.env.SPOTIFY_CLIENT_ID ||
    !process.env.SPOTIFY_CLIENT_SECRET
  ) {
    throw new SpotifyAuthError(
      "SPOTIFY_CONFIG_ERROR",
      "Spotify client ID or client secret is missing",
      500
    );
  }

  // 7. Request a new access token
  const credentials = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString("base64");

  let response;

  try {
    response = await fetch(
      "https://accounts.spotify.com/api/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${credentials}`,
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
        }),
      }
    );
  } catch (error) {
    throw new SpotifyAuthError(
      "SPOTIFY_NETWORK_ERROR",
      "Could not connect to Spotify authentication service",
      503
    );
  }

  if (!response.ok) {
    if (response.status === 400 || response.status === 401) {
      throw new SpotifyAuthError(
        "SPOTIFY_REFRESH_REJECTED",
        "Spotify rejected the token refresh. The user may need to reconnect their Spotify account.",
        401
      );
    }

    throw new SpotifyAuthError(
      "SPOTIFY_REFRESH_FAILED",
      `Spotify token refresh failed (${response.status})`,
      502
    );
  }

  // 8. Validate Spotify token response
  let tokens;

  try {
    tokens = await response.json();
  } catch (error) {
    throw new SpotifyAuthError(
      "INVALID_SPOTIFY_RESPONSE",
      "Spotify returned an invalid token response",
      502
    );
  }

  if (
    typeof tokens.access_token !== "string" ||
    !tokens.access_token ||
    !Number.isFinite(tokens.expires_in) ||
    tokens.expires_in <= 0
  ) {
    throw new SpotifyAuthError(
      "INVALID_SPOTIFY_RESPONSE",
      "Spotify returned an invalid token response",
      502
    );
  }

  // 9. Encrypt refreshed tokens
  let encryptedAccessToken;
  let encryptedRefreshToken;

  try {
    encryptedAccessToken = encrypt(tokens.access_token);

    if (tokens.refresh_token) {
      encryptedRefreshToken = encrypt(tokens.refresh_token);
    }
  } catch (error) {
    throw new SpotifyAuthError(
      "TOKEN_ENCRYPTION_FAILED",
      "Could not encrypt refreshed Spotify tokens",
      500
    );
  }

  // 10. Update stored tokens
  const update = {
    accessToken: encryptedAccessToken,
    expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
  };

  if (encryptedRefreshToken) {
    update.refreshToken = encryptedRefreshToken;
  }

  await SpotifyToken.updateOne(
    { spotifyUserId },
    { $set: update }
  );

  return tokens.access_token;
}

module.exports = {
  getValidAccessToken,
  SpotifyAuthError,
};

