/* eslint-disable no-restricted-globals */
import type { InputElement } from '@zeus-web/input/react'
import { Input } from '@zeus-web/input/react'
import React, { useRef, useState } from 'react'
import ReactDOM from 'react-dom/client'

import '@zeus-web/themes/default.css'

function App() {
  const [value, setValue] = useState('')
  const inputRef = useRef<InputElement>(null)

  return (
    <div className="page">
      <h1 className="title">Zeus Web - React Demo</h1>
      <div className="card">
        <h2 className="subtitle">Input 组件（React）</h2>
        <Input
          ref={inputRef}
          placeholder="请输入内容..."
          value={value}
          onValueChange={event => {
            setValue(event.detail.value)
          }}
        />
        <p className="value-text">
          当前值：
          <span className="value-display">{value || '(空)'}</span>
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
