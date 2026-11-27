import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  joinRoom,
  searchSpotifySongs,
  addSpotifySong,
  type SpotifySearchResult,
} from "../api/client";
import "../style/JoinRoom.css";

function JoinRoom() {
  const { roomId } = useParams<{ roomId: string }>();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sessionEnded, setSessionEnded] = useState(false);

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

  // Check whether the session is still active
  useEffect(() => {
    if (!roomId || loading || error || sessionEnded) {
      return;
    }

    let cancelled = false;
    let checking = false;

    async function checkRoomStatus() {
      if (checking || cancelled) return;

      checking = true;

      try {
        const response = await fetch(
          `/api/rooms/${encodeURIComponent(roomId!)}/status`,
          {
            credentials: "include",
            cache: "no-store",
            signal: AbortSignal.timeout(5000),
          }
        );

        if (!response.ok) return;

        const data = await response.json();

        if (!cancelled && data.active === false) {
          setSessionEnded(true);
        }
      } catch {
        // Temporary connection errors do not end the session.
      } finally {
        checking = false;
      }
    }

    void checkRoomStatus();

    const interval = setInterval(checkRoomStatus, 3000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [roomId, loading, error, sessionEnded]);

  async function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!query.trim() || sessionEnded) return;

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
    if (!roomId || addingId || sessionEnded) return;

    setAddingId(spotifyId);
    setMessage("");

    try {
      const song = await addSpotifySong(roomId, spotifyId);

      if (song.prioritized) {
        setMessage("Your request counted! Song prioritized.");
      } else {
        setMessage("Song added to queue!");
      }
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Could not add song"
      );
    } finally {
      setAddingId(null);
    }
  }

  if (sessionEnded) {
    return (
      <main className="app-page join-room-page">
        <div className="join-room-shell">
          <section
            className="app-surface app-surface--bordered join-room-state-card"
            role="status"
          >
            <p className="app-eyebrow join-room-eyebrow">
              Session ended
            </p>

            <h1 className="app-display-title">
              The host has ended this session.
            </h1>

            <p>
              Thank you for joining the music queue!
              You can now close this page.
            </p>
          </section>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="app-page join-room-page">
        <div className="join-room-shell">
          <section
            className="app-surface app-surface--bordered join-room-state-card"
            role="status"
          >
            <p className="app-eyebrow join-room-eyebrow">
              Guest access
            </p>
            <h1 className="app-display-title">Joining the room</h1>
            <p>Connecting you to the music queue...</p>
          </section>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="app-page join-room-page">
        <div className="join-room-shell">
          <section
            className="app-surface app-surface--bordered join-room-state-card"
            aria-labelledby="join-room-error-title"
          >
            <p className="app-eyebrow join-room-eyebrow">
              Guest access
            </p>
            <h1 id="join-room-error-title" className="app-display-title">
              Could not join this room
            </h1>
            <p className="join-room-error" role="alert">
              {error}
            </p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="app-page join-room-page">
      <div className="join-room-shell">
        <header className="app-surface app-surface--bordered join-room-header">
          <div>
            <p className="app-eyebrow join-room-eyebrow">
              Guest access
            </p>
            <h1 id="join-room-title" className="app-display-title">
              Join the queue
            </h1>
            <p>Search Spotify and add a song for everyone to hear.</p>
          </div>

          <div className="join-room-code">
            <span>Room code</span>
            <code>{roomId}</code>
          </div>
        </header>

        <section
          className="app-surface app-surface--bordered join-room-card"
          aria-labelledby="join-room-search-title"
        >
          <div className="join-room-card-heading">
            <p className="app-eyebrow join-room-eyebrow">
              Find your next track
            </p>
            <h2 id="join-room-search-title">Search songs</h2>
          </div>

          <form onSubmit={handleSearch} className="join-room-search-form">
            <input
              className="form-control"
              type="search"
              placeholder="Search Spotify songs..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search Spotify songs"
            />

            <button
              className="btn btn-primary"
              type="submit"
              disabled={searching || !query.trim()}
            >
              {searching ? "Searching..." : "Search"}
            </button>
          </form>

          {message && (
            <p className="join-room-message" role="status">
              {message}
            </p>
          )}

          {results.length > 0 && (
            <div className="join-room-results" aria-label="Search results">
              {results.map((song) => (
                <article
                  key={song.spotifyId}
                  className="join-room-result"
                >
                  {song.imageUrl && (
                    <img
                      src={song.imageUrl}
                      alt=""
                      width={60}
                      height={60}
                    />
                  )}

                  <div className="join-room-song-details">
                    <strong>{song.title}</strong>
                    <span>{song.artist}</span>
                  </div>

                  <button
                    className="btn btn-success"
                    type="button"
                    disabled={addingId !== null}
                    onClick={() => void handleAddSong(song.spotifyId)}
                  >
                    {addingId === song.spotifyId
                      ? "Adding..."
                      : "Add to Queue"}
                  </button>
                </article>
              ))}
            </div>
          )}

          {!searching && results.length === 0 && (
            <p className="join-room-empty">
              Search for a song to add it to the party queue.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

export default JoinRoom;