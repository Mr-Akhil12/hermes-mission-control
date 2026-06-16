import { NextResponse } from 'next/server'

interface KeyInfo {
  name: string
  value: string
  sensitive: boolean
  configured: boolean
}

function maskValue(value: string): string {
  if (value.length <= 4) return '••••'
  return value.slice(0, 4) + '••••'
}

export async function GET() {
  const envKeys = [
    { name: 'Supabase URL', env: 'NEXT_PUBLIC_SUPABASE_URL', sensitive: false },
    { name: 'Supabase Anon Key', env: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', sensitive: true },
    { name: 'OpenRouter API', env: 'OPENROUTER_API_KEY', sensitive: true },
    { name: 'Cloudflare Token', env: 'CLOUDFLARE_TOKEN', sensitive: true },
    { name: 'n8n API Key', env: 'N8N_API_KEY', sensitive: true },
  ]

  const keys: KeyInfo[] = envKeys.map(({ name, env, sensitive }) => {
    const value = process.env[env]
    const configured = Boolean(value)

    return {
      name,
      value: !configured
        ? 'Not configured'
        : sensitive
          ? maskValue(value!)
          : value!,
      sensitive,
      configured,
    }
  })

  return NextResponse.json(keys)
}
