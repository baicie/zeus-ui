export function StateMatrix(props: { states: string[] }) {
  if (props.states.length === 0) {
    return <div className="showcase-empty">No states documented yet.</div>
  }

  return (
    <div className="showcase-state-matrix">
      {props.states.map(state => (
        <div key={state} className="showcase-state-cell">
          <span className="showcase-badge">{state}</span>
          <div className="showcase-state-preview">
            <span>{state}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
