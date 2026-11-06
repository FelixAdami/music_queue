import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError, getRoomHostStatus } from "../api/client";
import CurrentSong from "../components/CurrentSong";
import HostQrCode from "../components/HostQrCode";
import NextSongsList from "../components/NextSongsList";
import SongSearch from "../components/SongSearch";

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
    return <p>Checking host access...</p>;
  }

  if (hostCheck.status === "error") {
    return (
      <main className="container py-4">
        <h1>Unable to open host dashboard</h1>
        <p role="alert">{hostCheck.message}</p>
        <Link to="/">Return to the home page</Link>
      </main>
    );
  }

  return (
    <>
      <h1>Host Dashboard</h1>
      <p>Room: {currentRoomId}</p>

      <div className="row min-vh-100">
        <section className="col align-self-center">
          <HostQrCode roomId={currentRoomId} />
        </section>
        <section className="col" id="center">
          <div>
            <h2>Currently Playing</h2>
          </div>
          <CurrentSong roomId={currentRoomId} />
<NextSongsList roomId={currentRoomId} />
<SongSearch roomId={currentRoomId} />
        </section>
      </div>
    </>
  );
}

export default HostRoom;
