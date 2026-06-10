/// <reference types="vite/client" />

/* eslint-disable */
// Vue SFC 类型声明
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

// CSS side-effect import
declare module '*.css'
