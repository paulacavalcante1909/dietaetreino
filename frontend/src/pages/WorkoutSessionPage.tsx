import { ask } from '../components/Dialog'
import { Camera, Check, CloudUpload, Dumbbell, Flame, Pause, Pencil, Play, Timer, X } from 'lucide-react'
import { HoldToDragItem } from '../components/HoldToDrag'
import { enqueue, isOffline, newRef } from '../lib/outbox'
import { ExerciseRow, exerciseLine } from '../components/SessionSummary'
import { AnimatePresence, motion, Reorder } from 'framer-motion'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ExerciseImage } from '../components/ExerciseImage'
import { ExercisePicker } from '../components/ExercisePicker'
import { Ring } from '../components/Ring'
import { SetsSheet } from '../components/SetsSheet'
import { hasDistance, isTimed, minutesOf, prescription, secondsOf } from '../lib/workout'
import { useToast } from '../components/Toast'
import { Alert, BackButton, Button, Mascot, Spinner } from '../components/ui'
import { api, ApiError } from '../lib/api'
import {
  clearRun, clock, durationLabel, loadRun, looseName, newRun, REST_OPTIONS, runPath, restDoneAlert, unlockAudio, useNow, useRun, useWakeLock,
  type RunItem, type RunState,
} from '../lib/run'
import type { Exercise, Workout, WorkoutSessionData } from '../lib/types'

