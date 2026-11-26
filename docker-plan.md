# Docker Plan: Extract Genre Lookup as a Microservice

## Goal

Extract song genre analysis into its own Docker service, as required by the project specification: identify a feature that does not access the database (for example, an LLM feature), run it in a separate Docker container, and have the application call it over HTTP using JSON.

The genre feature consists of looking up lyrics at LRCLIB and asking the configured Gemma model (currently through LM Studio) to return genres and themes. Neither step needs MongoDB. The main Music Queue backend will remain responsible for rooms, songs, authorization, and persisting `allowedGenres`.

## Current branch setup

- The root `docker-compose.yml` currently defines one `music-queue` service, built from `./music-queue` using `music-queue/dockerfile`.
- That image builds the React frontend and Node/Express backend together and exposes port 3000.
- The active branch is named `dockerizing`. It deletes `music-queue/backend/services/gemmaAi.js`, `songGenre.js`, and `songLyrics.js`, and adds their current equivalents under the root `llm-service/` directory.
- `llm-service/` currently contains only CommonJS helper modules (plus `.gitkeep`): there is no HTTP server, package manifest, Dockerfile, or Compose service yet. The main backend route still imports `../services/songGenre`, so this branch's relocation is not yet wired into the running application.
- The existing `getSongGenre(song)` flow calls LRCLIB with the song title, artist, and duration, then calls LM Studio. It caches results in process memory by Mongo song `_id` and coalesces concurrent requests. The cached value is not persistent.
- The song routes use genre analysis when adding a song to a genre-restricted room (manual and Spotify flows), and expose `GET /api/rooms/:id/songs/:songId/genre`.
- Compose currently publishes only the main app's port. The Gemma helper defaults to `http://host.docker.internal:1234` and reads `LM_STUDIO_URL`, `LM_STUDIO_MODEL`, and optionally `LM_STUDIO_API_TOKEN`.

## Proposed service boundary

Create a small Node.js HTTP service in `llm-service/` that owns:

1. LRCLIB lyrics lookup using title, artist, and optional duration.
2. Genre and theme classification through the configured LLM endpoint.
3. Validation and normalization of the analysis response.

It must not connect to MongoDB or receive a Mongo document. The main backend sends only the song metadata needed for lookup and remains the only component that reads or writes `Song` documents.

### JSON API

Implement `POST /api/v1/genre/analyze`.

Request:

```json
{
  "title": "Song title",
  "artist": "Artist name",
  "durationMs": 215000
}
```

`durationMs` is optional; when present it must be a positive finite number. Require non-empty `title` and `artist` strings. Set a request body size limit and reject malformed JSON or invalid input with `400`.

Successful response (`200`):

```json
{
  "genres": ["Indie", "Alternative"],
  "themes": ["belonging", "change"]
}
```

If LRCLIB has no usable lyrics, return `404` with a stable machine-readable code such as `LYRICS_NOT_FOUND`. For upstream LRCLIB/LM Studio failures, return `502` (or `503` when the LLM is unavailable) with a stable error code and a safe message; do not return provider credentials or raw internal details. Add `GET /health` for container health checks. Do not enable public CORS: this API is called by the backend over the Compose network.

## Implementation steps

1. **Make the branch layout consistent.** Keep the genre service implementation in root `llm-service/`, as the branch has started doing. Add its `package.json`, lockfile, HTTP entrypoint (for example `server.js`), and Dockerfile there. Remove the backend's direct dependency on the old `services/songGenre` helper by replacing it with a small HTTP client module under `music-queue/backend/services/`.
2. **Separate API orchestration from the existing helpers.** Reuse the current `songLyrics.js` and `gemmaAi.js` logic in `llm-service/`. Move the cached `getSongGenre` orchestration into the service. Since it has no database, key any optional cache by normalized title/artist/duration (or omit cache initially); retain in-flight request coalescing if useful. Do not rely on Mongo `_id` in the service.
3. **Add the HTTP contract.** Validate input, call LRCLIB and Gemma, and return the stable JSON shape above. Keep the existing allowed genre vocabulary and prompt behavior. Distinguish missing lyrics from temporary upstream failures so the backend can preserve a meaningful outcome.
4. **Add the backend HTTP client.** Add a configurable `GENRE_SERVICE_URL`, defaulting in Compose to `http://genre-service:3001`. The client posts JSON to `/api/v1/genre/analyze`, applies a finite timeout, parses and validates the response, and maps `LYRICS_NOT_FOUND` separately from service/unavailable errors. Never expose the service port to the host unless local debugging requires it.
5. **Preserve existing route behavior.** In both song-add routes, keep the main backend's room checks and Mongo writes. For restricted rooms, call the microservice with `title`, `artist`, and `durationMs`, then set `song.allowedGenres` and save as today. The existing genre endpoint should continue to load and authorize/find the song in the backend, call the service with its metadata, and return `{ genres, themes }`. Map no lyrics to the existing user-facing 404 and service failures to a gateway error. Make sure a failed analysis does not leave a newly created song silently inserted into a restricted queue; either roll back that insert or define and implement an explicit pending/failure policy.
6. **Add the Compose service.** Define `genre-service` with build context `./llm-service`, internal port 3001, `restart: unless-stopped`, and a health check against `/health`. Put `music-queue` and `genre-service` on the default Compose network. Set `GENRE_SERVICE_URL` on `music-queue`; set `PORT=3001`, `LM_STUDIO_URL`, `LM_STUDIO_MODEL`, and optional `LM_STUDIO_API_TOKEN` on `genre-service`.
7. **Configure LM Studio host access.** Preserve configurability instead of assuming the LM Studio endpoint is always at one address. For Docker Desktop on Windows/macOS, `host.docker.internal` is available; on Linux, add the Compose `host-gateway` mapping if supported by the target Docker version, or document the host address to set in `LM_STUDIO_URL`. Do not publish LM Studio or the genre service as an unintended public endpoint.
8. **Harden the container.** Use a small supported Node base image, install production dependencies with a lockfile (`npm ci --omit=dev`), run as a non-root user, expose only the internal application port, and use a `.dockerignore` that excludes `.env`, `node_modules`, and local artifacts. Pass secrets through runtime environment configuration, never build arguments or image layers.

## Error handling and availability

- Apply a finite HTTP timeout in the backend client and return a controlled gateway error when the service is unreachable or times out.
- Do not silently skip genre analysis when a room enforces genre restrictions. Preserve the current behavior that adding a song to a restricted room requires a usable genre result, while ensuring the song is not left in the queue if that operation fails.
- Keep the genre analysis endpoint available for unrestricted rooms as it is today.
- Do not add retries initially; an automatic retry can duplicate expensive LLM work. If retries are added later, restrict them to transient failures and use a bounded retry count.
- The current in-memory cache is lost on restart and differs per replica. A first implementation can use in-flight coalescing only; persistent caching would require a deliberate data design and is outside the no-database service boundary.

## Acceptance criteria

- Compose starts both the existing app and the new genre service on one private network.
- The genre service has no MongoDB URI or database dependency.
- The backend calls it over HTTP with a JSON request containing song metadata and validates the JSON response.
- The genre service performs LRCLIB lookup and Gemma classification and returns `{ "genres": [...], "themes": [...] }`.
- Missing lyrics, invalid input, upstream failure, timeout, and successful analysis have distinct, documented outcomes.
- Manual song addition, Spotify song addition, genre filtering, and the existing genre endpoint retain their intended behavior.
- LM Studio configuration and secrets are supplied at runtime and the service is not unnecessarily published on the host.
