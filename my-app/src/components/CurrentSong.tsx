import coverImg from "../assets/Even_in_Arcadia.jpg";
import "../style/CurrentSong.css";
import Timestamp from "../helpers/Timestamp";

function CurrentSong() {
  {
    /* these should be fetched from the DB */
  }
  const songName = "Even in Arcadia";
  const artistName = "SleepToken";
  const timeTotal = 125000;
  const timeDone = 25000; // add here something that counts
  const timeLeft = timeTotal - timeDone;
  const progress = (timeDone / timeTotal) * 100;

  return (
    <div
      id="currentSong"
      className="d-flex align-items-center gap-3 p-3 rounded-4 bg-dark text-white shadow"
    >
      <img
        src={coverImg}
        className="rounded-3 flex-shrink-0"
        width={120}
        height={120}
        style={{ objectFit: "cover" }}
        alt="Song cover"
      />
      <div className="flex-grow-1">
        <div className="d-flex align-items-center justify-content-between">
          <div>
            <h2>{songName}</h2>
            <h3>{artistName}</h3>
          </div>
          <div className="pe-3">
            <h2>
              <pre>
                <button className="btn">⏮</button> {} <button className="btn">▶</button> {} <button className="btn">⏭</button>
              </pre>
            </h2>
          </div>
        </div>

        <div className="d-flex align-items-center gap-2 mt-4">
          <small className="text-secondary">{Timestamp(timeDone)}</small>

          <div className="progress flex-grow-1" style={{ height: "5px" }}>
            <div
              className="progress-bar bg-success"
              style={{ width: `${progress}%` }}
            />
          </div>

          <small className="text-secondary">{Timestamp(timeLeft)}</small>
        </div>
      </div>
    </div>
  );
}

export default CurrentSong;
