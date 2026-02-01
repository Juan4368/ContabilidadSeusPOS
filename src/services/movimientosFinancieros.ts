import { ENDPOINTS } from '../config/endpoints'

export type MovimientoFinancieroPayload = {
  fecha: string
  tipo: 'INGRESO' | 'EGRESO'
  monto: number
  nota?: string
  categoria_contabilidad_id?: number
  proveedor_id: number
  caja_id: number
  usuario_id: number
  venta_id: number | null
}

const MOVIMIENTOS_FINANCIEROS_ENDPOINT = ENDPOINTS.CONTABILIDAD_MOVIMIENTOS

const request = async <T>(options?: RequestInit): Promise<T> => {
  const respuesta = await fetch(MOVIMIENTOS_FINANCIEROS_ENDPOINT, options)
  if (!respuesta.ok) {
    const detalle = await respuesta.text().catch(() => '')
    throw new Error(detalle || `Error ${respuesta.status}`)
  }
  if (respuesta.status === 204) {
    return undefined as T
  }
  return (await respuesta.json()) as T
}

export const crearMovimientoFinanciero = (payload: MovimientoFinancieroPayload) =>
  request({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })

