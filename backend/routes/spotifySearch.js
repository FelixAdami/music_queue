
const express = require("express");

const router = express.Router();

router.get("/search", async (req, res) => {
    try {
        const q = req.query.q;

        // Validate search query
        if (typeof q !== "string" || !q.trim()) {
            return res.status(400).json({
                error: "Search query is required"
            });
        }

        const clientId = process.env.SPOTIFY_CLIENT_ID;
        const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

        if (!clientId || !clientSecret) {
            return res.status(500).json({
                error: "Spotify configuration missing"
            });
        }

        // Request app access token
        const tokenResponse = await fetch(
            "https://accounts.spotify.com/api/token",
            {
                method: "POST",
                headers: {
                    "Content-Type":
                        "application/x-www-form-urlencoded",
                    Authorization: "Basic " +
                        Buffer.from(
                            `${clientId}:${clientSecret}`
                        ).toString("base64")
                },
                body: new URLSearchParams({
                    grant_type: "client_credentials"
                })
            }
        );

        if (!tokenResponse.ok) {
            return res.status(502).json({
                error: "Failed to authenticate with Spotify"
            });
        }

        const tokenData = await tokenResponse.json();

        // Search tracks
        const searchParams = new URLSearchParams({
            q: q.trim(),
            type: "track",
            limit: "10"
        });

        const searchResponse = await fetch(
            `https://api.spotify.com/v1/search?${searchParams}`,
            {
                headers: {
                    Authorization:
                        `Bearer ${tokenData.access_token}`
                }
            }
        );

        if (!searchResponse.ok) {
            console.error(
                "Spotify search failed:",
                searchResponse.status
            );

            return res.status(502).json({
                error: "Spotify search failed"
            });
        }

        const data = await searchResponse.json();

        const songs = data.tracks.items.map(track => ({
            spotifyId: track.id,
            title: track.name,
            artist: track.artists.map(a => a.name).join(", "),
            durationMs: track.duration_ms,
            imageUrl: track.album.images[0]?.url || null,
            spotifyUrl: track.external_urls.spotify
        }));

        return res.status(200).json(songs);

    } catch (error) {
        console.error("Spotify search error:", error);

        return res.status(500).json({
            error: "Failed to search Spotify"
        });
    }
});

module.exports = router;
