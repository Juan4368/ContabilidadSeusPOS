<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import SessionRoleChip from '../components/SessionRoleChip.vue'
import { ENDPOINTS } from '../config/endpoints'

type Usuario = {
  user_id: number
  username: string
  email: string
  telephone_number: string | null
  is_active: boolean
  is_verified: boolean
  last_login_at: string | null
  created_at: string
  updated_at: string
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
  codigo?: string
  tipo_categoria?: string
}

type Cliente = {
  id: string
  nombre: string
  telefono: string
  email: string
  descuentoPesos?: number
  descuentoPorcentaje?: number
  createdAt: string
}

type Proveedor = {
  id: number
  nombre: string
  telefono: string
  email: string
}

const CLIENTES_ENDPOINT = ENDPOINTS.CLIENTES
const USUARIOS_ENDPOINT = ENDPOINTS.USUARIOS
const USUARIOS_REGISTRO_ENDPOINT = ENDPOINTS.USUARIOS_REGISTRO
const CATEGORIAS_ENDPOINT = ENDPOINTS.CATEGORIAS
const CATEGORIAS_CONTABILIDAD_ENDPOINT = ENDPOINTS.CONTABILIDAD_CATEGORIAS
const PROVEEDORES_ENDPOINT = ENDPOINTS.CONTABILIDAD_PROVEEDORES

const usuarios = reactive<Usuario[]>([])

const categorias = reactive<Categoria[]>([
  { id: 1, nombre: 'Bebidas', descripcion: 'Cafe, te, jugos', estado: 'activo' },
  { id: 2, nombre: 'Snacks', descripcion: 'Sandwiches y panaderia', estado: 'activo' }
])
const categoriasContabilidad = reactive<CategoriaContabilidad[]>([])

const clientes = reactive<Cliente[]>([])
const proveedores = reactive<Proveedor[]>([])

const usuarioForm = reactive({
  username: '',
  email: '',
  password: ''
})
const categoriaForm = reactive({ nombre: '', descripcion: '' })
const categoriaContabilidadForm = reactive({ nombre: '', tipo_categoria: 'INGRESO' })
const clienteForm = reactive({
  nombre: '',
  telefono: '',
  email: '',
  descuentoPesos: 0,
  descuentoPorcentaje: 0
})
const proveedorForm = reactive({ nombre: '', telefono: '', email: '' })

const accionesAdmin = [
  { id: 'usuario', titulo: 'Ver usuarios', descripcion: 'Listado y estado de usuarios.' },
  { id: 'categoria', titulo: 'Ver categorias', descripcion: 'Listado de categorias.' },
  { id: 'contabilidad', titulo: 'Ver categorias contables', descripcion: 'Clasifica ingresos y egresos.' },
  { id: 'cliente', titulo: 'Ver clientes', descripcion: 'Listado de clientes.' },
  { id: 'proveedor', titulo: 'Ver proveedores', descripcion: 'Listado de proveedores.' }
]

const mostrarUsuarioForm = ref(false)
const mostrarCategoriaForm = ref(false)
const mostrarCategoriaContabilidadForm = ref(false)
const mostrarClienteForm = ref(false)
const mostrarProveedorForm = ref(false)
const mostrarUsuarioCrear = ref(false)
const mostrarCategoriaCrear = ref(false)
const mostrarCategoriaContabilidadCrear = ref(false)
const mostrarClienteCrear = ref(false)
const mostrarProveedorCrear = ref(false)
const clienteEditandoId = ref<string | null>(null)
const cargandoClientes = ref(false)

const errorUsuario = ref('')
const errorCategoria = ref('')
const errorCategoriaContabilidad = ref('')
const errorCliente = ref('')
const errorProveedor = ref('')
const exitoUsuario = ref('')
const exitoCategoria = ref('')
const exitoCategoriaContabilidad = ref('')
const exitoCliente = ref('')
const exitoProveedor = ref('')
const avisoCache = ref('')
const avisoCategoria = ref('')

const usuariosActivos = computed(() => usuarios.filter((usuario) => usuario.is_active).length)
const totalClientes = computed(() => clientes.length)

