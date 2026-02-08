<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import { crearMovimientoFinanciero, type MovimientoFinancieroPayload } from '../services/movimientosFinancieros'
import { ENDPOINTS } from '../config/endpoints'

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

const categoriasContables = ref<CategoriaContable[]>([])
const cargandoCategorias = ref(false)
const errorCategorias = ref<string | null>(null)

const proveedores = ref<Proveedor[]>([])
const cargandoProveedores = ref(false)
const errorProveedores = ref<string | null>(null)
const ultimaCargaProveedores = ref(0)

const toDateTimeLocal = (fecha: Date) => {
  const pad = (valor: number) => valor.toString().padStart(2, '0')
  return `${fecha.getFullYear()}-${pad(fecha.getMonth() + 1)}-${pad(fecha.getDate())}T${pad(
    fecha.getHours()
  )}:${pad(fecha.getMinutes())}`
}

const formularioMovimiento = ref<MovimientoFinancieroPayload>({
  fecha: toDateTimeLocal(new Date()),
  tipo: 'EGRESO',
  monto: 0,
  concepto: '',
  nota: '',
  proveedor_id: 0,
  caja_id: 1,
  usuario_id: 8,
  venta_id: null
})

const formatCurrencyInput = (valor: number) =>
  Math.max(Number(valor || 0), 0).toLocaleString('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  })

const montoMovimientoInput = computed(() => formatCurrencyInput(formularioMovimiento.value.monto))

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
  if (formularioMovimiento.value.monto <= 0) {
    errorMovimiento.value = 'El monto debe ser mayor a cero.'
    guardandoMovimiento.value = false
    return
  }
  const fechaBase = formularioMovimiento.value.fecha
  const fechaNormalizada = fechaBase.length === 16 ? `${fechaBase}:00` : fechaBase
  const fechaObjeto = new Date(fechaNormalizada)
  if (Number.isNaN(fechaObjeto.getTime())) {
    errorMovimiento.value = 'Fecha invalida.'
    guardandoMovimiento.value = false
    return
  }
  const fechaIso = fechaObjeto.toISOString()
  const ventaId = formularioMovimiento.value.venta_id
  const payload: MovimientoFinancieroPayload = {
    ...formularioMovimiento.value,
    fecha: fechaIso,
    venta_id: ventaId && ventaId > 0 ? ventaId : null
  }
  try {
    await crearMovimientoFinanciero(payload)
    mensaje.value = 'Movimiento guardado correctamente.'
    mensajeTipo.value = 'exito'
  } catch (err) {
    console.error('Error al registrar movimiento', err)
    const detalle = err instanceof Error ? err.message : String(err)
    errorMovimiento.value = `No fue posible registrar el movimiento. ${detalle}`
    mensaje.value = 'No fue posible guardar el movimiento.'
    mensajeTipo.value = 'error'
  } finally {
    payloadMovimiento.value = JSON.stringify(payload, null, 2)
    guardandoMovimiento.value = false
  }
}

const cerrarFormularioMovimiento = () => {
  mostrarFormularioMovimiento.value = false
  formularioMovimiento.value = {
    fecha: toDateTimeLocal(new Date()),
    tipo: 'EGRESO',
    monto: 0,
    concepto: '',
    nota: '',
    proveedor_id: 0,
    caja_id: 1,
    usuario_id: 8,
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
  formularioMovimiento.value = {
    fecha: toDateTimeLocal(new Date()),
    tipo: 'EGRESO',
    monto: 0,
    concepto: '',
    nota: '',
    proveedor_id: 0,
    caja_id: 1,
    usuario_id: 8,
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
})
</script>

<template>
  <main class="contabilidad">
    <section class="contabilidad__resumen">
      <article v-for="item in resumen" :key="item.titulo" class="tarjeta">
        <div>
          <p class="tarjeta__titulo">{{ item.titulo }}</p>
          <p class="tarjeta__valor">{{ item.valor }}</p>
          <p class="tarjeta__detalle">{{ item.detalle }}</p>
        </div>
        <span :class="['tarjeta__estado', `tarjeta__estado--${item.estado}`]">{{ item.estado }}</span>
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

    <div
      v-if="mostrarFormularioMovimiento"
      class="modal"
      role="dialog"
      aria-modal="true"
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
            <input v-model="formularioMovimiento.concepto" type="text" placeholder="Concepto" />
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
          <pre v-if="payloadMovimiento" class="payload">{{ payloadMovimiento }}</pre>
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
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
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

