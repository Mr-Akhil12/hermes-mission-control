// ─── Shared Helper Functions for Chat ───

export function timeAgo(dateStr: string): string {
  if (!dateStr) return '—'
  const ms = new Date(dateStr).getTime()
  if (isNaN(ms)) return '—'
  const s = (Date.now() - ms) / 1000
  if (s < 0) return 'just now'
  if (s < 60) return `${Math.floor(s)}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

/** Escape HTML entities to prevent XSS in markdown rendering. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Validate that a URL href is safe (no javascript:/data:/vbscript: protocols). */
function isSafeHref(href: string): boolean {
  const trimmed = href.trim().toLowerCase()
  return !trimmed.startsWith('javascript:') && !trimmed.startsWith('data:') && !trimmed.startsWith('vbscript:')
}

export function renderMarkdown(text: string) {
  if (!text) return ''

  // Process line by line for block-level elements, then apply inline
  const lines = text.split('\n')
  const result: string[] = []
  let inCodeBlock = false
  let codeBlockLang = ''
  let codeLines: string[] = []
  let inUl = false
  let inOl = false

  const inlineMd = (s: string) =>
    s
      .replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded-md bg-[var(--bg-primary)] text-[var(--accent)] text-xs font-mono border border-[var(--border)]">$1</code>')
      .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-[var(--text-primary)]">$1</strong>')
      .replace(/\*(.+?)\*/g, '<em class="italic">$1</em>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, linkText, href) => {
        if (!isSafeHref(href)) return escapeHtml(linkText)
        return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener" class="text-[var(--accent)] hover:underline">${linkText}</a>`
      })

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Fenced code blocks
    if (line.trimStart().startsWith('```')) {
      if (inCodeBlock) {
        result.push(`<pre class="bg-[var(--bg-primary)] rounded-xl p-4 my-3 overflow-x-auto border border-[var(--border)]"><code class="text-xs font-mono text-[var(--text-secondary)]">${codeLines.join('\n')}</code></pre>`)
        inCodeBlock = false
        codeLines = []
      } else {
        inCodeBlock = true
        codeBlockLang = line.trim().slice(3).trim()
        if (inUl) { result.push('</ul>'); inUl = false }
        if (inOl) { result.push('</ol>'); inOl = false }
      }
      continue
    }

    if (inCodeBlock) {
      codeLines.push(escapeHtml(line))
      continue
    }

    // Horizontal rules (---, ***, ___)
    if (/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line)) {
      if (inUl) { result.push('</ul>'); inUl = false }
      if (inOl) { result.push('</ol>'); inOl = false }
      result.push('<hr class="my-4 border-[var(--border)]" />')
      continue
    }

    // Blockquotes
    if (line.startsWith('>')) {
      if (inUl) { result.push('</ul>'); inUl = false }
      if (inOl) { result.push('</ol>'); inOl = false }
      const content = line.replace(/^>\s?/, '')
      result.push(`<blockquote class="pl-3 py-1 my-2 border-l-2 border-[var(--accent)]/40 text-[var(--text-muted)] italic text-sm">${inlineMd(escapeHtml(content))}</blockquote>`)
      continue
    }

    // Unordered lists
    const ulMatch = line.match(/^(\s*)[-*+]\s+(.*)/)
    if (ulMatch) {
      if (inOl) { result.push('</ol>'); inOl = false }
      if (!inUl) { result.push('<ul class="list-disc pl-5 my-2 space-y-1 text-sm text-[var(--text-secondary)]">'); inUl = true }
      result.push(`<li>${inlineMd(escapeHtml(ulMatch[2]))}</li>`)
      continue
    }

    // Ordered lists
    const olMatch = line.match(/^(\s*)\d+\.\s+(.*)/)
    if (olMatch) {
      if (inUl) { result.push('</ul>'); inUl = false }
      if (!inOl) { result.push('<ol class="list-decimal pl-5 my-2 space-y-1 text-sm text-[var(--text-secondary)]">'); inOl = true }
      result.push(`<li>${inlineMd(escapeHtml(olMatch[2]))}</li>`)
      continue
    }

    // Close any open lists
    if (inUl) { result.push('</ul>'); inUl = false }
    if (inOl) { result.push('</ol>'); inOl = false }

    // Regular text line
    if (line.trim() === '') {
      result.push('<br />')
    } else {
      result.push(`<span>${inlineMd(escapeHtml(line))}</span>`)
    }
  }

  // Close any open structures
  if (inUl) result.push('</ul>')
  if (inOl) result.push('</ol>')
  if (inCodeBlock) {
    result.push(`<pre class="bg-[var(--bg-primary)] rounded-xl p-4 my-3 overflow-x-auto border border-[var(--border)]"><code class="text-xs font-mono text-[var(--text-secondary)]">${codeLines.join('\n')}</code></pre>`)
  }

  return result.join('\n')
}