const cargarUsuarios = async () => {
  try {
    const respuesta = await fetch(USUARIOS_ENDPOINT)
    if (!respuesta.ok) {
      const detalle = await respuesta.text().catch(() => '')
      throw new Error(detalle || `Error ${respuesta.status}`)
    }
    const data = await respuesta.json()
    const dataObj = data as Record<string, unknown>
    const lista = (
      Array.isArray(data)
        ? data
        : Array.isArray(dataObj.results)
          ? dataObj.results
          : Array.isArray(dataObj.data)
            ? dataObj.data
            : Array.isArray((dataObj.data as Record<string, unknown>)?.results)
              ? (dataObj.data as Record<string, unknown>).results
              : Array.isArray(dataObj.items)
                ? dataObj.items
                : dataObj && typeof dataObj === 'object' && 'user_id' in dataObj
                  ? [dataObj]
                  : []
    ) as unknown[]
    const normalizados = lista
      .map((item: unknown, index: number) => {
        if (!item || typeof item !== 'object') return null
        const usuario = item as Record<string, unknown>
        const user_id = Number(usuario.user_id ?? usuario.id ?? index + 1)
        const username = String(usuario.username ?? usuario.nombre_usuario ?? usuario.nombre ?? 'Usuario')
        const email = String(usuario.email ?? usuario.correo ?? '')
        const telephone_number = (usuario.telephone_number ?? usuario.telefono ?? null) as string | null
        const is_active = usuario.is_active === false || usuario.activo === false ? false : true
        const is_verified = usuario.is_verified === true || usuario.verificado === true
        const last_login_at = (usuario.last_login_at ?? usuario.ultimo_acceso ?? null) as string | null
        const created_at = String(usuario.created_at ?? usuario.createdAt ?? '')
        const updated_at = String(usuario.updated_at ?? usuario.updatedAt ?? '')
        return {
          user_id,
          username,
          email,
          telephone_number,
          is_active,
          is_verified,
          last_login_at,
          created_at,
          updated_at
        } as Usuario
      })
      .filter(Boolean) as Usuario[]
    usuarios.splice(0, usuarios.length, ...normalizados)
  } catch (error) {
    console.error('No se pudieron cargar usuarios', error)
  }
}

const limpiarUsuario = () => {
  usuarioForm.username = ''
  usuarioForm.email = ''
  usuarioForm.password = ''
}

const limpiarCategoria = () => {
  categoriaForm.nombre = ''
  categoriaForm.descripcion = ''
}

const limpiarCategoriaContabilidad = () => {
  categoriaContabilidadForm.nombre = ''
  categoriaContabilidadForm.tipo_categoria = 'INGRESO'
}

const limpiarCliente = () => {
  clienteForm.nombre = ''
  clienteForm.telefono = ''
  clienteForm.email = ''
  clienteForm.descuentoPesos = 0
  clienteForm.descuentoPorcentaje = 0
  clienteEditandoId.value = null
}

const limpiarProveedor = () => {
  proveedorForm.nombre = ''
  proveedorForm.telefono = ''
  proveedorForm.email = ''
}

const cerrarModalesAdmin = () => {
  mostrarUsuarioForm.value = false
  mostrarCategoriaForm.value = false
  mostrarCategoriaContabilidadForm.value = false
  mostrarClienteForm.value = false
  mostrarProveedorForm.value = false
  mostrarUsuarioCrear.value = false
  mostrarCategoriaCrear.value = false
  mostrarCategoriaContabilidadCrear.value = false
  mostrarClienteCrear.value = false
  mostrarProveedorCrear.value = false
}

const abrirModalAdmin = (id: string) => {
  cerrarModalesAdmin()
  errorUsuario.value = ''
  errorCategoria.value = ''
  errorCategoriaContabilidad.value = ''
  errorCliente.value = ''
  errorProveedor.value = ''
  exitoUsuario.value = ''
  exitoCategoria.value = ''
  exitoCategoriaContabilidad.value = ''
  exitoCliente.value = ''
  exitoProveedor.value = ''
  if (id === 'usuario') {
    mostrarUsuarioForm.value = true
  } else if (id === 'categoria') {
    mostrarCategoriaForm.value = true
  } else if (id === 'contabilidad') {
    mostrarCategoriaContabilidadForm.value = true
  } else if (id === 'cliente') {
    mostrarClienteForm.value = true
    void cargarClientes()
  } else if (id === 'proveedor') {
    mostrarProveedorForm.value = true
    void cargarProveedores()
  }
}

const cerrarModalUsuario = () => {
  mostrarUsuarioForm.value = false
  errorUsuario.value = ''
  exitoUsuario.value = ''
  mostrarUsuarioCrear.value = false
}

const cerrarModalCategoria = () => {
  mostrarCategoriaForm.value = false
  errorCategoria.value = ''
  exitoCategoria.value = ''
  mostrarCategoriaCrear.value = false
}

