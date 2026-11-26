import { motion } from 'framer-motion'
import { Check, ChevronLeft, ChevronRight, Dumbbell, History, Play, Plus, Star } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError } from '../lib/api'
import { isoDate } from '../lib/date'
import { loadRun, runPath } from '../lib/run'
import type { Exercise, Workout, WorkoutSessionData } from '../lib/types'
import { defaultPrescription, fmtKm, hasDistance, isTimed, letter, minutesOf, prescription, suggestedMinutes } from '../lib/workout'
import { ExerciseImage } from './ExerciseImage'
import { notifyChanged } from './Layout'
import { Sheet } from './Sheet'
import { useToast } from './Toast'
import { Button } from './ui'

type Tab = 'now' | 'done'
const TAB_KEY = 'dt_train_tab'

/** Cardio ao ar livre: os atalhos mais comuns para registrar depois */
const OUTDOOR: { name: string; label: string; emoji: string }[] = [
  { name: 'Corrida', label: 'Corrida', emoji: '🏃' },
  { name: 'Caminhada', label: 'Caminhada', emoji: '🚶' },
  { name: 'Pedal (bicicleta)', label: 'Pedal', emoji: '🚴' },
]

/** Algo que dá para registrar como "já feito" */
type Activity =
  | { key: string; kind: 'workout'; label: string; workout: Workout }
  | { key: string; kind: 'exercise'; label: string; exercise: Exercise; emoji?: string; favorite?: boolean }

interface Recent extends WorkoutSessionData {
  key: string
}

const recentLine = (s: WorkoutSessionData) => {
  const km = s.exercises.reduce((a, e) => a + (e.distance_km ?? 0), 0)
  return [`${Math.max(1, Math.round(s.duration_seconds / 60))} min`, km > 0 ? `${fmtKm(km)} km` : null].filter(Boolean).join(' · ')
}

/**
 * "Treinar": duas abas com o mesmo peso.
 * - Treinar agora: ficha ou avulso, com cronômetro.
 * - Já treinei: repetir um treino recente (1 toque) ou registrar uma atividade em 3 toques.
 * Abre na aba usada por último. Todo registro tem "Desfazer".
 */
