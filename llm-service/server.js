const http = require("node:http");
const { getSongGenre } = require("./songGenre");

const PORT = Number(process.env.PORT) || 3001;
const MAX_BODY_BYTES = 16 * 1024;

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    let byteCount = 0;
    let settled = false;

    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      if (settled) return;
      byteCount += Buffer.byteLength(chunk);
      if (byteCount > MAX_BODY_BYTES) {
        const error = new Error("Request body too large");
        error.statusCode = 413;
        settled = true;
        reject(error);
        req.resume();
        return;
      }
      body += chunk;
    });
    req.on("end", () => {
      if (settled) return;
      settled = true;
      try {
        resolve(JSON.parse(body));
      } catch {
        const error = new Error("Malformed JSON request body");
        error.statusCode = 400;
        reject(error);
      }
    });
    req.on("error", (error) => {
      if (!settled) reject(error);
    });
  });
}

function validSongInput(body) {
  return (
    body &&
    typeof body === "object" &&
    !Array.isArray(body) &&
    typeof body.title === "string" &&
    body.title.trim().length > 0 &&
    typeof body.artist === "string" &&
    body.artist.trim().length > 0 &&
    (body.durationMs === undefined ||
      (typeof body.durationMs === "number" &&
        Number.isFinite(body.durationMs) &&
        body.durationMs > 0))
  );
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    return sendJson(res, 200, { status: "ok" });
  }

  if (req.method !== "POST" || req.url !== "/api/v1/genre/analyze") {
    return sendJson(res, 404, { error: "Not found", code: "NOT_FOUND" });
  }

  let input;
  try {
    input = await readJson(req);
  } catch (error) {
    if (!res.destroyed) {
      sendJson(res, error.statusCode || 400, {
        error:
          error.statusCode === 413
            ? "Request body too large"
            : "Malformed JSON request body",
        code: error.statusCode === 413 ? "BODY_TOO_LARGE" : "INVALID_JSON",
      });
    }
    return;
  }

  if (!validSongInput(input)) {
    return sendJson(res, 400, {
      error: "Song title, artist, or duration is invalid",
      code: "INVALID_SONG_DATA",
    });
  }

  try {
    const analysis = await getSongGenre({
      title: input.title,
      artist: input.artist,
      durationMs: input.durationMs,
    });
    if (!analysis) {
      return sendJson(res, 404, {
        error: "Lyrics are not available for this song",
        code: "LYRICS_NOT_FOUND",
      });
    }
    return sendJson(res, 200, analysis);
  } catch (error) {
    console.error("Genre analysis upstream failure:", error.message);
    return sendJson(res, 502, {
      error: "Genre analysis provider is unavailable",
      code: "UPSTREAM_FAILURE",
    });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Genre service listening on port ${PORT}`);
});
