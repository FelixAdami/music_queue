
const Song = require("../models/Song");
const { getValidAccessToken } = require("../utils/spotifyAuth");

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
            playedAt: null
        }).sort({ addedAt: 1, _id: 1 });

        if (!nextSong) {
            return null;
        }

        // Get the host's Spotify access token
        const accessToken = await getValidAccessToken(
            room.hostSpotifyId
        );

        // Start the next song on Spotify
        const spotifyResponse = await fetch(
            "https://api.spotify.com/v1/me/player/play",
            {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    uris: [`spotify:track:${nextSong.spotifyId}`]
                })
            }
        );

        if (!spotifyResponse.ok) {
            const details = await spotifyResponse.text();

            console.error(
                "Spotify playback failed:",
                spotifyResponse.status,
                details
            );

            throw new Error("Could not start Spotify playback");
        }

        // Mark the song as played
        nextSong.playedAt = new Date();
        await nextSong.save();

        // Update the room's current song
        room.currentSongId = nextSong._id;
        room.lastSpotifyTrackId = nextSong.spotifyId;
        await room.save();

        return nextSong;

    } finally {
        // Always release the lock, even if an error occurs
        switchingRooms.delete(roomId);
    }
}

module.exports = { playNextSong };
