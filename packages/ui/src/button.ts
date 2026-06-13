// Inline registration for zw-button.
// This file contains the full registration code, avoiding bundler tree-shaking issues.
// It is NOT imported by index.ts — consumers must explicitly import this file
// or @zeus-web/ui/button to register the custom element.
import '@zeus-web/button/wc/auto'
import '@zeus-web/themes/default.css'
import './button.css'
