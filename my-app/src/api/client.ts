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

export class ApiError extends Error {
  readonly status: number;

  constructor(
    message: string,
    status: number,
  ) {
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
  return requestJson<Room>(`/api/rooms/${encodeURIComponent(roomId)}`);
}

export function getRoomHostStatus(roomId: string) {
  return requestJson<RoomHostStatus>(
    `/api/rooms/${encodeURIComponent(roomId)}/host`,
  );
}

export function startSpotifyLogin() {
  window.location.assign(`${API_BASE_URL}/api/spotify/login`);
}
