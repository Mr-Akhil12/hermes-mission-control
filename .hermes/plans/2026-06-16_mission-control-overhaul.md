# Mission Control Overhaul — Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Fix all critical/high issues from the audit PDF, refactor the codebase to production quality, and bring the dashboard to 85+/100.

**Architecture:** Extract shared UI components, refactor the 1281-line chat monolith, secure all API routes, add proper auth with session management, implement pagination, and make every page mobile-responsive. Preserve the existing dark design system and particle background.

**Tech Stack:** Next.js 15 (App Router), React 19, Supabase SSR, Tailwind 4, TypeScript 5, Zod (validation), lucide-react

---

## Phase 1: Security Fixes (CRITICAL — do first)

### Task 1: Remove hardcoded keys from keys/page.tsx

**Objective:** Replace hardcoded secrets with environment variables fetched server-side

**Files:**
- Create: `src/app/api/keys/route.ts` (NEW — server-side endpoint)
- Modify: `src/app/keys/page.tsx` (fetch from API instead of hardcoded)

**Step 1:** Create a server-side API route that reads keys from env vars and returns masked versions

```typescript
// src/app/api/keys/route.ts
import { NextRequest, NextResponse } from 'next/server'

const MASKED = '••••••••••••••••'
const KEY_MAP: Record<string, { envKey: string; sensitive: boolean }> = {
  'Supabase URL': { envKey: 'NEXT_PUBLIC_SUPABASE_URL', sensitive: false },
  'Supabase Anon Key': { envKey: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', sensitive: true },
  'OpenRouter API': { envKey: 'OPENROUTER_API_KEY', sensitive: true },
  'Cloudflare Token': { envKey: 'CLOUDFLARE_TOKEN', sensitive: true },
  'n8n API Key': { envKey: 'N8N_API_KEY', sensitive: true },
}

export async function GET() {
  const keys = Object.entries(KEY_MAP).map(([name, config]) => {
    const value = process.env[config.envKey] || 'Not configured'
    const masked = config.sensitive && value !== 'Not configured'
      ? value.slice(0, 4) + MASKED.slice(4)
      : value
    return { name, value: masked, sensitive: config.sensitive, configured: value !== 'Not configured' }
  })
  return NextResponse.json(keys)
}
```

**Step 2:** Update keys/page.tsx to fetch from API, remove all hardcoded values

**Step 3:** Verify build passes: `npm run build`

---

### Task 2: Secure the /api/data route — add rate limiting and input validation

**Objective:** Add Zod validation, rate limiting middleware, and CSRF protection

**Files:**
- Modify: `src/app/api/data/route.ts`
- Create: `src/lib/rate-limit.ts`
- Create: `src/lib/validation.ts`

**Step 1:** Install Zod

```bash
cd /home/akhil/hermes-mission-control && npm install zod
```

**Step 2:** Create rate limiter (in-memory sliding window)

```typescript
// src/lib/rate-limit.ts
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

export function rateLimit(
  key: string,
  limit: number = 60,
  windowMs: number = 60000
): { success: boolean; remaining: number } {
  const now = Date.now()
  const record = rateLimitMap.get(key)
  
  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs })
    return { success: true, remaining: limit - 1 }
  }
  
  if (record.count >= limit) {
    return { success: false, remaining: 0 }
  }
  
  record.count++
  return { success: true, remaining: limit - record.count }
}
```

**Step 3:** Create Zod schemas for API validation

```typescript
// src/lib/validation.ts
import { z } from 'zod'

export const dataQuerySchema = z.object({
  table: z.enum(['agent_activities', 'tasks', 'sessions', 'cron_jobs', 'cron_runs', 'conversations', 'messages']),
  limit: z.coerce.number().int().min(1).max(1000).default(20),
  order: z.string().regex(/^\w+\.(asc|desc)$/).default('created_at.desc'),
  id: z.string().uuid().optional(),
  job_id: z.string().uuid().optional(),
})

export const dataPostSchema = z.object({
  table: z.enum(['agent_activities', 'tasks', 'cron_jobs', 'cron_runs', 'conversations', 'messages']),
  data: z.record(z.unknown()),
})
```

**Step 4:** Update /api/data to use validation + rate limiting + CSRF headers

**Step 5:** Verify build passes

---

### Task 3: Fix auth — add session expiration, protect API routes, add CSRF

**Objective:** Add session expiry, require auth on API routes, add CSRF tokens

**Files:**
- Modify: `src/middleware.ts`
- Modify: `src/app/api/auth/route.ts`
- Create: `src/lib/csrf.ts`

**Step 1:** Update middleware to:
- Add session expiry (24h cookie TTL)
- Protect API routes with auth check (except /api/auth)
- Add CSRF token validation for POST/PATCH/DELETE

**Step 2:** Update auth route to set HttpOnly secure cookies with expiry

**Step 3:** Create CSRF token utility

```typescript
// src/lib/csrf.ts
import { cookies } from 'next/headers'
import crypto from 'crypto'

export async function generateCsrfToken(): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex')
  const cookieStore = await cookies()
  cookieStore.set('csrf_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 86400,
  })
  return token
}

export async function validateCsrfToken(token: string): Promise<boolean> {
  const cookieStore = await cookies()
  const stored = cookieStore.get('csrf_token')?.value
  return stored === token
}
```

**Step 4:** Verify build passes

---

## Phase 2: Architecture Refactoring

### Task 4: Extract shared UI components into src/components/ui/

**Objective:** Create reusable UI primitives to eliminate duplication

**Files:**
- Create: `src/components/ui/Card.tsx`
- Create: `src/components/ui/Badge.tsx`
- Create: `src/components/ui/StatusDot.tsx`
- Create: `src/components/ui/EmptyState.tsx`
- Create: `src/components/ui/LoadingSpinner.tsx`
- Create: `src/components/ui/ErrorBanner.tsx`

