<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
const HISTORICO_CIERRE_URL = 'http://127.0.0.1:8000/contabilidad/cierre-caja-denominaciones/'

type RegistroCierre = {
  id?: number
  caja_id?: number | null
  usuario_id?: number | null
  denominacion?: number | string
  cantidad?: number | string
  subtotal?: number | string
  fecha_conteo?: string | null
}

type Usuario = {
  id: number
  nombre?: string
  username?: string
  usuario?: string
}

type Caja = {
  id: number
  nombre?: string
  descripcion?: string
}

const fechaHoy = () => {
  const hoy = new Date()
  const pad = (num: number) => num.toString().padStart(2, '0')
  return `${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}-${pad(hoy.getDate())}`
}

const registros = ref<RegistroCierre[]>([])
const cargando = ref(false)
const error = ref<string | null>(null)
const filtroDesde = ref(fechaHoy())
const filtroHasta = ref(fechaHoy())
const usuariosPorId = ref<Record<number, string>>({})
const cajasPorId = ref<Record<number, string>>({})

const formatearMoneda = (valor: number) =>
  valor.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })

const normalizarFecha = (valor?: string | null) => {
  if (!valor) return null
  const dt = new Date(valor)
  return Number.isNaN(dt.getTime()) ? null : dt
}

const registrosFiltrados = computed(() => {
  const desde = filtroDesde.value ? new Date(`${filtroDesde.value}T00:00:00`) : null
  const hasta = filtroHasta.value ? new Date(`${filtroHasta.value}T23:59:59`) : null
  return registros.value.filter((item) => {
    const fecha = normalizarFecha(item.fecha_conteo)
    if (desde && (!fecha || fecha < desde)) return false
    if (hasta && (!fecha || fecha > hasta)) return false
    return true
  })
})

const totalFiltrado = computed(() =>
  registrosFiltrados.value.reduce((acc, item) => acc + Number(item.subtotal ?? 0), 0)
)

const obtenerNombreUsuario = (id?: number | null) => {
  if (!id) return '-'
  return usuariosPorId.value[id] ?? String(id)
}

const obtenerNombreCaja = (id?: number | null) => {
  if (!id) return '-'
  return cajasPorId.value[id] ?? String(id)
}

const cargarUsuarios = async (ids: number[]) => {
  const pendientes = ids.filter((id) => Number.isFinite(id) && !usuariosPorId.value[id])
  if (pendientes.length === 0) return
  const baseUrl = 'http://127.0.0.1:8000/usuarios/'
  await Promise.all(
    pendientes.map(async (id) => {
      try {
        const respuesta = await fetch(`${baseUrl}${id}`)
        if (!respuesta.ok) return
        const data = (await respuesta.json()) as Usuario
        const nombre = data.nombre || data.username || data.usuario || `Usuario ${id}`
        usuariosPorId.value = { ...usuariosPorId.value, [id]: nombre }
      } catch {
        // ignora errores por usuario
      }
    })
  )
}

const cargarCajas = async (ids: number[]) => {
  const pendientes = ids.filter((id) => Number.isFinite(id) && !cajasPorId.value[id])
  if (pendientes.length === 0) return
  const baseUrl = 'http://127.0.0.1:8000/contabilidad/cajas/'
  await Promise.all(
    pendientes.map(async (id) => {
      try {
        const respuesta = await fetch(`${baseUrl}${id}`)
        if (!respuesta.ok) return
        const data = (await respuesta.json()) as Caja
        const nombre = data.nombre || data.descripcion || `Caja ${id}`
        cajasPorId.value = { ...cajasPorId.value, [id]: nombre }
      } catch {
        // ignora errores por caja
      }
    })
  )
}

const cargarHistorico = async () => {
  cargando.value = true
  error.value = null
  try {
    const respuesta = await fetch(HISTORICO_CIERRE_URL)
    if (!respuesta.ok) {
      const detalle = await respuesta.text().catch(() => '')
      throw new Error(detalle || `Error ${respuesta.status}`)
    }
    const data = await respuesta.json()
    const lista = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : []
    registros.value = (lista as RegistroCierre[]).slice().reverse()
    const ids = Array.from(
      new Set(
        registros.value
          .map((item) => Number(item.usuario_id ?? 0))
          .filter((id) => Number.isFinite(id) && id > 0)
      )
    )
    void cargarUsuarios(ids)
    const cajaIds = Array.from(
      new Set(
        registros.value
          .map((item) => Number(item.caja_id ?? 0))
          .filter((id) => Number.isFinite(id) && id > 0)
      )
    )
    void cargarCajas(cajaIds)
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err)
    error.value = `No se pudo cargar el historico. ${detalle}`
  } finally {
    cargando.value = false
  }
}

