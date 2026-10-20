import {
  computeLeagueState,
  type LeagueComputationInput,
  type LeagueComputationResult,
} from '~/utils/league/engine'

export interface LeagueWorkerRequest {
  id: number
  input: LeagueComputationInput
  /** Identifies the app build; null disables the result cache (e.g. in dev). */
  cacheVersion: string | null
}

export type LeagueWorkerResponse =
  | { id: number; type: 'progress'; current: number; total: number }
  | { id: number; type: 'result'; result: LeagueComputationResult; fromCache: boolean }
  | { id: number; type: 'error'; message: string }

const DB_NAME = 'league-cache'
const STORE_NAME = 'results'
const ENTRY_KEY = 'latest'
const PROGRESS_STEP = 10

// Minimal typing for the dedicated worker scope (the project compiles against DOM types).
const scope = self as unknown as {
  postMessage(message: LeagueWorkerResponse): void
  onmessage: ((event: MessageEvent<LeagueWorkerRequest>) => void) | null
}

scope.onmessage = async (event: MessageEvent<LeagueWorkerRequest>) => {
  const { id, input, cacheVersion } = event.data
  const post = (message: LeagueWorkerResponse) => scope.postMessage(message)

  try {
    // The replay depends on its input, the scoring code (build) and the current day
    // (season boundaries), so all three are part of the cache key.
    const cacheKey = cacheVersion
      ? `${cacheVersion}:${new Date().toDateString()}:${hashString(JSON.stringify(input))}`
      : null

    if (cacheKey) {
      const cached = await readCachedResult(cacheKey)
      if (cached) {
        post({ id, type: 'result', result: cached, fromCache: true })
        return
      }
    }

    const result = await computeLeagueState(input, {
      onProgress: (current, total) => {
        if (current === total || current % PROGRESS_STEP === 0) {
          post({ id, type: 'progress', current, total })
        }
      },
    })
    post({ id, type: 'result', result, fromCache: false })

    if (cacheKey) await writeCachedResult(cacheKey, result)
  } catch (error) {
    post({ id, type: 'error', message: error instanceof Error ? error.message : String(error) })
  }
}

/** Fast non-cryptographic 53-bit hash (cyrb53) used to fingerprint the input. */
function hashString(value: string) {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index)
    h1 = Math.imul(h1 ^ code, 2654435761)
    h2 = Math.imul(h2 ^ code, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}

function openDatabase(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, 1)
      request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(null)
      request.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

async function readCachedResult(cacheKey: string): Promise<LeagueComputationResult | null> {
  const db = await openDatabase()
  if (!db) return null

  return new Promise((resolve) => {
    try {
      const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(ENTRY_KEY)
      request.onsuccess = () => {
        const entry = request.result as { key: string; result: LeagueComputationResult } | undefined
        resolve(entry?.key === cacheKey ? entry.result : null)
        db.close()
      }
      request.onerror = () => {
        resolve(null)
        db.close()
      }
    } catch {
      resolve(null)
      db.close()
    }
  })
}

async function writeCachedResult(cacheKey: string, result: LeagueComputationResult) {
  const db = await openDatabase()
  if (!db) return

  await new Promise<void>((resolve) => {
    try {
      // A single entry: only the most recent league state is ever useful.
      const transaction = db.transaction(STORE_NAME, 'readwrite')
      transaction.objectStore(STORE_NAME).put({ key: cacheKey, result }, ENTRY_KEY)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => resolve()
      transaction.onabort = () => resolve()
    } catch {
      resolve()
    }
  })
  db.close()
}
