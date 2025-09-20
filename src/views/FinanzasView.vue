<script setup lang="ts">
import { reactive, ref } from 'vue'

type Registro = {
  id: number
  monto: number
  categoria: string
  fecha: string
  notas: string
}

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
</script>

<template>
  <main class="finanzas">
    <h1>Gestión de Finanzas</h1>

    <section class="panel">
      <h2>Registrar ingreso</h2>
      <form class="formulario" @submit.prevent="agregarIngreso">
        <label class="campo">
          <span>Monto</span>
          <input v-model.number="formularioIngreso.monto" type="number" min="0" step="0.01" required />
        </label>
        <label class="campo">
          <span>Categoría</span>
          <input v-model="formularioIngreso.categoria" type="text" placeholder="Salario, ventas, etc." required />
        </label>
        <label class="campo">
          <span>Fecha</span>
          <input v-model="formularioIngreso.fecha" type="date" required />
        </label>
        <label class="campo">
          <span>Notas</span>
          <textarea v-model="formularioIngreso.notas" rows="2" placeholder="Detalles adicionales"></textarea>
        </label>
        <button type="submit">Agregar ingreso</button>
      </form>

      <ul class="registros" aria-live="polite">
        <li v-for="registro in ingresos" :key="registro.id">
          <span class="categoria">{{ registro.categoria }}</span>
          <span class="monto">${{ registro.monto.toFixed(2) }}</span>
          <span class="fecha">{{ registro.fecha }}</span>
          <p v-if="registro.notas">{{ registro.notas }}</p>
        </li>
        <li v-if="ingresos.length === 0" class="vacio">No hay ingresos registrados.</li>
      </ul>
    </section>

    <section class="panel">
      <h2>Registrar egreso</h2>
      <form class="formulario" @submit.prevent="agregarEgreso">
        <label class="campo">
          <span>Monto</span>
          <input v-model.number="formularioEgreso.monto" type="number" min="0" step="0.01" required />
        </label>
        <label class="campo">
          <span>Categoría</span>
          <input v-model="formularioEgreso.categoria" type="text" placeholder="Servicios, compras, etc." required />
        </label>
        <label class="campo">
          <span>Fecha</span>
          <input v-model="formularioEgreso.fecha" type="date" required />
        </label>
        <label class="campo">
          <span>Notas</span>
          <textarea v-model="formularioEgreso.notas" rows="2" placeholder="Detalles adicionales"></textarea>
        </label>
        <button type="submit">Agregar egreso</button>
      </form>

      <ul class="registros" aria-live="polite">
        <li v-for="registro in egresos" :key="registro.id">
          <span class="categoria">{{ registro.categoria }}</span>
          <span class="monto">${{ registro.monto.toFixed(2) }}</span>
          <span class="fecha">{{ registro.fecha }}</span>
          <p v-if="registro.notas">{{ registro.notas }}</p>
        </li>
        <li v-if="egresos.length === 0" class="vacio">No hay egresos registrados.</li>
      </ul>
    </section>

    <section class="panel">
      <h2>Registrar cartera</h2>
      <form class="formulario" @submit.prevent="agregarCartera">
        <label class="campo">
          <span>Monto</span>
          <input v-model.number="formularioCartera.monto" type="number" min="0" step="0.01" required />
        </label>
        <label class="campo">
          <span>Categoría</span>
          <input v-model="formularioCartera.categoria" type="text" placeholder="Clientes, cuentas por cobrar, etc." required />
        </label>
        <label class="campo">
          <span>Fecha</span>
          <input v-model="formularioCartera.fecha" type="date" required />
        </label>
        <label class="campo">
          <span>Notas</span>
          <textarea v-model="formularioCartera.notas" rows="2" placeholder="Detalles adicionales"></textarea>
        </label>
        <button type="submit">Agregar cartera</button>
      </form>

      <ul class="registros" aria-live="polite">
        <li v-for="registro in cartera" :key="registro.id">
          <span class="categoria">{{ registro.categoria }}</span>
          <span class="monto">${{ registro.monto.toFixed(2) }}</span>
          <span class="fecha">{{ registro.fecha }}</span>
          <p v-if="registro.notas">{{ registro.notas }}</p>
        </li>
        <li v-if="cartera.length === 0" class="vacio">No hay registros en cartera.</li>
      </ul>
    </section>
  </main>
</template>

<style scoped>
.finanzas {
  margin: 0 auto;
  padding: 2rem;
  max-width: 960px;
  display: grid;
  gap: 2rem;
}

.panel {
  background-color: #ffffff;
  border-radius: 1rem;
  box-shadow: 0 0.5rem 1.5rem rgba(15, 23, 42, 0.08);
  padding: 1.5rem;
  display: grid;
  gap: 1.5rem;
}

.formulario {
  display: grid;
  gap: 1rem;
}

.campo {
  display: grid;
  gap: 0.25rem;
  font-weight: 600;
}

.campo span {
  color: #1f2937;
}

input,
textarea,
button {
  font: inherit;
}

input,
textarea {
  padding: 0.6rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  background-color: #f9fafb;
}

textarea {
  resize: vertical;
}

button {
  justify-self: start;
  padding: 0.6rem 1.2rem;
  background-color: #2563eb;
  color: #ffffff;
  border-radius: 0.5rem;
  border: none;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

button:hover {
  background-color: #1d4ed8;
}

.registros {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.75rem;
}

.registros li {
  border: 1px solid #e5e7eb;
  border-radius: 0.75rem;
  padding: 0.75rem 1rem;
  background-color: #f8fafc;
  display: grid;
  gap: 0.25rem;
}

.registros .categoria {
  font-weight: 700;
  color: #0f172a;
}

.registros .monto {
  color: #047857;
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
</style>
