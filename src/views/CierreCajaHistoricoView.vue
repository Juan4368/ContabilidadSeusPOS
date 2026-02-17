<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ENDPOINTS } from '../config/endpoints'

const HISTORICO_CIERRE_URL = ENDPOINTS.CONTABILIDAD_CIERRE_CAJA_DENOMINACIONES

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

const registros = ref<RegistroCierre[]>([])
const cargando = ref(false)
const error = ref<string | null>(null)
const filtroDesde = ref('')
const filtroHasta = ref('')
const usuariosPorId = ref<Record<number, string>>({})
const cajasPorId = ref<Record<number, string>>({})

const formatearMoneda = (valor: number) =>
  valor.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })

const normalizarFecha = (valor?: string | null) => {
  if (!valor) return null
  const dt = new Date(valor)
  return Number.isNaN(dt.getTime()) ? null : dt
}

const obtenerFechaRegistro = (item: RegistroCierre & { fecha_cierre?: string | null }) =>
  item.fecha_conteo ?? item.fecha_cierre ?? null

const registrosFiltrados = computed(() => {
  const desde = filtroDesde.value ? new Date(`${filtroDesde.value}T00:00:00`) : null
  const hasta = filtroHasta.value ? new Date(`${filtroHasta.value}T23:59:59`) : null
  return registros.value.filter((item) => {
    const fecha = normalizarFecha(obtenerFechaRegistro(item))
    if (desde && (!fecha || fecha < desde)) return false
    if (hasta && (!fecha || fecha > hasta)) return false
    return true
  })
})

const totalFiltrado = computed(() =>
  registrosFiltrados.value.reduce((acc, item) => acc + Number(item.subtotal ?? 0), 0)
)

const graficaBarras = computed(() => {
  const acumulado = new Map<string, number>()
  for (const item of registrosFiltrados.value) {
    const fecha = normalizarFecha(obtenerFechaRegistro(item))
    if (!fecha) continue
    const claveFecha = fecha.toISOString().slice(0, 10)
    acumulado.set(claveFecha, (acumulado.get(claveFecha) ?? 0) + Number(item.subtotal ?? 0))
  }

  const serie = Array.from(acumulado.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-14)

  const maximo = Math.max(...serie.map(([, total]) => total), 0)
  return serie.map(([fecha, total]) => {
    const alturaPct = maximo <= 0 ? 8 : Math.max((total / maximo) * 100, 8)
    return {
      fecha,
      total,
      alturaPct,
      etiqueta: new Date(`${fecha}T00:00:00`).toLocaleDateString('es-CO', {
        month: 'short',
        day: '2-digit'
      })
    }
  })
})

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
  const baseUrl = ENDPOINTS.USUARIOS
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
  const baseUrl = ENDPOINTS.CONTABILIDAD_CAJAS
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
    const lista = Array.isArray(data)
      ? data
      : Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data?.results)
          ? data.results
          : []
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
      <div class="historico__resumen">
        <span class="historico__resumen-label">Total filtrado</span>
        <strong class="historico__resumen-valor">{{ formatearMoneda(totalFiltrado) }}</strong>
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

    <section class="historico__grafica">
      <div class="historico__grafica-header">
        <h2>Totales por cierre (ultimos 14 dias)</h2>
      </div>
      <p v-if="graficaBarras.length === 0" class="nota-ayuda">No hay datos para graficar con el filtro actual.</p>
      <div v-else class="barras">
        <div v-for="barra in graficaBarras" :key="barra.fecha" class="barra-item">
          <span class="barra-item__valor">{{ formatearMoneda(barra.total) }}</span>
          <div class="barra-item__columna">
            <div class="barra-item__relleno" :style="{ height: `${barra.alturaPct}%` }" />
          </div>
          <span class="barra-item__fecha">{{ barra.etiqueta }}</span>
        </div>
      </div>
    </section>

    <section class="historico__tabla">
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
            <td>{{ obtenerFechaRegistro(item) || '-' }}</td>
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

.historico__resumen {
  display: grid;
  gap: 0.35rem;
  padding: 0.7rem 0.9rem;
  border-radius: 0.85rem;
  border: 1px solid rgba(56, 189, 248, 0.3);
  background: rgba(14, 20, 28, 0.9);
  min-width: 200px;
}

.historico__resumen-label {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #94a3b8;
}

.historico__resumen-valor {
  font-size: 1.1rem;
  color: #a7f3d0;
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

.historico__grafica {
  border-radius: 1rem;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(13, 15, 20, 0.88);
  padding: 0.9rem;
}

.historico__grafica-header h2 {
  margin: 0 0 0.8rem;
  font-size: 0.9rem;
  color: #cbd5e1;
  font-weight: 700;
}

.barras {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(76px, 1fr));
  gap: 0.6rem;
  align-items: end;
}

.barra-item {
  display: grid;
  gap: 0.35rem;
  align-items: end;
}

.barra-item__valor {
  font-size: 0.7rem;
  color: #9bd2ff;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.barra-item__columna {
  height: 150px;
  border-radius: 0.65rem;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: linear-gradient(180deg, rgba(30, 41, 59, 0.3), rgba(15, 23, 42, 0.8));
  display: flex;
  align-items: flex-end;
  overflow: hidden;
}

.barra-item__relleno {
  width: 100%;
  min-height: 2px;
  border-radius: 0.55rem 0.55rem 0 0;
  background: linear-gradient(180deg, #38bdf8, #0ea5e9);
}

.barra-item__fecha {
  font-size: 0.68rem;
  color: #94a3b8;
  text-align: center;
  text-transform: uppercase;
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
