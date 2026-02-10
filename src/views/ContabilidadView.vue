<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import { crearMovimientoFinanciero, type MovimientoFinancieroPayload } from '../services/movimientosFinancieros'
import { ENDPOINTS } from '../config/endpoints'
import { getSessionUserId } from '../utils/session'
import { fromLocalInputToUTCMinus5Iso, toLocalInputUTCMinus5 } from '../utils/time'

const resumen = [
  { titulo: 'Ingresos', valor: '$ 0', detalle: 'Mes actual', estado: 'estable' },
  { titulo: 'Egresos', valor: '$ 0', detalle: 'Mes actual', estado: 'estable' },
  { titulo: 'Cartera', valor: '$ 0', detalle: 'Cobros pendientes', estado: 'pendiente' }
]

const acciones = [
  { titulo: 'Entradas y salidas', descripcion: '' },
  { titulo: 'Reportes', descripcion: 'Resumenes y cortes.' }
]

const mostrarFormularioMovimiento = ref(false)
const mostrarFormularioCategoria = ref(false)
const categoriasHabilitadas = false

const mensaje = ref<string | null>(null)
const mensajeTipo = ref<'exito' | 'error' | null>(null)

type CategoriaContable = {
  id: number
  nombre: string
  codigo: string
}

type Proveedor = {
  id: number
  nombre: string
}

type MovimientoEgreso = {
  id: number
  fecha: string
  fecha_dia_hora?: string
  monto: string
  concepto: string
  nota: string
  proveedor_nombre?: string
  proveedor_id?: number | null
  caja_id?: number | null
  usuario_id?: number | null
  usuario_nombre?: string
  venta_id?: number | null
  tipo?: string
}

const categoriasContables = ref<CategoriaContable[]>([])
const cargandoCategorias = ref(false)
const errorCategorias = ref<string | null>(null)

const proveedores = ref<Proveedor[]>([])
const cargandoProveedores = ref(false)
const errorProveedores = ref<string | null>(null)
const ultimaCargaProveedores = ref(0)

const egresos = ref<MovimientoEgreso[]>([])
const cargandoEgresos = ref(false)
const errorEgresos = ref<string | null>(null)
const editandoEgreso = ref<MovimientoEgreso | null>(null)
const fechaHoy = () => {
  const hoy = new Date()
  const pad = (num: number) => num.toString().padStart(2, '0')
  return `${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}-${pad(hoy.getDate())}`
}

const filtroFechaDesde = ref(fechaHoy())
const filtroFechaHasta = ref(fechaHoy())
const filtroProveedorId = ref(0)
const editandoEgresoForm = ref({
  fecha: toLocalInputUTCMinus5(new Date()),
  tipo: 'EGRESO',
  monto: 0,
  concepto: '',
  nota: '',
  proveedor_id: 0,
  caja_id: 0,
  usuario_id: 0,
  venta_id: 0
})
const guardandoEgreso = ref(false)

const formularioMovimiento = ref<MovimientoFinancieroPayload>({
  fecha: toLocalInputUTCMinus5(new Date()),
  tipo: 'EGRESO',
  monto: 0,
  concepto: '',
  nota: '',
  proveedor_id: 0,
  caja_id: 1,
  usuario_id: getSessionUserId() ?? 0,
  venta_id: null
})

const formatCurrencyInput = (valor: number) =>
  Math.max(Number(valor || 0), 0).toLocaleString('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  })

const montoMovimientoInput = computed(() => formatCurrencyInput(formularioMovimiento.value.monto))

const formatearMoneda = (valor: string | number) => {
  const numero = Number(valor ?? 0)
  return Number.isFinite(numero)
    ? numero.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })
    : String(valor)
}

const totalEgresos = computed(() =>
  egresos.value.reduce((total, item) => total + Number(item.monto ?? 0), 0)
)

const egresosHoy = computed(() => {
  const hoy = fechaHoy()
  const desde = new Date(`${hoy}T00:00:00`)
  const hasta = new Date(`${hoy}T23:59:59`)
  return egresos.value.filter((item) => {
    const fechaRaw = item.fecha_dia_hora || item.fecha
    const fecha = fechaRaw ? new Date(fechaRaw) : null
    if (!fecha) return false
    return fecha >= desde && fecha <= hasta
  })
})

const totalEgresosHoy = computed(() =>
  egresosHoy.value.reduce((total, item) => total + Number(item.monto ?? 0), 0)
)

