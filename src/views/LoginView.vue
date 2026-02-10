<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  error?: string
  loading?: boolean
}>()

const emit = defineEmits<{
  (e: 'login', payload: { usuario: string; contrasena: string }): void
}>()

const usuario = ref('')
const contrasena = ref('')
const mostrarClave = ref(false)
const localError = ref('')
const enviar = () => {
  localError.value = ''
  if (!usuario.value.trim() || !contrasena.value.trim()) {
    localError.value = 'Ingresa usuario y contraseña.'
    return
  }
  if (props.loading) {
    return
  }
  emit('login', { usuario: usuario.value.trim(), contrasena: contrasena.value })
}
</script>

<template>
  <main class="login">
    <section class="login__card">
      <header class="login__header">
        <div class="login__texto">
          <p class="login__marca">AutoServicio el Paisa</p>
          <p class="login__sub">Ingresa tu usuario y contrasena para continuar.</p>
        </div>
      </header>
      <form class="login__form" @submit.prevent="enviar">
        <label>
          <span>Usuario</span>
          <input v-model="usuario" type="text" autocomplete="username" />
        </label>        <label>
          <span>Contrasena</span>
          <div class="login__password">
            <input
              v-model="contrasena"
              :type="mostrarClave ? 'text' : 'password'"
              autocomplete="current-password"
            />
            <button type="button" class="login__toggle" @click="mostrarClave = !mostrarClave">
              {{ mostrarClave ? 'Ocultar' : 'Mostrar' }}
            </button>
          </div>
        </label>
        <button type="submit" class="login__boton" :disabled="loading">
          {{ loading ? 'Ingresando...' : 'Entrar' }}
        </button>
        <p v-if="localError || error" class="login__error">{{ localError || error }}</p>
      </form>
    </section>
  </main>
</template>

<style scoped>
.login {
  min-height: 70vh;
  display: grid;
  place-items: center;
  padding: 2rem 1rem;
  background: radial-gradient(circle at top, rgba(250, 204, 21, 0.12), transparent 50%);
}

.login__card {
  width: min(720px, 100%);
  padding: 1.5rem;
  border-radius: 1rem;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(12, 13, 16, 0.92);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5);
  display: grid;
  gap: 1.25rem;
}

.login__header h1 {
  margin: 0.2rem 0 0.4rem;
  font-size: 1.5rem;
}

.login__header {
  display: grid;
  gap: 0.75rem;
  align-items: center;
  justify-items: center;
  text-align: center;
}

.login__texto {
  display: grid;
  gap: 0.2rem;
}

.login__marca {
  margin: 0.1rem 0 0.3rem;
  font-size: clamp(1.6rem, 3.5vw, 2.4rem);
  font-weight: 800;
  color: #22c55e;
  letter-spacing: 0.02em;
}

.login__overline {
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  font-size: 0.7rem;
  color: #facc15;
}

.login__sub {
  margin: 0;
  color: #cbd5e1;
}

.login__form {
  display: grid;
  gap: 0.9rem;
}

.login__form label {
  display: grid;
  gap: 0.35rem;
  color: #e2e8f0;
  font-weight: 600;
}

.login__form input,
.login__form select {
  border-radius: 0.75rem;
  border: 1px solid rgba(148, 163, 184, 0.3);
  padding: 0.5rem 0.7rem;
  background: rgba(12, 13, 16, 0.92);
  color: #e2e8f0;
}

.login__form input {
  max-width: 260px;
}

.login__password {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.5rem;
  align-items: center;
  max-width: 260px;
}

.login__toggle {
  border: 1px solid rgba(148, 163, 184, 0.3);
  background: rgba(15, 23, 42, 0.4);
  color: #e2e8f0;
  border-radius: 0.6rem;
  padding: 0.4rem 0.6rem;
  font-weight: 600;
  cursor: pointer;
}

.login__toggle:hover,
.login__toggle:focus-visible {
  outline: none;
  border-color: rgba(250, 204, 21, 0.6);
}


.login__boton {
  border: none;
  border-radius: 0.75rem;
  padding: 0.7rem 1rem;
  font-weight: 700;
  cursor: pointer;
  color: #0b0d12;
  background: linear-gradient(120deg, #facc15, #fbbf24);
  box-shadow: 0 12px 25px rgba(0, 0, 0, 0.35);
}

.login__error {
  margin: 0;
  color: #f87171;
}
</style>
