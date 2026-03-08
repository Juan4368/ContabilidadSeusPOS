<script setup lang="ts">
import SessionRoleChip from '../components/SessionRoleChip.vue'
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { ENDPOINTS } from '../config/endpoints'
import { readProductosCache, writeProductosCache } from '../utils/productosCache'
import { nowUTCMinus5Iso } from '../utils/time'

type Producto = {
  id: number
  codigoBarras: string
  nombre: string
  categoriaId: number | null
  descripcion: string
  costo: number
  margen: number
  iva: number
  precioVenta: number
  creadoPorId: number | null
  actualizadoPorId: number | null
  fechaCreacion: string
  fechaActualizacion: string
  estado: 'activo' | 'inactivo'
}

type Categoria = {
  id: number
  nombre: string
  estado: 'activo' | 'inactivo'
}

const categorias = reactive<Categoria[]>([])

const productos = reactive<Producto[]>([
  {
    id: 1,
    codigoBarras: '7701234500019',
    nombre: 'Cafe americano',
    categoriaId: 1,
    descripcion: 'Bebida caliente',
    costo: 1200,
    margen: 45,
    iva: 0,
    precioVenta: 1740,
    creadoPorId: 1,
    actualizadoPorId: 1,
    fechaCreacion: '2026-01-13 09:00',
    fechaActualizacion: '2026-01-13 09:00',
    estado: 'activo'
  }
])

const API_PRODUCTOS = ENDPOINTS.PRODUCTOS
const API_CATEGORIAS = ENDPOINTS.CATEGORIAS_POS
const PRODUCTOS_CACHE_KEY = 'productos_catalogo_cache_v1'
const MONEDA_COP_PASO = 50

const form = reactive({
  codigoBarras: '',
  nombre: '',
  categoriaId: null as number | null,
  descripcion: '',
  costo: 0,
  margen: 0,
  iva: 0,
  creadoPorId: null as number | null,
  estado: 'activo' as 'activo' | 'inactivo'
})

const filtroTexto = ref('')
const filtroCategoria = ref('Todas')
const filtroEstado = ref<'todos' | 'activo' | 'inactivo'>('todos')
const paginaActual = ref(1)
const tamanioPagina = ref(25)
const errorForm = ref('')
const mostrarFormulario = ref(false)
const mostrarFormularioEdicion = ref(false)
const isOnline = ref(typeof navigator !== 'undefined' ? navigator.onLine : true)
const productoEdicionId = ref<number | null>(null)
const filaEdicionId = ref<number | null>(null)
const filaEdicion = reactive({
  codigoBarras: '',
  nombre: '',
  categoriaId: null as number | null,
  descripcion: '',
  costo: 0,
  margen: 0,
  iva: 0,
  estado: 'activo' as 'activo' | 'inactivo'
})

const redondearPrecioMonedaCop = (valor: number) => {
  const numero = Number(valor)
  if (!Number.isFinite(numero) || numero <= 0) return 0
  return Math.ceil(numero / MONEDA_COP_PASO) * MONEDA_COP_PASO
}

const parseNumeroFlexible = (valor: unknown): number => {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : NaN
  if (typeof valor !== 'string') return NaN
  const limpio = valor.trim().replace(/[^\d,.\-]/g, '')
  if (!limpio) return NaN

  const tieneComa = limpio.includes(',')
  const tienePunto = limpio.includes('.')

  if (tieneComa && tienePunto) {
    const ultimaComa = limpio.lastIndexOf(',')
    const ultimoPunto = limpio.lastIndexOf('.')
    if (ultimaComa > ultimoPunto) {
      return Number(limpio.replace(/\./g, '').replace(',', '.'))
    }
    return Number(limpio.replace(/,/g, ''))
  }

  if (tieneComa) return Number(limpio.replace(',', '.'))
  return Number(limpio)
}

const precioVentaCalculado = computed({
  get: () => {
    const costo = Number(form.costo || 0)
    const margenPct = Number(form.margen || 0)
    const ivaPct = Number(form.iva || 0)
    const precio = costo * (1 + margenPct / 100)
    const precioFinal = precio * (1 + ivaPct / 100)
    return redondearPrecioMonedaCop(precioFinal)
  },
  set: (valor: number) => {
    actualizarMargenDesdePrecio(redondearPrecioMonedaCop(valor))
  }
})

const precioVentaEdicion = computed({
  get: () => {
    const costo = Number(filaEdicion.costo || 0)
    const margenPct = Number(filaEdicion.margen || 0)
    const ivaPct = Number(filaEdicion.iva || 0)
    const precio = costo * (1 + margenPct / 100)
    const precioFinal = precio * (1 + ivaPct / 100)
    const calculado = redondearPrecioMonedaCop(precioFinal)
    if (calculado > 0) return calculado
    if (productoEdicionId.value !== null) {
      const actual = productos.find((item) => item.id === productoEdicionId.value)
      if (actual?.precioVenta) return redondearPrecioMonedaCop(Number(actual.precioVenta))
    }
    return 0
  },
  set: (valor: number) => {
    actualizarMargenEdicionDesdePrecio(redondearPrecioMonedaCop(valor))
  }
})

const actualizarMargenDesdePrecio = (precioVenta: number) => {
  const costo = Number(form.costo || 0)
  const ivaDecimal = Number(form.iva || 0) / 100
  const base = costo * (1 + ivaDecimal)
  if (base <= 0) {
    form.margen = 0
    return
  }
  const margen = (precioVenta / base - 1) * 100
  form.margen = Number(Math.max(margen, 0).toFixed(2))
}

const actualizarMargenEdicionDesdePrecio = (precioVenta: number) => {
  const costo = Number(filaEdicion.costo || 0)
  const ivaDecimal = Number(filaEdicion.iva || 0) / 100
  const base = costo * (1 + ivaDecimal)
  if (base <= 0) {
    filaEdicion.margen = 0
    return
  }
  const margen = (precioVenta / base - 1) * 100
  filaEdicion.margen = Number(Math.max(margen, 0).toFixed(2))
}

const prepararBorrado = () => {}

const borrarAlEscribir = () => {}

const manejarTeclaGlobal = (event: KeyboardEvent) => {
  if (event.key !== 'Escape') return
  if (mostrarFormularioEdicion.value) {
    cancelarEdicionFila()
    return
  }
  if (mostrarFormulario.value) {
    mostrarFormulario.value = false
  }
}