onMounted(() => {
  void cargarHistorico()
})
</script>

<template>
  <main class="historico">
    <header class="historico__header">
      <div>
        <p class="historico__overline">Cierre de caja</p>
        <h1>Historico de cierres</h1>
        <p class="historico__sub">Consulta los cierres guardados por fecha.</p>
      </div>
      <div class="historico__filtros">
        <label>
          <span>Desde</span>
          <input v-model="filtroDesde" type="date" />
        </label>
        <label>
          <span>Hasta</span>
          <input v-model="filtroHasta" type="date" />
        </label>
        <button type="button" class="boton secundario" @click="cargarHistorico" :disabled="cargando">
          {{ cargando ? 'Actualizando...' : 'Actualizar' }}
        </button>
      </div>
    </header>

    <section class="historico__tabla">
      <div class="historico__totales">
        <span>Total filtrado: {{ formatearMoneda(totalFiltrado) }}</span>
      </div>
      <p v-if="error" class="nota-error">{{ error }}</p>
      <p v-if="!cargando && registrosFiltrados.length === 0" class="nota-ayuda">Sin registros.</p>
      <table v-else class="tabla__grid">
        <colgroup>
          <col style="width: 26%" />
          <col style="width: 8%" />
          <col style="width: 8%" />
          <col style="width: 18%" />
          <col style="width: 18%" />
          <col style="width: 22%" />
        </colgroup>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Caja</th>
            <th>Usuario</th>
            <th class="col-num">Denominacion</th>
            <th class="col-num">Cantidad</th>
            <th class="col-num">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in registrosFiltrados" :key="item.id ?? `${item.caja_id}-${item.fecha_conteo}`">
            <td>{{ item.fecha_conteo || '-' }}</td>
            <td>{{ obtenerNombreCaja(item.caja_id) }}</td>
            <td>{{ obtenerNombreUsuario(item.usuario_id) }}</td>
            <td class="col-num">{{ Number(item.denominacion ?? 0).toLocaleString('es-CO') }}</td>
            <td class="col-num">{{ Number(item.cantidad ?? 0).toLocaleString('es-CO') }}</td>
            <td class="col-num">
              {{ formatearMoneda(Number(item.subtotal ?? 0)) }}
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  </main>
</template>

<style scoped>
.historico {
  display: grid;
  gap: 1rem;
  padding: 1rem 1.2rem;
  color: #e2e8f0;
}

.historico__header {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: flex-end;
  justify-content: space-between;
  padding: 1rem 1.2rem;
  border-radius: 1rem;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(12, 14, 18, 0.8);
}

.historico__overline {
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.75rem;
  color: #94a3b8;
}

.historico__sub {
  margin: 0.3rem 0 0;
  color: #cbd5e1;
}

.historico__filtros {
  display: flex;
  gap: 0.6rem;
  flex-wrap: wrap;
  align-items: flex-end;
}

.historico__filtros label {
  display: grid;
  gap: 0.3rem;
  font-size: 0.75rem;
  font-weight: 600;
}

.historico__filtros input {
  border-radius: 0.6rem;
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: rgba(10, 12, 18, 0.9);
  color: #e2e8f0;
  padding: 0.35rem 0.55rem;
  min-width: 150px;
}

.historico__tabla {
  border-radius: 1rem;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(13, 15, 20, 0.88);
  padding: 0.75rem;
  overflow-x: auto;
}

.historico__totales {
  margin-bottom: 0.6rem;
  color: #bbf7d0;
  font-weight: 700;
}

.tabla__grid {
  width: 100%;
  border-collapse: collapse;
  color: #e2e8f0;
  font-size: 0.9rem;
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

.tabla__grid thead th.col-num {
  text-align: left;
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
  text-align: left;
  font-variant-numeric: tabular-nums;
}

.nota-error {
  color: #fca5a5;
  margin: 0 0 0.5rem;
}

.nota-ayuda {
  color: #9ca3af;
  margin: 0 0 0.5rem;
}
</style>
