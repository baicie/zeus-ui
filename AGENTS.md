# AGENTS.md

## 项目背景

这是一个基于 pnpm workspace 的 monorepo 项目，用于管理和开发多个相关的 TypeScript 包。

- 使用 TypeScript 开发，编译目标为 ES2016
- 使用 pnpm 作为包管理器
- 使用 Vitest 进行单元测试和 E2E 测试
- 使用 ESLint 和 Prettier 进行代码质量检查（基于 @antfu/eslint-config）
- 支持多包协同开发和发布

## AI助手使用规范

### 语言要求

- **所有回复都使用中文**：在与用户交互时，始终使用中文进行回复和说明

## 安装和设置

### 开发环境要求

- Node.js 版本 >= 18.12.0
- 使用 pnpm 作为包管理器（版本 >= 10.19.0）
- 推荐使用支持 TypeScript 的编辑器（如 VS Code）

### 安装依赖

```bash
pnpm install
```

### 开发命令

```bash
pnpm dev          # 开发模式
pnpm build        # 构建所有包
pnpm clean        # 清理构建产物
pnpm check        # TypeScript 类型检查
pnpm lint         # 代码检查
pnpm format       # 格式化代码
pnpm format-check # 检查代码格式
pnpm test         # 运行所有测试
pnpm test-unit    # 运行单元测试
pnpm test-e2e     # 运行 E2E 测试
pnpm test-coverage # 生成测试覆盖率报告
```

## 代码风格指南

### 基本编码规范

- 使用 TypeScript 严格模式
- 编译目标为 ES2016，避免使用需要更高版本特性的语法
- 使用 ES modules（`import`/`export`）
- 使用 2 空格缩进
- 使用 LF 换行符
- 避免使用 `any` 类型，尽可能精确地定义类型
- 使用接口（interface）而非类型别名（type alias）定义对象结构
- 导出所有公共接口类型，方便用户使用

### 设计原则

在代码设计和实现过程中，应遵循以下核心原则：

- **第一性原理**：在进行代码设计规划时，从问题的本质出发，避免过度依赖既有方案，深入思考最优解决方案
- **KISS原则**（Keep It Simple, Stupid）：在代码实现时，优先选择简单直接的方案，避免不必要的复杂性
- **SOLID原则**：
  - **单一职责原则**（Single Responsibility Principle）：每个类或函数只负责一个功能
  - **开闭原则**（Open-Closed Principle）：对扩展开放，对修改关闭
  - **里氏替换原则**（Liskov Substitution Principle）：子类可以替换父类
  - **接口隔离原则**（Interface Segregation Principle）：使用多个专门的接口，而不是单一的总接口
  - **依赖倒置原则**（Dependency Inversion Principle）：依赖抽象而不是具体实现
- **代码复用**：尽量复用已有代码，避免重复代码（DRY原则：Don't Repeat Yourself）
- **架构一致性**：遵循项目既定的架构设计，保持代码风格一致
- **单一职责变更**：代码修改遵循单一职责原则，不混合多个变更，每次修改只解决一个问题

### 语法限制

由于编译目标为 ES2016，以下语法应避免使用：

- **对象展开运算符**：使用 `extend` helper 函数替代
- **可选链操作符**（`?.`）：会导致冗长的辅助函数
- **空值合并操作符**（`??`）：会导致冗长的辅助函数
- **async/await**：使用 Promise 链替代
- **const enum**：使用非 const enum

### 命名规范

- 文件名使用 kebab-case（短横线连接）
- 变量和函数名使用 camelCase（小驼峰）
- 类名和接口名使用 PascalCase（大驼峰）
- 常量使用 UPPER_SNAKE_CASE（大写下划线）
- 私有成员使用下划线前缀（`_privateMethod`）

### 导入规范

- 使用 `import type` 导入类型
- 导入顺序：外部依赖 → 内部包 → 相对路径
- 使用路径别名（如 `@zeus-js/*`）引用内部包
- 禁止使用 Node.js 内置模块的直接导入，应使用 `node:` 前缀（如 `node:fs`）

### 类型定义

- 组件 props 应使用 interface 定义，便于扩展
- 接口命名应为 `ComponentNameProps` 或 `FunctionNameParams`
- 复杂的数据结构应拆分为多个接口定义
- 适当使用泛型增强类型灵活性
- 使用交叉类型（&）合并多个类型
- 使用字面量联合类型定义有限的选项集合
- 避免使用 `enum`，优先使用联合类型和 `as const`
- 尽可能依赖 TypeScript 的类型推断
- 只在必要时使用类型断言（`as`）

