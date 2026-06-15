下面给出 **Phase 12 + Phase 13** 的连续设计与完整代码。

这两步建议一起做，但职责分开：

```txt id="2qdrkv"
Phase 12：RevoGrid Adapter Runtime Harness
目标：验证 zw-revogrid-adapter 在真实 DOM runtime 中能把 columns/source/sorting/selectedRows 写入 fake <revo-grid>，并验证 adapter-ready / adapter-change / methods。

Phase 13：RevoGrid Adapter Product Layer
目标：把 revogrid-adapter 接入 registry / AI metadata / native-react-vue templates / product contract。
```

当前 registry 里 `data-grid` 已经按 native/react/vue 三端注册，并声明依赖 `@zeus-web/data-grid`，这是 Phase 13 的直接参照。 registry package 也已经显式 export 了 data-grid 三端模板路径。 当前 AI advanced component union 只有 `chat | virtual | data-grid`，所以 Phase 13 要加入 `revogrid-adapter`。

---

# Phase 12：RevoGrid Adapter Runtime Harness

## 1. Phase 12 目标

```txt id="uqy9oh"
1. 新增 fake <revo-grid> custom element
2. 验证 zw-revogrid-adapter 挂载后会写入:
   - columns
   - source
   - sorting
   - selectedRows
   - readonly
3. 验证 adapter-ready 只在首次 ready 时触发
4. 验证 adapter-change 在 refresh / setRows / setColumns / setSort / setSelection / clearSort 时触发
5. 验证 getRevoColumns / getRevoSource / getRevoSort / getRevoSelection / getState / getGridElement
6. 继续不引入真实 @revolist/revogrid
```

---

## 2. Phase 12 文件清单

```txt id="gd7xc8"
修改:
  packages/advanced/revogrid-adapter/package.json

新增:
  e2e/advanced/revogrid-adapter/revogrid-adapter-runtime-harness.ts
  e2e/advanced/revogrid-adapter/revogrid-adapter-runtime.spec.ts
  docs/advanced/design/phase12.md
```

---

## 3. 修改 `packages/advanced/revogrid-adapter/package.json`

```json id="lxz2af"
{
  "name": "@zeus-web/revogrid-adapter",
  "type": "module",
  "version": "0.0.0",
  "description": "RevoGrid-compatible adapter for Zeus Web DataGrid models.",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/baicie/zeus-ui.git",
    "directory": "packages/advanced/revogrid-adapter"
  },
  "publishConfig": {
    "access": "public",
    "provenance": true
  },
  "sideEffects": ["./dist/wc/index.js", "./dist/wc/*.js", "./dist/**/*.css"],
  "exports": {
    ".": {
      "types": "./dist/wc/index.d.ts",
      "import": "./dist/wc/index.js"
    },
    "./wc": {
      "types": "./dist/wc/index.d.ts",
      "import": "./dist/wc/index.js"
    },
    "./wc/auto": {
      "types": "./dist/wc/index.d.ts",
      "import": "./dist/wc/auto.js"
    },
    "./react": {
      "types": "./dist/react/index.d.ts",
      "import": "./dist/react/index.js"
    },
    "./vue": {
      "types": "./dist/vue/index.d.ts",
      "import": "./dist/vue/index.js"
    },
    "./vue/global": {
      "types": "./dist/vue/global.d.ts"
    },
    "./custom-elements.json": {
      "default": "./dist/custom-elements.json"
    },
    "./zeus.components.json": {
      "default": "./dist/zeus.components.json"
    }
  },
  "files": ["dist"],
  "scripts": {
    "dev": "rolldown -c ../../../rolldown.config.ts --watch",
    "build": "rimraf dist && rolldown -c ../../../rolldown.config.ts",
    "check": "tsc -p tsconfig.json --noEmit",
    "test": "pnpm test:unit && pnpm test:e2e",
    "test:unit": "vitest --root ../../.. --project unit packages/advanced/revogrid-adapter/__tests__/column-map.spec.ts packages/advanced/revogrid-adapter/__tests__/row-map.spec.ts packages/advanced/revogrid-adapter/__tests__/sort-map.spec.ts packages/advanced/revogrid-adapter/__tests__/selection-map.spec.ts packages/advanced/revogrid-adapter/__tests__/adapter-state.spec.ts packages/advanced/revogrid-adapter/__tests__/revogrid-adapter.spec.ts",
    "test:e2e": "vitest --root ../../.. --project e2e e2e/advanced/revogrid-adapter/revogrid-adapter-runtime.spec.ts"
  },
  "peerDependencies": {
    "@zeus-js/zeus": ">=0.1.0-beta.5 <0.2.0"
  },
  "dependencies": {
    "@zeus-js/runtime-dom": "0.1.0-beta.5",
    "@zeus-js/web-c-runtime": "0.2.0",
    "@zeus-web/data-grid": "workspace:*",
    "@zeus-web/zeus-compat": "workspace:*"
  }
}
```

---

## 4. 新增 `e2e/advanced/revogrid-adapter/revogrid-adapter-runtime-harness.ts`

