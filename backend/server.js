
const dns = require("node:dns");
dns.setServers(["8.8.8.8"]);

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const session = require("express-session");
const { MongoStore } = require("connect-mongo");

const roomRoutes = require("./routes/rooms");
const songRoutes = require("./routes/songs");
const spotifyRoutes = require("./routes/spotify");
const spotifySearchRoutes = require("./routes/spotifySearch");

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === "production";

if (isProduction) {
    app.set("trust proxy", 1);
}

// CORS configuration
const allowedOrigins = (
    process.env.FRONTEND_ORIGINS || "http://localhost:5173"
)
    .split(",")
    .map(origin => origin.trim())
    .filter(Boolean);

app.use(cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        return callback(new Error("Origin is not allowed by CORS"));
    },
    credentials: true
}));

app.use(express.json());

// Session configuration
if (!process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET is missing");
}

if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is missing");
}

app.use(session({
    name: "music_queue.sid",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,

    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI
    }),

    cookie: {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax",
        maxAge: 24 * 60 * 60 * 1000
    }
}));

// API routes
app.use("/api/rooms", roomRoutes);
app.use("/api/rooms", songRoutes);
app.use("/auth", spotifyRoutes);
app.use("/api/spotify", spotifySearchRoutes);

// Start server
async function startServer() {
    try {
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
