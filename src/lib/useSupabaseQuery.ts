import useSWR from 'swr'

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return r.json()
  })

export function useSupabaseQuery<T>(
  key: string | null,
  refreshInterval?: number
) {
  return useSWR<T>(key, fetcher, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    errorRetryCount: 3,
    refreshInterval: refreshInterval || 0,
    dedupingInterval: 5000,
  })
}
