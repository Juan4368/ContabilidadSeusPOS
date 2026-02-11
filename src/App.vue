<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch, type Component } from 'vue'

import POSView from './views/POSView.vue'
import StockView from './views/StockView.vue'
import AdminView from './views/AdminView.vue'
import ProductosView from './views/ProductosView.vue'
import VentasPendientesView from './views/VentasPendientesView.vue'
import ContabilidadView from './views/ContabilidadView.vue'
import CarteraView from './views/CarteraView.vue'
import LoginView from './views/LoginView.vue'
import ResumenVentasView from './views/ResumenVentasView.vue'
import PrestamoCajasView from './views/PrestamoCajasView.vue'
import CierreCajaView from './views/CierreCajaView.vue'
import CierreCajaHistoricoView from './views/CierreCajaHistoricoView.vue'
import MenuPrincipalView from './views/MenuPrincipalView.vue'
import { ENDPOINTS } from './config/endpoints'
import { getSessionUserId } from './utils/session'
import { nowUTCMinus5Iso, toUTCMinus5Iso } from './utils/time'

type VistaId =
  | 'menu-principal'
  | 'pos'
  | 'contabilidad'
  | 'cartera'
  | 'stock'
  | 'admin'
  | 'productos'
  | 'ventas-pendientes'
  | 'resumen-ventas'
  | 'prestamo-cajas'
  | 'cierre-caja'
  | 'cierre-historico'

const vistaActiva = ref<VistaId>('pos')
const sesionIniciada = ref(false)
const sesionUsuario = ref<string | null>(null)
const sesionRoles = ref<string[]>([])
const sesionCajaId = ref<number | null>(null)
const sesionCajaNombre = ref<string | null>(null)
const sesionCajaSesionId = ref<number | null>(null)
const sesionToken = ref<string | null>(null)
const loginError = ref('')
const loginCargando = ref(false)
const totalCuenta = ref(0)
const ventasPendientes = ref(0)
const cargandoPendientes = ref(false)
const errorPendientes = ref<string | null>(null)
const appOnline = ref(typeof navigator !== 'undefined' ? navigator.onLine : true)
const appSyncing = ref(false)
const appQueueCount = ref(0)
let pendientesInterval: number | undefined
const LOGIN_ENDPOINT = ENDPOINTS.LOGIN
const sidebarHidden = ref(localStorage.getItem('ui_sidebar_hidden') !== '0')

const toggleSidebar = () => {
  sidebarHidden.value = !sidebarHidden.value
  localStorage.setItem('ui_sidebar_hidden', sidebarHidden.value ? '1' : '0')
}

type Caja = {
  id: number
  nombre?: string
  saldo_inicial?: number
  estado?: string
  usuario_id?: number | null
  fecha_apertura?: string | null
  fecha_cierre?: string | null
  created_at?: string | null
}

const cajas = ref<Caja[]>([])
const cargandoCajas = ref(false)
const errorCajas = ref<string | null>(null)
const actualizandoCaja = ref(false)

const parseJwt = (token: string): Record<string, unknown> | null => {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const decoded = atob(normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '='))
    return JSON.parse(decoded) as Record<string, unknown>
  } catch {
    return null
  }
}

const vistas: Array<{ id: VistaId; nombre: string; descripcion: string; componente: Component }> = [
  { id: 'menu-principal', nombre: 'Menu principal', descripcion: 'Resumen de vistas', componente: MenuPrincipalView },
  { id: 'pos', nombre: 'POS', descripcion: 'Cobro en mostrador', componente: POSView },
  { id: 'contabilidad', nombre: 'Contabilidad', descripcion: 'Ingresos, egresos y cartera', componente: ContabilidadView },
  { id: 'cartera', nombre: 'Cartera', descripcion: 'Cuentas por cobrar', componente: CarteraView },
  { id: 'stock', nombre: 'Stock', descripcion: 'Inventario y reposicion', componente: StockView },
  { id: 'admin', nombre: 'Admin', descripcion: 'Usuarios y categorias', componente: AdminView },
  { id: 'productos', nombre: 'Productos', descripcion: 'Catalogo y precios', componente: ProductosView },
  { id: 'ventas-pendientes', nombre: 'Ventas pendientes', descripcion: 'Recuperar ventas', componente: VentasPendientesView },
  { id: 'resumen-ventas', nombre: 'Resumen ventas', descripcion: 'Resumen diario de ventas', componente: ResumenVentasView },
  { id: 'prestamo-cajas', nombre: 'Prestamo cajas', descripcion: 'Control de cajas prestadas', componente: PrestamoCajasView },
  { id: 'cierre-caja', nombre: 'Cierre caja', descripcion: 'Resumen y cierre del turno', componente: CierreCajaView },
  { id: 'cierre-historico', nombre: 'Historico cierre', descripcion: 'Historial de cierres de caja', componente: CierreCajaHistoricoView }
]

