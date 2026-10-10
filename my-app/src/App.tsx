import "./App.css";
import CurrentSong from "./components/CurrentSong";
import NextSongsList from "./components/NextSongsList";

function App() {

  return (
    <>
      <section id="center">
        <div>
          <h1>Currently Playing</h1>
          <p>
            Edit by <b>drag and drop</b> or delete by clicking <b>🗑︎</b>{" "}
          </p>
        </div>
        {/* here we insert song currently playing */}
        <CurrentSong />
        {/* here we have the list of upcoming songs */}
        <NextSongsList />
      </section>
    </>
  );
}

export default App;
