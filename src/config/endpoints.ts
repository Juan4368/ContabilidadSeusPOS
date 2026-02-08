const env = import.meta.env as Record<string, string | undefined>

const BASE = {
  AUTH: env.VITE_API_AUTH_BASE,
  POS: env.VITE_API_POS_BASE,
  LOCAL: env.VITE_API_LOCAL_BASE,
  AUTH_LOCAL: env.VITE_API_AUTH_LOCAL_BASE
} as const

const assertEnv = (value: string | undefined, name: string) => {
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}`)
  }
  return value
}

const BASE_REQUIRED = {
  AUTH: assertEnv(BASE.AUTH, 'VITE_API_AUTH_BASE'),
  POS: assertEnv(BASE.POS, 'VITE_API_POS_BASE'),
  LOCAL: assertEnv(BASE.LOCAL, 'VITE_API_LOCAL_BASE'),
  AUTH_LOCAL: assertEnv(BASE.AUTH_LOCAL, 'VITE_API_AUTH_LOCAL_BASE')
} as const

const join = (base: string, path: string) => `${base}${path.startsWith('/') ? '' : '/'}${path}`

export const ENDPOINTS = {
  LOGIN: join(BASE_REQUIRED.AUTH, '/auth/login'),
  USUARIOS: join(BASE_REQUIRED.LOCAL, '/usuarios/'),
  USUARIOS_REGISTRO: join(BASE_REQUIRED.AUTH_LOCAL, '/auth/register'),
  CLIENTES: join(BASE_REQUIRED.LOCAL, '/clientes/'),
  CATEGORIAS: join(BASE_REQUIRED.LOCAL, '/categorias/'),
  CATEGORIAS_POS: join(BASE_REQUIRED.POS, '/categorias/'),
  PRODUCTOS: join(BASE_REQUIRED.LOCAL, '/productos/'),
  VENTAS_POS: join(BASE_REQUIRED.POS, '/ventas/'),
  VENTAS_LOCAL: join(BASE_REQUIRED.LOCAL, '/ventas/'),
  CONTABILIDAD_CATEGORIAS: join(BASE_REQUIRED.POS, '/contabilidad/categorias/'),
  CONTABILIDAD_PROVEEDORES: join(BASE_REQUIRED.POS, '/proveedores/'),
  CONTABILIDAD_MOVIMIENTOS: join(BASE_REQUIRED.LOCAL, '/contabilidad/movimientos-financieros/'),
  CONTABILIDAD_INGRESOS: join(BASE_REQUIRED.POS, '/contabilidad/ingresos/'),
  CONTABILIDAD_EGRESOS_LIST: join(BASE_REQUIRED.POS, '/contabilidad/egresos/?desde=2026-01-20&hasta=2026-01-23'),
  CONTABILIDAD_EGRESOS_CREATE: join(BASE_REQUIRED.POS, '/contabilidad/egresos/'),
  CONTABILIDAD_CUENTAS: join(BASE_REQUIRED.POS, '/contabilidad/cuentas-por-cobrar/'),
  CONTABILIDAD_CAJAS: join(BASE_REQUIRED.LOCAL, '/contabilidad/cajas/'),
  CONTABILIDAD_CAJA_SESIONES: join(BASE_REQUIRED.LOCAL, '/contabilidad/caja-sesiones/'),
  CONTABILIDAD_CIERRE_CAJA_DENOMINACIONES: join(BASE_REQUIRED.LOCAL, '/contabilidad/cierre-caja-denominaciones/'),
  CONTABILIDAD_CIERRE_CAJA_DENOMINACIONES_BULK: join(BASE_REQUIRED.LOCAL, '/contabilidad/cierre-caja-denominaciones/bulk'),
  VENTAS_RESUMEN: join(BASE_REQUIRED.LOCAL, '/ventas/resumen'),
  PRESTAMO_CAJAS: join(BASE_REQUIRED.LOCAL, '/cajas-cerveza/')
} as const

export const BASE_URLS = BASE_REQUIRED
