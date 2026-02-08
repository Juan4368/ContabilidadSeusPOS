<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import SessionRoleChip from '../components/SessionRoleChip.vue'
import { ENDPOINTS } from '../config/endpoints'

type ResumenVenta = {
  id?: number
  fecha: string
  numero_factura: string
  cliente_nombre: string
  subtotal: string
  descuento: string
  total: string
  tipo_pago: string | null
  es_credito: boolean
  nota_venta: string | null
  usuario_nombre: string | null
  estado?: boolean
}

type DetalleVenta = {
  id?: number
  producto_nombre: string
  producto_id?: number
  cantidad: number
  precio_unitario: number
  subtotal: number
  descuento: number
}

type VentaDetalleRespuesta = {
  venta_id?: number
  numero_factura: string
  fecha: string
  cliente_nombre: string
  total: number
  detalles: DetalleVenta[]
}

const resumenes = ref<ResumenVenta[]>([])
const cargando = ref(false)
const error = ref<string | null>(null)
const detalleVenta = ref<VentaDetalleRespuesta | null>(null)
const errorDetalle = ref<string | null>(null)
const cargandoDetalle = ref(false)

const formatearMoneda = (valor: string) => {
  const numero = Number(valor ?? 0)
  return Number.isFinite(numero)
    ? numero.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })
    : valor
}

const tipoPagoLabel = (item: ResumenVenta) => {
  if (item.es_credito && !item.tipo_pago) return 'credito'
  return item.tipo_pago ?? 'sin definir'
}

const formatFechaCorta = (valor: string) => {
  const fecha = new Date(valor)
  if (Number.isNaN(fecha.getTime())) return valor
  const pad = (num: number) => num.toString().padStart(2, '0')
  return `${pad(fecha.getDate())}-${pad(fecha.getMonth() + 1)}-${fecha.getFullYear()} ${pad(
    fecha.getHours()
  )}:${pad(fecha.getMinutes())}`
}

const resumenOrdenado = computed(() =>
  [...resumenes.value]
    .filter((item) => item.estado === true)
    .sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0))
)

const resumenPagos = computed(() => {
  const totales = {
    efectivo: 0,
    transferencia: 0,
    credito: 0
  }
  resumenes.value.forEach((item) => {
    const total = Number(item.total ?? 0)
    if (!Number.isFinite(total)) return
    if (item.es_credito && !item.tipo_pago) {
      totales.credito += total
      return
    }
    const tipo = (item.tipo_pago ?? '').toString().toLowerCase()
    if (tipo.includes('efectivo')) {
      totales.efectivo += total
    } else if (tipo.includes('transfer')) {
      totales.transferencia += total
    } else if (tipo.includes('credito') || item.es_credito) {
      totales.credito += total
    }
  })
  return totales
})

const totalVentas = computed(() =>
  resumenes.value.reduce((total, item) => total + Number(item.total ?? 0), 0)
)

const cargarResumen = async () => {
  cargando.value = true
  error.value = null
  try {
    const respuesta = await fetch(ENDPOINTS.VENTAS_RESUMEN)
    if (!respuesta.ok) {
      const detalle = await respuesta.text().catch(() => '')
      throw new Error(detalle || `Error ${respuesta.status}`)
    }
    const data = (await respuesta.json()) as unknown
    const lista = (Array.isArray(data)
      ? data
      : Array.isArray((data as Record<string, unknown>)?.results)
        ? (data as Record<string, unknown>).results
        : Array.isArray((data as Record<string, unknown>)?.data)
          ? (data as Record<string, unknown>).data
          : []) as unknown[]
    resumenes.value = lista
      .map((item: unknown) => {
        if (!item || typeof item !== 'object') return null
        const raw = item as Record<string, unknown>
        return {
          id: Number(raw.venta_id ?? raw.id ?? raw.pk ?? 0) || undefined,
          fecha: String(raw.fecha ?? ''),
          numero_factura: String(raw.numero_factura ?? ''),
          cliente_nombre: String(raw.cliente_nombre ?? ''),
          subtotal: String(raw.subtotal ?? '0'),
          descuento: String(raw.descuento ?? '0'),
          total: String(raw.total ?? '0'),
          tipo_pago: raw.tipo_pago ? String(raw.tipo_pago) : null,
          es_credito: Boolean(raw.es_credito),
          nota_venta: raw.nota_venta ? String(raw.nota_venta) : null,
          usuario_nombre: raw.usuario_nombre ? String(raw.usuario_nombre) : null,
          estado: raw.estado === false || raw.estado === 'inactivo' ? false : true
        } as ResumenVenta
      })
      .filter(Boolean) as ResumenVenta[]
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err)
    error.value = `No fue posible cargar el resumen. ${detalle}`
  } finally {
    cargando.value = false
  }
}

