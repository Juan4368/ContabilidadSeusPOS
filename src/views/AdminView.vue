<script setup lang="ts">
import { computed, reactive, ref } from 'vue'

type Usuario = {
  id: number
  nombre: string
  email: string
  estado: 'activo' | 'inactivo'
}

type Categoria = {
  id: number
  nombre: string
  descripcion: string
}

const usuarios = reactive<Usuario[]>([
  { id: 1, nombre: 'Ana Perez', email: 'ana@empresa.com', estado: 'activo' },
  { id: 2, nombre: 'Luis Gomez', email: 'luis@empresa.com', estado: 'activo' }
])

const categorias = reactive<Categoria[]>([
  { id: 1, nombre: 'Bebidas', descripcion: 'Cafe, te, jugos' },
  { id: 2, nombre: 'Snacks', descripcion: 'Sandwiches y panaderia' }
])

const usuarioForm = reactive({ nombre: '', email: '' })
const categoriaForm = reactive({ nombre: '', descripcion: '' })

const errorUsuario = ref('')
const errorCategoria = ref('')

const usuariosActivos = computed(() => usuarios.filter((usuario) => usuario.estado === 'activo').length)

const limpiarUsuario = () => {
  usuarioForm.nombre = ''
  usuarioForm.email = ''
}

const limpiarCategoria = () => {
  categoriaForm.nombre = ''
  categoriaForm.descripcion = ''
}

const crearUsuario = () => {
  errorUsuario.value = ''
  const nombre = usuarioForm.nombre.trim()
  const email = usuarioForm.email.trim().toLowerCase()

  if (!nombre || !email) {
    errorUsuario.value = 'Completa nombre y email.'
    return
  }

  if (usuarios.some((usuario) => usuario.email === email)) {
    errorUsuario.value = 'El email ya existe.'
    return
  }

  usuarios.push({
    id: Date.now(),
    nombre,
    email,
    estado: 'activo'
  })

  limpiarUsuario()
}

const crearCategoria = () => {
  errorCategoria.value = ''
  const nombre = categoriaForm.nombre.trim()
  const descripcion = categoriaForm.descripcion.trim()

  if (!nombre) {
    errorCategoria.value = 'El nombre es obligatorio.'
    return
  }

  categorias.push({
    id: Date.now(),
    nombre,
    descripcion
  })

  limpiarCategoria()
}

const toggleEstado = (id: number) => {
  const usuario = usuarios.find((item) => item.id === id)
  if (!usuario) return
  usuario.estado = usuario.estado === 'activo' ? 'inactivo' : 'activo'
}

const eliminarCategoria = (id: number) => {
  const index = categorias.findIndex((item) => item.id === id)
  if (index >= 0) categorias.splice(index, 1)
}
</script>

<template>
  <main class="admin">
    <header class="admin__cabecera">
      <div>
        <p class="admin__prefijo">Administracion</p>
        <h1>Panel administrativo</h1>
        <p class="admin__nota">Crea usuarios y categorias. Roles se pueden sumar despues.</p>
      </div>
      <div class="admin__resumen">
        <span>Total usuarios: {{ usuarios.length }}</span>
        <span>Activos: {{ usuariosActivos }}</span>
        <span>Total categorias: {{ categorias.length }}</span>
      </div>
    </header>

    <section class="grid">
      <section class="panel">
        <header class="panel__cabecera">
          <h2>Usuarios</h2>
          <p>Alta y control basico de usuarios.</p>
        </header>

        <form class="form" @submit.prevent="crearUsuario">
          <label>
            <span>Nombre</span>
            <input v-model="usuarioForm.nombre" type="text" placeholder="Nombre completo" />
          </label>
          <label>
            <span>Email</span>
            <input v-model="usuarioForm.email" type="email" placeholder="correo@empresa.com" />
          </label>
          <button type="submit">Crear usuario</button>
          <p v-if="errorUsuario" class="error">{{ errorUsuario }}</p>
        </form>

        <ul class="lista">
          <li v-for="usuario in usuarios" :key="usuario.id">
            <div>
              <strong>{{ usuario.nombre }}</strong>
              <small>{{ usuario.email }}</small>
            </div>
            <div class="acciones">
              <span :class="['estado', usuario.estado]">{{ usuario.estado }}</span>
              <button type="button" class="secundario" @click="toggleEstado(usuario.id)">
                {{ usuario.estado === 'activo' ? 'Desactivar' : 'Activar' }}
              </button>
            </div>
          </li>
        </ul>
      </section>

      <section class="panel">
        <header class="panel__cabecera">
          <h2>Categorias</h2>
          <p>Organiza productos y registros financieros.</p>
        </header>

        <form class="form" @submit.prevent="crearCategoria">
          <label>
            <span>Nombre</span>
            <input v-model="categoriaForm.nombre" type="text" placeholder="Nombre categoria" />
          </label>
          <label>
            <span>Descripcion</span>
            <input v-model="categoriaForm.descripcion" type="text" placeholder="Opcional" />
          </label>
          <button type="submit">Crear categoria</button>
          <p v-if="errorCategoria" class="error">{{ errorCategoria }}</p>
        </form>

        <ul class="lista">
          <li v-for="categoria in categorias" :key="categoria.id">
            <div>
              <strong>{{ categoria.nombre }}</strong>
              <small>{{ categoria.descripcion || 'Sin descripcion' }}</small>
            </div>
            <div class="acciones">
              <button type="button" class="secundario" @click="eliminarCategoria(categoria.id)">Eliminar</button>
            </div>
          </li>
        </ul>
      </section>
    </section>
  </main>
</template>

<style scoped>
.admin {
  display: grid;
  gap: 1.5rem;
}

.admin__cabecera {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.admin__prefijo {
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.8rem;
  color: #94a3b8;
}

.admin__nota {
  margin: 0.25rem 0 0;
  color: #cbd5e1;
}

.admin__resumen {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  color: #e2e8f0;
}

.grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
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

.estado.inactivo {
  background: rgba(248, 113, 113, 0.15);
  border-color: rgba(248, 113, 113, 0.4);
  color: #fecaca;
}

.secundario {
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: rgba(120, 126, 137, 0.12);
  color: #e2e8f0;
  border-radius: 0.65rem;
  padding: 0.4rem 0.75rem;
  cursor: pointer;
}

@media (max-width: 720px) {
  .admin__cabecera {
    flex-direction: column;
  }
}
</style>
