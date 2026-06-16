'use client'

import { useEffect } from 'react'
import { installCsrfInterceptor } from '@/lib/csrf-client'

export default function CsrfProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    installCsrfInterceptor()
  }, [])

  return <>{children}</>
}
