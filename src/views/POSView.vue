<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import jsPDF from 'jspdf'
import { crearMovimientoFinanciero } from '../services/movimientosFinancieros'
import { ENDPOINTS } from '../config/endpoints'
import { getSessionUserId } from '../utils/session'

type Producto = {
  id: number
  backendId?: number
  nombre: string
  descripcion?: string
  precio: number
  stock: number
  categoria: string
  destacador?: string
  codigoBarras?: string | string[]
  estado?: boolean
}

type ItemCarrito = {
  id: number
  backendId?: number
  nombre: string
  codigoBarras?: string
  precio: number
  cantidad: number
  descuentoPct: number
  descuentoMonto: number
}

type Cliente = {
  id: string
  nombre: string
  documento?: string
  descuentoPesos?: number
  descuentoPorcentaje?: number
}

const CLIENTES_ENDPOINT = ENDPOINTS.CLIENTES
const VENTAS_ENDPOINT = ENDPOINTS.VENTAS_POS
const DEFAULT_PROVEEDOR_ID = 0
const DEFAULT_CAJA_ID = 1
const DEFAULT_USUARIO_ID = 23


const productos = ref<Producto[]>([
  { id: 1, nombre: 'Café americano', precio: 2.5, stock: 18, categoria: 'Bebidas', destacador: 'Caliente' },
  { id: 2, nombre: 'Latte vainilla', precio: 3.9, stock: 12, categoria: 'Bebidas', destacador: 'Nuevo' },
  { id: 3, nombre: 'Sandwich pollo', precio: 5.5, stock: 9, categoria: 'Snacks' },
  { id: 4, nombre: 'Wrap veggie', precio: 4.8, stock: 6, categoria: 'Snacks', destacador: 'Vegano' },
  { id: 5, nombre: 'Brownie choco', precio: 2.8, stock: 15, categoria: 'Postres' },
  { id: 6, nombre: 'Cheesecake', precio: 3.6, stock: 7, categoria: 'Postres' },
  { id: 7, nombre: 'Agua mineral', precio: 1.5, stock: 24, categoria: 'Bebidas' },
  { id: 8, nombre: 'Combo desayuno', precio: 7.5, stock: 5, categoria: 'Combos', destacador: '-10%' }
])

const categorias = computed(() =>
  Array.from(new Set(productos.value.map((p) => p.categoria))).filter(
    (categoria) => categoria && categoria.toLowerCase() !== 'sin categoria'
  )
)

const consulta = ref('')
const buscadorRef = ref<HTMLElement | null>(null)
const categoriaActiva = ref('')
const carrito = ref<ItemCarrito[]>([])
const pagoRecibido = ref(0)
const notaRapida = ref('')
const ultimaAccion = ref('Listo para vender')
const ventaId = ref<number>(Date.now())
const fechaVenta = ref(new Date().toISOString())
const tipoPago = ref('efectivo')
const estadoVenta = ref(true)
const ventaPendienteId = ref<number | null>(null)
const payloadVenta = ref<Record<string, unknown> | null>(null)
const respuestaVenta = ref<unknown>(null)
const payloadMovimiento = ref<string | null>(null)
const mostrarPayloadVenta = ref(false)
const mostrarTicketModal = ref(false)
const mostrarResumenCobro = ref(false)
const resumenCobro = ref({
  subtotal: 0,
  descuento: 0,
  total: 0,
  pagoRecibido: 0,
  cambio: 0
})
const numeroFacturaResumen = ref('')
const reciboItems = ref<ItemCarrito[]>([])
const descuentoItem = ref<ItemCarrito | null>(null)
const tamañoPanelProductos = ref(62)
const tamañoPanelDetalle = computed(() => Math.max(100 - tamañoPanelProductos.value, 20))
const arrastrandoSplitter = ref(false)
let inicioArrastreX = 0
let inicioArrastrePorcentaje = 62

const iniciarSplitter = (event: MouseEvent) => {
  arrastrandoSplitter.value = true
  inicioArrastreX = event.clientX
  inicioArrastrePorcentaje = tamañoPanelProductos.value
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

const moverSplitter = (event: MouseEvent) => {
  if (!arrastrandoSplitter.value) return
  const contenedor = document.querySelector('.layout') as HTMLElement | null
  if (!contenedor) return
  const delta = event.clientX - inicioArrastreX
  const porcentajeDelta = (delta / contenedor.clientWidth) * 100
  const nuevo = Math.min(78, Math.max(45, inicioArrastrePorcentaje + porcentajeDelta))
  tamañoPanelProductos.value = nuevo
}

const detenerSplitter = () => {
  if (!arrastrandoSplitter.value) return
  arrastrandoSplitter.value = false
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

const onResize = () => {
  if (tamañoPanelProductos.value > 78) tamañoPanelProductos.value = 78
  if (tamañoPanelProductos.value < 45) tamañoPanelProductos.value = 45
}

const abrirModalDescuento = (item: ItemCarrito) => {
  descuentoItem.value = item
}

const cerrarModalDescuento = () => {
  descuentoItem.value = null
}
const mapearItemsPendientes = (detalles: unknown): ItemCarrito[] => {
  if (!Array.isArray(detalles)) return []
  return detalles
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const detalle = item as Record<string, unknown>
      const id = Number(detalle.producto_id ?? detalle.productoId ?? detalle.id ?? 0)
      if (!id) return null
      const nombreBackend = detalle.producto_nombre ?? detalle.nombre
      const productoLocal = productos.value.find((producto) => producto.backendId === id || producto.id === id)
      const nombre = String(nombreBackend ?? productoLocal?.nombre ?? `Producto ${id}`)
      const precio = Number(detalle.precio_unitario ?? detalle.precio ?? 0)
      const cantidad = Number(detalle.cantidad ?? 1)
      const codigoBarras = productoLocal?.codigoBarras
      return {
        id,
        backendId: id,
        nombre,
        codigoBarras: formatearCodigosBarras(codigoBarras),
        precio,
        cantidad,
        descuentoPct: Number(detalle.descuento_pct ?? detalle.descuentoPct ?? 0),
        descuentoMonto: Number(detalle.descuento_monto ?? detalle.descuentoMonto ?? 0)
      }
    })
    .filter(Boolean) as ItemCarrito[]
}

const cargarVentaPendienteDesdeApi = (venta: Record<string, unknown>) => {
  const ventaIdRaw = Number(venta.venta_id ?? venta.id ?? NaN)
  ventaId.value = Number.isFinite(ventaIdRaw) ? ventaIdRaw : Date.now()
  ventaPendienteId.value = Number.isFinite(ventaIdRaw) ? ventaIdRaw : null
  numeroFacturaResumen.value = String(venta.numero_factura ?? venta.numeroFactura ?? '')
  const clienteRaw = venta.cliente_id ?? venta.clienteId ?? null
  clienteId.value = clienteRaw ? String(clienteRaw) : null
  notaRapida.value = String(venta.nota_venta ?? venta.nota ?? '')
  const tipoPagoRaw = venta.tipo_pago ?? venta.tipoPago
  if (tipoPagoRaw === null) {
    tipoPago.value = 'credito'
  } else if (typeof tipoPagoRaw === 'string' && tipoPagoRaw.trim()) {
    tipoPago.value = tipoPagoRaw
  }
  if (typeof venta.estado === 'boolean') {
    estadoVenta.value = venta.estado
  }
  const detalles = venta.detalles ?? venta.items ?? []
  carrito.value = mapearItemsPendientes(detalles)
  ultimaAccion.value = `Venta #${ventaId.value} cargada`
}

