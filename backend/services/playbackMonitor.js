const { getSpotifyPlaybackStatus } = require("./spotifyPlayback");
const { playNextSong } = require("./queuePlayback");
const Room = require("../models/Room");

const playbackStates = new Map();
const switchingRooms = new Set();

async function checkRoomPlayback(room) {
  const roomId = room.id;

  // Prevent overlapping monitor checks
  if (switchingRooms.has(roomId)) return;

  switchingRooms.add(roomId);

  try {
    if (!room.currentSongId || !room.lastSpotifyTrackId || room.isPaused) {
      playbackStates.delete(roomId);
      return;
    }

    const playback = await getSpotifyPlaybackStatus(room.hostSpotifyId);

    if (!playback) {
      playbackStates.delete(roomId);
      return;
    }

    const previous = playbackStates.get(roomId);
    const now = Date.now();

    // Detect whether the expected song has ended
    let songEnded = false;

    if (
      previous &&
      previous.isPlaying &&
      previous.spotifyId === room.lastSpotifyTrackId &&
      Number.isFinite(previous.durationMs) &&
      Number.isFinite(previous.progressMs)
    ) {
      const remainingMs = previous.durationMs - previous.progressMs;

      const elapsedMs = now - previous.checkedAt;

      const nearEnd = remainingMs >= 0 && remainingMs <= 10000;

      const expectedEndTime =
        elapsedMs >= remainingMs - 2000 && elapsedMs <= remainingMs + 10000;

      const trackChanged =
        playback.isPlaying && playback.spotifyId !== previous.spotifyId;

      const spotifyStopped = !playback.isPlaying;

      songEnded =
        nearEnd &&
        expectedEndTime &&
        (trackChanged || spotifyStopped) &&
        !room.isPaused;

      if (nearEnd && expectedEndTime && spotifyStopped) {
        console.log(`Room ${roomId}: Spotify stopped near song end`);
      }
    }

    // Save latest playback state
    if (playback.isPlaying) {
      playbackStates.set(roomId, {
        spotifyId: playback.spotifyId,
        progressMs: playback.progressMs,
        durationMs: playback.durationMs,
        isPlaying: true,
        checkedAt: now,
      });
    } else {
      playbackStates.delete(roomId);
    }

    if (!songEnded) return;

    // Verify the room hasn't changed
    const latestRoom = await Room.findById(room._id);

    if (
      !latestRoom ||
      latestRoom.currentSongId?.toString() !== room.currentSongId?.toString() ||
      latestRoom.lastSpotifyTrackId !== room.lastSpotifyTrackId
    ) {
      return;
    }

    console.log(`Room ${roomId}: Song ended`);

    // Start next queued song
    const nextSong = await playNextSong(latestRoom);

    if (nextSong) {
      console.log(`Room ${roomId}: Automatically started ${nextSong.title}`);
    } else {
      console.log(`Room ${roomId}: Queue is empty`);
    }

    // Reset monitoring after automatic switch
    playbackStates.delete(roomId);
  } catch (error) {
    console.error(`Playback monitoring failed for room ${roomId}:`, error);
  } finally {
    switchingRooms.delete(roomId);
  }
}

module.exports = { checkRoomPlayback };
