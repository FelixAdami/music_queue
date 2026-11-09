
import { useEffect, useRef, useState } from "react";
import {
  getCurrentSong,
  getPlaybackStatus,
  nextSong,
  pausePlayback,
  resumePlayback,
  type PlaybackStatus,
  type Song,
} from "../api/client";
import "../style/CurrentSong.css";

type Props = {
  roomId: string;
};

function CurrentSong({ roomId }: Props) {
  const [song, setSong] = useState<Song | null>(null);
  const [status, setStatus] = useState<PlaybackStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [playbackLoading, setPlaybackLoading] = useState(false);
  const [error, setError] = useState("");

  const actionInProgress = useRef(false);

  useEffect(() => {
    let active = true;
    let fetching = false;

    setSong(null);
    setStatus(null);
    setError("");

    async function refresh() {
      if (fetching || actionInProgress.current) return;

      fetching = true;

      try {
        const [songResult, playbackResult] = await Promise.all([
          getCurrentSong(roomId),
          getPlaybackStatus(roomId),
        ]);

        if (active && !actionInProgress.current) {
          setSong(songResult.currentSong);
          setStatus(playbackResult);
        }
      } catch (err) {
        if (active && !actionInProgress.current) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not load playback status"
          );
        }
      } finally {
        fetching = false;
      }
    }

    void refresh();

    const interval = setInterval(() => {
      void refresh();
    }, 3000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [roomId]);

  async function refreshAfterAction() {
    const [songResult, playbackResult] = await Promise.all([
      getCurrentSong(roomId),
      getPlaybackStatus(roomId),
    ]);

    setSong(songResult.currentSong);
    setStatus(playbackResult);
  }

  function showError(err: unknown) {
    setError(
      err instanceof Error
        ? err.message
        : "Could not control playback"
    );
  }

  async function handleNext() {
    if (loading || playbackLoading) return;

    actionInProgress.current = true;
    setLoading(true);
    setError("");

    try {
      const result = await nextSong(roomId);
      setSong(result.currentSong);
      await refreshAfterAction();
    } catch (err) {
      showError(err);
    } finally {
      actionInProgress.current = false;
      setLoading(false);
    }
  }

  async function handlePlaybackToggle() {
    if (loading || playbackLoading || !status) return;

    actionInProgress.current = true;
    setPlaybackLoading(true);
    setError("");

    try {
      if (status.isPlaying) {
        // Pause the current song
        await pausePlayback(roomId);
      } else if (song) {
        // Resume the current queue song, even if Spotify
        // lost its playback state after inactivity
        await resumePlayback(roomId);
      } else {
        // Only start the next queue song if none is selected
        const result = await nextSong(roomId);
        setSong(result.currentSong);
      }

      await refreshAfterAction();
    } catch (err) {
      showError(err);
    } finally {
      actionInProgress.current = false;
      setPlaybackLoading(false);
    }
  }

  const isPlaying = status?.isPlaying ?? false;

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
            disabled={
              loading ||
              playbackLoading ||
              status === null
            }
          >
            {playbackLoading
              ? "Loading..."
              : isPlaying
                ? "⏸ Pause"
                : "▶ Play"}
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

