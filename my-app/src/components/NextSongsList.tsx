import { useEffect, useState } from "react";
import { getQueue, type Song } from "../api/client";
import "../style/NextSongsList.css";

type Props = {
  roomId: string;
};

function NextSongsList({ roomId }: Props) {
  const [songs, setSongs] = useState<Song[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadQueue() {
      try {
        const data = await getQueue(roomId);

        if (active) {
          setSongs(data);
          setError("");
        }
      } catch {
        if (active) {
          setError("Could not load the queue.");
        }
      }
    }

    void loadQueue();

    const interval = window.setInterval(() => {
      void loadQueue();
    }, 3000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [roomId]);

  return (
    <div id="nextSongsList" className="mt-4">
      <h3>Up Next</h3>

      {error && <p role="alert">{error}</p>}

      {!error && songs.length === 0 && <p>No songs in the queue yet.</p>}

      {songs.map((song) => (
        <div
          key={song._id}
          className="d-flex align-items-center gap-3 p-2 border-bottom"
        >
          {song.imageUrl && (
            <img
              src={song.imageUrl}
              alt=""
              width={55}
              height={55}
              style={{ objectFit: "cover" }}
            />
          )}

          <div>
            <strong>{song.title}</strong>
            <div className="text-secondary">{song.artist}</div>
          </div>

        </div>
      ))}
    </div>
  );
}

export default NextSongsList;
