/* eslint-disable no-template-curly-in-string */
/**
 * Guards the deployment's Content-Security-Policy.
 *
 * The workbench used to ship `connect-src 'self'` unconditionally. BYOK needs
 * the page to reach an operator-named gateway, so the template gained one
 * opt-in variable — and that variable is exactly the kind of thing that rots:
 * someone moves a file, drops the envsubst filter entry, or reformats the
 * directive, and the failure is a CSP error in a browser nobody is looking at.
 *
 * These checks assert the properties that make the opt-in safe:
 *
 * 1. With nothing configured, the rendered policy is the original one.
 * 2. A configured value lands inside `connect-src` and nowhere else.
 * 3. The normaliser rejects input that could break out of the directive.
 * 4. The envsubst filter actually includes the variable (a literal
 *    `${...}` in a header is invalid CSP and gets dropped by the browser).
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const root = path.resolve(import.meta.dirname, '../../..')
const deployDir = path.join(root, 'examples/ai-workbench/deploy')
const templatePath = path.join(deployDir, 'nginx.conf')
const entrypointPath = path.join(deployDir, 'entrypoint.sh')
const dockerfilePath = path.join(root, 'examples/ai-workbench/Dockerfile')

/** Extracts the CSP `add_header` line from the template. */
function cspTemplate(): string {
  const text = fs.readFileSync(templatePath, 'utf8')
  const line = text
    .split('\n')
    .find(entry =>
      entry.trimStart().startsWith('add_header Content-Security-Policy'),
    )
  expect(line, 'the template must declare a CSP').toBeDefined()
  return line!
}

/** The `connect-src` directive as configured, before substitution. */
function connectSrcDirective(): string {
  const match = /connect-src ([^;]+);/.exec(cspTemplate())
  expect(match, 'the CSP must declare connect-src').not.toBeNull()
  return match![1]!
}

/**
 * Runs the entrypoint's normalisation logic in a shell and prints what it
 * exports. The script ends with `exec docker-entrypoint`, which does not exist
 * outside the image, so the function is sourced with `sh -c` and the export is
 * echoed before that point.
 */
function normalise(value: string): { spaced: string; rejected: boolean } {
  const script = fs.readFileSync(entrypointPath, 'utf8')
  const body = script
    .split('\n')
    .filter(line => !line.startsWith('exec '))
    .join('\n')
  try {
    const out = execFileSync(
      'sh',
      ['-c', `${body}\nprintf '%s' "$ZEUS_BYOK_CONNECT_SRC_SPACED"`],
      {
        env: { ...process.env, ZEUS_BYOK_CONNECT_SRC: value },
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
    return { spaced: out, rejected: false }
  } catch {
    return { spaced: '', rejected: true }
  }
}

describe('workbench CSP', () => {
  it('defaults to self-only when no BYOK origin is configured', () => {
    const directive = connectSrcDirective()
    // The variable is the only optional part; nothing else may be added.
    const withoutVariable = directive.replace(
      '${ZEUS_BYOK_CONNECT_SRC_SPACED}',
      '',
    )
    expect(withoutVariable.trim()).toBe("'self'")
  })

  it('places the operator value inside connect-src and nowhere else', () => {
    const csp = cspTemplate()
    const occurrences = csp.split('${ZEUS_BYOK_CONNECT_SRC_SPACED}').length - 1
    expect(occurrences, 'the variable must appear exactly once').toBe(1)
    expect(csp.indexOf('${ZEUS_BYOK_CONNECT_SRC_SPACED}')).toBeGreaterThan(
      csp.indexOf('connect-src'),
    )
    expect(csp.indexOf('${ZEUS_BYOK_CONNECT_SRC_SPACED}')).toBeLessThan(
      csp.indexOf('font-src'),
    )
  })

  it('leaves script-src and object-src strict', () => {
    const csp = cspTemplate()
    expect(csp).toContain("script-src 'self';")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("base-uri 'none'")
    expect(csp).toContain("frame-ancestors 'none'")
    // No blanket relaxation sneaks in alongside the opt-in.
    expect(csp).not.toContain("'unsafe-eval'")
    expect(csp).not.toMatch(/script-src[^;]*\*/)
  })

  it('normalises a configured value to exactly one leading space', () => {
    expect(normalise('https://api.example.com').spaced).toBe(
      ' https://api.example.com',
    )
    expect(normalise('  https://a.example   https://b.example  ').spaced).toBe(
      ' https://a.example https://b.example',
    )
    expect(normalise('').spaced).toBe('')
  })

  it('rejects values that could break out of the directive', () => {
    for (const hostile of [
      'https://x.example; script-src *',
      "https://x.example, 'unsafe-inline'",
      "https://x.example 'unsafe-eval'",
    ]) {
      expect(normalise(hostile).rejected, hostile).toBe(true)
    }
  })

  it('keeps the envsubst filter in step with the template variables', () => {
    const dockerfile = fs.readFileSync(dockerfilePath, 'utf8')
    const filter = /NGINX_ENVSUBST_FILTER=(?:'([^']+)'|"([^"]+)"|(\S+))/.exec(
      dockerfile,
    )
    expect(
      filter,
      'the Dockerfile must set NGINX_ENVSUBST_FILTER',
    ).not.toBeNull()
    const pattern = filter![1] ?? filter![2] ?? filter![3]!
    const regex = new RegExp(pattern)

    // Every `${VAR}` the template references must be substituted, or nginx
    // receives a literal `${...}` and the browser drops the whole directive.
    const declared = [...cspTemplate().matchAll(/\$\{([A-Z0-9_]+)\}/g)].map(
      match => match[1]!,
    )
    expect(declared, 'the template must reference the BYOK variable').toContain(
      'ZEUS_BYOK_CONNECT_SRC_SPACED',
    )
    for (const name of declared) {
      expect(regex.test(name), `${name} is not in NGINX_ENVSUBST_FILTER`).toBe(
        true,
      )
    }
  })

  it('keeps the Host bearer token out of the browser', () => {
    // The token is substituted only into the proxy header, never into a page.
    const template = fs.readFileSync(templatePath, 'utf8')
    const tokenLines = template
      .split('\n')
      .filter(line => line.includes('${ZEUS_AI_UPSTREAM_TOKEN}'))
    expect(tokenLines.length).toBeGreaterThan(0)
    for (const line of tokenLines) {
      expect(line).toContain('proxy_set_header Authorization')
    }
  })
})