export function TrainSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const toast = useToast()
  const [tab, setTab] = useState<Tab>(() => (localStorage.getItem(TAB_KEY) === 'done' ? 'done' : 'now'))
  const [workouts, setWorkouts] = useState<Workout[] | null>(null)
  const [recent, setRecent] = useState<Recent[] | null>(null)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [cardio, setCardio] = useState<Exercise[]>([])
  const [favorites, setFavorites] = useState<Exercise[]>([])
  const [running, setRunning] = useState(loadRun)
  const [form, setForm] = useState<Activity | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setRunning(loadRun())
    setForm(null)
    api<{ workouts: Workout[] }>('/workouts').then((r) => setWorkouts(r.workouts)).catch(() => setWorkouts([]))
    api<{ recent: Recent[]; counts: Record<string, number> }>('/workout-sessions/recent')
      .then((r) => {
        setRecent(r.recent)
        setCounts(r.counts)
      })
      .catch(() => setRecent([]))
    api<{ exercises: Exercise[] }>('/exercises?group=cardio').then((r) => setCardio(r.exercises)).catch(() => {})
    api<{ exercises: Exercise[] }>('/exercises?group=favoritos').then((r) => setFavorites(r.exercises)).catch(() => {})
  }, [open])

  const switchTab = (t: Tab) => {
    setTab(t)
    setForm(null)
    localStorage.setItem(TAB_KEY, t)
  }

  const go = (to: string) => {
    onClose()
    navigate(to)
  }

  /** Depois de registrar: fecha, atualiza as telas e oferece desfazer ou ajustar. */
  const registered = (s: WorkoutSessionData) => {
    onClose()
    notifyChanged()
    navigator.vibrate?.([40, 60, 40])
    toast({
      text: `Registrado: ${s.workout_name} 🔥`,
      actions: [
        { label: 'Desfazer', run: () => api(`/workout-sessions/${s.id}`, { method: 'DELETE' }).then(() => { notifyChanged(); toast({ text: 'Registro desfeito' }) }).catch(() => {}) },
        { label: 'Ajustar', run: () => navigate(`/treino/${s.id}?editar=1`) },
      ],
    })
  }

  const repeat = async (r: Recent) => {
    setBusy(r.key)
    try {
      const res = await api<{ session: WorkoutSessionData }>(`/workout-sessions/${r.id}/repeat`, { method: 'POST' })
      registered(res.session)
    } catch (e) {
      toast({ text: (e as ApiError).message })
    } finally {
      setBusy(null)
    }
  }

  // Atividades: cardio ao ar livre, favoritos e a ficha; as mais feitas primeiro
  const activities: Activity[] = []
  for (const o of OUTDOOR) {
    const ex = cardio.find((e) => e.name === o.name)
    if (ex) activities.push({ key: `x:${ex.name}`, kind: 'exercise', label: o.label, exercise: ex, emoji: o.emoji, favorite: ex.favorite })
  }
  for (const ex of favorites) if (!activities.some((a) => a.key === `x:${ex.name}`)) activities.push({ key: `x:${ex.name}`, kind: 'exercise', label: ex.name, exercise: ex, favorite: true })
  for (const w of workouts ?? []) if (w.items.length) activities.push({ key: `w:${w.id}`, kind: 'workout', label: w.name, workout: w })
  activities.sort((a, b) => (counts[b.key] ?? 0) - (counts[a.key] ?? 0))

  const ready = workouts?.filter((w) => w.items.length > 0) ?? []
  const inProgress = running && running.phase !== 'prep' ? running : null

  return (
    <Sheet open={open} onClose={onClose} title="Treinar">
      <div className="space-y-5">
        {inProgress && (
          <button onClick={() => go(runPath(inProgress))} className="flex w-full items-center gap-3 rounded-2xl bg-scrim p-3.5 text-left text-white active:scale-[0.98]">
            <span className="relative flex size-3 shrink-0">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-orchid opacity-75" />
              <span className="relative inline-flex size-3 rounded-full bg-orchid" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs text-white/70">{inProgress.phase === 'finished' ? 'Treino finalizado' : 'Em andamento'}</span>
              <span className="block truncate font-bold">{inProgress.workoutName}</span>
            </span>
            <span className="flex items-center font-bold text-orchid">Continuar <ChevronRight className="size-4" /></span>
          </button>
        )}

        {/* Duas abas com o mesmo peso */}
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-soft p-1" role="tablist" aria-label="O que você quer fazer">
          {([['now', 'Treinar agora', Play], ['done', 'Registrar treino', Plus]] as const).map(([k, l, Icon]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => switchTab(k)} className="relative flex h-12 items-center justify-center gap-2 rounded-xl font-bold">
              {tab === k && <motion.span layoutId="train-tab" className="absolute inset-0 rounded-xl bg-primary shadow-md" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
              <Icon className={`relative size-4 ${tab === k ? 'text-white' : 'text-muted'} ${k === 'now' && tab === k ? 'fill-current' : ''}`} strokeWidth={k === 'done' ? 3 : 2} />
              <span className={`relative ${tab === k ? 'text-white' : 'text-muted'}`}>{l}</span>
            </button>
          ))}
        </div>

        {tab === 'now' && (
          <section>
            <p className="mb-2 text-xs text-muted">Com cronômetro, séries e descanso.</p>
            {!workouts && <div className="h-28 animate-pulse rounded-2xl bg-soft" />}
            {workouts && (
              <div className="grid grid-cols-2 gap-2">
                {ready.map((w) => (
                  <BigTile
                    key={w.id}
                    badge={<span className="font-extrabold">{letter(w.name)}</span>}
                    title={w.name}
                    hint={`${w.items.length} ${w.items.length === 1 ? 'exercício' : 'exercícios'}${w.last_done_on === isoDate() ? ' · feito hoje' : ''}`}
                    action={<Play className="size-3.5 fill-current" />}
                    onClick={() => go(`/treinos/${w.id}/iniciar`)}
                  />
                ))}
                <BigTile badge={<Dumbbell className="size-5" />} title="Exercício avulso" hint="Escolha na hora: corrida, prancha…" action={<Play className="size-3.5 fill-current" />} onClick={() => go('/treinos/avulso/iniciar')} />
                {ready.length === 0 && (
                  <button onClick={() => go('/treinos')} className="flex min-h-28 flex-col items-start gap-2 rounded-2xl border-2 border-dashed border-line p-3 text-left active:scale-[0.97]">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-soft text-primary"><Plus className="size-5" /></span>
                    <span className="block leading-tight font-bold">Montar minha ficha</span>
                    <span className="block text-xs text-muted">Treino A, B, C…</span>
                  </button>
                )}
              </div>
            )}
          </section>
        )}

        {tab === 'done' && !form && (
          <>
            {/* Recentes: 1 toque registra igual à última vez (com Desfazer e Ajustar no aviso) */}
            {recent && recent.length > 0 && (
              <section>
                <p className="mb-2 text-xs font-bold tracking-wide text-muted uppercase">Recentes</p>
                <div className="space-y-2">
                  {recent.map((r) => {
                    const a = activities.find((x) => x.key === r.key)
                    return (
                      <ActivityRow
                        key={r.key}
                        badge={<ActivityBadge activity={a} fallback={r.workout_name} />}
                        title={r.workout_name}
                        hint={`${recentLine(r)} · toque para registrar hoje`}
                        favorite={a?.kind === 'exercise' && !!a.favorite}
                        loading={busy === r.key}
                        disabled={!!busy}
                        onClick={() => repeat(r)}
                      />
                    )
                  })}
                </div>
              </section>
            )}

            <section>
              <p className="mb-2 text-xs font-bold tracking-wide text-muted uppercase">{recent?.length ? 'Outros' : 'O que você fez?'}</p>
              <div className="space-y-2">
                {activities.map((a) => (
                  <ActivityRow
                    key={a.key}
                    badge={<ActivityBadge activity={a} />}
                    title={a.label}
                    hint={a.kind === 'workout' ? `Treino da ficha · ${a.workout.items.length} ${a.workout.items.length === 1 ? 'exercício' : 'exercícios'}` : a.exercise.muscle_group === 'cardio' ? 'Cardio · tempo e distância' : prescription(defaultPrescription(a.exercise))}
                    favorite={a.kind === 'exercise' && !!a.favorite}
                    chevron
                    onClick={() => setForm(a)}
                  />
                ))}
                <button onClick={() => go('/registrar-treino?avulso=1')} className="flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-line p-3 text-left active:scale-[0.98]">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl text-primary"><Plus className="size-6" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">Outro exercício</span>
                    <span className="block text-xs text-muted">Procurar na lista completa</span>
                  </span>
                </button>
              </div>
            </section>
          </>
        )}

        {tab === 'done' && form && <QuickLog activity={form} last={recent?.find((r) => r.key === form.key) ?? null} onBack={() => setForm(null)} onDone={registered} />}

        <button onClick={() => go('/historico-treinos')} className="flex w-full items-center justify-center gap-2 py-1 text-sm font-semibold text-muted">
          <History className="size-4" /> Ver treinos feitos
        </button>
      </div>
    </Sheet>
  )
}

