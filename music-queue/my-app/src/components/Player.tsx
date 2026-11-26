import { useEffect, useRef, useState } from "react";

type SpotifyPlayerState = "loading" | "ready" | "offline" | "error";

type SpotifyPlayerInstance = {
  addListener: (
    event: string,
    callback: (data: { device_id?: string; message?: string }) => void,
  ) => boolean;
  connect: () => Promise<boolean>;
  disconnect: () => void;
  togglePlay: () => Promise<void>;
};

declare global {
  interface Window {
    Spotify?: {
      Player: new (options: {
        name: string;
        getOAuthToken: (callback: (token: string) => void) => void;
        volume: number;
      }) => SpotifyPlayerInstance;
    };
    onSpotifyWebPlaybackSDKReady?: () => void;
  }
}

function Player() {
  const playerRef = useRef<SpotifyPlayerInstance | null>(null);
  const [status, setStatus] = useState<SpotifyPlayerState>("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let isMounted = true;
    let player: SpotifyPlayerInstance | null = null;

    const initializePlayer = () => {
      if (!isMounted || !window.Spotify || player) return;

      player = new window.Spotify.Player({
        name: "Music Queue",
        // TODO: Replace this placeholder with a short-lived access token from the backend.
        getOAuthToken: (callback) => callback("YOUR_SPOTIFY_ACCESS_TOKEN"),
        volume: 0.5,
      });
      playerRef.current = player;

      player.addListener("ready", () => {
        if (isMounted) {
          setStatus("ready");
          setMessage("");
        }
      });
      player.addListener("not_ready", () => {
        if (isMounted) setStatus("offline");
      });
      player.addListener("initialization_error", ({ message: error }) => {
        if (isMounted) {
          setStatus("error");
          setMessage(error ?? "Could not initialize Spotify playback.");
        }
      });
      player.addListener("authentication_error", ({ message: error }) => {
        if (isMounted) {
          setStatus("error");
          setMessage(error ?? "Spotify authentication failed. Add a valid access token.");
        }
      });
      player.addListener("account_error", ({ message: error }) => {
        if (isMounted) {
          setStatus("error");
          setMessage(error ?? "This Spotify account cannot use the Web Playback SDK.");
        }
      });

      void player.connect();
    };

    if (window.Spotify) {
      initializePlayer();
    } else {
      window.onSpotifyWebPlaybackSDKReady = initializePlayer;
    }

    return () => {
      isMounted = false;
      if (playerRef.current === player) playerRef.current = null;
      player?.disconnect();
      if (window.onSpotifyWebPlaybackSDKReady === initializePlayer) {
        window.onSpotifyWebPlaybackSDKReady = undefined;
      }
    };
  }, []);

  const togglePlayback = async () => {
    try {
      await playerRef.current?.togglePlay();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not control playback.",
      );
    }
  };

  const statusLabel = {
    loading: "Connecting to Spotify...",
    ready: "Spotify player ready",
    offline: "Spotify player offline",
    error: "Spotify player unavailable",
  }[status];

  return (
    <div className="d-flex flex-column align-items-end gap-1">
      <small className="text-secondary text-nowrap">{statusLabel}</small>
      {message && (
        <small className="text-warning text-end">{message}</small>
      )}
      <button
        type="button"
        className="btn btn-outline-light btn-sm"
        onClick={togglePlayback}
        disabled={status !== "ready"}
      >
        Play / Pause
      </button>
    </div>
  );
}

export default Player;
