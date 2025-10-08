<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'

type Registro = {
  id: number
  monto: number
  categoria: string
  fecha: string
  notas: string
}

type SeccionDetalle = 'ingresos' | 'egresos' | 'cartera'

const ingresos = ref<Registro[]>([])
const egresos = ref<Registro[]>([])
const cartera = ref<Registro[]>([])

const formularioIngreso = reactive({
  monto: 0,
  categoria: '',
  fecha: '',
  notas: ''
})

const formularioEgreso = reactive({
  monto: 0,
  categoria: '',
  fecha: '',
  notas: ''
})

const formularioCartera = reactive({
  monto: 0,
  categoria: '',
  fecha: '',
  notas: ''
})

const ultimoId = ref(0)

const limpiarFormulario = (formulario: typeof formularioIngreso) => {
  formulario.monto = 0
  formulario.categoria = ''
  formulario.fecha = ''
  formulario.notas = ''
}

const crearRegistro = (datos: typeof formularioIngreso) => {
  ultimoId.value += 1

  return {
    id: ultimoId.value,
    monto: datos.monto,
    categoria: datos.categoria,
    fecha: datos.fecha,
    notas: datos.notas
  }
}

const agregarIngreso = () => {
  ingresos.value.push(crearRegistro(formularioIngreso))
  limpiarFormulario(formularioIngreso)
}

const agregarEgreso = () => {
  egresos.value.push(crearRegistro(formularioEgreso))
  limpiarFormulario(formularioEgreso)
}

const agregarCartera = () => {
  cartera.value.push(crearRegistro(formularioCartera))
  limpiarFormulario(formularioCartera)
}

const seccionActiva = ref<'landing' | SeccionDetalle>('landing')
const menuAbierto = ref(false)

const irASeccion = (seccion: SeccionDetalle) => {
  seccionActiva.value = seccion
}

const volverAlInicio = () => {
  seccionActiva.value = 'landing'
}

const manejarEscape = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && seccionActiva.value !== 'landing') {
    volverAlInicio()
  }
}

onMounted(() => {
  window.addEventListener('keydown', manejarEscape)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', manejarEscape)
})

watch(seccionActiva, () => {
  menuAbierto.value = false
})

type ConfiguracionSeccion = {
  titulo: string
  descripcion: string
  formulario: typeof formularioIngreso
  registros: typeof ingresos
  categoriaPlaceholder: string
  notasPlaceholder: string
  vacio: string
  accion: () => void
  icono: string
}

const configuracionSecciones: Record<SeccionDetalle, ConfiguracionSeccion> = {
  ingresos: {
    titulo: 'Registrar ingreso',
    descripcion: 'Controla los ingresos de tu negocio y lleva un historial detallado.',
    formulario: formularioIngreso,
    registros: ingresos,
    categoriaPlaceholder: 'Salario, ventas, etc.',
    notasPlaceholder: 'Detalles adicionales',
    vacio: 'No hay ingresos registrados.',
    accion: agregarIngreso,
    icono: '💰'
  },
  egresos: {
    titulo: 'Registrar egreso',
    descripcion: 'Mantén un registro claro de los egresos para optimizar tus gastos.',
    formulario: formularioEgreso,
    registros: egresos,
    categoriaPlaceholder: 'Servicios, compras, etc.',
    notasPlaceholder: 'Detalles adicionales',
    vacio: 'No hay egresos registrados.',
    accion: agregarEgreso,
    icono: '🧾'
  },
  cartera: {
    titulo: 'Registrar cartera',
    descripcion: 'Gestiona tus cuentas por cobrar y la cartera de clientes.',
    formulario: formularioCartera,
    registros: cartera,
    categoriaPlaceholder: 'Clientes, cuentas por cobrar, etc.',
    notasPlaceholder: 'Detalles adicionales',
    vacio: 'No hay registros en cartera.',
    accion: agregarCartera,
    icono: '📇'
  }
}

const seccionActivaDetalle = computed(() => (seccionActiva.value === 'landing' ? null : seccionActiva.value))

type DestinoMenu = 'landing' | SeccionDetalle

const nombresMenu: Record<SeccionDetalle, string> = {
  ingresos: 'Ingresos',
  egresos: 'Egresos',
  cartera: 'Cartera'
}

