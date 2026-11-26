# LLM Microservice Extraction Plan

## Goal

Move all LLM-related song processing currently implemented in music-queue/backend/services/gemmaAi.js, music-queue/backend/services/songGenre.js, and music-queue/backend/services/songLyrics.js into a dedicated Docker service. The existing Music Queue backend remains the application's public API, database owner, and Spotify integration. The browser continues to call the backend; only the backend calls the new service.

## Current setup

- The root docker-compose.yml defines one music-queue service, built from music-queue/dockerfile with music-queue/ as its build context. That container serves the built React frontend and runs the Express backend on port 3000.
- music-queue/backend/routes/songs.js calls getSongGenre(song) in two song creation flows and in GET /api/rooms/:id/songs/:songId/genre.
- songGenre.js fetches lyrics with LRCLIB, asks gemmaAi.js to classify them, and caches completed/in-flight analysis in process memory by song ID.
- gemmaAi.js currently talks to LM Studio using LM_STUDIO_URL, LM_STUDIO_MODEL, and optional LM_STUDIO_API_TOKEN. Its default URL is http://host.docker.internal:1234.
- The existing API response shape for successful genre analysis is { "genres": [...], "themes": [...] }. If LRCLIB has no lyrics, the existing service returns null and the route reports lyrics unavailable.
- Compose's music-queue service is the only container and publishes port 3000. The app Dockerfile is music-queue/dockerfile (lowercase); Compose must keep that path's case consistent on case-sensitive hosts.

## Target architecture and communication

