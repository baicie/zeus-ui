import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { AgentPage } from './pages/AgentPage'
import { ChatPage } from './pages/ChatPage'
import { CodingPage } from './pages/CodingPage'
import { FrameworksPage } from './pages/FrameworksPage'
import './styles.css'

const ROUTES = {
  chat: { label: 'S1 · Chat', page: ChatPage },
  agent: { label: 'S2 · Agent', page: AgentPage },
  coding: { label: 'S3 · Coding review', page: CodingPage },
  frameworks: { label: 'React · Vue · WC', page: FrameworksPage },
} as const

type Route = keyof typeof ROUTES

function currentRoute(): Route {
  const name = location.hash.replace('#/', '') as Route
  return name in ROUTES ? name : 'chat'
}

function App() {
  const [route, setRoute] = useState(currentRoute)
  useEffect(() => {
    const onHash = () => setRoute(currentRoute())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  const Page = ROUTES[route].page

  return (
    <>
      <nav aria-label="Stories">
        <strong>Zeus AI Headless V2</strong>
        {(Object.keys(ROUTES) as Route[]).map(name => (
          <a
            key={name}
            href={`#/${name}`}
            aria-current={name === route ? 'page' : undefined}
          >
            {ROUTES[name].label}
          </a>
        ))}
        <span className="badge">API: proposed</span>
      </nav>
      <main>
        <Page />
      </main>
    </>
  )
}

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
