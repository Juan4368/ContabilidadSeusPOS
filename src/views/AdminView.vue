<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'

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
  estado: 'activo' | 'inactivo'
}

type CategoriaContabilidad = {
  id: number
  nombre: string
  codigo: string
}

type Cliente = {
  id: string
  nombre: string
  telefono: string
  email: string
  createdAt: string
}

const CLIENTES_ENDPOINT = 'http://127.0.0.1:8000/clientes/'

const USUARIOS_ENDPOINT = 'http://127.0.0.1:8000/usuarios/'
const CATEGORIAS_ENDPOINT = 'http://127.0.0.1:8000/categorias/'
const CATEGORIAS_CONTABILIDAD_ENDPOINT = 'http://127.0.0.1:8000/contabilidad/categorias/'

const usuarios = reactive<Usuario[]>([])

const categorias = reactive<Categoria[]>([
  { id: 1, nombre: 'Bebidas', descripcion: 'Cafe, te, jugos', estado: 'activo' },
  { id: 2, nombre: 'Snacks', descripcion: 'Sandwiches y panaderia', estado: 'activo' }
])
const categoriasContabilidad = reactive<CategoriaContabilidad[]>([])

const clientes = reactive<Cliente[]>([])

const usuarioForm = reactive({
  nombre: '',
  email: '',
  contrasena: '',
  numeroContacto: '',
  role: 'administrador',
  activo: true
})
const categoriaForm = reactive({ nombre: '', descripcion: '' })
const categoriaContabilidadForm = reactive({ nombre: '', codigo: '' })
const clienteForm = reactive({ nombre: '', telefono: '', email: '' })

const errorUsuario = ref('')
const errorCategoria = ref('')
const errorCategoriaContabilidad = ref('')
const errorCliente = ref('')
const avisoCache = ref('')
const avisoCategoria = ref('')

const usuariosActivos = computed(() => usuarios.filter((usuario) => usuario.estado === 'activo').length)
const totalClientes = computed(() => clientes.length)

const cargarUsuarios = async () => {
  try {
    const respuesta = await fetch(USUARIOS_ENDPOINT)
    if (!respuesta.ok) {
      throw new Error(`Error ${respuesta.status}`)
    }
    const data = await respuesta.json()
    const lista = Array.isArray(data) ? data : Array.isArray(data.results) ? data.results : Array.isArray(data.data) ? data.data : []
    const normalizados = lista
      .map((item, index) => {
        if (!item || typeof item !== 'object') return null
        const usuario = item as Record<string, unknown>
        const id = Number(usuario.user_id ?? usuario.id ?? index + 1)
        const nombre = String(usuario.nombre_completo ?? usuario.nombre ?? 'Usuario')
        const email = String(usuario.correo ?? usuario.email ?? '')
        const activoRaw = usuario.activo
        const estado = activoRaw === false ? 'inactivo' : 'activo'
        return { id, nombre, email, estado } as Usuario
      })
      .filter(Boolean) as Usuario[]
    usuarios.splice(0, usuarios.length, ...normalizados)
  } catch (error) {
    console.error('No se pudieron cargar usuarios', error)
  }
}

const limpiarUsuario = () => {
  usuarioForm.nombre = ''
  usuarioForm.email = ''
  usuarioForm.contrasena = ''
  usuarioForm.numeroContacto = ''
  usuarioForm.role = 'administrador'
  usuarioForm.activo = true
}

const limpiarCategoria = () => {
  categoriaForm.nombre = ''
  categoriaForm.descripcion = ''
}

const limpiarCategoriaContabilidad = () => {
  categoriaContabilidadForm.nombre = ''
  categoriaContabilidadForm.codigo = ''
}

const limpiarCliente = () => {
  clienteForm.nombre = ''
  clienteForm.telefono = ''
  clienteForm.email = ''
}

