import { useParams } from "react-router-dom";
import CurrentSong from "../components/CurrentSong";
import NextSongsList from "../components/NextSongsList";
import HostQrCode from "../components/HostQrCode";

function HostRoom() {
  const { roomId = "" } = useParams<{ roomId: string }>();
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

export default HostRoom;
