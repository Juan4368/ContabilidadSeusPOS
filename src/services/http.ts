const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:3000/api'

type JsonBody = Record<string, unknown> | unknown[] | object

type HttpOptions = Omit<RequestInit, 'body'> & {
  body?: BodyInit | JsonBody | null
}

const normalizarUrl = (path: string) => {
  const base = API_BASE_URL.replace(/\/$/, '')
  const recurso = path.startsWith('/') ? path : `/${path}`
  return `${base}${recurso}`
}

const prepararBody = (body: HttpOptions['body'], headers: Headers) => {
  if (body == null) {
    return undefined
  }

  if (
    typeof body === 'string' ||
    body instanceof FormData ||
    body instanceof Blob ||
    body instanceof ArrayBuffer ||
    ArrayBuffer.isView(body as ArrayBufferView) ||
    body instanceof URLSearchParams ||
    (typeof ReadableStream !== 'undefined' && body instanceof ReadableStream)
  ) {
    return body as BodyInit
  }

  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  return JSON.stringify(body)
}

export async function http<T>(path: string, options: HttpOptions = {}): Promise<T> {
  const headers = new Headers(options.headers ?? {})
  const body = prepararBody(options.body, headers)

  const respuesta = await fetch(normalizarUrl(path), {
    ...options,
    headers,
    body
  })

  if (!respuesta.ok) {
    const detalle = await respuesta.text().catch(() => '')
    throw new Error(detalle || `Error ${respuesta.status} al llamar ${path}`)
  }

  if (respuesta.status === 204) {
    return undefined as T
  }

  const tipoContenido = respuesta.headers.get('Content-Type') ?? ''

  if (tipoContenido.includes('application/json')) {
    return (await respuesta.json()) as T
  }

  return (await respuesta.text()) as T
}
