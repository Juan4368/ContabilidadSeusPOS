<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import jsPDF from 'jspdf'

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

const productos = ref<Producto[]>([
  { id: 1, nombre: 'Café americano', precio: 2.5, stock: 18, categoria: 'Bebidas', destacador: 'Caliente' },
  { id: 2, nombre: 'Latte vainilla', precio: 3.9, stock: 12, categoria: 'Bebidas', destacador: 'Nuevo' },
  { id: 3, nombre: 'Sandwich pollo', precio: 5.5, stock: 9, categoria: 'Snacks' },
  { id: 4, nombre: 'Wrap veggie', precio: 4.8, stock: 6, categoria: 'Snacks', destacador: 'Vegano' },
  { id: 5, nombre: 'Brownie choco', precio: 2.8, stock: 15, categoria: 'Postres' },
  { id: 6, nombre: 'Cheesecake', precio: 3.6, stock: 7, categoria: 'Postres' },
  { id: 7, nombre: 'Agua mineral', precio: 1.5, stock: 24, categoria: 'Bebidas' },
  { id: 8, nombre: 'Combo desayuno', precio: 7.5, stock: 5, categoria: 'Combos', destacador: '-10%' }
])

const categorias = computed(() => ['Todo', ...new Set(productos.value.map((p) => p.categoria))])

const consulta = ref('')
const categoriaActiva = ref('Todo')
const carrito = ref<ItemCarrito[]>([])
const descuentoPct = ref(0)
const pagoRecibido = ref(0)
const notaRapida = ref('Venta mostrador')
const ultimaAccion = ref('Listo para vender')

const filtrados = computed(() => {
  const termino = consulta.value.toLowerCase().trim()
  return productos.value.filter((producto) => {
    const coincideTexto =
      termino === '' ||
      producto.nombre.toLowerCase().includes(termino) ||
      producto.categoria.toLowerCase().includes(termino)
    const coincideCategoria = categoriaActiva.value === 'Todo' || producto.categoria === categoriaActiva.value
    return coincideTexto && coincideCategoria
  })
})

const sugerencias = computed(() => {
  const termino = consulta.value.toLowerCase().trim()
  if (termino.length < 1) return []
  return filtrados.value
})

const cargarProductos = async () => {
  try {
    const respuesta = await fetch('http://127.0.0.1:8000/productos/')
    if (!respuesta.ok) {
      throw new Error(`Error ${respuesta.status}`)
    }
    const data = await respuesta.json()
    const lista = Array.isArray(data) ? data : Array.isArray(data.results) ? data.results : Array.isArray(data.data) ? data.data : []
    const normalizados = lista
      .map((item, index) => {
        if (!item || typeof item !== 'object') return null
        const producto = item as Record<string, unknown>
        const id = Number(producto.producto_id ?? producto.id ?? producto.pk ?? index + 1)
        const nombre = String(producto.nombre ?? producto.name ?? 'Producto')
        const precio = Number(producto.precio_venta ?? producto.precio ?? producto.price ?? 0)
        const stock = Number(producto.stock ?? producto.existencias ?? 0)
        const categoria = String(producto.categoria_nombre ?? producto.categoria ?? producto.category ?? 'Sin categoria')
        const destacadorRaw = producto.destacador ?? producto.badge ?? producto.etiqueta
        const destacador = destacadorRaw ? String(destacadorRaw) : undefined
        return { id, nombre, precio, stock, categoria, destacador }
      })
      .filter(Boolean) as Producto[]
    if (normalizados.length) {
      productos.value = normalizados
    }
  } catch (error) {
    console.error('No se pudieron cargar productos', error)
  }
}

