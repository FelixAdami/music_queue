const express = require("express");
const mongoose = require("mongoose");
const crypto = require("node:crypto");
const Room = require("../models/Room");
const Song = require("../models/Song");
const { getValidAccessToken } = require("../utils/spotifyAuth");
const { playNextSong } = require("../services/queuePlayback");
const { sendApiError } = require("../utils/apiError");
const { getSongGenre } = require("../services/genreClient");

const router = express.Router();

// Check whether the user can add songs to this room
function canAddSongs(req, room) {
  const isHost = req.session?.spotifyUserId === room.hostSpotifyId;

  const hasJoined = req.session?.joinedRoomId === room._id.toString();

  return isHost || hasJoined;
}

function isRoomHost(req, room) {
  return Boolean(
    req.session?.spotifyUserId &&
    req.session.spotifyUserId === room.hostSpotifyId,
  );
}

// Generate a protected requester identifier
function getRequesterId(req, room) {
  const identity = isRoomHost(req, room)
    ? `host:${req.session.spotifyUserId}`
    : `guest:${req.sessionID}`;

  return crypto
    .createHmac("sha256", process.env.SESSION_SECRET)
    .update(`${room._id}:${identity}`)
    .digest("hex");
}

// Smart Queue: move an existing song two positions forward
async function prioritizeSong(req, res, room, existingSong) {
  if (!room.smartQueueEnabled || isRoomHost(req, room)) {
    return res.status(409).json({
      error: "This song is already in the queue",
      code: "DUPLICATE_SONG",
    });
  }

  const requesterId = getRequesterId(req, room);

  const genreFilter =
    room.allowedGenres.length > 0
      ? { allowedGenres: { $in: room.allowedGenres } }
      : {};

  let updatedSong;

  await mongoose.connection.transaction(async (session) => {
    updatedSong = null;

    const currentRoom = await Room.findById(room._id).session(session);

    if (!currentRoom) return;

    // Get the current queue in playback order
    const songs = await Song.find({
      roomId: room._id,
      playedAt: null,
      _id: { $ne: currentRoom.currentSongId },
      ...genreFilter,
    })
      .sort({ queuePosition: 1, addedAt: 1, _id: 1 })
      .session(session);

    const index = songs.findIndex(
      (song) => song._id.equals(existingSong._id),
    );

    if (index === -1) return;

    // Only accept one request per guest and song
    updatedSong = await Song.findOneAndUpdate(
      {
        _id: existingSong._id,
        roomId: room._id,
        playedAt: null,
        requestedBy: { $ne: requesterId },
      },
      {
        $addToSet: { requestedBy: requesterId },
      },
      { new: true, session },
    );

    if (!updatedSong) return;

    // Move the song two positions forward
    const newIndex = Math.max(0, index - 2);

    if (newIndex !== index) {
      const [song] = songs.splice(index, 1);
      songs.splice(newIndex, 0, song);

      const operations = songs.map((song, position) => ({
        updateOne: {
          filter: {
            _id: song._id,
            roomId: room._id,
            playedAt: null,
          },
          update: {
            $set: { queuePosition: position },
          },
        },
      }));

      await Song.bulkWrite(operations, { session });

      updatedSong.queuePosition = newIndex;
    }
  });

  if (!updatedSong) {
    return res.status(409).json({
      error: "Song already requested or no longer available",
      code: "DUPLICATE_SONG",
    });
  }

  const result = updatedSong.toObject();
  delete result.requestedBy;

  return res.status(200).json({
    ...result,
    prioritized: true,
    message: "Song request counted!",
  });
}

