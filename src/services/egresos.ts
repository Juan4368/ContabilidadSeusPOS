import { http } from './http'
import type { Registro, RegistroPayload } from './tipos'

const RECURSO = '/egresos'

export const listarEgresos = () => http<Registro[]>(RECURSO)

export const crearEgreso = (payload: RegistroPayload) =>
  http<Registro>(RECURSO, {
    method: 'POST',
    body: payload
  })