```ts id="8u6sve"
import type {
  DataGridColumn,
  DataGridRowData,
  DataGridRowKey,
  DataGridSortDirection,
  RevoGridAdapterChangeDetail,
  RevoGridAdapterReadyDetail,
  RevoGridCompatibleColumn,
  RevoGridCompatibleSort,
  RevoGridCompatibleSourceRow,
  RevoGridElementLike,
} from '../../../packages/advanced/revogrid-adapter/src'

import { RevoGridAdapter } from '../../../packages/advanced/revogrid-adapter/src'

export const adapterRuntimeColumns: DataGridColumn[] = [
  {
    id: 'name',
    header: 'Name',
    field: 'userName',
    width: 180,
    minWidth: 80,
    maxWidth: 260,
    sortable: true,
  },
  {
    id: 'age',
    header: 'Age',
    field: 'age',
    width: 120,
    sortable: true,
  },
  {
    id: 'role',
    header: 'Role',
    field: 'role',
    width: 160,
    sortable: true,
  },
]

export const adapterRuntimeRows: DataGridRowData[] = [
  {
    id: 'u1',
    userName: 'Ada Lovelace',
    age: 30,
    role: 'Engineer',
  },
  {
    id: 'u2',
    userName: 'Grace Hopper',
    age: 20,
    role: 'Compiler',
  },
  {
    id: 'u3',
    userName: 'Alan Turing',
    age: 40,
    role: 'Researcher',
  },
]

export interface FakeRevoGridElement extends RevoGridElementLike {
  refreshCount: number
  columns?: RevoGridCompatibleColumn[]
  source?: RevoGridCompatibleSourceRow[]
  sorting?: RevoGridCompatibleSort
  selectedRows?: number[]
  readonly?: boolean
  refresh: () => void
}

export interface MountedRevoGridAdapterOptions {
  rows?: DataGridRowData[]
  columns?: DataGridColumn[]
  selectedKeys?: DataGridRowKey[]
  selectionMode?: 'none' | 'single' | 'multiple'
  sortColumn?: string
  sortDirection?: DataGridSortDirection
  readonly?: boolean
  includeHiddenColumns?: boolean
  getRowKey?: (row: DataGridRowData, index: number) => DataGridRowKey
  ariaLabel?: string
}

export interface EventCollector<T> {
  events: CustomEvent<T>[]
  dispose: () => void
}

export function defineFakeRevoGridElement(): void {
  if (customElements.get('revo-grid')) return

  class FakeRevoGrid extends HTMLElement implements FakeRevoGridElement {
    refreshCount = 0
    columns?: RevoGridCompatibleColumn[]
    source?: RevoGridCompatibleSourceRow[]
    sorting?: RevoGridCompatibleSort
    selectedRows?: number[]
    readonly?: boolean

    refresh(): void {
      this.refreshCount += 1
    }
  }

  customElements.define('revo-grid', FakeRevoGrid)
}

export function defineRevoGridAdapterElement(): void {
  defineFakeRevoGridElement()

  if (!customElements.get('zw-revogrid-adapter')) {
    customElements.define('zw-revogrid-adapter', RevoGridAdapter)
  }
}

export async function nextFrame(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()

  await new Promise<void>(resolve => {
    setTimeout(resolve, 0)
  })

  if (typeof requestAnimationFrame === 'function') {
    await new Promise<void>(resolve => {
      requestAnimationFrame(() => resolve())
    })
  }
}

export async function mountRevoGridAdapter(
  options: MountedRevoGridAdapterOptions = {},
) {
  defineRevoGridAdapterElement()

  const adapter = document.createElement(
    'zw-revogrid-adapter',
  ) as HTMLElement & {
    rows?: DataGridRowData[]
    columns?: DataGridColumn[]
    selectedKeys?: DataGridRowKey[]
    selectionMode?: 'none' | 'single' | 'multiple'
    sortColumn?: string
    sortDirection?: DataGridSortDirection
    readonly?: boolean
    includeHiddenColumns?: boolean
    getRowKey?: (row: DataGridRowData, index: number) => DataGridRowKey
    getRevoColumns: () => RevoGridCompatibleColumn[]
    getRevoSource: () => RevoGridCompatibleSourceRow[]
    getRevoSort: () => RevoGridCompatibleSort | undefined
    getRevoSelection: () => {
      mode: 'none' | 'single' | 'multiple'
      rowKeys: DataGridRowKey[]
      rowIndexes: number[]
    }
    getState: () => {
      columns: RevoGridCompatibleColumn[]
      source: RevoGridCompatibleSourceRow[]
      sort: RevoGridCompatibleSort | undefined
      selection: {
        mode: 'none' | 'single' | 'multiple'
        rowKeys: DataGridRowKey[]
        rowIndexes: number[]
      }
    }
    getGridElement: () => FakeRevoGridElement | undefined
    setRows: (rows: DataGridRowData[]) => void
    setColumns: (columns: DataGridColumn[]) => void
    setSelection: (keys: DataGridRowKey[]) => void
    setSort: (columnId: string, direction?: DataGridSortDirection) => void
    clearSort: () => void
    refresh: () => void
  }

  adapter.rows = options.rows ?? adapterRuntimeRows
  adapter.columns = options.columns ?? adapterRuntimeColumns
  adapter.selectedKeys = options.selectedKeys
  adapter.selectionMode = options.selectionMode ?? 'multiple'
  adapter.sortColumn = options.sortColumn
  adapter.sortDirection = options.sortDirection
  adapter.readonly = options.readonly
  adapter.includeHiddenColumns = options.includeHiddenColumns
  adapter.getRowKey = options.getRowKey

  if (options.ariaLabel) {
    adapter.setAttribute('aria-label', options.ariaLabel)
  }

  document.body.append(adapter)

  await customElements.whenDefined('zw-revogrid-adapter')
  await customElements.whenDefined('revo-grid')
  await nextFrame()

  return adapter
}

export function getFakeRevoGrid(adapter: HTMLElement): FakeRevoGridElement {
  const grid = adapter.querySelector<FakeRevoGridElement>('revo-grid')

  if (!grid) {
    throw new Error('Fake revo-grid element not found')
  }

  return grid
}

export function cleanupRevoGridAdapterFixtures(): void {
  document.body.innerHTML = ''
}

export function collectEvents<T>(
  target: EventTarget,
  type: string,
): EventCollector<T> {
  const events: CustomEvent<T>[] = []

  const listener = (event: Event) => {
    events.push(event as CustomEvent<T>)
  }

  target.addEventListener(type, listener)

  return {
    events,
    dispose() {
      target.removeEventListener(type, listener)
    },
  }
}

export type { RevoGridAdapterChangeDetail, RevoGridAdapterReadyDetail }
```

---

## 5. 新增 `e2e/advanced/revogrid-adapter/revogrid-adapter-runtime.spec.ts`

