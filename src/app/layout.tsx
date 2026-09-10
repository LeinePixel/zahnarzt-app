import type { Metadata } from 'next'

import './globals.css'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: {
    default: 'DentPilot',
    template: '%s | DentPilot',
  },
  description: 'Der sichere digitale Arbeitsplatz für Ihre Zahnarztpraxis.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body className="antialiased">{children}</body>
    </html>
  )
}
