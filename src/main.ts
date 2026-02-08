import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import { initOfflineQueue, processOfflineQueue } from './utils/offline'

const shouldSelectText = (target: EventTarget | null): target is HTMLInputElement | HTMLTextAreaElement => {
  if (!target) return false
  if (target instanceof HTMLTextAreaElement) return !target.readOnly && !target.disabled
  if (!(target instanceof HTMLInputElement)) return false
  if (target.readOnly || target.disabled) return false
  const tiposExcluidos = new Set(['button', 'checkbox', 'radio', 'file', 'submit', 'reset', 'color', 'range'])
  return !tiposExcluidos.has(target.type)
}

window.addEventListener('focusin', (event) => {
  const target = event.target
  if (!shouldSelectText(target)) return
  window.setTimeout(() => target.select(), 0)
})

createApp(App).mount('#app').$nextTick(() => {
  initOfflineQueue()
  void processOfflineQueue()
  // Use contextBridge
  window.ipcRenderer.on('main-process-message', (_event, message) => {
    console.log(message)
  })
})
