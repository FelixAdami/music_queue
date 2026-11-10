import { useRef, useState } from "react";
import { getSongGenre, type SongGenre } from "../api/client";
import "../style/SongGenreInfo.css";

type Props = {
  roomId: string;
  songId: string;
};

function SongGenreInfo({ roomId, songId }: Props) {
  const [analysis, setAnalysis] = useState<SongGenre | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const requestInProgress = useRef(false);
  const tooltipId = "song-genre-tooltip-" + songId;

  async function loadGenre() {
    if (analysis || requestInProgress.current) return;

    requestInProgress.current = true;
    setLoading(true);
    setError("");

    try {
      const result = await getSongGenre(roomId, songId);
      setAnalysis(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not analyze song lyrics",
      );
    } finally {
      requestInProgress.current = false;
      setLoading(false);
    }
  }

  return (
    <div className={isOpen ? "song-genre-info is-open" : "song-genre-info"}>
      <button
        type="button"
        className="song-genre-trigger"
        aria-label={isOpen ? "Hide genre and theme analysis" : "Show genre and theme analysis"}
        aria-expanded={isOpen}
        aria-controls={tooltipId}
        onClick={() => {
          const opening = !isOpen;
          setIsOpen(opening);
          if (opening) void loadGenre();
        }}
      >
        i
      </button>
      <div id={tooltipId} className="song-genre-tooltip" role="region" aria-label="Genre and theme analysis">
        <strong>Lyrics based genre and theme analysis</strong>
        {loading && <p>Analyzing lyrics...</p>}
        {error && <p>{error}</p>}
        {analysis && (
          <div className="song-genre-details">
            <p><b>Genres:</b> {analysis.genres.join(", ") || "Unknown"}</p>
            <p><b>Themes:</b> {analysis.themes.join(", ") || "Unknown"}</p>
          </div>
        )}
        {!loading && !error && !analysis && (
          <p>Click to analyze this song's lyrics.</p>
        )}
      </div>
    </div>
  );
}

export default SongGenreInfo;