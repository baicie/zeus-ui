import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.spec.ts'],
    deps: {
      optimizer: {
        enabled: false,
      },
    } as Parameters<typeof defineConfig>[0]['test']['deps'],
  },
})