### 代码组织

- 每个包应放在 `packages/` 目录下
- 包的源代码放在 `packages/{package-name}/src/` 目录
- 测试文件放在 `packages/{package-name}/__tests__/` 目录
- 使用 `index.ts` 作为包的入口文件

## Monorepo 工作流

### 包管理

- 所有包共享根目录的依赖（devDependencies）
- 包特定的依赖应在对应包的 `package.json` 中声明
- 使用 pnpm workspace 协议引用内部包
- 包之间的依赖应通过 workspace 协议声明

### 构建和发布

- 每个包应支持独立构建
- 构建产物应放在 `packages/{package-name}/dist/` 目录
- 使用统一的构建配置确保一致性
- 发布前确保所有包的类型检查通过

### 路径别名

项目配置了路径别名以便于包之间的引用：

- `@zeus-js/*` 映射到 `packages/*/src`

## 测试指南

### 测试框架和工具

- 使用 Vitest 编写单元测试和 E2E 测试
- 使用 jsdom 环境进行 DOM 相关的测试
- 测试文件命名格式：`*.test.ts` 或 `*.spec.ts`
- 单元测试放在包的 `__tests__/` 目录或与源文件同目录
- E2E 测试放在 `packages/{package-name}/__tests__/e2e/` 目录

### 测试项目配置

项目配置了多个测试项目：

- **unit**：单元测试（Node 环境）
- **unit-jsdom**：需要 DOM 环境的单元测试
- **e2e**：端到端测试（jsdom 环境）

### 运行测试

```bash
pnpm test              # 运行所有测试
pnpm test-unit         # 运行单元测试
pnpm test-e2e          # 运行 E2E 测试
pnpm test-coverage     # 生成覆盖率报告
```

### 测试覆盖率要求

- 核心功能测试覆盖率应达到 100%
- 边缘情况和错误处理应充分测试
- 使用 `describe` 和 `it` 组织测试用例
- 测试用例应清晰描述测试场景

## Git 和 Pull Request 规范

### 分支管理

禁止直接提交到以下保护分支：

- `main`：主分支，用于发布
- `master`：主分支（如果存在）

### 开发流程

1. 从主分支（`main` 或 `master`）创建新的功能分支
2. 在新分支上进行开发
3. 提交 Pull Request 到目标分支
4. 等待 Code Review 和 CI 通过
5. 合并到目标分支

### 分支命名规范

- 功能开发：`feat/description-of-feature`
- 问题修复：`fix/issue-number-or-description`
- 文档更新：`docs/what-is-changed`
- 代码重构：`refactor/what-is-changed`
- 样式修改：`style/what-is-changed`
- 测试相关：`test/what-is-changed`
- 构建相关：`build/what-is-changed`
- 持续集成：`ci/what-is-changed`
- 性能优化：`perf/what-is-changed`
- 依赖升级：`deps/package-name-version`
- 开发体验：`dx/what-is-changed`
- 工作流：`workflow/what-is-changed`
- 类型相关：`types/what-is-changed`
- 发布：`release/version`

### 分支命名注意事项

1. 使用小写字母
2. 使用连字符（-）分隔单词
3. 简短但具有描述性
4. 避免使用下划线或其他特殊字符
5. 如果与 Issue 关联，可以包含 Issue 编号

### Commit Message 规范

项目使用 Conventional Commits 规范，commit message 格式为：

```
<type>(<scope>): <subject>
```

#### Type 类型

- `feat`：新功能
- `fix`：Bug 修复
- `docs`：文档更新
- `dx`：开发体验改进
- `style`：代码格式（不影响代码运行的变动）
- `refactor`：重构（既不是新增功能，也不是修复 Bug）
- `perf`：性能优化
- `test`：测试相关
- `workflow`：工作流相关
- `build`：构建系统或外部依赖的变动
- `ci`：CI 配置文件和脚本的变动
- `chore`：其他变动（如构建过程或辅助工具的变动）
- `types`：类型定义相关
- `wip`：进行中的工作
- `release`：发布新版本

#### Scope（可选）

指定影响的范围，如包名或模块名。

#### Subject

简短的描述，不超过 50 个字符，首字母小写，结尾不加句号。

