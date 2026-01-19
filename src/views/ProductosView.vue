<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'

type Producto = {
  id: number
  codigoBarras: string
  nombre: string
  categoriaId: number | null
  descripcion: string
  costo: number
  margen: number
  iva: number
  precioVenta: number
  creadoPorId: number | null
  actualizadoPorId: number | null
  fechaCreacion: string
  fechaActualizacion: string
  estado: 'activo' | 'inactivo'
}

type Categoria = {
  id: number
  nombre: string
}

const categorias = reactive<Categoria[]>([
  { id: 1, nombre: 'Bebidas' },
  { id: 2, nombre: 'Snacks' },
  { id: 3, nombre: 'Postres' }
])

const productos = reactive<Producto[]>([
  {
    id: 1,
    codigoBarras: '7701234500019',
    nombre: 'Cafe americano',
    categoriaId: 1,
    descripcion: 'Bebida caliente',
    costo: 1200,
    margen: 45,
    iva: 0,
    precioVenta: 1740,
    creadoPorId: 1,
    actualizadoPorId: 1,
    fechaCreacion: '2026-01-13 09:00',
    fechaActualizacion: '2026-01-13 09:00',
    estado: 'activo'
  }
])

const API_PRODUCTOS = 'http://127.0.0.1:8000/productos/'

const form = reactive({
  codigoBarras: '',
  nombre: '',
  categoriaId: null as number | null,
  descripcion: '',
  costo: 0,
  margen: 35,
  iva: 0,
  creadoPorId: null as number | null,
  estado: 'activo' as 'activo' | 'inactivo'
})

const filtroTexto = ref('')
const filtroCategoria = ref('Todas')
const filtroEstado = ref<'todos' | 'activo' | 'inactivo'>('todos')
const errorForm = ref('')
const mostrarFormulario = ref(false)
const filaEdicionId = ref<number | null>(null)
const filaEdicion = reactive({
  codigoBarras: '',
  nombre: '',
  categoriaId: null as number | null,
  descripcion: '',
  costo: 0,
  margen: 0,
  iva: 0,
  estado: 'activo' as 'activo' | 'inactivo'
})

const precioVentaCalculado = computed(() => {
  const costo = Number(form.costo || 0)
  const margen = Number(form.margen || 0)
  const iva = Number(form.iva || 0)
  const precio = costo * (1 + margen / 100)
  const precioFinal = precio * (1 + iva / 100)
  return Math.max(precioFinal, 0)
})

const cargarProductos = async () => {
  try {
    const respuesta = await fetch(API_PRODUCTOS)
    if (!respuesta.ok) {
      throw new Error(`Error ${respuesta.status}`)
    }
    const data = await respuesta.json()
    const lista = Array.isArray(data) ? data : Array.isArray(data.results) ? data.results : Array.isArray(data.data) ? data.data : []

    const categoriasMap = new Map<number, string>()
    const normalizados = lista
      .map((item, index) => {
        if (!item || typeof item !== 'object') return null
        const producto = item as Record<string, unknown>
        const id = Number(producto.producto_id ?? producto.id ?? producto.pk ?? index + 1)
        const codigoBarras = String(producto.codigo_barras ?? producto.codigoBarras ?? '')
        const nombre = String(producto.nombre ?? producto.name ?? 'Producto')
        const categoriaId = producto.categoria_id ?? producto.categoriaId ?? null
        const categoriaIdNumero = categoriaId === null ? null : Number(categoriaId)
        const descripcion = String(producto.descripcion ?? '')
        const costo = Number(producto.costo ?? 0)
        const margen = Number(producto.margen ?? 0)
        const iva = Number(producto.iva ?? 0)
        const precioVenta = Number(producto.precio_venta ?? producto.precioVenta ?? producto.precio ?? 0)
        const creadoPorId = producto.creado_por_id ?? producto.creadoPorId ?? null
        const actualizadoPorId = producto.actualizado_por_id ?? producto.actualizadoPorId ?? null
        const fechaCreacion = String(producto.fecha_creacion ?? producto.fechaCreacion ?? '')
        const fechaActualizacion = String(producto.fecha_actualizacion ?? producto.fechaActualizacion ?? '')
        const estadoRaw = producto.estado
        const estado =
          estadoRaw === false || estadoRaw === 'inactivo' ? 'inactivo' : estadoRaw === 'activo' ? 'activo' : 'activo'
        const categoriaNombre = producto.categoria_nombre ?? producto.categoriaNombre
        if (categoriaIdNumero !== null) {
          categoriasMap.set(
            categoriaIdNumero,
            typeof categoriaNombre === 'string' && categoriaNombre.trim()
              ? categoriaNombre
              : `Categoria ${categoriaIdNumero}`
          )
        }

        return {
          id,
          codigoBarras,
          nombre,
          categoriaId: categoriaIdNumero,
          descripcion,
          costo,
          margen,
          iva,
          precioVenta,
          creadoPorId: creadoPorId === null ? null : Number(creadoPorId),
          actualizadoPorId: actualizadoPorId === null ? null : Number(actualizadoPorId),
          fechaCreacion,
          fechaActualizacion,
          estado
        }
      })
      .filter(Boolean) as Producto[]

    if (normalizados.length) {
      productos.splice(0, productos.length, ...normalizados)
    }

    if (categoriasMap.size) {
      const nuevasCategorias = Array.from(categoriasMap.entries()).map(([id, nombre]) => ({ id, nombre }))
      categorias.splice(0, categorias.length, ...nuevasCategorias)
    }
  } catch (error) {
    console.error('No se pudieron cargar productos', error)
  }
}

