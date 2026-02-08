type OfflineRequest = {
  id: string
  url: string
  method: string
  headers: Record<string, string>
  body?: string | null
  createdAt: number
  attempts: number
}

const QUEUE_KEY = 'offline_queue_v1'
const CACHE_KEY = 'offline_cache_v1'
const NO_QUEUE_PATHS = ['/auth/login', '/auth/register']
const CACHE_TTL_MS = 1000 * 60 * 60 * 24

const readQueue = (): OfflineRequest[] => {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    if (!raw) return []
    const data = JSON.parse(raw)
    return Array.isArray(data) ? (data as OfflineRequest[]) : []
  } catch {
    return []
  }
}

const writeQueue = (queue: OfflineRequest[]) => {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
}

type CacheEntry = {
  url: string
  status: number
  headers: Record<string, string>
  body: string
  savedAt: number
}

const readCache = (): Record<string, CacheEntry> => {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return {}
    const data = JSON.parse(raw) as Record<string, CacheEntry>
    return data && typeof data === 'object' ? data : {}
  } catch {
    return {}
  }
}

const writeCache = (cache: Record<string, CacheEntry>) => {
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
}

const shouldQueue = (url: string, method: string) => {
  if (method === 'GET') return false
  return !NO_QUEUE_PATHS.some((path) => url.includes(path))
}

const toHeadersRecord = (headers: HeadersInit | undefined): Record<string, string> => {
  if (!headers) return {}
  if (headers instanceof Headers) {
    return Object.fromEntries(headers.entries())
  }
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers)
  }
  return { ...(headers as Record<string, string>) }
}

const buildBodyString = async (body: BodyInit | null | undefined): Promise<string | null> => {
  if (body == null) return null
  if (typeof body === 'string') return body
  if (body instanceof Blob) return await body.text()
  if (body instanceof URLSearchParams) return body.toString()
  return null
}

const parseJsonBody = (body: string | null, headers: Record<string, string>) => {
  if (!body) return null
  const contentType = (headers['Content-Type'] || headers['content-type'] || '').toLowerCase()
  if (!contentType.includes('application/json') && !body.trim().startsWith('{') && !body.trim().startsWith('[')) {
    return null
  }
  try {
    return JSON.parse(body) as Record<string, unknown>
  } catch {
    return null
  }
}

const updateCacheWithNewItem = (url: string, item: Record<string, unknown>) => {
  const cache = readCache()
  const baseUrl = url.split('?')[0].endsWith('/') ? url.split('?')[0] : `${url.split('?')[0]}/`
  Object.keys(cache).forEach((key) => {
    if (!key.startsWith(baseUrl)) return
    try {
      const body = cache[key].body
      const parsed = JSON.parse(body)
      if (Array.isArray(parsed)) {
        parsed.unshift(item)
        cache[key].body = JSON.stringify(parsed)
        cache[key].savedAt = Date.now()
      } else if (parsed && typeof parsed === 'object') {
        if (Array.isArray((parsed as { data?: unknown[] }).data)) {
          ;(parsed as { data?: unknown[] }).data?.unshift(item)
          cache[key].body = JSON.stringify(parsed)
          cache[key].savedAt = Date.now()
        } else if (Array.isArray((parsed as { results?: unknown[] }).results)) {
          ;(parsed as { results?: unknown[] }).results?.unshift(item)
          cache[key].body = JSON.stringify(parsed)
          cache[key].savedAt = Date.now()
        }
      }
    } catch {
      // ignore cache parse errors
    }
  })
  writeCache(cache)
}

const emitQueued = (url: string, method: string, body: Record<string, unknown> | null) => {
  window.dispatchEvent(
    new CustomEvent('app:offline-enqueued', {
      detail: { url, method, body }
    })
  )
}

const emitStatus = (syncing: boolean) => {
  const queueCount = readQueue().length
  window.dispatchEvent(
    new CustomEvent('app:offline-status', {
      detail: {
        online: navigator.onLine,
        syncing,
        queueCount
      }
    })
  )
}

export const processOfflineQueue = async () => {
  if (!navigator.onLine) return
  const queue = readQueue()
  if (queue.length === 0) return

  emitStatus(true)
  const remaining: OfflineRequest[] = []
  for (const item of queue) {
    try {
      const respuesta = await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: item.body ?? undefined
      })
      if (!respuesta.ok) {
        remaining.push({ ...item, attempts: item.attempts + 1 })
      }
    } catch {
      remaining.push({ ...item, attempts: item.attempts + 1 })
    }
  }
  writeQueue(remaining)
  emitStatus(false)
}

export const initOfflineQueue = () => {
  const nativeFetch = window.fetch.bind(window)

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init)
    const url = request.url
    const method = request.method.toUpperCase()

    if (!navigator.onLine) {
      if (method === 'GET') {
        const cache = readCache()
        const entry = cache[url]
        if (entry && Date.now() - entry.savedAt <= CACHE_TTL_MS) {
          return new Response(entry.body, {
            status: entry.status,
            headers: entry.headers
          })
        }
      }

      if (shouldQueue(url, method)) {
        const headers = toHeadersRecord(init?.headers ?? request.headers)
        const body = await buildBodyString(init?.body ?? request.body)
        const jsonBody = parseJsonBody(body, headers)
        const queue = readQueue()
        const entry: OfflineRequest = {
          id: crypto.randomUUID(),
          url,
          method,
          headers,
          body,
          createdAt: Date.now(),
          attempts: 0
        }
        queue.push(entry)
        writeQueue(queue)
        emitStatus(false)
        if (method === 'POST' && jsonBody && typeof jsonBody === 'object') {
          const optimistic = { ...jsonBody, offline: true, offline_id: entry.id }
          updateCacheWithNewItem(url, optimistic)
          emitQueued(url, method, optimistic)
        } else {
          emitQueued(url, method, jsonBody)
        }
        return new Response(JSON.stringify({ offline: true, queuedId: entry.id }), {
          status: 202,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      return new Response(JSON.stringify({ offline: true, error: 'Sin conexion' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const response = await nativeFetch(input, init)
    if (method === 'GET' && response.ok) {
      const cloned = response.clone()
      const body = await cloned.text()
      const headers = Object.fromEntries(cloned.headers.entries())
      const cache = readCache()
      cache[url] = {
        url,
        status: cloned.status,
        headers,
        body,
        savedAt: Date.now()
      }
      writeCache(cache)
    }
    return response
  }

  window.addEventListener('online', () => {
    void processOfflineQueue()
    emitStatus(false)
  })
  window.addEventListener('offline', () => emitStatus(false))
  emitStatus(false)
}