```ts id="9bh7z6"
import { afterEach, describe, expect, it } from 'vitest'

import type {
  RevoGridAdapterChangeDetail,
  RevoGridAdapterReadyDetail,
} from './revogrid-adapter-runtime-harness'

import {
  adapterRuntimeColumns,
  adapterRuntimeRows,
  cleanupRevoGridAdapterFixtures,
  collectEvents,
  getFakeRevoGrid,
  mountRevoGridAdapter,
  nextFrame,
} from './revogrid-adapter-runtime-harness'

import {
  ZEUS_REVO_COLUMN_ID,
  ZEUS_REVO_ROW_INDEX,
  ZEUS_REVO_ROW_KEY,
} from '../../../packages/advanced/revogrid-adapter/src'

describe('zw-revogrid-adapter runtime', () => {
  afterEach(() => {
    cleanupRevoGridAdapterFixtures()
  })

  it('mounts and writes adapter state into fake revo-grid', async () => {
    const adapter = await mountRevoGridAdapter({
      selectedKeys: ['u2'],
      sortColumn: 'age',
      sortDirection: 'desc',
      readonly: true,
    })
    const grid = getFakeRevoGrid(adapter)

    expect(grid.columns).toEqual([
      expect.objectContaining({
        prop: 'userName',
        name: 'Name',
        size: 180,
        readonly: true,
        [ZEUS_REVO_COLUMN_ID]: 'name',
      }),
      expect.objectContaining({
        prop: 'age',
        name: 'Age',
        readonly: true,
        [ZEUS_REVO_COLUMN_ID]: 'age',
      }),
      expect.objectContaining({
        prop: 'role',
        name: 'Role',
        readonly: true,
        [ZEUS_REVO_COLUMN_ID]: 'role',
      }),
    ])

    expect(grid.source).toEqual([
      expect.objectContaining({
        id: 'u1',
        userName: 'Ada Lovelace',
        [ZEUS_REVO_ROW_KEY]: 'u1',
        [ZEUS_REVO_ROW_INDEX]: 0,
      }),
      expect.objectContaining({
        id: 'u2',
        userName: 'Grace Hopper',
        [ZEUS_REVO_ROW_KEY]: 'u2',
        [ZEUS_REVO_ROW_INDEX]: 1,
      }),
      expect.objectContaining({
        id: 'u3',
        userName: 'Alan Turing',
        [ZEUS_REVO_ROW_KEY]: 'u3',
        [ZEUS_REVO_ROW_INDEX]: 2,
      }),
    ])

    expect(grid.sorting).toEqual({
      prop: 'age',
      order: 'desc',
      [ZEUS_REVO_COLUMN_ID]: 'age',
    })
    expect(grid.selectedRows).toEqual([1])
    expect(grid.readonly).toBe(true)
    expect(grid.refreshCount).toBeGreaterThanOrEqual(1)
  })

  it('emits adapter-ready once and adapter-change on refresh', async () => {
    const adapter = await mountRevoGridAdapter()
    const readyCollector = collectEvents<RevoGridAdapterReadyDetail>(
      adapter,
      'adapter-ready',
    )
    const changeCollector = collectEvents<RevoGridAdapterChangeDetail>(
      adapter,
      'adapter-change',
    )

    adapter.refresh()
    adapter.refresh()

    await nextFrame()

    expect(readyCollector.events).toHaveLength(0)
    expect(changeCollector.events).toHaveLength(2)
    expect(changeCollector.events.at(-1)?.detail.state.source).toHaveLength(3)

    readyCollector.dispose()
    changeCollector.dispose()
  })

  it('exposes state getters', async () => {
    const adapter = await mountRevoGridAdapter({
      selectedKeys: ['u1', 'u3'],
      sortColumn: 'name',
      sortDirection: 'asc',
    })

    expect(adapter.getRevoColumns().map(column => column.prop)).toEqual([
      'userName',
      'age',
      'role',
    ])
    expect(adapter.getRevoSource().map(row => row[ZEUS_REVO_ROW_KEY])).toEqual([
      'u1',
      'u2',
      'u3',
    ])
    expect(adapter.getRevoSort()).toEqual({
      prop: 'userName',
      order: 'asc',
      [ZEUS_REVO_COLUMN_ID]: 'name',
    })
    expect(adapter.getRevoSelection()).toEqual({
      mode: 'multiple',
      rowKeys: ['u1', 'u3'],
      rowIndexes: [0, 2],
    })

    expect(adapter.getState()).toMatchObject({
      columns: expect.any(Array),
      source: expect.any(Array),
      sort: {
        prop: 'userName',
        order: 'asc',
      },
      selection: {
        rowKeys: ['u1', 'u3'],
        rowIndexes: [0, 2],
      },
    })
  })

  it('setRows updates fake revo-grid source', async () => {
    const adapter = await mountRevoGridAdapter()
    const grid = getFakeRevoGrid(adapter)

    adapter.setRows([
      {
        id: 'u4',
        userName: 'New User',
        age: 50,
        role: 'Runtime',
      },
    ])

    await nextFrame()

    expect(grid.source).toEqual([
      expect.objectContaining({
        id: 'u4',
        userName: 'New User',
        [ZEUS_REVO_ROW_KEY]: 'u4',
        [ZEUS_REVO_ROW_INDEX]: 0,
      }),
    ])
  })

  it('setColumns updates fake revo-grid columns', async () => {
    const adapter = await mountRevoGridAdapter()
    const grid = getFakeRevoGrid(adapter)

    adapter.setColumns([
      {
        id: 'name',
        field: 'userName',
        header: 'User',
        width: 220,
        sortable: true,
      },
    ])

    await nextFrame()

    expect(grid.columns).toEqual([
      expect.objectContaining({
        prop: 'userName',
        name: 'User',
        size: 220,
        [ZEUS_REVO_COLUMN_ID]: 'name',
      }),
    ])
  })

  it('setSelection updates fake revo-grid selectedRows', async () => {
    const adapter = await mountRevoGridAdapter({
      selectionMode: 'multiple',
    })
    const grid = getFakeRevoGrid(adapter)

    adapter.setSelection(['u1', 'u3'])

    await nextFrame()

    expect(grid.selectedRows).toEqual([0, 2])
    expect(adapter.selectedKeys).toEqual(['u1', 'u3'])
  })

  it('setSort and clearSort update fake revo-grid sorting', async () => {
    const adapter = await mountRevoGridAdapter()
    const grid = getFakeRevoGrid(adapter)

    adapter.setSort('age', 'asc')

    await nextFrame()

    expect(adapter.sortColumn).toBe('age')
    expect(adapter.sortDirection).toBe('asc')
    expect(grid.sorting).toEqual({
      prop: 'age',
      order: 'asc',
      [ZEUS_REVO_COLUMN_ID]: 'age',
    })

    adapter.clearSort()

    await nextFrame()

    expect(adapter.sortColumn).toBeUndefined()
    expect(adapter.sortDirection).toBeUndefined()
    expect(grid.sorting).toBeUndefined()
  })

  it('supports custom getRowKey at runtime', async () => {
    const adapter = await mountRevoGridAdapter({
      rows: [
        {
          uuid: 'x1',
          userName: 'Custom Key',
        },
      ],
      columns: adapterRuntimeColumns,
      getRowKey: row => String(row.uuid),
    })
    const grid = getFakeRevoGrid(adapter)

    expect(grid.source?.[0]?.[ZEUS_REVO_ROW_KEY]).toBe('x1')
  })

  it('filters hidden columns by default and can include them', async () => {
    const adapter = await mountRevoGridAdapter({
      columns: [
        ...adapterRuntimeColumns,
        {
          id: 'secret',
          field: 'secret',
          hidden: true,
        },
      ],
    })

    expect(adapter.getRevoColumns().map(column => column.prop)).toEqual([
      'userName',
      'age',
      'role',
    ])

    adapter.includeHiddenColumns = true
    adapter.refresh()

    await nextFrame()

    expect(adapter.getRevoColumns().map(column => column.prop)).toEqual([
      'userName',
      'age',
      'role',
      'secret',
    ])
  })

  it('does not require real @revolist/revogrid implementation', async () => {
    const adapter = await mountRevoGridAdapter({
      rows: adapterRuntimeRows,
      columns: adapterRuntimeColumns,
    })

    expect(getFakeRevoGrid(adapter).tagName.toLowerCase()).toBe('revo-grid')
    expect(adapter.getGridElement()).toBe(getFakeRevoGrid(adapter))
  })
})
```

---

## 6. 新增 `docs/advanced/design/phase12.md`

````md id="lyifgj"
# Phase 12：RevoGrid Adapter Runtime Harness

## 目标

Phase 12 为 `@zeus-web/revogrid-adapter` 增加 DOM runtime 测试。