onMounted(() => {
  void cargarProductos()
})

const categoriasFiltro = computed(() => ['Todas', ...new Set(categorias.map((categoria) => categoria.nombre))])

const resumen = computed(() => {
  const total = productos.length
  const activos = productos.filter((producto) => producto.estado === 'activo').length
  const inactivos = total - activos
  const conIva = productos.filter((producto) => producto.iva > 0).length
  return { total, activos, inactivos, conIva }
})

const productosFiltrados = computed(() => {
  const termino = filtroTexto.value.toLowerCase().trim()
  if (!termino) return []
  return productos.filter((producto) => {
    const categoria = categoriaNombre(producto.categoriaId)
    const matchTexto =
      producto.nombre.toLowerCase().includes(termino) ||
      producto.codigoBarras.toLowerCase().includes(termino) ||
      producto.descripcion.toLowerCase().includes(termino) ||
      categoria.toLowerCase().includes(termino)
    const matchCategoria = filtroCategoria.value === 'Todas' || categoria === filtroCategoria.value
    const matchEstado = filtroEstado.value === 'todos' || producto.estado === filtroEstado.value
    return matchTexto && matchCategoria && matchEstado
  })
})

const formatCurrency = (monto: number) =>
  monto.toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0
  })

const resetForm = () => {
  form.codigoBarras = ''
  form.nombre = ''
  form.categoriaId = null
  form.descripcion = ''
  form.costo = 0
  form.margen = 35
  form.iva = 0
  form.creadoPorId = null
  form.estado = 'activo'
}

const crearProducto = () => {
  errorForm.value = ''
  const nombre = form.nombre.trim()
  const codigoBarras = form.codigoBarras.trim()

  if (!nombre || !codigoBarras) {
    errorForm.value = 'Nombre y codigo de barras son obligatorios.'
    return
  }

  const ahora = new Date().toISOString().slice(0, 16).replace('T', ' ')
  productos.push({
    id: Date.now(),
    codigoBarras,
    nombre,
    categoriaId: form.categoriaId,
    descripcion: form.descripcion.trim(),
    costo: Number(form.costo || 0),
    margen: Number(form.margen || 0),
    iva: Number(form.iva || 0),
    precioVenta: Number(precioVentaCalculado.value.toFixed(0)),
    creadoPorId: form.creadoPorId,
    actualizadoPorId: form.creadoPorId,
    fechaCreacion: ahora,
    fechaActualizacion: ahora,
    estado: form.estado
  })

  resetForm()
  mostrarFormulario.value = false
}

const iniciarEdicionFila = (producto: Producto) => {
  filaEdicionId.value = producto.id
  filaEdicion.codigoBarras = producto.codigoBarras
  filaEdicion.nombre = producto.nombre
  filaEdicion.categoriaId = producto.categoriaId
  filaEdicion.descripcion = producto.descripcion
  filaEdicion.costo = producto.costo
  filaEdicion.margen = producto.margen
  filaEdicion.iva = producto.iva
  filaEdicion.estado = producto.estado
}

