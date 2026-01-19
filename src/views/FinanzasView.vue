<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'

import { crearCartera, listarCartera } from '../services/cartera'
import { crearEgreso, listarEgresos } from '../services/egresos'
import { crearIngreso, listarIngresos } from '../services/ingresos'
import { listarCategorias } from '../services/categorias'
import type { Categoria, Registro, RegistroPayload, TipoRegistro } from '../services/tipos'
import { renderMarkdown } from '../utils/markdown'

type SeccionDetalle = TipoRegistro

type FormularioRegistro = {
  monto: number
  categoriaId: number | null
  fecha: string
  notas: string
}

const ingresos = ref<Registro[]>([])
const egresos = ref<Registro[]>([])
const cartera = ref<Registro[]>([])
const isOnline = ref(typeof navigator !== 'undefined' ? navigator.onLine : true)

const CACHE_CATEGORIAS_KEY = 'finanzas_categorias_cache'
const cacheKeyRegistros = (tipo: SeccionDetalle) => `finanzas_${tipo}_cache`
const queueKeyRegistros = (tipo: SeccionDetalle) => `finanzas_${tipo}_queue`

const leerJson = <T,>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

const guardarJson = (key: string, data: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(data))
  } catch {
    // Ignora errores de storage
  }
}

const pendientes = reactive<Record<SeccionDetalle, number>>({
  ingresos: 0,
  egresos: 0,
  cartera: 0
})

const crearFormulario = (): FormularioRegistro =>
  reactive({
    monto: 0,
    categoriaId: null,
    fecha: '',
    notas: ''
  })

const formularioIngreso = crearFormulario()
const formularioEgreso = crearFormulario()
const formularioCartera = crearFormulario()

const limpiarFormulario = (formulario: FormularioRegistro) => {
  formulario.monto = 0
  formulario.categoriaId = null
  formulario.fecha = ''
  formulario.notas = ''
}

const categorias = ref<Categoria[]>([])

const estadoSecciones = reactive<Record<SeccionDetalle, { cargando: boolean; error: string | null }>>({
  ingresos: { cargando: false, error: null },
  egresos: { cargando: false, error: null },
  cartera: { cargando: false, error: null }
})

const estadoCategorias = reactive({ cargando: false, error: null as string | null })

const categoriasPorTipo = computed<Record<SeccionDetalle, Categoria[]>>(() => {
  const base: Record<SeccionDetalle, Categoria[]> = {
    ingresos: [],
    egresos: [],
    cartera: []
  }

  categorias.value.forEach((categoria) => {
    base[categoria.tipo]?.push(categoria)
  })

  return base
})

const categoriasPorId = computed(() => {
  const mapa = new Map<number, Categoria>()
  categorias.value.forEach((categoria) => mapa.set(categoria.id, categoria))
  return mapa
})

const totalPendientes = computed(() => pendientes.ingresos + pendientes.egresos + pendientes.cartera)

const actualizarPendientes = (tipo: SeccionDetalle) => {
  const cola = leerJson<RegistroPayload[]>(queueKeyRegistros(tipo)) ?? []
  pendientes[tipo] = cola.length
}

const encolarRegistro = (tipo: SeccionDetalle, payload: RegistroPayload) => {
  const cola = leerJson<RegistroPayload[]>(queueKeyRegistros(tipo)) ?? []
  cola.push(payload)
  guardarJson(queueKeyRegistros(tipo), cola)
  actualizarPendientes(tipo)
}

const construirRegistroLocal = (payload: RegistroPayload): Registro => {
  const categoria = categoriasPorId.value.get(payload.categoriaId)
  return {
    id: -Number(`${Date.now()}${Math.floor(Math.random() * 1000)}`),
    monto: payload.monto,
    categoriaId: payload.categoriaId,
    fecha: payload.fecha,
    notas: payload.notas,
    categoriaMarkdown: categoria?.markdown ?? null
  }
}

const seleccionarCategoriaPredeterminada = (tipo: SeccionDetalle) => {
  const opciones = categoriasPorTipo.value[tipo]
  const formulario = configuracionSecciones[tipo].formulario

  if (formulario.categoriaId === null && opciones.length > 0) {
    formulario.categoriaId = opciones[0].id
  }
}