const opcionesMenu = computed(() => {
  const opciones: { id: DestinoMenu; etiqueta: string }[] = []

  if (seccionActiva.value !== 'landing') {
    opciones.push({ id: 'landing', etiqueta: 'Inicio' })
  }

  ;(['ingresos', 'egresos', 'cartera'] as SeccionDetalle[]).forEach((seccion) => {
    if (seccion !== seccionActiva.value) {
      opciones.push({ id: seccion, etiqueta: nombresMenu[seccion] })
    }
  })

  return opciones
})

const toggleMenu = () => {
  menuAbierto.value = !menuAbierto.value
}

const manejarSeleccionMenu = (destino: DestinoMenu) => {
  if (destino === 'landing') {
    volverAlInicio()
  } else {
    irASeccion(destino)
  }

  menuAbierto.value = false
}

const detalleVisible = computed(() => {
  if (!seccionActivaDetalle.value) {
    return null
  }

  const clave = seccionActivaDetalle.value
  const configuracion = configuracionSecciones[clave]

  return {
    clave,
    titulo: configuracion.titulo,
    descripcion: configuracion.descripcion,
    formulario: configuracion.formulario,
    registros: configuracion.registros.value,
    categoriaPlaceholder: configuracion.categoriaPlaceholder,
    notasPlaceholder: configuracion.notasPlaceholder,
    vacio: configuracion.vacio,
    accion: configuracion.accion,
    icono: configuracion.icono
  }
})

const enviarFormulario = () => {
  if (!detalleVisible.value) {
    return
  }

  detalleVisible.value.accion()
}

const landingCards = computed(() =>
  (['ingresos', 'egresos', 'cartera'] as SeccionDetalle[]).map((clave) => {
    const { titulo, descripcion, icono } = configuracionSecciones[clave]

    return {
      id: clave,
      titulo,
      descripcion,
      icono
    }
  })
)
</script>

<template>
  <main class="finanzas">
    <nav class="menu-dinamico" aria-label="Navegación principal">
      <button class="menu-dinamico__toggle" type="button" @click="toggleMenu">
        ☰ Menú
      </button>
      <transition name="desvanecer">
        <ul v-if="menuAbierto && opcionesMenu.length > 0" class="menu-dinamico__lista">
          <li v-for="opcion in opcionesMenu" :key="opcion.id">
            <button type="button" @click="manejarSeleccionMenu(opcion.id)">{{ opcion.etiqueta }}</button>
          </li>
        </ul>
      </transition>
    </nav>

    <header class="encabezado">
      <h1>Gestión de Finanzas</h1>
      <p>Administra tus ingresos, egresos y cartera desde un solo lugar.</p>
    </header>

    <section v-if="seccionActiva === 'landing'" class="landing" aria-label="Vistas disponibles">
      <div class="cards">
        <article
          v-for="card in landingCards"
          :key="card.id"
          class="card"
          role="button"
          tabindex="0"
          @click="irASeccion(card.id)"
          @keyup.enter.prevent="irASeccion(card.id)"
          @keyup.space.prevent="irASeccion(card.id)"
        >
          <span class="card__icono" aria-hidden="true">{{ card.icono }}</span>
          <h2>{{ card.titulo }}</h2>
          <p>{{ card.descripcion }}</p>
        </article>
      </div>
    </section>

    <transition name="detalle">
      <div
        v-if="detalleVisible"
        class="detalle-modal"
        role="dialog"
        aria-modal="true"
        @click.self="volverAlInicio"
      >
        <section class="panel detalle" @click.stop>
          <button class="volver" type="button" @click="volverAlInicio">← Volver al inicio</button>

          <header class="detalle__encabezado">
            <span class="detalle__icono" aria-hidden="true">{{ detalleVisible.icono }}</span>
            <div>
              <h2>{{ detalleVisible.titulo }}</h2>
              <p>{{ detalleVisible.descripcion }}</p>
            </div>
          </header>

          <form class="formulario" @submit.prevent="enviarFormulario">
            <label class="campo">
              <span>Monto</span>
              <input v-model.number="detalleVisible.formulario.monto" type="number" min="0" step="0.01" required />
            </label>
            <label class="campo">
              <span>Categoría</span>
              <input
                v-model="detalleVisible.formulario.categoria"
                type="text"
                :placeholder="detalleVisible.categoriaPlaceholder"
                required
              />
            </label>
            <label class="campo">
              <span>Fecha</span>
              <input v-model="detalleVisible.formulario.fecha" type="date" required />
            </label>
            <label class="campo">
              <span>Notas</span>
              <textarea
                v-model="detalleVisible.formulario.notas"
                rows="2"
                :placeholder="detalleVisible.notasPlaceholder"
              ></textarea>
            </label>
            <button class="primario" type="submit">Guardar registro</button>
          </form>

          <ul class="registros" aria-live="polite">
            <li v-for="registro in detalleVisible.registros" :key="registro.id">
              <span class="categoria">{{ registro.categoria }}</span>
              <span class="monto">${{ registro.monto.toFixed(2) }}</span>
              <span class="fecha">{{ registro.fecha }}</span>
              <p v-if="registro.notas">{{ registro.notas }}</p>
            </li>
            <li v-if="detalleVisible.registros.length === 0" class="vacio">{{ detalleVisible.vacio }}</li>
          </ul>
        </section>
      </div>
    </transition>
  </main>