const cancelarEdicionFila = () => {
  filaEdicionId.value = null
}

const guardarEdicionFila = (producto: Producto) => {
  const nombre = filaEdicion.nombre.trim()
  const codigoBarras = filaEdicion.codigoBarras.trim()

  if (!nombre || !codigoBarras) {
    errorForm.value = 'Nombre y codigo de barras son obligatorios.'
    return
  }

  producto.codigoBarras = codigoBarras
  producto.nombre = nombre
  producto.categoriaId = filaEdicion.categoriaId
  producto.descripcion = filaEdicion.descripcion.trim()
  producto.costo = Number(filaEdicion.costo || 0)
  producto.margen = Number(filaEdicion.margen || 0)
  producto.iva = Number(filaEdicion.iva || 0)
  producto.precioVenta = Number(
    (producto.costo * (1 + producto.margen / 100) * (1 + producto.iva / 100)).toFixed(0)
  )
  producto.actualizadoPorId = producto.creadoPorId
  producto.fechaActualizacion = new Date().toISOString().slice(0, 16).replace('T', ' ')
  producto.estado = filaEdicion.estado

  filaEdicionId.value = null
}

const toggleEstado = (id: number) => {
  const item = productos.find((producto) => producto.id === id)
  if (!item) return
  item.estado = item.estado === 'activo' ? 'inactivo' : 'activo'
  item.fechaActualizacion = new Date().toISOString().slice(0, 16).replace('T', ' ')
}

const categoriaNombre = (id: number | null) =>
  categorias.find((categoria) => categoria.id === id)?.nombre ?? 'Sin categoria'
</script>

