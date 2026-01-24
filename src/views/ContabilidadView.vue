<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { crearIngreso } from '../services/ingresos'
import type { RegistroPayload } from '../services/tipos'

const resumen = [
  { titulo: 'Ingresos', valor: '$ 0', detalle: 'Mes actual', estado: 'estable' },
  { titulo: 'Egresos', valor: '$ 0', detalle: 'Mes actual', estado: 'estable' },
  { titulo: 'Cartera', valor: '$ 0', detalle: 'Cobros pendientes', estado: 'pendiente' }
]

const acciones = [
  { titulo: 'Registrar ingreso', descripcion: 'Nueva entrada de dinero.' },
  { titulo: 'Registrar egreso', descripcion: 'Salida de dinero o pago.' },
  { titulo: 'Categorias contables', descripcion: 'Gestiona tus categorias.' },
  { titulo: 'Reportes', descripcion: 'Resumenes y cortes.' }
]

const mostrarFormularioIngreso = ref(false)

const mensaje = ref<string | null>(null)
const mensajeTipo = ref<'exito' | 'error' | null>(null)

type CategoriaContable = {
  id: number
  nombre: string
  codigo: string
}

const categoriasContables = ref<CategoriaContable[]>([])
const cargandoCategorias = ref(false)
const errorCategorias = ref<string | null>(null)

const toDateTimeLocal = (fecha: Date) => {
  const pad = (valor: number) => valor.toString().padStart(2, '0')
  return `${fecha.getFullYear()}-${pad(fecha.getMonth() + 1)}-${pad(fecha.getDate())}T${pad(
    fecha.getHours()
  )}:${pad(fecha.getMinutes())}`
}

const formularioIngreso = ref<RegistroPayload>({
  fecha: toDateTimeLocal(new Date()),
  monto: 0,
  tipo_ingreso: 'EFECTIVO',
  categoria_contabilidad_id: 0,
  notas: '',
  cliente: ''
})

const guardando = ref(false)
const error = ref<string | null>(null)
const payloadIngreso = ref<string | null>(null)

const registrarIngreso = async () => {
  guardando.value = true
  error.value = null
  mensaje.value = null
  mensajeTipo.value = null
  if (formularioIngreso.value.fecha && formularioIngreso.value.fecha.length === 16) {
    formularioIngreso.value.fecha = `${formularioIngreso.value.fecha}:00`
  }
  payloadIngreso.value = JSON.stringify(formularioIngreso.value, null, 2)
  try {
    await crearIngreso(formularioIngreso.value)
    mensaje.value = 'Ingreso guardado correctamente.'
    mensajeTipo.value = 'exito'
  } catch (err) {
    console.error('Error al registrar ingreso', err)
    const detalle = err instanceof Error ? err.message : String(err)
    error.value = `No fue posible registrar el ingreso. ${detalle}`
    mensaje.value = 'No fue posible guardar el ingreso.'
    mensajeTipo.value = 'error'
  } finally {
    guardando.value = false
  }
}

const cargarCategoriasContables = async () => {
  cargandoCategorias.value = true
  errorCategorias.value = null
  try {
    const respuesta = await fetch('http://127.0.0.1:8000/contabilidad/categorias/')
    if (!respuesta.ok) {
      const detalle = await respuesta.text().catch(() => '')
      throw new Error(detalle || `Error ${respuesta.status}`)
    }
    const data = (await respuesta.json()) as CategoriaContable[]
    categoriasContables.value = data.filter((categoria) => categoria.codigo?.toUpperCase().startsWith('ING_'))
  } catch (err) {
    console.error('Error al cargar categorias contables', err)
    errorCategorias.value = 'No fue posible cargar categorias contables.'
  } finally {
    cargandoCategorias.value = false
  }
}

onMounted(() => {
  cargarCategoriasContables()
})
</script>

<template>
  <main class="contabilidad">
    <header class="contabilidad__cabecera">
      <div>
        <p class="contabilidad__prefijo">Contabilidad</p>
        <h1>Panel contable</h1>
        <p class="contabilidad__nota">Revisa ingresos, egresos y cartera desde un solo lugar.</p>
      </div>
      <div class="contabilidad__acciones">
        <button type="button" class="boton secundario">Exportar</button>
        <button type="button" class="boton">Nuevo registro</button>
      </div>
    </header>

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
        @click="mostrarFormularioIngreso = accion.titulo === 'Registrar ingreso'"
        @keyup.enter.prevent="mostrarFormularioIngreso = accion.titulo === 'Registrar ingreso'"
        @keyup.space.prevent="mostrarFormularioIngreso = accion.titulo === 'Registrar ingreso'"
      >
        <div>
          <h2>{{ accion.titulo }}</h2>
          <p>{{ accion.descripcion }}</p>
        </div>
      </article>
    </section>

    <div
      v-if="mostrarFormularioIngreso"
      class="modal"
      role="dialog"
      aria-modal="true"
      @click.self="mostrarFormularioIngreso = false"
    >
      <section class="contabilidad__formulario" @click.stop>
        <div class="modal__encabezado">
          <h2>Registrar ingreso</h2>
          <button type="button" class="modal__cerrar" @click="mostrarFormularioIngreso = false">×</button>
        </div>
        <form class="form" @submit.prevent="registrarIngreso">
          <label>
            <span>Fecha</span>
            <input v-model="formularioIngreso.fecha" type="datetime-local" required />
          </label>
          <label>
            <span>Monto</span>
            <input v-model.number="formularioIngreso.monto" type="number" min="0" step="0.01" required />
          </label>
          <label>
            <span>Tipo ingreso</span>
            <select v-model="formularioIngreso.tipo_ingreso" required>
              <option value="EFECTIVO">EFECTIVO</option>
              <option value="TRANSFERENCIA">TRANSFERENCIA</option>
            </select>
          </label>
          <label>
            <span>Categoria contable</span>
            <select
              v-model.number="formularioIngreso.categoria_contabilidad_id"
              :disabled="cargandoCategorias || categoriasContables.length === 0"
              required
            >
              <option :value="0" disabled>Selecciona una categoria</option>
              <option v-for="categoria in categoriasContables" :key="categoria.id" :value="categoria.id">
                {{ categoria.nombre }}
              </option>
            </select>
            <small v-if="cargandoCategorias" class="ayuda">Cargando categorias...</small>
            <small v-else-if="categoriasContables.length === 0" class="ayuda ayuda--error">
              {{ errorCategorias ?? 'No hay categorias disponibles.' }}
            </small>
          </label>
          <label>
            <span>Notas</span>
            <textarea v-model="formularioIngreso.notas" rows="2"></textarea>
          </label>
          <label>
            <span>Cliente</span>
            <input v-model="formularioIngreso.cliente" type="text" />
          </label>
          <button type="submit" class="boton" :disabled="guardando">
            {{ guardando ? 'Guardando...' : 'Guardar ingreso' }}
          </button>
          <p v-if="error" class="form__error">{{ error }}</p>
          <p v-if="mensaje" :class="['form__mensaje', `form__mensaje--${mensajeTipo}`]">{{ mensaje }}</p>
          <pre v-if="payloadIngreso" class="payload">{{ payloadIngreso }}</pre>
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
