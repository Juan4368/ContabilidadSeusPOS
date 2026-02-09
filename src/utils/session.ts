export const getSessionUserId = (): number | null => {
  try {
    const raw = localStorage.getItem('pos_sesion')
    if (!raw) return null
    const data = JSON.parse(raw) as { token?: string }
    const token = data?.token ? String(data.token) : ''
    if (!token) return null
    const payload = parseJwt(token)
    if (!payload) return null
    const idRaw = payload.user_id ?? payload.usuario_id ?? payload.id ?? payload.sub
    const id = Number(idRaw)
    return Number.isFinite(id) && id > 0 ? id : null
  } catch {
    return null
  }
}

export const getSessionUserName = (): string | null => {
  try {
    const raw = localStorage.getItem('pos_sesion')
    if (!raw) return null
    const data = JSON.parse(raw) as { usuario?: string; token?: string }
    if (data?.usuario) return String(data.usuario)
    const token = data?.token ? String(data.token) : ''
    if (!token) return null
    const payload = parseJwt(token)
    if (!payload) return null
    const nombre = payload.username ?? payload.usuario ?? payload.user ?? payload.name
    return nombre ? String(nombre) : null
  } catch {
    return null
  }
}

export const getSessionCajaNombre = (): string | null => {
  try {
    const raw = localStorage.getItem('pos_sesion')
    if (!raw) return null
    const data = JSON.parse(raw) as { cajaNombre?: string | null; cajaId?: number | null }
    if (data?.cajaNombre) return String(data.cajaNombre)
    if (data?.cajaId) return `Caja ${data.cajaId}`
    return null
  } catch {
    return null
  }
}

const parseJwt = (token: string): Record<string, unknown> | null => {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const decoded = atob(normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '='))
    return JSON.parse(decoded) as Record<string, unknown>
  } catch {
    return null
  }
}
