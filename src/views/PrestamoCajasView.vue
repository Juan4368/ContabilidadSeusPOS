<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ENDPOINTS } from '../config/endpoints'
import { getSessionUserName } from '../utils/session'

type PrestamoCaja = {
  id: number
  nombre: string
  cajero: string
  actualizado_por: string
  cantidad_cajas: number
  entregado: boolean
  fecha: string
}

const prestamos = ref<PrestamoCaja[]>([])
const cargando = ref(false)
const error = ref<string | null>(null)
const filtroNombre = ref('')
const mostrarCrear = ref(false)
const guardando = ref(false)
const errorCrear = ref<string | null>(null)
const formCrear = ref({
  nombre: '',
  cantidad_cajas: 0,
  entregado: false,
  fecha: ''
})
const itemEditando = ref<PrestamoCaja | null>(null)
const formEditar = ref({
  nombre: '',
  cantidad_cajas: 0,
  entregado: false,
  fecha: ''
})

const totalCajasPrestadas = computed(() =>
  prestamos.value
    .filter((item) => !item.entregado)
    .reduce((total, item) => total + Number(item.cantidad_cajas ?? 0), 0)
)

const prestamosFiltrados = computed(() => {
  const termino = filtroNombre.value.toLowerCase().trim()
  if (!termino) return prestamos.value
  return prestamos.value.filter((item) => item.nombre.toLowerCase().includes(termino))
})

const fechaUtcMinus5 = () => {
  const ahora = new Date()
  const utc = ahora.getTime() + ahora.getTimezoneOffset() * 60000
  const utcMinus5 = new Date(utc - 5 * 60 * 60000)
  const pad = (num: number) => num.toString().padStart(2, '0')
  return `${utcMinus5.getFullYear()}-${pad(utcMinus5.getMonth() + 1)}-${pad(utcMinus5.getDate())}T${pad(
    utcMinus5.getHours()
  )}:${pad(utcMinus5.getMinutes())}`
}

const formatFechaCorta = (valor: string) => {
  const fecha = new Date(valor)
  if (Number.isNaN(fecha.getTime())) return valor
  const pad = (num: number) => num.toString().padStart(2, '0')
  return `${pad(fecha.getDate())}-${pad(fecha.getMonth() + 1)}-${fecha.getFullYear()} ${pad(
    fecha.getHours()
  )}:${pad(fecha.getMinutes())}`
}

const cargarPrestamos = async () => {
  cargando.value = true
  error.value = null
  try {
    const respuesta = await fetch(ENDPOINTS.PRESTAMO_CAJAS)
    if (!respuesta.ok) {
      const detalle = await respuesta.text().catch(() => '')
      throw new Error(detalle || `Error ${respuesta.status}`)
    }
    const data = (await respuesta.json()) as unknown
    const lista = Array.isArray(data)
      ? data
      : Array.isArray((data as Record<string, unknown>)?.results)
        ? (data as Record<string, unknown>).results
        : Array.isArray((data as Record<string, unknown>)?.data)
          ? (data as Record<string, unknown>).data
          : []
    prestamos.value = lista
      .map((item) => {
        if (!item || typeof item !== 'object') return null
        const raw = item as Record<string, unknown>
        return {
          id: Number(raw.id ?? 0),
          nombre: String(raw.nombre ?? ''),
          cajero: String(raw.cajero ?? ''),
          actualizado_por: String(raw.actualizado_por ?? ''),
          cantidad_cajas: Number(raw.cantidad_cajas ?? 0),
          entregado: Boolean(raw.entregado),
          fecha: String(raw.fecha ?? '')
        }
      })
      .filter(Boolean) as PrestamoCaja[]
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err)
    error.value = `No fue posible cargar prestamos. ${detalle}`
  } finally {
    cargando.value = false
  }
}