const cargarPendienteEvento = (event: Event) => {
  const detalle = (event as CustomEvent).detail as { venta?: Record<string, unknown> } | undefined
  if (!detalle?.venta) return
  cargarVentaPendienteDesdeApi(detalle.venta)
}

const manejarAtajos = (event: KeyboardEvent) => {
  if (event.key === 'F10') {
    event.preventDefault()
    void cerrarVenta()
  } else if (event.key === 'F9') {
    event.preventDefault()
    mostrarTicketModal.value = true
  } else if (event.key === 'Escape') {
    if (mostrarTicketModal.value) {
      event.preventDefault()
      mostrarTicketModal.value = false
    }
  }
}

const manejarClickFueraBuscador = (event: MouseEvent) => {
  const target = event.target as Node | null
  if (!buscadorRef.value || !target) return
  if (!buscadorRef.value.contains(target)) {
    consulta.value = ''
  }
}
const clientes = ref<Cliente[]>([])
const clienteId = ref<string | null>(null)
const clienteSeleccionado = computed(
  () => clientes.value.find((cliente) => cliente.id === clienteId.value) ?? null
)
const isOnline = ref(typeof navigator !== 'undefined' ? navigator.onLine : true)
const actualizarEstadoConexion = () => {
  isOnline.value = navigator.onLine
}

const filtrados = computed(() => {
  const termino = normalizarTexto(consulta.value)
  return productos.value.filter((producto) => {
    const coincideTexto = termino === '' || matchProductoBusqueda(producto, termino)
    const estaActivo = producto.estado !== false
    const coincideCategoria = !categoriaActiva.value || producto.categoria === categoriaActiva.value
    return coincideTexto && coincideCategoria && estaActivo
  })
})

const sugerencias = computed(() => {
  const termino = normalizarTexto(consulta.value)
  if (termino.length < 1) return []
  return filtrados.value
})

const normalizarCodigo = (valor: string) => valor.trim().toLowerCase()
const normalizarTexto = (valor: string) => valor.toLowerCase().trim()
const extraerCodigosBarras = (codigo: string | string[] | undefined) => {
  if (!codigo) return []
  if (Array.isArray(codigo)) {
    return codigo.map((item) => normalizarCodigo(String(item))).filter(Boolean)
  }
  return String(codigo)
    .split(/[,;|/]+|\s+/)
    .map((item) => normalizarCodigo(item))
    .filter(Boolean)
}
const extraerCodigosEntrada = (entrada: string) =>
  String(entrada)
    .split(/[,;|/]+|\s+/)
    .map((item) => normalizarCodigo(item))
    .filter(Boolean)
const formatearCodigosBarras = (codigo: string | string[] | undefined) => {
  const codigos = extraerCodigosBarras(codigo)
  return codigos.length ? codigos.join(' · ') : ''
}
const matchProductoBusqueda = (producto: Producto, termino: string) => {
  if (!termino) return false
  const term = normalizarTexto(termino)
  const nombre = normalizarTexto(producto.nombre ?? '')
  const categoria = normalizarTexto(producto.categoria ?? '')
  const descripcion = normalizarTexto(producto.descripcion ?? '')
  const codigos = extraerCodigosBarras(producto.codigoBarras)
  return (
    nombre.includes(term) ||
    categoria.includes(term) ||
    descripcion.includes(term) ||
    codigos.some((item) => item.includes(term))
  )
}
const encontrarProductoPorCodigo = (codigo: string, exactOnly = false) => {
  const codigoNormalizado = normalizarCodigo(codigo)
  if (!codigoNormalizado) return null
  const matchExacto = productos.value.find((producto) =>
    extraerCodigosBarras(producto.codigoBarras).some((item) => item === codigoNormalizado)
  )
  if (matchExacto) return matchExacto
  if (exactOnly) return null
  const candidatos = productos.value.filter((producto) => matchProductoBusqueda(producto, codigoNormalizado))
  return candidatos.length === 1 ? candidatos[0] : null
}

const CACHE_KEY = 'pos_productos_cache'

const cargarProductos = async () => {
  try {
    const cache = localStorage.getItem(CACHE_KEY)
    if (cache) {
      const guardados = JSON.parse(cache) as Producto[]
      if (Array.isArray(guardados) && guardados.length) {
        productos.value = guardados
      }
    }
  } catch {
    // Ignora cache corrupto
  }

  try {
    const respuesta = await fetch(ENDPOINTS.PRODUCTOS)
    if (!respuesta.ok) {
      throw new Error(`Error ${respuesta.status}`)
    }
    const data = (await respuesta.json()) as Record<string, unknown> | unknown[]
    const dataObj = data as Record<string, unknown>
    const lista = (
      Array.isArray(data)
        ? data
        : Array.isArray(dataObj.results)
          ? dataObj.results
          : Array.isArray(dataObj.data)
            ? dataObj.data
            : Array.isArray((dataObj.data as Record<string, unknown>)?.results)
              ? (dataObj.data as Record<string, unknown>).results
              : Array.isArray(dataObj.items)
                ? dataObj.items
                : []
    ) as unknown[]
    const normalizados = lista
      .map((item: unknown, index: number) => {
        if (!item || typeof item !== 'object') return null
        const producto = item as Record<string, unknown>
        const id = Number(producto.producto_id ?? producto.id ?? producto.pk ?? index + 1)
        const backendId = Number(producto.id ?? producto.producto_id ?? producto.pk ?? id)
        const nombre = String(producto.nombre ?? producto.name ?? 'Producto')
        const descripcion = String(producto.descripcion ?? producto.description ?? '')
        const precio = Number(producto.precio_venta ?? producto.precio ?? producto.price ?? 0)
        const stock = Number(producto.stock ?? producto.existencias ?? 0)
        const categoria = String(producto.categoria_nombre ?? producto.categoria ?? producto.category ?? 'Sin categoria')
        const destacadorRaw = producto.destacador ?? producto.badge ?? producto.etiqueta
        const codigoBarras = producto.codigo_barras ?? producto.codigoBarras ?? producto.codigo_barra ?? producto.barras
        const estadoRaw = producto.estado
        const estado = typeof estadoRaw === 'boolean' ? estadoRaw : estadoRaw === 'activo'
        const destacador = destacadorRaw ? String(destacadorRaw) : undefined
        return {
          id,
          backendId,
          nombre,
          descripcion,
          precio,
          stock,
          categoria,
          destacador,
          codigoBarras: codigoBarras ? String(codigoBarras) : undefined,
          estado
        }
      })
      .filter(Boolean) as Producto[]
    if (normalizados.length) {
      productos.value = normalizados
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(normalizados))
      } catch {
        // Ignora errores de storage
      }
    }
  } catch (error) {
    console.error('No se pudieron cargar productos', error)
  }
}