const restLabel = (s: number) => (s < 60 ? `${s} s` : s % 60 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${s / 60} min`)

/**
 * Executar um treino da ficha ou avulso (`/treinos/avulso/iniciar`):
 * prep (ajustar só para hoje) → active (cronômetro, séries, descanso; dá para editar) → finished (resumo).
 */
export function WorkoutSessionPage() {
  const { id } = useParams()
  const workoutId = id === 'avulso' ? 0 : Number(id)
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

  // Sem treino salvo: carrega a ficha (ou começa um avulso vazio) e cria a cópia de hoje
  useEffect(() => {
    if (run || other) return
    if (workoutId === 0) {
      start(newRun({ id: 0, name: 'Treino avulso', items: [] } as unknown as Workout))
      return
    }
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
        <Button onClick={() => navigate(runPath(other), { replace: true })}>Continuar “{other.workoutName}”</Button>
        <Button
          variant="danger"
          onClick={async () => {
            if (!(await ask({ title: 'Descartar o treino em andamento?', text: 'O progresso dele será perdido.', confirmLabel: 'Descartar', danger: true }))) return
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

/* ───────────────────────── Lista editável (antes e durante o treino) ───────────────────────── */

/**
 * Ajustar os exercícios de hoje: ordem, séries, tirar e incluir.
 * Durante o treino, mantém o que já foi feito (séries concluídas, cargas).
 */
function RunItemsEditor({ items, setItems, openPicker = false, onPickerClosedEmpty }: {
  items: RunItem[]
  setItems: (items: RunItem[]) => void
  openPicker?: boolean
  onPickerClosedEmpty?: () => void
}) {
  const [picking, setPicking] = useState(openPicker)
  const [editing, setEditing] = useState<{ item: RunItem; index: number | null } | null>(null)

  return (
    <>
      {items.length === 0 && (
        <p className="py-6 text-center text-sm text-muted">Nenhum exercício ainda.</p>
      )}
      <Reorder.Group axis="y" values={items} onReorder={setItems} className="space-y-2">
        {items.map((it, idx) => (
          <HoldToDragItem key={it.key} value={it}>
            <div className={`flex items-center gap-3 rounded-2xl p-2 pr-1 shadow-[0_2px_12px_-4px_rgba(31,23,36,0.08)] ${it.done ? 'bg-soft/70' : 'bg-surface'}`}>
              <ExerciseImage image={it.exercise.image} name={it.exercise.name} size={48} animate={false} />
              <button onClick={() => setEditing({ item: it, index: idx })} className="min-w-0 flex-1 text-left">
                <p className={`truncate text-sm font-medium ${it.done ? 'text-muted' : ''}`}>{it.exercise.name}</p>
                <p className="text-xs font-semibold text-link">
                  {prescription(it)}
                  {it.setsDone > 0 && !isTimed(it) && <span className="ml-1.5 font-normal text-muted">· {it.setsDone} feitas</span>}
                </p>
              </button>
              <button aria-label={`Tirar ${it.exercise.name} de hoje`} onClick={() => setItems(items.filter((_, j) => j !== idx))} className="flex size-10 shrink-0 items-center justify-center rounded-full text-muted active:bg-soft">
                <X className="size-5" />
              </button>
            </div>
          </HoldToDragItem>
        ))}
      </Reorder.Group>
      {items.length > 1 && <p className="mt-2 text-center text-xs text-muted">Segure um exercício e arraste para mudar a ordem.</p>}

      <button onClick={() => setPicking(true)} className="mt-3 w-full rounded-2xl border-2 border-dashed border-line py-4 text-sm font-semibold text-link">
        + {items.length ? 'Incluir exercício' : 'Escolher exercício'}
      </button>

      <ExercisePicker
        open={picking}
        onClose={() => {
          setPicking(false)
          if (items.length === 0) onPickerClosedEmpty?.()
        }}
        onPick={(e: Exercise) => {
          setPicking(false)
          setEditing({ item: { key: `n-${Date.now()}`, exercise: e, sets: 3, reps: '12', notes: null, setsDone: 0, done: false }, index: null })
        }}
      />
      <SetsSheet
        item={editing ? { ...editing.item, distance_km: editing.item.distanceKm ?? null } : null}
        isNew={editing?.index === null}
        withDistance
        saveLabel={editing && editing.index !== null ? 'Salvar para hoje' : undefined}
        onClose={() => setEditing(null)}
        onSave={(v) => {
          const old = editing!.item
          const timed = isTimed(v)
          const setsDone = timed ? old.setsDone : Math.min(old.setsDone, v.sets)
          const it: RunItem = {
            ...old,
            sets: v.sets,
            reps: v.reps,
            distanceKm: v.distance_km ?? null,
            setsDone,
            // Mais séries num exercício já feito: ele volta a ficar pendente
            done: timed ? old.done : setsDone > 0 && setsDone >= v.sets,
          }
          if (editing?.index === null) setItems([...items, it])
          else setItems(items.map((x, j) => (j === editing!.index ? it : x)))
          setEditing(null)
        }}
      />
    </>
  )
}

/* ───────────────────────── Preparação ───────────────────────── */

function PrepView({ run, setRun }: { run: RunState; setRun: SetRun }) {
  const navigate = useNavigate()
  const loose = run.workoutId === 0

  const setItems = (items: RunItem[]) => setRun((r) => ({ ...r, items }))

  const begin = () => {
    unlockAudio()
    setRun((r) => ({ ...r, phase: 'active', startedAt: Date.now(), ...(loose ? { workoutName: looseName(r.items) } : {}) }))
    // Última carga usada em cada exercício (pré-preenche a série)
    const names = run.items.filter((i) => !isTimed(i)).map((i) => `names[]=${encodeURIComponent(i.exercise.name)}`).join('&')
    if (names)
      api<{ last: Record<string, { loads: number[] }> }>(`/stats/loads?${names}`)
        .then((res) => setRun((r) => ({ ...r, items: r.items.map((i) => (res.last[i.exercise.name] ? { ...i, lastLoads: res.last[i.exercise.name].loads } : i)) })))
        .catch(() => {})
  }

  const cancel = () => {
    clearRun()
    if ((window.history.state?.idx ?? 0) > 0) navigate(-1)
    else navigate('/treinos', { replace: true })
  }

  return (
    <div className="safe-top mx-auto max-w-lg px-5 pt-4 pb-32">
      <header className="mb-2 flex items-center gap-3">
        <BackButton onClick={cancel} label="Cancelar" />
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted uppercase">{loose ? 'Treinar agora' : 'Iniciar treino'}</p>
          <h1 className="truncate text-xl font-bold">{loose ? 'Exercício avulso' : run.workoutName}</h1>
        </div>
      </header>
      <p className="mb-4 rounded-2xl bg-lavender/10 px-4 py-3 text-sm text-violet">
        {loose ? (
          'Escolha o que vai fazer hoje: um ou vários exercícios.'
        ) : (
          <>Ajuste o que quiser para hoje: séries, repetições, ordem, tirar ou incluir exercícios. <strong>Sua ficha não muda.</strong></>
        )}
      </p>

      <RunItemsEditor items={run.items} setItems={setItems} openPicker={loose && run.items.length === 0} onPickerClosedEmpty={loose ? cancel : undefined} />

      <div className="mt-6">
        <p className="mb-2 text-sm font-medium text-muted">Descanso entre séries</p>
        <RestChips value={run.restSeconds} onChange={(s) => setRun((r) => ({ ...r, restSeconds: s }))} />
      </div>

      <div className="safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/90 backdrop-blur-lg">
        <div className="mx-auto max-w-lg px-5 py-3">
          <Button onClick={begin} disabled={run.items.length === 0}><Play className="size-5 fill-current" /> Começar treino</Button>
        </div>
      </div>
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

  const completeSet = (index: number, kg: number | null) => {
    unlockAudio()
    navigator.vibrate?.(40)
    const it = run.items[index]
    const setsDone = it.setsDone + 1
    const done = setsDone >= it.sets
    const loads = [...(it.loads ?? [])]
    loads[it.setsDone] = kg
    const best = Math.max(0, ...(it.lastLoads ?? []))
    if (kg && best && kg > best && !(it.loads ?? []).some((v) => v != null && v > best)) toast({ text: `🏆 Recorde em ${it.exercise.name}: ${kg.toLocaleString('pt-BR')} kg!` })
    const items = run.items.map((x, j) => (j === index ? { ...x, setsDone, done, loads } : x))
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

  const askFinish = async () => {
    const pending = run.items.length - doneCount
    if (pending > 0 && !(await ask({ title: 'Finalizar o treino?', text: `Ainda ${pending === 1 ? 'falta 1 exercício' : `faltam ${pending} exercícios`}. Eles ficam marcados como pulados.`, confirmLabel: 'Finalizar assim mesmo', cancelLabel: 'Continuar treinando' }))) return
    finish()
  }

  const cur = run.current !== null ? run.items[run.current] : null
  const [editing, setEditing] = useState(false)

  // Editar no meio do treino: o progresso fica; se um exercício sair, o cronômetro dele para
  const setItems = (items: RunItem[]) =>
    setRun((r) => {
      const keep = r.timerKey && items.some((x) => x.key === r.timerKey)
      return {
        ...r,
        items,
        current: null,
        ...(keep ? {} : { timerKey: null, timerEndsAt: null, timerLeftMs: null }),
        ...(r.workoutId === 0 ? { workoutName: looseName(items) } : {}),
      }
    })

  if (editing)
    return (
      <div className="safe-top mx-auto max-w-lg px-5 pt-4 pb-32">
        <header className="mb-2 flex items-center gap-3">
          <BackButton onClick={() => setEditing(false)} label="Voltar ao treino" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted uppercase">Editar treino de hoje</p>
            <h1 className="truncate text-xl font-bold">{run.workoutName}</h1>
          </div>
        </header>
        <p className="mb-4 rounded-2xl bg-lavender/10 px-4 py-3 text-sm text-violet">
          O que você já fez continua salvo. O cronômetro do treino segue rodando. <strong>Sua ficha não muda.</strong>
        </p>
        <RunItemsEditor items={run.items} setItems={setItems} />
        <div className="safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/90 backdrop-blur-lg">
          <div className="mx-auto max-w-lg px-5 py-3">
            <Button onClick={() => setEditing(false)} disabled={run.items.length === 0}>
              <Play className="size-5 fill-current" /> Voltar ao treino
            </Button>
          </div>
        </div>
      </div>
    )

  return (
    <div className="mx-auto max-w-lg pb-32">
      {/* Topo: treino e progresso (o tempo é medido em segundo plano e aparece no resumo/check-in) */}
      <div className="safe-top sticky top-0 z-10 bg-gradient-to-br from-orchid to-primary px-5 pt-4 pb-5 text-white shadow-lg">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-white/80 uppercase">Treino em andamento</p>
            <p className="line-clamp-2 text-2xl leading-tight font-bold">{run.workoutName}</p>
          </div>
          <button onClick={() => setEditing(true)} className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/20 px-3.5 py-2 text-sm font-semibold active:bg-white/30">
            <Pencil className="size-4" /> Editar
          </button>
        </div>
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
                <p className={`truncate font-semibold ${it.done ? 'text-muted' : ''}`}>{it.exercise.name}</p>
                <p className="text-sm text-muted">
                  {prescription(it)}
                  {it.setsDone > 0 && !it.done && !isTimed(it) && <span className="ml-2 font-semibold text-link">{it.setsDone}/{it.sets} séries</span>}
                  {run.timerKey === it.key && !it.done && <span className="ml-2 font-semibold text-link">⏱ {clock(run.timerEndsAt ? run.timerEndsAt - now + 999 : (run.timerLeftMs ?? 0))}{run.timerLeftMs ? ' (pausado)' : ''}</span>}
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
            onDistance={(km) => setRun((r) => ({ ...r, items: r.items.map((x) => (x.key === cur.key ? { ...x, distanceKm: km } : x)) }))}
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
            onCompleteSet={(kg) => completeSet(run.current!, kg)}
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
  onDistance: (km: number | null) => void
  onClose: () => void
}) {
  const { item, now, endsAt, leftMs } = props
  const [km, setKm] = useState(item.distanceKm ? String(item.distanceKm).replace('.', ',') : '')
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
          <BackButton onClick={props.onClose} label="Voltar para a lista" icon="down" />
          <h2 className="min-w-0 flex-1 truncate text-lg font-bold">{item.exercise.name}</h2>
        </header>

        <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
          <ExerciseImage image={item.exercise.image} name={item.exercise.name} size={120} animate={running} />
          <Ring value={remaining} max={total} size={230} stroke={14} color="var(--color-orchid)">
            <span className="font-mono text-5xl font-bold tabular-nums" role="timer" aria-live="off">{clock(remaining + (running ? 999 : 0))}</span>
            <span className="text-sm text-muted">{running ? 'restantes' : paused ? 'pausado' : `meta: ${minutesOf(item.reps)} min`}</span>
          </Ring>
          {item.notes && <p className="rounded-2xl bg-soft px-3 py-2 text-sm">{item.notes}</p>}
          {props.otherRunning && <p className="text-sm text-muted">Há outro cronômetro em andamento; ao iniciar este, ele é substituído.</p>}
          {hasDistance(item.exercise) && (
            <label className="flex items-center gap-3 rounded-2xl bg-soft/70 px-4 py-2.5">
              <span className="text-sm font-medium">Distância</span>
              <input
                aria-label="Distância em km"
                inputMode="decimal"
                placeholder="opcional"
                value={km}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^\d.,]/g, '').slice(0, 6)
                  setKm(v)
                  const n = Number(v.replace(',', '.'))
                  props.onDistance(n > 0 ? Math.min(n, 500) : null)
                }}
                className="w-20 rounded-xl border border-line bg-surface py-1.5 text-center font-semibold outline-none focus:border-orchid"
              />
              <span className="text-sm text-muted">km</span>
            </label>
          )}
        </div>

        <div className="mt-6 space-y-3">
          {running ? (
            <Button variant="ghost" onClick={props.onPause} className="!h-14 text-lg"><Pause className="size-5 fill-current" /> Pausar</Button>
          ) : paused ? (
            <Button onClick={props.onResume} className="!h-14 text-lg"><Play className="size-5 fill-current" /> Continuar</Button>
          ) : (
            <Button onClick={props.onStart} className="!h-14 text-lg"><Play className="size-5 fill-current" /> Iniciar {minutesOf(item.reps)} min</Button>
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
  onCompleteSet: (kg: number | null) => void
  onFinishExercise: () => void
  onAdjustRest: (deltaSeconds: number) => void
  onSkipRest: () => void
  onRestDefault: (s: number) => void
  onClose: () => void
}) {
  const { item, now, resting, restEndsAt, restSeconds } = props
  const remaining = resting && restEndsAt ? restEndsAt - now : 0
  const nextSet = Math.min(item.setsDone + 1, item.sets)
  // Carga sugerida: a da série anterior hoje, senão a mesma série da última vez
  const suggested = item.loads?.[item.setsDone - 1] ?? item.lastLoads?.[item.setsDone] ?? item.lastLoads?.[item.lastLoads.length - 1] ?? null
  const [kg, setKg] = useState(suggested != null ? String(suggested).replace('.', ',') : '')
  useEffect(() => {
    setKg(suggested != null ? String(suggested).replace('.', ',') : '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.setsDone])
  const kgNum = kg.trim() ? Math.max(0, Number(kg.replace(',', '.'))) || null : null
  // Série por tempo (prancha): cronômetro da série; no fim, avisa e conclui a série
  const holdSeconds = secondsOf(item.reps)
  const [holdEndsAt, setHoldEndsAt] = useState<number | null>(null)
  const holdLeft = holdEndsAt ? Math.max(0, holdEndsAt - now) : holdSeconds * 1000
  useEffect(() => {
    if (holdEndsAt && holdEndsAt <= now) {
      setHoldEndsAt(null)
      restDoneAlert()
      props.onCompleteSet(kgNum)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, holdEndsAt])
  const bump = (d: number) => setKg(String(Math.max(0, Math.round(((kgNum ?? 0) + d) * 10) / 10)).replace('.', ','))

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
          <BackButton onClick={props.onClose} label="Voltar para a lista" icon="down" />
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
              <p className="text-sm font-semibold tracking-wider text-muted uppercase">Descanso</p>
              <Ring value={remaining} max={restSeconds * 1000} size={220} stroke={14} color="var(--color-lavender)">
                <span className="font-mono text-5xl font-bold tabular-nums" role="timer" aria-live="off">{clock(remaining + 999)}</span>
                <span className="text-sm text-muted">próxima: série {nextSet} de {item.sets}</span>
              </Ring>
              <div className="flex gap-3">
                <button onClick={() => props.onAdjustRest(-15)} className="rounded-2xl bg-soft px-5 py-3 font-semibold text-link active:scale-95">−15 s</button>
                <button onClick={() => props.onAdjustRest(15)} className="rounded-2xl bg-soft px-5 py-3 font-semibold text-link active:scale-95">+15 s</button>
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
                <p className="text-sm font-semibold tracking-wider text-muted uppercase">Série {nextSet} de {item.sets}</p>
                {holdSeconds > 0 ? (
                  <p className="mt-1 font-mono text-5xl font-bold text-link tabular-nums" role="timer" aria-live="off">{clock(holdLeft + (holdEndsAt ? 999 : 0))}</p>
                ) : (
                  <p className="mt-1 text-5xl font-bold text-link">{item.reps}</p>
                )}
                <p className="text-sm text-muted">{/^\d/.test(item.reps) && !/s$/.test(item.reps) ? 'repetições' : ''}</p>
                {item.notes && <p className="mt-2 rounded-2xl bg-soft px-3 py-2 text-sm">{item.notes}</p>}
              </div>

              {/* Carga desta série (não vale para séries por tempo, como a prancha) */}
              <div className={`w-full rounded-2xl bg-soft/70 p-3 ${holdSeconds > 0 ? 'hidden' : ''}`}>
                <div className="flex items-center justify-center gap-3">
                  <button onClick={() => bump(-2.5)} aria-label="Menos 2,5 kg" className="flex size-12 items-center justify-center rounded-xl bg-surface font-bold text-link active:scale-90">−2,5</button>
                  <div className="flex items-baseline gap-1">
                    <input
                      aria-label="Carga em kg"
                      inputMode="decimal"
                      placeholder="—"
                      value={kg}
                      onChange={(e) => setKg(e.target.value.replace(/[^\d.,]/g, '').slice(0, 6))}
                      onFocus={(e) => e.target.select()}
                      className="w-20 bg-transparent text-center text-3xl font-extrabold outline-none placeholder:text-line"
                    />
                    <span className="font-semibold text-muted">kg</span>
                  </div>
                  <button onClick={() => bump(2.5)} aria-label="Mais 2,5 kg" className="flex size-12 items-center justify-center rounded-xl bg-surface font-bold text-link active:scale-90">+2,5</button>
                </div>
                <p className="mt-1 text-center text-xs text-muted">
                  {item.lastLoads?.length ? `Última vez: ${item.lastLoads.map((v) => v.toLocaleString('pt-BR')).join(' · ')} kg` : 'Opcional: anote a carga para ver sua evolução'}
                </p>
              </div>

              <div className="mt-auto w-full space-y-3">
                {holdSeconds > 0 && !holdEndsAt && (
                  <Button onClick={() => { unlockAudio(); setHoldEndsAt(Date.now() + holdSeconds * 1000) }} className="!h-16 text-lg">
                    <Play className="size-6 fill-current" /> Iniciar {holdSeconds} s
                  </Button>
                )}
                {holdEndsAt ? (
                  <Button variant="ghost" onClick={() => { setHoldEndsAt(null); props.onCompleteSet(kgNum) }} className="!h-16 text-lg">
                    <Check className="size-6" strokeWidth={3} /> Concluir agora
                  </Button>
                ) : (
                  <Button variant={holdSeconds > 0 ? 'ghost' : undefined} onClick={() => props.onCompleteSet(kgNum)} className="!h-16 text-lg">
                    <Check className="size-6" strokeWidth={3} /> Concluir série {nextSet}
                  </Button>
                )}
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
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Depois de salvo, usa a duração do servidor (soma o cardio feito fora do cronômetro)
  const seconds = run.durationSeconds ?? Math.round(((run.finishedAt ?? Date.now()) - (run.startedAt ?? Date.now())) / 1000)
  const done = run.items.filter((i) => i.done && i.setsDone > 0)
  const totalSets = run.items.filter((i) => !isTimed(i)).reduce((a, i) => a + i.setsDone, 0)

  // Salva o treino no servidor (uma vez); fica registrado mesmo sem check-in
  const offline = !run.sessionId && !!run.sessionRef

  const inFlight = useRef(false)
  const save = async () => {
    if (run.sessionId || run.sessionRef || inFlight.current) return
    inFlight.current = true
    setSaving(true)
    setError(null)
    const body = {
          workout_id: run.workoutId || null,
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
            loads: (i.loads ?? []).slice(0, i.sets),
            distance_km: i.distanceKm ?? null,
          })),
    }
    try {
      const r = await api<{ session: WorkoutSessionData }>('/workout-sessions', { method: 'POST', body })
      setRun((s) => ({ ...s, sessionId: r.session.id, kcalBurned: r.session.kcal_burned, weightEstimated: r.session.weight_estimated, durationSeconds: r.session.duration_seconds }))
    } catch (e) {
      if (isOffline(e)) {
        // Sem internet: guarda o treino na fila e envia quando a conexão voltar
        const ref = newRef()
        await enqueue({ kind: 'session', ref, body })
        setRun((s) => ({ ...s, sessionRef: ref }))
      } else setError((e as ApiError).message)
    } finally {
      inFlight.current = false
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

  // Desfazer: apaga o treino salvo (e as calorias gastas dele)
  const undo = async () => {
    if (!(await ask({ title: 'Cancelar este treino?', text: 'Ele não será registrado e as calorias gastas são removidas.', confirmLabel: 'Cancelar treino', cancelLabel: 'Manter treino', danger: true }))) return
    if (run.sessionId) await api(`/workout-sessions/${run.sessionId}`, { method: 'DELETE' }).catch(() => {})
    toast({ text: 'Treino cancelado' })
    leave('/treinos')
  }

  return (
    <div className="safe-top mx-auto flex min-h-full max-w-lg flex-col px-5 pt-4 pb-8">
      {/* Cancelar: não registra o treino (apaga o que já foi salvo) */}
      <header className="mb-2 flex h-10 justify-end">
        {(run.sessionId || error) && (
          <button onClick={undo} className="flex items-center gap-1.5 rounded-full bg-soft px-4 py-2 text-sm font-semibold text-muted active:scale-95">
            <X className="size-4" /> Cancelar
          </button>
        )}
      </header>
      <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 220, damping: 14 }} className="text-center">
        <Mascot size={120} className="mx-auto" />
        <h1 className="mt-4 text-2xl font-extrabold">Treino concluído!</h1>
        <p className="text-muted">{run.workoutName}</p>
      </motion.div>

      <div className="mt-6 grid grid-cols-3 gap-2 text-center">
        <SummaryStat icon={<Timer className="size-5 text-link" />} value={durationLabel(seconds)} label="de treino" />
        <SummaryStat icon={<Dumbbell className="size-5 text-link" />} value={`${done.length}/${run.items.length}`} label="exercícios" />
        <SummaryStat icon={<Flame className="size-5 text-coral" />} value={run.kcalBurned != null ? `~${run.kcalBurned}` : offline ? '⏳' : '…'} label="kcal gastas" />
      </div>
      <p className="mt-2 text-center text-xs text-muted">
        {totalSets > 0 && `${totalSets} ${totalSets === 1 ? 'série' : 'séries'} · `}Gasto estimado (média por MET × peso × tempo).
        {run.weightEstimated && ' Registre seu peso em Progresso para uma estimativa melhor.'}
      </p>

      <ul className="mt-5 space-y-1.5">
        {run.items.map((i) => (
          <ExerciseRow
            key={i.key}
            done={i.done && i.setsDone > 0}
            name={i.exercise.name}
            detail={exerciseLine({ name: i.exercise.name, muscle_group: null, image: null, sets: i.sets, reps: i.reps, sets_done: i.setsDone, done: i.done, loads: i.loads, distance_km: i.distanceKm })}
            className="rounded-xl bg-surface px-4 py-2.5"
          />
        ))}
      </ul>

      {offline && (
        <p className="mt-4 flex items-center gap-2 rounded-2xl bg-soft p-3 text-sm">
          <CloudUpload className="size-4 shrink-0 text-link" /> Sem internet: treino guardado no celular. Ele é enviado sozinho quando a conexão voltar.
        </p>
      )}
      {error && (
        <div className="mt-4 space-y-2">
          <Alert>Não foi possível salvar o treino: {error}</Alert>
          <Button variant="ghost" onClick={save} loading={saving}>Tentar de novo</Button>
        </div>
      )}

      <div className="mt-auto space-y-3 pt-8">
        <Button onClick={() => leave('/')} disabled={!run.sessionId && !run.sessionRef} loading={saving}>
          <Check className="size-5" strokeWidth={3} /> Concluir
        </Button>
        <Button
          variant="ghost"
          onClick={() => leave(run.sessionId ? `/treino/${run.sessionId}` : `/registrar-treino?ref=${run.sessionRef}`)}
          disabled={!run.sessionId && !run.sessionRef}
        >
          <Camera className="size-5" /> Foto e compartilhar
        </Button>
      </div>
    </div>
  )
}

function SummaryStat({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
  return (
    <div className="rounded-2xl bg-surface p-3 shadow-[0_2px_12px_-4px_rgba(31,23,36,0.08)]">
      <p className="flex justify-center">{icon}</p>
      <p className="font-bold">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  )
}
