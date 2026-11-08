import { useRef, useState } from "react";
import { getCurrentSongGenre, type SongGenre } from "../api/client";
import "../style/SongGenreInfo.css";

type Props = {
  roomId: string;
  songId: string;
};

function SongGenreInfo({ roomId, songId }: Props) {
  const [analysis, setAnalysis] = useState<SongGenre | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestInProgress = useRef(false);
  const tooltipId = "song-genre-tooltip-" + songId;

  async function loadGenre() {
    if (analysis || requestInProgress.current) return;

    requestInProgress.current = true;
    setLoading(true);
    setError("");

    try {
      const result = await getCurrentSongGenre(roomId, songId);
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
    <div
      className="song-genre-info"
      onMouseEnter={() => void loadGenre()}
      onFocus={() => void loadGenre()}
    >
      <button
        type="button"
        className="song-genre-trigger"
        aria-label="Show AI genre analysis"
        aria-describedby={tooltipId}
      >
        i
      </button>
      <div id={tooltipId} className="song-genre-tooltip" role="tooltip">
        <strong>Lyrics based AI analysis</strong>
        {loading && <p>Analyzing lyrics...</p>}
        {error && <p>{error}</p>}
        {analysis && (
          <div className="song-genre-details">
            <p><b>Genre:</b> {analysis.genre.join(", ") || "Unknown"}</p>
            <p><b>Subgenres:</b> {analysis.subgenres.join(", ") || "Unknown"}</p>
            <p><b>Themes:</b> {analysis.themes.join(", ") || "Unknown"}</p>
            <p><b>Mood:</b> {analysis.mood.join(", ") || "Unknown"}</p>
            <p><b>Language:</b> {analysis.language || "Unknown"}</p>
            <p><b>Confidence:</b> {Math.round(analysis.confidence * 100)}%</p>
            {analysis.explanation && <p>{analysis.explanation}</p>}
          </div>
        )}
        {!loading && !error && !analysis && (
          <p>Hover or focus here to analyze this song's lyrics.</p>
        )}
      </div>
    </div>
  );
}

export default SongGenreInfo;