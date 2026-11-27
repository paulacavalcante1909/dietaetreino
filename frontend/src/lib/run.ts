import { useCallback, useEffect, useState } from 'react'
import type { Exercise, Workout } from './types'

/**
 * Treino em execução ("Iniciar treino").
 * Fica salvo no aparelho: fechar o app ou bloquear a tela não perde o progresso.
 * Os tempos usam horários absolutos (timestamps), então o cronômetro segue certo em segundo plano.
 */
export interface RunItem {
  key: string
  exercise: Exercise
  sets: number
  reps: string
  notes: string | null
  setsDone: number
  loads?: (number | null)[] // carga (kg) registrada em cada série
  lastLoads?: number[] // cargas da última vez que fez este exercício
  distanceKm?: number | null // cardio: km percorridos
  done: boolean
}

export interface RunState {
  workoutId: number
  workoutName: string
  phase: 'prep' | 'active' | 'finished'
  items: RunItem[]
  startedAt: number | null
  finishedAt: number | null
  current: number | null // exercício aberto
  restEndsAt: number | null // fim do descanso atual
  restSeconds: number // descanso padrão entre séries
  sessionId: number | null // salvo no servidor
  sessionRef?: string | null // salvo na fila offline (enviado quando a internet voltar)
  kcalBurned?: number | null // estimativa calculada pelo servidor
  durationSeconds?: number | null // duração salva (inclui cardio feito fora do cronômetro)
  weightEstimated?: boolean
  timerKey?: string | null // cardio: exercício com cronômetro ativo/pausado
  timerEndsAt?: number | null // cardio: fim do cronômetro em andamento
  timerLeftMs?: number | null // cardio: tempo restante quando pausado
}

const KEY = 'dt_run'
const REST_KEY = 'dt_rest_seconds'

export const REST_OPTIONS = [30, 45, 60, 90, 120]

export function loadRun(): RunState | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as RunState) : null
  } catch {
    return null
  }
}

export function clearRun() {
  localStorage.removeItem(KEY)
}

/** Endereço do treino em andamento (avulso = sem ficha) */
export const runPath = (r: { workoutId: number }) => `/treinos/${r.workoutId || 'avulso'}/iniciar`

/** Nome de um treino avulso: os exercícios feitos (ex.: "Corrida + Prancha") */
export const looseName = (items: { exercise: { name: string } }[]) => items.map((i) => i.exercise.name).join(' + ').slice(0, 80) || 'Treino avulso'

export function newRun(w: Workout): RunState {
  return {
    workoutId: w.id,
    workoutName: w.name,
    phase: 'prep',
    items: w.items.map((i, n) => ({
      key: `${i.id ?? n}-${n}`,
      exercise: i.exercise,
      sets: i.sets,
      reps: i.reps,
      notes: i.notes,
      setsDone: 0,
      done: false,
    })),
    startedAt: null,
    finishedAt: null,
    current: null,
    restEndsAt: null,
    restSeconds: Number(localStorage.getItem(REST_KEY)) || 60,
    sessionId: null,
  }
}

/** Estado do treino com persistência automática. */
export function useRun(initial: () => RunState | null) {
  const [run, setRunState] = useState<RunState | null>(initial)

  const setRun = useCallback((fn: (r: RunState) => RunState) => {
    setRunState((r) => {
      if (!r) return r
      const next = fn(r)
      localStorage.setItem(KEY, JSON.stringify(next))
      if (next.restSeconds !== r.restSeconds) localStorage.setItem(REST_KEY, String(next.restSeconds))
      return next
    })
  }, [])

  const start = useCallback((r: RunState) => {
    localStorage.setItem(KEY, JSON.stringify(r))
    setRunState(r)
  }, [])

  return { run, setRun, start }
}

/** Relógio que atualiza a cada segundo (para cronômetros). */
export function useNow(active: boolean) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!active) return
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [active])
  return now
}

/** Mantém a tela acesa durante o treino (quando o navegador permite). */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    const request = () =>
      navigator.wakeLock
        .request('screen')
        .then((l) => (lock = l))
        .catch(() => {})
    request()
    const onVisible = () => document.visibilityState === 'visible' && request()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      lock?.release().catch(() => {})
    }
  }, [active])
}

let audio: AudioContext | null = null

/** Precisa ser chamado num toque (o navegador só libera som após interação). */
export function unlockAudio() {
  try {
    audio ??= new AudioContext()
    if (audio.state === 'suspended') audio.resume()
  } catch {
    /* sem áudio */
  }
}

/** Aviso de fim de descanso: vibração + dois bipes curtos. */
export function restDoneAlert() {
  navigator.vibrate?.([200, 100, 200])
  if (!audio) return
  ;[0, 0.25].forEach((t) => {
    const osc = audio!.createOscillator()
    const gain = audio!.createGain()
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.25, audio!.currentTime + t)
    gain.gain.exponentialRampToValueAtTime(0.001, audio!.currentTime + t + 0.18)
    osc.connect(gain).connect(audio!.destination)
    osc.start(audio!.currentTime + t)
    osc.stop(audio!.currentTime + t + 0.2)
  })
}

export function clock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}

/** "45 min", "1 h" (hora redonda), "1 h 25 min"; compacto (imagem do treino): "1h25" */
export function durationLabel(seconds: number, compact = false) {
  if (seconds < 60) return `${Math.max(0, Math.round(seconds))} s`
  const m = Math.round(seconds / 60)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const rest = m % 60
  if (rest === 0) return `${h} h`
  return compact ? `${h}h${String(rest).padStart(2, '0')}` : `${h} h ${rest} min`
}
