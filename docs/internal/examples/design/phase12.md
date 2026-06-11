下面给 Phase 12：**Unit Test 完整化**。
这一阶段只做测试闭环，不继续加新页面，不做 Playwright，那是 Phase 13。

当前仓库已有基础：根脚本里已经有 `showcase:test` 串行跑 React/Vue showcase 测试，`site:check` 也会跑 `showcase:test`。 两个 showcase 包的 `test` 也都会先 `build:deps --force` 再跑 Vitest。
Vitest 已有 `unit` / `unit-jsdom` / `canary` / `e2e` 项目配置。

但当前 Phase 9–11 测试还不完整：Icons 已经覆盖搜索、分类、复制、预览控件。 Themes 只覆盖基础切换和复制。 Playground 目前只覆盖场景切换和文本存在，没覆盖发布进度、事件日志、表单校验等真实交互。 Vue Playground 也是同样浅覆盖。

---

# Phase 12 目标

```txt id="p12-goal"
Phase 12 = Unit Test 完整化

覆盖范围：
  1. shared metadata / helper 纯函数测试
  2. React route smoke tests
  3. Vue route smoke tests
  4. React foundation pages interaction tests
  5. Vue foundation pages interaction tests
  6. Playground stateful interaction tests
  7. Roadmap 更新

不做：
  - Playwright 浏览器 E2E
  - visual snapshots
  - CI workflow 调整
```

---

# Phase 12 测试矩阵

```txt id="p12-matrix"
Shared:
  - implemented component list 无重复
  - playground scenario 可 fallback
  - icon snippet 命名正确：CheckIcon，不是 IconCheck
  - theme style 生成完整 semantic token
  - theme snippet 生成正确

React:
  - / /components /icons /themes /playground smoke
  - 所有 implemented component detail routes smoke
  - IconsPage interaction
  - ThemesPage interaction
  - PlaygroundPage interaction

Vue:
  - / /components /icons /themes /playground smoke
  - 所有 implemented component detail routes smoke
  - IconsPage interaction
  - ThemesPage interaction
  - PlaygroundPage interaction
```

---

# 1. 新增 React 测试工具

## `examples/react-showcase/src/test-utils/custom-events.ts`

```ts id="react-custom-events"
import { fireEvent, screen } from '@testing-library/react'

export function dispatchZeusEvent(
  element: Element,
  name: string,
  detail: Record<string, unknown> = {},
): void {
  fireEvent(
    element,
    new CustomEvent(name, {
      bubbles: true,
      composed: true,
      detail,
    }),
  )
}

export function getCustomElementByText(
  text: string | RegExp,
  tagName: string,
): Element {
  const node = screen.getByText(text)
  const element = node.closest(tagName)

  if (!element) {
    throw new Error(`Unable to find ${tagName} closest to ${String(text)}.`)
  }

  return element
}

export function mockClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined)

  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText,
    },
  })

  return writeText
}
```

## `examples/react-showcase/src/test-utils/render-route.tsx`

```tsx id="react-render-route"
import { RouterProvider } from '@tanstack/react-router'
import { render } from '@testing-library/react'

import { createShowcaseRouter } from '../router'

export async function renderReactShowcaseRoute(initialPath: string) {
  const router = createShowcaseRouter({
    initialPath,
  })

  const result = render(<RouterProvider router={router} />)

  await router.load()

  return {
    router,
    ...result,
  }
}
```

---

# 2. 新增 Vue 测试工具

## `examples/vue-showcase/src/test-utils/custom-events.ts`

