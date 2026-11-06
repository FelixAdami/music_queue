
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  joinRoom,
  searchSpotifySongs,
  addSpotifySong,
  type SpotifySearchResult,
} from "../api/client";

function JoinRoom() {
  const { roomId } = useParams<{ roomId: string }>();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SpotifySearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function handleJoinRoom() {
      if (!roomId) {
        setError("Room ID is missing");
        setLoading(false);
        return;
      }

      try {
        await joinRoom(roomId);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not join room"
        );
      } finally {
        setLoading(false);
      }
    }

    void handleJoinRoom();
  }, [roomId]);

  async function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!query.trim()) return;

    setSearching(true);
    setMessage("");

    try {
      const songs = await searchSpotifySongs(query.trim());
      setResults(songs);
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Search failed"
      );
    } finally {
      setSearching(false);
    }
  }

  async function handleAddSong(spotifyId: string) {
    if (!roomId || addingId) return;

    setAddingId(spotifyId);
    setMessage("");

    try {
      await addSpotifySong(roomId, spotifyId);
      setMessage("Song added to queue!");
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Could not add song"
      );
    } finally {
      setAddingId(null);
    }
  }

  if (loading) return <p>Joining room...</p>;
  if (error) return <p role="alert">{error}</p>;

  return (
    <main className="container py-4">
      <h1>Join Music Queue</h1>
      <p>Room: {roomId}</p>

      <form onSubmit={handleSearch} className="d-flex gap-2 mb-4">
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
          className="d-flex align-items-center gap-3 p-3 border-bottom"
        >
          {song.imageUrl && (
            <img
              src={song.imageUrl}
              alt=""
              width={60}
              height={60}
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

      {!searching && results.length === 0 && (
        <p className="text-secondary mt-3">
          Search for a song to add it to the party queue.
        </p>
      )}
    </main>
  );
}

export default JoinRoom;
