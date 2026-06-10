export function ImportSnippet(props: { title: string; value?: string }) {
  return (
    <div className="showcase-card">
      <h3 className="showcase-card-title">{props.title}</h3>
      <pre className="showcase-code">{props.value ?? 'Not planned'}</pre>
    </div>
  )
}