#### 示例

```
feat(compiler): add 'comments' option
fix(v-model): handle events on blur (close #28)
docs: update README with installation guide
refactor(parser): simplify AST node creation
```

### Pull Request 规范

#### PR 标题

- PR 标题始终使用英文
- 遵循格式：`<type>: <简短描述>`
- 例如：`fix: fix type error in parser module`
- 例如：`feat: add support for new syntax feature`

#### PR 内容

- PR 内容默认使用英文
- 尽量简洁清晰地描述改动内容和目的
- 可以视需要在英文描述后附上中文说明
- 如果修复了 Issue，请在描述中引用（如 `close #123`）

#### PR 提交注意事项

1. **审核流程**：
   - PR 需要由至少一名维护者审核通过后才能合并
   - 确保所有 CI 检查都通过
   - 解决所有 Code Review 中提出的问题

2. **PR 质量要求**：
   - 确保代码符合项目代码风格
   - 添加必要的测试用例
   - 更新相关文档
   - 大型改动需要更详细的说明和更多的审核者参与
   - 确保 TypeScript 类型检查通过
   - 确保 ESLint 检查通过

3. **工具标注**：
   - 如果是用 Cursor 提交的代码，请在 PR body 末尾进行标注：`> Submitted by Cursor`

### PR 改动类型

- 🆕 新特性提交
- 🐞 Bug 修复
- 📝 文档改进
- 💄 样式/格式改进
- 🤖 TypeScript 更新
- 📦 包体积优化
- ⚡️ 性能优化
- 🛠 重构或工具链优化
- ✅ 新增或更新测试用例
- 🔧 配置或工作流改进

## 质量保证

### 代码质量要求

- 确保代码运行正常，无运行时错误
- 通过所有 TypeScript 类型检查（`pnpm check`）
- 通过所有 ESLint 检查（`pnpm lint`）
- 通过代码格式检查（`pnpm format-check`）
- 测试覆盖率达到要求
- 避免使用已废弃的 API

### 性能要求

- 避免不必要的计算和内存分配
- 合理使用缓存机制
- 优化关键路径的性能
- 注意包体积大小

### 兼容性要求

- 编译目标为 ES2016
- 避免使用需要 polyfill 的特性
- 确保在目标环境中正常运行

## 工具链和环境

### 开发工具

- 推荐使用 VS Code 或其他支持 TypeScript 的编辑器
- 配置 ESLint 和 Prettier 插件
- 使用 TypeScript 严格模式
- 配置 Git hooks 进行代码检查（已通过 simple-git-hooks 配置）

### 构建工具

- 使用 TypeScript 编译器进行类型检查和声明文件生成
- 支持 ES modules 输出
- 使用路径别名简化导入

### CI/CD

- 所有 PR 必须通过 CI 检查
- 包括单元测试、E2E 测试、类型检查、代码风格检查
- 自动化发布流程
- 支持多环境部署

### Git Hooks

项目配置了以下 Git hooks：

- **pre-commit**：运行 lint-staged 和类型检查
- **commit-msg**：验证 commit message 格式

### Lint-staged 配置

提交前会自动运行：

- JavaScript/JSON 文件：Prettier 格式化
- TypeScript 文件：ESLint 修复 + Prettier 格式化

## 代码检查规则

### ESLint 规则要点

项目使用 `@antfu/eslint-config`，所有规则基于该 preset 并根据项目需求进行定制。主要规则包括：

- 禁止使用 `debugger`
- 禁止使用 `console.log`，允许 `console.warn`、`console.error`、`console.info`
- 禁止使用对象展开运算符（使用 `extend` helper）
- 禁止使用可选链操作符
- 禁止使用 async/await
- 禁止使用 const enum
- 强制使用 `import type` 导入类型
- 强制使用 `node:` 前缀导入 Node.js 内置模块
- 禁止使用 DOM 全局变量（如 `window`、`document`）和 Node.js 全局变量（如 `module`、`require`）

### TypeScript 配置要点

- 启用严格模式
- 启用 `isolatedDeclarations` 用于声明文件生成
- 启用 `composite` 模式支持项目引用
- 启用装饰器支持（`experimentalDecorators` 和 `emitDecoratorMetadata`）

## 特别说明

如果使用 AI 编程助手（如 Cursor）进行开发，请在提交 PR 时在末尾标注：`> Submitted by Cursor`
