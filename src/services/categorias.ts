import { http } from './http'
import type { Categoria } from './tipos'

const RECURSO = '/categorias'

export const listarCategorias = () => http<Categoria[]>(RECURSO)
