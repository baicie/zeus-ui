import { cleanup } from '@testing-library/react/pure'

import { waitForZeusElements } from './test-utils/wait-for-zeus-elements'

import '@testing-library/react/dont-cleanup-after-each'
import '@testing-library/jest-dom/vitest'

afterEach(() => waitForZeusElements().then(() => cleanup()))