const tieneCajaSeleccionada = computed(() => Number.isFinite(sesionCajaId.value) && Number(sesionCajaId.value) > 0)
const cajaAbiertaEnSesion = computed(() => Number.isFinite(sesionCajaId.value) && Number(sesionCajaId.value) > 0)

const componenteActual = computed(() => vistas.find((vista) => vista.id === vistaActiva.value)?.componente ?? POSView)

const vistasMenuPrincipal = computed(() => vistas.filter((vista) => vista.id !== 'menu-principal'))
const vistasSidebar = computed(() => vistasMenuPrincipal.value)

watch(vistas, (nuevas) => {
  if (!nuevas.find((vista) => vista.id === vistaActiva.value)) {
    vistaActiva.value = nuevas[0]?.id ?? 'pos'
  }
})

watch(sesionIniciada, (iniciada) => {
  if (iniciada) {
    void cargarCajas()
    void cargarPendientes()
  } else {
    cajas.value = []
    ventasPendientes.value = 0
    errorPendientes.value = null
  }
})

const cambiarVista = (event: Event) => {
  const detalle = (event as CustomEvent<{ vista: VistaId }>).detail
  if (detalle?.vista) {
    seleccionarVista(detalle.vista)
  }
}

const actualizarTotalCuenta = (event: Event) => {
  const detalle = (event as CustomEvent<{ total?: number }>).detail
  if (detalle && typeof detalle.total === 'number') {
    totalCuenta.value = detalle.total
  }
}

const actualizarEstadoOffline = (event: Event) => {
  const detalle = (event as CustomEvent<{ online?: boolean; syncing?: boolean; queueCount?: number }>).detail
  if (detalle && typeof detalle.online === 'boolean') {
    appOnline.value = detalle.online
  }
  if (detalle && typeof detalle.syncing === 'boolean') {
    appSyncing.value = detalle.syncing
  }
  if (detalle && typeof detalle.queueCount === 'number') {
    appQueueCount.value = detalle.queueCount
  }
}

const cargarPendientes = async () => {
  cargandoPendientes.value = true
  errorPendientes.value = null
  try {
    const respuesta = await fetch(`${ENDPOINTS.VENTAS_LOCAL}?estado=false`)
    if (!respuesta.ok) {
      const detalle = await respuesta.text().catch(() => '')
      throw new Error(detalle || `Error ${respuesta.status}`)
    }
    const data = (await respuesta.json().catch(() => [])) as unknown
    const lista = Array.isArray(data) ? data : Array.isArray((data as { data?: unknown[] }).data) ? (data as { data?: unknown[] }).data : []
    ventasPendientes.value = Array.isArray(lista) ? lista.length : 0
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err)
    errorPendientes.value = detalle || 'No fue posible cargar ventas pendientes.'
    ventasPendientes.value = 0
  } finally {
    cargandoPendientes.value = false
  }
}

onMounted(() => {
  window.addEventListener('app:cambiar-vista', cambiarVista as EventListener)
  window.addEventListener('pos:total-actualizado', actualizarTotalCuenta as EventListener)
  window.addEventListener('pos:pendientes-actualizados', cargarPendientes as EventListener)
  window.addEventListener('app:offline-status', actualizarEstadoOffline as EventListener)
  pendientesInterval = window.setInterval(() => {
    if (sesionIniciada.value) {
      void cargarPendientes()
    }
  }, 10000)
})

