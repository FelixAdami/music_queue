import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { joinRoom as joinRoomRequest } from "../api/client";

function JoinRoom() {
  const { roomId } = useParams<{ roomId: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function handleJoinRoom() {
      try {
        await joinRoomRequest(roomId!);
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
        setLoading(false);
      }
    }

    if (roomId) {
      handleJoinRoom();
    } else {
      setError("Room ID is missing");
      setLoading(false);
    }
  }, [roomId]);

  if (loading) return <p>Joining room...</p>;
  if (error) return <p>{error}</p>;

  return (
    <div>
      <h1>You've joined room {roomId}!</h1>
      <p>Search for songs and add them to the queue.</p>

      {/* Your guest music queue UI goes here */}
    </div>
  );
}

export default JoinRoom;