const cargarClientes = async () => {
  try {
    const respuesta = await fetch(CLIENTES_ENDPOINT)
    if (!respuesta.ok) {
      throw new Error(`Error ${respuesta.status}`)
    }
    const data = await respuesta.json()
    const lista = Array.isArray(data) ? data : Array.isArray(data.results) ? data.results : Array.isArray(data.data) ? data.data : []
    const normalizados = lista
      .map((item) => {
        if (!item || typeof item !== 'object') return null
        const cliente = item as Record<string, unknown>
        return {
          id: String(cliente.id ?? cliente.cliente_id ?? ''),
          nombre: String(cliente.nombre ?? ''),
          telefono: String(cliente.telefono ?? ''),
          email: String(cliente.email ?? ''),
          createdAt: String(cliente.created_at ?? cliente.createdAt ?? '')
        }
      })
      .filter(Boolean) as Cliente[]
    clientes.splice(0, clientes.length, ...normalizados)
  } catch (error) {
    console.error('No se pudieron cargar clientes', error)
  }
}

const crearUsuario = async () => {
  errorUsuario.value = ''
  const nombre = usuarioForm.nombre.trim()
  const email = usuarioForm.email.trim().toLowerCase()
  const contrasena = usuarioForm.contrasena.trim()
  const numeroContacto = usuarioForm.numeroContacto.trim()

  if (!nombre || !email || !contrasena || !numeroContacto) {
    errorUsuario.value = 'Completa nombre, email, contraseña y contacto.'
    return
  }

  try {
    const payload = {
      correo: email,
      contrasena_hash: contrasena,
      numero_contacto: numeroContacto,
      role: usuarioForm.role,
      activo: usuarioForm.activo,
      nombre_completo: nombre,
      creado_at: new Date().toISOString(),
      actualizado_at: new Date().toISOString()
    }

    const respuesta = await fetch(USUARIOS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    if (!respuesta.ok) {
      const detalle = await respuesta.text().catch(() => '')
      throw new Error(detalle || `Error ${respuesta.status}`)
    }
    const data = (await respuesta.json()) as Record<string, unknown>
    usuarios.unshift({
      id: Number(data.user_id ?? data.id ?? Date.now()),
      nombre: String(data.nombre_completo ?? nombre),
      email: String(data.correo ?? email),
      estado: data.activo === false ? 'inactivo' : 'activo'
    })
    limpiarUsuario()
  } catch (error) {
    console.error('Error al crear usuario', error)
    errorUsuario.value = 'No fue posible crear el usuario.'
  }
}

const crearCategoria = () => {
  errorCategoria.value = ''
  const nombre = categoriaForm.nombre.trim()
  const descripcion = categoriaForm.descripcion.trim()

  if (!nombre) {
    errorCategoria.value = 'El nombre es obligatorio.'
    return
  }

  const crear = async () => {
    try {
      const respuesta = await fetch(CATEGORIAS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, descripcion })
      })
      if (!respuesta.ok) {
        const detalle = await respuesta.text().catch(() => '')
        throw new Error(detalle || `Error ${respuesta.status}`)
      }
      const data = (await respuesta.json()) as Record<string, unknown>
      categorias.unshift({
        id: Number(data.categoria_id ?? data.id ?? Date.now()),
        nombre: String(data.nombre ?? nombre),
        descripcion: String(data.descripcion ?? descripcion),
        estado: data.estado === false || data.estado === 'inactivo' ? 'inactivo' : 'activo'
      })
      limpiarCategoria()
    } catch (error) {
      console.error('Error al crear categoria', error)
      errorCategoria.value = 'No fue posible crear la categoria.'
    }
  }

  void crear()
}

const crearCliente = async () => {
  errorCliente.value = ''
  const nombre = clienteForm.nombre.trim()
  const telefono = clienteForm.telefono.trim()
  const email = clienteForm.email.trim().toLowerCase()

  if (!nombre || !telefono || !email) {
    errorCliente.value = 'Completa nombre, telefono y email.'
    return
  }

  try {
    const respuesta = await fetch(CLIENTES_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, telefono, email })
    })
    if (!respuesta.ok) {
      const detalle = await respuesta.text().catch(() => '')
      throw new Error(detalle || `Error ${respuesta.status}`)
    }
    const data = (await respuesta.json()) as Record<string, unknown>
    const nuevo: Cliente = {
      id: String(data.id ?? data.cliente_id ?? Date.now()),
      nombre: String(data.nombre ?? nombre),
      telefono: String(data.telefono ?? telefono),
      email: String(data.email ?? email),
      createdAt: String(data.created_at ?? new Date().toISOString())
    }
    clientes.unshift(nuevo)
    limpiarCliente()
  } catch (error) {
    console.error('Error al crear cliente', error)
    errorCliente.value = 'No fue posible crear el cliente.'
  }
}

