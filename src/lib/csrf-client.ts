/**
 * Client-side CSRF token fetcher.
 * Fetches /api/csrf on first use, caches the token,
 * and exposes it for inclusion in mutating request headers.
 */

let cachedToken: string | null = null
let tokenPromise: Promise<string> | null = null

export async function getCsrfToken(): Promise<string> {
  if (cachedToken) return cachedToken
  if (tokenPromise) return tokenPromise

  tokenPromise = fetch('/api/csrf')
    .then(r => r.json())
    .then((data: { token: string }) => {
      cachedToken = data.token
      return cachedToken
    })
    .catch(() => {
      // Fallback: return empty string — middleware will reject, but app won't crash
      return ''
    })
    .finally(() => {
      tokenPromise = null
    })

  return tokenPromise
}

/**
 * Monkey-patches window.fetch to automatically attach X-CSRF-Token
 * on mutating requests (POST, PUT, PATCH, DELETE).
 * Skips /api/auth and /api/csrf endpoints.
 */
export function installCsrfInterceptor(): void {
  if (typeof window === 'undefined') return

  // Guard against double-install (React Strict Mode, HMR)
  if ((window as any).__csrfInterceptorInstalled) return
  ;(window as any).__csrfInterceptorInstalled = true

  const originalFetch = window.fetch.bind(window)

  window.fetch = async function (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    const method = init?.method?.toUpperCase() || 'GET'

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.pathname
            : input.url

      // Skip CSRF for auth and csrf endpoints
      if (!url.startsWith('/api/auth') && !url.startsWith('/api/csrf')) {
        const token = await getCsrfToken()
        if (token) {
          init = init || {}
          init.headers = {
            ...init.headers,
            'X-CSRF-Token': token,
          }
        }
      }
    }

    return originalFetch(input, init)
  }
}
