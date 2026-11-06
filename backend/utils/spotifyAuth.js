
const SpotifyToken = require("../models/SpotifyToken");
const { encrypt, decrypt } = require("./tokenCrypto");

async function getValidAccessToken(spotifyUserId) {
    const tokenDoc = await SpotifyToken.findOne({
        spotifyUserId
    });

    if (!tokenDoc) {
        throw new Error("Spotify user not authenticated");
    }

    // Return existing token if still valid
    // Refresh 60 seconds before expiration
    if (tokenDoc.expiresAt.getTime() > Date.now() + 60000) {
        return decrypt(tokenDoc.accessToken);
    }

    // Refresh expired access token
    const refreshToken = decrypt(tokenDoc.refreshToken);

    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        throw new Error("Spotify configuration missing");
    }

    const response = await fetch(
        "https://accounts.spotify.com/api/token",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                Authorization: "Basic " +
                    Buffer.from(
                        `${clientId}:${clientSecret}`
                    ).toString("base64")
            },
            body: new URLSearchParams({
                grant_type: "refresh_token",
                refresh_token: refreshToken
            })
        }
    );

    if (!response.ok) {
        throw new Error(
            `Spotify token refresh failed: ${response.status}`
        );
    }

    const data = await response.json();

    if (
        typeof data.access_token !== "string" ||
        !Number.isFinite(data.expires_in)
    ) {
        throw new Error("Invalid Spotify token response");
    }

    // Save refreshed tokens
    tokenDoc.accessToken = encrypt(data.access_token);

    // Spotify may return a new refresh token
    if (data.refresh_token) {
        tokenDoc.refreshToken = encrypt(data.refresh_token);
    }

    tokenDoc.expiresAt = new Date(
        Date.now() + data.expires_in * 1000
    );

    await tokenDoc.save();

    return data.access_token;
}

module.exports = { getValidAccessToken };
