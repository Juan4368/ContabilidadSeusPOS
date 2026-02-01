<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import POSView from './views/POSView.vue'
import StockView from './views/StockView.vue'
import AdminView from './views/AdminView.vue'
import ProductosView from './views/ProductosView.vue'
import VentasPendientesView from './views/VentasPendientesView.vue'
import ContabilidadView from './views/ContabilidadView.vue'
import CarteraView from './views/CarteraView.vue'
import LoginView from './views/LoginView.vue'

type VistaId =
  | 'pos'
  | 'contabilidad'
  | 'cartera'
  | 'stock'
  | 'admin'
  | 'productos'
  | 'ventas-pendientes'

const vistaActiva = ref<VistaId>('pos')
const sesionIniciada = ref(false)
const sesionUsuario = ref<string | null>(null)
const sesionRoles = ref<string[]>([])
const loginError = ref('')
const loginCargando = ref(false)
const LOGIN_ENDPOINT = 'http://127.0.0.1:8001/auth/login'

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

const vistas: Array<{ id: VistaId; nombre: string; descripcion: string; componente: typeof POSView }> = [
  { id: 'pos', nombre: 'POS', descripcion: 'Cobro en mostrador', componente: POSView },
  { id: 'contabilidad', nombre: 'Contabilidad', descripcion: 'Ingresos, egresos y cartera', componente: ContabilidadView },
  { id: 'cartera', nombre: 'Cartera', descripcion: 'Cuentas por cobrar', componente: CarteraView },
  { id: 'stock', nombre: 'Stock', descripcion: 'Inventario y reposicion', componente: StockView },
  { id: 'admin', nombre: 'Admin', descripcion: 'Usuarios y categorias', componente: AdminView },
  { id: 'productos', nombre: 'Productos', descripcion: 'Catalogo y precios', componente: ProductosView },
  { id: 'ventas-pendientes', nombre: 'Ventas pendientes', descripcion: 'Recuperar ventas', componente: VentasPendientesView }
]

const componenteActual = computed(() => vistas.find((vista) => vista.id === vistaActiva.value)?.componente ?? POSView)

const cambiarVista = (event: Event) => {
  const detalle = (event as CustomEvent<{ vista: VistaId }>).detail
  if (detalle?.vista) {
    vistaActiva.value = detalle.vista
  }
}

onMounted(() => {
  window.addEventListener('app:cambiar-vista', cambiarVista as EventListener)
})

onBeforeUnmount(() => {
  window.removeEventListener('app:cambiar-vista', cambiarVista as EventListener)
})

const iniciarSesion = async (credenciales: { usuario: string; contrasena: string }) => {
  loginError.value = ''
  loginCargando.value = true
  try {
    const respuesta = await fetch(LOGIN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: credenciales.usuario, password: credenciales.contrasena })
    })
    if (!respuesta.ok) {
      const detalle = await respuesta.text().catch(() => '')
      throw new Error(detalle || `Error ${respuesta.status}`)
    }
    const data = (await respuesta.json().catch(() => ({}))) as Record<string, unknown>
    const token = String(data.access_token ?? data.token ?? data.access ?? '')
    const payload = token ? parseJwt(token) : null
    const roles = Array.isArray(payload?.roles) ? (payload?.roles as string[]) : []
    sesionUsuario.value = String(payload?.username ?? data.username ?? credenciales.usuario)
    sesionRoles.value = roles
    sesionIniciada.value = true
    localStorage.setItem(
      'pos_sesion',
      JSON.stringify({ usuario: sesionUsuario.value, roles, token })
    )
    window.dispatchEvent(new Event('pos:sesion-actualizada'))
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'No fue posible iniciar sesión.'
    loginError.value = mensaje
  } finally {
    loginCargando.value = false
  }
}

