import { ThemeProvider } from '@/components/screenkit/theme'
import { Toaster } from '@/components/ui/sonner'
import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import './neutral-theme.css'
import './theme-transitions.css'
import './glass.css'
import './cursor.css'

const geistSans = Geist({ subsets: ['latin'], variable: '--font-geist-sans' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://mixture-codeilluminators.vercel.app'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'screen inserts — гремучая смесь',
    template: '%s · screenkit',
  },
  description:
    'prop playback system — design, preview, organize and export screen inserts for the crime series «Гремучая смесь».',
  applicationName: 'mixture · screenkit',
  robots: { index: false, follow: false },
  openGraph: {
    title: 'screen inserts — гремучая смесь',
    description: 'prop playback system for the crime series «Гремучая смесь»: library, device preview, prompts, cloud drive.',
    siteName: 'mixture · screenkit',
    type: 'website',
    locale: 'ru_RU',
  },
  icons: {
    icon: [
      { url: '/icon-light-32x32.png', media: '(prefers-color-scheme: light)' },
      { url: '/icon-dark-32x32.png', media: '(prefers-color-scheme: dark)' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#000000',
  colorScheme: 'dark light',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="ru"
      suppressHydrationWarning
      className={`bg-background ${geistSans.variable} ${geistMono.variable}`}
    >
      <body className="font-mono antialiased bg-background text-foreground">
        <ThemeProvider>
          {children}
          <Toaster position="bottom-center" />
        </ThemeProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
