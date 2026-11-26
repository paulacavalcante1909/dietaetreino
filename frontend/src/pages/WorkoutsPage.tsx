import { motion, Reorder } from 'framer-motion'
import { Calendar, Camera, CheckCircle2, ChevronRight, CloudUpload, Dumbbell, Flame, Play, Plus, Trophy, Zap } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ExerciseImage } from '../components/ExerciseImage'
import { Ring } from '../components/Ring'
import { Sheet } from '../components/Sheet'
import { useToast } from '../components/Toast'
import { Button, Card, EmptyState, Mascot } from '../components/ui'
import { api } from '../lib/api'
import { isoDate } from '../lib/date'
import { useOutboxCount } from '../lib/outbox'
import { loadRun } from '../lib/run'
import type { Checkin, CheckinStats, Workout } from '../lib/types'

/** Aba Treinos: "Treinar" (ficha ou avulso), meta da semana, sequência e ficha. */
export function WorkoutsPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const [workouts, setWorkouts] = useState<Workout[] | null>(null)
  const [stats, setStats] = useState<CheckinStats | null>(null)
  const [todayCheckin, setTodayCheckin] = useState<Checkin | null>(null)
  const [creating, setCreating] = useState(false)
  const [train, setTrain] = useState(params.get('treinar') === '1')
  const [goalOpen, setGoalOpen] = useState(false)
  const pending = useOutboxCount()
  const [running] = useState(() => {
    const r = loadRun()
    return r && r.phase !== 'prep' ? r : null
  })

  const loadStats = () =>
    api<{ checkins: Checkin[]; stats: CheckinStats }>('/checkins').then((r) => {
      setStats(r.stats)
      setTodayCheckin(r.stats.today ? r.checkins[0] : null)
    })

  useEffect(() => {
    api<{ workouts: Workout[] }>('/workouts').then((r) => setWorkouts(r.workouts))
    loadStats()
  }, [])

  const closeTrain = () => {
    setTrain(false)
    if (params.get('treinar')) setParams({}, { replace: true })
  }

  const create = async () => {
    setCreating(true)
    const r = await api<{ workout: Workout }>('/workouts', { method: 'POST', body: {} })
    navigate(`/treinos/${r.workout.id}?editar=1`)
  }

  const saveGoal = async (n: number) => {
    setStats((s) => (s ? { ...s, weekly_goal: n } : s))
    setGoalOpen(false)
    await api('/me/preferences', { method: 'PUT', body: { weekly_workout_goal: n } }).catch(() => {})
    toast({ text: `Meta: ${n}× por semana ✓` })
  }

  const saveOrder = () => workouts && api('/workouts/order', { method: 'PUT', body: { ids: workouts.map((w) => w.id) } }).catch(() => {})
  const weekDone = stats ? Math.min(stats.week_days, stats.weekly_goal) : 0

  return (
    <div className="safe-top space-y-4 px-5 pt-6 pb-6">
      <h1 className="text-2xl font-extrabold">Treinos</h1>

      {/* Treino em andamento (salvo no aparelho) */}
      {running && (
        <Link to={`/treinos/${running.workoutId}/iniciar`} className="flex items-center gap-3 rounded-[var(--radius-card)] bg-scrim p-4 text-white shadow-lg active:scale-[0.98]">
          <span className="relative flex size-3">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-orchid opacity-75" />
            <span className="relative inline-flex size-3 rounded-full bg-orchid" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs text-white/70">{running.phase === 'finished' ? 'Treino finalizado' : 'Treino em andamento'}</span>
            <span className="block truncate font-bold">{running.workoutName}</span>
          </span>
          <span className="flex items-center font-bold text-orchid">Abrir <ChevronRight className="size-4" /></span>
        </Link>
      )}

      {pending > 0 && (
        <p className="flex items-center gap-2 rounded-2xl bg-soft px-4 py-3 text-sm">
          <CloudUpload className="size-4 shrink-0 text-primary" />
          {pending === 1 ? '1 envio pendente' : `${pending} envios pendentes`}: vai sozinho quando a internet voltar.
        </p>
      )}

      {/* Semana + Treinar */}
      <Card className="overflow-hidden !p-0">
        <div className="bg-gradient-to-br from-orchid to-violet p-5 text-white">
          <div className="flex items-center gap-4">
            {stats && (
              <button onClick={() => setGoalOpen(true)} aria-label={`Meta da semana: ${stats.week_days} de ${stats.weekly_goal} treinos. Toque para mudar`} className="shrink-0">
                <Ring value={weekDone} max={stats.weekly_goal} size={92} stroke={9} color="#ffffff">
                  <span className="text-xl leading-none font-extrabold text-white">
                    {stats.week_days}/{stats.weekly_goal}
                  </span>
                  <span className="text-[10px] text-white/80">semana</span>
                </Ring>
              </button>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm text-white/80">{todayCheckin ? 'Treinou hoje 💪' : stats && stats.week_days >= stats.weekly_goal ? 'Meta da semana batida!' : 'Bora treinar?'}</p>
              <p className="truncate text-xl font-extrabold">{todayCheckin ? todayCheckin.workout_name : 'Treino de hoje'}</p>
              {stats && (
                <div className="mt-2 flex gap-3 text-xs font-semibold text-white/90">
                  <span className="flex items-center gap-1"><Flame className="size-3.5" />{stats.streak} {stats.streak === 1 ? 'dia' : 'dias'}</span>
                  <span className="flex items-center gap-1"><Calendar className="size-3.5" />{stats.month_count} no mês</span>
                  <span className="flex items-center gap-1"><Trophy className="size-3.5" />{stats.total_count}</span>
                </div>
              )}
            </div>
            {todayCheckin?.photo_url && <img src={todayCheckin.photo_url} alt="Foto do check-in de hoje" className="size-14 shrink-0 rounded-2xl border-2 border-white/70 object-cover" />}
          </div>
        </div>
        <div className="flex gap-2 p-3">
          <button onClick={() => setTrain(true)} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-primary font-bold text-white active:scale-[0.98]">
            <Zap className="size-5" /> Treinar
          </button>
          <Link to="/checkins" className="flex h-12 items-center justify-center rounded-xl bg-soft px-4 font-bold text-primary">
            Histórico
          </Link>
        </div>
      </Card>

      <div className="flex items-center justify-between px-1 pt-2">
        <h2 className="font-bold">Minha ficha</h2>
        {workouts && workouts.length > 1 && <span className="text-xs text-muted">arraste para reordenar</span>}
      </div>

      {!workouts && <div className="h-32 animate-pulse rounded-2xl bg-soft" />}
      {workouts?.length === 0 && (
        <Card>
          <EmptyState title="Monte sua ficha" text="Crie o Treino A, B, C… com exercícios da biblioteca. Ou treine sem ficha com um exercício avulso." />
        </Card>
      )}

      {workouts && workouts.length > 0 && (
        <Reorder.Group axis="y" values={workouts} onReorder={setWorkouts} className="space-y-2">
          {workouts.map((w) => (
            <Reorder.Item key={w.id} value={w} onDragEnd={saveOrder}>
              <div className="overflow-hidden rounded-[var(--radius-card)] bg-surface shadow-[0_2px_12px_-4px_rgba(31,23,36,0.08)]">
                <motion.button onClick={() => navigate(`/treinos/${w.id}`)} whileTap={{ scale: 0.98 }} className="flex w-full items-center gap-3 p-3 text-left">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orchid to-violet text-lg font-extrabold text-white">
                    {letter(w.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{w.name}</p>
                    <p className="truncate text-sm text-muted">
                      {w.items.length} {w.items.length === 1 ? 'exercício' : 'exercícios'}
                    </p>
                    {w.last_done_on === isoDate() && (
                      <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-orchid/15 px-2 py-0.5 text-xs font-bold text-primary">
                        <CheckCircle2 className="size-3.5" /> Feito hoje
                      </span>
                    )}
                  </div>
                  <div className="flex -space-x-3">
                    {w.items.slice(0, 3).map((i) => (
                      <div key={i.id} className="rounded-2xl ring-2 ring-surface">
                        <ExerciseImage image={i.exercise.image} name={i.exercise.name} size={36} animate={false} />
                      </div>
                    ))}
                  </div>
                </motion.button>
                {w.items.length > 0 && (
                  <div className="px-3 pb-3">
                    <Link to={`/treinos/${w.id}/iniciar`} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-soft font-bold text-primary active:scale-[0.98]">
                      <Play className="size-4 fill-current" /> {running?.workoutId === w.id ? 'Continuar treino' : 'Iniciar treino'}
                    </Link>
                  </div>
                )}
              </div>
            </Reorder.Item>
          ))}
        </Reorder.Group>
      )}

      <Button variant="ghost" onClick={create} loading={creating}>
        <Plus className="size-5" /> Novo treino
      </Button>

      {/* Treinar: escolher o que fazer */}
      <Sheet open={train} onClose={closeTrain} title="O que vamos treinar?">
        <div className="space-y-3">
          {workouts && workouts.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-muted">Da minha ficha</p>
              {workouts.filter((w) => w.items.length > 0).map((w) => (
                <button
                  key={w.id}
                  onClick={() => navigate(`/treinos/${w.id}/iniciar`)}
                  className="flex w-full items-center gap-3 rounded-2xl bg-soft p-3 text-left active:scale-[0.98]"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orchid to-violet font-extrabold text-white">{letter(w.name)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{w.name}</span>
                    <span className="block text-xs text-muted">
                      {w.items.length} exercícios{w.last_done_on === isoDate() ? ' · feito hoje' : ''}
                    </span>
                  </span>
                  <Play className="size-5 shrink-0 fill-primary text-primary" />
                </button>
              ))}
            </div>
          )}
          <button onClick={() => navigate('/checkin?avulso=1')} className="flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-line p-3 text-left active:scale-[0.98]">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-soft text-primary"><Dumbbell className="size-5" /></span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold">Exercício avulso</span>
              <span className="block text-xs text-muted">Corrida, aula, bike… sem precisar de ficha</span>
            </span>
          </button>
          <button onClick={() => navigate('/checkin')} className="flex w-full items-center justify-center gap-2 py-2 text-sm font-semibold text-muted">
            <Camera className="size-4" /> Só registrar check-in de um treino já feito
          </button>
        </div>
      </Sheet>

      {/* Meta da semana */}
      <Sheet open={goalOpen} onClose={() => setGoalOpen(false)} title="Meta da semana">
        <div className="space-y-4 text-center">
          <Mascot size={72} className="mx-auto" />
          <p className="text-sm text-muted">Quantos dias por semana você quer treinar?</p>
          <div className="grid grid-cols-7 gap-1.5">
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <button
                key={n}
                onClick={() => saveGoal(n)}
                className={`h-12 rounded-xl text-lg font-extrabold transition-colors ${stats?.weekly_goal === n ? 'bg-primary text-white' : 'bg-soft text-ink'}`}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted">Conta dias com treino executado ou check-in (domingo a sábado).</p>
        </div>
      </Sheet>
    </div>
  )
}

/** "Treino A – Peito" → "A" */
export function letter(name: string) {
  const m = name.match(/treino\s+([a-z0-9])/i)
  return (m ? m[1] : name[0] ?? '?').toUpperCase()
}