// 1. Add a song manually
router.post("/:id/songs", async (req, res) => {
  try {
    const { id } = req.params;
    const { spotifyId, title, artist, durationMs, imageUrl, spotifyUrl } =
      req.body;

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

    if (!canAddSongs(req, room)) {
      return res.status(403).json({
        error: "You must join this room before adding songs",
      });
    }

    if (
      typeof spotifyId !== "string" ||
      !spotifyId.trim() ||
      typeof title !== "string" ||
      !title.trim() ||
      typeof artist !== "string" ||
      !artist.trim() ||
      typeof durationMs !== "number" ||
      !Number.isFinite(durationMs) ||
      durationMs <= 0
    ) {
      return res.status(400).json({
        error: "Invalid song data",
      });
    }

    // Check for duplicate songs in the queue
    const existingSong = await Song.findOne({
      roomId: id,
      spotifyId: spotifyId.trim(),
      playedAt: null,
    });

    if (existingSong) {
      return await prioritizeSong(req, res, room, existingSong);
    }

    let genreAnalysis = null;
    const allowedGenres = room.allowedGenres;

    if (Array.isArray(allowedGenres) && allowedGenres.length > 0) {
      genreAnalysis = await getSongGenre({ title, artist, durationMs });

      if (!genreAnalysis) {
        return res.status(404).json({
          error: "Could not determine song genres and themes",
          code: "LYRICS_NOT_FOUND",
        });
      }
    }

    const song = await Song.create({
      roomId: id,
      requestedBy: [getRequesterId(req, room)],
      spotifyId: spotifyId.trim(),
      title: title.trim(),
      artist: artist.trim(),
      durationMs,
      imageUrl,
      spotifyUrl,
      ...(genreAnalysis ? { allowedGenres: genreAnalysis.genres } : {}),
    });

    const result = song.toObject();
    delete result.requestedBy;

    return res.status(201).json(result);
  } catch (error) {
    console.error("Error adding song:", error);

    return res.status(error.statusCode || 500).json({
      error: error.statusCode
        ? "Genre analysis service unavailable"
        : "Failed to add song",
      ...(error.code ? { code: error.code } : {}),
    });
  }
});

// 2. Get all songs in a room
router.get("/:id/songs", async (req, res) => {
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

    const genreFilter =
      room.allowedGenres.length > 0
        ? { allowedGenres: { $in: room.allowedGenres } }
        : {};

    const songs = await Song.find({
      roomId: id,
      playedAt: null,
      ...genreFilter,
    }).sort({ queuePosition: 1, addedAt: 1, _id: 1 });

    return res.status(200).json(songs);
  } catch (error) {
    console.error("Error fetching songs:", error);

    return res.status(500).json({
      error: "Failed to fetch songs",
    });
  }
});

// 3. Delete a song (host only)
router.delete("/:id/songs/:songId", async (req, res) => {
  try {
    const { id, songId } = req.params;

    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(songId)) {
      return res.status(400).json({
        error: "Invalid room or song ID",
      });
    }

    const room = await Room.findById(id);

    if (!room) {
      return res.status(404).json({
        error: "Room not found",
      });
    }

    if (
      !req.session?.spotifyUserId ||
      room.hostSpotifyId !== req.session.spotifyUserId
    ) {
      return res.status(403).json({
        error: "Only the room host can remove songs",
      });
    }

    const deletedSong = await Song.findOneAndDelete({
      _id: songId,
      roomId: id,
      playedAt: null,
    });

    if (!deletedSong) {
      return res.status(404).json({
        error: "Song not found in this room",
      });
    }

    return res.status(200).json({
      message: "Song removed successfully",
      song: deletedSong,
    });
  } catch (error) {
    console.error("Error deleting song:", error);

    return res.status(500).json({
      error: "Failed to delete song",
    });
  }
});