const cargarClientes = async () => {
  try {
    const logClientes = async (lines: string[]) => {
      try {
        const ipc = (window as unknown as { ipcRenderer?: { invoke: (c: string, p: unknown) => Promise<void> } })
          .ipcRenderer
        if (!ipc?.invoke) return
        await ipc.invoke('log:append', { filename: 'clientes.txt', lines })
      } catch (err) {
        console.warn('No se pudo escribir clientes.txt', err)
      }
    }
    const timestamp = new Date().toISOString()
    await logClientes([`[${timestamp}] request endpoint=${CLIENTES_ENDPOINT}`])
    const respuesta = await fetch(CLIENTES_ENDPOINT)
    if (!respuesta.ok) {
      const detalle = await respuesta.text().catch(() => '')
      await logClientes([`response status=${respuesta.status} ok=false body=${detalle}`])
      throw new Error(detalle || `Error ${respuesta.status}`)
    }
    const data = await respuesta.json()
    await logClientes([`response status=${respuesta.status} ok=true body=${JSON.stringify(data)}`])
    const lista = Array.isArray(data) ? data : Array.isArray(data.results) ? data.results : Array.isArray(data.data) ? data.data : []
    const normalizados = lista
      .map((item: unknown, index: number) => {
        if (!item || typeof item !== 'object') return null
        const cliente = item as Record<string, unknown>
        const id = String(cliente.cliente_id ?? cliente.id ?? cliente.pk ?? index + 1)
        const nombre = String(cliente.nombre ?? cliente.name ?? 'Cliente')
        const documentoRaw = cliente.documento ?? cliente.identificacion ?? cliente.nit
        const documento = documentoRaw ? String(documentoRaw) : undefined
        const descuentoPesos = Number(cliente.descuento_pesos ?? cliente.descuentoPesos ?? 0)
        const descuentoPorcentaje = Number(cliente.descuento_porcentaje ?? cliente.descuentoPorcentaje ?? 0) * 100
        return { id, nombre, documento, descuentoPesos, descuentoPorcentaje }
      })
      .filter(Boolean) as Cliente[]
    if (normalizados.length) {
      clientes.value = normalizados
    }
  } catch (error) {
    console.error('No se pudieron cargar clientes', error)
  }
}


onMounted(() => {
  void cargarProductos()
  void cargarClientes()
  window.addEventListener('mousemove', moverSplitter)
  window.addEventListener('mouseup', detenerSplitter)
  window.addEventListener('resize', onResize)
  window.addEventListener('online', actualizarEstadoConexion)
  window.addEventListener('offline', actualizarEstadoConexion)
  window.addEventListener('pos:cargar-pendiente', cargarPendienteEvento)
  window.addEventListener('keydown', manejarAtajos)
  window.addEventListener('click', manejarClickFueraBuscador)
})

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', moverSplitter)
  window.removeEventListener('mouseup', detenerSplitter)
  window.removeEventListener('resize', onResize)
  window.removeEventListener('online', actualizarEstadoConexion)
  window.removeEventListener('offline', actualizarEstadoConexion)
  window.removeEventListener('pos:cargar-pendiente', cargarPendienteEvento as EventListener)
  window.removeEventListener('keydown', manejarAtajos)
  window.removeEventListener('click', manejarClickFueraBuscador)
})

const normalizarDescuento = (valor: number | undefined) => Math.min(Math.max(valor ?? 0, 0), 100)
const normalizarDescuentoMonto = (valor: number | undefined, maximo: number) =>
  Math.min(Math.max(Number(valor ?? 0), 0), Math.max(maximo, 0))

const calcularLinea = (item: ItemCarrito) => {
  const base = Number(item.precio) * Number(item.cantidad)
  const descuentoPct = normalizarDescuento(item.descuentoPct)
  const descuentoPorcentaje = base * (descuentoPct / 100)
  const descuentoMontoTotal = Number(item.descuentoMonto) * Number(item.cantidad)
  const descuentoMonto = normalizarDescuentoMonto(descuentoMontoTotal, base - descuentoPorcentaje)
  const total = Math.max(base - descuentoPorcentaje - descuentoMonto, 0)
  return { base, descuentoPct, descuentoPorcentaje, descuentoMonto, total }
}

const resumenCarrito = computed(() => {
  const subtotalBruto = carrito.value.reduce((total, item) => total + calcularLinea(item).base, 0)
  const subtotalConLineas = carrito.value.reduce((total, item) => total + calcularLinea(item).total, 0)
  const descuentoLineas = subtotalBruto - subtotalConLineas
  const descuentoGlobal = 0
  const baseImponible = Math.max(subtotalConLineas - descuentoGlobal, 0)
  const impuesto = 0
  const total = Math.max(baseImponible + impuesto, 0)
  const cambio = Math.max(Number(pagoRecibido.value) - total, 0)

  return {
    subtotalBruto,
    descuentoLineas,
    descuentoGlobal,
    impuesto,
    total,
    cambio
  }
})

const subtotalDetalle = computed(() => resumenCarrito.value.subtotalBruto)

const formatCurrency = (monto: number) =>
  monto.toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0
  })

const totalLinea = (item: ItemCarrito) => {
  return calcularLinea(item).total
}

const descuentoPorDefectoCliente = () => {
  const descuentoPct = Number(clienteSeleccionado.value?.descuentoPorcentaje ?? 0)
  const descuentoMonto = Number(clienteSeleccionado.value?.descuentoPesos ?? 0)
  if (descuentoPct > 0) {
    return { descuentoPct, descuentoMonto: 0 }
  }
  if (descuentoMonto > 0) {
    return { descuentoPct: 0, descuentoMonto }
  }
  return { descuentoPct: 0, descuentoMonto: 0 }
}

watch(
  () => clienteId.value,
  () => {
    const descuentoCliente = descuentoPorDefectoCliente()
    carrito.value = carrito.value.map((item) => ({
      ...item,
      descuentoPct: descuentoCliente.descuentoPct,
      descuentoMonto: descuentoCliente.descuentoMonto
    }))
  }
)

watch(
  () => consulta.value,
  (nuevo) => {
    const codigos = extraerCodigosEntrada(nuevo)
    if (!codigos.length) return
    let agregado = false
    for (const codigo of codigos) {
      const producto = encontrarProductoPorCodigo(codigo, true)
      if (!producto) continue
      agregarAlCarrito(producto)
      agregado = true
    }
    if (agregado) {
      consulta.value = ''
    }
  }
)

const resumenDescuentoLinea = (item: ItemCarrito) => {
  const { descuentoPct, descuentoMonto } = calcularLinea(item)
  const piezas: string[] = []
  if (descuentoPct > 0) piezas.push(`-${descuentoPct}%`)
  if (descuentoMonto > 0) piezas.push(`-${formatCurrency(descuentoMonto)}`)
  return piezas.join(' · ')
}

const agregarAlCarrito = (producto: Producto) => {
  const existente = carrito.value.find((item) => item.id === producto.id)
  if (existente) {
    existente.cantidad++
  } else {
    const descuentoCliente = descuentoPorDefectoCliente()
    carrito.value.push({
      id: producto.id,
      backendId: producto.backendId,
      nombre: producto.nombre,
      codigoBarras: formatearCodigosBarras(producto.codigoBarras),
      precio: Number(producto.precio),
      cantidad: 1,
      descuentoPct: descuentoCliente.descuentoPct,
      descuentoMonto: descuentoCliente.descuentoMonto
    })
  }
  ultimaAccion.value = `${producto.nombre} añadido`
}

const actualizarCantidad = (id: number, delta: number) => {
  const item = carrito.value.find((articulo) => articulo.id === id)
  if (!item) return
  if (delta !== 0) {
    item.cantidad += delta
  }
  if (!Number.isFinite(item.cantidad)) {
    item.cantidad = 1
  }
  if (item.cantidad <= 0) {
    carrito.value = carrito.value.filter((articulo) => articulo.id !== id)
    ultimaAccion.value = 'Producto removido'
  } else {
    ultimaAccion.value = 'Cantidad actualizada'
  }
}

