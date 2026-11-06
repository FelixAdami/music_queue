
const express = require("express");
const mongoose = require("mongoose");
const Room = require("../models/Room");
const Song = require("../models/Song");

const router = express.Router();

router.post("/:id/songs", async (req, res) => {
    try {
        const { id } = req.params;
        const { spotifyId, title, artist, durationMs,
                imageUrl, spotifyUrl } = req.body;

        // Validate room ID
        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                error: "Invalid room ID"
            });
        }

        // Check if room exists
        const room = await Room.findById(id);

        if (!room) {
            return res.status(404).json({
                error: "Room not found"
            });
        }

        // Validate song data
        if (
            typeof spotifyId !== "string" || !spotifyId.trim() ||
            typeof title !== "string" || !title.trim() ||
            typeof artist !== "string" || !artist.trim() ||
            typeof durationMs !== "number" ||
            !Number.isFinite(durationMs) || durationMs <= 0
        ) {
            return res.status(400).json({
                error: "Invalid song data"
            });
        }

        // Save song in MongoDB
        const song = await Song.create({
            roomId: id,
            spotifyId: spotifyId.trim(),
            title: title.trim(),
            artist: artist.trim(),
            durationMs,
            imageUrl,
            spotifyUrl
        });

        return res.status(201).json(song);

    } catch (error) {
        console.error("Error adding song:", error);

        return res.status(500).json({
            error: "Failed to add song"
        });
    }
});


router.get("/:id/songs", async (req, res) => {
    try {
        const { id } = req.params;

        // Validate room ID
        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                error: "Invalid room ID"
            });
        }

        // Check if room exists
        const room = await Room.findById(id);

        if (!room) {
            return res.status(404).json({
                error: "Room not found"
            });
        }

        // Find all songs belonging to this room
        const songs = await Song.find({ roomId: id })
            .sort({ addedAt: 1, _id: 1 });

        return res.status(200).json(songs);

    } catch (error) {
        console.error("Error fetching songs:", error);

        return res.status(500).json({
            error: "Failed to fetch songs"
        });
    }
});



router.delete("/:id/songs/:songId", async (req, res) => {
    try {
        const { id, songId } = req.params;

        // Validate IDs
        if (
            !mongoose.isValidObjectId(id) ||
            !mongoose.isValidObjectId(songId)
        ) {
            return res.status(400).json({
                error: "Invalid room or song ID"
            });
        }

        // Check if room exists
        const room = await Room.findById(id);

        if (!room) {
            return res.status(404).json({
                error: "Room not found"
            });
        }

        // Delete song only if it belongs to this room
        const deletedSong = await Song.findOneAndDelete({
            _id: songId,
            roomId: id
        });

        if (!deletedSong) {
            return res.status(404).json({
                error: "Song not found in this room"
            });
        }

        return res.status(200).json({
            message: "Song removed successfully",
            song: deletedSong
        });

    } catch (error) {
        console.error("Error deleting song:", error);

        return res.status(500).json({
            error: "Failed to delete song"
        });
    }
});


router.post("/:id/songs/from-spotify", async (req, res) => {
    try {
        const { id } = req.params;
        const { spotifyId } = req.body;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                error: "Invalid room ID"
            });
        }

        const room = await Room.findById(id);

        if (!room) {
            return res.status(404).json({
                error: "Room not found"
            });
        }

        if (
            typeof spotifyId !== "string" ||
            !/^[A-Za-z0-9]{22}$/.test(spotifyId)
        ) {
            return res.status(400).json({
                error: "Invalid Spotify track ID"
            });
        }

        // Get Spotify app token
        const tokenResponse = await fetch(
            "https://accounts.spotify.com/api/token",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    Authorization: "Basic " +
                        Buffer.from(
                            `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
                        ).toString("base64")
                },
                body: new URLSearchParams({
                    grant_type: "client_credentials"
                })
            }
        );

        if (!tokenResponse.ok) {
            return res.status(502).json({
                error: "Spotify authentication failed"
            });
        }

        const { access_token } = await tokenResponse.json();

        // Fetch actual track information
        const trackResponse = await fetch(
            `https://api.spotify.com/v1/tracks/${spotifyId}`,
            {
                headers: {
                    Authorization: `Bearer ${access_token}`
                }
            }
        );

        if (!trackResponse.ok) {
            return res.status(502).json({
                error: "Could not fetch Spotify track"
            });
        }

        const track = await trackResponse.json();

        const song = await Song.create({
            roomId: id,
            spotifyId: track.id,
            title: track.name,
            artist: track.artists.map(a => a.name).join(", "),
            durationMs: track.duration_ms,
            imageUrl: track.album.images[0]?.url || null,
            spotifyUrl: track.external_urls.spotify
        });

        return res.status(201).json(song);

    } catch (error) {
        console.error("Add Spotify song error:", error);

        return res.status(500).json({
            error: "Failed to add Spotify song"
        });
    }
});



module.exports = router;
