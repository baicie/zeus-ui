export type ClassValue =
  | string
  | number
  | false
  | null
  | undefined
  | ClassValue[]

export function cx(...inputs: ClassValue[]): string {
  const result: string[] = []

  for (const input of inputs) {
    if (!input) continue

    if (Array.isArray(input)) {
      const value = cx(...input)
      if (value) result.push(value)

      continue
    }

    result.push(String(input))
  }

  return result.join(' ')
}
