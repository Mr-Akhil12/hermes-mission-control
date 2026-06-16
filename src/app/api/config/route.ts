import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface ConfigItem {
  label: string
  value: string
  masked: boolean
}

interface ConfigSection {
  title: string
  items: ConfigItem[]
}

function mask(value: string): string {
  if (!value || value.length <= 4) return '••••'
  return value.slice(0, 4) + '••••'
}

function extractHost(url: string | undefined): string {
  if (!url) return 'Not configured'
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const hermesApiUrl = process.env.HERMES_API_URL
  const openRouterKey = process.env.OPENROUTER_API_KEY
  const environment = process.env.VERCEL_ENV || process.env.NODE_ENV || 'development'

  const version = '0.1.0'

  const sections: ConfigSection[] = [
    {
      title: 'Dashboard',
      items: [
        { label: 'Version', value: version, masked: false },
        { label: 'Environment', value: environment, masked: false },
        { label: 'Runtime', value: 'Next.js 16 (React 19)', masked: false },
      ],
    },
    {
      title: 'Gateway',
      items: [
        { label: 'Hermes API', value: extractHost(hermesApiUrl), masked: false },
        { label: 'Status', value: hermesApiUrl ? 'Configured' : 'Not configured', masked: false },
      ],
    },
    {
      title: 'Database',
      items: [
        {
          label: 'Supabase URL',
          value: supabaseUrl ? mask(supabaseUrl) : 'Not configured',
          masked: true,
        },
        {
          label: 'Supabase Anon Key',
          value: supabaseAnonKey ? mask(supabaseAnonKey) : 'Not configured',
          masked: true,
        },
      ],
    },
    {
      title: 'Integrations',
      items: [
        {
          label: 'OpenRouter API Key',
          value: openRouterKey ? mask(openRouterKey) : 'Not configured',
          masked: true,
        },
      ],
    },
  ]

  return NextResponse.json({
    sections,
    updatedAt: new Date().toISOString(),
  })
}