const cerrarModalCategoriaContabilidad = () => {
  mostrarCategoriaContabilidadForm.value = false
  errorCategoriaContabilidad.value = ''
  exitoCategoriaContabilidad.value = ''
  mostrarCategoriaContabilidadCrear.value = false
}

const cerrarModalCliente = () => {
  mostrarClienteForm.value = false
  errorCliente.value = ''
  exitoCliente.value = ''
  mostrarClienteCrear.value = false
  limpiarCliente()
}

const cerrarModalProveedor = () => {
  mostrarProveedorForm.value = false
  errorProveedor.value = ''
  exitoProveedor.value = ''
  mostrarProveedorCrear.value = false
}

const extraerListaClientes = (data: unknown): unknown[] => {
  if (Array.isArray(data)) return data
  if (!data || typeof data !== 'object') return []
  const raw = data as Record<string, unknown>
  if (Array.isArray(raw.data)) return raw.data
  if (Array.isArray(raw.results)) return raw.results
  if (raw.data && typeof raw.data === 'object' && Array.isArray((raw.data as Record<string, unknown>).results)) {
    return (raw.data as Record<string, unknown>).results as unknown[]
  }
  return []
}

const normalizarCliente = (item: unknown): Cliente | null => {
  if (!item || typeof item !== 'object') return null
  const cliente = item as Record<string, unknown>
  return {
    id: String(cliente.id ?? cliente.cliente_id ?? ''),
    nombre: String(cliente.nombre ?? ''),
    telefono: String(cliente.telefono ?? ''),
    email: String(cliente.email ?? ''),
    descuentoPesos: Number(cliente.descuento_pesos ?? 0),
    descuentoPorcentaje: Number(cliente.descuento_porcentaje ?? 0) * 100,
    createdAt: String(cliente.created_at ?? '')
  }
}

const cargarClientes = async () => {
  errorCliente.value = ''
  cargandoClientes.value = true
  try {
    const respuesta = await fetch(CLIENTES_ENDPOINT)
    if (!respuesta.ok) {
      const detalle = await respuesta.text().catch(() => '')
      throw new Error(detalle || `Error ${respuesta.status}`)
    }
    const data = await respuesta.json()
    const lista = extraerListaClientes(data)
    const normalizados = lista.map(normalizarCliente).filter(Boolean) as Cliente[]
    clientes.splice(0, clientes.length, ...normalizados)
  } catch (error) {
    console.error('No se pudieron cargar clientes', error)
    const detalle = error instanceof Error ? error.message : String(error)
    errorCliente.value = `No se pudieron cargar los clientes. ${detalle}`
  } finally {
    cargandoClientes.value = false
  }
}

const crearUsuario = async () => {
  errorUsuario.value = ''
  exitoUsuario.value = ''
  const username = usuarioForm.username.trim()
  const emailRaw = usuarioForm.email.trim()
  const email = emailRaw ? emailRaw.toLowerCase() : ''
  const password = usuarioForm.password.trim()

  if (!username || !password) {
    errorUsuario.value = 'Completa usuario y contraseña.'
    return
  }

  try {
    const payload = {
      username,
      password,
      ...(email ? { email } : {})
    }

    const respuesta = await fetch(USUARIOS_REGISTRO_ENDPOINT, {
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
      user_id: Number(data.user_id ?? data.id ?? Date.now()),
      username: String(data.username ?? username),
      email: String(data.email ?? email),
      telephone_number: (data.telephone_number ?? null) as string | null,
      is_active: data.is_active === false ? false : true,
      is_verified: data.is_verified === true,
      last_login_at: (data.last_login_at ?? null) as string | null,
      created_at: String(data.created_at ?? ''),
      updated_at: String(data.updated_at ?? '')
    })
    limpiarUsuario()
    exitoUsuario.value = 'Usuario creado correctamente.'
    mostrarUsuarioCrear.value = false
  } catch (error) {
    console.error('Error al crear usuario', error)
    const detalle = error instanceof Error ? error.message : String(error)
    const payloadSeguro = JSON.stringify({ username, email: email || null, password }, null, 2)
    errorUsuario.value = `No fue posible crear el usuario. ${detalle}\nPayload:\n${payloadSeguro}`.trim()
  }
}

