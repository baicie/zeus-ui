# Getting Started

## Prerequisites

- Node.js >= 18.12.0
- pnpm >= 10.19.0

## Installation

Install dependencies:

```bash
pnpm install
```

## Development

Start the dev server:

```bash
pnpm dev
```

## Scripts

| Command             | Description                       |
| ------------------- | --------------------------------- |
| `pnpm dev`          | Start development mode            |
| `pnpm build`        | Build all packages                |
| `pnpm clean`        | Remove build artifacts and caches |
| `pnpm check`        | Run TypeScript type checking      |
| `pnpm lint`         | Run ESLint                        |
| `pnpm format`       | Format code with Prettier         |
| `pnpm test`         | Run all tests                     |
| `pnpm test-unit`    | Run unit tests                    |
| `pnpm test-e2e`     | Run E2E tests                     |
| `pnpm docs:dev`     | Start VitePress dev server        |
| `pnpm docs:build`   | Build VitePress site              |
| `pnpm docs:preview` | Preview built VitePress site      |

## Project Structure

```
.
├── packages/          # Workspace packages
│   └── empty/         # Placeholder package
├── scripts/           # Build & release scripts
├── docs/              # VitePress documentation
│   ├── .vitepress/    # VitePress config
│   ├── index.md       # Home page
│   └── guide/         # Guide pages
├── .github/
│   └── workflows/     # GitHub Actions CI/CD
└── playground/        # Interactive playground
```
