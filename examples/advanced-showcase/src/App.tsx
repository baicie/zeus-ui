import { Navigate, Route, Routes } from 'react-router-dom'

import { Layout } from './components/Layout'
import { advancedShowcaseRoutes } from './routes'

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        {advancedShowcaseRoutes.map(route => {
          const Component = route.Component

          return (
            <Route key={route.path} path={route.path} element={<Component />} />
          )
        })}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