const actualizarEstadoVenta = async (item: ResumenVenta) => {
  try {
    let ventaId = item.id
    if (!ventaId) {
      const numeroFactura = String(item.numero_factura ?? '').trim()
      if (!numeroFactura) {
        throw new Error('No se puede actualizar: falta el id de la venta.')
      }
      const respuestaBusqueda = await fetch(
        `${ENDPOINTS.VENTAS_LOCAL}?numero_factura=${encodeURIComponent(numeroFactura)}`
      )
      if (!respuestaBusqueda.ok) {
        const detalle = await respuestaBusqueda.text().catch(() => '')
        throw new Error(detalle || `Error ${respuestaBusqueda.status}`)
      }
      const data = (await respuestaBusqueda.json()) as unknown
      const venta = Array.isArray(data) ? (data[0] as Record<string, unknown> | undefined) : undefined
      ventaId = venta ? Number(venta.venta_id ?? venta.id ?? 0) || undefined : undefined
      if (!ventaId) {
        throw new Error('No se pudo encontrar el id de la venta.')
      }
      item.id = ventaId
    }
    const estadoNuevo = item.estado === false ? true : false
    const endpoints = [
      `${ENDPOINTS.VENTAS_LOCAL}${item.id}/estado`,
      `${ENDPOINTS.VENTAS_LOCAL}${item.id}`
    ]
    let respuesta: Response | null = null
    let detalleError = ''
    for (const endpoint of endpoints) {
      respuesta = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: estadoNuevo, activo: estadoNuevo, is_active: estadoNuevo })
      })
      if (respuesta.ok) {
        detalleError = ''
        break
      }
      detalleError = await respuesta.text().catch(() => '')
    }
    if (!respuesta?.ok) {
      throw new Error(detalleError || `Error ${respuesta?.status ?? 'desconocido'}`)
    }
    item.estado = estadoNuevo
    const index = resumenes.value.findIndex((venta) => venta.id === item.id)
    if (index >= 0) {
      resumenes.value[index].estado = estadoNuevo
    }
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err)
    error.value = `No fue posible actualizar el estado. ${detalle}`
  }
}

const extraerDetalle = (venta: Record<string, unknown>): VentaDetalleRespuesta => {
  const detallesRaw = venta.detalles
  const detalles = Array.isArray(detallesRaw)
    ? detallesRaw
        .map((item) => {
          if (!item || typeof item !== 'object') return null
          const raw = item as Record<string, unknown>
          return {
            id: Number(raw.id ?? raw.detalle_id ?? raw.venta_detalle_id ?? 0) || undefined,
            producto_nombre: String(raw.producto_nombre ?? raw.nombre ?? ''),
            producto_id: Number(raw.producto_id ?? raw.productoId ?? 0) || undefined,
            cantidad: Number(raw.cantidad ?? 0),
            precio_unitario: Number(raw.precio_unitario ?? raw.precio ?? 0),
            subtotal: Number(raw.subtotal ?? 0),
            descuento: Number(raw.descuento ?? raw.descuento_monto ?? raw.descuentoMonto ?? 0)
          }
        })
        .filter(Boolean) as DetalleVenta[]
    : []
  return {
    venta_id: Number(venta.venta_id ?? venta.id ?? 0) || undefined,
    numero_factura: String(venta.numero_factura ?? ''),
    fecha: String(venta.fecha ?? ''),
    cliente_nombre: String(venta.cliente_nombre ?? ''),
    total: Number(venta.total ?? 0),
    detalles
  }
}