onBeforeUnmount(() => {
  window.removeEventListener('app:cambiar-vista', cambiarVista as EventListener)
  window.removeEventListener('pos:total-actualizado', actualizarTotalCuenta as EventListener)
  window.removeEventListener('pos:pendientes-actualizados', cargarPendientes as EventListener)
  window.removeEventListener('app:offline-status', actualizarEstadoOffline as EventListener)
  if (pendientesInterval) {
    window.clearInterval(pendientesInterval)
  }
})

const seleccionarVista = (vistaId: string) => {
  const vista = vistaId as VistaId
  if (vista === 'pos' && !tieneCajaSeleccionada.value) return
  vistaActiva.value = vista
}

const formatCurrency = (monto: number) =>
  monto.toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0
  })

const iniciarSesion = async (credenciales: { usuario: string; contrasena: string }) => {
  loginError.value = ''
  loginCargando.value = true
  try {
    const payloadLogin = { username: credenciales.usuario, password: credenciales.contrasena }
    console.log('login:request', { endpoint: LOGIN_ENDPOINT, payload: payloadLogin })
    const logLogin = async (lines: string[]) => {
      try {
        const ipc = (window as unknown as { ipcRenderer?: { invoke: (c: string, p: unknown) => Promise<void> } })
          .ipcRenderer
        if (!ipc?.invoke) return
        await ipc.invoke('log:append', { filename: 'login.txt', lines })
      } catch (err) {
        console.warn('No se pudo escribir login.txt', err)
      }
    }
    const timestamp = nowUTCMinus5Iso()
    const respuesta = await fetch(LOGIN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadLogin)
    })
    if (!respuesta.ok) {
      const detalle = await respuesta.text().catch(() => '')
      console.log('login:response', { status: respuesta.status, ok: false, body: detalle })
      await logLogin([
        `[${timestamp}] request endpoint=${LOGIN_ENDPOINT}`,
        `payload=${JSON.stringify(payloadLogin)}`,
        `response status=${respuesta.status} ok=false body=${detalle}`
      ])
      throw new Error(detalle || `Error ${respuesta.status}`)
    }
    const data = (await respuesta.json().catch(() => ({}))) as Record<string, unknown>
    console.log('login:response', { status: respuesta.status, ok: true, body: data })
    await logLogin([
      `[${timestamp}] request endpoint=${LOGIN_ENDPOINT}`,
      `payload=${JSON.stringify(payloadLogin)}`,
      `response status=${respuesta.status} ok=true body=${JSON.stringify(data)}`
    ])
    const token = String(data.access_token ?? data.token ?? data.access ?? '')
    const payload = token ? parseJwt(token) : null
    const roles = Array.isArray(payload?.roles) ? (payload?.roles as string[]) : []
    sesionUsuario.value = String(payload?.username ?? data.username ?? credenciales.usuario)
    sesionRoles.value = roles
    sesionToken.value = token
    sesionIniciada.value = true
    sesionCajaId.value = null
    sesionCajaNombre.value = null
    localStorage.setItem(
      'pos_sesion',
      JSON.stringify({
        usuario: sesionUsuario.value,
        roles,
        token,
        cajaId: sesionCajaId.value,
        cajaNombre: sesionCajaNombre.value,
        cajaSesionId: sesionCajaSesionId.value
      })
    )
    window.dispatchEvent(new Event('pos:sesion-actualizada'))
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : String(error)
    loginError.value = mensaje || 'No fue posible iniciar sesi?n.'
  } finally {
    loginCargando.value = false
  }
}