function ActivityRow({ badge, title, hint, favorite, chevron, loading, disabled, onClick }: {
  badge: ReactNode
  title: string
  hint: string
  favorite?: boolean
  chevron?: boolean
  loading?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button onClick={onClick} disabled={disabled} className="flex w-full items-center gap-3 rounded-2xl bg-soft p-3 text-left active:scale-[0.98] disabled:opacity-60">
      {badge}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate font-bold">{title}</span>
          {favorite && <Star className="size-3.5 shrink-0 fill-amber-400 text-amber-400" aria-label="Favorito" />}
        </span>
        <span className="block truncate text-xs text-muted">{hint}</span>
      </span>
      {loading && <span className="size-5 shrink-0 animate-spin rounded-full border-2 border-line border-t-primary" aria-label="Registrando" />}
      {chevron && !loading && <ChevronRight className="size-5 shrink-0 text-muted" />}
    </button>
  )
}

function BigTile({ badge, title, hint, action, onClick }: { badge: ReactNode; title: string; hint: string; action: ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex min-h-28 flex-col items-start gap-2 rounded-2xl bg-soft p-3 text-left active:scale-[0.97]">
      <span className="flex w-full items-center justify-between">
        <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-orchid to-primary text-white">{badge}</span>
        <span className="flex size-8 items-center justify-center rounded-full bg-primary text-white">{action}</span>
      </span>
      <span className="w-full">
        <span className="line-clamp-2 block leading-tight font-bold">{title}</span>
        <span className="block text-xs text-muted">{hint}</span>
      </span>
    </button>
  )
}

function ActivityBadge({ activity, fallback }: { activity?: Activity; fallback?: string }) {
  if (activity?.kind === 'workout')
    return <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orchid to-primary font-extrabold text-white">{letter(activity.workout.name)}</span>
  if (activity?.kind === 'exercise' && activity.emoji) return <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface text-2xl" aria-hidden>{activity.emoji}</span>
  if (activity?.kind === 'exercise') return <ExerciseImage image={activity.exercise.image} name={activity.exercise.name} size={40} animate={false} />
  return <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orchid to-primary font-extrabold text-white">{letter(fallback ?? '?')}</span>
}

/**
 * Registro rápido de uma atividade já feita: duração, km (se fizer sentido) e quando.
 * Vem preenchido com a última vez.
 */