Phase 11 已完成 core mapping 与 component protocol。Phase 12 验证真实 custom element 挂载行为：

1. `zw-revogrid-adapter` 可以注册并挂载。
2. 内部 `<revo-grid>` 可以接收 adapter state。
3. 不依赖真实 `@revolist/revogrid`。
4. 使用 fake `<revo-grid>` 验证属性写入。

## 测试范围

新增：

```txt
e2e/advanced/revogrid-adapter/revogrid-adapter-runtime-harness.ts
e2e/advanced/revogrid-adapter/revogrid-adapter-runtime.spec.ts
```
````

修改：

```txt
packages/advanced/revogrid-adapter/package.json
```

## Fake RevoGrid

测试中注册：

```txt
customElements.define('revo-grid', FakeRevoGrid)
```

FakeRevoGrid 支持：

```txt
columns
source
sorting
selectedRows
readonly
refresh()
```

## 覆盖点

1. mount
2. columns/source 写入
3. sorting 写入
4. selectedRows 写入
5. readonly 写入
6. refresh 调用
7. adapter-ready
8. adapter-change
9. getRevoColumns / getRevoSource / getRevoSort / getRevoSelection / getState
10. setRows / setColumns / setSelection / setSort / clearSort / refresh
11. custom getRowKey
12. hidden columns filter
13. 不引入真实 RevoGrid

## 验收

```bash
pnpm --filter @zeus-web/revogrid-adapter check
pnpm --filter @zeus-web/revogrid-adapter test:unit
pnpm --filter @zeus-web/revogrid-adapter test:e2e
pnpm --filter @zeus-web/revogrid-adapter test
pnpm --filter @zeus-web/revogrid-adapter build
```

````

---

# Phase 13：RevoGrid Adapter Product Layer

## 1. Phase 13 目标

```txt id="pjwl6x"
1. 将 revogrid-adapter 注册进 @zeus-web/registry
2. 提供 native / react / vue 三端模板
3. 更新 registry package exports
4. 更新 registry-package.spec.ts
5. 更新 AI advanced component union 和 metadata
6. 新增 ai metadata 单测
7. 新增 product contract check
8. 不引入 @revolist/revogrid 依赖
9. 不把 API key / fetch / provider 等运行时逻辑塞进模板
````

---

## 2. Phase 13 文件清单

```txt id="7otutu"
修改:
  package.json
  packages/registry/registry.json
  packages/registry/package.json
  packages/registry/__tests__/registry-package.spec.ts
  packages/ai/src/types.ts
  packages/ai/src/metadata.ts

新增:
  packages/registry/templates/native/revogrid-adapter.ts
  packages/registry/templates/react/revogrid-adapter.tsx
  packages/registry/templates/vue/revogrid-adapter.vue
  packages/ai/__tests__/revogrid-adapter-ai-metadata.spec.ts
  scripts/checks/contract/check-revogrid-adapter-product-contract.ts
  scripts/checks/contract/__tests__/check-revogrid-adapter-product-contract.spec.ts
  docs/advanced/design/phase13.md
```

---

## 3. 修改根 `package.json`

在 scripts 里追加：

```json id="8964my"
{
  "check:revogrid-adapter-product-contract": "tsx scripts/checks/contract/check-revogrid-adapter-product-contract.ts"
}
```

如果已有 `check:product-contract` 聚合脚本，也把 `pnpm check:revogrid-adapter-product-contract` 加进去：

```json id="uslfkl"
{
  "check:product-contract": "pnpm check:chat-product-contract && pnpm check:data-grid-product-contract && pnpm check:revogrid-adapter-product-contract"
}
```

---

## 4. 修改 `packages/registry/registry.json`

在 `data-grid` item 后追加：

```json id="7a94ea"
{
  "name": "revogrid-adapter",
  "type": "component",
  "description": "RevoGrid-compatible adapter built on @zeus-web/revogrid-adapter. Bridges Zeus DataGrid column, row, sorting and selection models to a <revo-grid> custom element without bundling the RevoGrid implementation.",
  "frameworks": ["native", "react", "vue"],
  "dependencies": ["@zeus-web/revogrid-adapter"],
  "registryDependencies": ["cn", "globals"],
  "files": [
    {
      "framework": "native",
      "source": "templates/native/revogrid-adapter.ts",
      "target": "components/revogrid-adapter.ts"
    },
    {
      "framework": "react",
      "source": "templates/react/revogrid-adapter.tsx",
      "target": "components/ui/revogrid-adapter.tsx"
    },
    {
      "framework": "vue",
      "source": "templates/vue/revogrid-adapter.vue",
      "target": "components/ui/revogrid-adapter.vue"
    }
  ]
}
```

---

## 5. 修改 `packages/registry/package.json`

在 exports 里追加：

```json id="rhdhq7"
{
  "./templates/react/revogrid-adapter.tsx": "./dist/templates/react/revogrid-adapter.tsx",
  "./templates/vue/revogrid-adapter.vue": "./dist/templates/vue/revogrid-adapter.vue",
  "./templates/native/revogrid-adapter.ts": "./dist/templates/native/revogrid-adapter.ts"
}
```

完整 exports 相关区域建议保持类似：

```json id="plro85"
"exports": {
  ".": {
    "types": "./dist/index.d.ts",
    "import": "./dist/index.js"
  },
  "./schema": {
    "types": "./dist/schema.d.ts",
    "import": "./dist/schema.js"
  },
  "./registry.json": "./dist/registry.json",
  "./templates/react/button.tsx": "./dist/templates/react/button.tsx",
  "./templates/react/input.tsx": "./dist/templates/react/input.tsx",
  "./templates/react/chat.tsx": "./dist/templates/react/chat.tsx",
  "./templates/react/data-grid.tsx": "./dist/templates/react/data-grid.tsx",
  "./templates/react/revogrid-adapter.tsx": "./dist/templates/react/revogrid-adapter.tsx",
  "./templates/vue/button.vue": "./dist/templates/vue/button.vue",
  "./templates/vue/input.vue": "./dist/templates/vue/input.vue",
  "./templates/vue/chat.vue": "./dist/templates/vue/chat.vue",
  "./templates/vue/data-grid.vue": "./dist/templates/vue/data-grid.vue",
  "./templates/vue/revogrid-adapter.vue": "./dist/templates/vue/revogrid-adapter.vue",
  "./templates/native/chat.ts": "./dist/templates/native/chat.ts",
  "./templates/native/data-grid.ts": "./dist/templates/native/data-grid.ts",
  "./templates/native/revogrid-adapter.ts": "./dist/templates/native/revogrid-adapter.ts",
  "./templates/css/globals.css": "./dist/templates/css/globals.css",
  "./templates/lib/cn.ts": "./dist/templates/lib/cn.ts"
}
```

---

## 6. 新增 `packages/registry/templates/native/revogrid-adapter.ts`

```ts id="9rfrtj"
import '@zeus-web/revogrid-adapter/wc/auto'

