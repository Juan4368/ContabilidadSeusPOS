import type { Registro, RegistroPayload } from './tipos'
import { ENDPOINTS } from '../config/endpoints'

const EGRESOS_ENDPOINT = ENDPOINTS.CONTABILIDAD_EGRESOS_LIST
const EGRESOS_CREATE_ENDPOINT = ENDPOINTS.CONTABILIDAD_EGRESOS_CREATE

const request = async <T>(options?: RequestInit, url: string = EGRESOS_ENDPOINT): Promise<T> => {
  const respuesta = await fetch(url, options)
  if (!respuesta.ok) {
    const detalle = await respuesta.text().catch(() => '')
    throw new Error(detalle || `Error ${respuesta.status}`)
  }
  if (respuesta.status === 204) {
    return undefined as T
  }
  return (await respuesta.json()) as T
}

export const listarEgresos = () => request<Registro[]>()

export const crearEgreso = (payload: RegistroPayload) =>
  request<Registro>({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }, EGRESOS_CREATE_ENDPOINT)

