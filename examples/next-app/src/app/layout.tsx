import type { Metadata } from 'next'

import '@zeus-web/themes/default.css'
import './globals.css'

export const metadata: Metadata = {
  title: 'Zeus Web Next App Example',
  description:
    'Next.js App Router example for Zeus Web registry-style components.',
}

export default function RootLayout(
  props: Readonly<{ children: React.ReactNode }>,
) {
  return (
    <html lang="en">
      <body>{props.children}</body>
    </html>
  )
}