const toggleEntregado = async (item: PrestamoCaja) => {
  const nuevoEstado = !item.entregado
  try {
    const respuesta = await fetch(`${ENDPOINTS.PRESTAMO_CAJAS}${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: item.nombre,
        cantidad_cajas: Number(item.cantidad_cajas),
        entregado: nuevoEstado,
        fecha: item.fecha,
        cajero: item.cajero,
        actualizado_por: getSessionUserName() ?? ''
      })
    })
    if (!respuesta.ok) {
      const detalle = await respuesta.text().catch(() => '')
      throw new Error(detalle || `Error ${respuesta.status}`)
    }
    item.entregado = nuevoEstado
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err)
    error.value = `No fue posible actualizar el estado. ${detalle}`
  }
}

const crearPrestamo = async () => {
  errorCrear.value = null
  guardando.value = true
  try {
    if (!formCrear.value.nombre.trim()) {
      throw new Error('El nombre es obligatorio.')
    }
    if (formCrear.value.cantidad_cajas <= 0) {
      throw new Error('La cantidad debe ser mayor a cero.')
    }
    const fechaBase = formCrear.value.fecha
    const fechaNormalizada = fechaBase.length === 16 ? `${fechaBase}:00` : fechaBase
    const fechaIso = fechaNormalizada ? new Date(fechaNormalizada).toISOString() : new Date().toISOString()
    const payload = {
      nombre: formCrear.value.nombre.trim(),
      cantidad_cajas: Number(formCrear.value.cantidad_cajas),
      entregado: Boolean(formCrear.value.entregado),
      fecha: fechaIso,
      cajero: getSessionUserName() ?? '',
      actualizado_por: getSessionUserName() ?? ''
    }
    const respuesta = await fetch(ENDPOINTS.PRESTAMO_CAJAS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    if (!respuesta.ok) {
      const detalle = await respuesta.text().catch(() => '')
      throw new Error(detalle || `Error ${respuesta.status}`)
    }
    formCrear.value = {
      nombre: '',
      cantidad_cajas: 0,
      entregado: false,
      fecha: fechaUtcMinus5()
    }
    mostrarCrear.value = false
    await cargarPrestamos()
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err)
    errorCrear.value = detalle
  } finally {
    guardando.value = false
  }
}

const iniciarEdicion = (item: PrestamoCaja) => {
  itemEditando.value = item
  formEditar.value = {
    nombre: item.nombre,
    cantidad_cajas: item.cantidad_cajas,
    entregado: item.entregado,
    fecha: item.fecha ? item.fecha.slice(0, 16) : fechaUtcMinus5()
  }
}

const cerrarEdicion = () => {
  itemEditando.value = null
}

const guardarEdicion = async () => {
  if (!itemEditando.value) return
  errorCrear.value = null
  guardando.value = true
  try {
    if (!formEditar.value.nombre.trim()) {
      throw new Error('El nombre es obligatorio.')
    }
    if (formEditar.value.cantidad_cajas <= 0) {
      throw new Error('La cantidad debe ser mayor a cero.')
    }
    const fechaBase = formEditar.value.fecha
    const fechaNormalizada = fechaBase.length === 16 ? `${fechaBase}:00` : fechaBase
    const fechaIso = fechaNormalizada ? new Date(fechaNormalizada).toISOString() : new Date().toISOString()
    const payload = {
      nombre: formEditar.value.nombre.trim(),
      cantidad_cajas: Number(formEditar.value.cantidad_cajas),
      entregado: Boolean(formEditar.value.entregado),
      fecha: fechaIso,
      cajero: getSessionUserName() ?? '',
      actualizado_por: getSessionUserName() ?? ''
    }
    const respuesta = await fetch(`${ENDPOINTS.PRESTAMO_CAJAS}${itemEditando.value.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    if (!respuesta.ok) {
      const detalle = await respuesta.text().catch(() => '')
      throw new Error(detalle || `Error ${respuesta.status}`)
    }
    itemEditando.value = null
    await cargarPrestamos()
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err)
    errorCrear.value = detalle
  } finally {
    guardando.value = false
  }
}

const eliminarPrestamo = async (item: PrestamoCaja) => {
  error.value = null
  try {
    const respuesta = await fetch(`${ENDPOINTS.PRESTAMO_CAJAS}${item.id}`, { method: 'DELETE' })
    if (!respuesta.ok) {
      const detalle = await respuesta.text().catch(() => '')
      throw new Error(detalle || `Error ${respuesta.status}`)
    }
    prestamos.value = prestamos.value.filter((registro) => registro.id !== item.id)
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err)
    error.value = `No fue posible eliminar. ${detalle}`
  }
}

onMounted(() => {
  formCrear.value.fecha = fechaUtcMinus5()
  void cargarPrestamos()
})
</script>