onMounted(() => {
  void cargarProductos()
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

const eliminarItem = (id: number) => {
  carrito.value = carrito.value.filter((articulo) => articulo.id !== id)
  ultimaAccion.value = 'Producto removido'
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

const imprimirTicket = () => {
  window.print()
}

const guardarTicket = () => {
  const fecha = new Date()
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const margin = 40
  const lineHeight = 16
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const right = pageWidth - margin
  const nombreWidth = pageWidth - margin * 2 - 90
  let y = margin

  doc.setFont('courier', 'normal')
  doc.setFontSize(14)
  doc.text('Ticket', margin, y)
  y += lineHeight
  doc.setFontSize(10)
  doc.text(`Fecha: ${fecha.toLocaleString('es-CO')}`, margin, y)
  y += lineHeight
  doc.text(`Nota: ${notaRapida.value}`, margin, y)
  y += lineHeight
  doc.line(margin, y, right, y)
  y += lineHeight

  if (carrito.value.length === 0) {
    doc.text('Sin productos', margin, y)
    y += lineHeight
  } else {
    carrito.value.forEach((item) => {
      const nombreLineas = doc.splitTextToSize(item.nombre, nombreWidth)
      if (y + lineHeight > pageHeight - margin) {
        doc.addPage()
        y = margin
      }
      doc.text(nombreLineas[0], margin, y)
      doc.text(`x${item.cantidad}`, right - 70, y, { align: 'right' })
      doc.text(formatCurrency(totalLinea(item)), right, y, { align: 'right' })
      for (let i = 1; i < nombreLineas.length; i += 1) {
        y += lineHeight
        if (y + lineHeight > pageHeight - margin) {
          doc.addPage()
          y = margin
        }
        doc.text(nombreLineas[i], margin, y)
      }
      y += lineHeight
    })
  }

  if (y + lineHeight * 5 > pageHeight - margin) {
    doc.addPage()
    y = margin
  }
  doc.line(margin, y, right, y)
  y += lineHeight
  doc.text('Subtotal', margin, y)
  doc.text(formatCurrency(resumenCarrito.value.subtotalBruto), right, y, { align: 'right' })
  y += lineHeight
  doc.text('Desc. productos', margin, y)
  doc.text(`-${formatCurrency(resumenCarrito.value.descuentoLineas)}`, right, y, { align: 'right' })
  y += lineHeight
  doc.text('Desc. global', margin, y)
  doc.text(`-${formatCurrency(resumenCarrito.value.descuentoGlobal)}`, right, y, { align: 'right' })
  y += lineHeight
  doc.text('Impuesto', margin, y)
  doc.text(formatCurrency(resumenCarrito.value.impuesto), right, y, { align: 'right' })
  y += lineHeight
  doc.setFontSize(12)
  doc.text('Total', margin, y)
  doc.text(formatCurrency(resumenCarrito.value.total), right, y, { align: 'right' })

  const sello = fecha.toISOString().slice(0, 19).replace(/[:T]/g, '-')
  doc.save(`ticket-${sello}.pdf`)
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
      <section class="panel ticket-panel" aria-label="Ticket previo">
        <section class="ticket">
          <header class="ticket__header">
            <h3>Ticket</h3>
            <div class="ticket__acciones">
              <span>Vista previa</span>
              <button type="button" class="ticket__boton" @click="imprimirTicket">Imprimir</button>
              <button type="button" class="ticket__boton ticket__boton--secundario" @click="guardarTicket">
                Guardar PDF
              </button>
            </div>
          </header>
          <ul class="ticket__lineas">
            <li v-for="item in carrito" :key="item.id" class="ticket__linea">
              <span class="ticket__nombre">{{ item.nombre }}</span>
              <span class="ticket__cantidad">x{{ item.cantidad }}</span>
              <span class="ticket__importe">{{ formatCurrency(totalLinea(item)) }}</span>
            </li>
            <li v-if="carrito.length === 0" class="ticket__vacio">Sin productos aun</li>
          </ul>
          <div class="ticket__totales">
            <div>
              <span>Subtotal</span>
              <strong>{{ formatCurrency(resumenCarrito.subtotalBruto) }}</strong>
            </div>
            <div>
              <span>Impuesto</span>
              <strong>{{ formatCurrency(resumenCarrito.impuesto) }}</strong>
            </div>
            <div class="ticket__total">
              <span>Total</span>
              <strong>{{ formatCurrency(resumenCarrito.total) }}</strong>
            </div>
          </div>
        </section>
      </section>

      <section class="panel productos">
        <div class="panel__encabezado">
          <div class="buscador">
            <input v-model="consulta" type="search" placeholder="Buscar por nombre o categoría..." />
            <ul v-if="sugerencias.length" class="sugerencias" role="listbox">
              <li v-for="producto in sugerencias" :key="producto.id">
                <button type="button" class="sugerencia" @click="agregarAlCarrito(producto)">
                  <span class="sugerencia__nombre">{{ producto.nombre }}</span>
                  <span class="sugerencia__precio">{{ formatCurrency(producto.precio) }}</span>
                </button>
              </li>
            </ul>
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
                <button type="button" class="linea__eliminar" @click.stop="eliminarItem(item.id)">×</button>
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
      </section>

      <section class="panel detalle">
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
  grid-template-columns: 1.05fr 1.6fr 1fr;
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

.productos {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-height: 70vh;
}

.ticket-panel {
  max-height: 70vh;
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

.sugerencias {
  margin: 0.4rem 0 0;
  padding: 0.4rem;
  list-style: none;
  border-radius: 0.9rem;
  border: 1px solid rgba(148, 163, 184, 0.25);
  background: rgba(10, 12, 18, 0.96);
  display: grid;
  gap: 0.35rem;
  max-height: 320px;
  overflow-y: auto;
}

.sugerencia {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.5rem 0.7rem;
  border-radius: 0.7rem;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(255, 255, 255, 0.03);
  color: #e2e8f0;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
}

.sugerencia:hover,
.sugerencia:focus-visible {
  outline: none;
  background: rgba(250, 204, 21, 0.12);
  border-color: rgba(250, 204, 21, 0.4);
  transform: translateY(-1px);
}

.sugerencia__precio {
  color: #facc15;
  font-weight: 700;
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

.carrito .lineas {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 0.7rem;
  overflow-y: auto;
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

.linea__acciones .linea__eliminar {
  border-color: transparent;
  background: transparent;
  color: #ef4444 !important;
  font-size: 1.1rem;
  font-weight: 800;
  text-shadow: 0 0 8px rgba(239, 68, 68, 0.6);
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

.ticket {
  border: 1px dashed rgba(148, 163, 184, 0.35);
  border-radius: 0.85rem;
  padding: 0.9rem;
  background: rgba(12, 13, 16, 0.9);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  font-family: 'Courier New', Courier, monospace;
  height: 100%;
  overflow: hidden;
}

.ticket__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  border-bottom: 1px dashed rgba(148, 163, 184, 0.3);
  padding-bottom: 0.4rem;
}

.ticket__header h3 {
  margin: 0;
  font-size: 1rem;
}

.ticket__acciones {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.ticket__acciones span {
  color: #94a3b8;
  font-size: 0.8rem;
}

.ticket__boton {
  border: 1px solid rgba(148, 163, 184, 0.3);
  background: rgba(15, 18, 26, 0.9);
  color: #e2e8f0;
  border-radius: 0.6rem;
  padding: 0.25rem 0.6rem;
  cursor: pointer;
  font-size: 0.8rem;
}

.ticket__boton--secundario {
  border-color: rgba(250, 204, 21, 0.55);
  background: rgba(250, 204, 21, 0.14);
  color: #f8fafc;
}

.ticket__lineas {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.45rem;
  overflow-y: auto;
  flex: 1 1 auto;
}

.ticket__linea {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 0.5rem;
  align-items: center;
}

.ticket__nombre {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ticket__cantidad {
  color: #cbd5e1;
}

.ticket__importe {
  color: #facc15;
}

.ticket__vacio {
  text-align: center;
  color: #94a3b8;
}

.ticket__totales {
  display: grid;
  gap: 0.35rem;
  border-top: 1px dashed rgba(148, 163, 184, 0.3);
  padding-top: 0.5rem;
}

.ticket__totales div {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.ticket__total strong {
  color: #facc15;
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

@media (max-width: 1100px) {
  .layout {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 640px) {
  .layout {
    grid-template-columns: 1fr;
  }

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