const eliminarItem = (id: number) => {
  carrito.value = carrito.value.filter((articulo) => articulo.id !== id)
  ultimaAccion.value = 'Producto removido'
}

const limpiarCarrito = () => {
  carrito.value = []
  pagoRecibido.value = 0
  ultimaAccion.value = 'Carrito limpio'
}

const cobrarRapido = () => {
  pagoRecibido.value = resumenCarrito.value.total
  ultimaAccion.value = 'Pago igual al total'
}

const construirPayloadVenta = (estadoOverride?: boolean) => {
  const redondear2 = (valor: number) => Math.round(Number(valor) * 100) / 100
  const tipoPagoPayload = tipoPago.value === 'credito' ? null : tipoPago.value
  const clientePayload = clienteId.value ?? 'e7098aa3-ea98-4a42-a019-2bf75a16a1ea'
  const usuarioPayload = getSessionUserId()
  if (!usuarioPayload) {
    throw new Error('No se pudo identificar el usuario de la sesión.')
  }
  return {
    tipo_pago: tipoPagoPayload,
    estado: typeof estadoOverride === 'boolean' ? estadoOverride : estadoVenta.value,
    nota_venta: notaRapida.value || null,
    user_id: usuarioPayload,
    cliente_id: clientePayload,
    impuesto: 0,
    descuento: redondear2(resumenCarrito.value.descuentoLineas),
    fecha: new Date().toISOString(),
    detalles: carrito.value.map((item) => ({
      producto_id: item.backendId ?? item.id,
      cantidad: item.cantidad,
      precio_unitario: redondear2(item.precio),
      subtotal: redondear2(calcularLinea(item).base)
    }))
  }
}

const construirPayloadActualizacion = (estadoOverride?: boolean) => {
  const redondear2 = (valor: number) => Math.round(Number(valor) * 100) / 100
  const clientePayload = clienteId.value ?? 'e7098aa3-ea98-4a42-a019-2bf75a16a1ea'
  const usuarioPayload = getSessionUserId()
  if (!usuarioPayload) {
    throw new Error('No se pudo identificar el usuario de la sesión.')
  }
  return {
    estado: typeof estadoOverride === 'boolean' ? estadoOverride : estadoVenta.value,
    nota_venta: notaRapida.value || null,
    impuesto: 0,
    descuento: redondear2(resumenCarrito.value.descuentoLineas),
    cliente_id: clientePayload,
    user_id: usuarioPayload,
    detalles: carrito.value.map((item) => ({
      producto_id: item.backendId ?? item.id,
      cantidad: item.cantidad,
      precio_unitario: redondear2(item.precio)
    }))
  }
}

const guardarVentaApi = async (estadoOverride?: boolean) => {
  const payload = construirPayloadVenta(estadoOverride)
  payloadVenta.value = payload
  mostrarPayloadVenta.value = true

  const respuesta = await fetch(VENTAS_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })

  if (!respuesta.ok) {
    const detalle = await respuesta.text().catch(() => '')
    throw new Error(detalle || `Error ${respuesta.status}`)
  }
  const contenido = await respuesta.json().catch(() => null)
  respuestaVenta.value = contenido
  return contenido
}

const registrarMovimientoIngreso = async (ventaId?: number | null) => {
  const montoVenta = Number(resumenCarrito.value.total ?? 0)
  const usuarioPayload = getSessionUserId()
  if (!usuarioPayload) {
    throw new Error('No se pudo identificar el usuario de la sesión.')
  }
  const payload = {
    fecha: new Date().toISOString(),
    tipo: 'INGRESO' as const,
    monto: montoVenta,
    proveedor_id: DEFAULT_PROVEEDOR_ID,
    caja_id: DEFAULT_CAJA_ID,
    usuario_id: usuarioPayload,
    venta_id: ventaId && ventaId > 0 ? ventaId : null
  }
  payloadMovimiento.value = JSON.stringify(payload, null, 2)
  await crearMovimientoFinanciero(payload)
}

