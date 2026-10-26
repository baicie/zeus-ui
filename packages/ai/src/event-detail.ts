import type { ZeusWebAiEvent } from './types'

export function formatEventDetail(
  event: Pick<ZeusWebAiEvent, 'detail' | 'detailOptional'>,
): string {
  const optional = new Set(event.detailOptional)
  return Object.keys(event.detail)
    .map(
      name => `${name}${optional.has(name) ? '?' : ''}: ${event.detail[name]}`,
    )
    .join(', ')
}
