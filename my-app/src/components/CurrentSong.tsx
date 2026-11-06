
import { useEffect, useState } from "react";
import {
  getCurrentSong,
  nextSong,
  type Song,
} from "../api/client";
import "../style/CurrentSong.css";

type Props = {
  roomId: string;
};

function CurrentSong({ roomId }: Props) {
  const [song, setSong] = useState<Song | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadCurrentSong() {
      try {
        const result = await getCurrentSong(roomId);

        if (active) {
          setSong(result.currentSong);
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
    if (loading) return;

    setLoading(true);
    setError("");

    try {
      const result = await nextSong(roomId);
      setSong(result.currentSong);
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

        <button
          type="button"
          className="btn btn-success mt-3"
          onClick={handleNext}
          disabled={loading}
        >
          {loading ? "Loading..." : "⏭ Next Song"}
        </button>

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