const egresosFiltrados = computed(() => {
  const desde = filtroFechaDesde.value ? new Date(`${filtroFechaDesde.value}T00:00:00`) : null
  const hasta = filtroFechaHasta.value ? new Date(`${filtroFechaHasta.value}T23:59:59`) : null
  const proveedorId = Number(filtroProveedorId.value || 0)

  return egresos.value.filter((item) => {
    const fechaRaw = item.fecha_dia_hora || item.fecha
    const fecha = fechaRaw ? new Date(fechaRaw) : null
    if (desde && (!fecha || fecha < desde)) return false
    if (hasta && (!fecha || fecha > hasta)) return false
    if (proveedorId > 0 && Number(item.proveedor_id ?? 0) !== proveedorId) return false
    return true
  })
})

const totalEgresosFiltrados = computed(() =>
  egresosFiltrados.value.reduce((total, item) => total + Number(item.monto ?? 0), 0)
)

const detalleFiltro = computed(() => {
  const desde = filtroFechaDesde.value?.trim()
  const hasta = filtroFechaHasta.value?.trim()
  if (desde && hasta) {
    if (desde === hasta) return `Día ${desde}`
    return `Rango ${desde} - ${hasta}`
  }
  if (desde) return `Desde ${desde}`
  if (hasta) return `Hasta ${hasta}`
  return 'Sin filtro'
})

const normalizarNota = (valor?: string) =>
  (valor ?? '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

const montoCaja = (item: MovimientoEgreso) => {
  const nota = normalizarNota(item.nota)
  if (nota.includes('rinonera')) return 0
  return nota.includes('caja') ? Number(item.monto ?? 0) : 0
}

const montoRinonera = (item: MovimientoEgreso) => {
  const nota = normalizarNota(item.nota)
  return nota.includes('rinonera') ? Number(item.monto ?? 0) : 0
}

const totalCaja = computed(() =>
  egresosFiltrados.value.reduce((acc, item) => acc + montoCaja(item), 0)
)

const totalRinonera = computed(() =>
  egresosFiltrados.value.reduce((acc, item) => acc + montoRinonera(item), 0)
)

const actualizarMontoMovimiento = (event: Event) => {
  const value = (event.target as HTMLInputElement).value
  const limpio = value.replace(/\D+/g, '')
  formularioMovimiento.value.monto = Number(limpio || 0)
}

const guardandoMovimiento = ref(false)
const errorMovimiento = ref<string | null>(null)
const payloadMovimiento = ref<string | null>(null)

const guardandoCategoria = ref(false)
const errorCategoria = ref<string | null>(null)
const formularioCategoria = ref({
  nombre: '',
  codigo: ''
})
const codigoAutoCategoria = ref<string | null>(null)
const registrarMovimiento = async () => {
  guardandoMovimiento.value = true
  errorMovimiento.value = null
  mensaje.value = null
  mensajeTipo.value = null
  const usuarioSesion = getSessionUserId()
  if (!usuarioSesion) {
    errorMovimiento.value = 'No se pudo identificar el usuario de la sesion.'
    guardandoMovimiento.value = false
    return
  }
  if (formularioMovimiento.value.monto <= 0) {
    errorMovimiento.value = 'El monto debe ser mayor a cero.'
    guardandoMovimiento.value = false
    return
  }
  const fechaIso = fromLocalInputToUTCMinus5Iso(formularioMovimiento.value.fecha)
  const ventaId = formularioMovimiento.value.venta_id
  const payload: MovimientoFinancieroPayload = {
    ...formularioMovimiento.value,
    fecha: fechaIso,
    usuario_id: usuarioSesion,
    venta_id: ventaId && ventaId > 0 ? ventaId : null
  }
  try {
    const respuesta = await crearMovimientoFinanciero(payload)
    if ((respuesta as { offline?: boolean } | undefined)?.offline) {
      mensaje.value = 'Movimiento guardado (pendiente de sincronizar).'
      mensajeTipo.value = 'exito'
    } else {
      mensaje.value = 'Movimiento guardado correctamente.'
      mensajeTipo.value = 'exito'
    }
    formularioMovimiento.value = {
      fecha: toLocalInputUTCMinus5(new Date()),
      tipo: 'EGRESO',
      monto: 0,
      concepto: '',
      nota: '',
      proveedor_id: 0,
      caja_id: 1,
      usuario_id: getSessionUserId() ?? 0,
      venta_id: null
    }
  } catch (err) {
    console.error('Error al registrar movimiento', err)
    const detalle = err instanceof Error ? err.message : String(err)
    errorMovimiento.value = `No fue posible registrar el movimiento. ${detalle}`
    mensaje.value = 'No fue posible guardar el movimiento.'
    mensajeTipo.value = 'error'
  } finally {
    payloadMovimiento.value = null
    guardandoMovimiento.value = false
  }
}

const cargarEgresos = async () => {
  cargandoEgresos.value = true
  errorEgresos.value = null
  try {
    const respuesta = await fetch(`${ENDPOINTS.CONTABILIDAD_MOVIMIENTOS}?tipo=EGRESO`)
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
    egresos.value = lista
      .map((item) => {
        if (!item || typeof item !== 'object') return null
        const raw = item as Record<string, unknown>
        return {
          id: Number(raw.id ?? 0),
          fecha: String(raw.fecha ?? ''),
          fecha_dia_hora: raw.fecha_dia_hora ? String(raw.fecha_dia_hora) : undefined,
          monto: String(raw.monto ?? '0'),
          concepto: String(raw.concepto ?? ''),
          nota: String(raw.nota ?? ''),
          proveedor_nombre: raw.proveedor_nombre ? String(raw.proveedor_nombre) : undefined,
          proveedor_id: raw.proveedor_id ? Number(raw.proveedor_id) : null,
          caja_id: raw.caja_id ? Number(raw.caja_id) : null,
          usuario_id: raw.usuario_id ? Number(raw.usuario_id) : null,
          usuario_nombre: raw.usuario_nombre ? String(raw.usuario_nombre) : undefined,
          venta_id: raw.venta_id ? Number(raw.venta_id) : null,
          tipo: raw.tipo ? String(raw.tipo) : undefined
        } as MovimientoEgreso
      })
      .filter(Boolean) as MovimientoEgreso[]
    resumen[1].valor = formatearMoneda(totalEgresosFiltrados.value)
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err)
    errorEgresos.value = `No fue posible cargar egresos. ${detalle}`
  } finally {
    cargandoEgresos.value = false
  }
}

