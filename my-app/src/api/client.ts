
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

export type Room = {
  _id: string;
  name: string;
  hostSpotifyId: string;
  createdAt: string;
};

export type SpotifyUser = {
  id: string;
  displayName?: string;
  image: string | null;
};

export type RoomHostStatus = {
  isHost: true;
  roomId: string;
  roomName: string;
};

export type PlaybackStatus = {
  hasCurrentSong: boolean;
  isCurrentTrack: boolean;
  isPlaying: boolean;
  isPaused: boolean;
  hasActiveDevice: boolean;
  spotifyId: string | null;
};

export type SongGenre = {
  genres: string[];
  themes: string[];
};

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : `API request failed (${response.status})`;

    throw new ApiError(message, response.status);
  }

  return payload as T;
}

export function getCurrentSpotifyUser() {
  return requestJson<SpotifyUser>("/api/spotify/me");
}

export function createRoom(name: string) {
  return requestJson<Room>("/api/rooms", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export function getRoom(roomId: string) {
  return requestJson<Room>(
    `/api/rooms/${encodeURIComponent(roomId)}`
  );
}

export function joinRoom(roomId: string) {
  return requestJson<{ roomId: string; roomName: string }>(
    `/api/rooms/${encodeURIComponent(roomId)}/join`,
    { method: "POST" }
  );
}

export function getRoomHostStatus(roomId: string) {
  return requestJson<RoomHostStatus>(
    `/api/rooms/${encodeURIComponent(roomId)}/host`
  );
}

// End a room and remove its songs.
export function endRoomSession(roomId: string) {
  return requestJson<{ message: string }>(
    `/api/rooms/${encodeURIComponent(roomId)}`,
    { method: "DELETE" }
  );
}

export function startSpotifyLogin() {
  window.location.assign(`${API_BASE_URL}/api/spotify/login`);
}

export type Song = {
  _id: string;
  roomId: string;
  spotifyId: string;
  title: string;
  artist: string;
  durationMs: number;
  imageUrl?: string | null;
  spotifyUrl?: string | null;
  addedAt: string;
  playedAt: string | null;
};

export function getQueue(roomId: string) {
  return requestJson<Song[]>(
    `/api/rooms/${encodeURIComponent(roomId)}/songs`
  );
}

export function getCurrentSong(roomId: string) {
  return requestJson<{ currentSong: Song | null }>(
    `/api/rooms/${encodeURIComponent(roomId)}/songs/current`
  );
}

export function getSongGenre(roomId: string, songId: string) {
  return requestJson<SongGenre>(
    `/api/rooms/${encodeURIComponent(roomId)}/songs/${encodeURIComponent(songId)}/genre`
  );
}

export function addSpotifySong(roomId: string, spotifyId: string) {
  return requestJson<Song>(
    `/api/rooms/${encodeURIComponent(roomId)}/songs/from-spotify`,
    {
      method: "POST",
      body: JSON.stringify({ spotifyId }),
    }
  );
}

export function nextSong(roomId: string) {
  return requestJson<{ message: string; currentSong: Song | null }>(
    `/api/rooms/${encodeURIComponent(roomId)}/songs/next`,
    { method: "POST" }
  );
}

export function pausePlayback(roomId: string) {
  return requestJson<{ message: string }>(
    `/api/rooms/${encodeURIComponent(roomId)}/playback/pause`,
    { method: "PUT" }
  );
}

export function resumePlayback(roomId: string) {
  return requestJson<{ message: string }>(
    `/api/rooms/${encodeURIComponent(roomId)}/playback/resume`,
    { method: "PUT" }
  );
}

export function getPlaybackStatus(roomId: string) {
  return requestJson<PlaybackStatus>(
    `/api/rooms/${encodeURIComponent(roomId)}/playback/status`
  );
}

export type SpotifySearchResult = {
  spotifyId: string;
  title: string;
  artist: string;
  durationMs: number;
  imageUrl: string | null;
  spotifyUrl: string | null;
};

export function searchSpotifySongs(query: string) {
  return requestJson<SpotifySearchResult[]>(
    `/api/spotify/search?q=${encodeURIComponent(query)}`
  );
}