const cerrarCajaSesion = async () => {
  if (!sesionCajaId.value) return
  try {
    if (sesionCajaSesionId.value) {
      const fechaCierre = toUTCMinus5Iso(new Date())
      const cerrarSesionResp = await fetch(`${ENDPOINTS.CONTABILIDAD_CAJA_SESIONES}${sesionCajaSesionId.value}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha_cierre: fechaCierre
        })
      })
      if (!cerrarSesionResp.ok) {
        const detalle = await cerrarSesionResp.text().catch(() => '')
        throw new Error(detalle || `Error ${cerrarSesionResp.status}`)
      }
    }
    const detalleResp = await fetch(`${ENDPOINTS.CONTABILIDAD_CAJAS}${sesionCajaId.value}`)
    if (!detalleResp.ok) {
      const detalle = await detalleResp.text().catch(() => '')
      throw new Error(detalle || `Error ${detalleResp.status}`)
    }
    const data = (await detalleResp.json()) as Record<string, unknown>
    const nombre = String(data.nombre ?? data.name ?? sesionCajaId.value)
    const saldoInicial = Number(data.saldo_inicial ?? data.saldoInicial ?? 0)
    const cerrarResp = await fetch(`${ENDPOINTS.CONTABILIDAD_CAJAS}${sesionCajaId.value}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre,
        saldo_inicial: Number.isFinite(saldoInicial) ? saldoInicial : 0,
        estado: 'CERRADA'
      })
    })
    if (!cerrarResp.ok) {
      const detalle = await cerrarResp.text().catch(() => '')
      throw new Error(detalle || `Error ${cerrarResp.status}`)
    }
  } catch (err) {
    console.warn('No se pudo cerrar la caja en logout', err)
  }
}

const cerrarSesion = async () => {
  await cerrarCajaSesion()
  sesionIniciada.value = false
  sesionUsuario.value = null
  sesionRoles.value = []
  sesionCajaId.value = null
  sesionCajaNombre.value = null
  sesionCajaSesionId.value = null
  sesionToken.value = null
  loginError.value = ''
  localStorage.removeItem('pos_sesion')
  window.dispatchEvent(new Event('pos:sesion-actualizada'))
}

const hidratarSesion = () => {
  try {
    const raw = localStorage.getItem('pos_sesion')
    if (!raw) return
    const data = JSON.parse(raw) as {
      usuario?: string
      roles?: string[]
      token?: string | null
      cajaId?: number | null
      cajaNombre?: string | null
      cajaSesionId?: number | null
    }
    if (data?.usuario) {
      sesionUsuario.value = data.usuario
      sesionRoles.value = Array.isArray(data.roles) ? data.roles : []
      sesionCajaId.value = Number.isFinite(data.cajaId) ? Number(data.cajaId) : null
      sesionCajaNombre.value = data.cajaNombre ? String(data.cajaNombre) : null
      sesionCajaSesionId.value = Number.isFinite(data.cajaSesionId) ? Number(data.cajaSesionId) : null
      sesionToken.value = data.token ? String(data.token) : null
      sesionIniciada.value = true
    }
  } catch {
    localStorage.removeItem('pos_sesion')
  }
}

const persistirSesion = () => {
  if (!sesionUsuario.value) return
  localStorage.setItem(
    'pos_sesion',
    JSON.stringify({
      usuario: sesionUsuario.value,
      roles: sesionRoles.value,
      token: sesionToken.value,
      cajaId: sesionCajaId.value,
      cajaNombre: sesionCajaNombre.value,
      cajaSesionId: sesionCajaSesionId.value
    })
  )
}

const cargarCajas = async () => {
  if (!sesionIniciada.value) return
  cargandoCajas.value = true
  errorCajas.value = null
  try {
    const endpoint = ENDPOINTS.CONTABILIDAD_CAJAS
    const respuesta = await fetch(endpoint)
    if (!respuesta.ok) {
      const detalle = await respuesta.text().catch(() => '')
      const cuerpo = detalle ? ` body=${detalle}` : ''
      throw new Error(`HTTP ${respuesta.status} (${respuesta.statusText}) endpoint=${endpoint}${cuerpo}`)
    }
    const data = await respuesta.json()
    const lista = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : []
    cajas.value = (lista as Array<Record<string, unknown>>)
      .map((item) => ({
        id: Number(item?.id ?? item?.caja_id ?? item?.pk ?? 0),
        nombre: String(item?.nombre ?? item?.name ?? `Caja ${item?.id ?? item?.caja_id ?? item?.pk ?? ''}`),
        saldo_inicial: Number(item?.saldo_inicial ?? item?.saldoInicial ?? 0),
        estado: String(item?.estado ?? '').toUpperCase(),
        usuario_id: Number.isFinite(Number(item?.usuario_id)) ? Number(item?.usuario_id) : null,
        fecha_apertura: item?.fecha_apertura ? String(item?.fecha_apertura) : null,
        fecha_cierre: item?.fecha_cierre ? String(item?.fecha_cierre) : null,
        created_at: item?.created_at ? String(item?.created_at) : null
      }))
      .filter((item) => Number.isFinite(item.id) && item.id > 0)
  } catch (err) {
    console.error('No se pudieron cargar cajas', err)
    const detalle = err instanceof Error ? err.message : String(err)
    errorCajas.value = detalle
      ? `No fue posible cargar las cajas. ${detalle}`
      : 'No fue posible cargar las cajas.'
  } finally {
    cargandoCajas.value = false
  }
}