const numeroSeguro = (valor: unknown, fallback: number) => {
  const numero = parseNumeroFlexible(valor)
  if (Number.isFinite(numero)) return numero
  const numeroFallback = parseNumeroFlexible(fallback)
  return Number.isFinite(numeroFallback) ? numeroFallback : 0
}

const porcentajeEditableSeguro = (valor: unknown, fallback = 0) => {
  const base = numeroSeguro(valor, fallback)
  if (base <= 1 && base >= 0) return Number((base * 100).toFixed(2))
  return Number(base.toFixed(2))
}

const actualizarEstadoConexion = () => {
  if (typeof navigator === 'undefined') return
  isOnline.value = navigator.onLine
}

const leerProductosCache = async (): Promise<Producto[]> => {
  const data = await readProductosCache<Producto[]>(PRODUCTOS_CACHE_KEY)
  return Array.isArray(data) ? data : []
}

const guardarProductosCache = async (lista: Producto[] = productos) => {
  const plano = lista.map((item) => ({ ...item }))
  await writeProductosCache(PRODUCTOS_CACHE_KEY, plano)
}

const exportarProductos = () => {
  const encabezados = [
    'id',
    'codigo_barras',
    'nombre',
    'categoria',
    'costo',
    'margen_pct',
    'iva_pct',
    'precio_venta',
    'estado',
    'fecha_actualizacion'
  ]

  const filas = productosFiltrados.value
  const contenido = [
    encabezados.join(','),
    ...filas.map((producto) => {
      const valores = [
        producto.id,
        producto.codigoBarras,
        producto.nombre,
        categoriaNombre(producto.categoriaId),
        producto.costo,
        (producto.margen * 100).toFixed(2),
        (producto.iva * 100).toFixed(2),
        producto.precioVenta,
        producto.estado,
        producto.fechaActualizacion
      ]
      return valores.map((valor) => `"${String(valor).replace(/"/g, '""')}"`).join(',')
    })
  ].join('\n')

  const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  const sello = new Date().toISOString().slice(0, 10)
  enlace.href = url
  enlace.download = `productos-${sello}.csv`
  enlace.click()
  URL.revokeObjectURL(url)
}

const eliminarProducto = async (producto: Producto) => {
  try {
    const respuesta = await fetch(`${API_PRODUCTOS}${producto.id}/`, { method: 'DELETE' })
    if (!respuesta.ok && respuesta.status !== 204) {
      const detalle = await respuesta.text().catch(() => '')
      throw new Error(detalle || `Error ${respuesta.status}`)
    }
    const index = productos.findIndex((item) => item.id === producto.id)
    if (index >= 0) {
      productos.splice(index, 1)
      await guardarProductosCache()
    }
  } catch (error) {
    console.error('Error al eliminar producto', error)
    errorForm.value = 'No fue posible eliminar el producto.'
  }
}
const normalizarProducto = (item: unknown, index: number, base?: Producto): Producto | null => {
  if (!item || typeof item !== 'object') return null
  const producto = item as Record<string, unknown>
  const id = Number(producto.producto_id ?? producto.id ?? producto.pk ?? base?.id ?? index + 1)
  const codigoBarrasRaw = producto.codigo_barras ?? producto.codigoBarras ?? base?.codigoBarras ?? ''
  const codigoBarras = codigoBarrasRaw == null ? '' : String(codigoBarrasRaw).trim()
  const nombre = String(producto.nombre ?? producto.name ?? base?.nombre ?? 'Producto')
  const categoriaId = producto.categoria_id ?? producto.categoriaId ?? base?.categoriaId ?? null
  const categoriaIdNumero = categoriaId === null ? null : Number(categoriaId)
  const descripcion = String(producto.descripcion ?? base?.descripcion ?? '')
  const costo = Number(producto.costo ?? base?.costo ?? 0)
  const margen = Number(producto.margen ?? base?.margen ?? 0)
  const iva = Number(producto.iva ?? base?.iva ?? 0)
  const precioVenta = Number(producto.precio_venta ?? producto.precioVenta ?? producto.precio ?? base?.precioVenta ?? 0)
  const creadoPorId = producto.creado_por_id ?? producto.creadoPorId ?? base?.creadoPorId ?? null
  const actualizadoPorId = producto.actualizado_por_id ?? producto.actualizadoPorId ?? base?.actualizadoPorId ?? null
  const fechaCreacion = String(producto.fecha_creacion ?? producto.fechaCreacion ?? base?.fechaCreacion ?? '')
  const fechaActualizacion = String(producto.fecha_actualizacion ?? producto.fechaActualizacion ?? base?.fechaActualizacion ?? '')
  const estadoRaw = producto.estado ?? base?.estado
  const estado =
    estadoRaw === false || estadoRaw === 'inactivo' ? 'inactivo' : estadoRaw === 'activo' ? 'activo' : 'activo'

  return {
    id,
    codigoBarras,
    nombre,
    categoriaId: categoriaIdNumero,
    descripcion,
    costo,
          margen,
    iva,
    precioVenta,
    creadoPorId: creadoPorId === null ? null : Number(creadoPorId),
    actualizadoPorId: actualizadoPorId === null ? null : Number(actualizadoPorId),
    fechaCreacion,
    fechaActualizacion,
    estado
  }
}

const productoUrl = (id: number) => `${API_PRODUCTOS.replace(/\/$/, '')}/${id}`

const requestProducto = async (method: string, id: number, payload: Record<string, unknown>) => {
  const respuesta = await fetch(productoUrl(id), {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })

  if (!respuesta.ok) {
    const detalle = await respuesta.text().catch(() => '')
    const error = new Error(detalle || `Error ${respuesta.status}`)
    ;(error as Error & { status?: number }).status = respuesta.status
    throw error
  }

  return (await respuesta.json()) as unknown
}

const actualizarProductoApi = async (
  id: number,
  payload: Record<string, unknown>,
  fallbackPayload?: Record<string, unknown>
) => {
  try {
    return await requestProducto('PATCH', id, payload)
  } catch (error) {
    const status = (error as Error & { status?: number }).status
    if (fallbackPayload && (status === 404 || status === 405)) {
      // Algunos balanceadores devuelven 405 cuando falta la barra final: reintenta con PUT y payload completo
      return await requestProducto('PUT', id, fallbackPayload)
    }
    throw error
  }
}

