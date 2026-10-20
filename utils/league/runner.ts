import {
  computeLeagueState,
  type LeagueComputationInput,
  type LeagueComputationResult,
} from '~/utils/league/engine'
import type { LeagueWorkerRequest, LeagueWorkerResponse } from '~/workers/league.worker'

type ProgressCallback = (current: number, total: number) => void

let worker: Worker | null = null
let workerUnavailable = false
let nextRequestId = 1

/** The computation itself failed (bad data), as opposed to the worker infrastructure. */
class LeagueComputationError extends Error {}

function getWorker() {
  if (workerUnavailable) return null
  if (worker) return worker

  try {
    worker = new Worker(new URL('../../workers/league.worker.ts', import.meta.url), { type: 'module' })
    return worker
  } catch {
    workerUnavailable = true
    return null
  }
}

/**
 * Computes the league state off the main thread so slow machines keep a responsive
 * UI. Falls back to the main thread (yielding between games) when module workers
 * are unavailable or fail.
 */
export async function runLeagueComputation(
  input: LeagueComputationInput,
  options: { onProgress?: ProgressCallback; cacheVersion?: string | null } = {},
): Promise<LeagueComputationResult> {
  const activeWorker = import.meta.client ? getWorker() : null

  if (activeWorker) {
    try {
      return await runInWorker(activeWorker, input, options.cacheVersion ?? null, options.onProgress)
    } catch (error) {
      if (error instanceof LeagueComputationError) throw error
      console.warn('[league] Worker computation failed, computing on the main thread instead.', error)
      worker?.terminate()
      worker = null
      workerUnavailable = true
    }
  }

  return computeLeagueState(input, { onProgress: options.onProgress, yieldEvery: 5 })
}

function runInWorker(
  activeWorker: Worker,
  input: LeagueComputationInput,
  cacheVersion: string | null,
  onProgress?: ProgressCallback,
) {
  const id = nextRequestId++

  return new Promise<LeagueComputationResult>((resolve, reject) => {
    const cleanup = () => {
      activeWorker.removeEventListener('message', onMessage)
      activeWorker.removeEventListener('error', onError)
    }
    const onMessage = (event: MessageEvent<LeagueWorkerResponse>) => {
      const message = event.data
      if (message.id !== id) return

      if (message.type === 'progress') {
        onProgress?.(message.current, message.total)
        return
      }

      cleanup()
      if (message.type === 'result') resolve(message.result)
      else reject(new LeagueComputationError(message.message))
    }
    const onError = (event: ErrorEvent) => {
      cleanup()
      reject(event.error ?? new Error(event.message || 'League worker failed'))
    }

    activeWorker.addEventListener('message', onMessage)
    activeWorker.addEventListener('error', onError)
    activeWorker.postMessage({ id, input, cacheVersion } satisfies LeagueWorkerRequest)
  })
}
