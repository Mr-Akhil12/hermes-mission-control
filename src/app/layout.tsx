import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Sidebar from '@/components/Sidebar'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  title: 'Hermes OS — Mission Control',
  description: 'Hermes Agent mission control dashboard',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans bg-[#f4f6fb] text-[#1a1a2e] antialiased`}>
        <Sidebar />
        <main className="ml-14 lg:ml-56 min-h-screen p-4 md:p-6">
          {children}
        </main>
      </body>
    </html>
  )
}