import type {
  DataGridColumn,
  DataGridRowData,
  RevoGridAdapterElement,
} from '@zeus-web/revogrid-adapter'

export const revoGridAdapterDemoColumns: DataGridColumn[] = [
  {
    id: 'name',
    header: 'Name',
    field: 'userName',
    width: 180,
    sortable: true,
  },
  {
    id: 'age',
    header: 'Age',
    field: 'age',
    width: 120,
    sortable: true,
  },
  {
    id: 'role',
    header: 'Role',
    field: 'role',
    width: 160,
    sortable: true,
  },
]

export const revoGridAdapterDemoRows: DataGridRowData[] = [
  {
    id: 'u1',
    userName: 'Ada Lovelace',
    age: 30,
    role: 'Engineer',
  },
  {
    id: 'u2',
    userName: 'Grace Hopper',
    age: 20,
    role: 'Compiler',
  },
  {
    id: 'u3',
    userName: 'Alan Turing',
    age: 40,
    role: 'Researcher',
  },
]

export interface MountRevoGridAdapterDemoOptions {
  target: HTMLElement
  rows?: DataGridRowData[]
  columns?: DataGridColumn[]
}

export function mountRevoGridAdapterDemo(
  options: MountRevoGridAdapterDemoOptions,
): RevoGridAdapterElement {
  const adapter = document.createElement(
    'zw-revogrid-adapter',
  ) as RevoGridAdapterElement

  adapter.rows = options.rows ?? revoGridAdapterDemoRows
  adapter.columns = options.columns ?? revoGridAdapterDemoColumns
  adapter.selectionMode = 'multiple'
  adapter.selectedKeys = ['u2']
  adapter.sortColumn = 'age'
  adapter.sortDirection = 'desc'
  adapter.setAttribute('aria-label', 'RevoGrid adapter demo')

  adapter.addEventListener('adapter-ready', () => {
    // The actual <revo-grid> implementation is expected to be registered by the app.
  })

  options.target.append(adapter)

  return adapter
}
```

---

## 7. 新增 `packages/registry/templates/react/revogrid-adapter.tsx`

```tsx id="z8vco5"
import type { ComponentProps } from 'react'

import type {
  DataGridColumn,
  DataGridRowData,
} from '@zeus-web/revogrid-adapter'

import { RevoGridAdapter as RevoGridAdapterPrimitive } from '@zeus-web/revogrid-adapter/react'

import { cn } from '@/lib/cn'

export const revoGridAdapterDemoColumns: DataGridColumn[] = [
  {
    id: 'name',
    header: 'Name',
    field: 'userName',
    width: 180,
    sortable: true,
  },
  {
    id: 'age',
    header: 'Age',
    field: 'age',
    width: 120,
    sortable: true,
  },
  {
    id: 'role',
    header: 'Role',
    field: 'role',
    width: 160,
    sortable: true,
  },
]

export const revoGridAdapterDemoRows: DataGridRowData[] = [
  {
    id: 'u1',
    userName: 'Ada Lovelace',
    age: 30,
    role: 'Engineer',
  },
  {
    id: 'u2',
    userName: 'Grace Hopper',
    age: 20,
    role: 'Compiler',
  },
  {
    id: 'u3',
    userName: 'Alan Turing',
    age: 40,
    role: 'Researcher',
  },
]

export interface RevoGridAdapterProps extends ComponentProps<
  typeof RevoGridAdapterPrimitive
> {
  className?: string
}

export function RevoGridAdapter({
  className,
  rows = revoGridAdapterDemoRows,
  columns = revoGridAdapterDemoColumns,
  selectionMode = 'multiple',
  selectedKeys = ['u2'],
  sortColumn = 'age',
  sortDirection = 'desc',
  ...props
}: RevoGridAdapterProps) {
  return (
    <RevoGridAdapterPrimitive
      className={cn(
        'block overflow-hidden rounded-md border bg-background text-foreground',
        '[&_[data-slot=revogrid-adapter-grid]]:block',
        '[&_[data-slot=revogrid-adapter-grid]]:min-h-72',
        className,
      )}
      rows={rows}
      columns={columns}
      selectionMode={selectionMode}
      selectedKeys={selectedKeys}
      sortColumn={sortColumn}
      sortDirection={sortDirection}
      ariaLabel="RevoGrid adapter"
      {...props}
    />
  )
}

export function RevoGridAdapterDemo() {
  return <RevoGridAdapter />
}
```

---

## 8. 新增 `packages/registry/templates/vue/revogrid-adapter.vue`

```vue id="yp345r"
<script setup lang="ts">
import { computed } from 'vue'

import type {
  DataGridColumn,
  DataGridRowData,
} from '@zeus-web/revogrid-adapter'

import { RevoGridAdapter as RevoGridAdapterPrimitive } from '@zeus-web/revogrid-adapter/vue'

import { cn } from '@/lib/cn'

const props = withDefaults(
  defineProps<{
    class?: string
    rows?: DataGridRowData[]
    columns?: DataGridColumn[]
    selectionMode?: 'none' | 'single' | 'multiple'
    selectedKeys?: string[]
    sortColumn?: string
    sortDirection?: 'asc' | 'desc'
  }>(),
  {
    selectionMode: 'multiple',
    sortColumn: 'age',
    sortDirection: 'desc',
  },
)

const revoGridAdapterDemoColumns: DataGridColumn[] = [
  {
    id: 'name',
    header: 'Name',
    field: 'userName',
    width: 180,
    sortable: true,
  },
  {
    id: 'age',
    header: 'Age',
    field: 'age',
    width: 120,
    sortable: true,
  },
  {
    id: 'role',
    header: 'Role',
    field: 'role',
    width: 160,
    sortable: true,
  },
]

const revoGridAdapterDemoRows: DataGridRowData[] = [
  {
    id: 'u1',
    userName: 'Ada Lovelace',
    age: 30,
    role: 'Engineer',
  },
  {
    id: 'u2',
    userName: 'Grace Hopper',
    age: 20,
    role: 'Compiler',
  },
  {
    id: 'u3',
    userName: 'Alan Turing',
    age: 40,
    role: 'Researcher',
  },
]

const adapterClasses = computed(() =>
  cn(
    'block overflow-hidden rounded-md border bg-background text-foreground',
    '[&_[data-slot=revogrid-adapter-grid]]:block',
    '[&_[data-slot=revogrid-adapter-grid]]:min-h-72',
    props.class,
  ),
)

const rows = computed(() => props.rows ?? revoGridAdapterDemoRows)
const columns = computed(() => props.columns ?? revoGridAdapterDemoColumns)
const selectedKeys = computed(() => props.selectedKeys ?? ['u2'])
</script>

<template>
  <RevoGridAdapterPrimitive
    :class="adapterClasses"
    :rows="rows"
    :columns="columns"
    :selection-mode="props.selectionMode"
    :selected-keys="selectedKeys"
    :sort-column="props.sortColumn"
    :sort-direction="props.sortDirection"
    aria-label="RevoGrid adapter"
  />
