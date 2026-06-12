import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Sidebar from '@/components/Sidebar'
import ParticleBackground from '@/components/ParticleBackground'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  title: 'Hermes OS — Mission Control',
  description: 'Hermes Agent mission control dashboard — monitor cron jobs, activities, tasks, and system health in real time.',
  icons: {
    icon: [
      { url: '/favicon.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  manifest: '/manifest.json',
  openGraph: {
    title: 'Hermes OS — Mission Control',
    description: 'Your AI Agent. Your Dashboard. Automate the busywork. Focus on what matters.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'AgenticBiz — AI Agent Dashboard',
      },
    ],
    type: 'website',
    siteName: 'Hermes OS',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hermes OS — Mission Control',
    description: 'Your AI Agent. Your Dashboard. Automate the busywork. Focus on what matters.',
    images: ['/og-image.png'],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans bg-[var(--bg-primary)] text-[var(--text-primary)] antialiased`}>
        <ParticleBackground />
        <div className="relative" style={{ zIndex: 1 }}>
          <Sidebar />
          <main className="min-h-screen h-screen overflow-y-auto overflow-x-hidden pt-14 md:pt-0 md:ml-[220px]">
            <div className="p-4 md:p-6 lg:p-8 max-w-[1400px]">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  )
}