Browser
  | HTTP: existing /api/* requests
  v
music-queue (Express API + React static files, port 3000)
  | private Docker Compose network, HTTP JSON to http://llm-service:3001
  v
llm-service (lyrics lookup + Gemma classification, port 3001)
  | HTTPS
  +----> LRCLIB
  +----> LM Studio endpoint configured by environment

- Add a Compose service named llm-service. Docker Compose's internal DNS makes that service reachable by its service name, so the backend uses LLM_SERVICE_URL=http://llm-service:3001. Do not use localhost for container-to-container calls: inside the backend container it refers to the backend container itself.
- Keep the LLM service on Compose's private network and do not publish its port to the host by default. The browser must not call it directly; the backend continues enforcing room/session rules and presents the current public API.
- The LLM container should not need MongoDB or Spotify credentials. It receives only song metadata and returns lyrics/analysis results. This keeps database access and application authorization in the backend.
- If LM Studio is running on the Docker host, configure its reachable URL for the LLM container. On Docker Desktop, host.docker.internal is commonly available. On Linux, add a Compose host-gateway mapping (or configure a reachable host address). If LM Studio is remote, set its reachable URL directly. Verify LM Studio is configured to accept requests from the container network.

## Proposed LLM service contract

Implement a small HTTP API in a new service directory (for example, llm-service/) with JSON request and response bodies:

### GET /health

Return 200 { "status": "ok" } when the service process is ready. This is for container health checks; it should not require contacting LRCLIB or LM Studio.

### POST /v1/song-genre

Request:

    {
      "songId": "database-song-id",
      "title": "Song title",
      "artist": "Artist name",
      "durationMs": 215000
    }

Success when lyrics exist:

    {
      "genres": ["Indie"],
      "themes": ["..."],
      "lyricsAvailable": true
    }

No lyrics match:

    { "genres": [], "themes": [], "lyricsAvailable": false }

The endpoint performs the LRCLIB lookup and then Gemma classification, preserving the current prompt and JSON normalization behavior. It owns the current completed-result and in-flight analysis caches. The backend adapter translates lyricsAvailable: false to the current null behavior so existing routes can preserve their response semantics.

Validate required song metadata and return clear status codes: 400 for invalid input, 404 (or the documented no-lyrics result above) for a valid song with no lyrics, 502 for LRCLIB/LM Studio upstream failures, and 500 for unexpected internal errors. Pick one no-lyrics representation and implement it consistently; the explicit 200 result above is preferred because no lyrics is a valid lookup outcome.

### Optional POST /v1/lyrics

Only add this if another caller needs raw lyrics independently from genre classification. The current backend only uses lyrics as input to genre analysis, so the first implementation can keep lyrics lookup internal to POST /v1/song-genre and avoid exposing or transferring lyrics to the backend.

## Implementation steps

1. **Create the LLM service package.** Add its own package manifest, server entry point, and container build file. Move the three service implementations into that service, adjusting imports and exports. Preserve the genre prompt, LRCLIB request headers/parameters, null/no-lyrics semantics, Gemma response parsing, and per-song result coalescing/cache behavior.
2. **Add the service HTTP contract.** Implement request validation, GET /health, and POST /v1/song-genre. Do not expose raw stack traces or upstream credentials in error responses. Log enough server-side detail to diagnose upstream failures.
3. **Add backend client adapter.** Replace direct imports of songGenre.js from the routes with a backend-side HTTP client (for example, music-queue/backend/services/llmClient.js). It sends the saved song's ID, title, artist, and duration to LLM_SERVICE_URL, applies a finite request timeout, parses and validates the response, and maps no-lyrics to the current null result. Keep the route call sites and frontend contract unchanged.
4. **Add containers to Compose.** Define llm-service built from its own Dockerfile, listening on port 3001. Configure the backend with LLM_SERVICE_URL=http://llm-service:3001. Add a health check for the LLM process and have the backend wait for that health check where supported. Keep only port 3000 published. Keep the music-queue/ build context and lowercase dockerfile reference consistent in Compose so builds work on Linux.
5. **Configure secrets and upstream endpoints.** Pass LM_STUDIO_URL, LM_STUDIO_MODEL, and optional LM_STUDIO_API_TOKEN only to the LLM service, using environment variables or a dedicated env file excluded from version control. Do not bake secrets into either image. Configure LRCLIB's outbound access from that container. Remove these LM Studio settings from the backend environment after migration.
6. **Handle security and resilience.** Keep the LLM port private to the Compose network. Because the service is internal, network isolation is the minimum boundary; optionally require a shared LLM_SERVICE_TOKEN header if the service may become reachable from other networks. Use bounded request timeouts, return a clear 503/502 to the backend when the service is unavailable, and avoid retrying non-idempotent or expensive model calls automatically without a policy. Preserve cache coalescing to avoid duplicate simultaneous model requests.
7. **Update developer configuration and documentation.** Add safe values for new variables to music-queue/backend/.env.example and an LLM-service env example. Document how to start the complete Compose stack and how to configure host/remote LM Studio reachability. Keep actual tokens out of examples.
8. **Remove the old backend implementations.** Once the backend adapter is in place, delete the three moved service files from backend/services and confirm no backend module imports them. Do this in the same change as the adapter so there is no intermediate broken state.

## Operational notes

- Compose service-name DNS is the communication mechanism; the backend uses the URL http://llm-service:3001 on the shared Compose network. Do not hardcode container IP addresses.
- depends_on with condition: service_healthy can sequence startup, but runtime calls still need timeout and unavailable-service handling because a healthy service may later fail.
- The LLM service depends on an external LM Studio endpoint and LRCLIB. Its container health check should report process readiness only; add separate diagnostics for upstream connectivity if needed rather than making container startup depend on the model being loaded.
- Genre classification is currently synchronous in song creation when a room has genre restrictions. Moving it across HTTP retains that behavior but adds network latency and introduces an availability dependency. A later design could make classification asynchronous, but that would require an explicit queue/status model and changes to the API/UI.
- The current cache is in-memory. It is lost on container restart and is not shared across replicas. Preserve this initially; consider persistent/shared caching only if deployment scale or repeated lookup cost warrants it.

## Verification checklist

- Build both images and start the stack with Compose; confirm the frontend and existing API are still served on port 3000.
- From the backend container, resolve and call http://llm-service:3001/health; confirm the LLM service port is not published to the host.
- Verify valid song genre requests return the existing genres/themes shape through the backend route.
- Verify missing lyrics still produce the existing user-facing "lyrics unavailable" behavior, while LRCLIB/LM Studio errors become a controlled backend error.
- Verify both song-add paths that require genre filtering call the service and persist the returned genres.
- Verify invalid metadata is rejected, concurrent requests for the same song do not trigger duplicate analysis, and container restarts do not prevent the stack from starting.
- Verify logs and environment configuration contain no LM Studio API token, session secret, Spotify secret, or database URI.
