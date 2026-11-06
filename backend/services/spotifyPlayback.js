const { getValidAccessToken } = require("../utils/spotifyAuth");

async function getSpotifyPlaybackStatus(hostSpotifyId) {
    const accessToken = await getValidAccessToken(hostSpotifyId);

    const response = await fetch(
        "https://api.spotify.com/v1/me/player",
        {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        }
    );

    if (response.status === 204) {
        return null;
    }

    if (!response.ok) {
        throw new Error(
            `Spotify playback status failed: ${response.status}`
        );
    }

    const data = await response.json();

    return {
        isPlaying: data.is_playing,
        spotifyId: data.item?.id ?? null,
        progressMs: data.progress_ms,
        durationMs: data.item?.duration_ms ?? null
    };
}

module.exports = { getSpotifyPlaybackStatus };