const cargarDetalle = async (item: ResumenVenta) => {
  cargandoDetalle.value = true
  errorDetalle.value = null
  detalleVenta.value = {
    venta_id: item.id,
    numero_factura: item.numero_factura,
    fecha: item.fecha,
    cliente_nombre: item.cliente_nombre,
    total: Number(item.total ?? 0),
    detalles: []
  }
  try {
    const numeroFactura = String(item.numero_factura ?? '').trim()
    const id = item.id
    const endpointDirecto = id ? `${ENDPOINTS.VENTAS_LOCAL}${id}` : `${ENDPOINTS.VENTAS_LOCAL}${encodeURIComponent(numeroFactura)}`
    let respuesta = await fetch(endpointDirecto)
    if (!respuesta.ok && numeroFactura) {
      const endpointBusqueda = `${ENDPOINTS.VENTAS_LOCAL}?numero_factura=${encodeURIComponent(numeroFactura)}`
      respuesta = await fetch(endpointBusqueda)
    }
    if (!respuesta.ok) {
      const detalle = await respuesta.text().catch(() => '')
      throw new Error(detalle || `Error ${respuesta.status}`)
    }
    const data = (await respuesta.json()) as unknown
    const venta = Array.isArray(data) ? (data[0] as Record<string, unknown> | undefined) : (data as Record<string, unknown>)
    if (!venta) {
      throw new Error('No se encontraron detalles de la venta.')
    }
    const ventaId = Number(venta.venta_id ?? venta.id ?? 0) || 0
    const detalle = extraerDetalle(venta)
    // Fallback: algunos endpoints devuelven solo cabecera y los detalles en otra ruta
    if (!detalle.detalles.length && ventaId) {
      const respuestaDetalle = await fetch(`${ENDPOINTS.VENTAS_LOCAL}${ventaId}/detalles`)
      if (respuestaDetalle.ok) {
        const dataDetalle = (await respuestaDetalle.json()) as unknown
        const listaDetalle = (Array.isArray(dataDetalle)
          ? dataDetalle
          : Array.isArray((dataDetalle as Record<string, unknown>)?.results)
            ? (dataDetalle as Record<string, unknown>).results
            : Array.isArray((dataDetalle as Record<string, unknown>)?.data)
              ? (dataDetalle as Record<string, unknown>).data
              : []) as unknown[]
        detalle.detalles = listaDetalle
          .map((item: unknown) => {
            if (!item || typeof item !== 'object') return null
            const raw = item as Record<string, unknown>
            return {
              id: Number(raw.id ?? raw.detalle_id ?? raw.venta_detalle_id ?? 0) || undefined,
              producto_nombre: String(raw.producto_nombre ?? raw.nombre ?? ''),
              producto_id: Number(raw.producto_id ?? raw.productoId ?? 0) || undefined,
              cantidad: Number(raw.cantidad ?? 0),
              precio_unitario: Number(raw.precio_unitario ?? raw.precio ?? 0),
              subtotal: Number(raw.subtotal ?? 0),
              descuento: Number(raw.descuento ?? raw.descuento_monto ?? raw.descuentoMonto ?? 0)
            }
          })
          .filter(Boolean) as DetalleVenta[]
      }
    }
    detalleVenta.value = detalle
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err)
    errorDetalle.value = `No fue posible cargar el detalle. ${detalle}`
  } finally {
    cargandoDetalle.value = false
  }
}

const cerrarDetalle = () => {
  detalleVenta.value = null
  errorDetalle.value = null
}

const eliminarDetalle = async (detalle: DetalleVenta) => {
  if (!detalleVenta.value) return
  const ventaIdFinal = Number(detalleVenta.value.venta_id ?? 0) || 0
  const productoId = detalle.producto_id ?? detalle.id
  const detalleId = productoId
  if (!ventaIdFinal || !detalleId) {
    errorDetalle.value = 'No se pudo identificar la venta o el detalle.'
    return
  }
  try {
    const respuesta = await fetch(`${ENDPOINTS.VENTAS_LOCAL}${ventaIdFinal}/detalles/${detalleId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ venta_id: ventaIdFinal, producto_id: productoId })
    })
    if (!respuesta.ok) {
      const detalleError = await respuesta.text().catch(() => '')
      throw new Error(detalleError || `Error ${respuesta.status}`)
    }
    detalleVenta.value.detalles = detalleVenta.value.detalles.filter((item) => item !== detalle)
    if (detalleVenta.value.detalles.length === 0) {
      const ventaId = detalleVenta.value.venta_id
      if (!ventaId) {
        errorDetalle.value = 'No se pudo actualizar estado: falta el id de la venta.'
        return
      }
      const respuestaEstado = await fetch(`${ENDPOINTS.VENTAS_LOCAL}${ventaId}/estado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: false, activo: false, is_active: false })
      })
      if (!respuestaEstado.ok) {
        const detalleError = await respuestaEstado.text().catch(() => '')
        throw new Error(detalleError || `Error ${respuestaEstado.status}`)
      }
      const index = resumenes.value.findIndex((venta) => venta.id === ventaId)
      if (index >= 0) {
        resumenes.value[index].estado = false
      }
    }
  } catch (err) {
    const detalleError = err instanceof Error ? err.message : String(err)
    errorDetalle.value = `No fue posible eliminar el detalle. ${detalleError}`
  }
}
onMounted(() => {
  void cargarResumen()
})
</script>

