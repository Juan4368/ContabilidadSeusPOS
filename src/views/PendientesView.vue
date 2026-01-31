<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import SessionRoleChip from '../components/SessionRoleChip.vue'

import { crearCartera } from '../services/cartera'
import { crearIngreso } from '../services/ingresos'
import type { Categoria, RegistroPayload, TipoRegistro } from '../services/tipos'

type PendienteItem = {
  id: string
  tipo: TipoRegistro
  payload: RegistroPayload
  categoriaNombre: string
}

const CACHE_CATEGORIAS_KEY = 'finanzas_categorias_cache'
const queueKeyRegistros = (tipo: TipoRegistro) => `finanzas_${tipo}_queue`
const tipos: TipoRegistro[] = ['ingresos', 'cartera']

const pendientes = ref<PendienteItem[]>([])
const categorias = ref<Categoria[]>([])
const isOnline = ref(typeof navigator !== 'undefined' ? navigator.onLine : true)
const sincronizando = ref(false)
const syncMensaje = ref<string | null>(null)

const leerJson = <T,>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

const cargarPendientes = () => {
  categorias.value = leerJson<Categoria[]>(CACHE_CATEGORIAS_KEY) ?? []
  const categoriasPorId = new Map(categorias.value.map((categoria) => [categoria.id, categoria.nombre]))
  const lista: PendienteItem[] = []

  tipos.forEach((tipo) => {
    const cola = leerJson<RegistroPayload[]>(queueKeyRegistros(tipo)) ?? []
    cola.forEach((payload, index) => {
      const categoriaId = payload.categoriaId ?? 0
      lista.push({
        id: `${tipo}-${index}-${payload.fecha}-${categoriaId}`,
        tipo,
        payload,
        categoriaNombre: categoriasPorId.get(categoriaId) ?? 'Sin categoría'
      })
    })
  })

  pendientes.value = lista
}

const totalPendientes = computed(() => pendientes.value.length)

const actualizarEstadoConexion = () => {
  isOnline.value = navigator.onLine
}

const sincronizarCola = async (tipo: TipoRegistro, accionCrear: (payload: RegistroPayload) => Promise<unknown>) => {
  const cola = leerJson<RegistroPayload[]>(queueKeyRegistros(tipo)) ?? []
  if (!cola.length) return

  for (let i = 0; i < cola.length; i += 1) {
    const payload = cola[i]
    await accionCrear(payload)
  }

  localStorage.removeItem(queueKeyRegistros(tipo))
}

const sincronizarTodo = async () => {
  if (!isOnline.value) {
    syncMensaje.value = 'Sin conexión. No se pudo sincronizar.'
    return
  }

  sincronizando.value = true
  syncMensaje.value = null

  try {
    await sincronizarCola('ingresos', crearIngreso)
    await sincronizarCola('cartera', crearCartera)
    cargarPendientes()
    syncMensaje.value = 'Sincronización completa.'
  } catch (error) {
    console.error('Error al sincronizar pendientes', error)
    syncMensaje.value = 'Error al sincronizar. Intenta de nuevo.'
  } finally {
    sincronizando.value = false
  }
}

onMounted(() => {
  cargarPendientes()
  window.addEventListener('online', actualizarEstadoConexion)
  window.addEventListener('offline', actualizarEstadoConexion)
})

onBeforeUnmount(() => {
  window.removeEventListener('online', actualizarEstadoConexion)
  window.removeEventListener('offline', actualizarEstadoConexion)
})
</script>

<template>
  <main class="pendientes">
    <header class="pendientes__encabezado">
      <div>
        <p class="pendientes__prefijo">Control offline</p>
        <h1>Pendientes</h1>
        <p>Registros guardados sin conexión.</p>
      </div>
      <div class="pendientes__acciones">
        <SessionRoleChip />
        <span class="chip" :class="isOnline ? 'chip--online' : 'chip--offline'">
          {{ isOnline ? 'En línea' : 'Offline' }}
        </span>
        <span v-if="totalPendientes" class="chip chip--pendientes">Pendientes: {{ totalPendientes }}</span>
        <button type="button" class="boton" @click="cargarPendientes">Recargar</button>
        <button type="button" class="boton boton--secundario" :disabled="sincronizando" @click="sincronizarTodo">
          {{ sincronizando ? 'Sincronizando...' : 'Sincronizar' }}
        </button>
      </div>
    </header>
    <p v-if="syncMensaje" class="pendientes__mensaje">{{ syncMensaje }}</p>

    <section class="pendientes__lista">
      <div v-if="pendientes.length === 0" class="pendientes__vacio">No hay registros pendientes.</div>
      <article v-for="item in pendientes" :key="item.id" class="pendiente">
        <div>
          <h2>{{ item.categoriaNombre }}</h2>
          <p>{{ item.payload.notas || 'Sin notas' }}</p>
          <small>{{ item.payload.fecha || 'Sin fecha' }}</small>
        </div>
        <div class="pendiente__meta">
          <span class="pendiente__tag">{{ item.tipo }}</span>
          <span class="pendiente__monto">{{ item.payload.monto }}</span>
        </div>
      </article>
    </section>
  </main>
</template>

<style scoped>
.pendientes {
  display: grid;
  gap: 1.5rem;
}

.pendientes__encabezado {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.pendientes__prefijo {
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.8rem;
  color: #94a3b8;
}

.pendientes__encabezado h1 {
  margin: 0;
  font-size: clamp(2rem, 4vw, 2.6rem);
}

.pendientes__encabezado p {
  margin: 0.35rem 0 0;
  color: #cbd5e1;
}

.pendientes__acciones {
  display: flex;
  align-items: center;
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

.chip--pendientes {
  background: rgba(250, 204, 21, 0.14);
  border-color: rgba(250, 204, 21, 0.45);
  color: #fef9c3;
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

.boton--secundario {
  background: rgba(120, 126, 137, 0.2);
  color: #e2e8f0;
  border: 1px solid rgba(148, 163, 184, 0.3);
}

.boton:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.pendientes__mensaje {
  margin: 0;
  text-align: center;
  color: #cbd5e1;
}

.pendientes__lista {
  display: grid;
  gap: 0.9rem;
}

.pendientes__vacio {
  text-align: center;
  color: #94a3b8;
  border: 1px dashed rgba(148, 163, 184, 0.35);
  border-radius: 1rem;
  padding: 2rem 1rem;
}

.pendiente {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  border: 1px solid rgba(148, 163, 184, 0.25);
  border-radius: 1rem;
  padding: 1rem 1.25rem;
  background: #0d0f14;
}

.pendiente h2 {
  margin: 0;
  font-size: 1.05rem;
}

.pendiente p {
  margin: 0.4rem 0 0;
  color: #cbd5e1;
}

.pendiente small {
  color: #94a3b8;
}

.pendiente__meta {
  display: grid;
  gap: 0.4rem;
  text-align: right;
}

.pendiente__tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  padding: 0.2rem 0.6rem;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  background: rgba(250, 204, 21, 0.15);
  border: 1px solid rgba(250, 204, 21, 0.4);
  color: #fef9c3;
}

.pendiente__monto {
  color: #facc15;
  font-weight: 700;
}

@media (max-width: 640px) {
  .pendiente {
    flex-direction: column;
  }

  .pendiente__meta {
    text-align: left;
  }
}
</style>