</template>
```

---

## 9. 修改 `packages/registry/__tests__/registry-package.spec.ts`

在 data-grid 测试后追加：

```ts id="mblsjd"
it('registers revogrid-adapter across native/react/vue with safe templates', () => {
  const manifest = readManifest()
  const adapter = findRegistryItem(manifest, 'revogrid-adapter')

  expect(adapter).toBeTruthy()
  expect(adapter?.dependencies).toEqual(['@zeus-web/revogrid-adapter'])
  expect(adapter?.frameworks).toEqual(
    expect.arrayContaining(['native', 'react', 'vue']),
  )
  expect(getRegistryItemNames(manifest)).toContain('revogrid-adapter')

  expect(adapter?.files).toEqual(
    expect.arrayContaining([
      {
        framework: 'native',
        source: 'templates/native/revogrid-adapter.ts',
        target: 'components/revogrid-adapter.ts',
      },
      {
        framework: 'react',
        source: 'templates/react/revogrid-adapter.tsx',
        target: 'components/ui/revogrid-adapter.tsx',
      },
      {
        framework: 'vue',
        source: 'templates/vue/revogrid-adapter.vue',
        target: 'components/ui/revogrid-adapter.vue',
      },
    ]),
  )

  const nativeSource = read('templates/native/revogrid-adapter.ts')
  const reactSource = read('templates/react/revogrid-adapter.tsx')
  const vueSource = read('templates/vue/revogrid-adapter.vue')

  expect(nativeSource).toContain("import '@zeus-web/revogrid-adapter/wc/auto'")
  expect(nativeSource).toContain("from '@zeus-web/revogrid-adapter'")
  expect(nativeSource).toContain('mountRevoGridAdapterDemo')
  expect(nativeSource).toContain('zw-revogrid-adapter')
  expect(nativeSource).toContain('revoGridAdapterDemoColumns')
  expect(nativeSource).toContain('revoGridAdapterDemoRows')
  expect(nativeSource).not.toContain('String.raw')
  expect(nativeSource).not.toContain('revoGridAdapterNativeSource')

  expect(reactSource).toContain("from '@zeus-web/revogrid-adapter'")
  expect(reactSource).toContain('@zeus-web/revogrid-adapter/react')
  expect(reactSource).toContain("import { cn } from '@/lib/cn'")
  expect(reactSource).toMatch(
    /extends\s+ComponentProps<\s+typeof\s+RevoGridAdapterPrimitive/,
  )
  expect(reactSource).toContain('RevoGridAdapterPrimitive')
  expect(reactSource).toContain('RevoGridAdapterDemo')
  expect(reactSource).not.toContain(
    "DataGridRowData,\n} from '@zeus-web/revogrid-adapter/react'",
  )

  expect(vueSource).toContain("from '@zeus-web/revogrid-adapter'")
  expect(vueSource).toContain('@zeus-web/revogrid-adapter/vue')
  expect(vueSource).toContain("import { cn } from '@/lib/cn'")
  expect(vueSource).toContain('RevoGridAdapterPrimitive')
  expect(vueSource).not.toContain(
    "DataGridColumn, DataGridRowData } from '@zeus-web/revogrid-adapter/vue'",
  )

  for (const source of [nativeSource, reactSource, vueSource]) {
    expect(source).not.toContain('fetch(')
    expect(source).not.toContain('Authorization')
    expect(source).not.toContain('Bearer')
    expect(source).not.toContain('apiKey')
    expect(source).not.toContain('OPENAI_API_KEY')
    expect(source).not.toContain('ANTHROPIC_API_KEY')
    expect(source).not.toContain('DEEPSEEK_API_KEY')
    expect(source).not.toContain('ag-grid')
    expect(source).not.toContain('@ag-grid')
    expect(source).not.toContain('@revolist/revogrid')
    expect(source).not.toContain('defineCustomElements')
  }
})
```

---

## 10. 修改 `packages/ai/src/types.ts`

把：

```ts id="sfz2b4"
export type ZeusWebAiAdvancedComponentName = 'chat' | 'virtual' | 'data-grid'
```

替换为：

```ts id="78mns7"
export type ZeusWebAiAdvancedComponentName =
  | 'chat'
  | 'virtual'
  | 'data-grid'
  | 'revogrid-adapter'
```

---

## 11. 修改 `packages/ai/src/metadata.ts`

在 `advancedComponents` 数组中新增：

```ts id="py3f7i"
{
  name: 'revogrid-adapter',
  description:
    'RevoGrid-compatible adapter that maps Zeus DataGrid rows, columns, sorting and selection state to a <revo-grid> custom element without bundling RevoGrid itself.',
  primitivePackage: '@zeus-web/revogrid-adapter',
  registryCommand: 'zweb add revogrid-adapter',
  installCommand: 'pnpm add @zeus-web/revogrid-adapter',
  reactImport:
    "import { RevoGridAdapter } from '@zeus-web/revogrid-adapter/react'",
  webComponentImport: "import '@zeus-web/revogrid-adapter/wc'",
  styledImport:
    "import { RevoGridAdapter } from '@/components/ui/revogrid-adapter'",
  sourceTarget: 'components/ui/revogrid-adapter.tsx',
  dependencies: ['@zeus-web/revogrid-adapter'],
  props: [
    {
      name: 'rows',
      type: 'DataGridRowData[]',
      description: 'Rows to map into the RevoGrid-compatible source array.',
    },
    {
      name: 'columns',
      type: 'DataGridColumn[]',
      description: 'Columns to map into the RevoGrid-compatible columns array.',
    },
    {
      name: 'selectedKeys',
      type: 'DataGridRowKey[]',
      description: 'Selected Zeus row keys mapped to RevoGrid selected row indexes.',
    },
    {
      name: 'selectionMode',
      type: "'none' | 'single' | 'multiple'",
      description: 'Selection mode used for selection mapping.',
      values: ['none', 'single', 'multiple'],
      default: 'none',
    },
    {
      name: 'sortColumn',
      type: 'string',
      description: 'Zeus column id used to build the RevoGrid-compatible sorting state.',
    },
    {
      name: 'sortDirection',
      type: "'asc' | 'desc'",
      description: 'Sort direction used to build the RevoGrid-compatible sorting state.',
      values: ['asc', 'desc'],
    },
    {
      name: 'readonly',
      type: 'boolean',
      description: 'Marks mapped RevoGrid columns and target grid as readonly.',
    },
    {
      name: 'includeHiddenColumns',
      type: 'boolean',
      description: 'Includes Zeus columns with hidden=true in the RevoGrid-compatible column list.',
    },
    {
      name: 'ariaLabel',
      type: 'string',
      description: 'Accessible label forwarded to the target <revo-grid> element.',
    },
  ],
  events: [
    {
      name: 'adapter-ready',
      reactName: 'onAdapterReady',
      description:
        'Emitted when the adapter first connects to its target <revo-grid> element and applies state.',
      detail: {
        grid: 'RevoGridElementLike | undefined',
        state: 'RevoGridAdapterState',
      },
    },
    {
      name: 'adapter-change',
      reactName: 'onAdapterChange',
      description:
        'Emitted whenever adapter state is applied to the target <revo-grid> element.',
      detail: {
        grid: 'RevoGridElementLike | undefined',
        state: 'RevoGridAdapterState',
      },
    },
  ],
  slots: [],
  examples: [
    {
      title: 'React styled usage',
      code: [
        "import { RevoGridAdapter } from '@/components/ui/revogrid-adapter'",
        '',
        'export function Example() {',
        '  return <RevoGridAdapter />',
        '}',
      ].join('\n'),
    },
  ],
  styling: {
    usesTailwind: true,
    themeTokens: ['border', 'bg-background', 'text-foreground'],
    internalSelectors: [
      '[&_[data-slot=revogrid-adapter-root]]',
      '[&_[data-slot=revogrid-adapter-grid]]',
    ],
  },
  aiRules: {
    do: [
      'Use RevoGridAdapter when the app already registers a <revo-grid> implementation.',
      'Keep @zeus-web/data-grid for lightweight built-in tables.',
      'Use rows and columns from the DataGrid model to keep interop stable.',
    ],
    dont: [
      'Do not import @revolist/revogrid from the generated template.',
      'Do not use RevoGridAdapter as a replacement for simple DataGrid Lite usage.',
      'Do not put API requests or provider logic inside the adapter template.',
    ],
  },
}
```

---

## 12. 新增 `packages/ai/__tests__/revogrid-adapter-ai-metadata.spec.ts`

```ts id="qza044"
import { describe, expect, it } from 'vitest'

