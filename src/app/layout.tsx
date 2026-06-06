import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Sidebar from '@/components/Sidebar'
import ParticleBackground from '@/components/ParticleBackground'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  title: 'Hermes OS — Mission Control',
  description: 'Hermes Agent mission control dashboard',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/manifest.json',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans bg-[var(--bg-primary)] text-[var(--text-primary)] antialiased`}>
        <ParticleBackground />
        <div className="relative" style={{ zIndex: 1 }}>
          <Sidebar />
          <main className="min-h-screen pt-14 md:pt-0 md:ml-[220px]">
            <div className="p-4 md:p-6 lg:p-8 max-w-[1400px]">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  )
}