```ts id="vue-custom-events"
import type { VueWrapper } from '@vue/test-utils'

export function dispatchZeusEvent(
  element: Element,
  name: string,
  detail: Record<string, unknown> = {},
): void {
  element.dispatchEvent(
    new CustomEvent(name, {
      bubbles: true,
      composed: true,
      detail,
    }),
  )
}

export async function emitZeusEvent(
  wrapper: VueWrapper,
  selector: string,
  name: string,
  detail: Record<string, unknown> = {},
): Promise<void> {
  const element = wrapper.get(selector).element

  dispatchZeusEvent(element, name, detail)

  await wrapper.vm.$nextTick()
}

export function findButtonByText(wrapper: VueWrapper, text: string) {
  const button = wrapper
    .findAll('button')
    .find(item => item.text().includes(text))

  if (!button) {
    throw new Error(`Unable to find button containing "${text}".`)
  }

  return button
}

export function mockClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined)

  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText,
    },
  })

  return writeText
}
```

## `examples/vue-showcase/src/test-utils/mount-route.ts`

```ts id="vue-mount-route"
import { flushPromises, mount } from '@vue/test-utils'

import App from '../App.vue'
import { createShowcaseRouter } from '../router'

export async function mountVueShowcaseRoute(initialPath: string) {
  const router = createShowcaseRouter({
    initialPath,
  })

  const wrapper = mount(App, {
    global: {
      plugins: [router],
    },
  })

  await router.isReady()
  await flushPromises()

  return {
    router,
    wrapper,
  }
}
```

---

# 3. Shared helper 单测

## `examples/showcase-shared/src/__tests__/icon-snippets.spec.ts`

```ts id="shared-icon-tests"
import {
  createShowcaseIconSnippet,
  toShowcaseIconComponentName,
} from '../icon-snippets'
import type { ShowcaseIcon } from '../types'

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
</script>`,
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
```

---

## `examples/showcase-shared/src/__tests__/themes.spec.ts`

```ts id="shared-theme-tests"
import type { SemanticColorToken } from '@zeus-web/themes'
import {
  motionPresetNames,
  radiusPresetNames,
  semanticColorTokens,
  themeNames,
} from '@zeus-web/themes'

import {
  createShowcaseThemeSnippet,
  createShowcaseThemeStyle,
  formatShowcaseThemeTokenCssVar,
  semanticTokens,
  showcaseMotionPresets,
  showcaseRadiusPresets,
  showcaseThemes,
  showcaseThemeModes,
} from '../themes'

describe('showcase themes', () => {
  it('keeps showcase themes aligned with @zeus-web/themes', () => {
    expect(showcaseThemes.map(theme => theme.name)).toEqual(themeNames)
    expect(semanticTokens).toEqual(semanticColorTokens)
    expect(showcaseRadiusPresets.map(item => item.name)).toEqual(
      radiusPresetNames,
    )
    expect(showcaseMotionPresets.map(item => item.name)).toEqual(
      motionPresetNames,
    )
    expect(showcaseThemeModes).toEqual(['light', 'dark'])
  })

  it('creates scoped style with every semantic color token', () => {
    const style = createShowcaseThemeStyle({
      themeName: 'slate',
      mode: 'dark',
      radius: 'lg',
      motion: 'normal',
    })

    for (const token of semanticColorTokens) {
      expect(style[`--${token}`]).toBeTruthy()
    }

    expect(style['--radius']).toBeTruthy()
    expect(style['--zw-duration-normal']).toBeTruthy()
    expect(style['--zw-easing-standard']).toBeTruthy()
  })

  it('formats token usage', () => {
    expect(
      formatShowcaseThemeTokenCssVar('background' as SemanticColorToken),
    ).toBe('hsl(var(--background))')
  })

  it('creates css/html/token snippets', () => {
    const options = {
      themeName: 'zinc',
      mode: 'light',
      radius: 'md',
      motion: 'normal',
    } as const

    expect(createShowcaseThemeSnippet('css', options)).toBe(
      "import '@zeus-web/themes/zinc.css'",
    )
    expect(createShowcaseThemeSnippet('html', options)).toContain(
      'data-theme="zinc"',
    )
    expect(createShowcaseThemeSnippet('tokens', options)).toContain(
      'background: hsl(var(--background));',
    )
  })
})
```

---

## `examples/showcase-shared/src/__tests__/playground.spec.ts`

```ts id="shared-playground-tests"
import {
  getPlaygroundScenario,
  playgroundDashboardServices,
  playgroundProjectTemplates,
  playgroundScenarios,
} from '../playground'