function QuickLog({ activity, last, onBack, onDone }: { activity: Activity; last: WorkoutSessionData | null; onBack: () => void; onDone: (s: WorkoutSessionData) => void }) {
  const toast = useToast()
  const isWorkout = activity.kind === 'workout'
  const exercise = activity.kind === 'exercise' ? activity.exercise : null
  const plan = exercise ? defaultPrescription(exercise) : null
  const cardio = !!plan && isTimed(plan)
  const withKm = !!exercise && hasDistance(exercise)

  const lastMinutes = last ? Math.max(1, Math.round(last.duration_seconds / 60)) : null
  const lastKm = last?.exercises.find((e) => e.distance_km)?.distance_km ?? null
  const initialMinutes = lastMinutes ?? (isWorkout ? suggestedMinutes(activity.workout.items) : cardio ? minutesOf(plan!.reps) : 20)

  const [minutes, setMinutes] = useState(String(initialMinutes))
  const [km, setKm] = useState(lastKm ? String(lastKm).replace('.', ',') : '')
  const [yesterday, setYesterday] = useState(false)
  const [saving, setSaving] = useState(false)

  const min = Math.max(1, Math.min(360, Number(minutes) || 1))
  const kmNum = Number(km.replace(',', '.')) || 0

  const save = async () => {
    setSaving(true)
    const end = Date.now() - (yesterday ? 24 * 3600_000 : 0)
    const exercises = isWorkout
      ? activity.workout.items.map((i) => ({ name: i.exercise.name, muscle_group: i.exercise.muscle_group, image: i.exercise.image, sets: i.sets, reps: i.reps, sets_done: i.sets, done: true }))
      : [{
          name: exercise!.name, muscle_group: exercise!.muscle_group, image: exercise!.image,
          sets: cardio ? 1 : plan!.sets, reps: cardio ? `${min} min` : plan!.reps, sets_done: cardio ? 1 : plan!.sets, done: true,
          distance_km: withKm && kmNum > 0 ? Math.min(kmNum, 500) : null,
        }]
    try {
      const r = await api<{ session: WorkoutSessionData }>('/workout-sessions', {
        method: 'POST',
        body: {
          workout_id: isWorkout ? activity.workout.id : null,
          workout_name: isWorkout ? activity.workout.name : exercise!.name,
          started_at: new Date(end - min * 60_000).toISOString(),
          finished_at: new Date(end).toISOString(),
          exercises,
        },
      })
      onDone(r.session)
    } catch (e) {
      toast({ text: (e as ApiError).message })
      setSaving(false)
    }
  }

  const chip = (active: boolean) => `rounded-full border px-3.5 py-2 text-sm font-semibold ${active ? 'border-primary bg-primary text-white' : 'border-line bg-surface text-ink'}`

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} aria-label="Voltar" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-soft text-primary active:scale-90">
          <ChevronLeft className="size-5" strokeWidth={2.5} />
        </button>
        <ActivityBadge activity={activity} />
        <div className="min-w-0">
          <p className="truncate text-lg font-bold">{isWorkout ? activity.workout.name : exercise!.name}</p>
          {isWorkout && <p className="truncate text-xs text-muted">{activity.workout.items.map((i) => i.exercise.name).join(' · ')}</p>}
          {!isWorkout && !cardio && <p className="text-xs text-muted">{prescription(plan!)}</p>}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-muted">Quanto tempo?</p>
        <div className="flex flex-wrap items-center gap-2">
          {[20, 30, 45, 60].map((m) => (
            <button key={m} onClick={() => setMinutes(String(m))} className={chip(min === m)}>{m} min</button>
          ))}
          <label className="flex items-baseline gap-1">
            <input
              aria-label="Duração em minutos"
              inputMode="numeric"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value.replace(/\D/g, '').slice(0, 3))}
              onFocus={(e) => e.target.select()}
              className="w-16 rounded-xl border border-line bg-surface py-2 text-center font-semibold outline-none focus:border-orchid"
            />
            <span className="text-sm text-muted">min</span>
          </label>
        </div>
      </div>

      {withKm && (
        <label className="flex items-center justify-between gap-3 rounded-2xl bg-soft/70 px-4 py-3">
          <span className="text-sm">
            <span className="block font-medium">Distância</span>
            <span className="text-xs text-muted">opcional, deixa o gasto mais preciso</span>
          </span>
          <span className="flex items-baseline gap-1">
            <input
              aria-label="Distância em km"
              name="quick_km"
              inputMode="decimal"
              placeholder="—"
              value={km}
              onChange={(e) => setKm(e.target.value.replace(/[^\d.,]/g, '').slice(0, 6))}
              onFocus={(e) => e.target.select()}
              className="w-16 rounded-xl border border-line bg-surface py-2 text-center font-semibold outline-none focus:border-orchid"
            />
            <span className="text-sm text-muted">km</span>
          </span>
        </label>
      )}

      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-muted">Quando?</span>
        <span className="flex gap-1.5">
          {([[false, 'Hoje'], [true, 'Ontem']] as const).map(([v, l]) => (
            <button key={l} onClick={() => setYesterday(v)} aria-pressed={yesterday === v} className={chip(yesterday === v)}>{l}</button>
          ))}
        </span>
      </div>

      <Button onClick={save} loading={saving}>
        <Check className="size-5" strokeWidth={3} /> Registrar
      </Button>
      <p className="text-center text-xs text-muted">Foto e anotação são opcionais: dá para pôr depois, no treino.</p>
    </section>
  )
}