const cargarCategorias = async () => {
  estadoCategorias.cargando = true
  estadoCategorias.error = null

  const cacheCategorias = leerJson<Categoria[]>(CACHE_CATEGORIAS_KEY)
  if (cacheCategorias && cacheCategorias.length) {
    categorias.value = cacheCategorias
    ;(['ingresos', 'egresos', 'cartera'] as SeccionDetalle[]).forEach(seleccionarCategoriaPredeterminada)
  }

  try {
    categorias.value = await listarCategorias()
    guardarJson(CACHE_CATEGORIAS_KEY, categorias.value)
    ;(['ingresos', 'egresos', 'cartera'] as SeccionDetalle[]).forEach(seleccionarCategoriaPredeterminada)
  } catch (error) {
    console.error('Error al cargar categorías', error)
    estadoCategorias.error = cacheCategorias?.length
      ? 'Sin conexión. Mostrando categorías guardadas.'
      : 'No fue posible cargar las categorías desde el servidor.'
  } finally {
    estadoCategorias.cargando = false
  }
}

const cargarRegistros = async (tipo: SeccionDetalle, accionListar: () => Promise<Registro[]>, destino: typeof ingresos) => {
  estadoSecciones[tipo].cargando = true
  estadoSecciones[tipo].error = null

  const cacheRegistros = leerJson<Registro[]>(cacheKeyRegistros(tipo))
  if (cacheRegistros && cacheRegistros.length) {
    destino.value = cacheRegistros
  }

  try {
    destino.value = await accionListar()
    guardarJson(cacheKeyRegistros(tipo), destino.value)
  } catch (error) {
    console.error(`Error al cargar ${tipo}`, error)
    estadoSecciones[tipo].error = cacheRegistros?.length
      ? 'Sin conexión. Mostrando registros guardados.'
      : 'No se pudieron recuperar los registros. Inténtalo nuevamente.'
  } finally {
    estadoSecciones[tipo].cargando = false
  }
}

const agregarRegistro = async (
  tipo: SeccionDetalle,
  formulario: FormularioRegistro,
  accionCrear: (payload: RegistroPayload) => Promise<Registro>,
  destino: typeof ingresos
) => {
  if (formulario.categoriaId === null) {
    estadoSecciones[tipo].error = 'Selecciona una categoría antes de guardar.'
    return
  }

  estadoSecciones[tipo].error = null

  try {
    const categoriaId = formulario.categoriaId
    const payload: RegistroPayload = {
      monto: formulario.monto,
      categoriaId,
      fecha: formulario.fecha,
      notas: formulario.notas
    }

    if (!isOnline.value) {
      const registroLocal = construirRegistroLocal(payload)
      destino.value = [registroLocal, ...destino.value]
      guardarJson(cacheKeyRegistros(tipo), destino.value)
      encolarRegistro(tipo, payload)
      estadoSecciones[tipo].error = 'Sin conexión. Registro guardado localmente para sincronizar.'
      limpiarFormulario(formulario)
      seleccionarCategoriaPredeterminada(tipo)
      return
    }

    const registroCreado = await accionCrear(payload)
    destino.value = [...destino.value, registroCreado]
    guardarJson(cacheKeyRegistros(tipo), destino.value)
    limpiarFormulario(formulario)
    seleccionarCategoriaPredeterminada(tipo)
  } catch (error) {
    console.error(`Error al crear ${tipo}`, error)
    const categoriaId = formulario.categoriaId
    if (categoriaId !== null) {
      const payload: RegistroPayload = {
        monto: formulario.monto,
        categoriaId,
        fecha: formulario.fecha,
        notas: formulario.notas
      }
      const registroLocal = construirRegistroLocal(payload)
      destino.value = [registroLocal, ...destino.value]
      guardarJson(cacheKeyRegistros(tipo), destino.value)
      encolarRegistro(tipo, payload)
      estadoSecciones[tipo].error = 'Sin conexión. Registro guardado localmente para sincronizar.'
      limpiarFormulario(formulario)
      seleccionarCategoriaPredeterminada(tipo)
      return
    }
    estadoSecciones[tipo].error = 'No fue posible guardar el registro. Revisa los datos e inténtalo de nuevo.'
  }
}

