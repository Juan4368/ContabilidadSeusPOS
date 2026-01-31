<script setup lang="ts">
import SessionRoleChip from '../components/SessionRoleChip.vue'
import { computed, reactive, ref } from 'vue'

type StockItem = {
  id: number
  nombre: string
  sku: string
  categoria: string
  ubicacion: string
  proveedor: string
  stock: number
  minimo: number
  reservado: number
  costo: number
  actualizado: string
}

const inventario = reactive<StockItem[]>([
  {
    id: 1,
    nombre: 'Cafe americano',
    sku: 'CAF-001',
    categoria: 'Bebidas',
    ubicacion: 'Almacen A',
    proveedor: 'Tostadores Norte',
    stock: 36,
    minimo: 12,
    reservado: 6,
    costo: 1200,
    actualizado: '2026-01-13 10:20'
  },
  {
    id: 2,
    nombre: 'Latte vainilla',
    sku: 'CAF-014',
    categoria: 'Bebidas',
    ubicacion: 'Almacen A',
    proveedor: 'Tostadores Norte',
    stock: 8,
    minimo: 10,
    reservado: 2,
    costo: 2100,
    actualizado: '2026-01-13 09:45'
  },
  {
    id: 3,
    nombre: 'Sandwich pollo',
    sku: 'SNK-022',
    categoria: 'Snacks',
    ubicacion: 'Camara fria',
    proveedor: 'Frescos Andinos',
    stock: 4,
    minimo: 8,
    reservado: 1,
    costo: 3800,
    actualizado: '2026-01-13 09:10'
  },
  {
    id: 4,
    nombre: 'Wrap veggie',
    sku: 'SNK-026',
    categoria: 'Snacks',
    ubicacion: 'Camara fria',
    proveedor: 'Frescos Andinos',
    stock: 0,
    minimo: 6,
    reservado: 0,
    costo: 3400,
    actualizado: '2026-01-12 19:20'
  },
  {
    id: 5,
    nombre: 'Brownie choco',
    sku: 'PST-010',
    categoria: 'Postres',
    ubicacion: 'Vitrina',
    proveedor: 'Horno Central',
    stock: 18,
    minimo: 6,
    reservado: 3,
    costo: 1500,
    actualizado: '2026-01-13 08:30'
  },
  {
    id: 6,
    nombre: 'Agua mineral',
    sku: 'BEB-002',
    categoria: 'Bebidas',
    ubicacion: 'Almacen B',
    proveedor: 'Distribuidora Azul',
    stock: 52,
    minimo: 18,
    reservado: 0,
    costo: 700,
    actualizado: '2026-01-13 08:05'
  }
])

const categorias = computed(() => ['Todas', ...new Set(inventario.map((item) => item.categoria))])

const filtroTexto = ref('')
const filtroCategoria = ref('Todas')
const soloBajoStock = ref(false)

const inventarioFiltrado = computed(() => {
  const termino = filtroTexto.value.trim().toLowerCase()
  return inventario.filter((item) => {
    const matchTexto =
      termino === '' ||
      item.nombre.toLowerCase().includes(termino) ||
      item.sku.toLowerCase().includes(termino) ||
      item.proveedor.toLowerCase().includes(termino)
    const matchCategoria = filtroCategoria.value === 'Todas' || item.categoria === filtroCategoria.value
    const matchBajo = !soloBajoStock.value || item.stock <= item.minimo
    return matchTexto && matchCategoria && matchBajo
  })
})

const resumen = computed(() => {
  const totalItems = inventario.length
  const bajoStock = inventario.filter((item) => item.stock <= item.minimo && item.stock > 0).length
  const sinStock = inventario.filter((item) => item.stock === 0).length
  const unidades = inventario.reduce((acc, item) => acc + item.stock, 0)
  return { totalItems, bajoStock, sinStock, unidades }
})

const formatCurrency = (monto: number) =>
  monto.toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0
  })

const formatearFecha = (valor: string) => valor

const ajustarStock = (item: StockItem, delta: number) => {
  const nuevo = Math.max(item.stock + delta, 0)
  item.stock = nuevo
  item.actualizado = new Date().toISOString().slice(0, 16).replace('T', ' ')
}

const setStock = (item: StockItem, valor: number) => {
  item.stock = Math.max(valor, 0)
  item.actualizado = new Date().toISOString().slice(0, 16).replace('T', ' ')
}
</script>

