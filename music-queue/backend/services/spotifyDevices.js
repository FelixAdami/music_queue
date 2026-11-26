
const { getValidAccessToken } = require("../utils/spotifyAuth");

const SPOTIFY_API = "https://api.spotify.com/v1/me/player";

// Fetch all Spotify Connect devices
async function getSpotifyDevices(spotifyUserId) {
  const accessToken = await getValidAccessToken(spotifyUserId);

  const response = await fetch(`${SPOTIFY_API}/devices`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const details = await response.text();
    console.error("Spotify devices error:", response.status, details);
    throw new Error(`Could not fetch Spotify devices (${response.status})`);
  }

  const data = await response.json();
  return data.devices ?? [];
}

// Choose an available device, preferring the active one
async function findSpotifyDevice(spotifyUserId) {
  const devices = await getSpotifyDevices(spotifyUserId);

  const usableDevices = devices.filter(
    (device) => device.id && !device.is_restricted
  );

  const activeDevice = usableDevices.find(
    (device) => device.is_active
  );

  return activeDevice ?? usableDevices[0] ?? null;
}

// Transfer playback to the selected Spotify device
async function transferSpotifyPlayback(spotifyUserId, deviceId) {
  const accessToken = await getValidAccessToken(spotifyUserId);

  const response = await fetch(SPOTIFY_API, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      device_ids: [deviceId],
      play: false,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    console.error("Spotify transfer error:", response.status, details);
    throw new Error(`Could not transfer Spotify playback (${response.status})`);
  }
}

module.exports = {
  getSpotifyDevices,
  findSpotifyDevice,
  transferSpotifyPlayback,
};
