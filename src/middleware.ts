import { NextRequest, NextResponse } from 'next/server'

const PASSWORD = process.env.DASHBOARD_PASSWORD || 'AdminLogsIn'
const AUTH_TOKEN = Buffer.from(`admin:${PASSWORD}`).toString('base64')

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip auth for public routes
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/api/') ||
    pathname === '/favicon.ico' ||
    pathname === '/login'
  ) {
    return NextResponse.next()
  }

  // Check for auth cookie
  const authCookie = request.cookies.get('mc_auth')?.value
  if (authCookie === AUTH_TOKEN) {
    return NextResponse.next()
  }

  // Redirect to login
  const loginUrl = new URL('/login', request.url)
  loginUrl.searchParams.set('redirect', pathname)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