describe('showcase playground metadata', () => {
  it('defines the required Phase 11 scenarios', () => {
    expect(playgroundScenarios.map(scenario => scenario.id)).toEqual([
      'admin-dashboard',
      'settings-form',
      'project-creation',
    ])
  })

  it('keeps every scenario connected to component packages', () => {
    for (const scenario of playgroundScenarios) {
      expect(scenario.components.length).toBeGreaterThan(0)
      expect(
        scenario.components.every(component =>
          component.startsWith('@zeus-web/'),
        ),
      ).toBe(true)
    }
  })

  it('returns fallback scenario for unknown ids', () => {
    expect(getPlaygroundScenario('admin-dashboard').id).toBe('admin-dashboard')

    expect(
      getPlaygroundScenario(
        'unknown' as Parameters<typeof getPlaygroundScenario>[0],
      ).id,
    ).toBe('admin-dashboard')
  })

  it('defines production-like service and template fixtures', () => {
    expect(playgroundDashboardServices.length).toBeGreaterThanOrEqual(3)
    expect(playgroundProjectTemplates.map(template => template.value)).toEqual([
      'component-library',
      'dashboard',
      'docs',
    ])
  })
})
```

---

## `examples/showcase-shared/src/__tests__/implemented.spec.ts`

```ts id="shared-implemented-tests"
import {
  getImplementedShowcaseComponents,
  getImplementedShowcasePackageNames,
  implementedShowcaseComponentNames,
  isImplementedShowcaseComponent,
} from '../implemented'

describe('implemented showcase components', () => {
  it('has unique component names', () => {
    expect(new Set(implementedShowcaseComponentNames).size).toBe(
      implementedShowcaseComponentNames.length,
    )
  })

  it('resolves implemented components and package names', () => {
    const components = getImplementedShowcaseComponents()
    const packageNames = getImplementedShowcasePackageNames()

    expect(components.length).toBe(implementedShowcaseComponentNames.length)
    expect(packageNames.length).toBe(implementedShowcaseComponentNames.length)
    expect(packageNames.every(name => name.startsWith('@zeus-web/'))).toBe(true)
  })

  it('recognizes implemented names', () => {
    expect(isImplementedShowcaseComponent('button')).toBe(true)
    expect(isImplementedShowcaseComponent('not-a-component')).toBe(false)
  })
})
```

---

# 4. React route smoke tests

## `examples/react-showcase/src/__tests__/routes-smoke.test.tsx`

```tsx id="react-route-smoke"
import { screen } from '@testing-library/react'
import { implementedShowcaseComponentNames } from '@zeus-web/example-showcase-shared'

import { renderReactShowcaseRoute } from '../test-utils/render-route'

const staticRoutes = [
  {
    path: '/',
    assertion: /Zeus Web/i,
  },
  {
    path: '/components',
    assertion: /Components/i,
  },
  {
    path: '/icons',
    assertion: /Icons/i,
  },
  {
    path: '/themes',
    assertion: /Themes/i,
  },
  {
    path: '/playground',
    assertion: /Production composition playground/i,
  },
] as const

describe('react showcase routes', () => {
  it.each(staticRoutes)('renders $path', async route => {
    await renderReactShowcaseRoute(route.path)

    expect(screen.getByText(route.assertion)).toBeInTheDocument()
  })

  it.each(implementedShowcaseComponentNames)(
    'renders component route: %s',
    async componentName => {
      const { container } = await renderReactShowcaseRoute(
        `/components/${componentName}`,
      )

      expect(container.textContent).toContain(componentName)
      expect(container.textContent).not.toContain('Not found')
    },
  )

  it('renders not found route for unknown path', async () => {
    const { container } = await renderReactShowcaseRoute('/unknown-route')

    expect(container.textContent).toMatch(/not found/i)
  })
})
```

---

# 5. Vue route smoke tests

## `examples/vue-showcase/src/__tests__/routes-smoke.spec.ts`

```ts id="vue-route-smoke"
import { implementedShowcaseComponentNames } from '@zeus-web/example-showcase-shared'

