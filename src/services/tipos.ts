export type TipoRegistro = 'ingresos' | 'egresos' | 'cartera'

export interface Registro {
  id: number
  monto: number
  categoriaId: number
  fecha: string
  notas: string
  categoriaMarkdown?: string | null
  cliente?: string
  tipo_ingreso?: string
  tipo_egreso?: string
}

export interface RegistroPayload {
  monto: number
  categoriaId?: number
  categoria_id?: number
  categoria_contabilidad_id?: number
  fecha: string
  notas: string
  categoriaMarkdown?: string | null
  cliente?: string
  tipo_egreso?: string
  tipo_ingreso?: string
}

export interface Categoria {
  id: number
  nombre: string
  tipo: TipoRegistro
  markdown: string
}
