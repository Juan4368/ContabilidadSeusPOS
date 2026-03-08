const DB_NAME = 'seuspos_cache_db'
const DB_VERSION = 1
const STORE_NAME = 'cache_entries'
const PRODUCTOS_FALLBACK_KEY = 'productos_catalogo_cache_v1'

type CacheEntry<T> = {
  key: string
  value: T
  savedAt: number
}

const canUseIndexedDb = () =>
  typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined'

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    if (!canUseIndexedDb()) {
      reject(new Error('IndexedDB no disponible'))
      return
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('No se pudo abrir IndexedDB'))
  })

const runTransaction = async <T>(
  mode: IDBTransactionMode,
  execute: (store: IDBObjectStore) => Promise<T>
): Promise<T> => {
  const db = await openDb()
  try {
    const tx = db.transaction(STORE_NAME, mode)
    const store = tx.objectStore(STORE_NAME)
    const result = await execute(store)
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('Error en transaccion IndexedDB'))
      tx.onabort = () => reject(tx.error ?? new Error('Transaccion IndexedDB abortada'))
    })
    return result
  } finally {
    db.close()
  }
}

const requestToPromise = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Error en IndexedDB'))
  })

const parseLocalFallback = <T>(fallbackKey: string): T | null => {
  try {
    const raw = localStorage.getItem(fallbackKey)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export const readProductosCache = async <T>(key: string): Promise<T | null> => {
  try {
    const entry = await runTransaction('readonly', async (store) => {
      const data = await requestToPromise(store.get(key))
      return (data ?? null) as CacheEntry<T> | null
    })
    if (entry?.value != null) return entry.value
  } catch {
    // fallback below
  }

  const fallbackValue = parseLocalFallback<T>(PRODUCTOS_FALLBACK_KEY)
  if (fallbackValue == null) return null

  try {
    await writeProductosCache(key, fallbackValue)
    localStorage.removeItem(PRODUCTOS_FALLBACK_KEY)
  } catch {
    // Keep fallback data if migration fails
  }
  return fallbackValue
}

export const writeProductosCache = async <T>(key: string, value: T) => {
  const payload: CacheEntry<T> = {
    key,
    value,
    savedAt: Date.now()
  }
  try {
    await runTransaction('readwrite', async (store) => {
      await requestToPromise(store.put(payload))
      return null
    })
    return
  } catch {
    // fallback below
  }

  try {
    localStorage.setItem(PRODUCTOS_FALLBACK_KEY, JSON.stringify(value))
  } catch {
    // ignore storage failures
  }
}