import { mountVueShowcaseRoute } from '../test-utils/mount-route'

const staticRoutes = [
  {
    path: '/',
    assertion: 'Zeus Web',
  },
  {
    path: '/components',
    assertion: 'Components',
  },
  {
    path: '/icons',
    assertion: 'Icons',
  },
  {
    path: '/themes',
    assertion: 'Themes',
  },
  {
    path: '/playground',
    assertion: 'Production composition playground',
  },
] as const

describe('vue showcase routes', () => {
  it.each(staticRoutes)('renders $path', async route => {
    const { wrapper } = await mountVueShowcaseRoute(route.path)

    expect(wrapper.text()).toContain(route.assertion)
  })

  it.each(implementedShowcaseComponentNames)(
    'renders component route: %s',
    async componentName => {
      const { wrapper } = await mountVueShowcaseRoute(
        `/components/${componentName}`,
      )

      expect(wrapper.text()).toContain(componentName)
      expect(wrapper.text().toLowerCase()).not.toContain('not found')
    },
  )

  it('renders not found route for unknown path', async () => {
    const { wrapper } = await mountVueShowcaseRoute('/unknown-route')

    expect(wrapper.text().toLowerCase()).toContain('not found')
  })
})
```

---

# 6. 替换 React Playground 测试

当前 React Playground 测试只验证场景切换。
替换为交互测试。

## `examples/react-showcase/src/__tests__/PlaygroundPage.test.tsx`

```tsx id="react-playground-test"
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { PlaygroundPage } from '../routes/PlaygroundPage'
import {
  dispatchZeusEvent,
  getCustomElementByText,
} from '../test-utils/custom-events'

