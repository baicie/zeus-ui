import { runPublishCli } from '@baicie/release'

import config from '../release.config'

runPublishCli(config).catch(error => {
  console.error(error)
  process.exit(1)
})
