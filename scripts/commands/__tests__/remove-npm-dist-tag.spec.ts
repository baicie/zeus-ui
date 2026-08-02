import { describe, expect, it } from 'vitest'

import { getDistTagRemovalDecision } from '../remove-npm-dist-tag'

describe('npm dist-tag removal', () => {
  it('removes only a tag that points to the requested version', () => {
    expect(
      getDistTagRemovalDecision(
        { beta: '0.1.0-beta.0', latest: '0.1.0-beta.0' },
        'latest',
        '0.1.0-beta.0',
      ),
    ).toBe('remove')
    expect(
      getDistTagRemovalDecision(
        { beta: '0.1.0-beta.0' },
        'latest',
        '0.1.0-beta.0',
      ),
    ).toBe('skip')
    expect(() =>
      getDistTagRemovalDecision({ latest: '0.1.0' }, 'latest', '0.1.0-beta.0'),
    ).toThrow('latest points to 0.1.0, not 0.1.0-beta.0')
  })
})
