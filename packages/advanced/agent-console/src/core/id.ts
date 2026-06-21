let counter = 0

export function createAgentConsoleId(prefix = 'agc'): string {
  counter += 1
  return `${prefix}-${counter.toString(36)}`
}

export function resetAgentConsoleIdCounter(): void {
  counter = 0
}

export function normalizeAgentConsoleId(
  value: string | undefined,
  prefix?: string,
): string {
  return value && value.trim() ? value : createAgentConsoleId(prefix)
}
