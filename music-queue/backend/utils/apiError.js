
const { SpotifyAuthError } = require("./spotifyAuth");

// Send a consistent, safe error response to the frontend
function sendApiError(res, error, fallbackMessage) {
  if (error instanceof SpotifyAuthError) {
    console.error("Spotify authentication error:", {
      code: error.code,
      message: error.message,
    });

    const messages = {
      NOT_AUTHENTICATED:
        "Please log in with Spotify.",

      SPOTIFY_NOT_CONNECTED:
        "Spotify account is not connected. Please reconnect.",

      TOKEN_MISSING:
        "Spotify authentication data is missing. Please reconnect.",

      TOKEN_DECRYPTION_FAILED:
        "Stored Spotify credentials could not be decrypted. Contact the administrator.",

      ENCRYPTION_CONFIG_ERROR:
        "Spotify encryption configuration is invalid. Contact the administrator.",

      INVALID_TOKEN_EXPIRATION:
        "Stored Spotify authentication data is invalid.",

      SPOTIFY_CONFIG_ERROR:
        "Spotify authentication is not configured correctly.",

      SPOTIFY_REFRESH_REJECTED:
        "Spotify authorization expired or was rejected. Please reconnect.",

      SPOTIFY_NETWORK_ERROR:
        "Spotify authentication service is temporarily unavailable.",

      SPOTIFY_REFRESH_FAILED:
        "Spotify could not refresh authentication.",

      INVALID_SPOTIFY_RESPONSE:
        "Spotify returned an invalid authentication response.",

      TOKEN_ENCRYPTION_FAILED:
        "Spotify credentials could not be stored securely.",
    };

    return res.status(error.status).json({
      error: messages[error.code] || "Spotify authentication failed.",
      code: error.code,
    });
  }

  // Do not expose unexpected internal errors or secrets
  console.error("API error:", error);

  return res.status(500).json({
    error: fallbackMessage,
    code: "INTERNAL_ERROR",
  });
}

module.exports = { sendApiError };
