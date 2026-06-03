import type { Metadata } from 'next'
import './globals.css'
import Sidebar from '@/components/Sidebar'

export const metadata: Metadata = {
  title: 'Hermes OS — Mission Control',
  description: 'Hermes Agent mission control dashboard',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#0a0a0f] text-zinc-100 antialiased">
        <Sidebar />
        <main className="ml-14 lg:ml-56 min-h-screen pt-14 p-4 md:p-6">
          {children}
        </main>
      </body>
    </html>
  )
}
