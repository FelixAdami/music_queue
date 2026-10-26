const express = require("express");
const crypto = require("node:crypto");
const SpotifyToken = require("../models/SpotifyToken");
const { encrypt } = require("../utils/encryption");
const { getValidAccessToken } = require("../utils/spotifyAuth");

const router = express.Router();

// 1. Redirect user to Spotify login
router.get("/login", (req, res) => {
    const state = crypto.randomBytes(16).toString("hex");

    // Save state in a cookie for CSRF protection
    res.cookie("spotify_auth_state", state, {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 10 * 60 * 1000
    });

    const params = new URLSearchParams({
        response_type: "code",
        client_id: process.env.SPOTIFY_CLIENT_ID,
        scope: "user-read-private user-read-email",
        redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
        state: state
    });

    res.redirect(
        `https://accounts.spotify.com/authorize?${params.toString()}`
    );
});

// 2. Handle Spotify authorization callback
router.get("/callback", async (req, res) => {
    const { code, state, error } = req.query;

    // Read state from cookie
    const cookies = Object.fromEntries(
        (req.headers.cookie || "")
            .split(";")
            .map(cookie => cookie.trim().split("="))
            .filter(parts => parts.length === 2)
    );

    const savedState = cookies.spotify_auth_state;

    // Delete state cookie after use
    res.clearCookie("spotify_auth_state", {
        httpOnly: true,
        sameSite: "lax"
    });

    // Verify state to prevent CSRF attacks
    if (
        !savedState ||
        typeof state !== "string" ||
        state !== savedState
    ) {
        return res.status(400).send("Invalid authorization state");
    }

    if (error) {
        return res.status(400).send("Spotify authorization denied");
    }

    if (typeof code !== "string") {
        return res.status(400).send("Authorization code missing");
    }

    try {
        // 3. Exchange authorization code for tokens
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
                    grant_type: "authorization_code",
                    code: code,
                    redirect_uri: process.env.SPOTIFY_REDIRECT_URI
                })
            }
        );

        if (!response.ok) {
            console.error(
                "Spotify token request failed:",
                response.status
            );

            return res.status(502).send(
                "Spotify token request failed"
            );
        }

        const tokens = await response.json();

        // 4. Fetch Spotify user information
        const userResponse = await fetch(
            "https://api.spotify.com/v1/me",
            {
                headers: {
                    Authorization: `Bearer ${tokens.access_token}`
                }
            }
        );

        if (!userResponse.ok) {
            console.error(
                "Failed to fetch Spotify user:",
                userResponse.status
            );

            return res.status(502).send(
                "Failed to fetch Spotify user"
            );
        }

        const spotifyUser = await userResponse.json();

        console.log("Spotify user ID:", spotifyUser.id);

        // 5. Calculate access token expiration
        const expiresAt = new Date(
            Date.now() + tokens.expires_in * 1000
        );

        // 6. Encrypt and save tokens in MongoDB
        await SpotifyToken.findOneAndUpdate(
            { spotifyUserId: spotifyUser.id },
            {
                $set: {
                    accessToken: encrypt(tokens.access_token),
                    refreshToken: encrypt(tokens.refresh_token),
                    expiresAt: expiresAt
                }
            },
            {
                upsert: true,
                returnDocument: "after",
                runValidators: true
            }
        );

        console.log("Spotify tokens saved successfully");

        // 7. Save Spotify user ID in the session
        req.session.spotifyUserId = spotifyUser.id;

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
            refreshTokenReceived: Boolean(tokens.refresh_token)
        });

        return res.send("Spotify authorization successful!");

    } catch (error) {
        console.error(
            "Spotify authorization error:",
            error.message
        );

        return res.status(500).send(
            "Authorization failed"
        );
    }
});

// 8. Get currently authenticated Spotify user
router.get("/me", async (req, res) => {

    // Check if the user has a Spotify session
    if (!req.session?.spotifyUserId) {
        return res.status(401).json({
            error: "Not authenticated with Spotify"
        });
    }

    try {
        const spotifyUserId = req.session.spotifyUserId;

        // Get valid access token (refresh automatically if expired)
        const accessToken = await getValidAccessToken(spotifyUserId);

        // Fetch user information from Spotify
        const response = await fetch(
            "https://api.spotify.com/v1/me",
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            }
        );

        if (!response.ok) {
            return res.status(response.status).json({
                error: "Failed to fetch Spotify user"
            });
        }

        const user = await response.json();

        // Return only the information needed by the frontend
        return res.json({
            id: user.id,
            displayName: user.display_name,
            image: user.images?.[0]?.url || null
        });

    } catch (error) {
        console.error("Spotify /me error:", error.message);

        return res.status(500).json({
            error: "Failed to retrieve Spotify user"
        });
    }
});

module.exports = router;