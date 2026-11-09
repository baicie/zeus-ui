import { runReleaseCli } from '@baicie/release'

import config from '../release.config'
import { requirePublishChannel } from './channel-guard'

// The version decides the npm dist-tag; an explicit `--tag` that disagrees with
// it is a release-channel error, not an operator preference.
try {
  requirePublishChannel(process.argv.slice(2))
} catch (error) {
  console.error((error as Error).message)
  process.exit(1)
}

runReleaseCli(config).catch(error => {
  console.error(error)
  process.exit(1)
})
