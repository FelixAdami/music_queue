require("dotenv").config();
const mongoose = require("mongoose");
const { getSpotifyPlaybackStatus } = require("./services/spotifyPlayback");

async function test() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected database:", mongoose.connection.name);
        const SpotifyToken = require("./models/SpotifyToken");

const tokenCount = await SpotifyToken.countDocuments();

console.log("Stored Spotify tokens:", tokenCount);
const storedUser = await SpotifyToken.findOne()
    .select("spotifyUserId -_id");

console.log("Stored Spotify User ID:", storedUser?.spotifyUserId);

        const status = await getSpotifyPlaybackStatus(
    storedUser.spotifyUserId
);

        console.log("Spotify Playback:", status);
    } catch (error) {
        console.error("Test failed:", error);
    } finally {
        await mongoose.disconnect();
    }
}

test();