import { http } from './http'
import type { Registro, RegistroPayload } from './tipos'

const RECURSO = '/cartera'

export const listarCartera = () => http<Registro[]>(RECURSO)

export const crearCartera = (payload: RegistroPayload) =>
  http<Registro>(RECURSO, {
    method: 'POST',
    body: payload
  })
