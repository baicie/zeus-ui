import { describe, expect, it } from 'vitest'

import { checkAdvancedFinalContract } from '../check-advanced-final-contract'

describe('advanced final contract', () => {
  it('passes final advanced contract', () => {
    expect(() => checkAdvancedFinalContract()).not.toThrow()
  })
})
