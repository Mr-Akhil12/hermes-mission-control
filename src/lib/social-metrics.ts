/**
 * Social Media Metrics — Utility functions for fetching platform stats.
 *
 * Each function returns:
 *   { followers: number, growth: number, engagement: number }
 *
 *   followers — total follower / subscriber / member count
 *   growth    — weekly growth percentage (positive or negative)
 *   engagement — engagement score (0-100) representing interaction rate
 *
 * Platforms with API keys: YouTube (needs key)
 * Platforms without auth: GitHub, TikTok (scrape), X (scrape), Facebook (scrape)
 */

export interface PlatformStats {
  followers: number
  growth: number
  engagement: number
}

export interface SocialMetrics {
  youtube: PlatformStats
  twitter: PlatformStats
  tiktok: PlatformStats
  facebook: PlatformStats
  github: PlatformStats
  website: PlatformStats
}

/* ═══════════════════════════════════════════════════════════════════
 * YouTube (needs API key — placeholder until key is provided)
 * ═══════════════════════════════════════════════════════════════════ */

export async function fetchYouTubeStats(): Promise<PlatformStats> {
  // TODO: Replace with YouTube Data API v3 once key is provided
  // const res = await fetch(
  //   `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${YOUTUBE_CHANNEL_ID}&key=${YOUTUBE_API_KEY}`
  // )
  // const json = await res.json()
  // const stats = json.items[0].statistics
  // return { followers: +stats.subscriberCount, growth: 0, engagement: 0 }

  return { followers: 0, growth: 0, engagement: 0 }
}

/* ═══════════════════════════════════════════════════════════════════
 * X / Twitter (public profile scraping — no API key needed)
 * ═══════════════════════════════════════════════════════════════════ */

export async function fetchTwitterStats(): Promise<PlatformStats> {
  try {
    // Scrape public X profile page for follower count
    const res = await fetch('https://x.com/ThatITDudee', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    })
    const html = await res.text()

    // Extract follower count from the page
    // X uses "followers" in the meta og:description or in the title
    const followerMatch = html.match(/(\d+(?:,\d+)*(?:\.\d+)?[KMB]?)\s*Followers/i)
    const followers = followerMatch ? parseCompactNumber(followerMatch[1]) : 0

    return {
      followers,
      growth: 0, // Would need historical data to calculate
      engagement: 0, // Would need tweet interaction data
    }
  } catch {
    return { followers: 0, growth: 0, engagement: 0 }
  }
}

/* ═══════════════════════════════════════════════════════════════════
 * TikTok (public profile scraping — no API key needed)
 * ═══════════════════════════════════════════════════════════════════ */

export async function fetchTikTokStats(): Promise<PlatformStats> {
  try {
    const res = await fetch('https://www.tiktok.com/@that_it_dude', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    })
    const html = await res.text()

    // Extract follower count from TikTok profile
    // TikTok renders client-side, so we look for SSR data in JSON
    const followerMatch = html.match(/"followerCount"\s*:\s*(\d+)/)
    const followingMatch = html.match(/"followingCount"\s*:\s*(\d+)/)
    const likesMatch = html.match(/"heartCount"\s*:\s*(\d+)/)
    const videoMatch = html.match(/"videoCount"\s*:\s*(\d+)/)

    const followers = followerMatch ? parseInt(followerMatch[1], 10) : 0
    const following = followingMatch ? parseInt(followingMatch[1], 10) : 0
    const likes = likesMatch ? parseInt(likesMatch[1], 10) : 0
    const videos = videoMatch ? parseInt(videoMatch[1], 10) : 0

    // Engagement estimate: (likes / videos) / followers * 100
    const engagement = followers > 0 && videos > 0
      ? Math.min(Math.round((likes / videos / followers) * 100), 100)
      : 0

    return { followers, growth: 0, engagement }
  } catch {
    return { followers: 0, growth: 0, engagement: 0 }
  }
}

/* ═══════════════════════════════════════════════════════════════════
 * Facebook (public profile scraping — no API key needed)
 * ═══════════════════════════════════════════════════════════════════ */

export async function fetchFacebookStats(): Promise<PlatformStats> {
  try {
    // Facebook heavily restricts scraping. Use the public share page
    const res = await fetch('https://www.facebook.com/share/1GjxKY9X9n/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    })
    const html = await res.text()

    // Look for follower/like count in the page
    const followerMatch = html.match(/(\d+(?:,\d+)*)\s*(?:likes|followers|people like this)/i)
    const followers = followerMatch ? parseCompactNumber(followerMatch[1]) : 0

    return { followers, growth: 0, engagement: 0 }
  } catch {
    return { followers: 0, growth: 0, engagement: 0 }
  }
}

/* ═══════════════════════════════════════════════════════════════════
 * GitHub (public API — no auth needed)
 * ═══════════════════════════════════════════════════════════════════ */

export async function fetchGitHubStats(): Promise<PlatformStats> {
  try {
    const res = await fetch('https://api.github.com/users/Mr-Akhil12', {
      headers: {
        'User-Agent': 'Hermes-Mission-Control',
        'Accept': 'application/vnd.github.v3+json',
      },
    })

    if (!res.ok) {
      throw new Error(`GitHub API returned ${res.status}`)
    }

    const data = await res.json()
    const followers = data.followers ?? 0
    const publicRepos = data.public_repos ?? 0

    // Engagement estimate based on repos vs followers ratio
    const engagement = followers > 0
      ? Math.min(Math.round((publicRepos / followers) * 100), 100)
      : 0

    return { followers, growth: 0, engagement }
  } catch {
    return { followers: 0, growth: 0, engagement: 0 }
  }
}

/* ═══════════════════════════════════════════════════════════════════
 * Website (blog post count as proxy for site activity)
 * ═══════════════════════════════════════════════════════════════════ */

export async function fetchWebsiteStats(): Promise<PlatformStats> {
  try {
    // Count blog posts on agenticbiz as a proxy for website activity
    const res = await fetch('https://agenticbiz.co.za/blog', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })
    const html = await res.text()

    // Count blog post links/entries
    const postMatches = html.match(/blog\/[a-z0-9-]+/gi) ?? []
    const postCount = new Set(postMatches).size

    // Use post count as "followers" proxy (activity metric)
    return {
      followers: postCount,
      growth: 0,
      engagement: 0,
    }
  } catch {
    return { followers: 0, growth: 0, engagement: 0 }
  }
}

/* ═══════════════════════════════════════════════════════════════════
 * Helpers
 * ═══════════════════════════════════════════════════════════════════ */

function parseCompactNumber(s: string): number {
  s = s.replace(/,/g, '').trim()
  const match = s.match(/^(\d+(?:\.\d+)?)\s*([KMB])?$/i)
  if (!match) return parseInt(s, 10) || 0
  const num = parseFloat(match[1])
  const suffix = match[2]?.toUpperCase()
  if (suffix === 'K') return Math.round(num * 1000)
  if (suffix === 'M') return Math.round(num * 1000000)
  if (suffix === 'B') return Math.round(num * 1000000000)
  return Math.round(num)
}

/**
 * Fetch all platform stats concurrently.
 */
export async function fetchAllSocialMetrics(): Promise<SocialMetrics> {
  const [youtube, twitter, tiktok, facebook, github, website] = await Promise.all([
    fetchYouTubeStats(),
    fetchTwitterStats(),
    fetchTikTokStats(),
    fetchFacebookStats(),
    fetchGitHubStats(),
    fetchWebsiteStats(),
  ])

  return { youtube, twitter, tiktok, facebook, github, website }
}
