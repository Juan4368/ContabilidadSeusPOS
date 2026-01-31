<script setup lang="ts">
import SessionRoleChip from '../components/SessionRoleChip.vue'
import { computed, onMounted, ref } from 'vue'

type VentaDetalle = {
  venta_detalle_id: number
  venta_id: number
  producto_id: number
  producto_nombre?: string
  cantidad: number
  precio_unitario: string
  subtotal: string
}

type CuentaPorCobrar = {
  id: number
  venta_id: number
  cliente_id: string
  total: string
  saldo: string
  estado: string
  created_at: string
  updated_at: string | null
  cliente_nombre: string
  numero_factura: string
  venta_detalles: VentaDetalle[]
}

const CUENTAS_ENDPOINT = 'http://3.15.163.214/ApiPOS/contabilidad/cuentas-por-cobrar/'

const cuentas = ref<CuentaPorCobrar[]>([])
const cargando = ref(false)
const error = ref<string | null>(null)
const seleccionada = ref<CuentaPorCobrar | null>(null)
const cuentaAbono = ref<CuentaPorCobrar | null>(null)
const guardandoAbono = ref(false)
const errorAbono = ref<string | null>(null)
const mensajeAbono = ref<string | null>(null)
const formularioAbono = ref({
  fecha: '',
  monto: 0,
  concepto: 'Abono parcial'
})

const totalCuentas = computed(() => cuentas.value.length)
const totalSaldo = computed(() =>
  cuentas.value.reduce((total, item) => total + Number(item.saldo ?? 0), 0)
)
const totalPendientes = computed(
  () => cuentas.value.filter((item) => item.estado?.toUpperCase() === 'PENDIENTE').length
)

const formatoPesos = (valor: number) =>
  valor.toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0
  })

const cargarCuentas = async () => {
  cargando.value = true
  error.value = null
  try {
    const respuesta = await fetch(CUENTAS_ENDPOINT)
    if (!respuesta.ok) {
      const detalle = await respuesta.text().catch(() => '')
      throw new Error(detalle || `Error ${respuesta.status}`)
    }
    const data = (await respuesta.json()) as CuentaPorCobrar[]
    cuentas.value = data
  } catch (err) {
    console.error('Error al cargar cuentas por cobrar', err)
    error.value = 'No fue posible cargar la cartera.'
  } finally {
    cargando.value = false
  }
}

const abrirDetalle = (cuenta: CuentaPorCobrar) => {
  seleccionada.value = cuenta
}

const cerrarDetalle = () => {
  seleccionada.value = null
}

const abrirAbono = (cuenta: CuentaPorCobrar) => {
  cuentaAbono.value = cuenta
  errorAbono.value = null
  mensajeAbono.value = null
  formularioAbono.value = {
    fecha: new Date().toISOString().slice(0, 16),
    monto: Number(cuenta.saldo ?? 0),
    concepto: 'Abono parcial'
  }
}

const cerrarAbono = () => {
  cuentaAbono.value = null
  errorAbono.value = null
  mensajeAbono.value = null
}

const registrarAbono = async () => {
  if (!cuentaAbono.value) return
  guardandoAbono.value = true
  errorAbono.value = null
  mensajeAbono.value = null
  if (formularioAbono.value.monto <= 0) {
    errorAbono.value = 'El monto debe ser mayor a cero.'
    guardandoAbono.value = false
    return
  }
  if (!formularioAbono.value.concepto.trim()) {
    errorAbono.value = 'El concepto es obligatorio.'
    guardandoAbono.value = false
    return
  }
  const fechaBase = formularioAbono.value.fecha
  const fechaNormalizada = fechaBase.length === 16 ? `${fechaBase}:00` : fechaBase
  const fechaObj = new Date(fechaNormalizada)
  if (Number.isNaN(fechaObj.getTime())) {
    errorAbono.value = 'Fecha invalida.'
    guardandoAbono.value = false
    return
  }
  const payload = {
    fecha: fechaObj.toISOString(),
    monto: formularioAbono.value.monto,
    concepto: formularioAbono.value.concepto.trim(),
    caja_id: 1,
    usuario_id: 8,
    venta_id: cuentaAbono.value.venta_id
  }
  try {
    const respuesta = await fetch(
      `${CUENTAS_ENDPOINT}${cuentaAbono.value.id}/abonos`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }
    )
    if (!respuesta.ok) {
      const detalle = await respuesta.text().catch(() => '')
      throw new Error(detalle || `Error ${respuesta.status}`)
    }
    mensajeAbono.value = 'Abono registrado correctamente.'
    await cargarCuentas()
  } catch (err) {
    console.error('Error al registrar abono', err)
    const detalle = err instanceof Error ? err.message : String(err)
    errorAbono.value = `No fue posible registrar el abono. ${detalle}`
  } finally {
    guardandoAbono.value = false
  }
}

