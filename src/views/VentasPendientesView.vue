<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import SessionRoleChip from '../components/SessionRoleChip.vue'
import { ENDPOINTS } from '../config/endpoints'

type PendingItem = {
  id: number
  fecha: string
  clienteId: number | null
  clienteNombre?: string
  total: number
  items: number
}

const VENTAS_ENDPOINT = ENDPOINTS.VENTAS_LOCAL
const CLIENTES_ENDPOINT = ENDPOINTS.CLIENTES
const pendientes = ref<PendingItem[]>([])
const clientesMap = new Map<string, string>()

const formatCurrency = (monto: number) =>
  monto.toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0
  })

const cargarClientes = async () => {
  try {
    const respuesta = await fetch(CLIENTES_ENDPOINT)
    if (!respuesta.ok) {
      throw new Error(`Error ${respuesta.status}`)
    }
    const data = await respuesta.json()
    const lista = Array.isArray(data) ? data : Array.isArray(data.results) ? data.results : Array.isArray(data.data) ? data.data : []
    clientesMap.clear()
    lista.forEach((item: unknown, index: number) => {
      if (!item || typeof item !== 'object') return
      const cliente = item as Record<string, unknown>
      const id = String(cliente.cliente_id ?? cliente.id ?? cliente.pk ?? index + 1)
      const nombre = String(cliente.nombre ?? cliente.name ?? '')
      if (id && nombre) clientesMap.set(id, nombre)
    })
  } catch {
    clientesMap.clear()
  }
}

const cargarPendientes = async () => {
  try {
    const respuesta = await fetch(`${VENTAS_ENDPOINT}?estado=false`)
    if (!respuesta.ok) {
      throw new Error(`Error ${respuesta.status}`)
    }
    const data = await respuesta.json()
    const lista = Array.isArray(data) ? data : Array.isArray(data.results) ? data.results : Array.isArray(data.data) ? data.data : []
    pendientes.value = lista
      .map((item: unknown) => {
        if (!item || typeof item !== 'object') return null
        const venta = item as Record<string, unknown>
        const estadoRaw = venta.estado
        const esPendiente = estadoRaw === false || estadoRaw === 'pendiente'
        if (!esPendiente) return null
        const id = Number(venta.venta_id ?? venta.id ?? 0)
        const fecha = String(venta.fecha ?? '')
        const clienteIdRaw = venta.cliente_id ?? venta.clienteId ?? null
        const clienteId = (clienteIdRaw ?? null) as number | null
        const clienteIdStr = clienteIdRaw ? String(clienteIdRaw) : ''
        const clienteNombre = (venta.cliente_nombre ??
          venta.clienteNombre ??
          (venta.cliente as Record<string, unknown> | undefined)?.nombre ??
          clientesMap.get(clienteIdStr) ??
          '') as string
        const detalles = venta.detalles
        const items = Array.isArray(detalles) ? detalles.length : Number(venta.items ?? 0)
        const total = Number(venta.total ?? 0)
        return { id, fecha, clienteId, clienteNombre, items, total }
      })
      .filter(Boolean) as PendingItem[]
  } catch {
    pendientes.value = []
  }
}

const abrirPendiente = async (item: PendingItem) => {
  try {
    const respuesta = await fetch(`${VENTAS_ENDPOINT}${item.id}`)
    if (!respuesta.ok) {
      throw new Error(`Error ${respuesta.status}`)
    }
    const venta = (await respuesta.json()) as Record<string, unknown>
    window.dispatchEvent(new CustomEvent('app:cambiar-vista', { detail: { vista: 'pos' } }))
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent('pos:cargar-pendiente', { detail: { venta } }))
    }, 50)
  } catch {
    // Ignora errores para evitar bloquear el flujo
  }
}

onMounted(() => {
  void cargarClientes().then(cargarPendientes)
  window.addEventListener('pos:pendientes-actualizados', cargarPendientes as EventListener)
  window.addEventListener('focus', cargarPendientes)
})

onBeforeUnmount(() => {
  window.removeEventListener('pos:pendientes-actualizados', cargarPendientes as EventListener)
  window.removeEventListener('focus', cargarPendientes)
})
</script>

<template>
  <main class="pendientes-venta">
    <header class="pendientes-venta__cabecera">
      <div>
        <p class="pendientes-venta__prefijo">Ventas</p>
        <h1>Ventas pendientes</h1>
        <p>Selecciona una venta para continuarla en POS.</p>
      </div>
      <div class="pendientes-venta__acciones">
        <SessionRoleChip />
        <button type="button" class="boton secundario" @click="cargarPendientes">Recargar</button>
      </div>
    </header>

    <section class="panel">
      <div v-if="pendientes.length === 0" class="vacio">No hay ventas pendientes.</div>
      <ul v-else class="lista">
        <li v-for="item in pendientes" :key="item.id" class="lista__item" @click="abrirPendiente(item)">
          <div class="detalle">
            <strong>Venta #{{ item.id }}</strong>
            <small>{{ item.clienteNombre || 'Sin cliente' }}</small>
            <small>{{ item.fecha }}</small>
          </div>
          <div class="meta">
            <span class="total">{{ formatCurrency(item.total) }}</span>
          </div>
        </li>
      </ul>
    </section>
  </main>
</template>

<style scoped>
.pendientes-venta {
  display: grid;
  gap: 1.5rem;
}

.pendientes-venta__cabecera {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.pendientes-venta__acciones {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: flex-end;
}

.pendientes-venta__prefijo {
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.8rem;
  color: #94a3b8;
}

.panel {
  background: #0d0f14;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 1rem;
  padding: 1.25rem;
  display: grid;
  gap: 1rem;
}

.lista {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.7rem;
}

.lista li {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 1rem;
  align-items: center;
  padding: 0.8rem 1rem;
  border-radius: 0.9rem;
  border: 1px solid rgba(148, 163, 184, 0.22);
  background: #0f1015;
  cursor: pointer;
  transition: border-color 0.15s ease, transform 0.15s ease;
}

.lista li:hover {
  border-color: rgba(226, 232, 240, 0.35);
  transform: translateY(-1px);
}

.detalle {
  display: grid;
  gap: 0.2rem;
}

.lista small {
  color: #94a3b8;
}

.meta {
  display: grid;
  gap: 0.2rem;
  text-align: right;
  color: #cbd5e1;
}

.total {
  color: #facc15;
  font-weight: 700;
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

.boton.secundario {
  background: rgba(120, 126, 137, 0.2);
  color: #e2e8f0;
  box-shadow: none;
  border: 1px solid rgba(148, 163, 184, 0.3);
}

.vacio {
  text-align: center;
  color: #94a3b8;
  border: 1px dashed rgba(148, 163, 184, 0.35);
  border-radius: 1rem;
  padding: 2rem 1rem;
}

@media (max-width: 720px) {
  .pendientes-venta__cabecera {
    flex-direction: column;
  }

  .lista li {
    grid-template-columns: 1fr;
    justify-items: start;
  }
}
</style>