const cargarProveedores = async () => {
  try {
    const respuesta = await fetch(PROVEEDORES_ENDPOINT)
    if (!respuesta.ok) {
      throw new Error(`Error ${respuesta.status}`)
    }
    const data = await respuesta.json()
    const lista = Array.isArray(data) ? data : []
    const normalizados = lista
      .map((item: unknown, index: number) => {
        if (!item || typeof item !== 'object') return null
        const proveedor = item as Record<string, unknown>
        return {
          id: Number(proveedor.id ?? index + 1),
          nombre: String(proveedor.nombre ?? ''),
          telefono: String(proveedor.telefono ?? ''),
          email: String(proveedor.email ?? '')
        }
      })
      .filter(Boolean) as Proveedor[]
    proveedores.splice(0, proveedores.length, ...normalizados)
  } catch (error) {
    console.error('No se pudieron cargar proveedores', error)
  }
}

const crearCategoria = () => {
  errorCategoria.value = ''
  exitoCategoria.value = ''
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
      exitoCategoria.value = 'Categoria creada correctamente.'
      mostrarCategoriaCrear.value = false
    } catch (error) {
      console.error('Error al crear categoria', error)
      const detalle = error instanceof Error ? error.message : String(error)
      errorCategoria.value = `No fue posible crear la categoria. ${detalle}`
    }
  }

  void crear()
}

const crearCliente = async () => {
  errorCliente.value = ''
  exitoCliente.value = ''
  const nombre = clienteForm.nombre.trim()
  const telefono = clienteForm.telefono.trim()
  const email = clienteForm.email.trim().toLowerCase()
  const telefonoPayload = telefono || null
  const emailPayload = email || null
  const descuentoPesos = Number(clienteForm.descuentoPesos || 0)
  const descuentoPorcentaje = Number(clienteForm.descuentoPorcentaje || 0) / 100

  if (!nombre) {
    errorCliente.value = 'Completa el nombre.'
    return
  }

  try {
    const respuesta = await fetch(CLIENTES_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre,
        telefono: telefonoPayload,
        email: emailPayload,
        descuento_pesos: descuentoPesos,
        descuento_porcentaje: descuentoPorcentaje
      })
    })
    if (!respuesta.ok) {
      const detalle = await respuesta.text().catch(() => '')
      throw new Error(detalle || `Error ${respuesta.status}`)
    }
    const data = (await respuesta.json().catch(() => ({}))) as Record<string, unknown>
    const payload = (data.data as Record<string, unknown> | undefined) ?? data
    const nuevo: Cliente = {
      id: String(payload.id ?? payload.cliente_id ?? Date.now()),
      nombre: String(payload.nombre ?? nombre),
      telefono: String(payload.telefono ?? telefonoPayload ?? ''),
      email: String(payload.email ?? emailPayload ?? ''),
      descuentoPesos: Number(payload.descuento_pesos ?? descuentoPesos),
      descuentoPorcentaje: Number(payload.descuento_porcentaje ?? descuentoPorcentaje) * 100,
      createdAt: String(payload.created_at ?? new Date().toISOString())
    }
    clientes.unshift(nuevo)
    limpiarCliente()
    exitoCliente.value = 'Cliente creado correctamente.'
    mostrarClienteCrear.value = false
  } catch (error) {
    console.error('Error al crear cliente', error)
    const detalle = error instanceof Error ? error.message : String(error)
    const payloadSeguro = JSON.stringify(
      {
        nombre,
        telefono: telefonoPayload,
        email: emailPayload,
        descuento_pesos: descuentoPesos,
        descuento_porcentaje: descuentoPorcentaje
      },
      null,
      2
    )
    errorCliente.value = `No fue posible crear el cliente. ${detalle}\nPayload:\n${payloadSeguro}`.trim()
  }
}

