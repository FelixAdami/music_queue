
import { useEffect, useState } from "react";
import {
  getCurrentSong,
  nextSong,
  pausePlayback,
  resumePlayback,
  type Song,
} from "../api/client";
import "../style/CurrentSong.css";

type Props = {
  roomId: string;
};

function CurrentSong({ roomId }: Props) {
  const [song, setSong] = useState<Song | null>(null);
  const [loading, setLoading] = useState(false);
  const [playbackLoading, setPlaybackLoading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    setSong(null);
    setIsPaused(false);
    setHasStarted(false);

    async function loadCurrentSong() {
      try {
        const result = await getCurrentSong(roomId);

        if (active) {
          setSong(result.currentSong);

          if (result.currentSong) {
            setHasStarted(true);
          } else {
            setHasStarted(false);
            setIsPaused(false);
          }
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not load current song"
          );
        }
      }
    }

    void loadCurrentSong();

    const interval = setInterval(() => {
      void loadCurrentSong();
    }, 3000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [roomId]);

  async function handleNext() {
    if (loading || playbackLoading) return;

    setLoading(true);
    setError("");

    try {
      const result = await nextSong(roomId);

      setSong(result.currentSong);
      setHasStarted(result.currentSong !== null);
      setIsPaused(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not select next song"
      );
    } finally {
      setLoading(false);
    }
  }

  async function handlePlaybackToggle() {
    if (playbackLoading || loading) return;

    setPlaybackLoading(true);
    setError("");

    try {
      if (!hasStarted || !song) {
        // Start the first song from the queue
        const result = await nextSong(roomId);

        if (!result.currentSong) {
          setError("Queue is empty. Add a song first.");
          return;
        }

        setSong(result.currentSong);
        setHasStarted(true);
        setIsPaused(false);
      } else if (isPaused) {
        // Resume the paused song
        await resumePlayback(roomId);
        setIsPaused(false);
      } else {
        // Pause the currently playing song
        await pausePlayback(roomId);
        setIsPaused(true);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not control playback"
      );
    } finally {
      setPlaybackLoading(false);
    }
  }

  return (
    <div
      id="currentSong"
      className="d-flex align-items-center gap-3 p-3 rounded-4 bg-dark text-white shadow"
    >
      {song?.imageUrl && (
        <img
          src={song.imageUrl}
          className="rounded-3 flex-shrink-0"
          width={120}
          height={120}
          style={{ objectFit: "cover" }}
          alt="Song cover"
        />
      )}

      <div className="flex-grow-1">
        <div className="d-flex align-items-center justify-content-between">
          <div>
            <h2>{song?.title ?? "No song selected"}</h2>
            <h3>
              {song?.artist ??
                "Add songs to the queue to get started."}
            </h3>
          </div>
        </div>

        <div className="d-flex flex-wrap gap-2 mt-3">
          <button
            type="button"
            className="btn btn-success"
            onClick={handlePlaybackToggle}
            disabled={playbackLoading || loading}
          >
            {playbackLoading
              ? "Loading..."
              : !hasStarted || isPaused
                ? "▶ Play"
                : "⏸ Pause"}
          </button>

          <button
            type="button"
            className="btn btn-outline-light"
            onClick={handleNext}
            disabled={loading || playbackLoading}
          >
            {loading ? "Loading..." : "⏭ Next Song"}
          </button>
        </div>

        {error && (
          <p role="alert" className="text-warning mt-2">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

export default CurrentSong;

