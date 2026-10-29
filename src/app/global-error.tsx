"use client";

/** Last-resort error screen (replaces the root layout, so it styles itself). */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en-MT">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background: "#080808",
          color: "#ffffff",
          fontFamily: "system-ui, -apple-system, Segoe UI, Arial, sans-serif",
          display: "grid",
          placeItems: "center",
          padding: "2rem",
        }}
      >
        <main style={{ maxWidth: 560 }}>
          <p style={{ letterSpacing: "0.22em", textTransform: "uppercase", fontSize: 12, color: "#a3a3a3", margin: 0 }}>MC PREPS</p>
          <h1 style={{ fontSize: 40, lineHeight: 1, textTransform: "uppercase", fontWeight: 900, margin: "24px 0 16px" }}>
            Something went wrong.
          </h1>
          <p style={{ color: "#d4d4d4", lineHeight: 1.6 }}>Please try again in a moment. If the problem continues, contact us on WhatsApp or Instagram.</p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 24,
              height: 48,
              padding: "0 24px",
              background: "#ffffff",
              color: "#080808",
              border: 0,
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          {error.digest && <p style={{ marginTop: 32, fontSize: 12, color: "#a3a3a3" }}>Reference: {error.digest}</p>}
        </main>
      </body>
    </html>
  );
}
