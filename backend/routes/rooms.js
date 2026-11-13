
const express = require("express");
const mongoose = require("mongoose");
const Room = require("../models/Room");
const Song = require("../models/Song");
const {
  getSpotifyPlaybackStatus,
} = require("../services/spotifyPlayback");

const router = express.Router();

// Middleware: Require Spotify authentication
function requireSpotifyAuth(req, res, next) {
  if (!req.session?.spotifyUserId) {
    return res.status(401).json({
      error: "Spotify authentication required",
    });
  }

  next();
}

// Middleware: Require room host
async function requireRoomHost(req, res, next) {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        error: "Invalid room ID",
      });
    }

    const room = await Room.findById(id);

    if (!room) {
      return res.status(404).json({
        error: "Room not found",
      });
    }

    if (room.hostSpotifyId !== req.session?.spotifyUserId) {
      return res.status(403).json({
        error: "Only the room host can perform this action",
      });
    }

    req.room = room;
    next();
  } catch (error) {
    console.error("Room authorization error:", error);

    return res.status(500).json({
      error: "Failed to verify room host",
    });
  }
}

// 1. Create a new room
router.post("/", requireSpotifyAuth, async (req, res) => {
  try {
    const { name } = req.body;

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        error: "Room name is required",
      });
    }

    const room = await Room.create({
      name: name.trim(),
      hostSpotifyId: req.session.spotifyUserId,
    });

    return res.status(201).json(room);
  } catch (error) {
    console.error("Error creating room:", error);

    return res.status(500).json({
      error: "Failed to create room",
    });
  }
});

// 2. Get room by ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        error: "Invalid room ID",
      });
    }

    const room = await Room.findById(id);

    if (!room) {
      return res.status(404).json({
        error: "Room not found",
      });
    }

    return res.status(200).json(room);
  } catch (error) {
    console.error("Error fetching room:", error);

    return res.status(500).json({
      error: "Failed to fetch room",
    });
  }
});

// 3. Join a room as a guest
router.post("/:id/join", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        error: "Invalid room ID",
      });
    }

    const room = await Room.findById(id);

    if (!room) {
      return res.status(404).json({
        error: "Room not found",
      });
    }

    if (!req.session) {
      return res.status(500).json({
        error: "Session unavailable",
      });
    }

    req.session.joinedRoomId = room._id.toString();

    await new Promise((resolve, reject) => {
      req.session.save((error) => {
        if (error) {
          return reject(error);
        }

        resolve();
      });
    });

    return res.status(200).json({
      roomId: room._id,
      roomName: room.name,
    });
  } catch (error) {
    console.error("Error joining room:", error);

    return res.status(500).json({
      error: "Failed to join room",
    });
  }
});

// 4. Check whether user is room host
router.get(
  "/:id/host",
  requireSpotifyAuth,
  requireRoomHost,
  (req, res) => {
    return res.status(200).json({
      isHost: true,
      roomId: req.room._id,
      roomName: req.room.name,
    });
  }
);

// 5. Get actual Spotify playback status
router.get(
  "/:id/playback/status",
  requireSpotifyAuth,
  requireRoomHost,
  async (req, res) => {
    try {
      const room = req.room;

      const playback = await getSpotifyPlaybackStatus(
        room.hostSpotifyId
      );

      const isCurrentTrack = Boolean(
        room.currentSongId &&
        room.lastSpotifyTrackId &&
        playback?.spotifyId === room.lastSpotifyTrackId
      );

      return res.status(200).json({
        hasCurrentSong: Boolean(room.currentSongId),
        isCurrentTrack,
        isPlaying: Boolean(
          isCurrentTrack && playback?.isPlaying
        ),
        isPaused: Boolean(
          isCurrentTrack && !playback?.isPlaying
        ),
        hasActiveDevice: playback !== null,
        spotifyId: playback?.spotifyId ?? null,
      });
    } catch (error) {
      console.error("Playback status error:", error);

      return res.status(502).json({
        error: "Could not retrieve Spotify playback status",
      });
    }
  }
);

// 6. End session (host only)
router.delete(
  "/:id",
  requireSpotifyAuth,
  requireRoomHost,
  async (req, res) => {
    try {
      const roomId = req.room._id;

      // Remove the room first so it is no longer monitored
      // and no new songs can be added to it.
      await Room.deleteOne({
        _id: roomId,
        hostSpotifyId: req.session.spotifyUserId,
      });

      // Remove all songs belonging to this room.
      await Song.deleteMany({ roomId });

      return res.status(200).json({
        message: "Session ended successfully",
      });
    } catch (error) {
      console.error("End session error:", error);

      return res.status(500).json({
        error: "Failed to end session",
      });
    }
  }
);

module.exports = router;
