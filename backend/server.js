const dns = require("node:dns");
dns.setServers(["8.8.8.8"]);

require("dotenv").config();


const express = require("express");
const mongoose = require("mongoose");
const roomRoutes = require("./routes/rooms");
const songRoutes = require("./routes/songs");
const spotifyRoutes = require("./routes/spotify");
const spotifySearchRoutes = require("./routes/spotifySearch");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use("/api/rooms", roomRoutes);
app.use("/api/rooms", songRoutes);
app.use("/auth", spotifyRoutes);
app.use("/api/spotify", spotifySearchRoutes);

async function startServer() {
    try {
        if (!process.env.MONGODB_URI) {
            throw new Error("MONGODB_URI is missing");
        }

        await mongoose.connect(process.env.MONGODB_URI);

        console.log("Connected to MongoDB");

        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });

    } catch (error) {
        console.error("Failed to start server:", error.message);
        process.exit(1);
    }
}

startServer();