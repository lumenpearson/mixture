"use client"

/* last-resort boundary for failures inside the root layout itself; it must
   render its own <html> and cannot use the app providers */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ru">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          background: "#05070c",
          color: "#f5f7fb",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        }}
      >
        <div style={{ maxWidth: 520, padding: 32, borderRadius: 24, border: "1px solid #22304a", background: "#101624" }}>
          <p style={{ fontSize: 11, letterSpacing: "0.3em", textTransform: "uppercase", color: "#5f6b82", margin: 0 }}>
            500 / something broke
          </p>
          <h1 style={{ fontSize: 26, margin: "12px 0 8px", textTransform: "lowercase" }}>что-то пошло не так</h1>
          <p style={{ color: "#a2aec5", fontSize: 13, lineHeight: 1.6, margin: 0 }}>
            приложение не смогло отрисоваться. попробуйте ещё раз или вернитесь на главную.
          </p>
          {error.digest ? <p style={{ color: "#5f6b82", fontSize: 11 }}>digest · {error.digest}</p> : null}
          <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
            <button
              type="button"
              onClick={reset}
              style={{ borderRadius: 14, border: 0, background: "#f5f7fb", color: "#05070c", padding: "10px 16px", fontFamily: "inherit", cursor: "pointer" }}
            >
              повторить
            </button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- global-error renders without the app router */}
            <a href="/" style={{ borderRadius: 14, border: "1px solid #22304a", color: "#f5f7fb", padding: "10px 16px", textDecoration: "none" }}>
              на главную
            </a>
          </div>
        </div>
      </body>
    </html>
  )
}