describe('react PlaygroundPage', () => {
  it('renders playground scenarios', () => {
    render(<PlaygroundPage />)

    expect(
      screen.getByRole('heading', {
        name: 'Production composition playground',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Admin dashboard/ }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Settings form/ }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Project creation/ }),
    ).toBeInTheDocument()
    expect(screen.getByText('@zeus-web/alert')).toBeInTheDocument()
  })

  it('updates release progress and records event log', () => {
    render(<PlaygroundPage />)

    expect(screen.getByText('68%')).toBeInTheDocument()

    dispatchZeusEvent(getCustomElementByText('Promote', 'zw-button'), 'press')

    expect(screen.getAllByText('78%').length).toBeGreaterThan(0)
    expect(screen.getByText('release-progress')).toBeInTheDocument()
    expect(screen.getByText('+10')).toBeInTheDocument()

    dispatchZeusEvent(getCustomElementByText('Roll back', 'zw-button'), 'press')

    expect(screen.getAllByText('68%').length).toBeGreaterThan(0)
    expect(screen.getByText('-10')).toBeInTheDocument()
  })

  it('switches dashboard environment and records event log', () => {
    render(<PlaygroundPage />)

    dispatchZeusEvent(
      screen.getByLabelText('Dashboard environment'),
      'valueChange',
      {
        value: 'staging',
        values: ['staging'],
      },
    )

    expect(screen.getByText('staging rollout')).toBeInTheDocument()
    expect(screen.getByText('environment-change')).toBeInTheDocument()
    expect(screen.getByText('staging')).toBeInTheDocument()
  })

  it('switches to settings form scenario and validates organization name', async () => {
    const user = userEvent.setup()

    render(<PlaygroundPage />)

    await user.click(screen.getByRole('button', { name: /Settings form/ }))

    expect(
      screen.getByRole('heading', { name: 'Workspace configuration' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Organization name')).toBeInTheDocument()
    expect(screen.getByText('Feature flags')).toBeInTheDocument()
    expect(screen.getByText('Settings ready')).toBeInTheDocument()

    dispatchZeusEvent(
      screen.getByPlaceholderText('Organization name'),
      'valueChange',
      {
        value: 'ze',
      },
    )

    expect(screen.getByText('Validation warning')).toBeInTheDocument()
    expect(screen.getByText('Use at least 3 characters.')).toBeInTheDocument()
    expect(screen.getByText('organization-name-change')).toBeInTheDocument()
  })

  it('switches to project creation scenario and selects template', async () => {
    const user = userEvent.setup()

    render(<PlaygroundPage />)

    await user.click(screen.getByRole('button', { name: /Project creation/ }))

    expect(
      screen.getByRole('heading', { name: 'Create and review projects' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Templates')).toBeInTheDocument()
    expect(screen.getByText('Created projects')).toBeInTheDocument()
    expect(screen.getByText('Component library')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Dashboard app/ }))

    expect(screen.getByText('project-template-change')).toBeInTheDocument()
    expect(screen.getByText('dashboard')).toBeInTheDocument()
  })
})
```

---

# 7. 替换 Vue Playground 测试

当前 Vue Playground 测试也只是场景切换。

## `examples/vue-showcase/src/routes/PlaygroundPage.spec.ts`

```ts id="vue-playground-test"
import { mount } from '@vue/test-utils'

import PlaygroundPage from './PlaygroundPage.vue'
import { emitZeusEvent, findButtonByText } from '../test-utils/custom-events'

describe('vue PlaygroundPage', () => {
  it('renders playground scenarios', () => {
    const wrapper = mount(PlaygroundPage)

    expect(wrapper.text()).toContain('Production composition playground')
    expect(wrapper.text()).toContain('Admin dashboard')
    expect(wrapper.text()).toContain('Settings form')
    expect(wrapper.text()).toContain('Project creation')
    expect(wrapper.text()).toContain('@zeus-web/alert')
  })

  it('updates release progress and records event log', async () => {
    const wrapper = mount(PlaygroundPage)

    expect(wrapper.text()).toContain('68%')

    await emitZeusEvent(
      wrapper,
      'zw-button[aria-label="Promote release"]',
      'press',
    )

    expect(wrapper.text()).toContain('78%')
    expect(wrapper.text()).toContain('release-progress')
    expect(wrapper.text()).toContain('10')

    await emitZeusEvent(
      wrapper,
      'zw-button[aria-label="Roll back release"]',
      'press',
    )

    expect(wrapper.text()).toContain('68%')
    expect(wrapper.text()).toContain('-10')
  })

  it('switches dashboard environment and records event log', async () => {
    const wrapper = mount(PlaygroundPage)

    await emitZeusEvent(
      wrapper,
      '[aria-label="Dashboard environment"]',
      'valueChange',
      {
        value: 'staging',
        values: ['staging'],
      },
    )

    expect(wrapper.text()).toContain('staging rollout')
    expect(wrapper.text()).toContain('environment-change')
    expect(wrapper.text()).toContain('staging')
  })

  it('switches to settings form scenario and validates organization name', async () => {
    const wrapper = mount(PlaygroundPage)

    await findButtonByText(wrapper, 'Settings form').trigger('click')

    expect(wrapper.text()).toContain('Workspace configuration')
    expect(wrapper.text()).toContain('Organization name')
    expect(wrapper.text()).toContain('Feature flags')
    expect(wrapper.text()).toContain('Settings ready')

    await emitZeusEvent(
      wrapper,
      '[placeholder="Organization name"]',
      'valueChange',
      {
        value: 'ze',
      },
    )

    expect(wrapper.text()).toContain('Validation warning')
    expect(wrapper.text()).toContain('Use at least 3 characters.')
    expect(wrapper.text()).toContain('organization-name-change')
  })

  it('switches to project creation scenario and selects template', async () => {
    const wrapper = mount(PlaygroundPage)

    await findButtonByText(wrapper, 'Project creation').trigger('click')

    expect(wrapper.text()).toContain('Create and review projects')
    expect(wrapper.text()).toContain('Templates')
    expect(wrapper.text()).toContain('Created projects')
    expect(wrapper.text()).toContain('Component library')

    await findButtonByText(wrapper, 'Dashboard app').trigger('click')

    expect(wrapper.text()).toContain('project-template-change')
    expect(wrapper.text()).toContain('dashboard')
  })
})
```

---

# 8. 为 Playground 按钮补稳定 selector

上面 Vue 测试用到了稳定的 aria-label。需要同步补到 React/Vue 页面。

## React `examples/react-showcase/src/routes/PlaygroundPage.tsx`

把 Release progress 的两个按钮改成：

```tsx id="react-button-labels"
<Button
  aria-label="Roll back release"
  size="sm"
  variant="outline"
  onPress={() => {
    setReleaseProgress(value => Math.max(0, value - 10))
    logEvent('release-progress', '-10')
  }}
>
  Roll back
</Button>

<Button
  aria-label="Promote release"
  size="sm"
  variant="primary"
  onPress={() => {
    setReleaseProgress(value => Math.min(100, value + 10))
    logEvent('release-progress', '+10')
  }}
>
  Promote
</Button>
```

## Vue `examples/vue-showcase/src/routes/PlaygroundPage.vue`

改成：

```vue id="vue-button-labels"
<Button
  aria-label="Roll back release"
  size="sm"
  variant="outline"
  @press="promoteRelease(-10)"
>
  Roll back
</Button>

<Button
  aria-label="Promote release"
  size="sm"
  variant="primary"
  @press="promoteRelease(10)"
>
  Promote
</Button>
```

---

# 9. 补强 React Themes 测试

## `examples/react-showcase/src/__tests__/ThemesPage.test.tsx`

替换为：

```tsx id="react-themes-test"
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { semanticTokens } from '@zeus-web/example-showcase-shared'

import { ThemesPage } from '../routes/ThemesPage'
import { mockClipboard } from '../test-utils/custom-events'

describe('react ThemesPage', () => {
  it('renders theme variants and token metadata', () => {
    render(<ThemesPage />)

    expect(screen.getByRole('heading', { name: 'Themes' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Default/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Slate/ })).toBeInTheDocument()
    expect(
      screen.getByText(`${semanticTokens.length} semantic tokens`),
    ).toBeInTheDocument()
    expect(screen.getByText('Component preview')).toBeInTheDocument()
    expect(screen.getByText('Semantic token palette')).toBeInTheDocument()
    expect(screen.getByText('hsl(var(--background))')).toBeInTheDocument()
  })

  it('switches theme, mode, radius and motion controls', async () => {
    const user = userEvent.setup()

    render(<ThemesPage />)

    await user.click(screen.getByRole('button', { name: /Slate/ }))
    await user.selectOptions(screen.getByLabelText('Theme mode'), 'dark')
    await user.selectOptions(screen.getByLabelText('Radius preset'), 'xl')
    await user.selectOptions(
      screen.getByLabelText('Motion preset'),
      'expressive',
    )

    expect(screen.getByLabelText('Theme mode')).toHaveValue('dark')
    expect(screen.getByLabelText('Radius preset')).toHaveValue('xl')
    expect(screen.getByLabelText('Motion preset')).toHaveValue('expressive')
    expect(
      screen.getByText("import '@zeus-web/themes/slate.css'"),
    ).toBeInTheDocument()
  })

  it('switches snippets and copies the selected snippet', async () => {
    const user = userEvent.setup()
    const writeText = mockClipboard()

    render(<ThemesPage />)

    await user.click(screen.getByRole('button', { name: 'HTML usage' }))
    await user.click(screen.getByRole('button', { name: 'Copy snippet' }))

    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining('data-theme="default"'),
    )
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument()
  })
})
```

---

# 10. 新增 Vue Themes 测试

## `examples/vue-showcase/src/routes/ThemesPage.spec.ts`

```ts id="vue-themes-test"
import { semanticTokens } from '@zeus-web/example-showcase-shared'
import { mount } from '@vue/test-utils'

import ThemesPage from './ThemesPage.vue'
import { findButtonByText, mockClipboard } from '../test-utils/custom-events'

describe('vue ThemesPage', () => {
  it('renders theme variants and token metadata', () => {
    const wrapper = mount(ThemesPage)

    expect(wrapper.text()).toContain('Themes')
    expect(wrapper.text()).toContain('Default')
    expect(wrapper.text()).toContain('Slate')
    expect(wrapper.text()).toContain(`${semanticTokens.length} semantic tokens`)
    expect(wrapper.text()).toContain('Component preview')
    expect(wrapper.text()).toContain('Semantic token palette')
    expect(wrapper.text()).toContain('hsl(var(--background))')
  })

  it('switches theme, mode, radius and motion controls', async () => {
    const wrapper = mount(ThemesPage)

    await findButtonByText(wrapper, 'Slate').trigger('click')
    await wrapper.get('[aria-label="Theme mode"]').setValue('dark')
    await wrapper.get('[aria-label="Radius preset"]').setValue('xl')
    await wrapper.get('[aria-label="Motion preset"]').setValue('expressive')

    expect(
      (wrapper.get('[aria-label="Theme mode"]').element as HTMLSelectElement)
        .value,
    ).toBe('dark')
    expect(
      (wrapper.get('[aria-label="Radius preset"]').element as HTMLSelectElement)
        .value,
    ).toBe('xl')
    expect(
      (wrapper.get('[aria-label="Motion preset"]').element as HTMLSelectElement)
        .value,
    ).toBe('expressive')
    expect(wrapper.text()).toContain("import '@zeus-web/themes/slate.css'")
  })

  it('switches snippets and copies the selected snippet', async () => {
    const writeText = mockClipboard()
    const wrapper = mount(ThemesPage)

    await findButtonByText(wrapper, 'HTML usage').trigger('click')
    await findButtonByText(wrapper, 'Copy snippet').trigger('click')

    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining('data-theme="default"'),
    )
    expect(wrapper.text()).toContain('Copied')
  })
})
```

---

# 11. 新增 Vue Icons 测试统一版

如果当前 Vue Icons 测试已经存在，可以用下面版本替换，保持和 React 对齐。

## `examples/vue-showcase/src/routes/IconsPage.spec.ts`

```ts id="vue-icons-test"
import { mount } from '@vue/test-utils'

