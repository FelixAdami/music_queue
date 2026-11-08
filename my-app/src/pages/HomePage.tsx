import { Link } from "react-router-dom";
import "../style/HomePageAlternative.css";

function HomePage() {
  return (
    <main className="home-page">
      <div className="home-content">
        <section className="home-hero" aria-labelledby="home-title">
          <p className="home-eyebrow">shared music queue</p>
          <h1 id="home-title">
            Make your next gathering a little more musical.
          </h1>
          <p className="home-intro">
            Start a room, share the code, and let everyone help shape what plays
            next.
          </p>
          <Link className="home-host-link" to="/host">
            Host a room <span aria-hidden="true">&gt;</span>
          </Link>
        </section>

        <section className="home-options" aria-label="Ways to join or host">
          <article className="home-option">
            <p className="home-option-label">For hosts</p>
            <h2>Bring the room together</h2>
            <p>
              Connect Spotify to create a room and show guests its join QR code.
            </p>
          </article>

          <article className="home-option home-guest-option">
            <p className="home-option-label">For guests</p>
            <h2>Join the queue</h2>
            <p>Scan the host QR code</p>

            {/*  or enter the room code below.</p>
            <form className="home-join-form" onSubmit={handleJoinRoom}>
              <label htmlFor="room-code">Room code</label>
              <div className="home-join-controls">
                <input
                  id="room-code"
                  name="roomCode"
                  value={roomId}
                  onChange={(event) => {
                    setRoomId(event.target.value);
                    setError("");
                  }}
                  placeholder="Paste a room ID"
                  autoComplete="off"
                  required
                />
                <button type="submit">Join</button>
              </div>
              {error && (
                <p className="home-form-error" role="alert">
                  {error}
                </p>
              )}
            </form>
            */}
          </article>
        </section>

        <footer className="home-footer">
          <span>Made for good company and better playlists.</span>
        </footer>
      </div>
    </main>
  );
}

export default HomePage;
