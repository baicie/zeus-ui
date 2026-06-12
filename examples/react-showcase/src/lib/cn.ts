export type ClassDictionary = Record<string, boolean | null | undefined>
export type ClassArray = ClassValue[]
export type ClassValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | ClassDictionary
  | ClassArray

function collectClassNames(value: ClassValue, result: string[]): void {
  if (!value) return

  if (typeof value === 'string' || typeof value === 'number') {
    result.push(String(value))
    return
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectClassNames(item, result)
    }
    return
  }

  if (typeof value === 'object') {
    for (const [key, enabled] of Object.entries(value)) {
      if (enabled) result.push(key)
    }
  }
}

export function cn(...inputs: ClassValue[]): string {
  const result: string[] = []

  for (const input of inputs) {
    collectClassNames(input, result)
  }

  return result.join(' ')
}
