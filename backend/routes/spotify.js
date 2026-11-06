
const express = require("express");
const crypto = require("crypto");
const SpotifyToken = require("../models/SpotifyToken");
const { encrypt } = require("../utils/tokenCrypto");

const router = express.Router();

router.get("/login", (req, res) => {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const redirectUri = process.env.SPOTIFY_REDIRECT_URI;

    if (!clientId || !redirectUri) {
        return res.status(500).json({
            error: "Spotify configuration missing"
        });
    }

    // Generate random state for OAuth security
    const state = crypto.randomBytes(16).toString("hex");

    // Store state in a short-lived cookie
    res.cookie("spotify_auth_state", state, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 10 * 60 * 1000
    });

    // Spotify permissions
    const scope = [
        "user-read-private",
        "user-read-email"
    ].join(" ");

    const params = new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        scope,
        redirect_uri: redirectUri,
        state
    });

    // Redirect user to Spotify login
    res.redirect(
        `https://accounts.spotify.com/authorize?${params.toString()}`
    );
});


router.get("/callback", async (req, res) => {
    const { code, state, error } = req.query;

    // Check whether Spotify returned an error
    if (error) {
        return res.status(400).json({
            error: "Spotify authorization failed",
            details: error
        });
    }

    // Read the state stored during login
    const cookies = Object.fromEntries(
        (req.headers.cookie || "")
            .split(";")
            .map(cookie => cookie.trim())
            .filter(Boolean)
            .map(cookie => {
                const index = cookie.indexOf("=");
                return [
                    cookie.slice(0, index),
                    cookie.slice(index + 1)
                ];
            })
    );

    const storedState = cookies.spotify_auth_state;

    // Clear state cookie after reading it
    res.clearCookie("spotify_auth_state", {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production"
    });

    // Validate authorization code and state
    if (
        typeof code !== "string" ||
        typeof state !== "string" ||
        typeof storedState !== "string" ||
        !/^[a-f0-9]{32}$/.test(state) ||
        !crypto.timingSafeEqual(
            Buffer.from(state),
            Buffer.from(
                /^[a-f0-9]{32}$/.test(storedState)
                    ? storedState
                    : "0".repeat(32)
            )
        )
    ) {
        return res.status(400).json({
            error: "Invalid authorization code or state"
        });
    }

    try {
        const clientId = process.env.SPOTIFY_CLIENT_ID;
        const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
        const redirectUri = process.env.SPOTIFY_REDIRECT_URI;

        if (!clientId || !clientSecret || !redirectUri) {
            return res.status(500).json({
                error: "Spotify configuration missing"
            });
        }

        // Exchange authorization code for tokens
        const response = await fetch(
            "https://accounts.spotify.com/api/token",
            {
                method: "POST",
                headers: {
                    "Content-Type":
                        "application/x-www-form-urlencoded",
                    "Authorization":
                        "Basic " +
                        Buffer.from(
                            `${clientId}:${clientSecret}`
                        ).toString("base64")
                },
                body: new URLSearchParams({
                    grant_type: "authorization_code",
                    code,
                    redirect_uri: redirectUri
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            console.error(
                "Spotify token exchange failed:",
                response.status,
                data.error
            );

            return res.status(502).json({
                error: "Spotify token exchange failed"
            });
        }

        
// Fetch Spotify user profile
const profileResponse = await fetch(
    "https://api.spotify.com/v1/me",
    {
        headers: {
            Authorization: `Bearer ${data.access_token}`
        }
    }
);

if (!profileResponse.ok) {
    return res.status(502).json({
        error: "Failed to fetch Spotify profile"
    });
}

const profile = await profileResponse.json();

if (
    !profile.id ||
    !data.access_token ||
    !data.refresh_token ||
    !Number.isFinite(data.expires_in)
) {
    return res.status(502).json({
        error: "Incomplete Spotify response"
    });
}

// Encrypt and store tokens
await SpotifyToken.findOneAndUpdate(
    { spotifyUserId: profile.id },
    {
        $set: {
            accessToken: encrypt(data.access_token),
            refreshToken: encrypt(data.refresh_token),
            expiresAt: new Date(
                Date.now() + data.expires_in * 1000
            )
        }
    },
    {
        upsert: true,
        new: true,
        runValidators: true
    }
);


        // Temporary test response - do not expose tokens
        return res.status(200).json({
            message: "Spotify authentication successful",
            accessTokenReceived:
                typeof data.access_token === "string",
            refreshTokenReceived:
                typeof data.refresh_token === "string",
            expiresIn: data.expires_in
        });

    } catch (error) {
        console.error("Spotify callback error:", error);

        return res.status(500).json({
            error: "Spotify callback failed"
        });
    }
});


module.exports = router;