onMounted(() => {
  cargarCuentas()
})
</script>

<template>
  <main class="cartera">
    <header class="cartera__cabecera">
      <div>
        <p class="cartera__prefijo">Contabilidad</p>
        <h1>Cartera</h1>
        <p class="cartera__nota">Cuentas por cobrar y saldos pendientes.</p>
      </div>
      <div class="cartera__acciones">
        <SessionRoleChip />
        <button type="button" class="boton secundario" @click="cargarCuentas" :disabled="cargando">
          {{ cargando ? 'Actualizando...' : 'Actualizar' }}
        </button>
      </div>
    </header>

    <section class="cartera__resumen">
      <article class="tarjeta">
        <div>
          <p class="tarjeta__titulo">Cuentas</p>
          <p class="tarjeta__valor">{{ totalCuentas }}</p>
          <p class="tarjeta__detalle">Total registradas</p>
        </div>
        <span class="tarjeta__estado tarjeta__estado--pendiente">pendiente</span>
      </article>
      <article class="tarjeta">
        <div>
          <p class="tarjeta__titulo">Pendientes</p>
          <p class="tarjeta__valor">{{ totalPendientes }}</p>
          <p class="tarjeta__detalle">Estado pendiente</p>
        </div>
        <span class="tarjeta__estado tarjeta__estado--pendiente">pendiente</span>
      </article>
      <article class="tarjeta">
        <div>
          <p class="tarjeta__titulo">Saldo total</p>
          <p class="tarjeta__valor">{{ formatoPesos(totalSaldo) }}</p>
          <p class="tarjeta__detalle">Saldo por cobrar</p>
        </div>
        <span class="tarjeta__estado">resumen</span>
      </article>
    </section>

    <section class="panel">
      <header class="panel__cabecera">
        <h2>Listado de cuentas</h2>
        <p>Selecciona una cuenta para ver el detalle de la venta.</p>
      </header>

      <p v-if="cargando" class="ayuda">Cargando cuentas...</p>
      <p v-else-if="error" class="ayuda ayuda--error">{{ error }}</p>

      <ul v-else class="lista">
        <li v-for="cuenta in cuentas" :key="cuenta.id">
          <div>
            <strong>{{ cuenta.cliente_nombre || 'Sin cliente' }}</strong>
            <small>Factura {{ cuenta.numero_factura || cuenta.venta_id }}</small>
            <small>Saldo: {{ formatoPesos(Number(cuenta.saldo ?? 0)) }}</small>
          </div>
          <div class="acciones">
            <span :class="['estado', cuenta.estado?.toLowerCase()]">{{ cuenta.estado }}</span>
            <button type="button" class="secundario" @click="abrirDetalle(cuenta)">Ver detalle</button>
            <button type="button" class="secundario" @click="abrirAbono(cuenta)">Abonar</button>
          </div>
        </li>
      </ul>
    </section>

    <div
      v-if="seleccionada"
      class="modal"
      role="dialog"
      aria-modal="true"
      @click.self="cerrarDetalle"
    >
      <section class="modal__contenido" @click.stop>
        <div class="modal__encabezado">
          <h2>Detalle de cuenta</h2>
          <button type="button" class="modal__cerrar" @click="cerrarDetalle">x</button>
        </div>
        <div class="detalle">
          <div>
            <p class="detalle__titulo">{{ seleccionada.cliente_nombre }}</p>
            <p class="detalle__nota">Factura {{ seleccionada.numero_factura }}</p>
          </div>
          <div>
            <p class="detalle__label">Total</p>
            <p class="detalle__valor">{{ formatoPesos(Number(seleccionada.total ?? 0)) }}</p>
            <p class="detalle__label">Saldo</p>
            <p class="detalle__valor">{{ formatoPesos(Number(seleccionada.saldo ?? 0)) }}</p>
          </div>
        </div>
        <ul class="lista detalle-lista">
          <li v-for="detalle in seleccionada.venta_detalles" :key="detalle.venta_detalle_id">
            <div>
              <strong>{{ detalle.producto_nombre || `Producto ${detalle.producto_id}` }}</strong>
              <small>Cantidad: {{ detalle.cantidad }}</small>
            </div>
            <div class="acciones">
              <span class="estado">{{ formatoPesos(Number(detalle.subtotal ?? 0)) }}</span>
            </div>
          </li>
        </ul>
      </section>
    </div>

    <div
      v-if="cuentaAbono"
      class="modal"
      role="dialog"
      aria-modal="true"
      @click.self="cerrarAbono"
    >
      <section class="modal__contenido" @click.stop>
        <div class="modal__encabezado">
          <h2>Registrar abono</h2>
          <button type="button" class="modal__cerrar" @click="cerrarAbono">x</button>
        </div>
        <form class="form" @submit.prevent="registrarAbono">
          <label>
            <span>Fecha</span>
            <input v-model="formularioAbono.fecha" type="datetime-local" step="60" required />
          </label>
          <label>
            <span>Monto</span>
            <input v-model.number="formularioAbono.monto" type="number" min="0" step="0.01" required />
          </label>
          <label>
            <span>Concepto</span>
            <input v-model="formularioAbono.concepto" type="text" required />
          </label>
          <button type="submit" class="boton" :disabled="guardandoAbono">
            {{ guardandoAbono ? 'Guardando...' : 'Guardar abono' }}
          </button>
          <p v-if="errorAbono" class="ayuda ayuda--error">{{ errorAbono }}</p>
          <p v-if="mensajeAbono" class="ayuda">{{ mensajeAbono }}</p>
        </form>
      </section>
    </div>
  </main>