const extraerLista = (data: unknown): unknown[] => {
  if (Array.isArray(data)) return data
  if (data && typeof data === 'object') {
    const dataObj = data as Record<string, unknown>
    if (Array.isArray(dataObj.results)) return dataObj.results as unknown[]
    if (Array.isArray(dataObj.data)) return dataObj.data as unknown[]
  }
  return []
}

const cargarProductos = async () => {
  const cache = await leerProductosCache()
  if (cache.length) {
    productos.splice(0, productos.length, ...cache)
  }

  try {
    actualizarEstadoConexion()
    const respuesta = await fetch(API_PRODUCTOS)
    if (!respuesta.ok) {
      throw new Error(`Error ${respuesta.status}`)
    }
    const data = await respuesta.json()
    const lista = extraerLista(data)

    const normalizados = lista
      .map((item: unknown, index: number) => {
        const normalizado = normalizarProducto(item, index)
        if (!normalizado) return null
        return normalizado
      })
      .filter(Boolean) as Producto[]

    if (normalizados.length) {
      productos.splice(0, productos.length, ...normalizados)
      await guardarProductosCache(normalizados)
    }
  } catch (error) {
    actualizarEstadoConexion()
    console.error('No se pudieron cargar productos', error)
    if (!cache.length) {
      errorForm.value = 'Sin conexion. No hay cache de productos disponible.'
    }
  }
}

const cargarCategorias = async () => {
  try {
    const respuesta = await fetch(API_CATEGORIAS)
    if (!respuesta.ok) {
      throw new Error(`Error ${respuesta.status}`)
    }
    const data = await respuesta.json()
    const lista = Array.isArray(data) ? data : Array.isArray(data.results) ? data.results : Array.isArray(data.data) ? data.data : []
    const normalizadas = lista
      .map((item: unknown, index: number) => {
        if (!item || typeof item !== 'object') return null
        const categoria = item as Record<string, unknown>
        const id = Number(categoria.categoria_id ?? categoria.id ?? index + 1)
        const nombre = String(categoria.nombre ?? `Categoria ${id}`)
        const estadoRaw = categoria.estado
        const estado =
          estadoRaw === false || estadoRaw === 'inactivo' ? 'inactivo' : estadoRaw === 'activo' ? 'activo' : 'activo'
        return { id, nombre, estado }
      })
      .filter(Boolean) as Categoria[]
    categorias.splice(0, categorias.length, ...normalizadas)
  } catch (error) {
    console.error('No se pudieron cargar categorias', error)
  }
}

onMounted(() => {
  window.addEventListener('online', actualizarEstadoConexion)
  window.addEventListener('offline', actualizarEstadoConexion)
  window.addEventListener('keydown', manejarTeclaGlobal)
  actualizarEstadoConexion()
  void cargarCategorias()
  void cargarProductos()
})

onUnmounted(() => {
  window.removeEventListener('online', actualizarEstadoConexion)
  window.removeEventListener('offline', actualizarEstadoConexion)
  window.removeEventListener('keydown', manejarTeclaGlobal)
})

const categoriasActivas = computed(() => categorias.filter((categoria) => categoria.estado === 'activo'))

const categoriasFiltro = computed(() => ['Todas', ...new Set(categoriasActivas.value.map((categoria) => categoria.nombre))])

const resumen = computed(() => {
  const total = productos.length
  const activos = productos.filter((producto) => producto.estado === 'activo').length
  const inactivos = total - activos
  const conIva = productos.filter((producto) => producto.iva > 0).length
  return { total, activos, inactivos, conIva }
})

const productosFiltrados = computed(() => {
  const termino = filtroTexto.value.toLowerCase().trim()
  return productos.filter((producto) => {
    const categoria = categoriaNombre(producto.categoriaId)
    const nombre = String(producto.nombre ?? '').toLowerCase()
    const codigoBarras = String(producto.codigoBarras ?? '').toLowerCase()
    const descripcion = String(producto.descripcion ?? '').toLowerCase()
    const categoriaTexto = String(categoria ?? '').toLowerCase()
    const matchTexto = !termino
      ? true
      : nombre.includes(termino) ||
        codigoBarras.includes(termino) ||
        descripcion.includes(termino) ||
        categoriaTexto.includes(termino)
    const matchCategoria = filtroCategoria.value === 'Todas' || categoria === filtroCategoria.value
    const matchEstado = filtroEstado.value === 'todos' || producto.estado === filtroEstado.value
    return matchTexto && matchCategoria && matchEstado
  })
})

const totalPaginas = computed(() => {
  const tam = Math.max(1, Number(tamanioPagina.value || 1))
  return Math.max(1, Math.ceil(productosFiltrados.value.length / tam))
})

const productosPaginados = computed(() => {
  const tam = Math.max(1, Number(tamanioPagina.value || 1))
  const inicio = (Math.max(1, paginaActual.value) - 1) * tam
  return productosFiltrados.value.slice(inicio, inicio + tam)
})

const indiceInicio = computed(() => {
  if (!productosFiltrados.value.length) return 0
  return (paginaActual.value - 1) * tamanioPagina.value + 1
})

const indiceFin = computed(() => {
  if (!productosFiltrados.value.length) return 0
  return Math.min(paginaActual.value * tamanioPagina.value, productosFiltrados.value.length)
})

const irPagina = (pagina: number) => {
  const destino = Math.max(1, Math.min(totalPaginas.value, Math.floor(Number(pagina) || 1)))
  paginaActual.value = destino
}

watch([filtroTexto, filtroCategoria, filtroEstado, tamanioPagina], () => {
  paginaActual.value = 1
})

watch(productosFiltrados, () => {
  if (paginaActual.value > totalPaginas.value) {
    paginaActual.value = totalPaginas.value
  }
})

const formatCurrency = (monto: number) =>
  monto.toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0
  })

const resetForm = () => {
  form.codigoBarras = ''
  form.nombre = ''
  form.categoriaId = null
  form.descripcion = ''
  form.costo = 0
  form.margen = 0
  form.iva = 0
  form.creadoPorId = null
  form.estado = 'activo'
}