</template>

<style scoped>
.finanzas {
  display: grid;
  gap: 2.5rem;
  position: relative;
  min-height: 100vh;
}

.menu-dinamico {
  position: fixed;
  top: 1.5rem;
  left: 1.5rem;
  z-index: 10;
}

.menu-dinamico__toggle {
  background: rgba(30, 41, 59, 0.75);
  backdrop-filter: blur(4px);
  border: 1px solid rgba(148, 163, 184, 0.4);
  border-radius: 999px;
  color: #e2e8f0;
  padding: 0.45rem 1.1rem;
  cursor: pointer;
  transition: background-color 0.2s ease, transform 0.2s ease;
}

.menu-dinamico__toggle:hover,
.menu-dinamico__toggle:focus-visible {
  outline: none;
  background: rgba(59, 130, 246, 0.2);
  transform: translateY(-1px);
}

.menu-dinamico__lista {
  margin: 0.6rem 0 0;
  padding: 0.5rem;
  list-style: none;
  display: grid;
  gap: 0.35rem;
  background: rgba(15, 23, 42, 0.92);
  border: 1px solid rgba(51, 65, 85, 0.8);
  border-radius: 0.85rem;
  min-width: 11rem;
  box-shadow: 0 1.25rem 3rem rgba(15, 23, 42, 0.35);
}

