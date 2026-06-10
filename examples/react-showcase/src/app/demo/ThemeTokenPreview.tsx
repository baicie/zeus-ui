export function ThemeTokenPreview(props: { tokens: string[] }) {
  if (props.tokens.length === 0) {
    return <div className="showcase-empty">No theme tokens documented yet.</div>
  }

  return (
    <div className="showcase-token-grid">
      {props.tokens.map(token => (
        <div key={token} className="showcase-token-card">
          <span className="showcase-badge">{token}</span>
          <div
            className="showcase-token-swatch"
            style={{
              background: `hsl(var(--${token}))`,
            }}
          />
        </div>
      ))}
    </div>
  )
}