<template>
  <main class="productos">
    <header class="productos__cabecera">
      <div>
        <p class="productos__prefijo">Catalogo</p>
        <h1>Productos</h1>
        <p class="productos__nota">Gestiona el catalogo y los precios de venta.</p>
      </div>
      <div class="productos__acciones">
        <button type="button" class="boton secundaria">Exportar</button>
        <button type="button" class="boton" @click="mostrarFormulario = true">Nuevo producto</button>
      </div>
    </header>

    <section class="resumen">
      <article class="tarjeta">
        <p class="tarjeta__titulo">Productos activos</p>
        <strong>{{ resumen.activos }}</strong>
        <span>Total activos</span>
      </article>
      <article class="tarjeta tarjeta--alerta">
        <p class="tarjeta__titulo">Inactivos</p>
        <strong>{{ resumen.inactivos }}</strong>
        <span>Revisar estados</span>
      </article>
      <article class="tarjeta tarjeta--critico">
        <p class="tarjeta__titulo">Con IVA</p>
        <strong>{{ resumen.conIva }}</strong>
        <span>Productos gravados</span>
      </article>
      <article class="tarjeta">
        <p class="tarjeta__titulo">Total catalogo</p>
        <strong>{{ resumen.total }}</strong>
        <span>En inventario</span>
      </article>
    </section>

    <section class="panel filtros">
      <label class="campo">
        <span>Buscar</span>
        <input v-model="filtroTexto" type="search" placeholder="Nombre, codigo o categoria" />
      </label>
      <label class="campo">
        <span>Categoria</span>
        <select v-model="filtroCategoria">
          <option v-for="categoria in categoriasFiltro" :key="categoria" :value="categoria">
            {{ categoria }}
          </option>
        </select>
      </label>
      <label class="campo">
        <span>Estado</span>
        <select v-model="filtroEstado">
          <option value="todos">Todos</option>
          <option value="activo">Activos</option>
          <option value="inactivo">Inactivos</option>
        </select>
      </label>
    </section>

    <section v-if="mostrarFormulario" class="formulario-modal" @click.self="mostrarFormulario = false">
      <div class="panel form-panel">
        <header class="panel__cabecera">
          <h2>Crear producto</h2>
          <button type="button" class="cerrar" @click="mostrarFormulario = false">Cerrar</button>
        </header>

        <form class="form" @submit.prevent="crearProducto">
          <label>
            <span>Codigo de barras</span>
            <input v-model="form.codigoBarras" type="text" placeholder="7701234500019" />
          </label>
          <label>
            <span>Nombre</span>
            <input v-model="form.nombre" type="text" placeholder="Producto" />
          </label>
          <label>
            <span>Categoria</span>
            <select v-model="form.categoriaId">
              <option :value="null">Sin categoria</option>
              <option v-for="categoria in categorias" :key="categoria.id" :value="categoria.id">
                {{ categoria.nombre }}
              </option>
            </select>
          </label>
          <label>
            <span>Descripcion</span>
            <input v-model="form.descripcion" type="text" placeholder="Opcional" />
          </label>
          <label>
            <span>Costo</span>
            <input v-model.number="form.costo" type="number" min="0" step="1" />
          </label>
          <label>
            <span>Margen %</span>
            <input v-model.number="form.margen" type="number" min="0" step="1" />
          </label>
          <label>
            <span>IVA %</span>
            <input v-model.number="form.iva" type="number" min="0" step="0.01" />
          </label>
          <label>
            <span>Precio venta (calculado)</span>
            <input :value="formatCurrency(precioVentaCalculado)" type="text" readonly />
          </label>
          <label>
            <span>Creado por (id)</span>
            <input v-model.number="form.creadoPorId" type="number" min="0" step="1" />
          </label>
          <label>
            <span>Estado</span>
            <select v-model="form.estado">
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
            </select>
          </label>
          <button type="submit">Guardar producto</button>
          <p v-if="errorForm" class="error">{{ errorForm }}</p>
        </form>
      </div>
    </section>

    <section class="panel tabla">
      <header class="tabla__cabecera">
        <h2>Listado de productos</h2>
        <span>{{ productosFiltrados.length }} resultados</span>
      </header>

      <div class="tabla__grid">
        <div class="tabla__fila tabla__encabezado">
          <span>Producto</span>
          <span>Categoria</span>
          <span>Costo</span>
          <span>Margen</span>
          <span>IVA</span>
          <span>Precio venta</span>
          <span>Estado</span>
          <span>Actualizado</span>
          <span>Acciones</span>
        </div>

        <div
          v-for="producto in productosFiltrados"
          :key="producto.id"
          :class="['tabla__fila', { 'tabla__fila--edicion': filaEdicionId === producto.id }]"
        >
          <div class="producto">
            <div v-if="filaEdicionId === producto.id" class="producto__edicion">
              <input v-model="filaEdicion.nombre" type="text" placeholder="Nombre" />
              <input v-model="filaEdicion.codigoBarras" type="text" placeholder="Codigo barras" />
              <input v-model="filaEdicion.descripcion" type="text" placeholder="Descripcion" />
            </div>
            <div v-else>
              <p class="producto__nombre">{{ producto.nombre }}</p>
              <small>{{ producto.codigoBarras }} · {{ producto.descripcion || 'Sin descripcion' }}</small>
            </div>
          </div>
          <span v-if="filaEdicionId === producto.id">
            <select v-model="filaEdicion.categoriaId">
              <option :value="null">Sin categoria</option>
              <option v-for="categoria in categorias" :key="categoria.id" :value="categoria.id">
                {{ categoria.nombre }}
              </option>
            </select>
          </span>
          <span v-else>{{ categoriaNombre(producto.categoriaId) }}</span>
          <span v-if="filaEdicionId === producto.id">
            <input v-model.number="filaEdicion.costo" type="number" min="0" step="1" />
          </span>
          <span v-else>{{ formatCurrency(producto.costo) }}</span>
          <span v-if="filaEdicionId === producto.id">
            <input v-model.number="filaEdicion.margen" type="number" min="0" step="1" />
          </span>
          <span v-else>{{ producto.margen }}%</span>
          <span v-if="filaEdicionId === producto.id">
            <input v-model.number="filaEdicion.iva" type="number" min="0" step="0.01" />
          </span>
          <span v-else>{{ producto.iva }}%</span>
          <span class="precio">
            {{
              filaEdicionId === producto.id
                ? formatCurrency(filaEdicion.costo * (1 + filaEdicion.margen / 100) * (1 + filaEdicion.iva / 100))
                : formatCurrency(producto.precioVenta)
            }}
          </span>
          <span v-if="filaEdicionId === producto.id">
            <select v-model="filaEdicion.estado">
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
            </select>
          </span>
          <span v-else :class="['estado', producto.estado]">{{ producto.estado }}</span>
          <span>{{ producto.fechaActualizacion }}</span>
          <div class="acciones">
            <template v-if="filaEdicionId === producto.id">
              <button
                type="button"
                class="icono"
                data-label="Guardar"
                aria-label="Guardar"
                @click="guardarEdicionFila(producto)"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M9 16.2l-3.5-3.5L4 14.2 9 19l12-12-1.5-1.5z"
                    fill="currentColor"
                  />
                </svg>
              </button>
              <button
                type="button"
                class="icono"
                data-label="Cancelar"
                aria-label="Cancelar"
                @click="cancelarEdicionFila"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M18.3 5.7L12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3z"
                    fill="currentColor"
                  />
                </svg>
              </button>
            </template>
            <template v-else>
              <button
                type="button"
                class="icono"
                data-label="Editar"
                aria-label="Editar"
                @click="iniciarEdicionFila(producto)"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M3 17.2V21h3.8l11-11-3.8-3.8-11 11zm17.7-10.5c.4-.4.4-1 0-1.4l-2.5-2.5c-.4-.4-1-.4-1.4 0l-2 2 3.8 3.8 2.1-1.9z"
                    fill="currentColor"
                  />
                </svg>
              </button>
              <button
                type="button"
                class="icono"
                data-label="Estado"
                aria-label="Cambiar estado"
                @click="toggleEstado(producto.id)"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M13 3h-2v10h2V3zm-1 18c-4.4 0-8-3.6-8-8 0-3.1 1.8-5.8 4.5-7V3.3C4.5 4.9 2 8.4 2 13c0 5.5 4.5 10 10 10s10-4.5 10-10c0-4.6-2.5-8.1-6.5-9.7V6c2.7 1.2 4.5 3.9 4.5 7 0 4.4-3.6 8-8 8z"
                    fill="currentColor"
                  />
                </svg>
              </button>
            </template>
          </div>
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>
.productos {
  display: grid;
  gap: 1.5rem;
}

