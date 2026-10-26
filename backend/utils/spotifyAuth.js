const SpotifyToken = require("../models/SpotifyToken");
const { encrypt, decrypt } = require("./encryption");

async function getValidAccessToken(spotifyUserId) {
    // 1. Find stored tokens
    const storedToken = await SpotifyToken.findOne({
        spotifyUserId
    });

    if (!storedToken) {
        throw new Error("Spotify user is not connected");
    }

    // 2. Check whether access token is still valid
    const expiresAt = storedToken.expiresAt.getTime();

    if (Date.now() < expiresAt - 60_000) {
        return decrypt(storedToken.accessToken);
    }

    // 3. Access token expired: request a new one
    const credentials = Buffer.from(
        `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
    ).toString("base64");

    const response = await fetch(
        "https://accounts.spotify.com/api/token",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                Authorization: `Basic ${credentials}`
            },
            body: new URLSearchParams({
                grant_type: "refresh_token",
                refresh_token: decrypt(storedToken.refreshToken)
            })
        }
    );

    if (!response.ok) {
        throw new Error(
            `Spotify token refresh failed: ${response.status}`
        );
    }

    const tokens = await response.json();

    // 4. Update access token and expiration time
    const update = {
        accessToken: encrypt(tokens.access_token),
        expiresAt: new Date(
            Date.now() + tokens.expires_in * 1000
        )
    };

    // Spotify may return a new refresh token
    if (tokens.refresh_token) {
        update.refreshToken = encrypt(tokens.refresh_token);
    }

    await SpotifyToken.updateOne(
        { spotifyUserId },
        { $set: update }
    );

    return tokens.access_token;
}

module.exports = { getValidAccessToken };