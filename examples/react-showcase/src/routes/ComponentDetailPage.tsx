import { useParams } from '@tanstack/react-router'
import { showcaseComponents } from '@zeus-web/example-showcase-shared'

import { ComponentPageScaffold } from '../app/demo/ComponentPageScaffold'

export function ComponentDetailPage() {
  const { componentName } = useParams({
    from: '/components/$componentName',
  })

  const component = showcaseComponents.find(item => item.name === componentName)

  if (!component) {
    return (
      <div className="showcase-page">
        <div className="showcase-empty">
          {/* eslint-disable-next-line style/jsx-one-expression-per-line */}
          Component &quot;{componentName}&quot; is not part of the current
          showcase metadata.
        </div>
      </div>
    )
  }

  return <ComponentPageScaffold component={component} />
}