const seleccionarCaja = async (caja: Caja) => {
  if (!caja) return
  if (actualizandoCaja.value) return
  actualizandoCaja.value = true
  errorCajas.value = null
  try {
    if (caja.estado === 'ABIERTA') {
      if (sesionCajaId.value !== caja.id || !sesionCajaSesionId.value) {
        throw new Error('Solo puedes cerrar la caja activa de esta sesión.')
      }
      const fechaCierre = toUTCMinus5Iso(new Date())
      const cerrarSesionResp = await fetch(`${ENDPOINTS.CONTABILIDAD_CAJA_SESIONES}${sesionCajaSesionId.value}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha_cierre: fechaCierre })
      })
      if (!cerrarSesionResp.ok) {
        const detalle = await cerrarSesionResp.text().catch(() => '')
        throw new Error(detalle || `Error ${cerrarSesionResp.status}`)
      }
      const cerrarCajaResp = await fetch(`${ENDPOINTS.CONTABILIDAD_CAJAS}${caja.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: caja.nombre ?? String(caja.id),
          saldo_inicial: Number.isFinite(caja.saldo_inicial) ? caja.saldo_inicial : 0,
          estado: 'CERRADA'
        })
      })
      if (!cerrarCajaResp.ok) {
        const detalle = await cerrarCajaResp.text().catch(() => '')
        throw new Error(detalle || `Error ${cerrarCajaResp.status}`)
      }
      sesionCajaId.value = null
      sesionCajaNombre.value = null
      sesionCajaSesionId.value = null
      cajas.value = cajas.value.map((item) =>
        item.id === caja.id ? { ...item, estado: 'CERRADA' } : item
      )
      persistirSesion()
      return
    }

    if (cajaAbiertaEnSesion.value && sesionCajaId.value && sesionCajaId.value !== caja.id) {
      throw new Error('Solo puedes abrir una caja por sesión. Cierra la caja activa primero.')
    }

    const usuarioId = getSessionUserId()
    if (!usuarioId) {
      throw new Error('No se pudo identificar el usuario.')
    }
    const ahoraIso = toUTCMinus5Iso(new Date())
    const sesionResp = await fetch(ENDPOINTS.CONTABILIDAD_CAJA_SESIONES, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caja_id: caja.id,
        usuario_id: usuarioId,
        fecha_apertura: ahoraIso,
        fecha_cierre: null
      })
    })
    if (!sesionResp.ok) {
      const detalle = await sesionResp.text().catch(() => '')
      throw new Error(detalle || `Error ${sesionResp.status}`)
    }
    const sesionData = (await sesionResp.json().catch(() => ({}))) as Record<string, unknown>
    const sesionIdRaw = (sesionData.data as Record<string, unknown> | undefined)?.id ?? sesionData.id
    sesionCajaSesionId.value = Number.isFinite(Number(sesionIdRaw)) ? Number(sesionIdRaw) : null
    const respuesta = await fetch(`${ENDPOINTS.CONTABILIDAD_CAJAS}${caja.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: caja.nombre ?? String(caja.id),
        saldo_inicial: Number.isFinite(caja.saldo_inicial) ? caja.saldo_inicial : 0,
        estado: 'ABIERTA'
      })
    })
    if (!respuesta.ok) {
      const detalle = await respuesta.text().catch(() => '')
      throw new Error(detalle || `Error ${respuesta.status}`)
    }
    sesionCajaId.value = caja.id
    sesionCajaNombre.value = caja.nombre ?? `Caja ${caja.id}`
    cajas.value = cajas.value.map((item) =>
      item.id === caja.id ? { ...item, estado: 'ABIERTA' } : item
    )
    persistirSesion()
  } catch (err) {
    console.error('No se pudo abrir la caja', err)
    const detalle = err instanceof Error ? err.message : String(err)
    errorCajas.value = `No fue posible abrir la caja. ${detalle}`
  } finally {
    actualizandoCaja.value = false
  }
}

hidratarSesion()
</script>

<template>
  <main class="shell">
    <div v-if="!appOnline" class="offline-banner">
      Sin conexiÃ³n. Modo offline activo.
      <small v-if="appQueueCount">Pendientes por sincronizar: {{ appQueueCount }}</small>
    </div>
    <div v-else-if="appSyncing" class="offline-banner offline-banner--sync">
      Sincronizando datos...
      <small v-if="appQueueCount">Pendientes: {{ appQueueCount }}</small>
    </div>
    <LoginView
      v-if="!sesionIniciada"
      :error="loginError"
      :loading="loginCargando"
      @login="iniciarSesion"
    />
    <template v-else>
      <div :class="['app-layout', { 'app-layout--collapsed': sidebarHidden }]">
        <aside v-if="!sidebarHidden" class="sidebar">
          <div class="sidebar__logo">SEUS POS</div>
          <div class="sidebar__section">
            <span class="sidebar__label">Vistas</span>
            <button
              v-for="vista in vistasSidebar"
              :key="vista.id"
              type="button"
              :class="['sidebar__item', { activa: vista.id === vistaActiva }]"
              :disabled="vista.id === 'pos' && !tieneCajaSeleccionada"
              @click="seleccionarVista(vista.id)"
            >
              <span class="sidebar__item-nombre">{{ vista.nombre }}</span>
              <small class="sidebar__item-desc">{{ vista.descripcion }}</small>
              <span v-if="vista.id === 'ventas-pendientes'" class="sidebar__badge">
                {{ cargandoPendientes ? '...' : ventasPendientes }}
              </span>
            </button>
          </div>
        </aside>

        <section class="app-content">
          <header class="selector">
            <div class="selector__row">
              <button
                type="button"
                class="selector__toggle"
                :aria-label="sidebarHidden ? 'Mostrar menu lateral' : 'Ocultar menu lateral'"
                @click="toggleSidebar"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" class="selector__toggle-icon">
                  <path d="M4 6h16v2H4V6zm0 5h16v2H4v-2zm0 5h16v2H4v-2z" fill="currentColor" />
                </svg>
              </button>
              <div class="selector__cajas">
                <span class="selector__cajas-label">Cajas</span>
                <div class="selector__cajas-lista">
                  <button v-if="cargandoCajas" type="button" class="selector__caja" disabled>
                    Cargando...
                  </button>
                  <button v-else-if="!cajas.length" type="button" class="selector__caja" disabled>
                    Sin cajas
                  </button>
                  <button
                    v-for="caja in cajas"
                    v-else
                    :key="caja.id"
                    type="button"
                    :class="[
                      'selector__caja',
                      { activa: sesionCajaId === caja.id, bloqueada: caja.estado === 'ABIERTA' }
                    ]"
                    :disabled="actualizandoCaja || (cajaAbiertaEnSesion && sesionCajaId !== caja.id && caja.estado !== 'ABIERTA')"
                    @click="seleccionarCaja(caja)"
                  >
                    <span>{{ caja.nombre ?? `Caja ${caja.id}` }}</span>
                    <small v-if="caja.estado === 'ABIERTA'">ABIERTA</small>
                  </button>
                </div>
                <small v-if="errorCajas" class="selector__cajas-error">{{ errorCajas }}</small>
              </div>
            </div>
            <div class="selector__right">
              <div v-if="vistaActiva === 'pos'" class="selector__total">
              <span class="selector__total-label">Total cuenta</span>
              <strong class="selector__total-valor">{{ formatCurrency(totalCuenta) }}</strong>
            </div>
            <div class="selector__sesion">
          <button type="button" class="selector__sesion-boton">
            Sesión: {{ sesionUsuario ?? 'Usuario' }}
            <span v-if="sesionRoles.length" class="selector__sesion-rol">· {{ sesionRoles.join(', ') }}</span>
          </button>
          <span v-if="sesionCajaId" class="selector__sesion-caja">
            {{ sesionCajaNombre ?? `Caja ${sesionCajaId}` }}
          </span>
          <button type="button" class="selector__sesion-cerrar" @click="cerrarSesion">Cerrar sesión</button>
        </div>
            </div>
      </header>

      <section v-if="vistaActiva === 'pos' && !tieneCajaSeleccionada" class="selector__bloqueo">
        Selecciona una caja en el header para habilitar la vista POS.
      </section>
      <MenuPrincipalView
        v-else-if="vistaActiva === 'menu-principal'"
        :vistas="vistasMenuPrincipal"
        :vista-activa="vistaActiva"
        :pos-bloqueado="!tieneCajaSeleccionada"
        :cajas="cajas"
        :cargando-cajas="cargandoCajas"
        :error-cajas="errorCajas"
        :sesion-caja-id="sesionCajaId"
        :caja-abierta-en-sesion="cajaAbiertaEnSesion"
        :actualizando-caja="actualizandoCaja"
        @seleccionar="seleccionarVista"
        @seleccionar-caja="seleccionarCaja"
      />
      <component v-else :is="componenteActual" />
        </section>
      </div>
    </template>
  </main>
</template>

<style scoped>
.shell {
  display: grid;
  gap: 1rem;
}

.app-layout {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  gap: 1rem;
  min-height: calc(100vh - 2rem);
}

.app-layout--collapsed {
  grid-template-columns: minmax(0, 1fr);
}

.sidebar {
  position: sticky;
  top: 1rem;
  align-self: start;
  display: grid;
  gap: 1rem;
  padding: 1rem;
  border-radius: 1rem;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(8, 10, 14, 0.92);
  max-height: calc(100vh - 2rem);
  overflow: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.sidebar::-webkit-scrollbar {
  width: 0;
  height: 0;
}

.sidebar__logo {
  font-weight: 800;
  letter-spacing: 0.08em;
  color: #f8fafc;
  font-size: 0.95rem;
}

.sidebar__section {
  display: grid;
  gap: 0.6rem;
}

.sidebar__label {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.7rem;
  color: #94a3b8;
}

.sidebar__item {
  display: grid;
  gap: 0.1rem;
  text-align: left;
  border-radius: 0.75rem;
  padding: 0.55rem 0.7rem;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(20, 24, 32, 0.6);
  color: #e2e8f0;
  cursor: pointer;
  position: relative;
  transition: border-color 0.15s ease, background 0.15s ease, transform 0.15s ease;
}

.sidebar__item:hover,
.sidebar__item:focus-visible {
  outline: none;
  transform: translateY(-1px);
  border-color: rgba(56, 189, 248, 0.6);
}

.sidebar__item:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.sidebar__item.activa {
  border-color: rgba(56, 189, 248, 0.9);
  background: linear-gradient(140deg, rgba(56, 189, 248, 0.16), rgba(15, 23, 42, 0.65));
}

.sidebar__item-nombre {
  font-weight: 700;
  font-size: 0.9rem;
}

.sidebar__item-desc {
  color: #94a3b8;
  font-size: 0.75rem;
}

.sidebar__badge {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  padding: 0.1rem 0.35rem;
  border-radius: 999px;
  font-size: 0.65rem;
  font-weight: 800;
  color: #0f172a;
  background: #bae6fd;
  border: 1px solid rgba(56, 189, 248, 0.9);
}

.app-content {
  display: grid;
  gap: 1rem;
}

.selector {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
  height: 76px;
  padding: 0.5rem 0.75rem;
  border-radius: 0.9rem;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(10, 11, 14, 0.8);
}

.selector__row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  flex: 1 1 auto;
  min-width: 0;
}

.selector__right {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
  margin-left: auto;
  justify-content: flex-end;
  flex: 0 0 auto;
}

.selector__toggle {
  justify-self: start;
  border: 1px solid rgba(56, 189, 248, 0.45);
  background: rgba(56, 189, 248, 0.15);
  color: #e2e8f0;
  border-radius: 0.7rem;
  padding: 0.35rem;
  font-weight: 600;
  font-size: 0.8rem;
  cursor: pointer;
}

.selector__toggle:hover,
.selector__toggle:focus-visible {
  outline: none;
  border-color: rgba(56, 189, 248, 0.8);
}

.selector__toggle-icon {
  width: 18px;
  height: 18px;
  display: block;
}

.selector__titulo {
  margin: 0;
  font-weight: 700;
  font-size: 0.95rem;
  letter-spacing: 0.02em;
  color: #e2e8f0;
}

.selector__total {
  display: grid;
  gap: 0.25rem;
  justify-items: center;
  align-content: center;
  text-align: center;
  padding: 0.6rem 0.9rem;
  border-radius: 1rem;
  border: 1px solid rgba(250, 204, 21, 0.55);
  background: linear-gradient(135deg, rgba(250, 204, 21, 0.2), rgba(15, 23, 42, 0.55));
  color: #fff7ed;
  min-width: 220px;
}

.selector__total-label {
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: rgba(254, 243, 199, 0.9);
}

.selector__total-valor {
  font-size: 1.5rem;
  font-weight: 800;
  color: #fef3c7;
}

.offline-banner {
  display: grid;
  gap: 0.2rem;
  padding: 0.5rem 0.75rem;
  border-radius: 0.75rem;
  border: 1px solid rgba(248, 113, 113, 0.5);
  background: rgba(127, 29, 29, 0.35);
  color: #fecaca;
  font-weight: 700;
}

.offline-banner small {
  font-weight: 600;
  color: #fee2e2;
}

.offline-banner--sync {
  border-color: rgba(250, 204, 21, 0.45);
  background: rgba(120, 53, 15, 0.35);
  color: #fde68a;
}

.selector__cajas {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.selector__cajas-label {
  font-weight: 600;
  color: #cbd5e1;
}

.selector__cajas-lista {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.selector__caja {
  border: 1px solid rgba(148, 163, 184, 0.28);
  background: rgba(120, 126, 137, 0.14);
  color: #e2e8f0;
  border-radius: 0.65rem;
  padding: 0.25rem 0.45rem;
  font-size: 0.8rem;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  cursor: pointer;
}

.selector__caja small {
  font-size: 0.65rem;
  font-weight: 700;
  padding: 0.1rem 0.3rem;
  border-radius: 999px;
  border: 1px solid rgba(239, 68, 68, 0.5);
  color: #fecaca;
  background: rgba(239, 68, 68, 0.12);
}

.selector__caja.activa {
  border-color: rgba(250, 204, 21, 0.7);
  background: rgba(250, 204, 21, 0.12);
}

.selector__caja.bloqueada {
  border-style: dashed;
  color: #94a3b8;
}

.selector__caja:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.selector__cajas-error {
  color: #f87171;
  font-size: 0.85rem;
}

.selector__sesion {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  justify-content: flex-end;
}

.selector__sesion-boton {
  border: 1px solid rgba(148, 163, 184, 0.28);
  background: rgba(255, 255, 255, 0.06);
  color: #e2e8f0;
  border-radius: 0.75rem;
  padding: 0.35rem 0.6rem;
  font-weight: 600;
  font-size: 0.85rem;
}

.selector__sesion-rol {
  margin-left: 0.35rem;
  color: #cbd5e1;
  font-weight: 500;
  font-size: 0.75rem;
}

.selector__sesion-cerrar {
  border: 1px solid rgba(239, 68, 68, 0.4);
  background: rgba(239, 68, 68, 0.14);
  color: #fee2e2;
  border-radius: 0.75rem;
  padding: 0.35rem 0.6rem;
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
}

.selector__sesion-caja {
  border: 1px solid rgba(148, 163, 184, 0.28);
  background: rgba(255, 255, 255, 0.06);
  color: #e2e8f0;
  border-radius: 0.75rem;
  padding: 0.35rem 0.6rem;
  font-weight: 600;
  font-size: 0.85rem;
}

.selector__bloqueo {
  border: 1px dashed rgba(250, 204, 21, 0.5);
  background: rgba(250, 204, 21, 0.08);
  color: #fde68a;
  border-radius: 0.75rem;
  padding: 1rem;
  font-weight: 600;
}

@media (max-width: 768px) {
  .app-layout {
    grid-template-columns: 1fr;
  }

  .sidebar {
    position: static;
  }
}
</style>
