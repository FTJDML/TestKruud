import type { Metadata, Viewport } from 'next'
import { Inter, Manrope } from 'next/font/google'
import './globals.css'
import { absoluteUrl, siteName, siteTagline } from '@/lib/seo/metadata'

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  display: 'swap',
  weight: ['600', '700', '800'],
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  weight: ['400', '500', '600'],
})

export const metadata: Metadata = {
  metadataBase: new URL(absoluteUrl('/')),
  title: {
    default: `${siteName} — bijzondere vondsten voor in en om het huis`,
    template: `%s · ${siteName}`,
  },
  description:
    'Elke dag een nieuwe selectie verrassende, slimme en soms licht absurde producten voor wonen, koken, tuin, gaming en onderweg. Prijzen dagelijks gecontroleerd.',
  applicationName: siteName,
  keywords: ['bijzondere producten', 'woonvondsten', 'slimme gadgets', 'deals', 'cadeaus'],
  authors: [{ name: `Redactie ${siteName}` }],
  openGraph: {
    type: 'website',
    locale: 'nl_NL',
    siteName,
    title: siteName,
    description: siteTagline,
  },
  twitter: { card: 'summary_large_image' },
}

export const viewport: Viewport = {
  themeColor: '#f7f7f4',
  width: 'device-width',
  initialScale: 1,
}

/**
 * Root layout: alleen document, fonts en basiskleuren. De publieke chrome
 * (header, categoriebalk, footer) staat in de route group `(site)`, zodat het
 * adminpaneel geen winkelnavigatie en geen zoekformulier meekrijgt.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" data-scroll-behavior="smooth" className={`${manrope.variable} ${inter.variable}`}>
      <body className="min-h-dvh bg-canvas font-sans text-ink antialiased">{children}</body>
    </html>
  )
}
