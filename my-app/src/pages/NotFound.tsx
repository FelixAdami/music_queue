import { Link } from "react-router-dom";
import "../style/NotFound.css";

function NotFound() {
  return (
    <main className="not-found-page">
      <section className="not-found-card" aria-labelledby="not-found-title">
        <p className="not-found-eyebrow">404 - Page not found</p>
        <h1 id="not-found-title">This page wandered off.</h1>
        <p className="not-found-message">
          The link may be incorrect, or the page may have moved.
        </p>
        <Link className="not-found-home-link" to="/">
          Back to the home page
          <span aria-hidden="true">&gt;</span>
        </Link>
      </section>
    </main>
  );
}

export default NotFound;
