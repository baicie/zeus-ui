import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: [
    '@zeus-web/button',
    '@zeus-web/checkbox',
    '@zeus-web/dialog',
    '@zeus-web/input',
    '@zeus-web/switch',
    '@zeus-web/tabs',
    '@zeus-web/themes',
  ],
}

export default nextConfig
