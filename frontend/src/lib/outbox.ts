import { useEffect, useState } from 'react'
import { api, ApiError, apiUpload } from './api'

/**
 * Fila de envios sem internet (academia sem sinal).
 * Guarda no aparelho (IndexedDB) o treino concluído e o check-in (com foto) e envia
 * sozinho quando a conexão volta. Ordem garantida: o check-in espera o treino ao qual
 * está ligado (sessionRef) ser salvo primeiro.
 */
export type Job =
  | { id: string; kind: 'session'; ref: string; body: Record<string, unknown>; createdAt: number }
  | { id: string; kind: 'checkin'; fields: Record<string, string>; sessionRef?: string; photo?: Blob; createdAt: number }

const DB = 'dt-outbox'
const JOBS = 'jobs'
const REFS = 'refs'

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(JOBS, { keyPath: 'id' })
      req.result.createObjectStore(REFS)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const r = fn(db.transaction(store, mode).objectStore(store))
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}

const emit = async () => window.dispatchEvent(new CustomEvent('dt:outbox', { detail: await pendingCount() }))

/** Omit que respeita a união (session | checkin). */
type NewJob = Job extends infer J ? (J extends Job ? Omit<J, 'id' | 'createdAt'> : never) : never

export const newRef = () => `ref-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

export async function enqueue(job: NewJob) {
  await tx(JOBS, 'readwrite', (s) => s.put({ ...job, id: newRef(), createdAt: Date.now() }))
  await emit()
}

export async function pendingCount(): Promise<number> {
  try {
    return await tx(JOBS, 'readonly', (s) => s.count())
  } catch {
    return 0
  }
}

/** ID do treino já salvo para uma referência (ou undefined se ainda pendente). */
export async function resolveRef(ref: string): Promise<number | undefined> {
  return tx<number | undefined>(REFS, 'readonly', (s) => s.get(ref) as IDBRequest<number | undefined>)
}

export const isOffline = (e: unknown) => e instanceof ApiError && e.status === 0

let flushing = false

/** Envia o que estiver pendente. Retorna quantos itens foram enviados. */
export async function flush(): Promise<number> {
  if (flushing || !navigator.onLine) return 0
  flushing = true
  let sent = 0
  try {
    const jobs = (await tx<Job[]>(JOBS, 'readonly', (s) => s.getAll() as IDBRequest<Job[]>)).sort((a, b) => a.createdAt - b.createdAt)
    for (const job of jobs) {
      try {
        if (job.kind === 'session') {
          const r = await api<{ session: { id: number } }>('/workout-sessions', { method: 'POST', body: job.body })
          await tx(REFS, 'readwrite', (s) => s.put(r.session.id, job.ref))
        } else {
          const form = new FormData()
          Object.entries(job.fields).forEach(([k, v]) => form.append(k, v))
          if (job.sessionRef) {
            const id = await resolveRef(job.sessionRef)
            if (id === undefined) continue // o treino ainda não foi salvo: tenta depois
            form.append('session_id', String(id))
          }
          if (job.photo) form.append('photo', job.photo, 'checkin.jpg')
          await apiUpload('/checkins', form)
        }
        await tx(JOBS, 'readwrite', (s) => s.delete(job.id))
        sent++
      } catch (e) {
        if (isOffline(e)) break // sem internet de novo: para e tenta mais tarde
        if (e instanceof ApiError && e.status >= 400 && e.status < 500 && e.status !== 401 && e.status !== 429) {
          await tx(JOBS, 'readwrite', (s) => s.delete(job.id)) // dado inválido: descarta para não travar a fila
        }
      }
    }
  } finally {
    flushing = false
    await emit()
  }
  return sent
}

/** Quantidade de envios pendentes (atualiza sozinho). */
export function useOutboxCount() {
  const [n, setN] = useState(0)
  useEffect(() => {
    pendingCount().then(setN)
    const on = (e: Event) => setN((e as CustomEvent<number>).detail)
    window.addEventListener('dt:outbox', on)
    return () => window.removeEventListener('dt:outbox', on)
  }, [])
  return n
}
