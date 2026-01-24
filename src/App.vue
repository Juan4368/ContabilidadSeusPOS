<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import POSView from './views/POSView.vue'
import StockView from './views/StockView.vue'
import AdminView from './views/AdminView.vue'
import ProductosView from './views/ProductosView.vue'
import PendientesView from './views/PendientesView.vue'
import VentasPendientesView from './views/VentasPendientesView.vue'
import ContabilidadView from './views/ContabilidadView.vue'

type VistaId = 'pos' | 'contabilidad' | 'stock' | 'admin' | 'productos' | 'pendientes' | 'ventas-pendientes'

const vistaActiva = ref<VistaId>('pos')

const vistas: Array<{ id: VistaId; nombre: string; descripcion: string; componente: typeof POSView }> = [
  { id: 'pos', nombre: 'POS', descripcion: 'Cobro en mostrador', componente: POSView },
  { id: 'contabilidad', nombre: 'Contabilidad', descripcion: 'Ingresos, egresos y cartera', componente: ContabilidadView },
  { id: 'stock', nombre: 'Stock', descripcion: 'Inventario y reposicion', componente: StockView },
  { id: 'admin', nombre: 'Admin', descripcion: 'Usuarios y categorias', componente: AdminView },
  { id: 'productos', nombre: 'Productos', descripcion: 'Catalogo y precios', componente: ProductosView },
  { id: 'pendientes', nombre: 'Pendientes', descripcion: 'Registros offline', componente: PendientesView },
  { id: 'ventas-pendientes', nombre: 'Ventas pendientes', descripcion: 'Recuperar ventas', componente: VentasPendientesView }
]

const componenteActual = computed(() => vistas.find((vista) => vista.id === vistaActiva.value)?.componente ?? POSView)

const cambiarVista = (event: Event) => {
  const detalle = (event as CustomEvent<{ vista: VistaId }>).detail
  if (detalle?.vista) {
    vistaActiva.value = detalle.vista
  }
}

onMounted(() => {
  window.addEventListener('app:cambiar-vista', cambiarVista as EventListener)
})

onBeforeUnmount(() => {
  window.removeEventListener('app:cambiar-vista', cambiarVista as EventListener)
})
</script>

<template>
  <main class="shell">
    <header class="selector">
      <p class="selector__titulo">Vistas disponibles</p>
      <div class="selector__botones">
        <button
          v-for="vista in vistas"
          :key="vista.id"
          type="button"
          :class="['selector__boton', { activa: vista.id === vistaActiva }]"
          @click="vistaActiva = vista.id"
        >
          <span class="selector__nombre">{{ vista.nombre }}</span>
          <small class="selector__descripcion">{{ vista.descripcion }}</small>
        </button>
      </div>
    </header>

    <component :is="componenteActual" />
  </main>
</template>

<style scoped>
.shell {
  display: grid;
  gap: 1rem;
}

.selector {
  display: grid;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-radius: 0.9rem;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(10, 11, 14, 0.8);
}

.selector__titulo {
  margin: 0;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: #e2e8f0;
}

.selector__botones {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.selector__boton {
  background: rgba(120, 126, 137, 0.14);
  border: 1px solid rgba(148, 163, 184, 0.28);
  color: #e2e8f0;
  border-radius: 0.75rem;
  padding: 0.6rem 0.85rem;
  min-width: 160px;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s ease, background 0.15s ease, transform 0.15s ease;
}

.selector__boton:hover,
.selector__boton:focus-visible {
  outline: none;
  transform: translateY(-1px);
  border-color: rgba(250, 204, 21, 0.55);
}

.selector__boton.activa {
  background: linear-gradient(130deg, rgba(250, 204, 21, 0.16), rgba(255, 255, 255, 0.06));
  border-color: rgba(250, 204, 21, 0.7);
}

.selector__nombre {
  display: block;
  font-weight: 700;
}

.selector__descripcion {
  display: block;
  color: #cbd5e1;
}

@media (max-width: 768px) {
}
</style>
