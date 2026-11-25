import { AnimatePresence, motion, Reorder } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ExerciseImage } from '../components/ExerciseImage'
import { ExercisePicker } from '../components/ExercisePicker'
import { Ring } from '../components/Ring'
import { SetsSheet } from '../components/SetsSheet'
import { isTimed, minutesOf, prescription } from '../lib/workout'
import { useToast } from '../components/Toast'
import { Alert, Button, Spinner } from '../components/ui'
import { api, ApiError } from '../lib/api'
import {
  clearRun, clock, durationLabel, loadRun, newRun, REST_OPTIONS, restDoneAlert, unlockAudio, useNow, useRun, useWakeLock,
  type RunItem, type RunState,
} from '../lib/run'
import type { Exercise, Workout, WorkoutSessionData } from '../lib/types'

const restLabel = (s: number) => (s < 60 ? `${s} s` : s % 60 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${s / 60} min`)

/**
 * Executar um treino da ficha:
 * prep (ajustar só para hoje) → active (cronômetro, séries, descanso) → finished (resumo + check-in).
 */
export function WorkoutSessionPage() {
  const { id } = useParams()
  const workoutId = Number(id)
  const navigate = useNavigate()
  const { run, setRun, start } = useRun(() => {
    const saved = loadRun()
    return saved && saved.workoutId === workoutId ? saved : null
  })
  const [other, setOther] = useState<RunState | null>(() => {
    const saved = loadRun()
    return saved && saved.workoutId !== workoutId && saved.phase !== 'finished' ? saved : null
  })
  const [error, setError] = useState<string | null>(null)

  // Sem treino salvo para esta ficha: carrega a ficha e cria a cópia de hoje
  useEffect(() => {
    if (run || other) return
    api<{ workout: Workout }>(`/workouts/${workoutId}`)
      .then((r) => start(newRun(r.workout)))
      .catch((e: ApiError) => setError(e.message))
  }, [run, other, workoutId, start])

  if (other) {
    return (
      <div className="safe-top mx-auto flex min-h-full max-w-lg flex-col justify-center gap-4 px-6 text-center">
        <p className="text-4xl">⏱️</p>
        <p className="text-lg font-semibold">Você tem um treino em andamento</p>
        <p className="text-muted">“{other.workoutName}” ainda não foi finalizado.</p>
        <Button onClick={() => navigate(`/treinos/${other.workoutId}/iniciar`, { replace: true })}>Continuar “{other.workoutName}”</Button>
        <Button
          variant="danger"
          onClick={() => {
            if (!confirm('Descartar o treino em andamento? O progresso dele será perdido.')) return
            clearRun()
            setOther(null)
          }}
        >
          Descartar e iniciar este
        </Button>
      </div>
    )
  }

  if (error) return <div className="p-6"><Alert>{error}</Alert></div>
  if (!run) return <Spinner />

  if (run.phase === 'prep') return <PrepView run={run} setRun={setRun} />
  if (run.phase === 'active') return <ActiveView run={run} setRun={setRun} />
  return <FinishedView run={run} setRun={setRun} />
}

type SetRun = (fn: (r: RunState) => RunState) => void

/* ───────────────────────── Preparação ───────────────────────── */

function PrepView({ run, setRun }: { run: RunState; setRun: SetRun }) {
  const navigate = useNavigate()
  const [picking, setPicking] = useState(false)
  const [editing, setEditing] = useState<{ item: RunItem; index: number | null } | null>(null)

  const setItems = (items: RunItem[]) => setRun((r) => ({ ...r, items }))

  const begin = () => {
    unlockAudio()
    setRun((r) => ({ ...r, phase: 'active', startedAt: Date.now() }))
  }

  const cancel = () => {
    clearRun()
    navigate('/treinos', { replace: true })
  }

  return (
    <div className="safe-top mx-auto max-w-lg px-5 pt-4 pb-32">
      <header className="mb-2 flex items-center gap-3">
        <button onClick={cancel} aria-label="Cancelar" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-2xl text-primary shadow-sm">‹</button>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted uppercase">Iniciar treino</p>
          <h1 className="truncate text-xl font-bold">{run.workoutName}</h1>
        </div>
      </header>
      <p className="mb-4 rounded-2xl bg-lavender/10 px-4 py-3 text-sm text-violet">
        Ajuste o que quiser para hoje: séries, repetições, ordem, tirar ou incluir exercícios. <strong>Sua ficha não muda.</strong>
      </p>

      <Reorder.Group axis="y" values={run.items} onReorder={setItems} className="space-y-2">
        {run.items.map((it, idx) => (
          <Reorder.Item key={it.key} value={it} className="touch-none">
            <div className="flex items-center gap-3 rounded-2xl bg-surface p-2 pr-3 shadow-[0_2px_12px_-4px_rgba(31,23,36,0.08)]">
              <span className="cursor-grab pl-1 text-lg text-muted select-none" aria-hidden>⋮⋮</span>
              <ExerciseImage image={it.exercise.image} name={it.exercise.name} size={48} animate={false} />
              <button onClick={() => setEditing({ item: it, index: idx })} className="min-w-0 flex-1 text-left">
                <p className="truncate text-sm font-medium">{it.exercise.name}</p>
                <p className="text-xs font-semibold text-primary">{prescription(it)}</p>
              </button>
              <button aria-label={`Tirar ${it.exercise.name} de hoje`} onClick={() => setItems(run.items.filter((_, j) => j !== idx))} className="text-xl text-muted">×</button>
            </div>
          </Reorder.Item>
        ))}
      </Reorder.Group>

      <button onClick={() => setPicking(true)} className="mt-3 w-full rounded-2xl border-2 border-dashed border-line py-4 text-sm font-semibold text-primary">
        + Incluir exercício hoje
      </button>

      <div className="mt-6">
        <p className="mb-2 text-sm font-medium text-muted">Descanso entre séries</p>
        <RestChips value={run.restSeconds} onChange={(s) => setRun((r) => ({ ...r, restSeconds: s }))} />
      </div>

      <div className="safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/90 backdrop-blur-lg">
        <div className="mx-auto max-w-lg px-5 py-3">
          <Button onClick={begin} disabled={run.items.length === 0}>▶ Começar treino</Button>
        </div>
      </div>

      <ExercisePicker
        open={picking}
        onClose={() => setPicking(false)}
        onPick={(e: Exercise) => {
          setPicking(false)
          setEditing({ item: { key: `n-${Date.now()}`, exercise: e, sets: 3, reps: '12', notes: null, setsDone: 0, done: false }, index: null })
        }}
      />
      <SetsSheet
        item={editing?.item ?? null}
        isNew={editing?.index === null}
        saveLabel={editing && editing.index !== null ? 'Salvar para hoje' : undefined}
        onClose={() => setEditing(null)}
        onSave={(v) => {
          const it = { ...editing!.item, sets: v.sets, reps: v.reps, setsDone: Math.min(editing!.item.setsDone, v.sets) }
          if (editing?.index === null) setItems([...run.items, it])
          else setItems(run.items.map((x, j) => (j === editing!.index ? it : x)))
          setEditing(null)
        }}
      />
    </div>
  )
}

function RestChips({ value, onChange }: { value: number; onChange: (s: number) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {REST_OPTIONS.map((s) => (
        <button key={s} onClick={() => onChange(s)} className={`rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${value === s ? 'bg-primary text-white' : 'bg-soft'}`}>
          {restLabel(s)}
        </button>
      ))}
    </div>
  )
}

/* ───────────────────────── Em andamento ───────────────────────── */

function ActiveView({ run, setRun }: { run: RunState; setRun: SetRun }) {
  const toast = useToast()
  const now = useNow(true)
  useWakeLock(true)
  const alerted = useRef<number | null>(null)

  const doneCount = run.items.filter((i) => i.done).length
  const resting = run.restEndsAt !== null && run.restEndsAt > now

  // Fim do descanso: avisa uma vez e limpa
  useEffect(() => {
    if (run.restEndsAt !== null && run.restEndsAt <= now && alerted.current !== run.restEndsAt) {
      alerted.current = run.restEndsAt
      restDoneAlert()
      setRun((r) => ({ ...r, restEndsAt: null }))
    }
  }, [now, run.restEndsAt, setRun])

  const finish = () =>
    setRun((r) => ({ ...r, phase: 'finished', finishedAt: Date.now(), current: null, restEndsAt: null, timerKey: null, timerEndsAt: null, timerLeftMs: null }))

  /* ── Cardio por tempo ── */
  const finishTimed = (key: string) =>
    setRun((r) => {
      const items = r.items.map((x) => (x.key === key ? { ...x, setsDone: 1, done: true } : x))
      const allDone = items.every((x) => x.done)
      return { ...r, items, current: null, timerKey: null, timerEndsAt: null, timerLeftMs: null, ...(allDone ? { phase: 'finished' as const, finishedAt: Date.now() } : {}) }
    })
  const startTimer = (it: RunItem) => {
    unlockAudio()
    setRun((r) => ({ ...r, timerKey: it.key, timerEndsAt: Date.now() + minutesOf(it.reps) * 60_000, timerLeftMs: null }))
  }
  const pauseTimer = () => setRun((r) => (r.timerEndsAt ? { ...r, timerLeftMs: Math.max(0, r.timerEndsAt - Date.now()), timerEndsAt: null } : r))
  const resumeTimer = () => {
    unlockAudio()
    setRun((r) => (r.timerLeftMs != null ? { ...r, timerEndsAt: Date.now() + r.timerLeftMs, timerLeftMs: null } : r))
  }
  const timerAlerted = useRef<number | null>(null)
  useEffect(() => {
    if (run.timerKey && run.timerEndsAt && run.timerEndsAt <= now && timerAlerted.current !== run.timerEndsAt) {
      timerAlerted.current = run.timerEndsAt
      restDoneAlert()
      const it = run.items.find((x) => x.key === run.timerKey)
      if (it) toast({ text: `✓ ${it.exercise.name}: tempo concluído!` })
      finishTimed(run.timerKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, run.timerEndsAt, run.timerKey])

  const completeSet = (index: number) => {
    unlockAudio()
    navigator.vibrate?.(40)
    const it = run.items[index]
    const setsDone = it.setsDone + 1
    const done = setsDone >= it.sets
    const items = run.items.map((x, j) => (j === index ? { ...x, setsDone, done } : x))
    const allDone = items.every((x) => x.done)

    if (done) toast({ text: `✓ ${it.exercise.name}: feito!` })
    setRun((r) => ({
      ...r,
      items,
      current: done ? null : index,
      restEndsAt: done ? null : Date.now() + r.restSeconds * 1000,
      ...(allDone ? { phase: 'finished' as const, finishedAt: Date.now() } : {}),
    }))
  }

  const finishExercise = (index: number) => {
    const items = run.items.map((x, j) => (j === index ? { ...x, done: true } : x))
    const allDone = items.every((x) => x.done)
    setRun((r) => ({ ...r, items, current: null, restEndsAt: null, ...(allDone ? { phase: 'finished' as const, finishedAt: Date.now() } : {}) }))
  }

  const askFinish = () => {
    const pending = run.items.length - doneCount
    if (pending > 0 && !confirm(`Ainda ${pending === 1 ? 'falta 1 exercício' : `faltam ${pending} exercícios`}. Finalizar o treino assim mesmo?`)) return
    finish()
  }

  const cur = run.current !== null ? run.items[run.current] : null

  return (
    <div className="mx-auto max-w-lg pb-32">
      {/* Topo: treino e progresso (o tempo é medido em segundo plano e aparece no resumo/check-in) */}
      <div className="safe-top sticky top-0 z-10 bg-gradient-to-br from-orchid to-violet px-5 pt-4 pb-5 text-white shadow-lg">
        <p className="text-xs font-medium text-white/80 uppercase">Treino em andamento</p>
        <p className="line-clamp-2 text-2xl leading-tight font-bold">{run.workoutName}</p>
        <div className="mt-3 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/25">
            <motion.div className="h-full rounded-full bg-white" animate={{ width: `${(doneCount / Math.max(run.items.length, 1)) * 100}%` }} />
          </div>
          <p className="shrink-0 text-sm font-semibold">{doneCount}/{run.items.length} exercícios</p>
        </div>
      </div>

      <ol className="space-y-2 px-5 pt-4">
        {run.items.map((it, idx) => (
          <li key={it.key}>
            <div className={`flex items-center gap-3 rounded-[var(--radius-card)] p-3 shadow-[0_2px_12px_-4px_rgba(31,23,36,0.08)] ${it.done ? 'bg-soft/70' : 'bg-surface'}`}>
              <div className="relative">
                <ExerciseImage image={it.exercise.image} name={it.exercise.name} size={56} animate={false} />
                {it.done && (
                  <span className="absolute inset-0 flex items-center justify-center rounded-2xl bg-primary/80 text-2xl text-white" aria-label="Feito">✓</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className={`truncate font-semibold ${it.done ? 'text-muted line-through' : ''}`}>{it.exercise.name}</p>
                <p className="text-sm text-muted">
                  {prescription(it)}
                  {it.setsDone > 0 && !it.done && !isTimed(it) && <span className="ml-2 font-semibold text-primary">{it.setsDone}/{it.sets} séries</span>}
                  {run.timerKey === it.key && !it.done && <span className="ml-2 font-semibold text-primary">⏱ {clock(run.timerEndsAt ? run.timerEndsAt - now + 999 : (run.timerLeftMs ?? 0))}{run.timerLeftMs ? ' (pausado)' : ''}</span>}
                </p>
              </div>
              {!it.done && (
                <button
                  onClick={() => setRun((r) => ({ ...r, current: idx }))}
                  className="shrink-0 rounded-xl bg-primary px-3.5 py-2 text-sm font-semibold text-white active:scale-95"
                >
                  {it.setsDone > 0 || run.timerKey === it.key ? 'Continuar' : 'Iniciar'}
                </button>
              )}
            </div>
          </li>
        ))}
      </ol>

      <div className="safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/90 backdrop-blur-lg">
        <div className="mx-auto max-w-lg px-5 py-3">
          <Button variant="ghost" onClick={askFinish}>Finalizar treino</Button>
        </div>
      </div>

      {/* Execução do exercício */}
      <AnimatePresence>
        {cur && run.current !== null && isTimed(cur) && (
          <TimedRunner
            key={cur.key}
            item={cur}
            now={now}
            active={run.timerKey === cur.key}
            endsAt={run.timerKey === cur.key ? (run.timerEndsAt ?? null) : null}
            leftMs={run.timerKey === cur.key ? (run.timerLeftMs ?? null) : null}
            otherRunning={!!run.timerKey && run.timerKey !== cur.key}
            onStart={() => startTimer(cur)}
            onPause={pauseTimer}
            onResume={resumeTimer}
            onFinish={() => finishTimed(cur.key)}
            onClose={() => setRun((r) => ({ ...r, current: null }))}
          />
        )}
        {cur && run.current !== null && !isTimed(cur) && (
          <ExerciseRunner
            key={cur.key}
            item={cur}
            now={now}
            resting={resting}
            restEndsAt={run.restEndsAt}
            restSeconds={run.restSeconds}
            onCompleteSet={() => completeSet(run.current!)}
            onFinishExercise={() => finishExercise(run.current!)}
            onAdjustRest={(delta) => setRun((r) => ({ ...r, restEndsAt: r.restEndsAt ? Math.max(Date.now(), r.restEndsAt + delta * 1000) : r.restEndsAt }))}
            onSkipRest={() => setRun((r) => ({ ...r, restEndsAt: null }))}
            // Trocar o descanso padrão durante um descanso recomeça a contagem com o novo tempo
            onRestDefault={(s) => setRun((r) => ({ ...r, restSeconds: s, restEndsAt: r.restEndsAt && r.restEndsAt > Date.now() ? Date.now() + s * 1000 : r.restEndsAt }))}
            onClose={() => setRun((r) => ({ ...r, current: null }))}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

/** Cardio por tempo: contagem regressiva com pausar/continuar. */
function TimedRunner(props: {
  item: RunItem
  now: number
  active: boolean
  endsAt: number | null
  leftMs: number | null
  otherRunning: boolean
  onStart: () => void
  onPause: () => void
  onResume: () => void
  onFinish: () => void
  onClose: () => void
}) {
  const { item, now, endsAt, leftMs } = props
  const total = minutesOf(item.reps) * 60_000
  const running = endsAt !== null
  const paused = !running && leftMs !== null
  const remaining = running ? Math.max(0, endsAt - now) : paused ? leftMs : total

  return (
    <motion.div
      className="fixed inset-0 z-40 overflow-y-auto bg-bg"
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 380, damping: 38 }}
    >
      <div className="safe-top mx-auto flex min-h-full max-w-lg flex-col px-5 pt-4 pb-8">
        <header className="mb-4 flex items-center gap-3">
          <button onClick={props.onClose} aria-label="Voltar para a lista" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-xl text-primary shadow-sm">⌄</button>
          <h2 className="min-w-0 flex-1 truncate text-lg font-bold">{item.exercise.name}</h2>
        </header>

        <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
          <ExerciseImage image={item.exercise.image} name={item.exercise.name} size={120} animate={running} />
          <Ring value={remaining} max={total} size={230} stroke={14} color="var(--color-orchid)">
            <span className="font-mono text-5xl font-bold tabular-nums" role="timer" aria-live="off">{clock(remaining + (running ? 999 : 0))}</span>
            <span className="text-sm text-muted">{running ? 'restantes' : paused ? 'pausado' : `meta: ${minutesOf(item.reps)} min`}</span>
          </Ring>
          {item.notes && <p className="rounded-2xl bg-soft px-3 py-2 text-sm">📝 {item.notes}</p>}
          {props.otherRunning && <p className="text-sm text-muted">Há outro cronômetro em andamento; ao iniciar este, ele é substituído.</p>}
        </div>

        <div className="mt-6 space-y-3">
          {running ? (
            <Button variant="ghost" onClick={props.onPause} className="!h-14 text-lg">⏸ Pausar</Button>
          ) : paused ? (
            <Button onClick={props.onResume} className="!h-14 text-lg">▶ Continuar</Button>
          ) : (
            <Button onClick={props.onStart} className="!h-14 text-lg">▶ Iniciar {minutesOf(item.reps)} min</Button>
          )}
          <button onClick={props.onFinish} className="w-full py-2 text-sm font-medium text-muted underline-offset-2 hover:underline">
            {running || paused ? 'Concluir agora' : 'Marcar como feito'}
          </button>
          {running && <p className="text-center text-xs text-muted">Pode voltar para a lista: o cronômetro continua e avisa no fim.</p>}
        </div>
      </div>
    </motion.div>
  )
}

function ExerciseRunner(props: {
  item: RunItem
  now: number
  resting: boolean
  restEndsAt: number | null
  restSeconds: number
  onCompleteSet: () => void
  onFinishExercise: () => void
  onAdjustRest: (deltaSeconds: number) => void
  onSkipRest: () => void
  onRestDefault: (s: number) => void
  onClose: () => void
}) {
  const { item, now, resting, restEndsAt, restSeconds } = props
  const remaining = resting && restEndsAt ? restEndsAt - now : 0
  const nextSet = Math.min(item.setsDone + 1, item.sets)

  return (
    <motion.div
      className="fixed inset-0 z-40 overflow-y-auto bg-bg"
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 380, damping: 38 }}
    >
      <div className="safe-top mx-auto flex min-h-full max-w-lg flex-col px-5 pt-4 pb-8">
        <header className="mb-4 flex items-center gap-3">
          <button onClick={props.onClose} aria-label="Voltar para a lista" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-xl text-primary shadow-sm">⌄</button>
          <h2 className="min-w-0 flex-1 truncate text-lg font-bold">{item.exercise.name}</h2>
        </header>

        {/* Séries: bolinhas */}
        <div className="mb-4 flex justify-center gap-2" aria-label={`${item.setsDone} de ${item.sets} séries feitas`}>
          {Array.from({ length: item.sets }).map((_, i) => (
            <span key={i} className={`h-2.5 w-8 rounded-full transition-colors ${i < item.setsDone ? 'bg-primary' : 'bg-line'}`} />
          ))}
        </div>

        <AnimatePresence mode="wait">
          {resting ? (
            <motion.div key="rest" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
              <p className="text-sm font-semibold tracking-wide text-muted uppercase">Descanso</p>
              <Ring value={remaining} max={restSeconds * 1000} size={220} stroke={14} color="var(--color-lavender)">
                <span className="font-mono text-5xl font-bold tabular-nums" role="timer" aria-live="off">{clock(remaining + 999)}</span>
                <span className="text-sm text-muted">próxima: série {nextSet} de {item.sets}</span>
              </Ring>
              <div className="flex gap-3">
                <button onClick={() => props.onAdjustRest(-15)} className="rounded-2xl bg-soft px-5 py-3 font-semibold text-primary active:scale-95">−15 s</button>
                <button onClick={() => props.onAdjustRest(15)} className="rounded-2xl bg-soft px-5 py-3 font-semibold text-primary active:scale-95">+15 s</button>
              </div>
              <Button onClick={props.onSkipRest} className="max-w-xs">Pular descanso</Button>
              <div>
                <p className="mb-2 text-xs text-muted">Descanso padrão</p>
                <RestChips value={restSeconds} onChange={props.onRestDefault} />
              </div>
            </motion.div>
          ) : (
            <motion.div key="set" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex flex-1 flex-col items-center gap-5 text-center">
              <ExerciseImage image={item.exercise.image} name={item.exercise.name} size={240} />
              <div>
                <p className="text-sm font-semibold tracking-wide text-muted uppercase">Série {nextSet} de {item.sets}</p>
                <p className="mt-1 text-5xl font-bold text-primary">{item.reps}</p>
                <p className="text-sm text-muted">{/^\d/.test(item.reps) && !/s$/.test(item.reps) ? 'repetições' : ''}</p>
                {item.notes && <p className="mt-2 rounded-2xl bg-soft px-3 py-2 text-sm">📝 {item.notes}</p>}
              </div>
              <div className="mt-auto w-full space-y-3">
                <Button onClick={props.onCompleteSet} className="!h-16 text-lg">
                  ✓ Concluir série {nextSet}
                </Button>
                <button onClick={props.onFinishExercise} className="w-full py-2 text-sm font-medium text-muted underline-offset-2 hover:underline">
                  Encerrar este exercício
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

/* ───────────────────────── Finalizado ───────────────────────── */

function FinishedView({ run, setRun }: { run: RunState; setRun: SetRun }) {
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const seconds = Math.round(((run.finishedAt ?? Date.now()) - (run.startedAt ?? Date.now())) / 1000)
  const done = run.items.filter((i) => i.done && i.setsDone > 0)
  const totalSets = run.items.filter((i) => !isTimed(i)).reduce((a, i) => a + i.setsDone, 0)

  // Salva o treino no servidor (uma vez); fica registrado mesmo sem check-in
  const save = async () => {
    if (run.sessionId) return
    setSaving(true)
    setError(null)
    try {
      const r = await api<{ session: WorkoutSessionData }>('/workout-sessions', {
        method: 'POST',
        body: {
          workout_id: run.workoutId,
          workout_name: run.workoutName,
          started_at: new Date(run.startedAt!).toISOString(),
          finished_at: new Date(run.finishedAt!).toISOString(),
          exercises: run.items.map((i) => ({
            name: i.exercise.name,
            muscle_group: i.exercise.muscle_group,
            image: i.exercise.image,
            sets: i.sets,
            reps: i.reps,
            sets_done: i.setsDone,
            done: i.done && i.setsDone > 0,
          })),
        },
      })
      setRun((s) => ({ ...s, sessionId: r.session.id }))
    } catch (e) {
      setError((e as ApiError).message)
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    save()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const leave = (to: string) => {
    clearRun()
    navigate(to, { replace: true })
  }

  return (
    <div className="safe-top mx-auto flex min-h-full max-w-lg flex-col px-5 pt-10 pb-8">
      <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 220, damping: 14 }} className="text-center">
        <p className="text-6xl">🎉</p>
        <h1 className="mt-3 text-2xl font-bold">Treino concluído!</h1>
        <p className="text-muted">{run.workoutName}</p>
      </motion.div>

      <div className="mt-6 grid grid-cols-3 gap-2 text-center">
        <SummaryStat icon="⏱️" value={durationLabel(seconds)} label="de treino" />
        <SummaryStat icon="💪" value={`${done.length}/${run.items.length}`} label="exercícios" />
        <SummaryStat icon="🔁" value={String(totalSets)} label="séries" />
      </div>

      <ul className="mt-5 space-y-1.5">
        {run.items.map((i) => (
          <li key={i.key} className="flex items-center justify-between rounded-xl bg-surface px-4 py-2.5 text-sm">
            <span className={`truncate ${i.done && i.setsDone > 0 ? '' : 'text-muted line-through'}`}>{i.exercise.name}</span>
            <span className="shrink-0 pl-2 text-muted">{isTimed(i) ? `${i.done ? '✓ ' : ''}${minutesOf(i.reps)} min` : `${i.setsDone}/${i.sets} × ${i.reps}`}</span>
          </li>
        ))}
      </ul>

      {error && (
        <div className="mt-4 space-y-2">
          <Alert>Não foi possível salvar o treino: {error}</Alert>
          <Button variant="ghost" onClick={save} loading={saving}>Tentar de novo</Button>
        </div>
      )}

      <div className="mt-auto space-y-3 pt-8">
        <Button onClick={() => leave(`/checkin?treino=${run.workoutId}&sessao=${run.sessionId}`)} disabled={!run.sessionId} loading={saving}>
          📸 Fazer check-in com foto
        </Button>
        <Button variant="ghost" onClick={() => leave('/treinos')} disabled={!run.sessionId && !error}>
          Agora não
        </Button>
      </div>
    </div>
  )
}

function SummaryStat({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <div className="rounded-2xl bg-surface p-3 shadow-[0_2px_12px_-4px_rgba(31,23,36,0.08)]">
      <p className="text-lg">{icon}</p>
      <p className="font-bold">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  )
}
