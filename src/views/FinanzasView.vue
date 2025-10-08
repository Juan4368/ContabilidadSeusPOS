<script setup lang="ts">
import { computed, reactive, ref } from 'vue'

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

const irASeccion = (seccion: SeccionDetalle) => {
  seccionActiva.value = seccion
}

const volverAlInicio = () => {
  seccionActiva.value = 'landing'
}

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

    <section v-else-if="detalleVisible" class="panel detalle">
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
  </main>
</template>

<style scoped>
.finanzas {
  display: grid;
  gap: 2.5rem;
}

.encabezado {
  display: grid;
  gap: 0.5rem;
  text-align: center;
}

.encabezado h1 {
  margin: 0;
  font-size: clamp(2rem, 4vw, 2.75rem);
  color: #0f172a;
}

.encabezado p {
  margin: 0;
  color: #475569;
  font-size: 1.05rem;
}

.landing .cards {
  display: grid;
  gap: 1.5rem;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.card {
  background-color: #ffffff;
  border-radius: 1.25rem;
  padding: 1.75rem;
  display: grid;
  gap: 0.75rem;
  box-shadow: 0 0.75rem 2rem rgba(15, 23, 42, 0.08);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  outline: none;
}

.card:hover,
.card:focus-visible {
  transform: translateY(-6px);
  box-shadow: 0 1.25rem 2.5rem rgba(15, 23, 42, 0.12);
}

.card__icono {
  font-size: 2rem;
}

.card h2 {
  margin: 0;
  color: #0f172a;
  font-size: 1.5rem;
}

.card p {
  margin: 0;
  color: #475569;
}

.panel {
  background-color: #ffffff;
  border-radius: 1.25rem;
  box-shadow: 0 0.75rem 2rem rgba(15, 23, 42, 0.08);
  padding: 2rem;
  display: grid;
  gap: 2rem;
}

.detalle__encabezado {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.detalle__icono {
  font-size: 2.25rem;
}

.detalle__encabezado h2 {
  margin: 0 0 0.25rem;
  color: #0f172a;
}

.detalle__encabezado p {
  margin: 0;
  color: #475569;
}

.volver {
  justify-self: start;
  border: none;
  background: transparent;
  color: #2563eb;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
}

.formulario {
  display: grid;
  gap: 1rem;
}

.campo {
  display: grid;
  gap: 0.35rem;
  font-weight: 600;
  color: #1f2937;
}

input,
textarea {
  font: inherit;
  padding: 0.6rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.75rem;
  background-color: #f8fafc;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

input:focus,
textarea:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
}

textarea {
  resize: vertical;
}

.primario {
  justify-self: start;
  padding: 0.7rem 1.4rem;
  background-color: #2563eb;
  color: #ffffff;
  border-radius: 0.75rem;
  border: none;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s ease, transform 0.2s ease;
}

.primario:hover {
  background-color: #1d4ed8;
  transform: translateY(-1px);
}

.registros {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.9rem;
}

.registros li {
  border: 1px solid #e2e8f0;
  border-radius: 0.9rem;
  padding: 0.85rem 1rem;
  background-color: #f8fafc;
  display: grid;
  gap: 0.35rem;
}

.registros .categoria {
  font-weight: 700;
  color: #0f172a;
}

.registros .monto {
  color: #047857;
  font-weight: 600;
}

.registros .fecha {
  font-size: 0.9rem;
  color: #475569;
}

.registros .vacio {
  text-align: center;
  color: #6b7280;
  border-style: dashed;
}

@media (max-width: 600px) {
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
