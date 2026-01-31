<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

const rol = ref('Sin rol')

const cargarRol = () => {
  try {
    const raw = localStorage.getItem('pos_sesion')
    if (raw) {
      const data = JSON.parse(raw) as { roles?: string[] }
      if (Array.isArray(data.roles) && data.roles.length) {
        rol.value = data.roles.join(', ')
        return
      }
    }
  } catch {
    // Ignora errores de parseo
  }
  rol.value = 'Sin rol'
}

onMounted(() => {
  cargarRol()
  window.addEventListener('pos:sesion-actualizada', cargarRol)
  window.addEventListener('storage', cargarRol)
})

onBeforeUnmount(() => {
  window.removeEventListener('pos:sesion-actualizada', cargarRol)
  window.removeEventListener('storage', cargarRol)
})
</script>

<template>
  <span class="rol-chip">Rol: {{ rol }}</span>
</template>

<style scoped>
.rol-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.3rem 0.6rem;
  border-radius: 999px;
  border: 1px solid rgba(59, 130, 246, 0.4);
  background: rgba(59, 130, 246, 0.14);
  color: #dbeafe;
  font-weight: 600;
  font-size: 0.8rem;
}
</style>
