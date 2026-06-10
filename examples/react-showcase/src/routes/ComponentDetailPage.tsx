import { useParams } from '@tanstack/react-router'
import { showcaseComponents } from '@zeus-web/example-showcase-shared'

import { ComponentPageScaffold } from '../app/demo/ComponentPageScaffold'
import { p0ReactDemoPages } from '../demos/p0'

export function ComponentDetailPage() {
  const { componentName } = useParams({
    from: '/components/$componentName',
  })

  const component = showcaseComponents.find(item => item.name === componentName)

  if (!component) {
    return (
      <div className="showcase-page">
        <div className="showcase-empty">
          Component &quot;
          {componentName}
          &quot; is not part of the current showcase metadata.
        </div>
      </div>
    )
  }

  const P0DemoPage = p0ReactDemoPages[component.name]

  if (P0DemoPage) {
    return <P0DemoPage />
  }

  return <ComponentPageScaffold component={component} />
}
