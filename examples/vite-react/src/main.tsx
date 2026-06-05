/* eslint-disable no-restricted-globals */
import { Input } from '@zeus-web/input/react'
import React, { useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom/client'

const styles = {
  container: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
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
  const inputRef = useRef<HTMLElement>(null)

  // React 不会自动监听 <zw-input> 的 'value-change' 自定义事件
  // 需要手动通过 addEventListener 绑定
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    const handler = (e: Event) => {
      setValue((e as CustomEvent<{ value: string }>).detail.value)
    }
    el.addEventListener('value-change', handler)
    return () => el.removeEventListener('value-change', handler)
  }, [])

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Zeus Web - React Demo</h1>
      <div style={styles.card}>
        <h2 style={styles.subtitle}>Input 组件（React）</h2>
        <Input ref={inputRef} placeholder="请输入内容..." value={value} />
        <p style={styles.value}>
          当前值:{' '}
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
