
import { useState, type FormEvent } from "react";
import {
  addSpotifySong,
  searchSpotifySongs,
  type SpotifySearchResult,
} from "../api/client";

type Props = {
  roomId: string;
};

function SongSearch({ roomId }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SpotifySearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!query.trim()) return;

    setSearching(true);
    setMessage("");

    try {
      const songs = await searchSpotifySongs(query.trim());
      setResults(songs);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Search failed"
      );
    } finally {
      setSearching(false);
    }
  }

  async function handleAddSong(spotifyId: string) {
    if (addingId) return;

    setAddingId(spotifyId);
    setMessage("");

    try {
      await addSpotifySong(roomId, spotifyId);
      setMessage("Song added to queue!");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not add song"
      );
    } finally {
      setAddingId(null);
    }
  }

  return (
    <section className="mt-4">
      <h2>Add Songs</h2>

      <form onSubmit={handleSearch} className="d-flex gap-2 mb-3">
        <input
          className="form-control"
          type="search"
          placeholder="Search Spotify songs..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />

        <button
          className="btn btn-primary"
          type="submit"
          disabled={searching || !query.trim()}
        >
          {searching ? "Searching..." : "Search"}
        </button>
      </form>

      {message && <p role="status">{message}</p>}

      {results.map((song) => (
        <div
          key={song.spotifyId}
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

          <div className="flex-grow-1">
            <strong>{song.title}</strong>
            <div className="text-secondary">{song.artist}</div>
          </div>

          <button
            className="btn btn-success"
            disabled={addingId !== null}
            onClick={() => void handleAddSong(song.spotifyId)}
          >
            {addingId === song.spotifyId ? "Adding..." : "Add to Queue"}
          </button>
        </div>
      ))}
    </section>
  );
}

export default SongSearch;