import { advancedComponents } from '../src/metadata'

describe('revogrid-adapter ai metadata', () => {
  const adapter = advancedComponents.find(
    component => component.name === 'revogrid-adapter',
  )

  it('registers revogrid-adapter metadata', () => {
    expect(adapter).toBeTruthy()
    expect(adapter).toMatchObject({
      name: 'revogrid-adapter',
      primitivePackage: '@zeus-web/revogrid-adapter',
      registryCommand: 'zweb add revogrid-adapter',
      installCommand: 'pnpm add @zeus-web/revogrid-adapter',
      dependencies: ['@zeus-web/revogrid-adapter'],
      sourceTarget: 'components/ui/revogrid-adapter.tsx',
    })
  })

  it('documents runtime adapter events', () => {
    expect(adapter?.events.map(event => event.name)).toEqual(
      expect.arrayContaining(['adapter-ready', 'adapter-change']),
    )
  })

  it('warns against bundling RevoGrid implementation in templates', () => {
    expect(adapter?.aiRules.dont.join('\n')).toContain('@revolist/revogrid')
    expect(adapter?.aiRules.dont.join('\n')).toContain('API requests')
  })
})
```

> 如果 `advancedComponents` 当前没有 export，需要在 `packages/ai/src/metadata.ts` 确保它是 `export const advancedComponents = [...]`。

---

## 13. 新增 `scripts/checks/contract/check-revogrid-adapter-product-contract.ts`

```ts id="fobz1s"
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

interface RegistryFile {
  framework: string
  source: string
  target: string
}

interface RegistryItem {
  name: string
  type: string
  frameworks: string[]
  dependencies: string[]
  registryDependencies: string[]
  files: RegistryFile[]
}

interface RegistryManifest {
  items: RegistryItem[]
}

const workspaceRoot = existsSync(resolve(process.cwd(), 'pnpm-workspace.yaml'))
  ? process.cwd()
  : resolve(process.cwd(), '../..')

function read(path: string): string {
  return readFileSync(resolve(workspaceRoot, path), 'utf-8')
}

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(`[revogrid-adapter-product-contract] ${message}`)
  }
}

function assertContains(source: string, value: string, label: string): void {
  assert(
    source.includes(value),
    `${label} must contain ${JSON.stringify(value)}`,
  )
}

function assertNotContains(source: string, value: string, label: string): void {
  assert(
    !source.includes(value),
    `${label} must not contain ${JSON.stringify(value)}`,
  )
}

function readManifest(): RegistryManifest {
  return JSON.parse(read('packages/registry/registry.json')) as RegistryManifest
}

export function checkRevoGridAdapterProductContract(): void {
  const manifest = readManifest()
  const item = manifest.items.find(
    registryItem => registryItem.name === 'revogrid-adapter',
  )

  assert(item, 'registry.json must contain revogrid-adapter')
  assert(item?.type === 'component', 'revogrid-adapter must be a component')
  assert(
    JSON.stringify(item?.frameworks) ===
      JSON.stringify(['native', 'react', 'vue']),
    'revogrid-adapter frameworks must be native/react/vue',
  )
  assert(
    JSON.stringify(item?.dependencies) ===
      JSON.stringify(['@zeus-web/revogrid-adapter']),
    'revogrid-adapter dependency must be @zeus-web/revogrid-adapter',
  )
  assert(
    item?.registryDependencies.includes('cn'),
    'revogrid-adapter must depend on cn utility',
  )
  assert(
    item?.registryDependencies.includes('globals'),
    'revogrid-adapter must depend on globals',
  )

  const expectedFiles: RegistryFile[] = [
    {
      framework: 'native',
      source: 'templates/native/revogrid-adapter.ts',
      target: 'components/revogrid-adapter.ts',
    },
    {
      framework: 'react',
      source: 'templates/react/revogrid-adapter.tsx',
      target: 'components/ui/revogrid-adapter.tsx',
    },
    {
      framework: 'vue',
      source: 'templates/vue/revogrid-adapter.vue',
      target: 'components/ui/revogrid-adapter.vue',
    },
  ]

  for (const expectedFile of expectedFiles) {
    assert(
      item?.files.some(
        file =>
          file.framework === expectedFile.framework &&
          file.source === expectedFile.source &&
          file.target === expectedFile.target,
      ),
      `registry file missing ${expectedFile.source}`,
    )
  }

  const registryPackage = read('packages/registry/package.json')
  assertContains(
    registryPackage,
    './templates/native/revogrid-adapter.ts',
    'registry package exports',
  )
  assertContains(
    registryPackage,
    './templates/react/revogrid-adapter.tsx',
    'registry package exports',
  )
  assertContains(
    registryPackage,
    './templates/vue/revogrid-adapter.vue',
    'registry package exports',
  )

  const nativeSource = read(
    'packages/registry/templates/native/revogrid-adapter.ts',
  )
  const reactSource = read(
    'packages/registry/templates/react/revogrid-adapter.tsx',
  )
  const vueSource = read('packages/registry/templates/vue/revogrid-adapter.vue')

  assertContains(
    nativeSource,
    "import '@zeus-web/revogrid-adapter/wc/auto'",
    'native template',
  )
  assertContains(
    nativeSource,
    "from '@zeus-web/revogrid-adapter'",
    'native template',
  )
  assertContains(nativeSource, 'mountRevoGridAdapterDemo', 'native template')
  assertContains(nativeSource, 'zw-revogrid-adapter', 'native template')
  assertNotContains(nativeSource, 'String.raw', 'native template')
  assertNotContains(
    nativeSource,
    'revoGridAdapterNativeSource',
    'native template',
  )

  assertContains(
    reactSource,
    "from '@zeus-web/revogrid-adapter'",
    'react template',
  )
  assertContains(
    reactSource,
    '@zeus-web/revogrid-adapter/react',
    'react template',
  )
  assertContains(reactSource, "import { cn } from '@/lib/cn'", 'react template')
  assertContains(reactSource, 'RevoGridAdapterPrimitive', 'react template')
  assertContains(
    reactSource,
    'ComponentProps<typeof RevoGridAdapterPrimitive>',
    'react template',
  )

  assertContains(vueSource, "from '@zeus-web/revogrid-adapter'", 'vue template')
  assertContains(vueSource, '@zeus-web/revogrid-adapter/vue', 'vue template')
  assertContains(vueSource, "import { cn } from '@/lib/cn'", 'vue template')
  assertContains(vueSource, 'RevoGridAdapterPrimitive', 'vue template')

  for (const [label, source] of [
    ['native template', nativeSource],
    ['react template', reactSource],
    ['vue template', vueSource],
  ] as const) {
    assertNotContains(source, 'fetch(', label)
    assertNotContains(source, 'Authorization', label)
    assertNotContains(source, 'Bearer', label)
    assertNotContains(source, 'apiKey', label)
    assertNotContains(source, 'OPENAI_API_KEY', label)
    assertNotContains(source, 'ANTHROPIC_API_KEY', label)
    assertNotContains(source, 'DEEPSEEK_API_KEY', label)
    assertNotContains(source, 'ag-grid', label)
    assertNotContains(source, '@ag-grid', label)
    assertNotContains(source, '@revolist/revogrid', label)
    assertNotContains(source, 'defineCustomElements', label)
  }
}

