import { motion, Reorder } from 'framer-motion'
import { HoldToDragItem } from '../components/HoldToDrag'
import { Calendar, CheckCircle2, ChevronRight, CloudUpload, Flame, Pencil, Play, Plus, Trophy, Zap } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ExerciseImage } from '../components/ExerciseImage'
import { Ring } from '../components/Ring'
import { openTrain } from '../components/Layout'
import { WeeklyGoalSheet } from '../components/WeeklyGoalSheet'
import { Button, Card, EmptyState } from '../components/ui'
import { api } from '../lib/api'
import { isoDate } from '../lib/date'
import { useOutboxCount } from '../lib/outbox'
import { loadRun, runPath } from '../lib/run'
import type { Checkin, CheckinStats, Workout, WorkoutSessionData } from '../lib/types'
import { letter } from '../lib/workout'

/** Aba Treinos: "Treinar" (ficha ou avulso), meta da semana, sequência e ficha. */
export function WorkoutsPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [workouts, setWorkouts] = useState<Workout[] | null>(null)
  const [stats, setStats] = useState<CheckinStats | null>(null)
  const [todayCheckin, setTodayCheckin] = useState<Checkin | null>(null)
  const [creating, setCreating] = useState(false)
  const [goalOpen, setGoalOpen] = useState(false)
  const pending = useOutboxCount()
  const [running] = useState(() => {
    const r = loadRun()
    return r && r.phase !== 'prep' ? r : null
  })

  const loadStats = () =>
    api<{ checkins: Checkin[]; sessions: WorkoutSessionData[]; stats: CheckinStats }>('/checkins').then((r) => {
      setStats(r.stats)
      // Treino de hoje: com foto (check-in) ou só registrado no app
      const today = isoDate()
      const withPhoto = r.checkins.find((c) => c.date === today)
      const session = r.sessions.find((s) => s.date === today)
      setTodayCheckin(withPhoto ?? (session ? { id: 0, workout_id: session.workout_id, workout_name: session.workout_name, date: today, note: null, photo_url: null, created_at: session.finished_at, session } : null))
    })

  useEffect(() => {
    api<{ workouts: Workout[] }>('/workouts').then((r) => setWorkouts(r.workouts))
    loadStats()
  }, [])

  // Links antigos (?treinar=1) abrem a folha "Treinar"
  useEffect(() => {
    if (params.get('treinar')) {
      setParams({}, { replace: true })
      openTrain()
    }
  }, [params, setParams])

  const create = async () => {
    setCreating(true)
    const r = await api<{ workout: Workout }>('/workouts', { method: 'POST', body: {} })
    navigate(`/treinos/${r.workout.id}?editar=1&novo=1`)
  }

  const saveOrder = () => workouts && api('/workouts/order', { method: 'PUT', body: { ids: workouts.map((w) => w.id) } }).catch(() => {})
  const weekDone = stats ? Math.min(stats.week_days, stats.weekly_goal) : 0

  return (
    <div className="safe-top space-y-4 px-5 pt-6 pb-6">
      <h1 className="text-2xl font-extrabold">Treinos</h1>

      {/* Treino em andamento (salvo no aparelho) */}
      {running && (
        <Link to={runPath(running)} className="flex items-center gap-3 rounded-[var(--radius-card)] bg-scrim p-4 text-white shadow-lg active:scale-[0.98]">
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
          <CloudUpload className="size-4 shrink-0 text-link" />
          {pending === 1 ? '1 envio pendente' : `${pending} envios pendentes`}: vai sozinho quando a internet voltar.
        </p>
      )}

      {/* Semana + Treinar */}
      <Card className="overflow-hidden !p-0">
        <div className="bg-gradient-to-br from-orchid to-primary px-5 pt-4 pb-5 text-white">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-bold tracking-wider text-white/80 uppercase">Esta semana</p>
            {stats && (
              <button
                onClick={() => setGoalOpen(true)}
                aria-label={`Editar meta da semana (${stats.weekly_goal} ${stats.weekly_goal === 1 ? 'treino' : 'treinos'})`}
                title="Editar meta da semana"
                className="-mr-1 flex size-8 items-center justify-center rounded-full bg-white/15 active:bg-white/30"
              >
                <Pencil className="size-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-4">
            {stats && (
              <Ring value={weekDone} max={stats.weekly_goal} size={92} stroke={7} color="#ffffff" track="rgba(255,255,255,0.25)">
                <span className="font-display text-3xl leading-none font-semibold text-white">{stats.week_days}</span>
                <span className="mt-0.5 text-xs text-white/80">de {stats.weekly_goal}</span>
              </Ring>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-lg leading-snug font-bold">
                {todayCheckin ? 'Treinou hoje 💪' : stats && stats.week_days >= stats.weekly_goal ? 'Meta batida! 🎉' : 'Bora treinar?'}
              </p>
              <p className="truncate text-sm text-white/85">
                {todayCheckin
                  ? todayCheckin.workout_name
                  : stats
                    ? stats.week_days >= stats.weekly_goal
                      ? 'Tudo que vier agora é bônus'
                      : `${stats.weekly_goal - stats.week_days === 1 ? 'Falta 1 treino' : `Faltam ${stats.weekly_goal - stats.week_days} treinos`} para a meta`
                    : ''}
              </p>
            </div>
            {todayCheckin?.photo_url && <img src={todayCheckin.photo_url} alt="Foto do treino de hoje" className="size-14 shrink-0 rounded-2xl border-2 border-white/70 object-cover" />}
          </div>

          {/* Números: o total leva ao histórico (destacado como botão) */}
          {stats && (
            <div className="mt-5 grid grid-cols-3 gap-2 text-center">
              <div className="py-2">
                <p className="flex items-center justify-center gap-1 font-display text-lg leading-none font-semibold"><Flame className="size-4" />{stats.streak}</p>
                <p className="mt-1 text-xs text-white/80">{stats.streak === 1 ? 'dia seguido' : 'dias seguidos'}</p>
              </div>
              <div className="py-2">
                <p className="flex items-center justify-center gap-1 font-display text-lg leading-none font-semibold"><Calendar className="size-4" />{stats.month_count}</p>
                <p className="mt-1 text-xs text-white/80">no mês</p>
              </div>
              {stats.total_count > 0 ? (
                <Link to="/historico-treinos" aria-label={`Ver os ${stats.total_count} treinos feitos`} className="rounded-2xl bg-white/15 py-2 ring-1 ring-white/30 transition-colors active:bg-white/25">
                  <p className="flex items-center justify-center gap-1 font-display text-lg leading-none font-semibold"><Trophy className="size-4" />{stats.total_count}</p>
                  <p className="mt-1 flex items-center justify-center text-xs font-semibold">
                    ver todos <ChevronRight className="size-3.5" />
                  </p>
                </Link>
              ) : (
                <div className="py-2">
                  <p className="flex items-center justify-center gap-1 font-display text-lg leading-none font-semibold"><Trophy className="size-4" />0</p>
                  <p className="mt-1 text-xs text-white/80">no total</p>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="p-3">
          <button onClick={openTrain} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-bold text-white active:scale-[0.98]">
            <Zap className="size-5" /> Treinar
          </button>
        </div>
      </Card>

      <div className="flex items-center justify-between px-1 pt-2">
        <h2 className="text-xs font-bold tracking-wider text-muted uppercase">Minha ficha</h2>
      </div>

      {!workouts && <div className="h-32 animate-pulse rounded-2xl bg-soft" />}
      {workouts?.length === 0 && (
        <Card>
          <EmptyState title="Monte sua ficha" text="Crie o Treino A, B, C… com exercícios da biblioteca. Ou treine sem ficha com um exercício avulso.">
            <Button onClick={create} loading={creating}>
              <Plus className="size-5" /> Criar meu primeiro treino
            </Button>
          </EmptyState>
        </Card>
      )}

      {workouts && workouts.length > 0 && (
        <Reorder.Group axis="y" values={workouts} onReorder={setWorkouts} className="space-y-2">
          {workouts.map((w) => (
            <HoldToDragItem key={w.id} value={w} onDragEnd={saveOrder}>
              <div className="overflow-hidden rounded-[var(--radius-card)] bg-surface shadow-[0_2px_12px_-4px_rgba(31,23,36,0.08)]">
                <motion.button onClick={() => navigate(`/treinos/${w.id}`)} whileTap={{ scale: 0.98 }} className="flex w-full items-center gap-3 p-3 text-left">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orchid to-primary text-lg font-extrabold text-white">
                    {letter(w.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{w.name}</p>
                    <p className="truncate text-sm text-muted">
                      {w.items.length} {w.items.length === 1 ? 'exercício' : 'exercícios'}
                    </p>
                    {w.last_done_on === isoDate() && (
                      <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-orchid/15 px-2 py-0.5 text-xs font-bold text-link">
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
                    <Link to={`/treinos/${w.id}/iniciar`} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-soft font-bold text-link active:scale-[0.98]">
                      <Play className="size-4 fill-current" /> {running?.workoutId === w.id ? 'Continuar treino' : 'Iniciar treino'}
                    </Link>
                  </div>
                )}
              </div>
            </HoldToDragItem>
          ))}
        </Reorder.Group>
      )}

      {workouts && workouts.length > 0 && (
        <Button variant="ghost" onClick={create} loading={creating}>
          <Plus className="size-5" /> Novo treino
        </Button>
      )}

      {/* Meta da semana */}
      <WeeklyGoalSheet open={goalOpen} onClose={() => setGoalOpen(false)} value={stats?.weekly_goal ?? 3} onSaved={(n) => setStats((s) => (s ? { ...s, weekly_goal: n } : s))} />
    </div>
  )
}