import IconsPage from './IconsPage.vue'
import { findButtonByText, mockClipboard } from '../test-utils/custom-events'

describe('vue IconsPage', () => {
  it('renders recommended icons with real svg previews', () => {
    const wrapper = mount(IconsPage)

    expect(wrapper.text()).toContain('Icons')
    expect(wrapper.text()).toContain('Check')
    expect(wrapper.text()).toContain('Menu')
    expect(wrapper.text()).toContain('Settings')
    expect(
      wrapper.findAll('.showcase-icon-preview svg').length,
    ).toBeGreaterThan(0)
  })

  it('filters icons by search query', async () => {
    const wrapper = mount(IconsPage)

    await wrapper.get('[aria-label="Search icons"]').setValue('settings')

    expect(wrapper.text()).toContain('Settings')
    expect(wrapper.text()).not.toContain('Menu')
    expect(wrapper.text()).not.toContain('Check')
  })

  it('filters icons by category', async () => {
    const wrapper = mount(IconsPage)

    await findButtonByText(wrapper, 'navigation').trigger('click')

    expect(wrapper.text()).toContain('Menu')
    expect(wrapper.text()).toContain('Chevron down')
    expect(wrapper.text()).not.toContain('Settings')
  })

  it('copies React, Vue, Web Component and raw SVG snippets', async () => {
    const writeText = mockClipboard()
    const wrapper = mount(IconsPage)

    await wrapper
      .get('[aria-label="Copy REACT import for Check"]')
      .trigger('click')
    expect(writeText).toHaveBeenLastCalledWith(
      "import { CheckIcon } from '@zeus-web/icons/react'",
    )

    await wrapper
      .get('[aria-label="Copy VUE import for Check"]')
      .trigger('click')
    expect(writeText).toHaveBeenLastCalledWith(
      `<script setup lang="ts">
import { CheckIcon } from '@zeus-web/icons/vue'
</script>`,
    )
    expect(wrapper.text()).toContain('Copied VUE')

    await wrapper
      .get('[aria-label="Copy WC import for Check"]')
      .trigger('click')
    expect(writeText).toHaveBeenLastCalledWith(
      `import '@zeus-web/icons/wc'

<zw-icon-check></zw-icon-check>`,
    )

    await wrapper
      .get('[aria-label="Copy raw svg import for Check"]')
      .trigger('click')
    expect(writeText).toHaveBeenLastCalledWith(
      "import CheckIconSvg from '@zeus-web/icons/svg/check.svg?raw'",
    )
  })

  it('updates preview size and currentColor tone controls', async () => {
    const wrapper = mount(IconsPage)

    await wrapper.get('[aria-label="Icon preview size"]').setValue('32')
    await wrapper.get('[aria-label="Icon preview color"]').setValue('primary')

    expect(
      (
        wrapper.get('[aria-label="Icon preview size"]')
          .element as HTMLSelectElement
      ).value,
    ).toBe('32')
    expect(
      (
        wrapper.get('[aria-label="Icon preview color"]')
          .element as HTMLSelectElement
      ).value,
    ).toBe('primary')
  })
})
```

---

# 12. 修改根 `package.json` 脚本

在 scripts 里追加：

```json id="package-scripts"
{
  "showcase:test:unit": "pnpm showcase:test",
  "showcase:test:coverage": "pnpm --filter @zeus-web/example-react-showcase test -- --coverage && pnpm --filter @zeus-web/example-vue-showcase test -- --coverage"
}
```

`site:check` 可以保持不变，因为已经包含 `showcase:test`。

---

# 13. 修改 roadmap

## `docs/internal/examples/showcase-roadmap.md`

Status 表追加：

```md id="roadmap-p12"
| Phase 12 | Done | Unit tests for shared metadata, route smoke, foundation pages and playground interactions |
```

Engineering guarantees 改成：

```md id="roadmap-guarantees"
The showcase has five layers of checks:

