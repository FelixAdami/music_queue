const dns = require("node:dns");
dns.setServers(["8.8.8.8"]);
const path = require("node:path");

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

const Room = require("./models/Room");
const { checkRoomPlayback } = require("./services/playbackMonitor");

const app = express();

const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === "production";

// 1. Proxy configuration
if (isProduction) {
  app.set("trust proxy", 1);
}

// 2. CORS configuration
const allowedOrigins = (process.env.FRONTEND_ORIGINS || "http://127.0.0.1:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Origin is not allowed by CORS"));
    },
    credentials: true,
  }),
);

// 3. JSON middleware
app.use(express.json());

// 4. Required environment variables
if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET is missing");
}

if (!process.env.MONGODB_URI) {
  throw new Error("MONGODB_URI is missing");
}

const cookieSecure = process.env.COOKIE_SECURE === "true";

// 5. Session configuration
app.use(
  session({
    name: "music_queue.sid",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,

    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
    }),

    cookie: {
      httpOnly: true,
      secure: cookieSecure,
      sameSite: cookieSecure ? "none" : "lax",
      maxAge: 24 * 60 * 60 * 1000,
    },
  }),
);

// 6. Spotify login redirect
// Ensures the login and callback use the same host
// Spotify login redirect
app.get("/api/spotify/login", (req, res) => {
  const backendOrigin = `http://127.0.0.1:${PORT}`;

  return res.redirect(`${backendOrigin}/auth/login`);
});

// 7. API routes
app.use("/api/rooms", roomRoutes);
app.use("/api/rooms", songRoutes);

// Spotify authentication
app.use("/auth", spotifyRoutes);
app.use("/api/spotify", spotifyRoutes);

// Spotify search
app.use("/api/spotify", spotifySearchRoutes);

// Serve React frontend
const frontendPath = path.join(__dirname, "../my-app/dist");

app.use(express.static(frontendPath));

// React Router fallback
app.get("/{*splat}", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

// 8. Playback monitoring
let playbackCheckRunning = false;

async function monitorPlayback() {
  // Prevent overlapping monitoring cycles
  if (playbackCheckRunning) {
    return;
  }

  playbackCheckRunning = true;

  try {
    const rooms = await Room.find({
      currentSongId: { $ne: null },
      lastSpotifyTrackId: { $ne: null },
    });

    for (const room of rooms) {
      await checkRoomPlayback(room);
    }
  } catch (error) {
    console.error("Playback monitor error:", error);
  } finally {
    playbackCheckRunning = false;
  }
}

// 9. Start server
async function startServer() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    console.log("Connected to MongoDB");

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

    // Check Spotify playback every 5 seconds
    setInterval(monitorPlayback, 5000);

    console.log("Playback monitor started");
  } catch (error) {
    console.error("Failed to start server:", error.message);

    process.exit(1);
  }
}

startServer();