const toggleEstado = async (id: number) => {
  const usuario = usuarios.find((item) => item.id === id)
  if (!usuario) return
  const estadoAnterior = usuario.estado
  const nuevoEstado = usuario.estado === 'activo' ? 'inactivo' : 'activo'
  usuario.estado = nuevoEstado

  try {
    const respuesta = await fetch(`${USUARIOS_ENDPOINT}${id}/estado`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo: nuevoEstado === 'activo' })
    })
    if (!respuesta.ok) {
      const detalle = await respuesta.text().catch(() => '')
      throw new Error(detalle || `Error ${respuesta.status}`)
    }
  } catch (error) {
    console.error('Error al actualizar estado', error)
    usuario.estado = estadoAnterior
    errorUsuario.value = 'No fue posible actualizar el estado.'
  }
}

const cargarCategorias = async () => {
  try {
    const respuesta = await fetch(CATEGORIAS_ENDPOINT)
    if (!respuesta.ok) {
      throw new Error(`Error ${respuesta.status}`)
    }
    const data = await respuesta.json()
    const lista = Array.isArray(data) ? data : Array.isArray(data.results) ? data.results : Array.isArray(data.data) ? data.data : []
    const normalizadas = lista
      .map((item, index) => {
        if (!item || typeof item !== 'object') return null
        const categoria = item as Record<string, unknown>
        return {
          id: Number(categoria.categoria_id ?? categoria.id ?? index + 1),
          nombre: String(categoria.nombre ?? ''),
          descripcion: String(categoria.descripcion ?? ''),
          estado: categoria.estado === false || categoria.estado === 'inactivo' ? 'inactivo' : 'activo'
        } as Categoria
      })
      .filter(Boolean) as Categoria[]
    categorias.splice(0, categorias.length, ...normalizadas)
  } catch (error) {
    console.error('No se pudieron cargar categorias', error)
  }
}

const cargarCategoriasContabilidad = async () => {
  try {
    const respuesta = await fetch(CATEGORIAS_CONTABILIDAD_ENDPOINT)
    if (!respuesta.ok) {
      throw new Error(`Error ${respuesta.status}`)
    }
    const data = await respuesta.json()
    const lista = Array.isArray(data) ? data : Array.isArray(data.results) ? data.results : Array.isArray(data.data) ? data.data : []
    const normalizadas = lista
      .map((item, index) => {
        if (!item || typeof item !== 'object') return null
        const categoria = item as Record<string, unknown>
        return {
          id: Number(categoria.categoria_id ?? categoria.id ?? index + 1),
          nombre: String(categoria.nombre ?? ''),
          codigo: String(categoria.codigo ?? '')
        } as CategoriaContabilidad
      })
      .filter(Boolean) as CategoriaContabilidad[]
    categoriasContabilidad.splice(0, categoriasContabilidad.length, ...normalizadas)
  } catch (error) {
    console.error('No se pudieron cargar categorias contabilidad', error)
  }
}

const crearCategoriaContabilidad = async () => {
  errorCategoriaContabilidad.value = ''
  const nombre = categoriaContabilidadForm.nombre.trim()
  const codigo = categoriaContabilidadForm.codigo.trim().toUpperCase()

  if (!nombre || !codigo) {
    errorCategoriaContabilidad.value = 'Completa nombre y codigo.'
    return
  }

  try {
    const respuesta = await fetch(CATEGORIAS_CONTABILIDAD_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, codigo })
    })
    if (!respuesta.ok) {
      const detalle = await respuesta.text().catch(() => '')
      throw new Error(detalle || `Error ${respuesta.status}`)
    }
    const data = (await respuesta.json()) as Record<string, unknown>
    categoriasContabilidad.unshift({
      id: Number(data.categoria_id ?? data.id ?? Date.now()),
      nombre: String(data.nombre ?? nombre),
      codigo: String(data.codigo ?? codigo)
    })
    limpiarCategoriaContabilidad()
  } catch (error) {
    console.error('Error al crear categoria contabilidad', error)
    errorCategoriaContabilidad.value = 'No fue posible crear la categoria.'
  }
}

