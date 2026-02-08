<script setup lang="ts">
type VistaItem = {
  id: string
  nombre: string
  descripcion: string
}

type Caja = {
  id: number
  nombre?: string
  saldo_inicial?: number
  estado?: string
  usuario_id?: number | null
  fecha_apertura?: string | null
  fecha_cierre?: string | null
  created_at?: string | null
}

const props = defineProps<{
  vistas: VistaItem[]
  vistaActiva: string
  posBloqueado: boolean
  cajas: Caja[]
  cargandoCajas: boolean
  errorCajas: string | null
  sesionCajaId: number | null
  cajaAbiertaEnSesion: boolean
  actualizandoCaja: boolean
}>()

const emit = defineEmits<{
  (event: 'seleccionar', vistaId: string): void
  (event: 'seleccionar-caja', caja: Caja): void
}>()

const seleccionarVista = (vistaId: string) => {
  emit('seleccionar', vistaId)
}

</script>

<template>
  <section class="menu">
    <div class="menu__grid">
      <button
        v-for="vista in props.vistas"
        :key="vista.id"
        type="button"
        :class="['menu__card', { activa: vista.id === props.vistaActiva }]"
        :disabled="vista.id === 'pos' && props.posBloqueado"
        @click="seleccionarVista(vista.id)"
      >
        <span class="menu__card-titulo">{{ vista.nombre }}</span>
        <span class="menu__card-desc">{{ vista.descripcion }}</span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.menu {
  padding: 1.2rem 1.4rem;
  border-radius: 1rem;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(12, 14, 18, 0.7);
  display: grid;
  gap: 0.75rem;
}

.menu__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.75rem;
}

.menu__acciones {
  display: flex;
  justify-content: flex-start;
}

.menu__toggle {
  border: 1px solid rgba(148, 163, 184, 0.3);
  background: rgba(255, 255, 255, 0.06);
  color: #e2e8f0;
  border-radius: 0.75rem;
  padding: 0.5rem 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease, transform 0.15s ease;
}

.menu__toggle:hover,
.menu__toggle:focus-visible {
  outline: none;
  transform: translateY(-1px);
  border-color: rgba(250, 204, 21, 0.55);
}

.menu__card {
  display: grid;
  gap: 0.35rem;
  padding: 0.9rem 1rem;
  border-radius: 0.85rem;
  border: 1px solid rgba(148, 163, 184, 0.25);
  background: linear-gradient(130deg, rgba(148, 163, 184, 0.12), rgba(15, 23, 42, 0.6));
  color: #e2e8f0;
  text-align: left;
  cursor: pointer;
  transition: transform 0.15s ease, border-color 0.15s ease, background 0.15s ease;
}

.menu__card:hover,
.menu__card:focus-visible {
  outline: none;
  transform: translateY(-2px);
  border-color: rgba(250, 204, 21, 0.55);
}

.menu__card:disabled {
  cursor: not-allowed;
  opacity: 0.55;
  transform: none;
}

.menu__card.activa {
  border-color: rgba(250, 204, 21, 0.7);
  background: linear-gradient(130deg, rgba(250, 204, 21, 0.16), rgba(15, 23, 42, 0.7));
}

.menu__card-titulo {
  font-weight: 700;
}

.menu__card-desc {
  color: #cbd5e1;
  font-size: 0.9rem;
}
</style>
