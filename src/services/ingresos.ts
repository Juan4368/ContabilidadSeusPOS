import type { Registro, RegistroPayload } from './tipos'
import { ENDPOINTS } from '../config/endpoints'

const INGRESOS_ENDPOINT = ENDPOINTS.CONTABILIDAD_INGRESOS

const request = async <T>(options?: RequestInit, url: string = INGRESOS_ENDPOINT): Promise<T> => {
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

export const listarIngresos = () => request<Registro[]>()

export const crearIngreso = (payload: RegistroPayload) =>
  request<Registro>({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })

export const actualizarIngresoParcial = (id: number, payload: RegistroPayload) =>
  request<Registro>({
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }, `${INGRESOS_ENDPOINT}${id}`)

export const actualizarIngreso = (id: number, payload: RegistroPayload) =>
  request<Registro>({
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }, `${INGRESOS_ENDPOINT}${id}`)

