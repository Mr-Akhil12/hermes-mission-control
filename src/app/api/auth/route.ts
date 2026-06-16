import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { rateLimit } from '@/lib/rate-limit'

const MAX_ATTEMPTS = 10
const WINDOW_MS = 15 * 60 * 1000 // 15 minutes

function getPassword(): string | undefined {
  return process.env.DASHBOARD_PASSWORD
}

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  return request.headers.get('x-real-ip') || '127.0.0.1'
}

export async function POST(request: NextRequest) {
  // Fail closed: if DASHBOARD_PASSWORD is not set, login is impossible
  const storedPassword = getPassword()
  if (!storedPassword) {
    return NextResponse.json(
      { error: 'Authentication not configured' },
      { status: 503 }
    )
  }

  try {
    const ip = getClientIp(request)
    const rl = rateLimit(`login:${ip}`, MAX_ATTEMPTS, WINDOW_MS)

    if (!rl.success) {
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again later.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { password } = body

    if (password !== storedPassword) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
    }

    // Generate session token
    const sessionToken = crypto.randomBytes(32).toString('hex')

    const response = NextResponse.json({ success: true })

    // Set auth cookie — httpOnly, secure, sameSite strict, 24h expiry
    response.cookies.set('mc_auth', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 86400, // 24 hours
      path: '/',
    })

    // Set CSRF token cookie
    const csrfToken = crypto.randomBytes(32).toString('hex')
    response.cookies.set('csrf_token', csrfToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 86400, // 24 hours
      path: '/',
    })

    return response
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
