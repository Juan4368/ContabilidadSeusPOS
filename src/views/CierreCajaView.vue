<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ENDPOINTS } from '../config/endpoints'
import { getSessionUserId } from '../utils/session'

const toLocalInputUTCMinus5 = (date: Date) => {
  const utcMs = date.getTime() + date.getTimezoneOffset() * 60000
  const utcMinus5 = new Date(utcMs - 5 * 60 * 60000)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${utcMinus5.getFullYear()}-${pad(utcMinus5.getMonth() + 1)}-${pad(utcMinus5.getDate())}T${pad(
    utcMinus5.getHours()
  )}:${pad(utcMinus5.getMinutes())}`
}

const fechaCierre = ref(toLocalInputUTCMinus5(new Date()))
const cajaId = ref<number | null>(null)
const cargando = ref(false)
const guardando = ref(false)
const mensaje = ref<string | null>(null)
const error = ref<string | null>(null)

const denominaciones = [2000, 5000, 10000, 20000, 50000, 100000] as const
const cantidades = ref<Record<number, number>>({
  2000: 0,
  5000: 0,
  10000: 0,
  20000: 0,
  50000: 0,
  100000: 0
})

const totalEfectivo = computed(() =>
  denominaciones.reduce((acc, denom) => acc + denom * (cantidades.value[denom] ?? 0), 0)
)

const formatMoney = (value: number) =>
  value.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })


const fechaConteoIso = computed(() => {
  const base = fechaCierre.value?.trim()
  if (!base) return new Date(Date.now() - 5 * 60 * 60000).toISOString()
  const normalizada = base.length === 16 ? `${base}:00` : base
  const dt = new Date(normalizada)
  if (Number.isNaN(dt.getTime())) {
    return new Date(Date.now() - 5 * 60 * 60000).toISOString()
  }
  return new Date(dt.getTime() - 5 * 60 * 60000).toISOString()
})

const obtenerCajaSesion = () => {
  try {
    const raw = localStorage.getItem('pos_sesion')
    if (!raw) return null
    const data = JSON.parse(raw) as { cajaId?: number | null }
    return Number.isFinite(data.cajaId) ? Number(data.cajaId) : null
  } catch {
    return null
  }
}

const cargarDenominaciones = async () => {
  if (!cajaId.value) return
  cargando.value = true
  error.value = null
  try {
    const respuesta = await fetch(ENDPOINTS.CONTABILIDAD_CIERRE_CAJA_DENOMINACIONES)
    if (!respuesta.ok) {
      const detalle = await respuesta.text().catch(() => '')
      throw new Error(detalle || `Error ${respuesta.status}`)
    }
    const data = await respuesta.json()
    const lista = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : []
    const registrosCaja = (lista as Array<Record<string, unknown>>).filter(
      (item) => Number(item.caja_id ?? 0) === cajaId.value
    )
    for (const denom of denominaciones) {
      cantidades.value[denom] = 0
    }
    for (const item of registrosCaja) {
      const denom = Number(item.denominacion ?? 0)
      if (!denominaciones.includes(denom as (typeof denominaciones)[number])) continue
      const cantidad = Number(item.cantidad ?? 0)
      cantidades.value[denom] = Number.isFinite(cantidad) && cantidad > 0 ? cantidad : 0
    }
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err)
    error.value = `No se pudo cargar cierre de caja. ${detalle}`
  } finally {
    cargando.value = false
  }
}

const CIERRE_CAJA_BULK_URL = 'http://127.0.0.1:8000/contabilidad/cierre-caja-denominaciones/bulk'

const abrirHistorico = () => {
  window.dispatchEvent(new CustomEvent('app:cambiar-vista', { detail: { vista: 'cierre-historico' } }))
}

const guardarCierre = async () => {
  if (!cajaId.value) {
    error.value = 'No hay caja seleccionada en la sesión.'
    return
  }
  guardando.value = true
  error.value = null
  mensaje.value = null
  try {
    const usuarioId = getSessionUserId()
    if (!usuarioId) {
      throw new Error('No se pudo identificar el usuario de la sesión.')
    }
    const payload = denominaciones
      .map((denom) => {
        const cantidad = Number(cantidades.value[denom] ?? 0)
        return {
          caja_id: cajaId.value as number,
          usuario_id: usuarioId,
          denominacion: Number(denom),
          cantidad,
          fecha_conteo: fechaConteoIso.value
        }
      })
      .filter((item) => item.cantidad > 0)
    if (payload.length === 0) {
      throw new Error('Ingresa al menos una denominacion con cantidad mayor a cero.')
    }
    let respuesta = await fetch(CIERRE_CAJA_BULK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    if (!respuesta.ok && respuesta.status === 422) {
      // Compatibilidad: algunos backends esperan objeto con items.
      respuesta = await fetch(CIERRE_CAJA_BULK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: payload })
      })
    }
    if (!respuesta.ok) {
      const detalle = await respuesta.text().catch(() => '')
      throw new Error(detalle || `Error ${respuesta.status}`)
    }
    mensaje.value = 'Cierre guardado correctamente.'
    fechaCierre.value = toLocalInputUTCMinus5(new Date())
    for (const denom of denominaciones) {
      cantidades.value[denom] = 0
    }
    setTimeout(() => {
      mensaje.value = null
    }, 3000)
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err)
    error.value = `No se pudo guardar cierre. ${detalle}`
  } finally {
    guardando.value = false
  }
}

onMounted(() => {
  cajaId.value = obtenerCajaSesion()
  void cargarDenominaciones()
})
</script>

<template>
  <main class="pos cierre">
    <header class="pos-topbar">
      <div class="topbar__left">
        <div class="chip chip--exito">Cierre de caja</div>
        <div class="chip">Turno actual</div>
        <div class="chip" v-if="cajaId">Caja {{ cajaId }}</div>
      </div>
      <div class="topbar__center">
        <strong>Resumen y cierre del turno</strong>
      </div>
      <div class="topbar__right">
        <button type="button" class="boton secundaria">Imprimir</button>
        <button type="button" class="boton secundaria" @click="abrirHistorico">Historico</button>
        <button type="button" class="boton primario" :disabled="guardando" @click="guardarCierre">
          {{ guardando ? 'Guardando...' : 'Guardar cierre' }}
        </button>
      </div>
    </header>

    <section class="layout layout--split">
      <section class="panel">
        <header class="panel__encabezado">
          <h2>Conteo de efectivo</h2>
          <label class="campo">
            <span>Fecha de cierre</span>
            <input v-model="fechaCierre" type="datetime-local" step="60" />
          </label>
        </header>

        <div class="denominaciones">
          <label v-for="denom in denominaciones" :key="denom" class="denominacion">
            <span>{{ denom.toLocaleString('es-CO') }}</span>
            <input
              v-model.number="cantidades[denom]"
              type="number"
              min="0"
              step="1"
              inputmode="numeric"
              placeholder="0"
            />
            <small>{{ formatMoney(denom * (cantidades[denom] ?? 0)) }}</small>
          </label>
        </div>
      </section>

      <section class="panel detalle">
        <header class="panel__encabezado">
          <h2>Resumen</h2>
        </header>

        <dl class="totales">
          <div class="total">
            <dt>Total efectivo</dt>
            <dd>
              {{ formatMoney(totalEfectivo) }}
            </dd>
          </div>
        </dl>

        <p v-if="!cajaId" class="nota-error">No hay caja seleccionada en la sesión.</p>
        <p v-else-if="cargando" class="nota-ayuda">Cargando denominaciones...</p>
        <p v-if="mensaje" class="nota-ok">{{ mensaje }}</p>
        <p v-if="error" class="nota-error">{{ error }}</p>
      </section>
    </section>
  </main>
</template>

<style scoped>
.pos {
  display: grid;
  grid-template-rows: auto 1fr;
  gap: 0.75rem;
  min-height: 100%;
  padding: 0.75rem;
  background: #2b2b2b;
  color: #e5e7eb;
}

.pos-topbar {
  display: grid;
  grid-template-columns: auto minmax(260px, 1fr) auto;
  gap: 0.75rem;
  align-items: center;
  background: #3b3b3b;
  border: 1px solid #434343;
  border-radius: 0.85rem;
  padding: 0.45rem 0.75rem;
}

.topbar__left,
.topbar__right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.topbar__center {
  color: #e5e7eb;
  font-weight: 600;
}

.chip {
  background: rgba(120, 130, 140, 0.25);
  border: 1px solid rgba(148, 163, 184, 0.35);
  padding: 0.35rem 0.7rem;
  border-radius: 999px;
  color: #f8fafc;
  font-size: 0.9rem;
}

.chip--exito {
  background: rgba(250, 204, 21, 0.14);
  border-color: rgba(250, 204, 21, 0.35);
}

.layout {
  display: grid;
  grid-template-columns: 1fr 360px;
  gap: 0.6rem;
}

.layout--split {
  align-items: stretch;
}

.panel {
  background: #2a2a2a;
  border: 1px solid #3c3c3c;
  border-radius: 0.9rem;
  padding: 0.8rem;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.35);
  display: grid;
  gap: 0.8rem;
}

.detalle {
  align-content: start;
  gap: 0.6rem;
}

.panel__encabezado {
  display: grid;
  gap: 0.6rem;
}

.panel__encabezado h2 {
  margin: 0;
}

.campo {
  display: grid;
  gap: 0.35rem;
  color: #e5e7eb;
}

.campo input {
  background: #1f1f1f;
  color: #e5e7eb;
  border: 1px solid #4a4a4a;
  border-radius: 0.7rem;
  padding: 0.45rem 0.6rem;
}

.denominaciones {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 0.6rem;
}

.denominacion {
  display: grid;
  gap: 0.35rem;
  padding: 0.6rem;
  background: #252525;
  border: 1px solid #3a3a3a;
  border-radius: 0.7rem;
  color: #e5e7eb;
}

.denominacion input {
  background: #1f1f1f;
  color: #e5e7eb;
  border: 1px solid #4a4a4a;
  border-radius: 0.6rem;
  padding: 0.35rem 0.55rem;
  width: 100%;
  box-sizing: border-box;
}

.denominacion input::-webkit-outer-spin-button,
.denominacion input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.denominacion input[type='number'] {
  -moz-appearance: textfield;
}

.denominacion small {
  color: #94a3b8;
  font-size: 0.78rem;
}

.totales {
  display: grid;
  gap: 0.6rem;
  margin: 0;
}

.totales > div {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.6rem 0.8rem;
  background: #232323;
  border: 1px solid #353535;
  border-radius: 0.7rem;
}

.totales dt {
  font-weight: 600;
}

.totales dd {
  margin: 0;
  font-weight: 700;
  color: #facc15;
}

.boton {
  border-radius: 0.65rem;
  padding: 0.5rem 0.9rem;
  border: 1px solid rgba(148, 163, 184, 0.28);
  background: rgba(250, 204, 21, 0.18);
  color: #f8fafc;
  font-weight: 600;
  cursor: pointer;
}

.boton.primario {
  border-color: rgba(250, 204, 21, 0.6);
  background: rgba(250, 204, 21, 0.28);
}

.boton.secundaria {
  background: rgba(148, 163, 184, 0.12);
}

.nota-ayuda {
  margin: 0;
  color: #9ca3af;
  font-size: 0.9rem;
}

.nota-ok {
  margin: 0;
  color: #86efac;
  font-size: 0.9rem;
}

.nota-error {
  margin: 0;
  color: #fca5a5;
  font-size: 0.9rem;
}

@media (max-width: 980px) {
  .layout {
    grid-template-columns: 1fr;
  }
  .pos-topbar {
    grid-template-columns: 1fr;
  }
}
</style>
