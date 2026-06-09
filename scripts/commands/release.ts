import { runReleaseCli } from '@baicie/release'

import config from '../release.config'

runReleaseCli(config).catch(error => {
  console.error(error)
  process.exit(1)
})
