import { http } from './http'
import type { Registro, RegistroPayload } from './tipos'

const RECURSO = '/ingresos'

export const listarIngresos = () => http<Registro[]>(RECURSO)

export const crearIngreso = (payload: RegistroPayload) =>
  http<Registro>(RECURSO, {
    method: 'POST',
    body: payload
  })
