import process from 'node:process'

const basePort = Number(process.env.SHOWCASE_E2E_BASE_PORT || 5173)

if (!Number.isInteger(basePort) || basePort < 1 || basePort > 65532) {
  throw new Error('SHOWCASE_E2E_BASE_PORT must be an integer from 1 to 65532')
}

export const showcasePorts = {
  react: basePort,
  vue: basePort + 1,
  docs: basePort + 2,
  advanced: basePort + 3,
}