<template>
  <main class="resumen">
    <header class="resumen__cabecera">
      <div>
        <h1>Total ventas: {{ formatearMoneda(String(totalVentas)) }}</h1>
      </div>
      <div class="resumen__acciones">
        <SessionRoleChip />
        <button type="button" class="boton secundario" @click="cargarResumen" :disabled="cargando">
          {{ cargando ? 'Actualizando...' : 'Actualizar' }}
        </button>
      </div>
    </header>

    <p v-if="error" class="error">{{ error }}</p>

    <section class="resumen__tarjetas">
      <article class="tarjeta">
        <div>
          <p class="tarjeta__titulo">Efectivo</p>
          <p class="tarjeta__valor">{{ formatearMoneda(String(resumenPagos.efectivo)) }}</p>
          <p class="tarjeta__detalle">Ventas en efectivo</p>
        </div>
        <span class="tarjeta__estado tarjeta__estado--resumen">resumen</span>
      </article>
      <article class="tarjeta">
        <div>
          <p class="tarjeta__titulo">Transferencia</p>
          <p class="tarjeta__valor">{{ formatearMoneda(String(resumenPagos.transferencia)) }}</p>
          <p class="tarjeta__detalle">Ventas por transferencia</p>
        </div>
        <span class="tarjeta__estado tarjeta__estado--resumen">resumen</span>
      </article>
      <article class="tarjeta">
        <div>
          <p class="tarjeta__titulo">Credito</p>
          <p class="tarjeta__valor">{{ formatearMoneda(String(resumenPagos.credito)) }}</p>
          <p class="tarjeta__detalle">Ventas a credito</p>
        </div>
        <span class="tarjeta__estado tarjeta__estado--resumen">resumen</span>
      </article>
    </section>

    <section class="tabla tabla--modulo">
      <div v-if="!cargando && resumenOrdenado.length === 0" class="vacio">Sin datos para mostrar.</div>
      <table class="tabla__grid" v-else>
        <colgroup>
        <col style="width: 10%" />
        <col style="width: 10%" />
        <col style="width: 10%" />
        <col style="width: 10%" />
        <col style="width: 10%" />
        <col style="width: 10%" />
        <col style="width: 10%" />
        <col style="width: 10%" />
        <col style="width: 10%" />
        <col style="width: 10%" />
      </colgroup>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Factura</th>
            <th>Cliente</th>
            <th>Subtotal</th>
            <th>Descuento</th>
            <th>Total</th>
            <th>Tipo pago</th>
            <th>Usuario</th>
            <th>Estado</th>
            <th class="th-accion"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in resumenOrdenado" :key="`${item.numero_factura}-${item.fecha}`">
            <td>{{ formatFechaCorta(item.fecha) }}</td>
            <td>{{ item.numero_factura }}</td>
            <td>{{ item.cliente_nombre }}</td>
            <td class="col-num">{{ formatearMoneda(item.subtotal) }}</td>
            <td class="col-num">{{ formatearMoneda(item.descuento) }}</td>
            <td class="col-num total">{{ formatearMoneda(item.total) }}</td>
            <td class="col-centro">
              <span class="chip" :class="{ credito: item.es_credito }">{{ tipoPagoLabel(item) }}</span>
            </td>
            <td>{{ item.usuario_nombre || 'Sin usuario' }}</td>
            <td class="col-centro">
              <button type="button" class="boton boton--estado" @click="actualizarEstadoVenta(item)">
                {{ item.estado === false ? 'Inactiva' : 'Activa' }}
              </button>
            </td>
            <td class="col-accion">
              <button type="button" class="boton boton--detalle" @click="cargarDetalle(item)">Ver detalle</button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <div v-if="detalleVenta" class="modal" role="dialog" aria-modal="true" @click.self="cerrarDetalle">
      <section class="modal__contenido" @click.stop>
        <div class="modal__encabezado">
          <h2>Detalle de cuenta</h2>
          <button type="button" class="modal__cerrar" @click="cerrarDetalle">x</button>
        </div>
        <div class="detalle">
          <div>
            <p class="detalle__titulo">{{ detalleVenta.cliente_nombre }}</p>
            <p class="detalle__nota">Factura {{ detalleVenta.numero_factura }}</p>
            <p class="detalle__nota">{{ formatFechaCorta(detalleVenta.fecha) }}</p>
          </div>
          <div class="detalle__totales">
            <p class="detalle__label">Total</p>
            <p class="detalle__valor">{{ formatearMoneda(String(detalleVenta.total)) }}</p>
          </div>
        </div>
        <p v-if="errorDetalle" class="error">{{ errorDetalle }}</p>
        <div v-if="cargandoDetalle" class="vacio">Cargando detalle...</div>
        <ul v-else class="lista detalle-lista">
          <li v-for="(item, index) in detalleVenta.detalles" :key="`${item.producto_nombre}-${index}`">
            <div class="detalle-item">
              <div>
                <strong>{{ item.producto_nombre || 'Producto' }}</strong>
                <small>Cantidad: {{ item.cantidad }}</small>
                <small>Descuento: {{ formatearMoneda(String(item.descuento)) }}</small>
              </div>
              <div class="detalle-item__acciones">
                <span class="detalle-item__total">{{ formatearMoneda(String(item.subtotal)) }}</span>
                <button type="button" class="detalle-item__eliminar" @click="eliminarDetalle(item)">Eliminar</button>
              </div>
            </div>
          </li>
        </ul>
      </section>
    </div>
  </main>