checkRevoGridAdapterProductContract()
```

---

## 14. 新增 `scripts/checks/contract/__tests__/check-revogrid-adapter-product-contract.spec.ts`

```ts id="6yygbj"
import { describe, expect, it } from 'vitest'

import { checkRevoGridAdapterProductContract } from '../check-revogrid-adapter-product-contract'

describe('revogrid-adapter product contract', () => {
  it('passes product contract checks', () => {
    expect(() => checkRevoGridAdapterProductContract()).not.toThrow()
  })
})
```

---

## 15. 新增 `docs/advanced/design/phase13.md`

````md id="xw32eb"
# Phase 13：RevoGrid Adapter Product Layer

## 目标

Phase 13 将 `@zeus-web/revogrid-adapter` 接入产品层：

1. registry manifest
2. native / react / vue templates
3. registry package exports
4. registry tests
5. AI metadata
6. product contract

## Registry

新增 registry item：

```txt
revogrid-adapter
```
````

三端模板：

```txt
templates/native/revogrid-adapter.ts
templates/react/revogrid-adapter.tsx
templates/vue/revogrid-adapter.vue
```

## 设计原则

1. 模板只依赖 `@zeus-web/revogrid-adapter`。
2. 模板不导入真实 `@revolist/revogrid`。
3. 模板不注册 RevoGrid loader。
4. 用户项目自行安装并注册 RevoGrid。
5. 模板不包含 fetch / API key / provider 逻辑。
6. React/Vue 模板从 wrapper 入口导入组件，从根入口导入类型。

## AI Metadata

新增 advanced component：

```txt
revogrid-adapter
```

AI rules 必须明确：

1. 适合已注册 `<revo-grid>` 的项目。
2. 简单表格继续用 `data-grid`。
3. 不要把 RevoGrid 实现依赖写进生成模板。
4. 不要在 adapter 模板中写请求逻辑。

## Contract

新增：

```txt
scripts/checks/contract/check-revogrid-adapter-product-contract.ts
```

检查：

1. registry item 存在。
2. native/react/vue 三端文件存在。
3. package exports 存在。
4. 模板使用正确入口。
5. 模板不包含 `@revolist/revogrid`。
6. 模板不包含 API key / fetch / provider 逻辑。

## 验收

```bash
pnpm --filter @zeus-web/registry test
pnpm --filter @zeus-web/ai test
pnpm check:revogrid-adapter-product-contract
pnpm check:product-contract
```

````

---

# 16. 验收命令

```bash id="c3n0h4"
pnpm --filter @zeus-web/revogrid-adapter check
pnpm --filter @zeus-web/revogrid-adapter test:unit
pnpm --filter @zeus-web/revogrid-adapter test:e2e
pnpm --filter @zeus-web/revogrid-adapter test
pnpm --filter @zeus-web/revogrid-adapter build

pnpm --filter @zeus-web/registry test
pnpm --filter @zeus-web/ai test

pnpm check:revogrid-adapter-product-contract
pnpm check:product-contract

pnpm check
pnpm test-unit
pnpm check:exports
pnpm check:build-output
pnpm check:advanced-contract
pnpm release:plan
````

---

# 17. 完成标准

```txt id="mmpo2k"
Phase 12 完成:
  1. fake revo-grid 可注册
  2. zw-revogrid-adapter runtime 可挂载
  3. columns/source/sorting/selectedRows/readonly 写入 fake revo-grid
  4. adapter-ready / adapter-change 可触发
  5. setRows/setColumns/setSelection/setSort/clearSort/refresh 可用
  6. custom getRowKey runtime 可用
  7. 不依赖真实 @revolist/revogrid

Phase 13 完成:
  1. registry.json 注册 revogrid-adapter
  2. registry package exports 三端模板
  3. native/react/vue templates 存在
  4. registry tests 覆盖 revogrid-adapter
  5. AI metadata 包含 revogrid-adapter
  6. product contract 覆盖 revogrid-adapter
  7. 模板不包含 fetch/API key/provider/RevoGrid loader
```

---

# 18. 下一阶段建议

Phase 14 建议开始 **Agent Console**，回到你最初路线的最终目标：

```txt id="kjt74x"
Phase 14: Agent Console Foundation

目标:
  1. 新增 @zeus-web/agent-console advanced 包
  2. 复用 chat + virtual + data-grid/revogrid-adapter
  3. 建立事件流 / tool call / artifact / diagnostics 基础布局
  4. 不接真实 LLM provider
  5. 只做 headless runtime + product template contract
```

这样路线就回到了：

```txt id="7rpky5"
Virtual -> Chat -> DataGrid Lite -> RevoGrid Adapter -> Agent Console
```
