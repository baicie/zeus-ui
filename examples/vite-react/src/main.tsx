/* eslint-disable no-restricted-globals */
import type { InputElement } from '@zeus-web/input/react'
import { Input } from '@zeus-web/input/react'
import React, { useRef, useState } from 'react'

import ReactDOM from 'react-dom/client'

const styles = {
  container: {
    fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
    padding: '2rem',
    background: '#f5f5f5',
    color: '#333',
    minHeight: '100vh',
  },
  card: {
    background: '#fff',
    padding: '1.5rem',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0,0,0,.1)',
    maxWidth: '400px',
  },
  title: { fontSize: '1.5rem', marginBottom: '1.5rem' },
  subtitle: { fontSize: '1rem', marginBottom: '1rem', color: '#666' },
  value: { marginTop: '1rem', fontSize: '.875rem', color: '#666' },
}

function App() {
  const [value, setValue] = useState('')
  const inputRef = useRef<InputElement>(null)

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Zeus Web - React Demo</h1>
      <div style={styles.card}>
        <h2 style={styles.subtitle}>Input 组件（React）</h2>
        <Input
          ref={inputRef}
          placeholder="请输入内容..."
          value={value}
          onValueChange={event => {
            setValue(event.detail.value)
          }}
        />
        <p style={styles.value}>
          当前值：
          <span style={{ color: '#333', fontWeight: 500 }}>
            {value || '(空)'}
          </span>
        </p>
      </div>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
