'use client'

import { useState, Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Lock, AlertTriangle, ArrowRight } from 'lucide-react'
import Image from 'next/image'

function LoginForm() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [csrfToken, setCsrfToken] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') || '/'

  // Fetch CSRF token on mount
  useEffect(() => {
    fetch('/api/csrf')
      .then(res => res.json())
      .then(data => setCsrfToken(data.token))
      .catch(() => {
        // CSRF token fetch failed — login form still works since auth route sets the cookie
      })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password.trim()) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        },
        body: JSON.stringify({ password }),
      })

      if (res.ok) {
        // Server sets cookies — just redirect
        router.push(redirect)
        router.refresh()
      } else if (res.status === 429) {
        setError('Too many attempts. Please wait and try again.')
      } else if (res.status === 401) {
        setError('Incorrect password. Try again.')
      } else {
        setError('Login failed. Please try again.')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl glass-panel border border-[var(--border)] p-6">
      <div className="flex items-center gap-2 mb-5">
        <Lock className="w-4 h-4 text-[var(--text-muted)]" />
        <h2 className="text-sm font-semibold text-[var(--text-secondary)]">Enter password to continue</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <input
            type="password"
            value={password}
            onChange={e => { setPassword(e.target.value); setError(null) }}
            placeholder="Password"
            autoFocus
            className={`w-full px-4 py-3 rounded-xl bg-[var(--bg-secondary)] border text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none transition-colors ${
              error ? 'border-[var(--danger)]/50' : 'border-[var(--border)] focus:border-[var(--accent)]/40'
            }`}
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 text-[var(--danger)]">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="text-xs">{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-[var(--accent)] to-[var(--purple)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              Unlock Dashboard
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="mx-auto mb-4">
            <Image src="/logo.png" alt="Hermes" width={72} height={72} className="rounded-2xl mx-auto" style={{ filter: 'drop-shadow(0 0 20px rgba(79, 143, 255, 0.3))' }} />
          </div>
          <h1 className="text-xl font-bold gradient-text">Hermes OS</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">Mission Control</p>
        </div>

        <Suspense fallback={
          <div className="rounded-2xl glass-panel border border-[var(--border)] p-6 flex items-center justify-center py-12">
            <div className="w-5 h-5 border-2 border-[var(--accent)]/30 border-t-[var(--accent)] rounded-full animate-spin" />
          </div>
        }>
          <LoginForm />
        </Suspense>

        <p className="text-center text-[10px] text-[var(--text-muted)] mt-4">
          Protected by Hermes OS · Unauthorized access prohibited
        </p>
      </div>
    </div>
  )
}
