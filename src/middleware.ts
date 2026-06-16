import { NextRequest, NextResponse } from 'next/server'

// Constant-time string comparison (safe for Edge Runtime — no Node.js crypto needed)
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const method = request.method

  // Skip auth for public routes
  if (
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico' ||
    pathname === '/login' ||
    pathname === '/api/auth' ||
    pathname === '/api/csrf'
  ) {
    return NextResponse.next()
  }

  // Check for auth cookie
  const authCookie = request.cookies.get('mc_auth')?.value
  if (!authCookie) {
    // For API routes, return 401 JSON error instead of redirect
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Validate cookie format (hex-encoded 32 bytes = 64 chars)
  if (authCookie.length !== 64 || !/^[0-9a-f]{64}$/i.test(authCookie)) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // For mutating API routes (POST, PUT, PATCH, DELETE), check CSRF token
  if (
    pathname.startsWith('/api/') &&
    ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)
  ) {
    const csrfHeader = request.headers.get('x-csrf-token')
    const csrfCookie = request.cookies.get('csrf_token')?.value

    if (!csrfHeader || !csrfCookie) {
      return NextResponse.json({ error: 'CSRF token missing' }, { status: 403 })
    }

    if (!timingSafeEqual(csrfHeader, csrfCookie)) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 })
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
