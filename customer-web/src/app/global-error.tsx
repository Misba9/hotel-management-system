"use client";

/**
 * Root error UI when the root layout fails. Must define `html` / `body` (App Router).
 */
export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui,sans-serif", margin: 0, padding: "2rem", textAlign: "center" }}>
        <h1 style={{ fontSize: "1.25rem" }}>Something went wrong</h1>
        <p style={{ color: "#64748b", fontSize: "0.875rem" }}>{error.message || "Unexpected error"}</p>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            marginTop: "1rem",
            padding: "0.5rem 1rem",
            borderRadius: "0.5rem",
            border: "none",
            background: "#f97316",
            color: "#fff",
            fontWeight: 600,
            cursor: "pointer"
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