1. Metadata checks validate component metadata coverage.
2. Implementation checks validate that implemented demos have React and Vue files, dependencies and build dependency scripts.
3. Route smoke tests validate that every implemented component route renders in React and Vue.
4. Foundation page tests validate icons, themes and playground interaction behavior.
5. Shared unit tests validate metadata helpers, icon snippets, theme helpers and playground fixtures.
```

Next work 改成：

```md id="roadmap-next"
## Next work

Future phases should continue with browser-level and CI quality:

- Phase 13: Add Playwright smoke tests for React and Vue showcase.
- Phase 14: Add CI workflow jobs for showcase unit tests, build and e2e.
- Add visual snapshots for the most important component states.
- Replace demo-only CSS with exported component theme styles where appropriate.
- Generate this roadmap from `examples/showcase-shared/src/implemented.ts`.
```

---

# 验收命令

```bash id="acceptance"
pnpm --filter @zeus-web/example-showcase-shared test
pnpm --filter @zeus-web/example-showcase-shared check

pnpm --filter @zeus-web/example-react-showcase test
pnpm --filter @zeus-web/example-vue-showcase test

pnpm showcase:test
pnpm showcase:build
pnpm site:check
```

---

# Phase 12 完成判断

```txt id="phase12-done"
Shared:
  - icon snippets 测试通过
  - themes helper 测试通过
  - playground metadata 测试通过
  - implemented components 测试通过

React:
  - route smoke 测试通过
  - icons 测试通过
  - themes 测试通过
  - playground 交互测试通过

Vue:
  - route smoke 测试通过
  - icons 测试通过
  - themes 测试通过
  - playground 交互测试通过

Roadmap:
  - Phase 12 标记 Done
  - Engineering guarantees 更新到 5 层
```

建议分支名：

```txt id="branch"
test/showcase-unit-coverage
```

建议 PR title：

```txt id="pr-title"
test(examples): complete showcase unit test coverage
```
