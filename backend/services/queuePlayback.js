
const Song = require("../models/Song");
const { getValidAccessToken } = require("../utils/spotifyAuth");
const {
  findSpotifyDevice,
  transferSpotifyPlayback,
} = require("./spotifyDevices");

// Rooms currently switching songs
const switchingRooms = new Set();

async function playNextSong(room) {
  const roomId = room._id.toString();

  // Prevent simultaneous song switches
  if (switchingRooms.has(roomId)) {
    throw new Error("Song switch already in progress");
  }

  switchingRooms.add(roomId);

  try {
    // Find the oldest unplayed song
    const nextSong = await Song.findOne({
      roomId: room._id,
      playedAt: null,
    }).sort({ addedAt: 1, _id: 1 });

    if (!nextSong) {
      return null;
    }

    // Get the host's Spotify access token
    const accessToken = await getValidAccessToken(room.hostSpotifyId);

    // Find an available Spotify Connect device
    const device = await findSpotifyDevice(room.hostSpotifyId);

    if (!device) {
      throw new Error(
        "No Spotify device available. Open Spotify on your PC or phone and try again."
      );
    }

    // Activate the device only if it is not already active
    if (!device.is_active) {
      await transferSpotifyPlayback(room.hostSpotifyId, device.id);
    }

    // Start the next song on the selected device
    const spotifyResponse = await fetch(
      `https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(device.id)}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uris: [`spotify:track:${nextSong.spotifyId}`],
        }),
      }
    );

    if (!spotifyResponse.ok) {
      const details = await spotifyResponse.text();

      console.error(
        "Spotify playback failed:",
        spotifyResponse.status,
        details
      );

      throw new Error(
        `Could not start Spotify playback (${spotifyResponse.status})`
      );
    }

    // Mark the song as played only after successful playback request
    nextSong.playedAt = new Date();
    await nextSong.save();

    room.currentSongId = nextSong._id;
    room.lastSpotifyTrackId = nextSong.spotifyId;
    room.isPaused = false;

    // Reset saved position for the newly selected song
    room.playbackPositionMs = 0;
    room.playbackPositionUpdatedAt = new Date();

    await room.save();

    return nextSong;
  } finally {
    // Always release the lock, even if an error occurs
    switchingRooms.delete(roomId);
  }
}

module.exports = { playNextSong };

