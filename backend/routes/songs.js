
const express = require("express");
const mongoose = require("mongoose");
const Room = require("../models/Room");
const Song = require("../models/Song");

const router = express.Router();

// Check whether the user can add songs to this room
function canAddSongs(req, room) {
    const isHost =
        req.session?.spotifyUserId === room.hostSpotifyId;

    const hasJoined =
        req.session?.joinedRoomId === room._id.toString();

    return isHost || hasJoined;
}

// 1. Add a song manually
router.post("/:id/songs", async (req, res) => {
    try {
        const { id } = req.params;
        const {
            spotifyId,
            title,
            artist,
            durationMs,
            imageUrl,
            spotifyUrl
        } = req.body;

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

        if (!canAddSongs(req, room)) {
            return res.status(403).json({
                error: "You must join this room before adding songs"
            });
        }

        if (
            typeof spotifyId !== "string" || !spotifyId.trim() ||
            typeof title !== "string" || !title.trim() ||
            typeof artist !== "string" || !artist.trim() ||
            typeof durationMs !== "number" ||
            !Number.isFinite(durationMs) ||
            durationMs <= 0
        ) {
            return res.status(400).json({
                error: "Invalid song data"
            });
        }

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

// 2. Get all songs in a room
router.get("/:id/songs", async (req, res) => {
    try {
        const { id } = req.params;

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

        const songs = await Song.find({
    roomId: id,
    playedAt: null
}).sort({ addedAt: 1, _id: 1 });

        return res.status(200).json(songs);

    } catch (error) {
        console.error("Error fetching songs:", error);

        return res.status(500).json({
            error: "Failed to fetch songs"
        });
    }
});

// 3. Delete a song (host only)
router.delete("/:id/songs/:songId", async (req, res) => {
    try {
        const { id, songId } = req.params;

        if (
            !mongoose.isValidObjectId(id) ||
            !mongoose.isValidObjectId(songId)
        ) {
            return res.status(400).json({
                error: "Invalid room or song ID"
            });
        }

        const room = await Room.findById(id);

        if (!room) {
            return res.status(404).json({
                error: "Room not found"
            });
        }

        if (
            !req.session?.spotifyUserId ||
            room.hostSpotifyId !== req.session.spotifyUserId
        ) {
            return res.status(403).json({
                error: "Only the room host can remove songs"
            });
        }

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

// 4. Add a song directly from Spotify
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

        if (!canAddSongs(req, room)) {
            return res.status(403).json({
                error: "You must join this room before adding songs"
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

        // Request Spotify app access token
        const tokenResponse = await fetch(
            "https://accounts.spotify.com/api/token",
            {
                method: "POST",
                headers: {
                    "Content-Type":
                        "application/x-www-form-urlencoded",
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

        const tokenData = await tokenResponse.json();

        if (
            typeof tokenData.access_token !== "string" ||
            !tokenData.access_token
        ) {
            return res.status(502).json({
                error: "Invalid Spotify authentication response"
            });
        }

        // Fetch track information from Spotify
        const trackResponse = await fetch(
            `https://api.spotify.com/v1/tracks/${spotifyId}`,
            {
                headers: {
                    Authorization: `Bearer ${tokenData.access_token}`
                }
            }
        );

        if (!trackResponse.ok) {
            return res.status(502).json({
                error: "Could not fetch Spotify track"
            });
        }

        const track = await trackResponse.json();

        if (
            !track ||
            typeof track.id !== "string" ||
            typeof track.name !== "string" ||
            !Array.isArray(track.artists) ||
            !Number.isFinite(track.duration_ms)
        ) {
            return res.status(502).json({
                error: "Invalid Spotify track response"
            });
        }

        const song = await Song.create({
            roomId: id,
            spotifyId: track.id,
            title: track.name,
            artist: track.artists.map(a => a.name).join(", "),
            durationMs: track.duration_ms,
            imageUrl: track.album?.images?.[0]?.url || null,
            spotifyUrl: track.external_urls?.spotify || null
        });

        return res.status(201).json(song);

    } catch (error) {
        console.error("Add Spotify song error:", error);

        return res.status(500).json({
            error: "Failed to add Spotify song"
        });
    }
});


 // 5. Select the next song (host only)
router.post("/:id/songs/next", async (req, res) => {
    try {
        const { id } = req.params;

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
            !req.session?.spotifyUserId ||
            room.hostSpotifyId !== req.session.spotifyUserId
        ) {
            return res.status(403).json({
                error: "Only the host can skip songs"
            });
        }

        // Find the oldest song that has not been played
        const nextSong = await Song.findOne({
            roomId: room._id,
            playedAt: null
        }).sort({ addedAt: 1, _id: 1 });

        if (!nextSong) {
            return res.status(404).json({
                error: "Queue is empty"
            });
        }

        // Mark the song as played
        nextSong.playedAt = new Date();
        await nextSong.save();

        // Save the current song
        room.currentSongId = nextSong._id;
        await room.save();

        return res.status(200).json({
            message: "Next song selected",
            currentSong: nextSong
        });

    } catch (error) {
        console.error("Error selecting next song:", error);

        return res.status(500).json({
            error: "Failed to select next song"
        });
    }
});


 // 6. Get the current song of a room
router.get("/:id/songs/current", async (req, res) => {
    try {
        const { id } = req.params;

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

        if (!room.currentSongId) {
            return res.status(200).json({
                currentSong: null
            });
        }

        const currentSong = await Song.findOne({
            _id: room.currentSongId,
            roomId: room._id
        });

        return res.status(200).json({
            currentSong
        });

    } catch (error) {
        console.error("Error fetching current song:", error);

        return res.status(500).json({
            error: "Failed to fetch current song"
        });
    }
});


module.exports = router;