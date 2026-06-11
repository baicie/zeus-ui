export interface PropTableRow {
  name: string
  type: string
  defaultValue?: string
  description: string
}

export function PropTable(props: { rows: PropTableRow[] }) {
  if (props.rows.length === 0) {
    return <div className="showcase-empty">No props documented yet.</div>
  }

  return (
    <div className="showcase-table-wrap">
      <table className="showcase-table">
        <thead>
          <tr>
            <th>Prop</th>
            <th>Type</th>
            <th>Default</th>
            <th>Description</th>
          </tr>
        </thead>

        <tbody>
          {props.rows.map(row => (
            <tr key={row.name}>
              <td>
                <code>{row.name}</code>
              </td>
              <td>
                <code>{row.type}</code>
              </td>
              <td>
                {row.defaultValue ? <code>{row.defaultValue}</code> : '—'}
              </td>
              <td>{row.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