const abrirEditarEgreso = (item: MovimientoEgreso) => {
  editandoEgreso.value = item
  editandoEgresoForm.value = {
    fecha: toLocalInputUTCMinus5(new Date(item.fecha || new Date().toISOString())),
    tipo: item.tipo || 'EGRESO',
    monto: Number(item.monto ?? 0),
    concepto: item.concepto || '',
    nota: item.nota || '',
    proveedor_id: Number(item.proveedor_id ?? 0),
    caja_id: Number(item.caja_id ?? 0),
    usuario_id: Number(item.usuario_id ?? getSessionUserId() ?? 0),
    venta_id: Number(item.venta_id ?? 0)
  }
}

const cerrarEditarEgreso = () => {
  editandoEgreso.value = null
}

const guardarEditarEgreso = async () => {
  if (!editandoEgreso.value) return
  guardandoEgreso.value = true
  try {
    const payload = {
      fecha: fromLocalInputToUTCMinus5Iso(editandoEgresoForm.value.fecha),
      tipo: editandoEgresoForm.value.tipo,
      monto: Number(editandoEgresoForm.value.monto || 0),
      concepto: editandoEgresoForm.value.concepto,
      nota: editandoEgresoForm.value.nota,
      proveedor_id: Number(editandoEgresoForm.value.proveedor_id || 0),
      caja_id: Number(editandoEgresoForm.value.caja_id || 0),
      usuario_id: Number(editandoEgresoForm.value.usuario_id || 0),
      venta_id: Number(editandoEgresoForm.value.venta_id || 0)
    }
    const respuesta = await fetch(`${ENDPOINTS.CONTABILIDAD_MOVIMIENTOS}${editandoEgreso.value.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    if (!respuesta.ok) {
      const detalle = await respuesta.text().catch(() => '')
      throw new Error(detalle || `Error ${respuesta.status}`)
    }
    await cargarEgresos()
    cerrarEditarEgreso()
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err)
    errorEgresos.value = `No fue posible actualizar egreso. ${detalle}`
  } finally {
    guardandoEgreso.value = false
  }
}

const cerrarFormularioMovimiento = () => {
  mostrarFormularioMovimiento.value = false
  formularioMovimiento.value = {
    fecha: toLocalInputUTCMinus5(new Date()),
    tipo: 'EGRESO',
    monto: 0,
    concepto: '',
    nota: '',
    proveedor_id: 0,
    caja_id: 1,
    usuario_id: getSessionUserId() ?? 0,
    venta_id: null
  }
  errorMovimiento.value = null
  payloadMovimiento.value = null
  mensaje.value = null
  mensajeTipo.value = null
}

const cargarCategoriasContables = async () => {
  cargandoCategorias.value = true
  errorCategorias.value = null
  try {
    const respuesta = await fetch(ENDPOINTS.CONTABILIDAD_CATEGORIAS)
    if (!respuesta.ok) {
      const detalle = await respuesta.text().catch(() => '')
      throw new Error(detalle || `Error ${respuesta.status}`)
    }
    const data = (await respuesta.json()) as CategoriaContable[]
    categoriasContables.value = data
  } catch (err) {
    console.error('Error al cargar categorias contables', err)
    errorCategorias.value = 'No fue posible cargar categorias contables.'
  } finally {
    cargandoCategorias.value = false
  }
}

const cargarProveedores = async (forzar = false) => {
  const ahora = Date.now()
  if (!forzar && ultimaCargaProveedores.value && ahora - ultimaCargaProveedores.value < 60000) {
    return
  }
  cargandoProveedores.value = true
  errorProveedores.value = null
  try {
    const respuesta = await fetch(ENDPOINTS.CONTABILIDAD_PROVEEDORES)
    if (!respuesta.ok) {
      const detalle = await respuesta.text().catch(() => '')
      throw new Error(detalle || `Error ${respuesta.status}`)
    }
    const data = (await respuesta.json()) as Proveedor[]
    proveedores.value = data
    ultimaCargaProveedores.value = ahora
  } catch (err) {
    console.error('Error al cargar proveedores', err)
    errorProveedores.value = 'No fue posible cargar proveedores.'
  } finally {
    cargandoProveedores.value = false
  }
}

const normalizarNombreCodigo = (valor: string) =>
  valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

const obtenerPrefijoCategoria = (codigo: string) => {
  const normalizado = codigo.trim().toUpperCase()
  if (normalizado === 'ING' || normalizado.startsWith('ING_')) return 'ING'
  if (normalizado === 'EGRE' || normalizado.startsWith('EGRE_')) return 'EGRE'
  return null
}

watch(
  () => [formularioCategoria.value.nombre, formularioCategoria.value.codigo],
  ([nombre, codigo]) => {
    const prefijo = obtenerPrefijoCategoria(codigo)
    if (!prefijo) {
      codigoAutoCategoria.value = null
      return
    }
    const nombreCodigo = normalizarNombreCodigo(nombre)
    const sugerido = `${prefijo}_${nombreCodigo}`
    const codigoNormalizado = codigo.trim().toUpperCase()
    const usaAuto =
      codigoNormalizado === prefijo ||
      codigoNormalizado === `${prefijo}_` ||
      (codigoAutoCategoria.value !== null && codigoNormalizado === codigoAutoCategoria.value)
    if (usaAuto && codigoNormalizado !== sugerido) {
      formularioCategoria.value.codigo = sugerido
      codigoAutoCategoria.value = sugerido
    } else if (codigoNormalizado === sugerido) {
      codigoAutoCategoria.value = sugerido
    } else if (!usaAuto) {
      codigoAutoCategoria.value = null
    }
  }
)

const abrirFormularioMovimiento = () => {
  mensaje.value = null
  mensajeTipo.value = null
  mostrarFormularioMovimiento.value = true
  cargarProveedores()
  cargarCategoriasContables()
  formularioMovimiento.value = {
    fecha: toLocalInputUTCMinus5(new Date()),
    tipo: 'EGRESO',
    monto: 0,
    concepto: '',
    nota: '',
    proveedor_id: 0,
    caja_id: 1,
    usuario_id: getSessionUserId() ?? 0,
    venta_id: null
  }
  errorMovimiento.value = null
  payloadMovimiento.value = null
}

const abrirFormularioCategoria = () => {
  if (!categoriasHabilitadas) {
    return
  }
  mensaje.value = null
  mensajeTipo.value = null
  mostrarFormularioCategoria.value = true
  formularioCategoria.value = { nombre: '', codigo: '' }
  codigoAutoCategoria.value = null
  errorCategoria.value = null
}

const abrirAccion = (titulo: string) => {
  mostrarFormularioMovimiento.value = false
  mostrarFormularioCategoria.value = false
  if (titulo === 'Entradas y salidas') {
    abrirFormularioMovimiento()
  } else if (titulo === 'Categorias contables') {
    abrirFormularioCategoria()
  }
}

const registrarCategoria = async () => {
  guardandoCategoria.value = true
  errorCategoria.value = null
  mensaje.value = null
  mensajeTipo.value = null
  if (!formularioCategoria.value.nombre.trim()) {
    errorCategoria.value = 'El nombre es obligatorio.'
    guardandoCategoria.value = false
    return
  }
  if (!formularioCategoria.value.codigo.trim()) {
    errorCategoria.value = 'El codigo es obligatorio.'
    guardandoCategoria.value = false
    return
  }
  const codigoNormalizado = formularioCategoria.value.codigo.trim().toUpperCase()
  if (!codigoNormalizado.startsWith('ING_') && !codigoNormalizado.startsWith('EGRE_')) {
    errorCategoria.value = 'El codigo debe iniciar con ING o EGRE.'
    guardandoCategoria.value = false
    return
  }
  try {
    formularioCategoria.value.codigo = codigoNormalizado
    const respuesta = await fetch(ENDPOINTS.CONTABILIDAD_CATEGORIAS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formularioCategoria.value)
    })
    if (!respuesta.ok) {
      const detalle = await respuesta.text().catch(() => '')
      throw new Error(detalle || `Error ${respuesta.status}`)
    }
    mensaje.value = 'Categoria creada correctamente.'
    mensajeTipo.value = 'exito'
    formularioCategoria.value = { nombre: '', codigo: '' }
    codigoAutoCategoria.value = null
    await cargarCategoriasContables()
  } catch (err) {
    console.error('Error al crear categoria contable', err)
    const detalle = err instanceof Error ? err.message : String(err)
    errorCategoria.value = `No fue posible crear la categoria. ${detalle}`
    mensaje.value = 'No fue posible crear la categoria.'
    mensajeTipo.value = 'error'
  } finally {
    guardandoCategoria.value = false
  }
}

const cerrarFormularioCategoria = () => {
  mostrarFormularioCategoria.value = false
  formularioCategoria.value = { nombre: '', codigo: '' }
  codigoAutoCategoria.value = null
  errorCategoria.value = null
  mensaje.value = null
  mensajeTipo.value = null
}

onMounted(() => {
  cargarProveedores()
  cargarCategoriasContables()
  cargarEgresos()
})
</script>

<template>
  <main class="contabilidad">
    <section class="contabilidad__resumen">
      <article class="tarjeta">
        <div>
          <p class="tarjeta__titulo">Egresos totales</p>
          <p class="tarjeta__valor">{{ formatearMoneda(totalEgresosFiltrados) }}</p>
        </div>
      </article>
      <article class="tarjeta">
        <div>
          <p class="tarjeta__titulo">Caja</p>
          <p class="tarjeta__valor">{{ formatearMoneda(totalCaja) }}</p>
        </div>
      </article>
      <article class="tarjeta">
        <div>
          <p class="tarjeta__titulo">Rinonera</p>
          <p class="tarjeta__valor">{{ formatearMoneda(totalRinonera) }}</p>
        </div>
      </article>
    </section>

    <section class="contabilidad__acciones-grid">
      <article
        v-for="accion in acciones"
        :key="accion.titulo"
        class="accion"
        role="button"
        tabindex="0"
        @click="abrirAccion(accion.titulo)"
        @keyup.enter.prevent="abrirAccion(accion.titulo)"
        @keyup.space.prevent="abrirAccion(accion.titulo)"
      >
        <div>
          <h2>{{ accion.titulo }}</h2>
          <p>{{ accion.descripcion }}</p>
        </div>
      </article>
    </section>

    <section class="tabla tabla--modulo">
      <div class="tabla__encabezado">
        <div class="tabla__titulo">
          <h2>Egresos</h2>
          <p class="tabla__nota">Filtra por fecha y proveedor.</p>
        </div>
        <div class="tabla__filtros">
          <label>
            <span>Desde</span>
            <input v-model="filtroFechaDesde" type="date" />
          </label>
          <label>
            <span>Hasta</span>
            <input v-model="filtroFechaHasta" type="date" />
          </label>
          <label>
            <span>Proveedor</span>
            <select v-model.number="filtroProveedorId" :disabled="cargandoProveedores">
              <option :value="0">Todos</option>
              <option v-for="proveedor in proveedores" :key="proveedor.id" :value="proveedor.id">
                {{ proveedor.nombre }}
              </option>
            </select>
          </label>
          <button type="button" class="boton secundario" @click="cargarEgresos" :disabled="cargandoEgresos">
            {{ cargandoEgresos ? 'Actualizando...' : 'Actualizar' }}
          </button>
        </div>
      </div>
      <p v-if="errorEgresos" class="error">{{ errorEgresos }}</p>
      <div v-if="!cargandoEgresos && egresos.length === 0" class="vacio">Sin egresos.</div>
      <table v-else class="tabla__grid">
        <colgroup>
          <col style="width: 13%" />
          <col style="width: 17%" />
          <col style="width: 15%" />
          <col style="width: 20%" />
          <col style="width: 9%" />
          <col style="width: 8%" />
          <col style="width: 9%" />
          <col style="width: 9%" />
        </colgroup>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Proveedor</th>
            <th>Concepto</th>
            <th>Nota</th>
            <th>Monto</th>
            <th>Caja</th>
            <th>Usuario</th>
            <th class="th-accion">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in egresosFiltrados" :key="item.id">
            <td>{{ item.fecha_dia_hora || item.fecha }}</td>
            <td>{{ item.proveedor_nombre || '-' }}</td>
            <td>{{ item.concepto || '-' }}</td>
            <td>{{ item.nota || '-' }}</td>
            <td class="col-num">{{ formatearMoneda(item.monto) }}</td>
            <td class="col-centro">{{ item.caja_id ?? '-' }}</td>
            <td class="col-centro">{{ item.usuario_nombre || '-' }}</td>
            <td class="col-accion">
              <div class="acciones-tabla">
                <button type="button" class="accion-btn accion-btn--edit" @click="abrirEditarEgreso(item)" title="Editar">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M4 17.5V20h2.5L18.8 7.7l-2.5-2.5L4 17.5zM20.7 5.3a1 1 0 0 0 0-1.4l-1.6-1.6a1 1 0 0 0-1.4 0l-1.2 1.2 2.5 2.5 1.7-1.7z"
                      fill="currentColor"
                    />
                  </svg>
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <div
      v-if="editandoEgreso"
      class="modal"
      role="dialog"
      aria-modal="true"
      @click.self="cerrarEditarEgreso"
    >
      <section class="contabilidad__formulario" @click.stop>
        <div class="modal__encabezado">
          <h2>Editar egreso</h2>
          <button type="button" class="modal__cerrar" @click="cerrarEditarEgreso">x</button>
        </div>
        <form class="form" @submit.prevent="guardarEditarEgreso">
          <label>
            <span>Fecha</span>
            <input v-model="editandoEgresoForm.fecha" type="datetime-local" step="60" required />
          </label>
          <label>
            <span>Tipo</span>
            <select v-model="editandoEgresoForm.tipo" required>
              <option value="EGRESO">EGRESO</option>
              <option value="INGRESO">INGRESO</option>
            </select>
          </label>
          <label>
            <span>Monto</span>
            <input v-model.number="editandoEgresoForm.monto" type="number" min="0" step="1" required />
          </label>
          <label>
            <span>Concepto</span>
            <input v-model="editandoEgresoForm.concepto" type="text" placeholder="Concepto" />
          </label>
          <label>
            <span>Nota</span>
            <input v-model="editandoEgresoForm.nota" type="text" placeholder="Nota" />
          </label>
          <label>
            <span>Proveedor</span>
            <select v-model.number="editandoEgresoForm.proveedor_id" :disabled="cargandoProveedores">
              <option :value="0">Sin proveedor</option>
              <option v-for="proveedor in proveedores" :key="proveedor.id" :value="proveedor.id">
                {{ proveedor.nombre }}
              </option>
            </select>
          </label>
          <label>
            <span>Caja</span>
            <input v-model.number="editandoEgresoForm.caja_id" type="number" min="0" step="1" />
          </label>
          <label>
            <span>Usuario</span>
            <input v-model.number="editandoEgresoForm.usuario_id" type="number" min="0" step="1" />
          </label>
          <label>
            <span>Venta ID</span>
            <input v-model.number="editandoEgresoForm.venta_id" type="number" min="0" step="1" />
          </label>
          <div class="modal__acciones">
            <button type="submit" class="boton" :disabled="guardandoEgreso">
              {{ guardandoEgreso ? 'Guardando...' : 'Guardar' }}
            </button>
            <button type="button" class="boton secundario" @click="cerrarEditarEgreso">Cancelar</button>
          </div>
          <p v-if="errorEgresos" class="form__error">{{ errorEgresos }}</p>
        </form>
      </section>
    </div>


    <div
      v-if="mostrarFormularioMovimiento"
      class="modal"
      role="dialog"
      aria-modal="true"
      tabindex="0"
      @keydown.esc.prevent="cerrarFormularioMovimiento"
      @click.self="cerrarFormularioMovimiento"
    >
      <section class="contabilidad__formulario" @click.stop>
        <div class="modal__encabezado">
          <h2>Entradas y salidas</h2>
          <button type="button" class="modal__cerrar" @click="cerrarFormularioMovimiento">x</button>
        </div>
        <form class="form" @submit.prevent="registrarMovimiento">
          <label>
            <span>Fecha</span>
            <input v-model="formularioMovimiento.fecha" type="datetime-local" step="60" required />
          </label>
          <label>
            <span>Tipo</span>
            <select v-model="formularioMovimiento.tipo" required>
              <option value="EGRESO">EGRESO</option>
              <option value="INGRESO">INGRESO</option>
            </select>
          </label>
          <label>
            <span>Monto</span>
            <input
              :value="montoMovimientoInput"
              type="text"
              inputmode="numeric"
              placeholder="0"
              @input="actualizarMontoMovimiento"
              required
            />
          </label>
          <label>
            <span>Concepto</span>
            <select
              v-if="categoriasContables.length > 0"
              v-model="formularioMovimiento.concepto"
              :disabled="cargandoCategorias"
            >
              <option value="" disabled>Selecciona una categoria</option>
              <option v-for="categoria in categoriasContables" :key="categoria.id" :value="categoria.nombre">
                {{ categoria.nombre }}
              </option>
            </select>
            <input
              v-else
              v-model="formularioMovimiento.concepto"
              type="text"
              placeholder="Concepto"
              :disabled="cargandoCategorias"
            />
            <small v-if="cargandoCategorias" class="ayuda">Cargando categorias...</small>
            <small v-else-if="categoriasContables.length === 0" class="ayuda ayuda--error">
              {{ errorCategorias ?? 'No hay categorias disponibles.' }}
            </small>
          </label>
          <label>
            <span>Nota</span>
            <input v-model="formularioMovimiento.nota" type="text" placeholder="Nota" />
          </label>
          <label>
            <span>Proveedor</span>
            <select
              v-model.number="formularioMovimiento.proveedor_id"
              :disabled="cargandoProveedores || proveedores.length === 0"
              required
            >
              <option :value="0" disabled>Selecciona un proveedor</option>
              <option v-for="proveedor in proveedores" :key="proveedor.id" :value="proveedor.id">
                {{ proveedor.nombre }}
              </option>
            </select>
            <small v-if="cargandoProveedores" class="ayuda">Cargando proveedores...</small>
            <small v-else-if="proveedores.length === 0" class="ayuda ayuda--error">
              {{ errorProveedores ?? 'No hay proveedores disponibles.' }}
            </small>
          </label>
          <button type="submit" class="boton" :disabled="guardandoMovimiento">
            {{ guardandoMovimiento ? 'Guardando...' : 'Guardar' }}
          </button>
          <p v-if="errorMovimiento" class="form__error">{{ errorMovimiento }}</p>
          <p v-if="mensaje" :class="['form__mensaje', `form__mensaje--${mensajeTipo}`]">{{ mensaje }}</p>
        </form>
      </section>
    </div>

    <div
      v-if="categoriasHabilitadas && mostrarFormularioCategoria"
      class="modal"
      role="dialog"
      aria-modal="true"
      @click.self="cerrarFormularioCategoria"
    >
      <section class="contabilidad__formulario" @click.stop>
        <div class="modal__encabezado">
          <h2>Crear categoria contable</h2>
          <button type="button" class="modal__cerrar" @click="cerrarFormularioCategoria">x</button>
        </div>
        <form class="form" @submit.prevent="registrarCategoria">
          <label>
            <span>Nombre</span>
            <input v-model="formularioCategoria.nombre" type="text" required />
          </label>
          <label>
            <span>Codigo</span>
            <input v-model="formularioCategoria.codigo" type="text" required />
            <small class="ayuda">Escribe ING o EGRE y se completa con el nombre.</small>
          </label>
          <button type="submit" class="boton" :disabled="guardandoCategoria">
            {{ guardandoCategoria ? 'Guardando...' : 'Crear categoria' }}
          </button>
          <p v-if="errorCategoria" class="form__error">{{ errorCategoria }}</p>
          <p v-if="mensaje" :class="['form__mensaje', `form__mensaje--${mensajeTipo}`]">{{ mensaje }}</p>
        </form>
      </section>
    </div>
  </main>
</template>

<style scoped>
.contabilidad {
  display: grid;
  gap: 1.5rem;
}

.contabilidad__cabecera {
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

.contabilidad__prefijo {
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.8rem;
  color: #94a3b8;
}

.contabilidad__cabecera h1 {
  margin: 0;
  font-size: clamp(2rem, 4vw, 2.6rem);
}

.contabilidad__nota {
  margin: 0.35rem 0 0;
  color: #cbd5e1;
}

.contabilidad__acciones {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
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

.contabilidad__resumen {
  display: grid;
  grid-template-columns: repeat(3, minmax(220px, 1fr));
  gap: 0.9rem;
}

.tarjeta {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.2rem;
  border-radius: 1rem;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(13, 15, 20, 0.9);
}

.tarjeta__titulo {
  margin: 0;
  color: #cbd5e1;
  font-size: 0.9rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.tarjeta__valor {
  margin: 0.2rem 0 0;
  font-size: 1.6rem;
  font-weight: 700;
  color: #facc15;
}

.tarjeta__detalle {
  margin: 0.35rem 0 0;
  color: #94a3b8;
}

.tarjeta__estado {
  align-self: center;
  padding: 0.3rem 0.7rem;
  border-radius: 999px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-size: 0.75rem;
  border: 1px solid rgba(148, 163, 184, 0.3);
  color: #e2e8f0;
}

.tarjeta__estado--pendiente {
  background: rgba(250, 204, 21, 0.16);
  border-color: rgba(250, 204, 21, 0.45);
  color: #fef9c3;
}

.contabilidad__acciones-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1rem;
}

.tabla {
  display: grid;
  gap: 0.6rem;
}

.tabla--modulo {
  padding: 0.75rem;
  border-radius: 1rem;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(13, 15, 20, 0.88);
  overflow-x: auto;
}

.tabla__encabezado {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.5rem;
}

.tabla__grid {
  width: 100%;
  border-collapse: collapse;
  color: #e2e8f0;
  font-size: 0.9rem;
  table-layout: fixed;
  min-width: 1100px;
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


.tabla__encabezado {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.tabla__titulo h2 {
  margin: 0;
}

.tabla__nota {
  margin: 0.2rem 0 0;
  color: #94a3b8;
  font-size: 0.85rem;
}

.tabla__filtros {
  display: flex;
  align-items: flex-end;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.tabla__filtros label {
  display: grid;
  gap: 0.3rem;
  color: #e2e8f0;
  font-weight: 600;
  font-size: 0.75rem;
}

.tabla__filtros input,
.tabla__filtros select {
  border-radius: 0.6rem;
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: rgba(10, 12, 18, 0.9);
  color: #e2e8f0;
  padding: 0.35rem 0.55rem;
  min-width: 150px;
}

.th-accion {
  text-align: center;
}

.col-accion {
  text-align: center;
  white-space: nowrap;
}

.acciones-tabla {
  display: inline-flex;
  gap: 0.45rem;
}

.accion-btn {
  border: 1px solid rgba(148, 163, 184, 0.4);
  background: rgba(12, 14, 20, 0.92);
  color: #e2e8f0;
  border-radius: 0.7rem;
  width: 2.25rem;
  height: 2.25rem;
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: transform 0.15s ease, border-color 0.15s ease, background 0.15s ease;
}

.accion-btn svg {
  width: 1.05rem;
  height: 1.05rem;
  display: block;
  fill: currentColor;
}

.accion-btn:hover:not(:disabled),
.accion-btn:focus-visible:not(:disabled) {
  border-color: rgba(250, 204, 21, 0.55);
  background: rgba(250, 204, 21, 0.12);
  transform: translateY(-1px);
  outline: none;
}

.accion-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.accion-btn--edit {
  border-color: rgba(59, 130, 246, 0.5);
  color: #bfdbfe;
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


.accion {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.2rem;
  border-radius: 1rem;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(9, 10, 13, 0.85);
}

.accion h2 {
  margin: 0;
  font-size: 1.1rem;
}

.accion p {
  margin: 0.35rem 0 0;
  color: #94a3b8;
}

.contabilidad__formulario {
  padding: 1rem 1.2rem;
  border-radius: 1rem;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(10, 11, 14, 0.85);
  width: min(640px, 92vw);
  margin: 0 auto;
  max-height: calc(100vh - 4rem);
  overflow-y: auto;
}

.contabilidad__formulario h2 {
  margin: 0;
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

.modal__encabezado {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.modal__cerrar {
  border: none;
  background: rgba(148, 163, 184, 0.15);
  color: #f8fafc;
  border-radius: 0.6rem;
  width: 2rem;
  height: 2rem;
  font-size: 1.2rem;
  cursor: pointer;
}

.form {
  display: grid;
  gap: 0.85rem;
}

.form label {
  display: grid;
  gap: 0.35rem;
  color: #e2e8f0;
}

.form input,
.form select,
.form textarea {
  background: rgba(12, 14, 20, 0.92);
  border: 1px solid rgba(148, 163, 184, 0.25);
  border-radius: 0.75rem;
  padding: 0.6rem 0.75rem;
  color: #f8fafc;
}

.form__error {
  margin: 0;
  color: #fca5a5;
  font-weight: 600;
}

.form__mensaje {
  margin: 0;
  font-weight: 600;
}

.form__mensaje--exito {
  color: #86efac;
}

.form__mensaje--error {
  color: #fca5a5;
}

.ayuda {
  color: #94a3b8;
  font-size: 0.85rem;
}

.ayuda--error {
  color: #fca5a5;
}

.payload {
  margin: 0;
  padding: 0.75rem;
  border-radius: 0.75rem;
  background: rgba(5, 6, 9, 0.9);
  border: 1px solid rgba(148, 163, 184, 0.2);
  color: #e2e8f0;
  white-space: pre-wrap;
}

@media (max-width: 720px) {
  .contabilidad__cabecera {
    flex-direction: column;
  }
}
</style>

