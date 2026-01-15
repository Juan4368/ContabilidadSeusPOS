<script setup lang="ts">
import { computed, reactive, ref } from 'vue'

type Producto = {
  id: number
  nombre: string
  precio: number
  stock: number
  categoria: string
  destacador?: string
}

type ItemCarrito = {
  id: number
  nombre: string
  precio: number
  cantidad: number
  descuentoPct: number
}

const productos = reactive<Producto[]>([
  { id: 1, nombre: 'Café americano', precio: 2.5, stock: 18, categoria: 'Bebidas', destacador: 'Caliente' },
  { id: 2, nombre: 'Latte vainilla', precio: 3.9, stock: 12, categoria: 'Bebidas', destacador: 'Nuevo' },
  { id: 3, nombre: 'Sandwich pollo', precio: 5.5, stock: 9, categoria: 'Snacks' },
  { id: 4, nombre: 'Wrap veggie', precio: 4.8, stock: 6, categoria: 'Snacks', destacador: 'Vegano' },
  { id: 5, nombre: 'Brownie choco', precio: 2.8, stock: 15, categoria: 'Postres' },
  { id: 6, nombre: 'Cheesecake', precio: 3.6, stock: 7, categoria: 'Postres' },
  { id: 7, nombre: 'Agua mineral', precio: 1.5, stock: 24, categoria: 'Bebidas' },
  { id: 8, nombre: 'Combo desayuno', precio: 7.5, stock: 5, categoria: 'Combos', destacador: '-10%' }
])

const categorias = computed(() => ['Todo', ...new Set(productos.map((p) => p.categoria))])

const consulta = ref('')
const categoriaActiva = ref('Todo')
const carrito = ref<ItemCarrito[]>([])
const descuentoPct = ref(0)
const pagoRecibido = ref(0)
const notaRapida = ref('Venta mostrador')
const ultimaAccion = ref('Listo para vender')

const filtrados = computed(() => {
  const termino = consulta.value.toLowerCase().trim()
  return productos.filter((producto) => {
    const coincideTexto =
      termino === '' ||
      producto.nombre.toLowerCase().includes(termino) ||
      producto.categoria.toLowerCase().includes(termino)
    const coincideCategoria = categoriaActiva.value === 'Todo' || producto.categoria === categoriaActiva.value
    return coincideTexto && coincideCategoria
  })
})

const normalizarDescuento = (valor: number | undefined) => Math.min(Math.max(valor ?? 0, 0), 100)

const resumenCarrito = computed(() => {
  const subtotalBruto = carrito.value.reduce((total, item) => total + item.precio * item.cantidad, 0)

  const subtotalConLineas = carrito.value.reduce((total, item) => {
    const descuentoLinea = normalizarDescuento(item.descuentoPct)
    const factor = 1 - descuentoLinea / 100
    return total + item.precio * item.cantidad * factor
  }, 0)

  const descuentoLineas = subtotalBruto - subtotalConLineas
  const descuentoGlobalPct = normalizarDescuento(descuentoPct.value)
  const descuentoGlobal = subtotalConLineas * (descuentoGlobalPct / 100)
  const baseImponible = Math.max(subtotalConLineas - descuentoGlobal, 0)
  const impuesto = baseImponible * 0.07
  const total = Math.max(baseImponible + impuesto, 0)
  const cambio = Math.max(pagoRecibido.value - total, 0)

  return {
    subtotalBruto,
    descuentoLineas,
    descuentoGlobal,
    impuesto,
    total,
    cambio
  }
})

const formatCurrency = (monto: number) =>
  monto.toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0
  })

const totalLinea = (item: ItemCarrito) => {
  const descuentoLinea = normalizarDescuento(item.descuentoPct)
  return item.precio * item.cantidad * (1 - descuentoLinea / 100)
}

const agregarAlCarrito = (producto: Producto) => {
  const existente = carrito.value.find((item) => item.id === producto.id)
  if (existente) {
    existente.cantidad++
  } else {
    carrito.value.push({
      id: producto.id,
      nombre: producto.nombre,
      precio: producto.precio,
      cantidad: 1,
      descuentoPct: 0
    })
  }
  ultimaAccion.value = `${producto.nombre} añadido`
}