**Step 1:** Extract `KPICard` logic into a generic `Card` component
**Step 2:** Extract status dot, priority badge, empty state patterns
**Step 3:** Extract loading spinner and error banner patterns
**Step 4:** Update overview page to use new components
**Step 5:** Verify build passes

---

### Task 5: Refactor chat/page.tsx (1281 lines → 4 components)

**Objective:** Split the monolithic chat page into focused components

**Files:**
- Create: `src/components/chat/ChatSidebar.tsx` (conversation list)
- Create: `src/components/chat/ChatWindow.tsx` (message display + input)
- Create: `src/components/chat/MessageStream.tsx` (SSE streaming logic)
- Create: `src/components/chat/ToolApproval.tsx` (tool approval flow)
- Modify: `src/app/chat/page.tsx` (orchestrator only, <100 lines)

**Step 1:** Read the full chat page and identify the 4 logical sections
**Step 2:** Extract ChatSidebar — conversation list, new chat button, search
**Step 3:** Extract ChatWindow — message rendering, input, send
**Step 4:** Extract MessageStream — SSE connection, streaming state, reconnection
**Step 5:** Extract ToolApproval — approval modal, timeout handling
**Step 6:** Rewrite chat/page.tsx as a thin orchestrator composing these 4 components
**Step 7:** Verify build passes

---

### Task 6: Add pagination to Activity and Cron pages

**Objective:** Replace "load all" with cursor-based pagination

**Files:**
- Modify: `src/app/activity/page.tsx`
- Modify: `src/app/cron/page.tsx`
- Create: `src/components/ui/Pagination.tsx`

**Step 1:** Create reusable Pagination component with page numbers + prev/next
**Step 2:** Update activity page to fetch 20 at a time with page controls
**Step 3:** Update cron page to paginate cron_runs
**Step 4:** Verify build passes

---

## Phase 3: Feature Completeness

### Task 7: Add cron enable/disable toggle and Run Now button

**Objective:** Make cron page interactive instead of read-only

**Files:**
- Modify: `src/app/cron/page.tsx`
- Modify: `src/app/api/cron/[id]/route.ts`

**Step 1:** Add toggle switch for enable/disable on each cron job
**Step 2:** Add "Run Now" button with confirmation
**Step 3:** Create PATCH endpoint to toggle job status
**Step 4:** Verify build passes

---

### Task 8: Fetch models and config from system state instead of hardcoding

**Objective:** Make Models and Config pages dynamic

**Files:**
- Modify: `src/app/models/page.tsx`
- Modify: `src/app/config/page.tsx`
- Create: `src/app/api/config/route.ts`

**Step 1:** Create config API endpoint that returns system state from env/Supabase
**Step 2:** Update models page to fetch from a models config table or env
**Step 3:** Update config page to display actual system configuration
**Step 4:** Verify build passes

---

## Phase 4: Mobile & Performance

### Task 9: Fix mobile responsiveness across all pages

**Objective:** Ensure every page works on mobile (320px+)

**Files:**
- Modify: `src/components/Sidebar.tsx` (already has mobile — verify)
- Modify: `src/app/activity/page.tsx`
- Modify: `src/app/tasks/page.tsx`
- Modify: `src/app/chat/page.tsx`

**Step 1:** Audit each page for mobile breakpoints
**Step 2:** Add responsive grid layouts (stack on mobile)
**Step 3:** Ensure touch targets are 44px minimum
**Step 4:** Add horizontal scroll containers for any tables
**Step 5:** Verify build passes

---

### Task 10: Add SWR for data fetching + Next.js Image optimization

**Objective:** Improve performance with caching and image optimization

**Files:**
- Install: `swr`
- Modify: All pages that fetch data

**Step 1:** Install SWR
```bash
npm install swr
```

**Step 2:** Create a reusable `useSupabaseQuery` hook with SWR
**Step 3:** Replace raw fetch calls with SWR hooks for automatic caching/revalidation
**Step 4:** Replace any `<img>` tags with Next.js `<Image>` component
**Step 5:** Verify build passes

---

## Phase 5: Verification

### Task 11: Full build verification + deployment

**Objective:** Ensure everything builds clean and deploy to Vercel

**Step 1:** `npm run build` — must pass with zero errors
**Step 2:** `npm run lint` — must pass
**Step 3:** Run through the requesting-code-review pipeline
**Step 4:** `git add -A && git commit -m "[verified] Mission Control overhaul — security, architecture, features, mobile"`
**Step 5:** `git push` → verify deploy at jarvis-x-akhil.vercel.app
**Step 6:** Browser vision verification of key pages

---

## Files Likely to Change

- `src/app/api/data/route.ts` — security hardening
- `src/app/api/auth/route.ts` — session management
- `src/middleware.ts` — auth + CSRF
- `src/app/chat/page.tsx` — massive refactor (1281→100 lines)
- `src/app/keys/page.tsx` — remove hardcoded secrets
- `src/app/activity/page.tsx` — pagination
- `src/app/cron/page.tsx` — enable/disable + pagination
- `src/app/models/page.tsx` — dynamic data
- `src/app/config/page.tsx` — dynamic data
- `src/components/ui/*` — new shared components
- `src/components/chat/*` — new chat components

## Risks & Tradeoffs

- **SERVICE_ROLE_KEY on data route:** Currently bypasses RLS — this is by design for the dashboard. Adding rate limiting + auth is the pragmatic fix. Full RLS migration is a larger project.
- **Chat refactor:** Highest risk change — the SSE streaming logic is complex. Will need careful testing.
- **SWR migration:** Adds a dependency but significantly improves UX with optimistic updates and caching.
