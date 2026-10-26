require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const roomRoutes = require("./routes/rooms");
const spotifyRoutes = require("./routes/spotify");
const session = require("express-session");
const { MongoStore } = require("connect-mongo");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use(
    session({
        name: "music_queue.sid",

        secret: process.env.SESSION_SECRET,

        resave: false,

        saveUninitialized: false,

        store: MongoStore.create({
            mongoUrl: process.env.MONGODB_URI
        }),

        cookie: {
            httpOnly: true,
            secure: false,
            sameSite: "lax",
            maxAge: 24 * 60 * 60 * 1000
        }
    })
);

app.use("/api/rooms", roomRoutes);

app.use("/api/spotify", spotifyRoutes);

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