const sincronizarTipo = async (
  tipo: SeccionDetalle,
  accionCrear: (payload: RegistroPayload) => Promise<Registro>,
  accionListar: () => Promise<Registro[]>,
  destino: typeof ingresos
) => {
  const cola = leerJson<RegistroPayload[]>(queueKeyRegistros(tipo)) ?? []
  if (!cola.length) {
    actualizarPendientes(tipo)
    return
  }

  for (let i = 0; i < cola.length; i += 1) {
    const payload = cola[i]
    try {
      await accionCrear(payload)
    } catch (error) {
      console.error(`Error al sincronizar ${tipo}`, error)
      const pendientesRestantes = cola.slice(i)
      guardarJson(queueKeyRegistros(tipo), pendientesRestantes)
      actualizarPendientes(tipo)
      return
    }
  }

  localStorage.removeItem(queueKeyRegistros(tipo))
  actualizarPendientes(tipo)
  await cargarRegistros(tipo, accionListar, destino)
}

const agregarIngreso = () => agregarRegistro('ingresos', formularioIngreso, crearIngreso, ingresos)
const agregarEgreso = () => agregarRegistro('egresos', formularioEgreso, crearEgreso, egresos)
const agregarCartera = () => agregarRegistro('cartera', formularioCartera, crearCartera, cartera)

const seccionActiva = ref<'landing' | SeccionDetalle>('landing')
const menuAbierto = ref(false)

const irASeccion = (seccion: SeccionDetalle | 'pendientes') => {
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

const actualizarEstadoConexion = () => {
  isOnline.value = navigator.onLine
  if (isOnline.value) {
    void sincronizarTipo('ingresos', crearIngreso, listarIngresos, ingresos)
    void sincronizarTipo('egresos', crearEgreso, listarEgresos, egresos)
    void sincronizarTipo('cartera', crearCartera, listarCartera, cartera)
  }
}

onMounted(() => {
  window.addEventListener('keydown', manejarEscape)
  window.addEventListener('online', actualizarEstadoConexion)
  window.addEventListener('offline', actualizarEstadoConexion)
  ;(['ingresos', 'egresos', 'cartera'] as SeccionDetalle[]).forEach(actualizarPendientes)
  actualizarEstadoConexion()
  cargarCategorias()
  cargarRegistros('ingresos', listarIngresos, ingresos)
  cargarRegistros('egresos', listarEgresos, egresos)
  cargarRegistros('cartera', listarCartera, cartera)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', manejarEscape)
  window.removeEventListener('online', actualizarEstadoConexion)
  window.removeEventListener('offline', actualizarEstadoConexion)
})

watch(seccionActiva, () => {
  menuAbierto.value = false
})

type ConfiguracionSeccion = {
  titulo: string
  descripcion: string
  formulario: FormularioRegistro
  registros: typeof ingresos
  categoriaPlaceholder: string
  notasPlaceholder: string
  vacio: string
  accion: () => Promise<void>
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

watch(seccionActivaDetalle, (nuevaSeccion) => {
  if (nuevaSeccion) {
    seleccionarCategoriaPredeterminada(nuevaSeccion)
  }
})

watch(categoriasPorTipo, () => {
  ;(['ingresos', 'egresos', 'cartera'] as SeccionDetalle[]).forEach(seleccionarCategoriaPredeterminada)
})

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
  const categoriasDisponibles = categoriasPorTipo.value[clave]
  const registrosDecorados = configuracion.registros.value.map((registro) => {
    const categoria = categoriasPorId.value.get(registro.categoriaId)
    const markdownPreferido = registro.categoriaMarkdown?.trim()
    const categoriaNombre = categoria?.nombre ?? 'Sin categoría'
    const markdownCategoria = categoria?.markdown?.trim()
    const contenido = markdownPreferido || markdownCategoria || categoriaNombre
    const categoriaHtml = renderMarkdown(contenido)

    return {
      ...registro,
      categoriaNombre,
      categoriaHtml
    }
  })

  return {
    clave,
    titulo: configuracion.titulo,
    descripcion: configuracion.descripcion,
    formulario: configuracion.formulario,
    registros: registrosDecorados,
    categoriaPlaceholder: configuracion.categoriaPlaceholder,
    notasPlaceholder: configuracion.notasPlaceholder,
    vacio: configuracion.vacio,
    accion: configuracion.accion,
    icono: configuracion.icono,
    categoriasDisponibles,
    estado: estadoSecciones[clave],
    categoriasEstado: estadoCategorias
  }
})