// Reorder queued songs (host only)
router.patch("/:id/songs/reorder", async (req, res) => {
  try {
    const { id } = req.params;
    const { songIds } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        error: "Invalid room ID",
      });
    }

    if (
      !Array.isArray(songIds) ||
      songIds.length === 0 ||
      !songIds.every(
        (songId) =>
          typeof songId === "string" &&
          mongoose.isValidObjectId(songId),
      ) ||
      new Set(songIds).size !== songIds.length
    ) {
      return res.status(400).json({
        error: "Invalid song order",
      });
    }

    const room = await Room.findById(id);

    if (!room) {
      return res.status(404).json({
        error: "Room not found",
      });
    }

    if (!isRoomHost(req, room)) {
      return res.status(403).json({
        error: "Only the host can reorder songs",
      });
    }

    const genreFilter =
      room.allowedGenres.length > 0
        ? { allowedGenres: { $in: room.allowedGenres } }
        : {};

    const songs = await Song.find({
      roomId: id,
      playedAt: null,
      ...genreFilter,
    });

    const existingIds = new Set(
      songs.map((song) => song._id.toString()),
    );

    if (
      songIds.length !== songs.length ||
      !songIds.every((songId) => existingIds.has(songId))
    ) {
      return res.status(409).json({
        error: "Queue has changed. Please try again.",
      });
    }

    const operations = songIds.map((songId, index) => ({
      updateOne: {
        filter: {
          _id: songId,
          roomId: id,
          playedAt: null,
        },
        update: {
          $set: {
            queuePosition: index,
          },
        },
      },
    }));

    await Song.bulkWrite(operations);

    return res.status(200).json({
      message: "Queue reordered successfully",
    });
  } catch (error) {
    console.error("Error reordering queue:", error);

    return res.status(500).json({
      error: "Failed to reorder queue",
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
        error: "Invalid room ID",
      });
    }

    const room = await Room.findById(id);

    if (!room) {
      return res.status(404).json({
        error: "Room not found",
      });
    }

    if (!canAddSongs(req, room)) {
      return res.status(403).json({
        error: "You must join this room before adding songs",
      });
    }

    if (typeof spotifyId !== "string" || !/^[A-Za-z0-9]{22}$/.test(spotifyId)) {
      return res.status(400).json({
        error: "Invalid Spotify track ID",
      });
    }

    // Check for duplicate songs in the queue
    const existingSong = await Song.findOne({
      roomId: id,
      spotifyId: spotifyId,
      playedAt: null,
    });

    if (existingSong) {
      return await prioritizeSong(req, res, room, existingSong);
    }

    // Request Spotify app access token
    const tokenResponse = await fetch(
      "https://accounts.spotify.com/api/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization:
            "Basic " +
            Buffer.from(
              `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`,
            ).toString("base64"),
        },
        body: new URLSearchParams({
          grant_type: "client_credentials",
        }),
      },
    );

    if (!tokenResponse.ok) {
      return res.status(502).json({
        error: "Spotify authentication failed",
      });
    }

    const tokenData = await tokenResponse.json();

    if (typeof tokenData.access_token !== "string" || !tokenData.access_token) {
      return res.status(502).json({
        error: "Invalid Spotify authentication response",
      });
    }

    // Fetch track information from Spotify
    const trackResponse = await fetch(
      `https://api.spotify.com/v1/tracks/${spotifyId}`,
      {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      },
    );

    if (!trackResponse.ok) {
      return res.status(502).json({
        error: "Could not fetch Spotify track",
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
        error: "Invalid Spotify track response",
      });
    }

    let genreAnalysis = null;
    const allowedGenres = room.allowedGenres;
    const artist = track.artists.map((a) => a.name).join(", ");

    if (Array.isArray(allowedGenres) && allowedGenres.length > 0) {
      genreAnalysis = await getSongGenre({
        title: track.name,
        artist,
        durationMs: track.duration_ms,
      });

      if (!genreAnalysis) {
        return res.status(404).json({
          error: "Could not determine song genres and themes",
          code: "LYRICS_NOT_FOUND",
        });
      }
    }

    const song = await Song.create({
      roomId: id,
      requestedBy: [getRequesterId(req, room)],
      spotifyId: track.id,
      title: track.name,
      artist,
      durationMs: track.duration_ms,
      imageUrl: track.album?.images?.[0]?.url || null,
      spotifyUrl: track.external_urls?.spotify || null,
      ...(genreAnalysis ? { allowedGenres: genreAnalysis.genres } : {}),
    });

    const result = song.toObject();
    delete result.requestedBy;

    return res.status(201).json(result);
  } catch (error) {
    console.error("Add Spotify song error:", error);

    return res.status(error.statusCode || 500).json({
      error: error.statusCode
        ? "Genre analysis service unavailable"
        : "Failed to add Spotify song",
      ...(error.code ? { code: error.code } : {}),
    });
  }
});

router.post("/:id/songs/next", async (req, res) => {
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

    // Only the host can skip songs
    if (!isRoomHost(req, room)) {
      return res.status(403).json({
        error: "Only the host can skip songs",
      });
    }

    // Start the next song using our shared service
    const nextSong = await playNextSong(room);

    if (!nextSong) {
      return res.status(404).json({
        error: "Queue is empty",
      });
    }

    return res.status(200).json({
      message: "Next song selected",
      currentSong: nextSong,
    });
  } catch (error) {
    return sendApiError(res, error, "Failed to select next song");
  }
});

// 6. Get the current song of a room
router.get("/:id/songs/current", async (req, res) => {
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

    if (!room.currentSongId) {
      return res.status(200).json({
        currentSong: null,
      });
    }

    const currentSong = await Song.findOne({
      _id: room.currentSongId,
      roomId: room._id,
    });

    return res.status(200).json({
      currentSong,
    });
  } catch (error) {
    console.error("Error fetching current song:", error);

    return res.status(500).json({
      error: "Failed to fetch current song",
    });
  }
});

