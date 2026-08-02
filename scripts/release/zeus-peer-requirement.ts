export function createZeusPeerRequirement(version: string): string {
  const match = /^(\d+)\.(\d+)\.\d+/.exec(version)

  if (!match) {
    throw new Error(`Invalid Zeus version: ${version}`)
  }

  if (version.includes('-')) {
    return version
  }

  const major = Number(match[1])
  const minor = Number(match[2])
  const upperBound = major === 0 ? `<0.${minor + 1}.0` : `<${major + 1}.0.0`

  return `>=${version} ${upperBound}`
}