<template>
  <main class="prestamo">
    <section class="resumen">
      <article class="tarjeta">
        <div>
          <p class="tarjeta__titulo">Cajas prestadas</p>
          <p class="tarjeta__valor">{{ totalCajasPrestadas }}</p>
          <p class="tarjeta__detalle">Total prestadas</p>
        </div>
        <span class="tarjeta__estado">resumen</span>
      </article>
      <div class="prestamo__acciones">
        <input v-model="filtroNombre" type="text" placeholder="Filtrar por nombre..." class="input-filtro" />
        <button type="button" class="boton secundario" @click="cargarPrestamos" :disabled="cargando">
          {{ cargando ? 'Actualizando...' : 'Actualizar' }}
        </button>
        <button type="button" class="boton" @click="mostrarCrear = true">Crear registro</button>
      </div>
    </section>

    <p v-if="error" class="error">{{ error }}</p>

    <section class="tabla">
      <div v-if="cargando" class="vacio">Cargando...</div>
      <div v-else-if="prestamosFiltrados.length === 0" class="vacio">Sin registros.</div>
      <table v-else class="tabla__grid">
        <colgroup>
          <col style="width: 18%" />
          <col style="width: 16%" />
          <col style="width: 16%" />
          <col style="width: 10%" />
          <col style="width: 20%" />
          <col style="width: 10%" />
          <col style="width: 10%" />
        </colgroup>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Cajero</th>
            <th>Actualizado por</th>
            <th>Cajas</th>
            <th>Fecha</th>
            <th>Entregado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in prestamosFiltrados" :key="item.id">
            <td>{{ item.nombre }}</td>
            <td>{{ item.cajero || '-' }}</td>
            <td>{{ item.actualizado_por || '-' }}</td>
            <td class="col-num col-cajas">{{ item.cantidad_cajas }}</td>
            <td>{{ formatFechaCorta(item.fecha) }}</td>
            <td>
              <button
                type="button"
                class="estado estado--boton"
                :class="item.entregado ? 'activo' : 'inactivo'"
                @click="toggleEntregado(item)"
              >
                {{ item.entregado ? 'Si' : 'No' }}
              </button>
            </td>
            <td class="col-accion">
              <button
                type="button"
                class="icono icono--editar"
                @click="iniciarEdicion(item)"
                aria-label="Editar"
                title="Editar"
              >
                ✏
              </button>
              <button
                type="button"
                class="icono icono--eliminar"
                @click="eliminarPrestamo(item)"
                aria-label="Eliminar"
                title="Eliminar"
              >
                🗑
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <div
      v-if="mostrarCrear"
      class="modal"
      role="dialog"
      aria-modal="true"
      @click.self="mostrarCrear = false"
    >
      <section class="modal__contenido" @click.stop>
        <div class="modal__encabezado">
          <h2>Crear prestamo</h2>
          <button type="button" class="modal__cerrar" @click="mostrarCrear = false">x</button>
        </div>
        <form class="form" @submit.prevent="crearPrestamo">
          <label>
            <span>Nombre</span>
            <input v-model="formCrear.nombre" type="text" required />
          </label>
          <label>
            <span>Cantidad de cajas</span>
            <input v-model.number="formCrear.cantidad_cajas" type="number" min="1" step="1" required />
          </label>
          <label>
            <span>Entregado</span>
            <select v-model="formCrear.entregado">
              <option :value="false">No</option>
              <option :value="true">Si</option>
            </select>
          </label>
          <label>
            <span>Fecha</span>
            <input v-model="formCrear.fecha" type="datetime-local" step="60" />
          </label>
          <button type="submit" class="boton" :disabled="guardando">
            {{ guardando ? 'Guardando...' : 'Guardar' }}
          </button>
          <p v-if="errorCrear" class="error">{{ errorCrear }}</p>
        </form>
      </section>
    </div>

    <div v-if="itemEditando" class="modal" role="dialog" aria-modal="true" @click.self="cerrarEdicion">
      <section class="modal__contenido" @click.stop>
        <div class="modal__encabezado">
          <h2>Editar prestamo</h2>
          <button type="button" class="modal__cerrar" @click="cerrarEdicion">x</button>
        </div>
        <form class="form" @submit.prevent="guardarEdicion">
          <label>
            <span>Nombre</span>
            <input v-model="formEditar.nombre" type="text" required />
          </label>
          <label>
            <span>Cantidad de cajas</span>
            <input v-model.number="formEditar.cantidad_cajas" type="number" min="1" step="1" required />
          </label>
          <label>
            <span>Entregado</span>
            <select v-model="formEditar.entregado">
              <option :value="false">No</option>
              <option :value="true">Si</option>
            </select>
          </label>
          <label>
            <span>Fecha</span>
            <input v-model="formEditar.fecha" type="datetime-local" step="60" />
          </label>
          <button type="submit" class="boton" :disabled="guardando">
            {{ guardando ? 'Guardando...' : 'Guardar cambios' }}
          </button>
          <p v-if="errorCrear" class="error">{{ errorCrear }}</p>
        </form>
      </section>
    </div>
  </main>