router.get("/:id/songs/:songId/genre", async (req, res) => {
  try {
    const { id, songId } = req.params;

    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(songId)) {
      return res.status(400).json({ error: "Invalid room ID" });
    }

    const room = await Room.findById(id);

    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    // Genre analysis is available for any song in this room
    const song = await Song.findOne({
      _id: songId,
      roomId: room._id,
    });

    if (!song) {
      return res.status(404).json({
        error: "Song not found in this room",
      });
    }

    const genre = await getSongGenre(song);

    if (!genre) {
      return res.status(404).json({
        error: "Lyrics are not available for this song",
      });
    }

    return res.status(200).json(genre);
  } catch (error) {
    console.error("Song genre analysis failed:", error);

    return res.status(502).json({
      error: "Could not analyze the song lyrics",
      ...(error.code ? { code: error.code } : {}),
    });
  }
});

router.put("/:id/playback/pause", async (req, res) => {
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

    if (!isRoomHost(req, room)) {
      return res.status(403).json({
        error: "Only the host can pause playback",
      });
    }

    const accessToken = await getValidAccessToken(req.session.spotifyUserId);

    // Get the current playback position before pausing
    const statusResponse = await fetch("https://api.spotify.com/v1/me/player", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    let positionMs = null;

    if (statusResponse.ok) {
      const playback = await statusResponse.json();

      // Only save the position of our current queue song
      if (
        playback.item?.id === room.lastSpotifyTrackId &&
        Number.isFinite(playback.progress_ms)
      ) {
        positionMs = Math.max(0, playback.progress_ms);
      }
    } else if (statusResponse.status !== 204) {
      console.warn(
        "Could not retrieve playback position:",
        statusResponse.status,
      );
    }

    // Pause Spotify playback
    const response = await fetch("https://api.spotify.com/v1/me/player/pause", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      console.error(
        "Spotify pause failed:",
        response.status,
        await response.text(),
      );

      return res.status(502).json({
        error: "Could not pause Spotify playback",
      });
    }

    // Save pause state and last known position
    room.isPaused = true;

    if (positionMs !== null) {
      room.playbackPositionMs = positionMs;
      room.playbackPositionUpdatedAt = new Date();
    }

    await room.save();

    return res.status(200).json({
      message: "Playback paused",
      positionMs: room.playbackPositionMs,
    });
  } catch (error) {
    return sendApiError(res, error, "Failed to pause playback");
  }
});

router.put("/:id/playback/resume", async (req, res) => {
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

    if (!isRoomHost(req, room)) {
      return res.status(403).json({
        error: "Only the host can resume playback",
      });
    }

    // A song must already be selected
    if (!room.currentSongId || !room.lastSpotifyTrackId) {
      return res.status(409).json({
        error: "No current song to resume",
        code: "NO_CURRENT_SONG",
      });
    }

    const accessToken = await getValidAccessToken(req.session.spotifyUserId);

    const {
      findSpotifyDevice,
      transferSpotifyPlayback,
    } = require("../services/spotifyDevices");

    const device = await findSpotifyDevice(room.hostSpotifyId);

    if (!device) {
      return res.status(409).json({
        error: "No Spotify device available. Open Spotify and try again.",
        code: "NO_SPOTIFY_DEVICE",
      });
    }

    // Check what Spotify is currently playing
    const statusResponse = await fetch("https://api.spotify.com/v1/me/player", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    let playback = null;

    if (statusResponse.ok) {
      playback = await statusResponse.json();
    } else if (statusResponse.status !== 204) {
      return res.status(502).json({
        error: "Could not retrieve Spotify playback status",
      });
    }

    const isCurrentTrack = playback?.item?.id === room.lastSpotifyTrackId;

    if (!device.is_active) {
      await transferSpotifyPlayback(room.hostSpotifyId, device.id);
    }

    const playUrl =
      `https://api.spotify.com/v1/me/player/play` +
      `?device_id=${encodeURIComponent(device.id)}`;

    let body;

    if (isCurrentTrack) {
      // Resume the already selected Spotify track
      body = undefined;
    } else {
      // Restore our queue song instead of starting the next one
      body = JSON.stringify({
        uris: [`spotify:track:${room.lastSpotifyTrackId}`],
        position_ms: Math.max(0, Math.floor(room.playbackPositionMs ?? 0)),
      });
    }

    const response = await fetch(playUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      ...(body ? { body } : {}),
    });

    if (!response.ok) {
      console.error(
        "Spotify resume failed:",
        response.status,
        await response.text(),
      );

      return res.status(502).json({
        error: "Could not resume Spotify playback",
      });
    }

    room.isPaused = false;
    await room.save();

    return res.status(200).json({
      message: "Playback resumed",
      restored: !isCurrentTrack,
    });
  } catch (error) {
    return sendApiError(res, error, "Failed to resume playback");
  }
});

module.exports = router;