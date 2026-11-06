require("dotenv").config();

const mongoose = require("mongoose");
const { getValidAccessToken } = require("./utils/spotifyAuth");

async function test() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected to MongoDB");

        // Replace with your Spotify user ID
        const spotifyUserId = "yvzax0nngq1tgianz6cgj6wex";

        const accessToken = await getValidAccessToken(spotifyUserId);

        console.log("Valid access token received:", Boolean(accessToken));

    } catch (error) {
        console.error("Test failed:", error.message);
    } finally {
        await mongoose.disconnect();
    }
}

test();