const crearProducto = async () => {
  errorForm.value = ''
  const nombre = form.nombre.trim()
  const codigoBarras = form.codigoBarras.trim()

  if (!nombre) {
    errorForm.value = 'El nombre es obligatorio.'
    return
  }

  const payload = {
    codigo_barras: codigoBarras || null,
    nombre,
    name: nombre,
    categoria_id: form.categoriaId,
    descripcion: form.descripcion.trim(),
    costo: Number(form.costo || 0),
    margen: Number(form.margen || 0) / 100,
    iva: Number(form.iva || 0) / 100,
    precio_venta: redondearPrecioMonedaCop(precioVentaCalculado.value),
    creado_por_id: form.creadoPorId ?? null,
    actualizado_por_id: form.creadoPorId ?? null,
    estado: form.estado === 'activo'
  }

  try {
    const respuesta = await fetch(API_PRODUCTOS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    if (!respuesta.ok) {
      const detalle = await respuesta.text().catch(() => '')
      throw new Error(detalle || `Error ${respuesta.status}`)
    }
    const data = await respuesta.json().catch(() => ({}))
    const dataObj = (data as Record<string, unknown>) ?? {}
    const fuente = dataObj.offline ? { id: Date.now(), ...payload } : dataObj
    const normalizado = normalizarProducto(fuente, productos.length)
    if (normalizado) {
      productos.unshift(normalizado)
      await guardarProductosCache()
    }
    resetForm()
    mostrarFormulario.value = false
  } catch (error) {
    console.error('Error al crear producto', error)
    errorForm.value = 'No fue posible crear el producto.'
  }
}

const iniciarEdicionFila = (producto: Producto) => {
  productoEdicionId.value = producto.id
  filaEdicionId.value = null
  filaEdicion.codigoBarras = producto.codigoBarras
  filaEdicion.nombre = producto.nombre
  filaEdicion.categoriaId = producto.categoriaId
  filaEdicion.descripcion = producto.descripcion
  filaEdicion.costo = numeroSeguro(producto.costo, 0)
  filaEdicion.margen = porcentajeEditableSeguro(producto.margen, 0)
  filaEdicion.iva = porcentajeEditableSeguro(producto.iva, 0)
  filaEdicion.estado = producto.estado
  mostrarFormularioEdicion.value = true
}

const cancelarEdicionFila = () => {
  mostrarFormularioEdicion.value = false
  productoEdicionId.value = null
  filaEdicionId.value = null
}

const guardarEdicionFila = async () => {
  if (productoEdicionId.value === null) return
  const producto = productos.find((item) => item.id === productoEdicionId.value)
  if (!producto) {
    errorForm.value = 'No se encontro el producto a editar.'
    return
  }
  const nombre = filaEdicion.nombre.trim()
  const codigoBarras = filaEdicion.codigoBarras.trim()

  if (!nombre) {
    errorForm.value = 'El nombre es obligatorio.'
    return
  }

  const actualizado = nowUTCMinus5Iso()
  const categoriaId = filaEdicion.categoriaId ?? producto.categoriaId
  const costoSeguro = numeroSeguro(filaEdicion.costo, numeroSeguro(producto.costo, 0))
  const margenSeguro = numeroSeguro(filaEdicion.margen, porcentajeEditableSeguro(producto.margen, 0))
  const ivaSeguro = numeroSeguro(filaEdicion.iva, porcentajeEditableSeguro(producto.iva, 0))
  const estadoSeguro = filaEdicion.estado ?? producto.estado
  const descripcionSegura = filaEdicion.descripcion.trim() || producto.descripcion
  const precioVentaSeguro = redondearPrecioMonedaCop(costoSeguro * (1 + margenSeguro / 100) * (1 + ivaSeguro / 100))

  const payload = {
    codigo_barras: codigoBarras || null,
    nombre,
    name: nombre,
    categoria_id: categoriaId,
    descripcion: descripcionSegura,
    costo: costoSeguro,
    margen: margenSeguro / 100,
    iva: ivaSeguro / 100,
    precio_venta: precioVentaSeguro,
    estado: estadoSeguro === 'activo'
  }
  const payloadCompleto = {
    ...payload,
    creado_por_id: producto.creadoPorId ?? null,
    actualizado_por_id: producto.actualizadoPorId ?? producto.creadoPorId ?? null
  }

  try {
    const respuesta = await actualizarProductoApi(producto.id, payload, payloadCompleto)
    const respuestaObj = (respuesta as Record<string, unknown>) ?? {}
    if (respuestaObj.offline) {
      producto.codigoBarras = codigoBarras
      producto.nombre = nombre
      producto.categoriaId = categoriaId
      producto.descripcion = descripcionSegura
      producto.costo = costoSeguro
      producto.margen = margenSeguro / 100
      producto.iva = ivaSeguro / 100
      producto.precioVenta = precioVentaSeguro
      producto.actualizadoPorId = producto.creadoPorId
      producto.fechaActualizacion = actualizado
      producto.estado = estadoSeguro
    } else {
      const normalizado = normalizarProducto(respuesta, 0, producto)
      if (normalizado) {
        Object.assign(producto, normalizado)
      } else {
        producto.codigoBarras = codigoBarras
        producto.nombre = nombre
        producto.categoriaId = categoriaId
        producto.descripcion = descripcionSegura
        producto.costo = costoSeguro
        producto.margen = margenSeguro / 100
        producto.iva = ivaSeguro / 100
        producto.precioVenta = precioVentaSeguro
        producto.actualizadoPorId = producto.creadoPorId
        producto.fechaActualizacion = actualizado
        producto.estado = estadoSeguro
      }
    }
    await guardarProductosCache()
    mostrarFormularioEdicion.value = false
    productoEdicionId.value = null
    filaEdicionId.value = null
  } catch (error) {
    console.error('Error al actualizar producto', error)
    const detalle = (error as Error)?.message ?? ''
    errorForm.value = detalle
      ? `No fue posible actualizar el producto: ${detalle}`
      : 'No fue posible actualizar el producto.'
  }
}

const toggleEstado = async (id: number) => {
  const item = productos.find((producto) => producto.id === id)
  if (!item) return
  const estadoAnterior = item.estado
  const nuevoEstado = item.estado === 'activo' ? 'inactivo' : 'activo'
  item.estado = nuevoEstado
  item.fechaActualizacion = nowUTCMinus5Iso().slice(0, 16).replace('T', ' ')

  const payload = { estado: nuevoEstado === 'activo' }
  const payloadCompleto = {
    codigo_barras: item.codigoBarras?.trim() ? item.codigoBarras.trim() : null,
    nombre: item.nombre,
    name: item.nombre,
    categoria_id: item.categoriaId,
    descripcion: item.descripcion,
    costo: item.costo,
    margen: item.margen,
    iva: item.iva,
    precio_venta: item.precioVenta,
    estado: nuevoEstado === 'activo',
    creado_por_id: item.creadoPorId ?? null,
    actualizado_por_id: item.actualizadoPorId ?? item.creadoPorId ?? null
  }

  try {
    const respuesta = await actualizarProductoApi(item.id, payload, payloadCompleto)
    const respuestaObj = (respuesta as Record<string, unknown>) ?? {}
    if (!respuestaObj.offline) {
      const normalizado = normalizarProducto(respuesta, 0, item)
      if (normalizado) {
        Object.assign(item, normalizado)
      }
    }
    await guardarProductosCache()
  } catch (error) {
    console.error('Error al cambiar estado', error)
    item.estado = estadoAnterior
    errorForm.value = 'No fue posible actualizar el estado.'
  }
}

function categoriaNombre(id: number | null) {
  return categorias.find((categoria) => categoria.id === id)?.nombre ?? 'Sin categoria'
}
</script>

<template>
  <main class="productos">
    <header class="productos__cabecera">
      <div>
        <p class="productos__prefijo">Catalogo</p>
        <h1>Productos</h1>
        <p class="productos__nota">Gestiona el catalogo y los precios de venta.</p>
      </div>
      <div class="productos__acciones">
        <SessionRoleChip />
        <span :class="['estado-conexion', isOnline ? 'estado-conexion--online' : 'estado-conexion--offline']">
          {{ isOnline ? 'En linea' : 'Offline' }}
        </span>
        <button type="button" class="boton secundaria" @click="exportarProductos">Exportar</button>
        <button type="button" class="boton" @click="mostrarFormulario = true">Nuevo producto</button>
      </div>
    </header>

    <section class="resumen">
      <article class="tarjeta">
        <p class="tarjeta__titulo">Productos activos</p>
        <strong>{{ resumen.activos }}</strong>
        <span>Total activos</span>
      </article>
      <article class="tarjeta tarjeta--alerta">
        <p class="tarjeta__titulo">Inactivos</p>
        <strong>{{ resumen.inactivos }}</strong>
        <span>Revisar estados</span>
      </article>
      <article class="tarjeta tarjeta--critico">
        <p class="tarjeta__titulo">Con IVA</p>
        <strong>{{ resumen.conIva }}</strong>
        <span>Productos gravados</span>
      </article>
      <article class="tarjeta">
        <p class="tarjeta__titulo">Total catalogo</p>
        <strong>{{ resumen.total }}</strong>
        <span>En inventario</span>
      </article>
    </section>

    <section class="panel filtros">
      <label class="campo">
        <span>Buscar</span>
        <input v-model="filtroTexto" type="search" placeholder="Busque por nombre o codigo de barras" />
      </label>
      <label class="campo">
        <span>Categoria</span>
        <select v-model="filtroCategoria">
          <option v-for="categoria in categoriasFiltro" :key="categoria" :value="categoria">
            {{ categoria }}
          </option>
        </select>
      </label>
      <label class="campo">
        <span>Estado</span>
        <select v-model="filtroEstado">
          <option value="todos">Todos</option>
          <option value="activo">Activos</option>
          <option value="inactivo">Inactivos</option>
        </select>
      </label>
    </section>

    <section v-if="mostrarFormulario" class="formulario-modal">
      <div class="panel form-panel">
        <header class="panel__cabecera">
          <h2>Crear producto</h2>
          <button type="button" class="cerrar" @click="mostrarFormulario = false">Cerrar</button>
        </header>

        <form class="form" @submit.prevent="crearProducto">
          <label>
            <span>Codigo de barras (opcional)</span>
            <input
              v-model="form.codigoBarras"
              type="text"
              placeholder="7701234500019"
              @focus="prepararBorrado"
              @keydown="borrarAlEscribir"
            />
          </label>
          <label>
            <span>Nombre</span>
            <input
              v-model="form.nombre"
              type="text"
              placeholder="Producto"
              @focus="prepararBorrado"
              @keydown="borrarAlEscribir"
            />
          </label>
          <label>
            <span>Categoria</span>
            <select v-model="form.categoriaId">
              <option :value="null">Sin categoria</option>
              <option v-for="categoria in categoriasActivas" :key="categoria.id" :value="categoria.id">
                {{ categoria.nombre }}
              </option>
            </select>
          </label>
          <label>
            <span>Descripcion</span>
            <input
              v-model="form.descripcion"
              type="text"
              placeholder="Opcional"
              @focus="prepararBorrado"
              @keydown="borrarAlEscribir"
            />
          </label>
          <label>
            <span>Costo</span>
            <input
              v-model.number="form.costo"
              type="number"
              min="0"
              step="1"
              @focus="prepararBorrado"
              @keydown="borrarAlEscribir"
            />
          </label>
          <label>
            <span>Margen %</span>
            <input
              v-model.number="form.margen"
              type="number"
              min="0"
              step="1"
              @focus="prepararBorrado"
              @keydown="borrarAlEscribir"
            />
          </label>
          <label>
            <span>IVA %</span>
            <input
              v-model.number="form.iva"
              type="number"
              min="0"
              step="0.01"
              @focus="prepararBorrado"
              @keydown="borrarAlEscribir"
            />
          </label>
          <label>
            <span>Precio venta</span>
            <input
              v-model.number="precioVentaCalculado"
              type="number"
              min="0"
              step="1"
              @focus="prepararBorrado"
              @keydown="borrarAlEscribir"
            />
          </label>
          <label>
            <span>Creado por (id)</span>
            <input
              v-model.number="form.creadoPorId"
              type="number"
              min="0"
              step="1"
              @focus="prepararBorrado"
              @keydown="borrarAlEscribir"
            />
          </label>
          <label>
            <span>Estado</span>
            <select v-model="form.estado">
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
            </select>
          </label>
          <button type="submit">Guardar producto</button>
          <p v-if="errorForm" class="error">{{ errorForm }}</p>
        </form>
      </div>
    </section>

    <section v-if="mostrarFormularioEdicion" class="formulario-modal">
      <div class="panel form-panel">
        <header class="panel__cabecera">
          <h2>Editar producto</h2>
          <button type="button" class="cerrar" @click="cancelarEdicionFila">Cerrar</button>
        </header>

        <form class="form" @submit.prevent="guardarEdicionFila">
          <label>
            <span>Codigo de barras (opcional)</span>
            <input v-model="filaEdicion.codigoBarras" type="text" placeholder="7701234500019" />
          </label>
          <label>
            <span>Nombre</span>
            <input v-model="filaEdicion.nombre" type="text" placeholder="Producto" />
          </label>
          <label>
            <span>Categoria</span>
            <select v-model="filaEdicion.categoriaId">
              <option :value="null">Sin categoria</option>
              <option v-for="categoria in categoriasActivas" :key="categoria.id" :value="categoria.id">
                {{ categoria.nombre }}
              </option>
            </select>
          </label>
          <label>
            <span>Descripcion</span>
            <input v-model="filaEdicion.descripcion" type="text" placeholder="Opcional" />
          </label>
          <label>
            <span>Costo</span>
            <input v-model.number="filaEdicion.costo" type="number" min="0" step="1" />
          </label>
          <label>
            <span>Margen %</span>
            <input v-model.number="filaEdicion.margen" type="number" min="0" step="1" />
          </label>
          <label>
            <span>IVA %</span>
            <input v-model.number="filaEdicion.iva" type="number" min="0" step="0.01" />
          </label>
          <label>
            <span>Precio venta</span>
            <input v-model.number="precioVentaEdicion" type="number" min="0" step="1" />
          </label>
          <label>
            <span>Estado</span>
            <select v-model="filaEdicion.estado">
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
            </select>
          </label>
          <button type="submit">Guardar cambios</button>
          <p v-if="errorForm" class="error">{{ errorForm }}</p>
        </form>
      </div>
    </section>

    <section class="panel tabla">
      <header class="tabla__cabecera">
        <h2>Listado de productos</h2>
        <span>{{ productosFiltrados.length }} resultados</span>
      </header>
      <p v-if="errorForm" class="error">{{ errorForm }}</p>

      <div class="tabla__grid">
        <div class="tabla__fila tabla__encabezado">
          <span>Producto</span>
          <span>Categoria</span>
          <span>Costo</span>
          <span>Margen</span>
          <span>IVA</span>
          <span>Precio venta</span>
          <span>Estado</span>
          <span>Acciones</span>
        </div>

        <div
          v-for="producto in productosPaginados"
          :key="producto.id"
          :class="['tabla__fila', { 'tabla__fila--edicion': filaEdicionId === producto.id }]"
        >
          <div class="producto">
            <div v-if="filaEdicionId === producto.id" class="producto__edicion">
              <input
                v-model="filaEdicion.nombre"
                type="text"
                placeholder="Nombre"
                @focus="prepararBorrado"
                @keydown="borrarAlEscribir"
              />
              <input
                v-model="filaEdicion.codigoBarras"
                type="text"
                placeholder="Codigo barras"
                @focus="prepararBorrado"
                @keydown="borrarAlEscribir"
              />
              <input
                v-model="filaEdicion.descripcion"
                type="text"
                placeholder="Descripcion"
                @focus="prepararBorrado"
                @keydown="borrarAlEscribir"
              />
            </div>
            <div v-else>
              <p class="producto__nombre">{{ producto.nombre }}</p>
              <small>{{ producto.codigoBarras ? `${producto.codigoBarras} � ` : '' }}{{ producto.descripcion || 'Sin descripcion' }}</small>
            </div>
          </div>
          <span v-if="filaEdicionId === producto.id">
            <select v-model="filaEdicion.categoriaId">
              <option :value="null">Sin categoria</option>
              <option v-for="categoria in categoriasActivas" :key="categoria.id" :value="categoria.id">
                {{ categoria.nombre }}
              </option>
            </select>
          </span>
          <span v-else>{{ categoriaNombre(producto.categoriaId) }}</span>
          <span v-if="filaEdicionId === producto.id">
            <input
              v-model.number="filaEdicion.costo"
              type="number"
              min="0"
              step="1"
              @focus="prepararBorrado"
              @keydown="borrarAlEscribir"
            />
          </span>
          <span v-else>{{ formatCurrency(producto.costo) }}</span>
          <span v-if="filaEdicionId === producto.id">
            <input
              v-model.number="filaEdicion.margen"
              type="number"
              min="0"
              step="1"
              @focus="prepararBorrado"
              @keydown="borrarAlEscribir"
            />
          </span>
        <span v-else>{{ (producto.margen * 100).toFixed(2).replace(/\.00$/, '') }}%</span>
          <span v-if="filaEdicionId === producto.id">
            <input
              v-model.number="filaEdicion.iva"
              type="number"
              min="0"
              step="0.01"
              @focus="prepararBorrado"
              @keydown="borrarAlEscribir"
            />
          </span>
        <span v-else>{{ (producto.iva * 100).toFixed(2).replace(/\.00$/, '') }}%</span>
          <span v-if="filaEdicionId === producto.id">
            <input
              v-model.number="precioVentaEdicion"
              type="number"
              min="0"
              step="1"
              @focus="prepararBorrado"
              @keydown="borrarAlEscribir"
            />
          </span>
          <span v-else class="precio">{{ formatCurrency(producto.precioVenta) }}</span>
          <span v-if="filaEdicionId === producto.id">
            <select v-model="filaEdicion.estado">
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
            </select>
          </span>
          <span v-else :class="['estado', producto.estado]">{{ producto.estado }}</span>
          <div class="acciones">
            <template v-if="filaEdicionId === producto.id">
              <button
                type="button"
                class="icono"
                data-label="Guardar"
                aria-label="Guardar"
                @click="guardarEdicionFila"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M9 16.2l-3.5-3.5L4 14.2 9 19l12-12-1.5-1.5z"
                    fill="currentColor"
                  />
                </svg>
              </button>
              <button
                type="button"
                class="icono"
                data-label="Cancelar"
                aria-label="Cancelar"
                @click="cancelarEdicionFila"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M18.3 5.7L12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3z"
                    fill="currentColor"
                  />
                </svg>
              </button>
            </template>
            <template v-else>
              <button
                type="button"
                class="icono"
                data-label="Editar"
                aria-label="Editar"
                @click="iniciarEdicionFila(producto)"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M3 17.2V21h3.8l11-11-3.8-3.8-11 11zm17.7-10.5c.4-.4.4-1 0-1.4l-2.5-2.5c-.4-.4-1-.4-1.4 0l-2 2 3.8 3.8 2.1-1.9z"
                    fill="currentColor"
                  />
                </svg>
              </button>
              <button
                type="button"
                class="icono"
                data-label="Estado"
                aria-label="Cambiar estado"
                @click="toggleEstado(producto.id)"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M13 3h-2v10h2V3zm-1 18c-4.4 0-8-3.6-8-8 0-3.1 1.8-5.8 4.5-7V3.3C4.5 4.9 2 8.4 2 13c0 5.5 4.5 10 10 10s10-4.5 10-10c0-4.6-2.5-8.1-6.5-9.7V6c2.7 1.2 4.5 3.9 4.5 7 0 4.4-3.6 8-8 8z"
                    fill="currentColor"
                  />
                </svg>
              </button>
              <button
                type="button"
                class="icono icono--peligro"
                data-label="Eliminar"
                aria-label="Eliminar"
                @click="eliminarProducto(producto)"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M6 7h12l-1 14H7L6 7zm4-3h4l1 2H9l1-2z"
                    fill="currentColor"
                  />
                </svg>
              </button>
            </template>
          </div>
        </div>
      </div>
      <footer class="paginacion">
        <label class="paginacion__tam">
          Filas
          <select v-model.number="tamanioPagina">
            <option :value="10">10</option>
            <option :value="25">25</option>
            <option :value="50">50</option>
            <option :value="100">100</option>
          </select>
        </label>
        <p class="paginacion__meta">
          Mostrando {{ indiceInicio }}-{{ indiceFin }} de {{ productosFiltrados.length }} · Página {{ paginaActual }} de
          {{ totalPaginas }}
        </p>
        <div class="paginacion__acciones">
          <button type="button" class="boton secundaria" :disabled="paginaActual <= 1" @click="irPagina(1)">
            Primera
          </button>
          <button type="button" class="boton secundaria" :disabled="paginaActual <= 1" @click="irPagina(paginaActual - 1)">
            Anterior
          </button>
          <button
            type="button"
            class="boton secundaria"
            :disabled="paginaActual >= totalPaginas"
            @click="irPagina(paginaActual + 1)"
          >
            Siguiente
          </button>
          <button
            type="button"
            class="boton secundaria"
            :disabled="paginaActual >= totalPaginas"
            @click="irPagina(totalPaginas)"
          >
            Última
          </button>
        </div>
      </footer>
    </section>
  </main>
</template>

<style scoped>
.productos {
  display: grid;
  gap: 1.5rem;
}

.productos__cabecera {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.productos__prefijo {
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.8rem;
  color: #94a3b8;
}

.productos__nota {
  margin: 0.25rem 0 0;
  color: #cbd5e1;
}

.productos__acciones {
  display: flex;
  gap: 0.5rem;
}

.estado-conexion {
  font-size: 0.68rem;
  font-weight: 700;
  border-radius: 999px;
  padding: 0.16rem 0.45rem;
  border: 1px solid transparent;
  align-self: center;
}

.estado-conexion--online {
  color: #bbf7d0;
  background: rgba(34, 197, 94, 0.15);
  border-color: rgba(34, 197, 94, 0.45);
}

.estado-conexion--offline {
  color: #fecaca;
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.45);
}

.boton {
  border: none;
  border-radius: 0.75rem;
  padding: 0.6rem 1rem;
  font-weight: 700;
  cursor: pointer;
  color: #0b0d12;
  background: linear-gradient(120deg, #facc15, #fbbf24);
  box-shadow: 0 12px 25px rgba(0, 0, 0, 0.35);
}

.boton.secundaria {
  background: rgba(120, 126, 137, 0.2);
  color: #e2e8f0;
  box-shadow: none;
  border: 1px solid rgba(148, 163, 184, 0.3);
}

.resumen {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}

.tarjeta {
  background: #0d0f14;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 1rem;
  padding: 1rem;
  display: grid;
  gap: 0.35rem;
  box-shadow: 0 20px 55px rgba(0, 0, 0, 0.45);
}

.tarjeta strong {
  font-size: 1.7rem;
  color: #f8fafc;
}

.tarjeta__titulo {
  margin: 0;
  color: #cbd5e1;
  font-weight: 600;
}

.tarjeta span {
  color: #94a3b8;
  font-size: 0.85rem;
}

.tarjeta--alerta {
  border-color: rgba(250, 204, 21, 0.4);
}

.tarjeta--critico {
  border-color: rgba(248, 113, 113, 0.5);
}

.panel {
  background: #0d0f14;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 1rem;
  padding: 1.25rem;
  display: grid;
  gap: 1rem;
}

.tabla {
  overflow-x: auto;
}

.panel__cabecera h2 {
  margin: 0 0 0.25rem;
}

.filtros {
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}

.campo {
  display: grid;
  gap: 0.35rem;
  color: #e2e8f0;
  font-weight: 600;
}

.campo input,
.campo select {
  border-radius: 0.75rem;
  border: 1px solid rgba(148, 163, 184, 0.3);
  padding: 0.55rem 0.75rem;
  background: rgba(12, 13, 16, 0.92);
  color: #e2e8f0;
}

.formulario-modal {
  position: fixed;
  inset: 0;
  background: rgba(3, 6, 12, 0.6);
  display: grid;
  place-items: center;
  align-content: start;
  overflow-y: auto;
  padding: 1.5rem;
  z-index: 10;
}

.formulario-modal .panel {
  width: min(900px, 100%);
  max-height: calc(100vh - 3rem);
  overflow-y: auto;
}

.form-panel .panel__cabecera {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.cerrar {
  border: 1px solid rgba(148, 163, 184, 0.3);
  background: rgba(120, 126, 137, 0.2);
  color: #e2e8f0;
  border-radius: 0.7rem;
  padding: 0.45rem 0.8rem;
  cursor: pointer;
}

.form {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: 1fr;
}

.form label {
  display: grid;
  gap: 0.35rem;
  color: #e2e8f0;
  font-weight: 600;
}

.form input,
.form select {
  border-radius: 0.75rem;
  border: 1px solid rgba(148, 163, 184, 0.3);
  padding: 0.55rem 0.75rem;
  background: rgba(12, 13, 16, 0.92);
  color: #e2e8f0;
}

.form button {
  justify-self: start;
  border: none;
  border-radius: 0.75rem;
  padding: 0.6rem 1rem;
  font-weight: 700;
  cursor: pointer;
  color: #0b0d12;
  background: linear-gradient(120deg, #facc15, #fbbf24);
}

.error {
  margin: 0;
  color: #f87171;
  font-size: 0.9rem;
}

.tabla__grid {
  display: grid;
  gap: 0.9rem;
  min-width: 1180px;
}

.tabla__fila {
  display: grid;
  grid-template-columns: 2.2fr 1.1fr 0.8fr 0.8fr 0.8fr 1fr 0.8fr 1fr;
  gap: 0.45rem;
  align-items: stretch;
  padding: 0.4rem 0.55rem;
  border-radius: 0.8rem;
  background: rgba(7, 9, 13, 0.62);
  border: 1px solid rgba(148, 163, 184, 0.18);
}

.tabla__fila:hover {
  border-color: rgba(226, 232, 240, 0.35);
}

.tabla__fila--edicion {
  border-color: rgba(250, 204, 21, 0.6);
  box-shadow: 0 0 0 1px rgba(250, 204, 21, 0.2), 0 20px 45px rgba(0, 0, 0, 0.5);
}

.tabla__encabezado {
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #94a3b8;
  background: transparent;
  border: none;
  padding: 0 0.5rem;
  display: grid;
}

.tabla__encabezado > span:nth-child(3),
.tabla__encabezado > span:nth-child(4),
.tabla__encabezado > span:nth-child(5),
.tabla__encabezado > span:nth-child(6) {
  text-align: left;
}

.tabla__encabezado > span:nth-child(7),
.tabla__encabezado > span:nth-child(8) {
  text-align: left;
}

.tabla__fila > :nth-child(3),
.tabla__fila > :nth-child(4),
.tabla__fila > :nth-child(5),
.tabla__fila > :nth-child(6) {
  justify-self: stretch;
  text-align: left;
}

.tabla__fila > :nth-child(7),
.tabla__fila > :nth-child(8) {
  justify-self: stretch;
  text-align: left;
}

.tabla__fila:not(.tabla__encabezado) > * {
  min-width: 0;
}

.tabla__cabecera {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.paginacion {
  margin-top: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.paginacion__tam {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  color: #cbd5e1;
  font-size: 0.85rem;
}

.paginacion__tam select {
  border-radius: 0.65rem;
  border: 1px solid rgba(148, 163, 184, 0.3);
  padding: 0.35rem 0.5rem;
  background: rgba(8, 10, 14, 0.9);
  color: #e2e8f0;
}

.paginacion__meta {
  margin: 0;
  color: #94a3b8;
  font-size: 0.85rem;
}

.paginacion__acciones {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.producto__nombre {
  margin: 0;
  font-weight: 700;
}

.producto small {
  color: #94a3b8;
}

.producto__edicion {
  display: grid;
  gap: 0.35rem;
}

.producto__edicion input {
  width: 100%;
  min-width: 0;
  border-radius: 0.65rem;
  border: 1px solid rgba(148, 163, 184, 0.3);
  padding: 0.4rem 0.55rem;
  background: rgba(8, 10, 14, 0.9);
  color: #e2e8f0;
}

.tabla__fila > .producto {
  min-width: 14rem;
}

.tabla__fila input,
.tabla__fila select {
  border-radius: 0.65rem;
  border: 1px solid rgba(148, 163, 184, 0.3);
  padding: 0.4rem 0.55rem;
  background: rgba(8, 10, 14, 0.9);
  color: #e2e8f0;
  min-width: 0;
}

.tabla__fila input:focus,
.tabla__fila select:focus {
  outline: none;
  border-color: rgba(250, 204, 21, 0.65);
  box-shadow: 0 0 0 3px rgba(250, 204, 21, 0.2);
}

.precio {
  color: #0b0d12;
  font-weight: 700;
  background: linear-gradient(120deg, #facc15, #fbbf24);
  padding: 0.2rem 0.42rem;
  border-radius: 0.6rem;
  text-align: left;
  justify-self: start;
  font-size: 0.9rem;
  line-height: 1.1;
}

.estado {
  font-size: 0.72rem;
  font-weight: 700;
  color: #86efac;
  text-transform: capitalize;
}

.estado.inactivo {
  color: #fca5a5;
}

.acciones {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.icono {
  position: relative;
  border: 1px solid rgba(148, 163, 184, 0.4);
  background: rgba(15, 23, 42, 0.65);
  color: #e2e8f0;
  border-radius: 0.7rem;
  width: 2.4rem;
  height: 2.4rem;
  display: inline-grid;
  place-items: center;
  cursor: pointer;
  transition: transform 0.15s ease, border-color 0.15s ease, background 0.15s ease;
}

.icono svg {
  width: 1.1rem;
  height: 1.1rem;
}

.icono:hover,
.icono:focus-visible {
  border-color: rgba(250, 204, 21, 0.6);
  background: rgba(250, 204, 21, 0.16);
  transform: translateY(-1px);
  outline: none;
}

.icono--peligro {
  border-color: rgba(239, 68, 68, 0.45);
  background: rgba(239, 68, 68, 0.12);
  color: #fecaca;
}

.icono--peligro:hover,
.icono--peligro:focus-visible {
  border-color: rgba(239, 68, 68, 0.8);
  background: rgba(239, 68, 68, 0.2);
}

.icono::after {
  content: attr(data-label);
  position: absolute;
  bottom: calc(100% + 0.35rem);
  left: 50%;
  transform: translateX(-50%);
  padding: 0.25rem 0.5rem;
  border-radius: 0.5rem;
  background: rgba(15, 23, 42, 0.95);
  color: #e2e8f0;
  font-size: 0.75rem;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;
}

.icono:focus-visible::after,
.icono:hover::after {
  opacity: 1;
}

@media (max-width: 960px) {
  .tabla__grid {
    min-width: 1180px;
  }
}

@media (max-width: 720px) {
  .productos__cabecera {
    flex-direction: column;
  }

  .tabla__grid {
    min-width: 1180px;
  }

}
</style>
