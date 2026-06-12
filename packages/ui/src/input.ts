// Inline registration for zw-input.
// This file contains the full registration code, avoiding bundler tree-shaking issues.
// It is NOT imported by index.ts — consumers must explicitly import this file
// or @zeus-web/ui/input to register the custom element.
import '@zeus-web/input/wc/auto'
import '@zeus-web/themes/default.css'
import './input.css'