const actualizarCantidad = (id: number, delta: number) => {
  const item = carrito.value.find((articulo) => articulo.id === id)
  if (!item) return
  item.cantidad += delta
  if (item.cantidad <= 0) {
    carrito.value = carrito.value.filter((articulo) => articulo.id !== id)
    ultimaAccion.value = 'Producto removido'
  } else {
    ultimaAccion.value = 'Cantidad actualizada'
  }
}

const limpiarCarrito = () => {
  carrito.value = []
  descuentoPct.value = 0
  pagoRecibido.value = 0
  ultimaAccion.value = 'Carrito limpio'
}

const cobrarRapido = () => {
  pagoRecibido.value = resumenCarrito.value.total
  ultimaAccion.value = 'Pago igual al total'
}

const cerrarVenta = () => {
  if (carrito.value.length === 0) {
    ultimaAccion.value = 'Agrega productos antes de cobrar'
    return
  }
  limpiarCarrito()
  notaRapida.value = 'Venta mostrador'
  ultimaAccion.value = 'Venta registrada'
}
</script>

<template>
  <main class="pos">
    <header class="cabecera">
      <div>
        <p class="cabecera__prefijo">Punto de venta</p>
        <h1>Sesión activa</h1>
        <p class="cabecera__nota">{{ notaRapida }}</p>
      </div>
      <div class="cabecera__chips">
        <span class="chip">Caja 01</span>
        <span class="chip chip--exito">Listo para cobrar</span>
      </div>
    </header>

    <section class="layout">
      <section class="panel productos">
        <div class="panel__encabezado">
          <div class="buscador">
            <input v-model="consulta" type="search" placeholder="Buscar por nombre o categoría..." />
          </div>
          <div class="categorias">
            <button
              v-for="categoria in categorias"
              :key="categoria"
              type="button"
              :class="['categoria', { activa: categoriaActiva === categoria }]"
              @click="categoriaActiva = categoria"
            >
              {{ categoria }}
            </button>
          </div>
        </div>

        <div class="grid">
          <article
            v-for="producto in filtrados"
            :key="producto.id"
            class="card"
            @click="agregarAlCarrito(producto)"
          >
            <div class="card__titulo">
              <h3>{{ producto.nombre }}</h3>
              <span class="precio">{{ formatCurrency(producto.precio) }}</span>
            </div>
            <p class="meta">
              {{ producto.categoria }} · Stock: {{ producto.stock }}
              <span v-if="producto.destacador" class="etiqueta">{{ producto.destacador }}</span>
            </p>
            <button class="accion" type="button">Agregar</button>
          </article>
        </div>
      </section>

      <section class="panel carrito">
        <header class="panel__encabezado panel__encabezado--carrito">
          <div>
            <p class="cabecera__prefijo">Pedido actual</p>
            <h2>Carrito</h2>
          </div>
          <div class="botonera">
            <button type="button" class="boton secundaria" @click="limpiarCarrito">Vaciar</button>
            <button type="button" class="boton" @click="cobrarRapido">Pago exacto</button>
          </div>
        </header>

        <ul class="lineas" aria-live="polite">
          <li v-for="item in carrito" :key="item.id" class="linea">
            <div class="linea__fila">
              <div>
                <p class="linea__titulo">{{ item.nombre }}</p>
                <p class="linea__precio">{{ formatCurrency(item.precio) }}</p>
              </div>
              <div class="linea__acciones">
                <button type="button" @click.stop="actualizarCantidad(item.id, -1)">-</button>
                <span>{{ item.cantidad }}</span>
                <button type="button" @click.stop="actualizarCantidad(item.id, 1)">+</button>
              </div>
              <div class="linea__totales">
                <strong>{{ formatCurrency(totalLinea(item)) }}</strong>
                <small v-if="item.descuentoPct">-{{ normalizarDescuento(item.descuentoPct) }}% aplicado</small>
              </div>
            </div>
            <div class="linea__descuento">
              <label>
                Desc. producto %
                <input v-model.number="item.descuentoPct" type="number" min="0" max="100" step="1" />
              </label>
            </div>
          </li>
          <li v-if="carrito.length === 0" class="linea lineavacia">Sin productos aun</li>
        </ul>

        <div class="controles">
          <label>
            Descuento global %
            <input v-model.number="descuentoPct" type="number" min="0" max="100" step="1" />
          </label>
          <label>
            Pago recibido
            <input v-model.number="pagoRecibido" type="number" min="0" step="100" />
          </label>
          <label>
            Nota rápida
            <input v-model="notaRapida" type="text" placeholder="Mesa 4, domicilio, etc." />
          </label>
        </div>

        <dl class="totales">
          <div>
            <dt>Subtotal</dt>
            <dd>{{ formatCurrency(resumenCarrito.subtotalBruto) }}</dd>
          </div>
          <div>
            <dt>Desc. productos</dt>
            <dd>-{{ formatCurrency(resumenCarrito.descuentoLineas) }}</dd>
          </div>
          <div>
            <dt>Desc. global</dt>
            <dd>-{{ formatCurrency(resumenCarrito.descuentoGlobal) }}</dd>
          </div>
          <div>
            <dt>Impuesto (7%)</dt>
            <dd>{{ formatCurrency(resumenCarrito.impuesto) }}</dd>
          </div>
          <div class="total">
            <dt>Total</dt>
            <dd>{{ formatCurrency(resumenCarrito.total) }}</dd>
          </div>
          <div class="cambio">
            <dt>Cambio</dt>
            <dd>{{ formatCurrency(resumenCarrito.cambio) }}</dd>
          </div>
        </dl>

        <div class="acciones-finales">
          <span class="estado">{{ ultimaAccion }}</span>
          <button type="button" class="boton primario" @click="cerrarVenta">Cobrar y cerrar</button>
        </div>
      </section>
    </section>
  </main>