const actualizarCliente = async (id: string) => {
  errorCliente.value = ''
  exitoCliente.value = ''
  const nombre = clienteForm.nombre.trim()
  const telefono = clienteForm.telefono.trim()
  const email = clienteForm.email.trim().toLowerCase()
  const telefonoPayload = telefono || null
  const emailPayload = email || null
  const descuentoPesos = Number(clienteForm.descuentoPesos || 0)
  const descuentoPorcentaje = Number(clienteForm.descuentoPorcentaje || 0) / 100

  if (!nombre) {
    errorCliente.value = 'Completa el nombre.'
    return
  }

  try {
    const respuesta = await fetch(`${CLIENTES_ENDPOINT}${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre,
        telefono: telefonoPayload,
        email: emailPayload,
        descuento_pesos: descuentoPesos,
        descuento_porcentaje: descuentoPorcentaje
      })
    })
    if (!respuesta.ok) {
      const detalle = await respuesta.text().catch(() => '')
      throw new Error(detalle || `Error ${respuesta.status}`)
    }
    const data = (await respuesta.json().catch(() => ({}))) as Record<string, unknown>
    const payload = (data.data as Record<string, unknown> | undefined) ?? data
    const index = clientes.findIndex((item) => item.id === id)
    if (index >= 0) {
      clientes[index] = {
        ...clientes[index],
        nombre: String(payload.nombre ?? nombre),
        telefono: String(payload.telefono ?? telefonoPayload ?? ''),
        email: String(payload.email ?? emailPayload ?? ''),
        descuentoPesos: Number(payload.descuento_pesos ?? descuentoPesos),
        descuentoPorcentaje: Number(payload.descuento_porcentaje ?? descuentoPorcentaje) * 100
      }
    }
    exitoCliente.value = 'Cliente actualizado correctamente.'
    limpiarCliente()
    mostrarClienteCrear.value = false
  } catch (error) {
    console.error('Error al actualizar cliente', error)
    errorCliente.value = 'No fue posible actualizar el cliente.'
  }
}

const guardarCliente = async () => {
  if (clienteEditandoId.value) {
    await actualizarCliente(clienteEditandoId.value)
  } else {
    await crearCliente()
  }
}

const iniciarEdicionCliente = (cliente: Cliente) => {
  mostrarClienteCrear.value = true
  clienteEditandoId.value = cliente.id
  clienteForm.nombre = cliente.nombre
  clienteForm.telefono = cliente.telefono
  clienteForm.email = cliente.email
  clienteForm.descuentoPesos = Number(cliente.descuentoPesos ?? 0)
  clienteForm.descuentoPorcentaje = Number(cliente.descuentoPorcentaje ?? 0)
  errorCliente.value = ''
  exitoCliente.value = ''
}

const cancelarEdicionCliente = () => {
  limpiarCliente()
  mostrarClienteCrear.value = false
  errorCliente.value = ''
  exitoCliente.value = ''
}

const crearProveedor = async () => {
  errorProveedor.value = ''
  exitoProveedor.value = ''
  const nombre = proveedorForm.nombre.trim()
  const telefono = proveedorForm.telefono.trim()
  const email = proveedorForm.email.trim().toLowerCase()

  if (!nombre || !telefono || !email) {
    errorProveedor.value = 'Completa nombre, telefono y email.'
    return
  }

  try {
    const respuesta = await fetch(PROVEEDORES_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, telefono, email })
    })
    if (!respuesta.ok) {
      const detalle = await respuesta.text().catch(() => '')
      throw new Error(detalle || `Error ${respuesta.status}`)
    }
    const data = (await respuesta.json()) as Record<string, unknown>
    proveedores.unshift({
      id: Number(data.id ?? Date.now()),
      nombre: String(data.nombre ?? nombre),
      telefono: String(data.telefono ?? telefono),
      email: String(data.email ?? email)
    })
    limpiarProveedor()
    exitoProveedor.value = 'Proveedor creado correctamente.'
    mostrarProveedorCrear.value = false
  } catch (error) {
    console.error('Error al crear proveedor', error)
    const detalle = error instanceof Error ? error.message : String(error)
    errorProveedor.value = `No fue posible crear el proveedor. ${detalle}`
  }
}

const toggleEstado = async (id: number) => {
  const usuario = usuarios.find((item) => item.user_id === id)
  if (!usuario) return
  const estadoAnterior = usuario.is_active
  const nuevoEstado = !usuario.is_active
  usuario.is_active = nuevoEstado

  try {
    const endpoints = [`${USUARIOS_ENDPOINT}${id}/estado`, `${USUARIOS_ENDPOINT}${id}`]
    let respuesta: Response | null = null
    let errorDetalle = ''

    for (const endpoint of endpoints) {
      respuesta = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: nuevoEstado, activo: nuevoEstado })
      })
      if (respuesta.ok) {
        errorDetalle = ''
        break
      }
      errorDetalle = await respuesta.text().catch(() => '')
    }

    if (!respuesta?.ok) {
      throw new Error(errorDetalle || `Error ${respuesta?.status ?? 'desconocido'}`)
    }
  } catch (error) {
    console.error('Error al actualizar estado', error)
    usuario.is_active = estadoAnterior
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
      .map((item: unknown, index: number) => {
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
      .map((item: unknown, index: number) => {
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
  exitoCategoriaContabilidad.value = ''
  const nombre = categoriaContabilidadForm.nombre.trim()
  const tipoCategoria = categoriaContabilidadForm.tipo_categoria.trim().toUpperCase()

  if (!nombre || !tipoCategoria) {
    errorCategoriaContabilidad.value = 'Completa nombre y tipo de categoria.'
    return
  }

  try {
    const respuesta = await fetch(CATEGORIAS_CONTABILIDAD_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, tipo_categoria: tipoCategoria })
    })
    if (!respuesta.ok) {
      const detalle = await respuesta.text().catch(() => '')
      throw new Error(detalle || `Error ${respuesta.status}`)
    }
    const data = (await respuesta.json()) as Record<string, unknown>
    categoriasContabilidad.unshift({
      id: Number(data.categoria_id ?? data.id ?? Date.now()),
      nombre: String(data.nombre ?? nombre),
      codigo: String(data.codigo ?? ''),
      tipo_categoria: String(data.tipo_categoria ?? tipoCategoria)
    })
    limpiarCategoriaContabilidad()
    exitoCategoriaContabilidad.value = 'Categoria creada correctamente.'
    mostrarCategoriaContabilidadCrear.value = false
  } catch (error) {
    console.error('Error al crear categoria contabilidad', error)
    const detalle = error instanceof Error ? error.message : String(error)
    errorCategoriaContabilidad.value = `No fue posible crear la categoria. ${detalle}`
  }
}

const categoriaContabilidadEdicionId = ref<number | null>(null)
const categoriaContabilidadEdicion = reactive({ nombre: '', codigo: '' })

const iniciarEdicionCategoriaContabilidad = (categoria: CategoriaContabilidad) => {
  categoriaContabilidadEdicionId.value = categoria.id
  categoriaContabilidadEdicion.nombre = categoria.nombre
  categoriaContabilidadEdicion.codigo = categoria.codigo ?? ''
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
  void cargarProveedores()
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
        <SessionRoleChip />
        <button type="button" class="secundario" @click="limpiarCacheProductosPos">Limpiar cache POS</button>
        <span v-if="avisoCache" class="aviso">{{ avisoCache }}</span>
      </div>
    </header>

    <section class="admin__acciones-grid">
      <article
        v-for="accion in accionesAdmin"
        :key="accion.id"
        class="accion"
        role="button"
        tabindex="0"
        @click="abrirModalAdmin(accion.id)"
        @keyup.enter.prevent="abrirModalAdmin(accion.id)"
        @keyup.space.prevent="abrirModalAdmin(accion.id)"
      >
        <div>
          <h2>{{ accion.titulo }}</h2>
          <p>{{ accion.descripcion }}</p>
        </div>
      </article>
    </section>

    <div
      v-if="mostrarUsuarioForm"
      class="modal"
      role="dialog"
      aria-modal="true"
      @click.self="cerrarModalUsuario"
    >
      <section class="modal__contenido" @click.stop>
        <div class="modal__encabezado">
          <h2>Usuarios</h2>
          <button type="button" class="modal__cerrar" @click="cerrarModalUsuario">x</button>
        </div>
        <div class="modal__acciones">
          <button type="button" class="secundario" @click="mostrarUsuarioCrear = !mostrarUsuarioCrear">
            {{ mostrarUsuarioCrear ? 'Ocultar formulario' : 'Crear usuario' }}
          </button>
        </div>
        <form v-if="mostrarUsuarioCrear" class="form" @submit.prevent="crearUsuario">
          <label>
            <span>Usuario</span>
            <input v-model="usuarioForm.username" type="text" placeholder="usuario" />
          </label>
          <label>
            <span>Email</span>
            <input v-model="usuarioForm.email" type="email" placeholder="correo@empresa.com" />
          </label>
          <label>
            <span>Contrasena</span>
            <input v-model="usuarioForm.password" type="password" placeholder="********" />
          </label>
          <button type="submit">Crear usuario</button>
          <p v-if="errorUsuario" class="error">{{ errorUsuario }}</p>
          <p v-if="exitoUsuario" class="exito">{{ exitoUsuario }}</p>
        </form>
        <ul class="lista">
          <li v-for="usuario in usuarios" :key="usuario.user_id">
            <div>
              <strong>{{ usuario.username }}</strong>
              <small>{{ usuario.email }}</small>
              <small>{{ usuario.telephone_number || 'Sin telefono' }}</small>
              <small>
                Verificado: {{ usuario.is_verified ? 'Si' : 'No' }} · Ultimo acceso:
                {{ usuario.last_login_at || 'Sin registro' }}
              </small>
            </div>
            <div class="acciones">
              <span :class="['estado', usuario.is_active ? 'activo' : 'inactivo']">
                {{ usuario.is_active ? 'activo' : 'inactivo' }}
              </span>
              <button type="button" class="secundario" @click="toggleEstado(usuario.user_id)">
                {{ usuario.is_active ? 'Desactivar' : 'Activar' }}
              </button>
            </div>
          </li>
        </ul>
        <p v-if="errorUsuario" class="error">{{ errorUsuario }}</p>
      </section>
    </div>

    <div
      v-if="mostrarCategoriaForm"
      class="modal"
      role="dialog"
      aria-modal="true"
      @click.self="cerrarModalCategoria"
    >
      <section class="modal__contenido" @click.stop>
        <div class="modal__encabezado">
          <h2>Categorias</h2>
          <button type="button" class="modal__cerrar" @click="cerrarModalCategoria">x</button>
        </div>
        <div class="modal__acciones">
          <button type="button" class="secundario" @click="mostrarCategoriaCrear = !mostrarCategoriaCrear">
            {{ mostrarCategoriaCrear ? 'Ocultar formulario' : 'Crear categoria' }}
          </button>
        </div>
        <form v-if="mostrarCategoriaCrear" class="form" @submit.prevent="crearCategoria">
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
          <p v-if="exitoCategoria" class="exito">{{ exitoCategoria }}</p>
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
        <p v-if="avisoCategoria" class="aviso">{{ avisoCategoria }}</p>
        <p v-if="errorCategoria" class="error">{{ errorCategoria }}</p>
      </section>
    </div>

    <div
      v-if="mostrarCategoriaContabilidadForm"
      class="modal"
      role="dialog"
      aria-modal="true"
      @click.self="cerrarModalCategoriaContabilidad"
    >
      <section class="modal__contenido" @click.stop>
        <div class="modal__encabezado">
          <h2>Categorias contables</h2>
          <button type="button" class="modal__cerrar" @click="cerrarModalCategoriaContabilidad">x</button>
        </div>
        <div class="modal__acciones">
          <button
            type="button"
            class="secundario"
            @click="mostrarCategoriaContabilidadCrear = !mostrarCategoriaContabilidadCrear"
          >
            {{ mostrarCategoriaContabilidadCrear ? 'Ocultar formulario' : 'Crear categoria' }}
          </button>
        </div>
        <form v-if="mostrarCategoriaContabilidadCrear" class="form" @submit.prevent="crearCategoriaContabilidad">
          <label>
            <span>Nombre</span>
            <input v-model="categoriaContabilidadForm.nombre" type="text" placeholder="SERVICIOS PUBLICOS" />
          </label>
          <label>
            <span>Tipo Categoria</span>
            <select v-model="categoriaContabilidadForm.tipo_categoria">
              <option value="INGRESO">Ingreso</option>
              <option value="EGRESO">Egreso</option>
            </select>
          </label>
          <button type="submit">Crear categoria</button>
          <p v-if="errorCategoriaContabilidad" class="error">{{ errorCategoriaContabilidad }}</p>
          <p v-if="exitoCategoriaContabilidad" class="exito">{{ exitoCategoriaContabilidad }}</p>
        </form>
        <ul class="lista">
          <li v-for="categoria in categoriasContabilidad" :key="categoria.id">
            <div v-if="categoriaContabilidadEdicionId === categoria.id" class="edicion">
              <input v-model="categoriaContabilidadEdicion.nombre" type="text" class="inline-input" />
              <input v-model="categoriaContabilidadEdicion.codigo" type="text" class="inline-input" />
            </div>
            <div v-else>
              <strong>{{ categoria.nombre }}</strong>
              <small>Tipo: {{ categoria.tipo_categoria ?? 'Sin tipo' }}</small>
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
        <p v-if="errorCategoriaContabilidad" class="error">{{ errorCategoriaContabilidad }}</p>
      </section>
    </div>

    <div
      v-if="mostrarClienteForm"
      class="modal"
      role="dialog"
      aria-modal="true"
      @click.self="cerrarModalCliente"
    >
      <section class="modal__contenido" @click.stop>
        <div class="modal__encabezado">
          <h2>Clientes</h2>
          <button type="button" class="modal__cerrar" @click="cerrarModalCliente">x</button>
        </div>
        <div class="modal__acciones">
          <button type="button" class="secundario" @click="mostrarClienteCrear = !mostrarClienteCrear">
            {{ mostrarClienteCrear ? 'Ocultar formulario' : 'Crear cliente' }}
          </button>
          <span v-if="cargandoClientes" class="aviso">Cargando...</span>
        </div>
        <form v-if="mostrarClienteCrear" class="form" @submit.prevent="guardarCliente">
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
          <label>
            <span>Descuento $</span>
            <input v-model.number="clienteForm.descuentoPesos" type="number" min="0" step="100" />
          </label>
          <label>
            <span>Descuento %</span>
            <input v-model.number="clienteForm.descuentoPorcentaje" type="number" min="0" max="100" step="1" />
          </label>
          <button type="submit">{{ clienteEditandoId ? 'Actualizar cliente' : 'Crear cliente' }}</button>
          <button v-if="clienteEditandoId" type="button" class="secundario" @click="cancelarEdicionCliente">
            Cancelar edicion
          </button>
          <p v-if="errorCliente" class="error">{{ errorCliente }}</p>
          <p v-if="exitoCliente" class="exito">{{ exitoCliente }}</p>
        </form>
        <ul class="lista">
          <li v-for="cliente in clientes" :key="cliente.id">
            <div>
              <strong>{{ cliente.nombre }}</strong>
              <small>{{ cliente.telefono }} - {{ cliente.email }}</small>
              <small>Descuento: {{ cliente.descuentoPesos ?? 0 }}$ ? {{ cliente.descuentoPorcentaje ?? 0 }}%</small>
            </div>
            <div class="acciones">
              <span class="estado">{{ cliente.createdAt ? 'Registrado' : 'Nuevo' }}</span>
              <button type="button" class="secundario" @click="iniciarEdicionCliente(cliente)">Actualizar</button>
            </div>
          </li>
        </ul>
        <p v-if="errorCliente" class="error">{{ errorCliente }}</p>
      </section>
    </div>

    <div
      v-if="mostrarProveedorForm"
      class="modal"
      role="dialog"
      aria-modal="true"
      @click.self="cerrarModalProveedor"
    >
      <section class="modal__contenido" @click.stop>
        <div class="modal__encabezado">
          <h2>Proveedores</h2>
          <button type="button" class="modal__cerrar" @click="cerrarModalProveedor">x</button>
        </div>
        <div class="modal__acciones">
          <button type="button" class="secundario" @click="mostrarProveedorCrear = !mostrarProveedorCrear">
            {{ mostrarProveedorCrear ? 'Ocultar formulario' : 'Crear proveedor' }}
          </button>
        </div>
        <form v-if="mostrarProveedorCrear" class="form" @submit.prevent="crearProveedor">
          <label>
            <span>Nombre</span>
            <input v-model="proveedorForm.nombre" type="text" placeholder="Nombre proveedor" />
          </label>
          <label>
            <span>Telefono</span>
            <input v-model="proveedorForm.telefono" type="text" placeholder="3001234567" />
          </label>
          <label>
            <span>Email</span>
            <input v-model="proveedorForm.email" type="email" placeholder="proveedor@correo.com" />
          </label>
          <button type="submit">Crear proveedor</button>
          <p v-if="errorProveedor" class="error">{{ errorProveedor }}</p>
          <p v-if="exitoProveedor" class="exito">{{ exitoProveedor }}</p>
        </form>
        <ul class="lista">
          <li v-for="proveedor in proveedores" :key="proveedor.id">
            <div>
              <strong>{{ proveedor.nombre }}</strong>
              <small>{{ proveedor.telefono }} - {{ proveedor.email }}</small>
            </div>
          </li>
        </ul>
      </section>
    </div>
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

.admin__acciones-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
}

.accion {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.2rem;
  border-radius: 1rem;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(9, 10, 13, 0.85);
  cursor: pointer;
}

.accion h2 {
  margin: 0;
  font-size: 1.1rem;
}

.accion p {
  margin: 0.35rem 0 0;
  color: #94a3b8;
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

.modal {
  position: fixed;
  inset: 0;
  background: rgba(3, 4, 7, 0.7);
  display: grid;
  place-items: center;
  padding: 1.5rem;
  z-index: 50;
}

.modal__contenido {
  padding: 1rem 1.2rem;
  border-radius: 1rem;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(10, 11, 14, 0.92);
  width: min(640px, 92vw);
  margin: 0 auto;
  max-height: calc(100vh - 4rem);
  overflow-y: auto;
}

.modal__encabezado {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.modal__cerrar {
  border: none;
  background: rgba(148, 163, 184, 0.15);
  color: #f8fafc;
  border-radius: 0.6rem;
  width: 2rem;
  height: 2rem;
  font-size: 1.2rem;
  cursor: pointer;
}

.modal__acciones {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 0.75rem;
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

.form input,
.form select {
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

.exito {
  margin: 0;
  color: #86efac;
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
