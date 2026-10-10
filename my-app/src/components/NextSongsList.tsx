import "../style/NextSongsList.css";
import NextSong from "./NextSong";
// for now import img like this
import coverImg2 from "../assets/Smokey_Eye.jpg";
import coverImg3 from "../assets/Sunflower.jpg";

function NextSongsList() {
  return (
    <div id="nextSongsList">
      {NextSong("New Moon", "Tabber", 134000, coverImg2)}
      {NextSong("Sunflower", "Tamino", 200000, coverImg3)}
    </div>
  );
}

export default NextSongsList;