</template>

<style scoped>
.prestamo {
  display: grid;
  gap: 1.5rem;
}

.prestamo__acciones {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.resumen {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
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
  min-width: 260px;
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

.input-filtro {
  border-radius: 0.75rem;
  border: 1px solid rgba(148, 163, 184, 0.3);
  padding: 0.55rem 0.75rem;
  background: rgba(12, 13, 16, 0.92);
  color: #e2e8f0;
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

.tabla {
  padding: 0.75rem;
  border-radius: 1rem;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(13, 15, 20, 0.88);
}

.tabla__grid {
  width: 100%;
  max-width: 100%;
  border-collapse: collapse;
  color: #e2e8f0;
  font-size: 0.9rem;
  table-layout: auto;
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

.tabla__grid thead th:nth-child(1),
.tabla__grid tbody td:nth-child(1) {
  text-align: left;
}

.tabla__grid thead th:nth-child(2),
.tabla__grid tbody td:nth-child(2),
.tabla__grid thead th:nth-child(3),
.tabla__grid tbody td:nth-child(3),
.tabla__grid thead th:nth-child(4),
.tabla__grid tbody td:nth-child(4),
.tabla__grid thead th:nth-child(5),
.tabla__grid tbody td:nth-child(5),
.tabla__grid thead th:nth-child(6),
.tabla__grid tbody td:nth-child(6),
.tabla__grid thead th:nth-child(7),
.tabla__grid tbody td:nth-child(7) {
  text-align: center;
}

.col-num {
  font-variant-numeric: tabular-nums;
}

.col-accion {
  white-space: nowrap;
}

.col-accion .icono + .icono {
  margin-left: 0.4rem;
}

.boton--danger {
  border: 1px solid rgba(248, 113, 113, 0.5);
  background: rgba(248, 113, 113, 0.15);
  color: #fecaca;
}

.icono {
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: rgba(30, 41, 59, 0.35);
  color: #e2e8f0;
  border-radius: 0.7rem;
  width: 2.2rem;
  height: 2.2rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 1rem;
  box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.05);
}

.icono--editar {
  border-color: rgba(59, 130, 246, 0.55);
  background: rgba(59, 130, 246, 0.12);
  color: #bfdbfe;
}

.icono--eliminar {
  border-color: rgba(248, 113, 113, 0.55);
  background: rgba(248, 113, 113, 0.12);
  color: #fecaca;
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

.estado {
  font-size: 0.75rem;
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
  background: rgba(34, 197, 94, 0.15);
  border: 1px solid rgba(34, 197, 94, 0.4);
  color: #bbf7d0;
  text-transform: capitalize;
}

.estado.inactivo {
  background: rgba(248, 113, 113, 0.15);
  border-color: rgba(248, 113, 113, 0.4);
  color: #fecaca;
}

.estado--boton {
  cursor: pointer;
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: rgba(120, 126, 137, 0.12);
}

.error {
  color: #f87171;
  margin: 0;
}

.modal {
  position: fixed;
  inset: 0;
  background: rgba(3, 4, 7, 0.7);
  display: grid;
  place-items: center;
  padding: 1.5rem;
  z-index: 60;
}

.modal__contenido {
  padding: 1rem 1.2rem;
  border-radius: 1rem;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(10, 11, 14, 0.92);
  width: min(640px, 92vw);
  margin: 0 auto;
  max-height: calc(100vh - 4rem);
  overflow-y: auto;
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
  gap: 0.75rem;
}

.form label {
  display: grid;
  gap: 0.35rem;
  color: #e2e8f0;
  font-weight: 600;
}

.form input,
.form select {
  border-radius: 0.75rem;
  border: 1px solid rgba(148, 163, 184, 0.3);
  padding: 0.55rem 0.75rem;
  background: rgba(12, 13, 16, 0.92);
  color: #e2e8f0;
}
.vacio {
  padding: 0.8rem;
  text-align: center;
  color: #94a3b8;
}
</style>
