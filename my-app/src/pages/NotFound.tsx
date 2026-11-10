import { Link } from "react-router-dom";
import "../style/NotFound.css";

function NotFound() {
  return (
    <main className="app-page not-found-page">
      <section
        className="app-surface app-surface--bordered not-found-card"
        aria-labelledby="not-found-title"
      >
        <p className="app-eyebrow not-found-eyebrow">404 - Page not found</p>
        <h1 id="not-found-title" className="app-display-title">
          This page wandered off.
        </h1>
        <p className="not-found-message">
          The link may be incorrect, or the page may have moved.
        </p>
        <Link className="app-pill-link not-found-home-link" to="/">
          Back to the home page
          <span aria-hidden="true">&gt;</span>
        </Link>
      </section>
    </main>
  );
}

export default NotFound;