const cerrarSesion = () => {
  sesionIniciada.value = false
  sesionUsuario.value = null
  sesionRoles.value = []
  loginError.value = ''
  localStorage.removeItem('pos_sesion')
  window.dispatchEvent(new Event('pos:sesion-actualizada'))
}

const hidratarSesion = () => {
  try {
    const raw = localStorage.getItem('pos_sesion')
    if (!raw) return
    const data = JSON.parse(raw) as { usuario?: string; roles?: string[] }
    if (data?.usuario) {
      sesionUsuario.value = data.usuario
      sesionRoles.value = Array.isArray(data.roles) ? data.roles : []
      sesionIniciada.value = true
    }
  } catch {
    localStorage.removeItem('pos_sesion')
  }
}

hidratarSesion()
</script>

<template>
  <main class="shell">
    <LoginView
      v-if="!sesionIniciada"
      :error="loginError"
      :loading="loginCargando"
      @login="iniciarSesion"
    />
    <template v-else>
      <header class="selector">
        <p class="selector__titulo">Vistas disponibles</p>
        <div class="selector__botones">
          <button
            v-for="vista in vistas"
            :key="vista.id"
            type="button"
            :class="['selector__boton', { activa: vista.id === vistaActiva }]"
            @click="vistaActiva = vista.id"
          >
            <span class="selector__nombre">{{ vista.nombre }}</span>
            <small class="selector__descripcion">{{ vista.descripcion }}</small>
          </button>
        </div>
        <div class="selector__sesion">
          <button type="button" class="selector__sesion-boton">
            Sesión: {{ sesionUsuario ?? 'Usuario' }}
            <span v-if="sesionRoles.length" class="selector__sesion-rol">· {{ sesionRoles.join(', ') }}</span>
          </button>
          <button type="button" class="selector__sesion-cerrar" @click="cerrarSesion">Cerrar sesión</button>
        </div>
      </header>

      <component :is="componenteActual" />
    </template>
  </main>
</template>

<style scoped>
.shell {
  display: grid;
  gap: 1rem;
}

.selector {
  display: grid;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-radius: 0.9rem;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(10, 11, 14, 0.8);
}

.selector__titulo {
  margin: 0;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: #e2e8f0;
}

.selector__botones {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.selector__sesion {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: flex-end;
}

.selector__sesion-boton {
  border: 1px solid rgba(148, 163, 184, 0.28);
  background: rgba(255, 255, 255, 0.06);
  color: #e2e8f0;
  border-radius: 0.75rem;
  padding: 0.5rem 0.8rem;
  font-weight: 600;
}

.selector__sesion-rol {
  margin-left: 0.35rem;
  color: #cbd5e1;
  font-weight: 500;
  font-size: 0.85rem;
}

.selector__sesion-cerrar {
  border: 1px solid rgba(239, 68, 68, 0.4);
  background: rgba(239, 68, 68, 0.14);
  color: #fee2e2;
  border-radius: 0.75rem;
  padding: 0.5rem 0.8rem;
  font-weight: 600;
  cursor: pointer;
}

.selector__boton {
  background: rgba(120, 126, 137, 0.14);
  border: 1px solid rgba(148, 163, 184, 0.28);
  color: #e2e8f0;
  border-radius: 0.75rem;
  padding: 0.6rem 0.85rem;
  min-width: 160px;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s ease, background 0.15s ease, transform 0.15s ease;
}

.selector__boton:hover,
.selector__boton:focus-visible {
  outline: none;
  transform: translateY(-1px);
  border-color: rgba(250, 204, 21, 0.55);
}

.selector__boton.activa {
  background: linear-gradient(130deg, rgba(250, 204, 21, 0.16), rgba(255, 255, 255, 0.06));
  border-color: rgba(250, 204, 21, 0.7);
}

.selector__nombre {
  display: block;
  font-weight: 700;
}

.selector__descripcion {
  display: block;
  color: #cbd5e1;
}

@media (max-width: 768px) {
}
</style>

