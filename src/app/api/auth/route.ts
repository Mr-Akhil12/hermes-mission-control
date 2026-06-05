import { NextRequest, NextResponse } from 'next/server'

const PASSWORD = process.env.DASHBOARD_PASSWORD || 'AdminLogsIn'
const AUTH_TOKEN = Buffer.from(`admin:${PASSWORD}`).toString('base64')

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { password } = body

    if (password === PASSWORD) {
      return NextResponse.json({
        success: true,
        token: AUTH_TOKEN,
      })
    }

    return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
