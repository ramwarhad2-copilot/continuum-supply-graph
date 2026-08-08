import Link from "next/link";

export default function NotFound() {
  return (
    <main className="standalone-state">
      <span className="eyebrow">404 · Route not found</span>
      <h1>This path is outside the network.</h1>
      <p>Return to the resilience explorer to continue your scenario.</p>
      <Link className="primary-button" href="/">
        Back to Continuum
      </Link>
    </main>
  );
}
