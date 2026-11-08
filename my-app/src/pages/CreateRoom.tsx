import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ApiError,
  createRoom,
  getCurrentSpotifyUser,
  startSpotifyLogin,
  type SpotifyUser,
} from "../api/client";
import "../style/CreateRoom.css";

function CreateRoom() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [spotifyUser, setSpotifyUser] = useState<SpotifyUser | null>(null);
  const [checkingSpotify, setCheckingSpotify] = useState(true);
  const [roomName, setRoomName] = useState("");
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let isCurrentRequest = true;

    if (searchParams.get("spotify") === "denied") {
      setError(
        "Spotify connection was cancelled. Connect Spotify to host a room.",
      );
    }

    getCurrentSpotifyUser()
      .then((user) => {
        if (isCurrentRequest) {
          setSpotifyUser(user);
        }
      })
      .catch((requestError: unknown) => {
        if (!isCurrentRequest) return;

        setSpotifyUser(null);
        if (
          !(requestError instanceof ApiError && requestError.status === 401)
        ) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Could not check your Spotify connection.",
          );
        }
      })
      .finally(() => {
        if (isCurrentRequest) {
          setCheckingSpotify(false);
        }
      });

    return () => {
      isCurrentRequest = false;
    };
  }, [searchParams]);

  async function handleCreateRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const trimmedName = roomName.trim();
    if (!trimmedName) {
      setError("Enter a party name before creating the room.");
      return;
    }

    setCreatingRoom(true);
    try {
      const room = await createRoom(trimmedName);
      navigate(`/room/${encodeURIComponent(room._id)}`);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not create the room. Please try again.",
      );
    } finally {
      setCreatingRoom(false);
    }
  }

  if (checkingSpotify) {
    return (
      <main className="create-room-page">
        <div className="create-room-content">
          <section
          className="create-room-card"
          aria-labelledby="create-room-title"
          >
            <p className="create-room-eyebrow">Spotify setup</p>
            <h1 id="create-room-title">Create a music room</h1>
            <p className="create-room-status" role="status">
              Checking your Spotify connection...
            </p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="create-room-page">
      <div className="create-room-content">
        <section
          className="create-room-card"
          aria-labelledby="create-room-title"
        >
          <p className="create-room-eyebrow">Spotify setup</p>
          <h1 id="create-room-title">Create a music room</h1>

          {error && (
            <p className="create-room-error" role="alert">
              {error}
            </p>
          )}

          {!spotifyUser ? (
            <div className="create-room-body">
              <p>Connect Spotify to create and host a room.</p>
              <button
                className="create-room-button"
                type="button"
                onClick={startSpotifyLogin}
              >
                Connect Spotify
              </button>
            </div>
          ) : (
            <>
              <p className="create-room-status">
                Connected to Spotify as{' '}
                {spotifyUser.displayName || spotifyUser.id}.
              </p>
              <form className="create-room-form" onSubmit={handleCreateRoom}>
                <label htmlFor="party-name">Party name</label>
                <input
                  id="party-name"
                  name="partyName"
                  value={roomName}
                  onChange={(event) => setRoomName(event.target.value)}
                  maxLength={100}
                  required
                />
                <button
                  className="create-room-button"
                  type="submit"
                  disabled={creatingRoom}
                >
                  {creatingRoom ? "Creating room..." : "Create music room"}
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

export default CreateRoom;
