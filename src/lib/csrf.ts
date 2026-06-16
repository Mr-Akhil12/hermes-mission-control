import { cookies } from 'next/headers'
import crypto from 'crypto'

export async function generateCsrfToken(): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex')
  const cookieStore = await cookies()
  cookieStore.set('csrf_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 86400, // 24 hours
    path: '/',
  })
  return token
}

export async function validateCsrfToken(token: string): Promise<boolean> {
  const cookieStore = await cookies()
  const stored = cookieStore.get('csrf_token')?.value
  if (!stored || !token) return false
  if (stored.length !== token.length) return false
  try {
    return crypto.timingSafeEqual(Buffer.from(stored), Buffer.from(token))
  } catch {
    return false
  }
}
