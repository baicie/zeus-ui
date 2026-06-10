export function PlaygroundPage() {
  return (
    <div className="showcase-page">
      <header className="showcase-page-header">
        <p className="showcase-eyebrow">Playground</p>
        <h1 className="showcase-title">Production composition playground</h1>
        <p className="showcase-description">
          This route will host production-like composed scenarios in later
          phases: admin dashboard, settings form and project creation flow.
        </p>
      </header>

      <section className="showcase-grid showcase-grid-3">
        <Scenario
          title="Admin dashboard"
          description="Cards, badges, progress, alerts and icons."
        />
        <Scenario
          title="Settings form"
          description="Labels, inputs, selects, checkboxes, switches and validation."
        />
        <Scenario
          title="Project creation"
          description="Dialog, form controls, tooltips and event logs."
        />
      </section>
    </div>
  )
}

function Scenario(props: { title: string; description: string }) {
  return (
    <div className="showcase-card">
      <h2 className="showcase-card-title">{props.title}</h2>
      <p className="showcase-card-description">{props.description}</p>
      <span className="showcase-badge">planned</span>
    </div>
  )
}
