import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError, getRoomHostStatus } from "../api/client";
import CurrentSong from "../components/CurrentSong";
import HostQrCode from "../components/HostQrCode";
import NextSongsList from "../components/NextSongsList";
import SongSearch from "../components/SongSearch";
import "../style/HostRoom.css";

type HostCheck =
  | { roomId: string; status: "loading" }
  | { roomId: string; status: "authorized" }
  | { roomId: string; status: "error"; message: string };

function getHostCheckError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return "Sign in with Spotify to access the host dashboard.";
    }
    if (error.status === 403) {
      return "Only this room's host can access the dashboard.";
    }
    if (error.status === 404) {
      return "This room could not be found.";
    }
    return error.message;
  }

  return "Could not connect to the server. Check your connection and try again.";
}

function HostRoom() {
  const { roomId } = useParams<{ roomId: string }>();
  const currentRoomId = roomId ?? "";
  const [hostCheck, setHostCheck] = useState<HostCheck>({
    roomId: currentRoomId,
    status: "loading",
  });

  useEffect(() => {
    let isCurrentRequest = true;

    if (!roomId) {
      setHostCheck({
        roomId: currentRoomId,
        status: "error",
        message: "Room ID is missing.",
      });
      return () => {
        isCurrentRequest = false;
      };
    }

    setHostCheck({ roomId, status: "loading" });

    getRoomHostStatus(roomId)
      .then(() => {
        if (isCurrentRequest) {
          setHostCheck({ roomId, status: "authorized" });
        }
      })
      .catch((error: unknown) => {
        if (isCurrentRequest) {
          setHostCheck({
            roomId,
            status: "error",
            message: getHostCheckError(error),
          });
        }
      });

    return () => {
      isCurrentRequest = false;
    };
  }, [roomId, currentRoomId]);

  if (hostCheck.roomId !== currentRoomId || hostCheck.status === "loading") {
    return (
      <main className="app-page host-room-page">
        <div className="host-room-shell">
          <section
            className="app-surface app-surface--bordered host-room-state-card"
            role="status"
          >
            <p className="app-eyebrow host-room-eyebrow">Room control</p>
            <h1 className="app-display-title">Checking host access</h1>
            <p>Connecting to your room...</p>
          </section>
        </div>
      </main>
    );
  }

  if (hostCheck.status === "error") {
    return (
      <main className="app-page host-room-page">
        <div className="host-room-shell">
          <section
            className="app-surface app-surface--bordered host-room-state-card"
            aria-labelledby="host-room-error-title"
          >
            <p className="app-eyebrow host-room-eyebrow">Room control</p>
            <h1 id="host-room-error-title" className="app-display-title">
              Unable to open host dashboard
            </h1>
            <p className="host-room-error" role="alert">
              {hostCheck.message}
            </p>
            <Link className="app-pill-link host-room-home-link" to="/">
              Return to the home page
            </Link>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="app-page host-room-page">
      <div className="host-room-shell">
        {/* ev. Überschrift löschen - überflüssig? */}
        <header className="app-surface app-surface--bordered host-room-header">
          <div>
            <p className="app-eyebrow host-room-eyebrow">Room control</p>
            <h1 className="app-display-title">Host dashboard</h1>
          </div>
          <div className="host-room-code">
            <span>Room code</span>
            <code>{currentRoomId}</code>
          </div>
        </header>

        <div className="host-room-layout">
          <section
            className="app-surface app-surface--bordered host-room-card host-room-qr"
            aria-label="Guest join information"
          >
            <HostQrCode roomId={currentRoomId} />
          </section>

          <div className="host-room-main">
            <section
              className="app-surface app-surface--bordered host-room-card host-room-current"
              aria-labelledby="host-current-heading"
            >
              <div className="host-room-card-heading">
                <p className="app-eyebrow host-room-eyebrow">Playback</p>
                <h2 id="host-current-heading">Currently playing</h2>
              </div>
              <CurrentSong roomId={currentRoomId} />
            </section>

            <div className="host-room-lower-grid">
              <section
                className="app-surface app-surface--bordered host-room-card host-room-queue"
                aria-label="Upcoming songs"
              >
                <NextSongsList roomId={currentRoomId} />
              </section>
              <section
                className="app-surface app-surface--bordered host-room-card host-room-search"
                aria-label="Add songs"
              >
                <SongSearch roomId={currentRoomId} />
              </section>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default HostRoom;