</template>

<style scoped>
.pos {
  display: grid;
  gap: 1.5rem;
}

.cabecera {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.cabecera__prefijo {
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.8rem;
  color: #94a3b8;
}

.cabecera h1 {
  margin: 0;
  font-size: clamp(1.8rem, 2.2vw, 2.4rem);
}

.cabecera__nota {
  margin: 0.2rem 0 0;
  color: #cbd5e1;
}

.cabecera__chips {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.chip {
  background: rgba(120, 130, 140, 0.25);
  border: 1px solid rgba(148, 163, 184, 0.35);
  padding: 0.4rem 0.7rem;
  border-radius: 999px;
  color: #f8fafc;
  font-size: 0.9rem;
}

.chip--exito {
  background: rgba(250, 204, 21, 0.14);
  border-color: rgba(250, 204, 21, 0.35);
  color: #f8fafc;
}

.layout {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 1rem;
}

.panel {
  background: #0d0f14;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 1rem;
  padding: 1.25rem;
  box-shadow: 0 20px 55px rgba(0, 0, 0, 0.55);
  display: grid;
  gap: 1rem;
}

.panel__encabezado {
  display: grid;
  gap: 0.8rem;
}

.panel__encabezado--carrito {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.buscador input {
  width: 100%;
  padding: 0.7rem 0.9rem;
  border-radius: 0.9rem;
  border: 1px solid rgba(148, 163, 184, 0.3);
  background: rgba(2, 6, 23, 0.6);
  color: #e2e8f0;
}

.categorias {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.35rem;
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.02);
}

.categoria {
  border: 1px solid rgba(148, 163, 184, 0.28);
  background: rgba(255, 255, 255, 0.04);
  border-radius: 0.9rem;
  padding: 0.5rem 1rem;
  color: #e2e8f0;
  cursor: pointer;
  transition: transform 0.15s ease, border-color 0.15s ease, background 0.15s ease;
}

.categoria.activa {
  border-color: rgba(250, 204, 21, 0.8);
  background: linear-gradient(120deg, rgba(250, 204, 21, 0.18), rgba(250, 204, 21, 0.32));
  color: #0b0d12;
  box-shadow: 0 6px 18px rgba(250, 204, 21, 0.25);
  transform: translateY(-1px) scale(1.01);
}

.categoria:not(.activa):hover,
.categoria:not(.activa):focus-visible {
  outline: none;
  border-color: rgba(226, 232, 240, 0.45);
  background: rgba(255, 255, 255, 0.07);
}

.grid {
  display: grid;
  gap: 0.85rem;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
}

.card {
  background: linear-gradient(165deg, #0f1015, #0b0d12);
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 1rem;
  padding: 1rem;
  display: grid;
  gap: 0.35rem;
  cursor: pointer;
  transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
}

.card:hover {
  transform: translateY(-4px);
  border-color: rgba(226, 232, 240, 0.45);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.35);
}

.card__titulo {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
}

.card h3 {
  margin: 0;
  font-size: 1.05rem;
}

.precio {
  color: #facc15;
  font-weight: 700;
}

.meta {
  margin: 0;
  color: #d4d8df;
  font-size: 0.95rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.etiqueta {
  background: rgba(250, 204, 21, 0.12);
  border: 1px solid rgba(250, 204, 21, 0.3);
  padding: 0.15rem 0.45rem;
  border-radius: 999px;
  font-size: 0.8rem;
  color: #f8fafc;
}

.accion {
  justify-self: start;
  border: none;
  border-radius: 0.65rem;
  padding: 0.45rem 0.9rem;
  color: #0b0d12;
  background: linear-gradient(130deg, #facc15, #fde68a);
  cursor: pointer;
  font-weight: 700;
}

.carrito .lineas {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 0.7rem;
}

.linea {
  display: grid;
  gap: 0.6rem;
  padding: 0.75rem 0.9rem;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 0.85rem;
  background: #0f1015;
}

.linea__fila {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 0.75rem;
  align-items: center;
}

.lineavacia {
  text-align: center;
  color: #94a3b8;
  border-style: dashed;
}

.linea__titulo {
  margin: 0 0 0.25rem;
  font-weight: 700;
}

.linea__precio {
  margin: 0;
  color: #d4d8df;
}

.linea__acciones {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.linea__acciones button {
  border: 1px solid rgba(148, 163, 184, 0.4);
  background: rgba(120, 126, 137, 0.12);
  color: #e2e8f0;
  width: 2rem;
  height: 2rem;
  border-radius: 0.5rem;
  cursor: pointer;
}

.linea__totales {
  display: grid;
  gap: 0.2rem;
  justify-items: end;
  text-align: right;
}

.linea__totales small {
  color: #d4d8df;
}

.linea__descuento {
  display: flex;
  justify-content: flex-end;
}

.linea__descuento label {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  color: #e2e8f0;
  font-weight: 600;
}

.linea__descuento input {
  width: 90px;
  border-radius: 0.6rem;
  border: 1px solid rgba(148, 163, 184, 0.3);
  padding: 0.35rem 0.5rem;
  background: rgba(12, 13, 16, 0.92);
  color: #e2e8f0;
}

.controles {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.7rem;
}

.controles label {
  display: grid;
  gap: 0.25rem;
  color: #e2e8f0;
  font-weight: 600;
}

.controles input {
  border-radius: 0.75rem;
  border: 1px solid rgba(148, 163, 184, 0.3);
  padding: 0.55rem 0.75rem;
  background: rgba(12, 13, 16, 0.92);
  color: #e2e8f0;
}

.totales {
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.5rem;
}

.totales div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.4rem 0.25rem;
  border-bottom: 1px dashed rgba(148, 163, 184, 0.25);
}

.totales dt,
.totales dd {
  margin: 0;
}

.totales .total {
  font-size: 1.2rem;
  font-weight: 700;
  color: #facc15;
}

.totales .cambio {
  color: #fef3c7;
}

.acciones-finales {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.estado {
  color: #e2e8f0;
  font-weight: 600;
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

.boton.primario {
  min-width: 150px;
  text-align: center;
}

.botonera {
  display: flex;
  gap: 0.5rem;
}

@media (max-width: 960px) {
  .layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .cabecera {
    flex-direction: column;
  }

  .panel__encabezado--carrito {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.6rem;
  }

  .acciones-finales {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
