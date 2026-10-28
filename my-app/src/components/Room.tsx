import CurrentSong from "./CurrentSong";
import NextSongsList from "./NextSongsList";
import HostQrCode from "./HostQrCode";
import { useState } from "react";

function Room({ roomId }: { roomId: string }) {
  {
    /* 
  const [roomId, setRoomId] = useState(
    new URLSearchParams(window.location.search).get("room") ?? "",
  );
  */
  }
  return (
    <div className="row min-vh-100">
      <section className="col align-self-center">
        <HostQrCode roomId={roomId} />
      </section>
      <section className="col" id="center">
        <div>
          <h1>Currently Playing</h1>
          <p>
            Edit by <b>drag and drop</b> or delete by clicking <b>🗑</b>{" "}
          </p>
        </div>
        {/* here we insert song currently playing */}
        <CurrentSong />
        {/* here we have the list of upcoming songs */}
        <NextSongsList />
        {/*         
        <label htmlFor="room-id">Room ID</label>
        <input
          id="room-id"
          value={roomId}
          onChange={(event) => setRoomId(event.target.value)}
          placeholder="Enter a room ID"
        />
         */}
      </section>
    </div>
  );
}

export default Room;
