import { runPublishCli } from '@baicie/release'

import config from '../release.config'
import { requirePublishChannel } from './channel-guard'

// `ci-publish` is the only path that writes to the npm registry from CI. The
// channel guard runs before the CLI so an rc version can never land on
// `latest`, and a stable version can never land on `rc` or `beta`.
try {
  requirePublishChannel(process.argv.slice(2))
} catch (error) {
  console.error((error as Error).message)
  process.exit(1)
}

runPublishCli(config).catch(error => {
  console.error(error)
  process.exit(1)
})
