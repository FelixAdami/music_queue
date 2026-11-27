const dns = require("node:dns");
dns.setServers(["8.8.8.8"]);
const path = require("node:path");
const net = require("node:net");

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const session = require("express-session");
const { MongoStore } = require("connect-mongo");
const { rateLimit, ipKeyGenerator } = require("express-rate-limit");

const roomRoutes = require("./routes/rooms");
const songRoutes = require("./routes/songs");
const spotifyRoutes = require("./routes/spotify");
const spotifySearchRoutes = require("./routes/spotifySearch");
const tunnelRoutes = require("./routes/tunnel");

const Room = require("./models/Room");
const { checkRoomPlayback } = require("./services/playbackMonitor");

const app = express();

const PORT = process.env.PORT || 3000;
const TRUSTED_PROXY_IP = process.env.TRUSTED_PROXY_IP;

// 1. Proxy configuration
function isTrustedProxy(ip) {
  return Boolean(
    TRUSTED_PROXY_IP &&
    ip &&
    ip.replace(/^::ffff:/, "") === TRUSTED_PROXY_IP
  );
}

app.set("trust proxy", isTrustedProxy);

function isPublicRequest(req) {
  return isTrustedProxy(req.socket.remoteAddress);
}

// 2. CORS configuration
const allowedOrigins = (
  process.env.FRONTEND_ORIGINS || "http://127.0.0.1:3000"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use((req, res, next) => {
  const origin = req.get("Origin");
  const requestOrigin = `${req.protocol}://${req.get("host")}`;

  if (
    origin &&
    origin !== requestOrigin &&
    !allowedOrigins.includes(origin)
  ) {
    return res.status(403).json({
      error: "Origin is not allowed",
    });
  }

  next();
});

app.use(
  cors({
    origin(origin, callback) {
      callback(null, true);
    },
    credentials: true,
  }),
);

// 3. Public access restrictions
app.use((req, res, next) => {
  if (!isPublicRequest(req)) {
    return next();
  }

  const requestPath = req.path;
  const method = req.method;

  const isJoinRequest =
    method === "POST" &&
    /^\/api\/rooms\/[a-f0-9]{24}\/join$/i.test(requestPath);

  const isSearchRequest =
    method === "GET" &&
    requestPath === "/api/spotify/search";

  const isAddSongRequest =
    method === "POST" &&
    /^\/api\/rooms\/[a-f0-9]{24}\/songs\/from-spotify$/i.test(
      requestPath
    );

  const isGuestPage =
    method === "GET" &&
    /^\/join\/[a-f0-9]{24}\/?$/i.test(requestPath);

  const isStaticAsset =
    method === "GET" &&
    requestPath.startsWith("/assets/");

  if (
    isJoinRequest ||
    isSearchRequest ||
    isAddSongRequest ||
    isGuestPage ||
    isStaticAsset
  ) {
    return next();
  }

  return res.status(403).json({
    error: "This endpoint is not publicly accessible",
  });
});

// 4. Rate limits
function getClientIp(req) {
  if (isPublicRequest(req)) {
    const clientIp = req.get("CF-Connecting-IP");

    if (clientIp && net.isIP(clientIp)) {
      return clientIp;
    }
  }

  return req.socket.remoteAddress;
}

function createLimiter(limit, message) {
  return rateLimit({
    windowMs: 60 * 1000,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator: (req) => ipKeyGenerator(getClientIp(req)),
    message: {
      error: message,
    },
  });
}

const apiLimiter = createLimiter(
  300,
  "Too many requests. Please try again later.",
);

const searchLimiter = createLimiter(
  60,
  "Too many searches. Please try again later.",
);

const addSongLimiter = createLimiter(
  10,
  "Too many songs added. Please try again later.",
);

const joinLimiter = createLimiter(
  10,
  "Too many join attempts. Please try again later.",
);

app.use("/api", apiLimiter);

app.get("/api/spotify/search", searchLimiter);

app.post("/api/rooms/:id/songs", addSongLimiter);

app.post("/api/rooms/:id/songs/from-spotify", addSongLimiter);

app.post("/api/rooms/:id/join", joinLimiter);

// 5. JSON middleware
app.use(express.json());

// 6. Required environment variables
if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET is missing");
}

if (!process.env.MONGODB_URI) {
  throw new Error("MONGODB_URI is missing");
}

// 7. Session configuration
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
      secure: "auto",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
    },
  }),
);

// Require a guest session for public Spotify searches
app.get("/api/spotify/search", (req, res, next) => {
  if (isPublicRequest(req) && !req.session?.joinedRoomId) {
    return res.status(403).json({
      error: "Please join a room first",
    });
  }

  next();
});

// 8. Spotify login redirect
app.get("/api/spotify/login", (req, res) => {
  const backendOrigin = `http://127.0.0.1:${PORT}`;

  return res.redirect(`${backendOrigin}/auth/login`);
});

// 9. API routes
app.use("/api/tunnel", tunnelRoutes);
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

// 10. Playback monitoring
let playbackCheckRunning = false;

async function monitorPlayback() {
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

// 11. Start server
async function startServer() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    console.log("Connected to MongoDB");

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

    setInterval(monitorPlayback, 5000);

    console.log("Playback monitor started");
  } catch (error) {
    console.error("Failed to start server:", error.message);

    process.exit(1);
  }
}

startServer();