</template>

<style scoped>
.resumen {
  display: grid;
  gap: 1.5rem;
}

.resumen__cabecera {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  padding: 1rem 1.2rem;
  border-radius: 1rem;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(10, 11, 14, 0.85);
}

.resumen__prefijo {
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.8rem;
  color: #94a3b8;
}

.resumen__nota {
  margin: 0.35rem 0 0;
  color: #cbd5e1;
}

.resumen__acciones {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.resumen__tarjetas {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.tarjeta {
  background: #0d0f14;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 1rem;
  padding: 1rem 1.2rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.tarjeta__titulo {
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.8rem;
  color: #94a3b8;
}

.tarjeta__valor {
  margin: 0.35rem 0;
  font-size: 1.4rem;
  font-weight: 700;
  color: #facc15;
}

.tarjeta__detalle {
  margin: 0;
  color: #cbd5e1;
  font-size: 0.9rem;
}

.tarjeta__estado {
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: rgba(120, 126, 137, 0.12);
  color: #e2e8f0;
  text-transform: uppercase;
  font-size: 0.7rem;
  letter-spacing: 0.08em;
}

.tarjeta__estado--resumen {
  border-color: rgba(250, 204, 21, 0.45);
  background: rgba(250, 204, 21, 0.12);
  color: #fef3c7;
}

.tabla {
  display: grid;
  gap: 0;
}

.tabla--modulo {
  padding: 0.75rem;
  border-radius: 1rem;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(13, 15, 20, 0.88);
}

.tabla__grid {
  width: 100%;
  border-collapse: collapse;
  color: #e2e8f0;
  font-size: 0.9rem;
  table-layout: fixed;
  min-width: 900px;
}

.tabla__grid thead th {
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-size: 0.75rem;
  font-weight: 700;
  color: #94a3b8;
  background: rgba(15, 18, 26, 0.95);
  padding: 0.6rem 0.75rem;
  text-align: left;
  white-space: nowrap;
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
}

.th-accion {
  text-align: right;
}

.tabla__grid tbody td {
  padding: 0.6rem 0.75rem;
  border-bottom: 1px solid rgba(148, 163, 184, 0.12);
  background: rgba(13, 15, 20, 0.9);
}

.tabla__grid tbody tr:last-child td {
  border-bottom: none;
}

.col-num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.col-centro {
  text-align: center;
}

.col-accion {
  text-align: right;
  white-space: nowrap;
}

.total {
  color: #facc15;
  font-weight: 700;
}

.chip {
  justify-self: start;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.3);
  background: rgba(120, 126, 137, 0.12);
  text-transform: capitalize;
}

.chip.credito {
  border-color: rgba(250, 204, 21, 0.6);
  background: rgba(250, 204, 21, 0.12);
  color: #fef3c7;
}

.error {
  color: #f87171;
  margin: 0;
}

.vacio {
  padding: 0.8rem;
  text-align: center;
  color: #94a3b8;
}

.boton {
  border: none;
  border-radius: 0.75rem;
  padding: 0.55rem 0.9rem;
  font-weight: 700;
  cursor: pointer;
  color: #0b0d12;
  background: linear-gradient(120deg, #facc15, #fbbf24);
}

.boton.secundario {
  background: rgba(120, 126, 137, 0.2);
  color: #e2e8f0;
  border: 1px solid rgba(148, 163, 184, 0.3);
}

.boton--detalle {
  background: rgba(120, 126, 137, 0.2);
  color: #e2e8f0;
  border: 1px solid rgba(148, 163, 184, 0.3);
  padding: 0.35rem 0.6rem;
  font-size: 0.8rem;
}

.boton--estado {
  background: rgba(15, 18, 26, 0.9);
  color: #e2e8f0;
  border: 1px solid rgba(148, 163, 184, 0.35);
  padding: 0.3rem 0.6rem;
  font-size: 0.75rem;
}

.modal {
  position: fixed;
  inset: 0;
  background: rgba(3, 4, 7, 0.7);
  display: grid;
  place-items: center;
  padding: 1.5rem;
  z-index: 50;
}

.modal__contenido {
  padding: 1.4rem 1.6rem;
  border-radius: 1.2rem;
  border: 1px solid rgba(148, 163, 184, 0.22);
  background: rgba(10, 11, 14, 0.96);
  width: min(720px, 92vw);
  margin: 0 auto;
  max-height: calc(100vh - 4rem);
  overflow-y: auto;
  color: #e2e8f0;
}

.modal__encabezado {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.modal__cerrar {
  border: none;
  background: rgba(148, 163, 184, 0.18);
  color: #f8fafc;
  border-radius: 0.6rem;
  width: 2rem;
  height: 2rem;
  font-size: 1.2rem;
  cursor: pointer;
}

.detalle__meta {
  margin: 0 0 0.75rem;
  color: #cbd5e1;
}

.detalle__lista {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.4rem;
}

.detalle__lista li {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 0.6rem;
  padding: 0.5rem 0.6rem;
  border-radius: 0.7rem;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: #0f1015;
}

.detalle__total {
  margin-top: 0.8rem;
  text-align: right;
}

.detalle {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.detalle__titulo {
  margin: 0 0 0.3rem;
  font-weight: 700;
  color: #f8fafc;
}

.detalle__nota {
  margin: 0;
  color: #94a3b8;
  font-size: 0.9rem;
}

.detalle__label {
  margin: 0;
  color: #94a3b8;
  font-size: 0.85rem;
}

.detalle__valor {
  margin: 0 0 0.4rem;
  font-weight: 700;
  color: #facc15;
}

.lista {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.6rem;
}

.detalle-lista li {
  padding: 0.65rem 0.75rem;
  border-radius: 0.9rem;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(15, 16, 21, 0.9);
}

.detalle-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.8rem;
}

.detalle-item small {
  display: block;
  margin-top: 0.15rem;
  color: #94a3b8;
}

.detalle-item__total {
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  border: 1px solid rgba(34, 197, 94, 0.4);
  background: rgba(34, 197, 94, 0.18);
  color: #bbf7d0;
  font-weight: 600;
}

.detalle-item__acciones {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.detalle-item__eliminar {
  border: 1px solid rgba(248, 113, 113, 0.5);
  background: rgba(248, 113, 113, 0.15);
  color: #fecaca;
  border-radius: 0.6rem;
  padding: 0.2rem 0.5rem;
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 600;
}

@media (max-width: 1024px) {
  .tabla__grid {
    display: block;
    overflow-x: auto;
    white-space: nowrap;
  }
  .detalle {
    flex-direction: column;
  }
}
</style>
