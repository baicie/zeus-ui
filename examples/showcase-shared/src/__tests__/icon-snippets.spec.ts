import type { ShowcaseIcon } from '../types'
import {
  createShowcaseIconSnippet,
  toShowcaseIconComponentName,
} from '../icon-snippets'

const checkIcon: ShowcaseIcon = {
  name: 'check',
  label: 'Check',
  category: 'status',
  tags: ['check', 'success'],
}

const alertTriangleIcon: ShowcaseIcon = {
  name: 'alert-triangle',
  label: 'Alert triangle',
  category: 'status',
  tags: ['warning'],
}

describe('showcase icon snippets', () => {
  it('matches @zeus-web/icons component naming convention', () => {
    expect(toShowcaseIconComponentName('check')).toBe('CheckIcon')
    expect(toShowcaseIconComponentName('alert-triangle')).toBe(
      'AlertTriangleIcon',
    )
    expect(toShowcaseIconComponentName('x')).toBe('XIcon')
  })

  it('creates React import snippet', () => {
    expect(createShowcaseIconSnippet(checkIcon, 'react')).toBe(
      "import { CheckIcon } from '@zeus-web/icons/react'",
    )
  })

  it('creates Vue import snippet', () => {
    expect(createShowcaseIconSnippet(alertTriangleIcon, 'vue')).toBe(
      `<script setup lang="ts">
import { AlertTriangleIcon } from '@zeus-web/icons/vue'
<\/script>`,
    )
  })

  it('creates Web Component usage snippet', () => {
    expect(createShowcaseIconSnippet(checkIcon, 'wc')).toBe(
      `import '@zeus-web/icons/wc'

<zw-icon-check></zw-icon-check>`,
    )
  })

  it('creates raw svg import snippet', () => {
    expect(createShowcaseIconSnippet(checkIcon, 'raw')).toBe(
      "import CheckIconSvg from '@zeus-web/icons/svg/check.svg?raw'",
    )
  })
})
