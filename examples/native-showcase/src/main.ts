/* eslint-disable no-restricted-globals */
import { renderNativeShowcase } from './showcase'
import './styles.css'
import '@zeus-web/ui'

const root = document.querySelector<HTMLDivElement>('#app')

if (!root) {
  throw new Error('Missing #app root element')
}

renderNativeShowcase(root)
