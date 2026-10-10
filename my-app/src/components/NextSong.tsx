import Timestamp from "../helpers/Timestamp";

// also add option to add img as a parameter - format beachten - bisher als address-string
function NextSong(Song: string, Artist: string, Time: number, Img: string) {
  const songName = Song;
  const artistName = Artist;
  const timeTotal = Time;

  return (
    <>
      <div className="d-flex align-items-center gap-3 rounded-4 bg-dark text-white shadow">
        {/* wrap this inside btn later too */}
        <button className="btn">
          <h1 className="drag-drop ps-3">⁘</h1>
        </button>

        <img
          src={Img}
          className="rounded-3 flex-shrink-0"
          width={80}
          height={80}
          style={{ objectFit: "cover" }}
          alt="Song cover"
        />
        <div className="flex-grow-1">
          <h4>{songName}</h4>
          <h5>
            <pre>
              {artistName} {} · {} {Timestamp(timeTotal)}
            </pre>
          </h5>
        </div>

        {/* wrap can inside a button later*/}
        <button className="btn">
          <h2 className="bin pe-4">🗑︎</h2>
        </button>
      </div>
    </>
  );
}

export default NextSong;
