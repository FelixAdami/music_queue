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

const SDK_URL = "https://sdk.scdn.co/spotify-player.js";

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

    // The SDK script is already included in index.html. If it has not finished
    // loading yet, register its callback and reuse the existing script element.
    if (window.Spotify) {
      initializePlayer();
    } else {
      window.onSpotifyWebPlaybackSDKReady = initializePlayer;
      const existingScript = document.querySelector<HTMLScriptElement>(
        `script[src="${SDK_URL}"]`,
      );

      if (!existingScript) {
        const script = document.createElement("script");
        script.src = SDK_URL;
        script.async = true;
        script.onerror = () => {
          if (isMounted) {
            setStatus("error");
            setMessage("Could not load the Spotify Web Playback SDK.");
          }
        };
        document.body.appendChild(script);
      }
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
    loading: "Connecting to Spotify…",
    ready: "Spotify player ready",
    offline: "Spotify player offline",
    error: "Spotify player unavailable",
  }[status];

  return (
    <div className="d-flex align-items-center justify-content-between gap-3 p-3 rounded-4 bg-dark text-white shadow">
      <div>
        <p className="mb-0">{statusLabel}</p>
        {message && <small className="text-warning">{message}</small>}
      </div>
      <button
        type="button"
        className="btn btn-outline-light"
        onClick={togglePlayback}
        disabled={status !== "ready"}
      >
        Play / Pause
      </button>
    </div>
  );
}

export default Player;
