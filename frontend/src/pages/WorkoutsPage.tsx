import { motion, Reorder } from 'framer-motion'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ExerciseImage } from '../components/ExerciseImage'
import { Button, Card } from '../components/ui'
import { api } from '../lib/api'
import { isoDate } from '../lib/date'
import { loadRun } from '../lib/run'
import type { Checkin, CheckinStats, Workout } from '../lib/types'

/** Aba Treinos: check-in do dia + fichas (Treino A, B, C…). */
export function WorkoutsPage() {
  const navigate = useNavigate()
  const [workouts, setWorkouts] = useState<Workout[] | null>(null)
  const [stats, setStats] = useState<CheckinStats | null>(null)
  const [todayCheckin, setTodayCheckin] = useState<Checkin | null>(null)
  const [creating, setCreating] = useState(false)
  const [running] = useState(() => {
    const r = loadRun()
    return r && r.phase !== 'prep' ? r : null
  })

  useEffect(() => {
    api<{ workouts: Workout[] }>('/workouts').then((r) => setWorkouts(r.workouts))
    api<{ checkins: Checkin[]; stats: CheckinStats }>('/checkins').then((r) => {
      setStats(r.stats)
      setTodayCheckin(r.stats.today ? r.checkins[0] : null)
    })
  }, [])

  const create = async () => {
    setCreating(true)
    const r = await api<{ workout: Workout }>('/workouts', { method: 'POST', body: {} })
    navigate(`/treinos/${r.workout.id}?editar=1`)
  }

  const saveOrder = () => workouts && api('/workouts/order', { method: 'PUT', body: { ids: workouts.map((w) => w.id) } }).catch(() => {})

  return (
    <div className="safe-top space-y-4 px-5 pt-6 pb-6">
      <h1 className="text-2xl font-bold">Treinos</h1>

      {/* Treino em andamento (salvo no aparelho) */}
      {running && (
        <Link to={`/treinos/${running.workoutId}/iniciar`} className="flex items-center gap-3 rounded-[var(--radius-card)] bg-scrim p-4 text-white shadow-lg active:scale-[0.98]">
          <span className="relative flex size-3">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-orchid opacity-75" />
            <span className="relative inline-flex size-3 rounded-full bg-orchid" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs text-white/70">{running.phase === 'finished' ? 'Treino finalizado' : 'Treino em andamento'}</span>
            <span className="block truncate font-semibold">{running.workoutName}</span>
          </span>
          <span className="font-semibold text-orchid">Abrir ›</span>
        </Link>
      )}

      {/* Check-in do dia */}
      <Card className="overflow-hidden !p-0">
        <div className="bg-gradient-to-br from-orchid to-violet p-5 text-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-white/80">{todayCheckin ? 'Check-in feito hoje 💪' : 'Treinou hoje?'}</p>
              <p className="mt-0.5 text-xl font-bold">{todayCheckin ? todayCheckin.workout_name : 'Faça seu check-in'}</p>
            </div>
            {todayCheckin && <img src={todayCheckin.photo_url} alt="Foto do check-in de hoje" className="size-16 rounded-2xl border-2 border-white/70 object-cover" />}
          </div>
          {stats && (
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <Stat value={stats.streak} label={stats.streak === 1 ? 'dia seguido' : 'dias seguidos'} icon="🔥" />
              <Stat value={stats.month_count} label={stats.month_count === 1 ? 'check-in no mês' : 'check-ins no mês'} icon="📅" />
              <Stat value={stats.total_count} label="no total" icon="🏆" />
            </div>
          )}
        </div>
        <div className="flex gap-2 p-3">
          <Link to="/checkin" className="flex h-11 flex-1 items-center justify-center rounded-xl bg-primary font-semibold text-white active:scale-[0.98]">
            📸 {todayCheckin ? 'Novo check-in' : 'Fazer check-in'}
          </Link>
          <Link to="/checkins" className="flex h-11 items-center justify-center rounded-xl bg-soft px-4 font-semibold text-primary">
            Histórico
          </Link>
        </div>
      </Card>

      <div className="flex items-center justify-between px-1 pt-2">
        <h2 className="font-semibold">Minha ficha</h2>
        {workouts && workouts.length > 1 && <span className="text-xs text-muted">arraste para reordenar</span>}
      </div>

      {!workouts && <div className="h-32 animate-pulse rounded-2xl bg-soft" />}
      {workouts?.length === 0 && (
        <Card className="py-8 text-center">
          <p className="text-4xl">🏋️‍♀️</p>
          <p className="mt-3 font-medium">Monte sua ficha</p>
          <p className="mt-1 text-sm text-muted">Crie o Treino A, B, C… e escolha os exercícios da biblioteca.</p>
        </Card>
      )}

      {workouts && workouts.length > 0 && (
        <Reorder.Group axis="y" values={workouts} onReorder={setWorkouts} className="space-y-2">
          {workouts.map((w) => (
            <Reorder.Item key={w.id} value={w} onDragEnd={saveOrder}>
              <div className="overflow-hidden rounded-[var(--radius-card)] bg-surface shadow-[0_2px_12px_-4px_rgba(31,23,36,0.08)]">
                <motion.button onClick={() => navigate(`/treinos/${w.id}`)} whileTap={{ scale: 0.98 }} className="flex w-full items-center gap-3 p-3 text-left">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orchid to-violet text-lg font-bold text-white">
                    {letter(w.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{w.name}</p>
                    <p className="truncate text-sm text-muted">
                      {w.items.length} {w.items.length === 1 ? 'exercício' : 'exercícios'}
                    </p>
                    {w.last_done_on === isoDate() && (
                      <span className="mt-1 inline-block rounded-full bg-orchid/15 px-2 py-0.5 text-xs font-semibold text-primary">Feito hoje ✓</span>
                    )}
                  </div>
                  <div className="flex -space-x-3">
                    {w.items.slice(0, 3).map((i) => (
                      <div key={i.id} className="rounded-2xl ring-2 ring-white">
                        <ExerciseImage image={i.exercise.image} name={i.exercise.name} size={36} animate={false} />
                      </div>
                    ))}
                  </div>
                </motion.button>
                {w.items.length > 0 && (
                  <div className="px-3 pb-3">
                    <Link
                      to={`/treinos/${w.id}/iniciar`}
                      className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-white active:scale-[0.98]"
                    >
                      ▶ {running?.workoutId === w.id ? 'Continuar treino' : 'Iniciar treino'}
                    </Link>
                  </div>
                )}
              </div>
            </Reorder.Item>
          ))}
        </Reorder.Group>
      )}

      <Button variant="ghost" onClick={create} loading={creating}>
        + Novo treino
      </Button>
    </div>
  )
}

/** "Treino A – Peito" → "A" */
export function letter(name: string) {
  const m = name.match(/treino\s+([a-z0-9])/i)
  return (m ? m[1] : name[0] ?? '?').toUpperCase()
}

function Stat({ value, label, icon }: { value: number; label: string; icon: string }) {
  return (
    <div className="rounded-2xl bg-white/15 py-2">
      <p className="text-lg font-bold">
        {icon} {value}
      </p>
      <p className="text-[11px] text-white/80">{label}</p>
    </div>
  )
}
