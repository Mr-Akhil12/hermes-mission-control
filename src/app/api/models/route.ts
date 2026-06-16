import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface Model {
  id: string
  name: string
  provider: string
  context_length: number
  status: 'active' | 'available' | 'deprecated'
  role: string
  color: string
}

const DEFAULT_MODELS: Model[] = [
  {
    id: 'openrouter/owl-alpha',
    name: 'OWL (OpenRouter)',
    provider: 'openrouter/owl-alpha',
    context_length: 128_000,
    status: 'active',
    role: 'Primary Agent',
    color: 'var(--accent)',
  },
  {
    id: 'google/gemma-3-12b-it:free',
    name: 'Gemma 3 12B',
    provider: 'google/gemma-3-12b-it:free',
    context_length: 128_000,
    status: 'active',
    role: 'Vision Analysis',
    color: 'var(--purple)',
  },
  {
    id: 'anthropic/claude-sonnet-4',
    name: 'Claude Sonnet 4',
    provider: 'anthropic/claude-sonnet-4',
    context_length: 200_000,
    status: 'available',
    role: 'Code & Review',
    color: 'var(--cyan)',
  },
  {
    id: 'hermes-agent',
    name: 'Hermes Agent',
    provider: 'local',
    context_length: 32_000,
    status: 'active',
    role: 'System Default',
    color: 'var(--success)',
  },
]

export async function GET() {
  const modelsEnv = process.env.MODELS_CONFIG

  let models = DEFAULT_MODELS

  if (modelsEnv) {
    try {
      const parsed = JSON.parse(modelsEnv)
      if (Array.isArray(parsed) && parsed.length > 0) {
        models = parsed
      }
    } catch {
      // Fall back to defaults if JSON is invalid
    }
  }

  return NextResponse.json({
    models,
    updatedAt: new Date().toISOString(),
  })
}