.productos__cabecera {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.productos__prefijo {
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.8rem;
  color: #94a3b8;
}

.productos__nota {
  margin: 0.25rem 0 0;
  color: #cbd5e1;
}

.productos__acciones {
  display: flex;
  gap: 0.5rem;
}

.boton {
  border: none;
  border-radius: 0.75rem;
  padding: 0.6rem 1rem;
  font-weight: 700;
  cursor: pointer;
  color: #0b0d12;
  background: linear-gradient(120deg, #facc15, #fbbf24);
  box-shadow: 0 12px 25px rgba(0, 0, 0, 0.35);
}

.boton.secundaria {
  background: rgba(120, 126, 137, 0.2);
  color: #e2e8f0;
  box-shadow: none;
  border: 1px solid rgba(148, 163, 184, 0.3);
}

.resumen {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}

.tarjeta {
  background: #0d0f14;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 1rem;
  padding: 1rem;
  display: grid;
  gap: 0.35rem;
  box-shadow: 0 20px 55px rgba(0, 0, 0, 0.45);
}

.tarjeta strong {
  font-size: 1.7rem;
  color: #f8fafc;
}

.tarjeta__titulo {
  margin: 0;
  color: #cbd5e1;
  font-weight: 600;
}

.tarjeta span {
  color: #94a3b8;
  font-size: 0.85rem;
}

.tarjeta--alerta {
  border-color: rgba(250, 204, 21, 0.4);
}

.tarjeta--critico {
  border-color: rgba(248, 113, 113, 0.5);
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

.filtros {
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}

.campo {
  display: grid;
  gap: 0.35rem;
  color: #e2e8f0;
  font-weight: 600;
}

.campo input,
.campo select {
  border-radius: 0.75rem;
  border: 1px solid rgba(148, 163, 184, 0.3);
  padding: 0.55rem 0.75rem;
  background: rgba(12, 13, 16, 0.92);
  color: #e2e8f0;
}

.formulario-modal {
  position: fixed;
  inset: 0;
  background: rgba(3, 6, 12, 0.6);
  display: grid;
  place-items: center;
  padding: 1.5rem;
  z-index: 10;
}

.formulario-modal .panel {
  width: min(900px, 100%);
}

.form-panel .panel__cabecera {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.cerrar {
  border: 1px solid rgba(148, 163, 184, 0.3);
  background: rgba(120, 126, 137, 0.2);
  color: #e2e8f0;
  border-radius: 0.7rem;
  padding: 0.45rem 0.8rem;
  cursor: pointer;
}

.form {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: 1fr;
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

.form button {
  justify-self: start;
  border: none;
  border-radius: 0.75rem;
  padding: 0.6rem 1rem;
  font-weight: 700;
  cursor: pointer;
  color: #0b0d12;
  background: linear-gradient(120deg, #facc15, #fbbf24);
}

.error {
  margin: 0;
  color: #f87171;
  font-size: 0.9rem;
}

.tabla__grid {
  display: grid;
  gap: 0.65rem;
}

.tabla__fila {
  display: grid;
  grid-template-columns: 2fr 1fr 0.7fr 0.6fr 0.6fr 0.9fr 0.7fr 0.9fr 1fr;
  gap: 0.75rem;
  align-items: center;
  padding: 0.75rem 0.9rem;
  border-radius: 0.8rem;
  background: #0f1015;
  border: 1px solid rgba(148, 163, 184, 0.22);
}

.tabla__fila:hover {
  border-color: rgba(226, 232, 240, 0.35);
}

.tabla__fila--edicion {
  border-color: rgba(250, 204, 21, 0.6);
  box-shadow: 0 0 0 1px rgba(250, 204, 21, 0.2), 0 20px 45px rgba(0, 0, 0, 0.5);
}

.tabla__encabezado {
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #94a3b8;
  background: transparent;
  border: none;
  padding: 0 0.5rem;
}

.tabla__cabecera {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.producto__nombre {
  margin: 0;
  font-weight: 700;
}

.producto small {
  color: #94a3b8;
}

.producto__edicion {
  display: grid;
  gap: 0.35rem;
}

.producto__edicion input {
  border-radius: 0.65rem;
  border: 1px solid rgba(148, 163, 184, 0.3);
  padding: 0.4rem 0.55rem;
  background: rgba(8, 10, 14, 0.9);
  color: #e2e8f0;
}

.tabla__fila input,
.tabla__fila select {
  border-radius: 0.65rem;
  border: 1px solid rgba(148, 163, 184, 0.3);
  padding: 0.4rem 0.55rem;
  background: rgba(8, 10, 14, 0.9);
  color: #e2e8f0;
  min-width: 0;
}

.tabla__fila input:focus,
.tabla__fila select:focus {
  outline: none;
  border-color: rgba(250, 204, 21, 0.65);
  box-shadow: 0 0 0 3px rgba(250, 204, 21, 0.2);
}

.precio {
  color: #0b0d12;
  font-weight: 700;
  background: linear-gradient(120deg, #facc15, #fbbf24);
  padding: 0.35rem 0.55rem;
  border-radius: 0.6rem;
  text-align: center;
}

.estado {
  font-size: 0.75rem;
  padding: 0.25rem 0.6rem;
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

.acciones {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.icono {
  position: relative;
  border: 1px solid rgba(148, 163, 184, 0.4);
  background: rgba(15, 23, 42, 0.65);
  color: #e2e8f0;
  border-radius: 0.7rem;
  width: 2.4rem;
  height: 2.4rem;
  display: inline-grid;
  place-items: center;
  cursor: pointer;
  transition: transform 0.15s ease, border-color 0.15s ease, background 0.15s ease;
}

.icono svg {
  width: 1.1rem;
  height: 1.1rem;
}

.icono:hover,
.icono:focus-visible {
  border-color: rgba(250, 204, 21, 0.6);
  background: rgba(250, 204, 21, 0.16);
  transform: translateY(-1px);
  outline: none;
}

.icono::after {
  content: attr(data-label);
  position: absolute;
  bottom: calc(100% + 0.35rem);
  left: 50%;
  transform: translateX(-50%);
  padding: 0.25rem 0.5rem;
  border-radius: 0.5rem;
  background: rgba(15, 23, 42, 0.95);
  color: #e2e8f0;
  font-size: 0.75rem;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;
}

.icono:focus-visible::after,
.icono:hover::after {
  opacity: 1;
}

@media (max-width: 960px) {
  .tabla__fila {
    grid-template-columns: 1.6fr 1fr 0.7fr 0.6fr 0.6fr 0.9fr 1fr;
  }

  .tabla__fila .acciones {
    grid-column: 1 / -1;
  }
}

@media (max-width: 720px) {
  .productos__cabecera {
    flex-direction: column;
  }

  .tabla__fila {
    grid-template-columns: 1fr 1fr;
  }

  .tabla__encabezado {
    display: none;
  }
}
</style>
