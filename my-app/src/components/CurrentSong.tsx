
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
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadCurrentSong() {
      try {
        const data = await getCurrentSong(roomId);

        if (active) {
          setSong(data.currentSong);
          setError("");
        }
      } catch {
        if (active) {
          setError("Could not load current song.");
        }
      }
    }

    void loadCurrentSong();

    const interval = window.setInterval(() => {
      void loadCurrentSong();
    }, 3000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [roomId]);

  async function handleNext() {
    if (loading) return;

    setLoading(true);
    setError("");

    try {
      const data = await nextSong(roomId);
      setSong(data.currentSong);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not select next song."
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
          alt={`${song.title} cover`}
          width={120}
          height={120}
          className="rounded-3"
          style={{ objectFit: "cover" }}
        />
      )}

      <div className="flex-grow-1">
        <h3>{song?.title ?? "No song selected"}</h3>
        <p>{song?.artist ?? "Add songs to the queue to get started."}</p>

        <button
          className="btn btn-success"
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