const actualizarVentaApi = async (id: number, estadoOverride?: boolean) => {
  const payload = construirPayloadActualizacion(estadoOverride)
  payloadVenta.value = payload
  mostrarPayloadVenta.value = true

  const respuesta = await fetch(`${VENTAS_ENDPOINT}${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })

  if (!respuesta.ok) {
    const detalle = await respuesta.text().catch(() => '')
    throw new Error(detalle || `Error ${respuesta.status}`)
  }
  const contenido = await respuesta.json().catch(() => null)
  respuestaVenta.value = contenido
  return contenido
}

const cerrarVenta = async () => {
  if (carrito.value.length === 0) {
    ultimaAccion.value = 'Agrega productos antes de cobrar'
    return
  }
  try {
    const snapshot = {
      subtotal: resumenCarrito.value.subtotalBruto,
      descuento: resumenCarrito.value.descuentoLineas,
      total: resumenCarrito.value.total,
      pagoRecibido: Number(pagoRecibido.value || 0),
      cambio: resumenCarrito.value.cambio
    }
    const snapshotItems = carrito.value.map((item) => ({ ...item }))
    let respuestaVenta: Record<string, unknown> | null = null
    if (ventaPendienteId.value) {
      respuestaVenta = (await actualizarVentaApi(ventaPendienteId.value, true)) as Record<string, unknown>
      ventaPendienteId.value = null
    } else {
      respuestaVenta = (await guardarVentaApi(true)) as Record<string, unknown>
    }
    numeroFacturaResumen.value = String(
      respuestaVenta?.numero_factura ?? respuestaVenta?.numeroFactura ?? ''
    )
    const idRaw = respuestaVenta?.venta_id ?? respuestaVenta?.id ?? ventaPendienteId.value
    const ventaIdFinal = idRaw !== null && idRaw !== undefined ? Number(idRaw) : NaN
    try {
      await registrarMovimientoIngreso(Number.isFinite(ventaIdFinal) ? ventaIdFinal : null)
      ultimaAccion.value = 'Movimiento financiero registrado'
    } catch (error) {
      const detalle = error instanceof Error ? error.message : String(error)
      console.error('No se pudo registrar el movimiento financiero', error)
      ultimaAccion.value = detalle
    }
    limpiarCarrito()
    notaRapida.value = ''
    ventaId.value = Date.now()
    fechaVenta.value = new Date().toISOString()
    estadoVenta.value = true
    ultimaAccion.value = 'Venta registrada'
    resumenCobro.value = snapshot
    reciboItems.value = snapshotItems
    mostrarResumenCobro.value = true
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error al guardar la venta'
    console.error('No se pudo guardar la venta', error)
    ultimaAccion.value = mensaje
  }
}

const guardarVentaPendiente = () => {
  if (carrito.value.length === 0) {
    ultimaAccion.value = 'Agrega productos antes de guardar'
    return
  }
  const guardar = async () => {
    try {
      if (ventaPendienteId.value) {
        await actualizarVentaApi(ventaPendienteId.value, false)
      } else {
        const respuesta = await guardarVentaApi(false)
        const idRaw =
          (respuesta as Record<string, unknown> | null)?.venta_id ?? (respuesta as Record<string, unknown> | null)?.id
        const id = idRaw !== null && idRaw !== undefined ? Number(idRaw) : NaN
        ventaPendienteId.value = Number.isFinite(id) ? id : null
      }
      window.dispatchEvent(new CustomEvent('pos:pendientes-actualizados'))
      limpiarCarrito()
      ventaPendienteId.value = null
      ultimaAccion.value = 'Venta guardada como pendiente'
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : 'Error al guardar la venta'
      console.error('No se pudo guardar la venta', error)
      ultimaAccion.value = mensaje
    }
  }

  void guardar()
}

const imprimirTicket = () => {
  window.print()
}

const generarDocTicket = (items: ItemCarrito[], resumen: typeof resumenCobro.value, numeroFactura?: string) => {
  const fecha = new Date()
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const margin = 40
  const lineHeight = 16
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const right = pageWidth - margin
  const nombreWidth = pageWidth - margin * 2 - 90
  let y = margin

  doc.setFont('courier', 'normal')
  doc.setFontSize(16)
  doc.text('AUTOSERVICIO EL PAISA', pageWidth / 2, y, { align: 'center' })
  y += lineHeight
  doc.setFontSize(12)
  doc.text('FACTURA DE VENTA', pageWidth / 2, y, { align: 'center' })
  y += lineHeight
  doc.setFontSize(10)
  const numero = numeroFactura?.trim() ? numeroFactura.trim() : `POS-${ventaId.value}`
  doc.text(`Factura: ${numero}`, margin, y)
  y += lineHeight
  doc.text(`Fecha: ${fecha.toLocaleString('es-CO')}`, margin, y)
  y += lineHeight
  const clienteNombre = clienteSeleccionado.value?.nombre ?? 'Consumidor final'
  doc.text(`Cliente: ${clienteNombre}`, margin, y)
  y += lineHeight
  doc.text(`Caja: ${DEFAULT_CAJA_ID}`, margin, y)
  y += lineHeight
  doc.text(`Nota: ${notaRapida.value}`, margin, y)
  y += lineHeight
  doc.line(margin, y, right, y)
  y += lineHeight

  if (items.length === 0) {
    doc.text('Sin productos', margin, y)
    y += lineHeight
  } else {
    items.forEach((item) => {
      const nombreLineas = doc.splitTextToSize(item.nombre, nombreWidth)
      if (y + lineHeight > pageHeight - margin) {
        doc.addPage()
        y = margin
      }
      doc.text(nombreLineas[0], margin, y)
      doc.text(`x${item.cantidad}`, right - 70, y, { align: 'right' })
      doc.text(formatCurrency(totalLinea(item)), right, y, { align: 'right' })
      for (let i = 1; i < nombreLineas.length; i += 1) {
        y += lineHeight
        if (y + lineHeight > pageHeight - margin) {
          doc.addPage()
          y = margin
        }
        doc.text(nombreLineas[i], margin, y)
      }
      y += lineHeight
    })
  }

  if (y + lineHeight * 5 > pageHeight - margin) {
    doc.addPage()
    y = margin
  }
  doc.line(margin, y, right, y)
  y += lineHeight
  doc.text('Subtotal', margin, y)
  doc.text(formatCurrency(resumen.subtotal), right, y, { align: 'right' })
  y += lineHeight
  doc.text('Desc. productos', margin, y)
  doc.text(`-${formatCurrency(resumen.descuento)}`, right, y, { align: 'right' })
  y += lineHeight
  doc.text('Desc. global', margin, y)
  doc.text(`-${formatCurrency(0)}`, right, y, { align: 'right' })
  y += lineHeight
  doc.text('Impuesto', margin, y)
  doc.text(formatCurrency(0), right, y, { align: 'right' })
  y += lineHeight
  doc.setFontSize(12)
  doc.text('Total', margin, y)
  doc.text(formatCurrency(resumen.total), right, y, { align: 'right' })
  return doc
}

const guardarTicket = () => {
  const doc = generarDocTicket(carrito.value, {
    subtotal: resumenCarrito.value.subtotalBruto,
    descuento: resumenCarrito.value.descuentoLineas,
    total: resumenCarrito.value.total,
    pagoRecibido: Number(pagoRecibido.value || 0),
    cambio: resumenCarrito.value.cambio
  })

  const sello = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  doc.save(`ticket-${sello}.pdf`)
}

const guardarTicketResumen = () => {
  const doc = generarDocTicket(reciboItems.value, resumenCobro.value, numeroFacturaResumen.value)
  const sello = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  doc.save(`ticket-${sello}.pdf`)
}

const imprimirTicketResumen = () => {
  const doc = generarDocTicket(reciboItems.value, resumenCobro.value, numeroFacturaResumen.value)
  doc.autoPrint()
  doc.output('dataurlnewwindow')
}
</script>

<template>
  <main class="pos">
    <header class="cabecera">
      <div>
        <p class="cabecera__nota">{{ notaRapida }}</p>
      </div>
      <div class="cabecera__chips">
        <span class="chip">Caja 01</span>
        <span class="chip" :class="isOnline ? 'chip--online' : 'chip--offline'">
          {{ isOnline ? 'En línea' : 'Offline' }}
        </span>
      </div>
    </header>

    <section
      class="layout layout--split"
      :style="{ gridTemplateColumns: `${tamañoPanelProductos}% 12px ${tamañoPanelDetalle}%` }"
    >
      <section class="panel productos">
        <div class="panel__encabezado">
          <label class="cabecera__cliente">
            <span>Cliente</span>
            <select v-model="clienteId">
              <option :value="null">Selecciona un cliente</option>
              <option v-for="cliente in clientes" :key="cliente.id" :value="cliente.id">
                {{ cliente.nombre }}{{ cliente.documento ? ` - ${cliente.documento}` : '' }}
              </option>
            </select>
          </label>
          <div ref="buscadorRef" class="buscador">
            <input v-model="consulta" type="search" placeholder="Busque por nombre o codigo de barras..." />
            <ul v-if="sugerencias.length" class="sugerencias" role="listbox">
              <li v-for="producto in sugerencias" :key="producto.id">
                <button
                  type="button"
                  class="sugerencia"
                  @click="
                    agregarAlCarrito(producto);
                    consulta = ''
                  "
                >
                  <span class="sugerencia__nombre">{{ producto.nombre }}</span>
                  <span class="sugerencia__precio">{{ formatCurrency(producto.precio) }}</span>
                </button>
              </li>
            </ul>

          </div>
          <div class="categorias">
            <button
              v-for="categoria in categorias"
              :key="categoria"
              type="button"
              :class="['categoria', { activa: categoriaActiva === categoria }]"
              @click="categoriaActiva = categoria"
            >
              {{ categoria }}
            </button>
          </div>
        </div>

        <header class="panel__encabezado panel__encabezado--carrito">
          <div class="botonera">
            <button type="button" class="boton secundaria" @click="limpiarCarrito">Vaciar</button>
            <button type="button" class="boton secundaria" @click="mostrarTicketModal = true">Vista previa F9</button>
            <button type="button" class="boton" @click="cobrarRapido">Pago exacto</button>
          </div>
          <div class="botonera">
            <button type="button" class="boton secundaria" @click="guardarTicket">Guardar PDF</button>
            <button type="button" class="boton" @click="imprimirTicket">Imprimir recibo</button>
          </div>
        </header>

        <ul class="lineas" aria-live="polite">
          <li v-for="item in carrito" :key="item.id" class="linea">
            <div class="linea__fila">
              <div>
                <div class="linea__principal">
                  <p class="linea__titulo">{{ item.nombre }}</p>
                  <button type="button" class="linea__descuento-boton" @click="abrirModalDescuento(item)">
                    Descuento
                  </button>
                </div>
                <small v-if="item.codigoBarras" class="linea__codigo">Cod: {{ item.codigoBarras }}</small>
              </div>
              <div class="linea__acciones">
                <button type="button" @click.stop="actualizarCantidad(item.id, -1)">-</button>
                <input
                  v-model.number="item.cantidad"
                  type="number"
                  min="1"
                  step="1"
                  class="linea__cantidad"
                  @change="actualizarCantidad(item.id, 0)"
                />
                <button type="button" @click.stop="actualizarCantidad(item.id, 1)">+</button>
                <button type="button" class="linea__eliminar" @click.stop="eliminarItem(item.id)">×</button>
              </div>
              <div class="linea__totales">
                <strong>{{ formatCurrency(totalLinea(item)) }}</strong>
                <small v-if="item.descuentoPct || item.descuentoMonto" class="linea__precio-original">
                  Antes: {{ formatCurrency(calcularLinea(item).base) }}
                </small>
                <small v-if="item.descuentoPct || item.descuentoMonto">{{ resumenDescuentoLinea(item) }}</small>
                <small v-else class="linea__descuento-vacio">Sin descuento</small>
              </div>
            </div>
          </li>
          <li v-if="carrito.length === 0" class="linea lineavacia">Sin productos aun</li>
        </ul>
      </section>

      <div
        class="splitter"
        role="separator"
        aria-orientation="vertical"
        :aria-valuenow="Math.round(tamañoPanelProductos)"
        aria-valuemin="45"
        aria-valuemax="78"
        @mousedown="iniciarSplitter"
      >
        <span class="splitter__handle"></span>
      </div>

      <section class="panel detalle">
        <div class="detalle-venta">
          <label>
            <div class="tipo-pago" role="group" aria-label="Tipo de pago">
              <button
                type="button"
                class="tipo-pago__boton"
                :class="{ activo: tipoPago === 'efectivo' }"
                @click="tipoPago = 'efectivo'"
              >
                Efectivo
              </button>
              <button
                type="button"
                class="tipo-pago__boton"
                :class="{ activo: tipoPago === 'tarjeta' }"
                @click="tipoPago = 'tarjeta'"
              >
                Tarjeta
              </button>
              <button
                type="button"
                class="tipo-pago__boton"
                :class="{ activo: tipoPago === 'transferencia' }"
                @click="tipoPago = 'transferencia'"
              >
                Transferencia
              </button>
              <button
                type="button"
                class="tipo-pago__boton"
                :class="{ activo: tipoPago === 'credito' }"
                @click="tipoPago = 'credito'"
              >
                Credito
              </button>
              <button
                type="button"
                class="tipo-pago__boton"
                :class="{ activo: tipoPago === 'otro' }"
                @click="tipoPago = 'otro'"
              >
                Otro
              </button>
            </div>
          </label>
        </div>

        <div class="controles">
          <label>
            Pago recibido
            <input v-model.number="pagoRecibido" type="number" min="0" step="100" />
          </label>
          <label>
            Nota rápida
            <input v-model="notaRapida" type="text" placeholder="Mesa 4, domicilio, etc." />
          </label>
        </div>

        <dl class="totales">
          <div>
            <dt>Subtotal</dt>
            <dd>{{ formatCurrency(subtotalDetalle) }}</dd>
          </div>
          <div>
            <dt>Desc. productos</dt>
            <dd>-{{ formatCurrency(resumenCarrito.descuentoLineas) }}</dd>
          </div>
          <div class="total">
            <dt>Total</dt>
            <dd>{{ formatCurrency(resumenCarrito.total) }}</dd>
          </div>
          <div class="cambio">
            <dt>Cambio</dt>
            <dd>{{ formatCurrency(resumenCarrito.cambio) }}</dd>
          </div>
        </dl>

        <div class="acciones-finales">
          <span class="estado">{{ ultimaAccion }}</span>
          <div class="acciones-finales__botones">
            <button type="button" class="boton primario" @click="guardarVentaPendiente">Guardar venta</button>
            <button type="button" class="boton primario" @click="cerrarVenta">Cobrar F10</button>
          </div>
        </div>
        <pre v-if="mostrarPayloadVenta && payloadVenta" class="payload">
{{ JSON.stringify(payloadVenta, null, 2) }}
        </pre>
      </section>
    </section>

    <div
      v-if="mostrarTicketModal"
      class="modal"
      role="dialog"
      aria-modal="true"
      @click.self="mostrarTicketModal = false"
    >
      <section class="modal__contenido" @click.stop>
        <div class="modal__encabezado">
          <h2>Ticket</h2>
          <button type="button" class="modal__cerrar" @click="mostrarTicketModal = false">x</button>
        </div>
        <section class="ticket">
          <header class="ticket__header">
            <h3>Ticket</h3>
            <div class="ticket__acciones">
              <span>Vista previa</span>
              <button type="button" class="ticket__boton" @click="imprimirTicket">Imprimir</button>
              <button type="button" class="ticket__boton ticket__boton--secundario" @click="guardarTicket">
                Guardar PDF
              </button>
            </div>
          </header>
          <ul class="ticket__lineas">
            <li v-for="item in carrito" :key="item.id" class="ticket__linea">
              <span class="ticket__nombre">{{ item.nombre }}</span>
              <span class="ticket__cantidad">x{{ item.cantidad }}</span>
              <span class="ticket__importe">{{ formatCurrency(totalLinea(item)) }}</span>
            </li>
            <li v-if="carrito.length === 0" class="ticket__vacio">Sin productos aun</li>
          </ul>
          <div class="ticket__totales">
            <div>
              <span>Subtotal</span>
              <strong>{{ formatCurrency(resumenCarrito.subtotalBruto) }}</strong>
            </div>
            <div>
              <span>Impuesto</span>
              <strong>{{ formatCurrency(resumenCarrito.impuesto) }}</strong>
            </div>
            <div class="ticket__total">
              <span>Total</span>
              <strong>{{ formatCurrency(resumenCarrito.total) }}</strong>
            </div>
          </div>
        </section>
      </section>
    </div>

    <div
      v-if="descuentoItem"
      class="modal"
      role="dialog"
      aria-modal="true"
      @click.self="cerrarModalDescuento"
    >
      <section class="modal__contenido" @click.stop>
        <div class="modal__encabezado">
          <h2>Descuento</h2>
          <button type="button" class="modal__cerrar" @click="cerrarModalDescuento">x</button>
        </div>
        <p class="modal__subtitulo">{{ descuentoItem?.nombre }}</p>
        <div class="modal__form">
          <label>
            Desc. %
            <input v-model.number="descuentoItem.descuentoPct" type="number" min="0" max="100" step="1" />
          </label>
          <label>
            Desc. $
            <input v-model.number="descuentoItem.descuentoMonto" type="number" min="0" step="100" />
          </label>
        </div>
        <div class="modal__acciones">
          <button type="button" class="boton secundaria" @click="cerrarModalDescuento">Listo</button>
        </div>
      </section>
    </div>

    <div
      v-if="mostrarResumenCobro"
      class="modal"
      role="dialog"
      aria-modal="true"
      @click.self="mostrarResumenCobro = false"
    >
      <section class="modal__contenido" @click.stop>
        <div class="modal__encabezado">
          <h2>Resumen de cobro</h2>
          <button type="button" class="modal__cerrar" @click="mostrarResumenCobro = false">x</button>
        </div>
        <dl class="totales">
          <div>
            <dt>Subtotal</dt>
            <dd>{{ formatCurrency(resumenCobro.subtotal) }}</dd>
          </div>
          <div>
            <dt>Descuento</dt>
            <dd>-{{ formatCurrency(resumenCobro.descuento) }}</dd>
          </div>
          <div class="total">
            <dt>Total</dt>
            <dd>{{ formatCurrency(resumenCobro.total) }}</dd>
          </div>
          <div>
            <dt>Pago recibido</dt>
            <dd>{{ formatCurrency(resumenCobro.pagoRecibido) }}</dd>
          </div>
          <div class="cambio">
            <dt>Cambio</dt>
            <dd>{{ formatCurrency(resumenCobro.cambio) }}</dd>
          </div>
        </dl>
        <div class="modal__acciones">
          <button type="button" class="boton" @click="imprimirTicketResumen">Imprimir recibo</button>
          <button type="button" class="boton secundaria" @click="guardarTicketResumen">Guardar PDF</button>
          <button type="button" class="boton secundaria" @click="mostrarResumenCobro = false">Cerrar</button>
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>
.pos {
  display: grid;
  gap: 1.5rem;
}

.cabecera {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.cabecera__prefijo {
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.8rem;
  color: #94a3b8;
}

.cabecera h1 {
  margin: 0;
  font-size: clamp(1.8rem, 2.2vw, 2.4rem);
}

.cabecera__nota {
  margin: 0.2rem 0 0;
  color: #cbd5e1;
}

.cabecera__cliente {
  margin-top: 0.8rem;
  display: grid;
  gap: 0.35rem;
  color: #e2e8f0;
  font-weight: 600;
}

.cabecera__cliente select {
  border-radius: 0.9rem;
  border: 1px solid rgba(148, 163, 184, 0.3);
  padding: 0.7rem 0.9rem;
  background: rgba(2, 6, 23, 0.6);
  color: #e2e8f0;
}

.cabecera__chips {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.chip {
  background: rgba(120, 130, 140, 0.25);
  border: 1px solid rgba(148, 163, 184, 0.35);
  padding: 0.4rem 0.7rem;
  border-radius: 999px;
  color: #f8fafc;
  font-size: 0.9rem;
}

.chip--exito {
  background: rgba(250, 204, 21, 0.14);
  border-color: rgba(250, 204, 21, 0.35);
  color: #f8fafc;
}

.chip--online {
  background: rgba(34, 197, 94, 0.14);
  border-color: rgba(34, 197, 94, 0.4);
  color: #dcfce7;
}

.chip--offline {
  background: rgba(239, 68, 68, 0.14);
  border-color: rgba(239, 68, 68, 0.4);
  color: #fee2e2;
}

.layout {
  display: grid;
  grid-template-columns: 1.6fr 1fr;
  gap: 1rem;
}

.layout--split {
  align-items: stretch;
}

.panel {
  background: #0d0f14;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 1rem;
  padding: 1.25rem;
  box-shadow: 0 20px 55px rgba(0, 0, 0, 0.55);
  display: grid;
  gap: 1rem;
}

.splitter {
  position: relative;
  cursor: col-resize;
  border-radius: 1rem;
  background: rgba(148, 163, 184, 0.08);
  border: 1px solid rgba(148, 163, 184, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
}

.splitter__handle {
  width: 4px;
  height: 50px;
  border-radius: 999px;
  background: rgba(250, 204, 21, 0.7);
  box-shadow: 0 0 12px rgba(250, 204, 21, 0.6);
}

.productos {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-height: none;
}

.panel__encabezado {
  display: grid;
  gap: 0.8rem;
}

.panel__encabezado--carrito {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.buscador input {
  width: 100%;
  padding: 0.7rem 0.9rem;
  border-radius: 0.9rem;
  border: 1px solid rgba(148, 163, 184, 0.3);
  background: rgba(2, 6, 23, 0.6);
  color: #e2e8f0;
}

.sugerencias {
  margin: 0.4rem 0 0;
  padding: 0.4rem;
  list-style: none;
  border-radius: 0.9rem;
  border: 1px solid rgba(148, 163, 184, 0.25);
  background: rgba(10, 12, 18, 0.96);
  display: grid;
  gap: 0.35rem;
  max-height: 320px;
  overflow-y: auto;
}

.sugerencia {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.5rem 0.7rem;
  border-radius: 0.7rem;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(255, 255, 255, 0.03);
  color: #e2e8f0;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
}

.sugerencia:hover,
.sugerencia:focus-visible {
  outline: none;
  background: rgba(250, 204, 21, 0.12);
  border-color: rgba(250, 204, 21, 0.4);
  transform: translateY(-1px);
}

.sugerencia__precio {
  color: #facc15;
  font-weight: 700;
}

.categorias {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.35rem;
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.02);
}

.categoria {
  border: 1px solid rgba(148, 163, 184, 0.28);
  background: rgba(255, 255, 255, 0.04);
  border-radius: 0.9rem;
  padding: 0.5rem 1rem;
  color: #e2e8f0;
  cursor: pointer;
  transition: transform 0.15s ease, border-color 0.15s ease, background 0.15s ease;
}

.categoria.activa {
  border-color: rgba(250, 204, 21, 0.8);
  background: linear-gradient(120deg, rgba(250, 204, 21, 0.18), rgba(250, 204, 21, 0.32));
  color: #0b0d12;
  box-shadow: 0 6px 18px rgba(250, 204, 21, 0.25);
  transform: translateY(-1px) scale(1.01);
}

.categoria:not(.activa):hover,
.categoria:not(.activa):focus-visible {
  outline: none;
  border-color: rgba(226, 232, 240, 0.45);
  background: rgba(255, 255, 255, 0.07);
}

.carrito .lineas {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 0.5rem;
  overflow: visible;
}

.linea {
  display: grid;
  gap: 0.45rem;
  padding: 0.6rem 0.75rem;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 0.75rem;
  background: rgba(13, 15, 20, 0.9);
}

.linea__fila {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 0.6rem;
  align-items: center;
}

.lineavacia {
  text-align: center;
  color: #94a3b8;
  border-style: dashed;
}

.linea__titulo {
  margin: 0;
  font-weight: 700;
  font-size: 0.95rem;
}

.linea__principal {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
}

.linea__titulo {
  margin-right: auto;
}

.linea__precio {
  margin: 0.1rem 0 0;
  color: #94a3b8;
  font-size: 0.8rem;
}

.linea__codigo {
  display: block;
  color: #94a3b8;
  font-size: 0.75rem;
}

.linea__acciones {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.linea__acciones button {
  border: 1px solid rgba(148, 163, 184, 0.4);
  background: rgba(120, 126, 137, 0.12);
  color: #e2e8f0;
  width: 1.85rem;
  height: 1.85rem;
  border-radius: 0.6rem;
  cursor: pointer;
}

.linea__cantidad {
  width: 56px;
  text-align: center;
  border-radius: 0.6rem;
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: rgba(12, 13, 16, 0.92);
  color: #e2e8f0;
  padding: 0.2rem 0.35rem;
  font-weight: 600;
}

.linea__acciones .linea__eliminar {
  border-color: transparent;
  background: transparent;
  color: #ef4444 !important;
  font-size: 1.1rem;
  font-weight: 800;
  text-shadow: 0 0 8px rgba(239, 68, 68, 0.6);
}

.linea__totales {
  display: grid;
  gap: 0.2rem;
  justify-items: end;
  text-align: right;
}

.linea__totales small {
  color: #facc15;
  font-size: 0.75rem;
}

.linea__precio-original {
  color: #94a3b8;
  font-size: 0.7rem;
}

.linea__descuento-boton {
  border: 1px dashed rgba(148, 163, 184, 0.35);
  background: rgba(12, 13, 16, 0.6);
  color: #e2e8f0;
  border-radius: 0.6rem;
  padding: 0.2rem 0.6rem;
  font-size: 0.8rem;
  cursor: pointer;
}

.linea__descuento-vacio {
  color: #94a3b8;
  font-size: 0.75rem;
}

.controles {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
  padding-top: 0.25rem;
}

.detalle-venta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.9rem;
  padding-bottom: 0.25rem;
  border-bottom: 1px dashed rgba(148, 163, 184, 0.2);
}

.detalle-venta label {
  display: grid;
  gap: 0.25rem;
  color: #e2e8f0;
  font-weight: 600;
}

.detalle-venta input,
.detalle-venta select {
  border-radius: 0.75rem;
  border: 1px solid rgba(148, 163, 184, 0.3);
  padding: 0.6rem 0.8rem;
  background: rgba(12, 13, 16, 0.92);
  color: #e2e8f0;
}

.tipo-pago {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.detalle-venta .tipo-pago {
  grid-column: 1 / -1;
}

.tipo-pago__boton {
  border: 1px solid rgba(148, 163, 184, 0.3);
  background: rgba(12, 13, 16, 0.92);
  color: #e2e8f0;
  border-radius: 0.75rem;
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  font-weight: 600;
  transition: transform 0.15s ease, border-color 0.15s ease, background 0.15s ease;
}

.tipo-pago__boton.activo {
  border-color: rgba(250, 204, 21, 0.75);
  background: linear-gradient(120deg, rgba(250, 204, 21, 0.18), rgba(250, 204, 21, 0.32));
  color: #0b0d12;
  box-shadow: 0 6px 18px rgba(250, 204, 21, 0.25);
  transform: translateY(-1px);
}

.tipo-pago__boton:focus-visible {
  outline: none;
  border-color: rgba(250, 204, 21, 0.7);
}

.controles label {
  display: grid;
  gap: 0.25rem;
  color: #e2e8f0;
  font-weight: 600;
}

.controles input {
  border-radius: 0.75rem;
  border: 1px solid rgba(148, 163, 184, 0.3);
  padding: 0.6rem 0.8rem;
  background: rgba(12, 13, 16, 0.92);
  color: #e2e8f0;
}

.totales {
  margin: 0;
  padding: 0.6rem 0.75rem;
  display: grid;
  gap: 0.55rem;
  border-radius: 0.9rem;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(12, 13, 16, 0.65);
}

.totales div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.35rem 0.1rem;
  border-bottom: 1px dashed rgba(148, 163, 184, 0.2);
}

.totales dt,
.totales dd {
  margin: 0;
}

.totales .total {
  font-size: 1.25rem;
  font-weight: 700;
  color: #facc15;
}

.totales .cambio {
  color: #fef3c7;
}

.ticket {
  border: 1px dashed rgba(148, 163, 184, 0.35);
  border-radius: 0.85rem;
  padding: 0.9rem;
  background: rgba(12, 13, 16, 0.9);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  font-family: 'Courier New', Courier, monospace;
  height: 100%;
  overflow: hidden;
}

.ticket__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  border-bottom: 1px dashed rgba(148, 163, 184, 0.3);
  padding-bottom: 0.4rem;
}

.ticket__header h3 {
  margin: 0;
  font-size: 1rem;
}

.ticket__acciones {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.ticket__acciones span {
  color: #94a3b8;
  font-size: 0.8rem;
}

.ticket__boton {
  border: 1px solid rgba(148, 163, 184, 0.3);
  background: rgba(15, 18, 26, 0.9);
  color: #e2e8f0;
  border-radius: 0.6rem;
  padding: 0.25rem 0.6rem;
  cursor: pointer;
  font-size: 0.8rem;
}

.ticket__boton--secundario {
  border-color: rgba(250, 204, 21, 0.55);
  background: rgba(250, 204, 21, 0.14);
  color: #f8fafc;
}

.ticket__lineas {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.45rem;
  overflow-y: auto;
  flex: 1 1 auto;
}

.ticket__linea {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 0.5rem;
  align-items: center;
}

.ticket__nombre {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ticket__cantidad {
  color: #cbd5e1;
}

.ticket__importe {
  color: #facc15;
}

.ticket__vacio {
  text-align: center;
  color: #94a3b8;
}

.ticket__totales {
  display: grid;
  gap: 0.35rem;
  border-top: 1px dashed rgba(148, 163, 184, 0.3);
  padding-top: 0.5rem;
}

.ticket__totales div {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.ticket__total strong {
  color: #facc15;
}

.modal {
  position: fixed;
  inset: 0;
  background: rgba(8, 10, 14, 0.7);
  display: grid;
  place-items: center;
  padding: 1rem;
  z-index: 60;
}

.modal__contenido {
  width: min(520px, 92vw);
  max-height: 85vh;
  overflow: auto;
  background: #0b0d12;
  border-radius: 1rem;
  border: 1px solid rgba(148, 163, 184, 0.25);
  padding: 1rem;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.6);
}

.modal__encabezado {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.modal__encabezado h2 {
  margin: 0;
  font-size: 1.1rem;
}

.modal__subtitulo {
  margin: 0 0 0.75rem;
  color: #94a3b8;
  font-size: 0.9rem;
}

.modal__form {
  display: grid;
  gap: 0.6rem;
}

.modal__form label {
  display: grid;
  gap: 0.35rem;
  color: #e2e8f0;
  font-weight: 600;
}

.modal__form input {
  border-radius: 0.75rem;
  border: 1px solid rgba(148, 163, 184, 0.3);
  padding: 0.6rem 0.8rem;
  background: rgba(12, 13, 16, 0.92);
  color: #e2e8f0;
}

.modal__acciones {
  display: flex;
  justify-content: flex-end;
  margin-top: 0.9rem;
}

.modal__cerrar {
  border: 1px solid rgba(148, 163, 184, 0.3);
  background: rgba(15, 18, 26, 0.9);
  color: #e2e8f0;
  border-radius: 0.6rem;
  padding: 0.25rem 0.6rem;
  cursor: pointer;
}

.acciones-finales {
  display: grid;
  gap: 0.75rem;
  padding-top: 0.25rem;
}

.acciones-finales__botones {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.6rem;
}

.payload {
  margin: 0;
  padding: 0.75rem;
  border-radius: 0.75rem;
  border: 1px dashed rgba(148, 163, 184, 0.35);
  background: rgba(12, 13, 16, 0.9);
  color: #e2e8f0;
  font-size: 0.85rem;
  white-space: pre-wrap;
}

.estado {
  color: #e2e8f0;
  font-weight: 600;
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

.boton.primario {
  min-width: 150px;
  text-align: center;
}

.botonera {
  display: flex;
  gap: 0.5rem;
}

@media (max-width: 1100px) {
  .layout {
    grid-template-columns: 1fr 1fr;
  }

  .layout--split {
    grid-template-columns: 1fr !important;
  }

  .splitter {
    display: none;
  }
}

@media (max-width: 640px) {
  .layout {
    grid-template-columns: 1fr;
  }

  .cabecera {
    flex-direction: column;
  }

  .panel__encabezado--carrito {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.6rem;
  }

  .acciones-finales {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>