.menu-dinamico__lista button {
  background: transparent;
  border: none;
  color: #e2e8f0;
  padding: 0.55rem 0.75rem;
  text-align: left;
  border-radius: 0.65rem;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.menu-dinamico__lista button:hover,
.menu-dinamico__lista button:focus-visible {
  outline: none;
  background-color: rgba(59, 130, 246, 0.25);
}

.desvanecer-enter-active,
.desvanecer-leave-active {
  transition: opacity 0.15s ease;
}

.desvanecer-enter-from,
.desvanecer-leave-to {
  opacity: 0;
}

.encabezado {
  display: grid;
  gap: 0.5rem;
  text-align: center;
}

.encabezado h1 {
  margin: 0;
  font-size: clamp(2rem, 4vw, 2.75rem);
  color: #f8fafc;
}

.encabezado p {
  margin: 0;
  color: #cbd5f5;
  font-size: 1.05rem;
}

.landing .cards {
  display: grid;
  gap: 1.5rem;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.card {
  background: linear-gradient(150deg, rgba(30, 64, 175, 0.3), rgba(15, 23, 42, 0.95));
  border-radius: 1.25rem;
  padding: 1.75rem;
  display: grid;
  gap: 0.75rem;
  box-shadow: 0 0.85rem 2.75rem rgba(2, 6, 23, 0.6);
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
  outline: none;
  border: 1px solid rgba(96, 165, 250, 0.2);
}

.card:hover,
.card:focus-visible {
  transform: translateY(-6px);
  box-shadow: 0 1.5rem 3.25rem rgba(2, 6, 23, 0.75);
  border-color: rgba(96, 165, 250, 0.45);
}

.card__icono {
  font-size: 2rem;
  width: 3.25rem;
  height: 3.25rem;
  display: inline-grid;
  place-items: center;
  border-radius: 1rem;
  background: radial-gradient(circle at top, rgba(59, 130, 246, 0.9), rgba(14, 116, 144, 0.75));
  box-shadow: 0 0.75rem 1.75rem rgba(59, 130, 246, 0.35);
  filter: saturate(1.15);
}

.card h2 {
  margin: 0;
  color: #f1f5f9;
  font-size: 1.5rem;
}

.card p {
  margin: 0;
  color: #cbd5f5;
}

.panel {
  background: linear-gradient(155deg, rgba(15, 23, 42, 0.95), rgba(30, 58, 138, 0.7));
  border-radius: 1.25rem;
  box-shadow: 0 1rem 3rem rgba(2, 6, 23, 0.7);
  padding: 2rem;
  display: grid;
  gap: 2rem;
  border: 1px solid rgba(96, 165, 250, 0.25);
}

.detalle__encabezado {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.detalle__icono {
  font-size: 2.25rem;
  width: 3.75rem;
  height: 3.75rem;
  display: inline-grid;
  place-items: center;
  border-radius: 1.25rem;
  background: radial-gradient(circle at top, rgba(34, 211, 238, 0.9), rgba(59, 130, 246, 0.85));
  box-shadow: 0 1rem 2.5rem rgba(34, 211, 238, 0.35);
}

.detalle__encabezado h2 {
  margin: 0 0 0.25rem;
  color: #f8fafc;
}

.detalle__encabezado p {
  margin: 0;
  color: #cbd5f5;
}

.detalle-modal {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4rem 1.5rem;
  background: radial-gradient(circle at top, rgba(30, 41, 59, 0.65), rgba(2, 6, 23, 0.85));
  backdrop-filter: blur(6px);
  z-index: 20;
}

.detalle-enter-active,
.detalle-leave-active {
  transition: opacity 0.2s ease;
}

.detalle-enter-from,
.detalle-leave-to {
  opacity: 0;
}

.volver {
  justify-self: start;
  border: none;
  background: transparent;
  color: #93c5fd;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
}

.volver:hover,
.volver:focus-visible {
  outline: none;
  color: #bfdbfe;
}

.formulario {
  display: grid;
  gap: 1rem;
}

.campo {
  display: grid;
  gap: 0.35rem;
  font-weight: 600;
  color: #e2e8f0;
}

input,
textarea {
  font: inherit;
  padding: 0.6rem 0.75rem;
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 0.75rem;
  background-color: rgba(15, 23, 42, 0.65);
  color: #f8fafc;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
}

input::placeholder,
textarea::placeholder {
  color: #94a3b8;
}

input:focus,
textarea:focus {
  outline: none;
  border-color: #60a5fa;
  box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.25);
  background-color: rgba(30, 41, 59, 0.85);
}

textarea {
  resize: vertical;
}

.primario {
  justify-self: start;
  padding: 0.7rem 1.4rem;
  background: linear-gradient(120deg, #2563eb, #1d4ed8);
  color: #ffffff;
  border-radius: 0.75rem;
  border: none;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  box-shadow: 0 10px 25px rgba(37, 99, 235, 0.35);
}

.primario:hover,
.primario:focus-visible {
  outline: none;
  transform: translateY(-1px);
  box-shadow: 0 14px 30px rgba(29, 78, 216, 0.5);
}

.registros {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.9rem;
}

.registros li {
  border: 1px solid rgba(148, 163, 184, 0.25);
  border-radius: 0.9rem;
  padding: 0.85rem 1rem;
  background: rgba(15, 23, 42, 0.85);
  display: grid;
  gap: 0.35rem;
  color: #e2e8f0;
}

.registros .categoria {
  font-weight: 700;
  color: #f8fafc;
}

.registros .monto {
  color: #34d399;
  font-weight: 600;
}

.registros .fecha {
  font-size: 0.9rem;
  color: #cbd5f5;
}

.registros .vacio {
  text-align: center;
  color: #94a3b8;
  border-style: dashed;
}

@media (max-width: 600px) {
  .menu-dinamico {
    top: 1rem;
    left: 1rem;
  }

  .panel {
    padding: 1.5rem;
  }

  .detalle__encabezado {
    align-items: flex-start;
    flex-direction: column;
  }

  .volver {
    font-size: 0.95rem;
  }
}
</style>