const enviarFormulario = async () => {
  if (!detalleVisible.value) {
    return
  }

  await detalleVisible.value.accion()
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
      <div class="encabezado__estado">
        <span class="estado-chip" :class="isOnline ? 'estado-chip--online' : 'estado-chip--offline'">
          {{ isOnline ? 'En línea' : 'Offline' }}
        </span>
        <span v-if="totalPendientes" class="estado-chip estado-chip--pendientes">
          Pendientes: {{ totalPendientes }}
        </span>
      </div>
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
              <select
                v-model="detalleVisible.formulario.categoriaId"
                :disabled="detalleVisible.categoriasDisponibles.length === 0"
                required
              >
                <option :value="null" disabled>Selecciona una categoría</option>
                <option
                  v-for="categoria in detalleVisible.categoriasDisponibles"
                  :key="categoria.id"
                  :value="categoria.id"
                >
                  {{ categoria.nombre }}
                </option>
              </select>
              <small v-if="detalleVisible.categoriasEstado.cargando" class="ayuda">Cargando categorías...</small>
              <small
                v-else-if="detalleVisible.categoriasDisponibles.length === 0"
                class="ayuda ayuda--error"
              >
                {{ detalleVisible.categoriasEstado.error ?? 'No hay categorías disponibles para este tipo.' }}
              </small>
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
            <button
              class="primario"
              type="submit"
              :disabled="
                detalleVisible.estado.cargando ||
                detalleVisible.categoriasDisponibles.length === 0 ||
                detalleVisible.categoriasEstado.cargando
              "
            >
              Guardar registro
            </button>
          </form>

          <p v-if="detalleVisible.estado.error" class="estado estado--error">{{ detalleVisible.estado.error }}</p>
          <p v-else-if="detalleVisible.estado.cargando" class="estado estado--info">Cargando registros...</p>

          <ul class="registros" aria-live="polite">
            <li v-for="registro in detalleVisible.registros" :key="registro.id">
              <span class="categoria" v-html="registro.categoriaHtml" :aria-label="registro.categoriaNombre"></span>
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

.encabezado__estado {
  display: inline-flex;
  gap: 0.5rem;
  justify-content: center;
}

.estado-chip {
  border-radius: 999px;
  padding: 0.25rem 0.6rem;
  font-size: 0.85rem;
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: rgba(148, 163, 184, 0.12);
  color: #e2e8f0;
}

.estado-chip--online {
  border-color: rgba(34, 197, 94, 0.45);
  background: rgba(34, 197, 94, 0.16);
  color: #dcfce7;
}

.estado-chip--offline {
  border-color: rgba(239, 68, 68, 0.45);
  background: rgba(239, 68, 68, 0.16);
  color: #fee2e2;
}

.estado-chip--pendientes {
  border-color: rgba(250, 204, 21, 0.55);
  background: rgba(250, 204, 21, 0.14);
  color: #fef9c3;
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
textarea,
select {
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
textarea:focus,
select:focus {
  outline: none;
  border-color: #60a5fa;
  box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.25);
  background-color: rgba(30, 41, 59, 0.85);
}

textarea {
  resize: vertical;
}

select {
  appearance: none;
  background-image: linear-gradient(45deg, transparent 50%, #94a3b8 50%),
    linear-gradient(135deg, #94a3b8 50%, transparent 50%);
  background-position: calc(100% - 1.4rem) calc(1.1rem), calc(100% - 1rem) calc(1.1rem);
  background-size: 0.4rem 0.4rem, 0.4rem 0.4rem;
  background-repeat: no-repeat;
  padding-right: 2.5rem;
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

.primario:disabled {
  cursor: not-allowed;
  opacity: 0.6;
  transform: none;
  box-shadow: none;
}

.ayuda {
  margin-top: 0.25rem;
  font-size: 0.8rem;
  color: #94a3b8;
}

.ayuda--error {
  color: #f87171;
}

.estado {
  margin: 1.1rem 0 0.6rem;
  font-size: 0.95rem;
}

.estado--error {
  color: #f87171;
}

.estado--info {
  color: #38bdf8;
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
