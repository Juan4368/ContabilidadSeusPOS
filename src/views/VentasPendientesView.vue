<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

type PendingItem = {
  id: number
  fecha: string
  clienteId: number | null
  clienteNombre?: string
  total: number
  items: number
}

const STORAGE_KEY = 'pos_ventas_pendientes'
const pendientes = ref<PendingItem[]>([])

const formatCurrency = (monto: number) =>
  monto.toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0
  })

const cargarPendientes = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const data = raw ? (JSON.parse(raw) as unknown[]) : []
    if (!Array.isArray(data)) {
      pendientes.value = []
      return
    }
    pendientes.value = data
      .map((item) => {
        if (!item || typeof item !== 'object') return null
        const venta = item as Record<string, unknown>
        const id = Number(venta.id ?? venta.venta_id ?? 0)
        const fecha = String(venta.fecha ?? '')
        const clienteId = (venta.clienteId ?? venta.cliente_id ?? null) as number | null
        const clienteNombre = (venta.clienteNombre ?? venta.cliente_nombre ?? '') as string
        const items = Array.isArray(venta.items) ? venta.items.length : Number(venta.items ?? 0)
        const resumen = venta.resumen as Record<string, unknown> | undefined
        const totalRaw = resumen?.total ?? venta.total ?? 0
        const total = Number(totalRaw || 0)
        return { id, fecha, clienteId, clienteNombre, items, total }
      })
      .filter(Boolean) as PendingItem[]
  } catch {
    pendientes.value = []
  }
}

const abrirPendiente = (item: PendingItem) => {
  localStorage.setItem('pos_pendiente_seleccion', String(item.id))
  window.dispatchEvent(new CustomEvent('app:cambiar-vista', { detail: { vista: 'pos' } }))
  window.setTimeout(() => {
    window.dispatchEvent(new CustomEvent('pos:cargar-pendiente'))
  }, 50)
}

onMounted(() => {
  cargarPendientes()
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
      <button type="button" class="boton secundario" @click="cargarPendientes">Recargar</button>
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