const categoriaContabilidadEdicionId = ref<number | null>(null)
const categoriaContabilidadEdicion = reactive({ nombre: '', codigo: '' })

const iniciarEdicionCategoriaContabilidad = (categoria: CategoriaContabilidad) => {
  categoriaContabilidadEdicionId.value = categoria.id
  categoriaContabilidadEdicion.nombre = categoria.nombre
  categoriaContabilidadEdicion.codigo = categoria.codigo
}

const cancelarEdicionCategoriaContabilidad = () => {
  categoriaContabilidadEdicionId.value = null
  categoriaContabilidadEdicion.nombre = ''
  categoriaContabilidadEdicion.codigo = ''
}

const guardarEdicionCategoriaContabilidad = async (categoria: CategoriaContabilidad) => {
  errorCategoriaContabilidad.value = ''
  const nombre = categoriaContabilidadEdicion.nombre.trim()
  const codigo = categoriaContabilidadEdicion.codigo.trim().toUpperCase()

  if (!nombre || !codigo) {
    errorCategoriaContabilidad.value = 'Completa nombre y codigo.'
    return
  }

  try {
    const respuesta = await fetch(`${CATEGORIAS_CONTABILIDAD_ENDPOINT}${categoria.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, codigo })
    })
    if (!respuesta.ok) {
      const detalle = await respuesta.text().catch(() => '')
      throw new Error(detalle || `Error ${respuesta.status}`)
    }
    categoria.nombre = nombre
    categoria.codigo = codigo
    cancelarEdicionCategoriaContabilidad()
  } catch (error) {
    console.error('Error al actualizar categoria contabilidad', error)
    errorCategoriaContabilidad.value = 'No fue posible actualizar la categoria.'
  }
}

const mostrarAvisoCategoria = (mensaje: string) => {
  avisoCategoria.value = mensaje
  window.setTimeout(() => {
    avisoCategoria.value = ''
  }, 2500)
}

const toggleEstadoCategoria = async (id: number) => {
  const categoria = categorias.find((item) => item.id === id)
  if (!categoria) return
  const estadoAnterior = categoria.estado
  const nuevoEstado = categoria.estado === 'activo' ? 'inactivo' : 'activo'
  categoria.estado = nuevoEstado

  try {
    const respuesta = await fetch(`${CATEGORIAS_ENDPOINT}${id}/estado`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: nuevoEstado === 'activo' })
    })
    if (!respuesta.ok) {
      const detalle = await respuesta.text().catch(() => '')
      throw new Error(detalle || `Error ${respuesta.status}`)
    }
    mostrarAvisoCategoria(`Categoria ${nuevoEstado === 'activo' ? 'activada' : 'desactivada'}.`)
  } catch (error) {
    console.error('Error al actualizar estado', error)
    categoria.estado = estadoAnterior
    mostrarAvisoCategoria('No se pudo activar/desactivar la categoria.')
  }
}

const limpiarCacheProductosPos = () => {
  localStorage.removeItem('pos_productos_cache')
  avisoCache.value = 'Cache POS limpiado.'
  window.setTimeout(() => {
    avisoCache.value = ''
  }, 2000)
}

onMounted(() => {
  void cargarClientes()
  void cargarUsuarios()
  void cargarCategorias()
  void cargarCategoriasContabilidad()
})
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
        <span>Total clientes: {{ totalClientes }}</span>
      </div>
      <div class="admin__acciones">
        <button type="button" class="secundario" @click="limpiarCacheProductosPos">Limpiar cache POS</button>
        <span v-if="avisoCache" class="aviso">{{ avisoCache }}</span>
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
          <label>
            <span>Contacto</span>
            <input v-model="usuarioForm.numeroContacto" type="text" placeholder="3001234567" />
          </label>
          <label>
            <span>Contraseña</span>
            <input v-model="usuarioForm.contrasena" type="password" placeholder="••••••••" />
          </label>
          <label>
            <span>Rol</span>
            <select v-model="usuarioForm.role">
              <option value="administrador">Administrador</option>
              <option value="cajero">Cajero</option>
              <option value="supervisor">Supervisor</option>
            </select>
          </label>
          <label>
            <span>Estado</span>
            <select v-model="usuarioForm.activo">
              <option :value="true">Activo</option>
              <option :value="false">Inactivo</option>
            </select>
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
        <p v-if="avisoCategoria" class="aviso">{{ avisoCategoria }}</p>

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
              <span :class="['estado', categoria.estado]">{{ categoria.estado }}</span>
              <button type="button" class="secundario" @click="toggleEstadoCategoria(categoria.id)">
                {{ categoria.estado === 'activo' ? 'Desactivar' : 'Activar' }}
              </button>
            </div>
          </li>
        </ul>
      </section>

      <section class="panel">
        <header class="panel__cabecera">
          <h2>Categorias contabilidad</h2>
          <p>Clasifica movimientos contables.</p>
        </header>

        <form class="form" @submit.prevent="crearCategoriaContabilidad">
          <label>
            <span>Nombre</span>
            <input v-model="categoriaContabilidadForm.nombre" type="text" placeholder="SERVICIOS PUBLICOS" />
          </label>
          <label>
            <span>Codigo</span>
            <input v-model="categoriaContabilidadForm.codigo" type="text" placeholder="SP" />
          </label>
          <button type="submit">Crear categoria</button>
          <p v-if="errorCategoriaContabilidad" class="error">{{ errorCategoriaContabilidad }}</p>
        </form>

        <ul class="lista">
          <li v-for="categoria in categoriasContabilidad" :key="categoria.id">
            <div v-if="categoriaContabilidadEdicionId === categoria.id" class="edicion">
              <input v-model="categoriaContabilidadEdicion.nombre" type="text" class="inline-input" />
              <input v-model="categoriaContabilidadEdicion.codigo" type="text" class="inline-input" />
            </div>
            <div v-else>
              <strong>{{ categoria.nombre }}</strong>
              <small>Codigo: {{ categoria.codigo }}</small>
            </div>
            <div class="acciones">
              <template v-if="categoriaContabilidadEdicionId === categoria.id">
                <button type="button" class="secundario" @click="guardarEdicionCategoriaContabilidad(categoria)">
                  Guardar
                </button>
                <button type="button" class="secundario" @click="cancelarEdicionCategoriaContabilidad">Cancelar</button>
              </template>
              <button
                v-else
                type="button"
                class="secundario"
                @click="iniciarEdicionCategoriaContabilidad(categoria)"
              >
                Editar
              </button>
            </div>
          </li>
        </ul>
      </section>

      <section class="panel">
        <header class="panel__cabecera">
          <h2>Clientes</h2>
          <p>Gestiona clientes para facturacion y seguimiento.</p>
        </header>

        <form class="form" @submit.prevent="crearCliente">
          <label>
            <span>Nombre</span>
            <input v-model="clienteForm.nombre" type="text" placeholder="Nombre completo" />
          </label>
          <label>
            <span>Telefono</span>
            <input v-model="clienteForm.telefono" type="text" placeholder="3001234567" />
          </label>
          <label>
            <span>Email</span>
            <input v-model="clienteForm.email" type="email" placeholder="cliente@correo.com" />
          </label>
          <button type="submit">Crear cliente</button>
          <p v-if="errorCliente" class="error">{{ errorCliente }}</p>
        </form>

        <ul class="lista">
          <li v-for="cliente in clientes" :key="cliente.id">
            <div>
              <strong>{{ cliente.nombre }}</strong>
              <small>{{ cliente.telefono }} · {{ cliente.email }}</small>
            </div>
            <div class="acciones">
              <span class="estado">{{ cliente.createdAt ? 'Registrado' : 'Nuevo' }}</span>
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

.admin__acciones {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 0.75rem;
}

.aviso {
  color: #facc15;
  font-weight: 600;
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

.inline-input {
  border-radius: 0.65rem;
  border: 1px solid rgba(148, 163, 184, 0.3);
  padding: 0.4rem 0.6rem;
  background: rgba(12, 13, 16, 0.92);
  color: #e2e8f0;
}

.edicion {
  display: grid;
  gap: 0.35rem;
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