<template>
  <main class="stock">
    <header class="stock__cabecera">
      <div>
        <p class="stock__prefijo">Inventario</p>
        <h1>Control de stock</h1>
        <p class="stock__nota">Ajusta cantidades, revisa alertas y prepara pedidos de reposicion.</p>
      </div>
      <div class="stock__acciones">
        <SessionRoleChip />
        <button type="button" class="boton secundario">Exportar</button>
        <button type="button" class="boton">Nuevo producto</button>
      </div>
    </header>

    <section class="resumen">
      <article class="tarjeta">
        <p class="tarjeta__titulo">Productos activos</p>
        <strong>{{ resumen.totalItems }}</strong>
        <span>Total en catalogo</span>
      </article>
      <article class="tarjeta tarjeta--alerta">
        <p class="tarjeta__titulo">Bajo stock</p>
        <strong>{{ resumen.bajoStock }}</strong>
        <span>Revisar reposicion</span>
      </article>
      <article class="tarjeta tarjeta--critico">
        <p class="tarjeta__titulo">Sin stock</p>
        <strong>{{ resumen.sinStock }}</strong>
        <span>Atencion inmediata</span>
      </article>
      <article class="tarjeta">
        <p class="tarjeta__titulo">Unidades totales</p>
        <strong>{{ resumen.unidades }}</strong>
        <span>En inventario</span>
      </article>
    </section>

    <section class="panel filtros">
      <label class="campo">
        <span>Buscar</span>
        <input v-model="filtroTexto" type="search" placeholder="Nombre, SKU o proveedor" />
      </label>
      <label class="campo">
        <span>Categoria</span>
        <select v-model="filtroCategoria">
          <option v-for="categoria in categorias" :key="categoria" :value="categoria">{{ categoria }}</option>
        </select>
      </label>
      <label class="campo campo--switch">
        <input v-model="soloBajoStock" type="checkbox" />
        <span>Solo bajo stock</span>
      </label>
    </section>

    <section class="panel tabla">
      <header class="tabla__cabecera">
        <h2>Listado de productos</h2>
        <span>{{ inventarioFiltrado.length }} resultados</span>
      </header>

      <div class="tabla__grid">
        <div class="tabla__fila tabla__encabezado">
          <span>Producto</span>
          <span>Categoria</span>
          <span>Stock</span>
          <span>Minimo</span>
          <span>Reservado</span>
          <span>Costo</span>
          <span>Ubicacion</span>
          <span>Acciones</span>
        </div>

        <div v-for="item in inventarioFiltrado" :key="item.id" class="tabla__fila">
          <div class="producto">
            <div>
              <p class="producto__nombre">{{ item.nombre }}</p>
              <small>{{ item.sku }} · {{ item.proveedor }}</small>
            </div>
            <span
              :class="[
                'estado',
                { 'estado--critico': item.stock === 0, 'estado--alerta': item.stock > 0 && item.stock <= item.minimo }
              ]"
            >
              {{ item.stock === 0 ? 'Sin stock' : item.stock <= item.minimo ? 'Bajo' : 'OK' }}
            </span>
          </div>
          <span>{{ item.categoria }}</span>
          <span class="stock__valor">{{ item.stock }}</span>
          <span>{{ item.minimo }}</span>
          <span>{{ item.reservado }}</span>
          <span>{{ formatCurrency(item.costo) }}</span>
          <span>{{ item.ubicacion }}</span>
          <div class="acciones">
            <button type="button" @click="ajustarStock(item, -1)">-1</button>
            <button type="button" @click="ajustarStock(item, 1)">+1</button>
            <label class="acciones__input">
              <span class="sr-only">Nuevo stock</span>
              <input
                :value="item.stock"
                type="number"
                min="0"
                @change="setStock(item, Number(($event.target as HTMLInputElement).value))"
              />
            </label>
          </div>
        </div>
      </div>

      <footer class="tabla__pie">
        <p>Ultima actualizacion: {{ formatearFecha(inventario[0]?.actualizado ?? '-') }}</p>
      </footer>
    </section>
  </main>
</template>

<style scoped>
.stock {
  display: grid;
  gap: 1.5rem;
}

.stock__cabecera {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.stock__prefijo {
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.8rem;
  color: #94a3b8;
}

.stock__nota {
  margin: 0.25rem 0 0;
  color: #cbd5e1;
}

.stock__acciones {
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

.boton.secundario {
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

.campo--switch {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 1.5rem;
}

.tabla__cabecera {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.tabla__grid {
  display: grid;
  gap: 0.65rem;
}

.tabla__fila {
  display: grid;
  grid-template-columns: 2fr 1fr 0.6fr 0.6fr 0.6fr 0.8fr 1fr 1fr;
  gap: 0.75rem;
  align-items: center;
  padding: 0.75rem 0.9rem;
  border-radius: 0.8rem;
  background: #0f1015;
  border: 1px solid rgba(148, 163, 184, 0.22);
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

.producto {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  align-items: center;
}

.producto__nombre {
  margin: 0;
  font-weight: 700;
}

.producto small {
  color: #cbd5e1;
}

.estado {
  font-size: 0.75rem;
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
  background: rgba(34, 197, 94, 0.15);
  border: 1px solid rgba(34, 197, 94, 0.4);
  color: #bbf7d0;
}

.estado--alerta {
  background: rgba(250, 204, 21, 0.15);
  border-color: rgba(250, 204, 21, 0.5);
  color: #fde68a;
}

.estado--critico {
  background: rgba(248, 113, 113, 0.15);
  border-color: rgba(248, 113, 113, 0.5);
  color: #fecaca;
}

.acciones {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.acciones button {
  border: 1px solid rgba(148, 163, 184, 0.4);
  background: rgba(120, 126, 137, 0.12);
  color: #e2e8f0;
  width: 2.2rem;
  height: 2.2rem;
  border-radius: 0.5rem;
  cursor: pointer;
}

.acciones__input input {
  width: 4.2rem;
  text-align: center;
  border-radius: 0.6rem;
  border: 1px solid rgba(148, 163, 184, 0.3);
  padding: 0.35rem 0.4rem;
  background: rgba(12, 13, 16, 0.92);
  color: #e2e8f0;
}

.tabla__pie {
  display: flex;
  justify-content: flex-end;
  color: #94a3b8;
  font-size: 0.85rem;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

@media (max-width: 1100px) {
  .tabla__fila {
    grid-template-columns: 1.6fr 1fr 0.6fr 0.6fr 0.6fr 0.8fr 1fr;
  }

  .tabla__fila .acciones {
    grid-column: 1 / -1;
  }
}

@media (max-width: 720px) {
  .stock__cabecera {
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
