export type TipoRegistro = 'ingresos' | 'egresos' | 'cartera'

export interface Registro {
  id: number
  monto: number
  categoriaId: number
  fecha: string
  notas: string
  categoriaMarkdown?: string | null
}

export interface RegistroPayload {
  monto: number
  categoriaId: number
  fecha: string
  notas: string
  categoriaMarkdown?: string | null
}

export interface Categoria {
  id: number
  nombre: string
  tipo: TipoRegistro
  markdown: string
}