</template>

<style scoped>
.cartera {
  display: grid;
  gap: 1.5rem;
}

.cartera__cabecera {
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

.cartera__prefijo {
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.8rem;
  color: #94a3b8;
}

.cartera__cabecera h1 {
  margin: 0;
  font-size: clamp(2rem, 4vw, 2.6rem);
}

.cartera__nota {
  margin: 0.35rem 0 0;
  color: #cbd5e1;
}

.cartera__acciones {
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

.cartera__resumen {
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

.panel {
  background: #0d0f14;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 1rem;
  padding: 1.25rem;
  display: grid;
  gap: 1rem;
}

.panel__cabecera h2 {
  margin: 0 0 0.25rem;
}

.panel__cabecera p {
  margin: 0;
  color: #cbd5e1;
}

.lista {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.6rem;
}

.lista li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  padding: 0.7rem 0.85rem;
  border-radius: 0.85rem;
  border: 1px solid rgba(148, 163, 184, 0.22);
  background: #0f1015;
}

.lista strong {
  display: block;
  color: #f8fafc;
}

.lista small {
  display: block;
  color: #cbd5e1;
}

.acciones {
  display: flex;
  align-items: center;
  gap: 0.5rem;
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

.estado.pendiente {
  background: rgba(250, 204, 21, 0.16);
  border-color: rgba(250, 204, 21, 0.4);
  color: #fef9c3;
}

.secundario {
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: rgba(120, 126, 137, 0.12);
  color: #e2e8f0;
  border-radius: 0.65rem;
  padding: 0.4rem 0.75rem;
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

.form input {
  border-radius: 0.75rem;
  border: 1px solid rgba(148, 163, 184, 0.3);
  padding: 0.55rem 0.75rem;
  background: rgba(12, 13, 16, 0.92);
  color: #e2e8f0;
}

.ayuda {
  color: #94a3b8;
  font-size: 0.9rem;
  margin: 0;
}

.ayuda--error {
  color: #fca5a5;
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

.modal__contenido {
  padding: 1rem 1.2rem;
  border-radius: 1rem;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(10, 11, 14, 0.92);
  width: min(720px, 92vw);
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

.detalle {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}

.detalle__titulo {
  margin: 0;
  font-size: 1.1rem;
}

.detalle__nota {
  margin: 0.25rem 0 0;
  color: #94a3b8;
}

.detalle__label {
  margin: 0;
  color: #94a3b8;
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.detalle__valor {
  margin: 0 0 0.5rem;
  font-weight: 700;
  color: #facc15;
}

.detalle-lista {
  margin-top: 0.5rem;
}

@media (max-width: 720px) {
  .cartera__cabecera {
    flex-direction: column;
  }
}
</style>

