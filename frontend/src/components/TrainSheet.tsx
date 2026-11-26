import { ChevronRight, Dumbbell, History, Play, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { isoDate } from '../lib/date'
import { loadRun } from '../lib/run'
import type { Workout } from '../lib/types'
import { letter } from '../lib/workout'
import { Sheet } from './Sheet'

/**
 * "Treinar": um só lugar para treinar agora (ficha) ou registrar um treino já feito
 * (da ficha ou exercício avulso). A foto é opcional e vem no fim.
 */
export function TrainSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const [workouts, setWorkouts] = useState<Workout[] | null>(null)
  const [running, setRunning] = useState(loadRun)

  useEffect(() => {
    if (!open) return
    setRunning(loadRun())
    api<{ workouts: Workout[] }>('/workouts').then((r) => setWorkouts(r.workouts)).catch(() => setWorkouts([]))
  }, [open])

  const go = (to: string) => {
    onClose()
    navigate(to)
  }

  const ready = workouts?.filter((w) => w.items.length > 0) ?? []
  const inProgress = running && running.phase !== 'prep' ? running : null

  return (
    <Sheet open={open} onClose={onClose} title="Treinar">
      <div className="space-y-5">
        {inProgress && (
          <button onClick={() => go(`/treinos/${inProgress.workoutId}/iniciar`)} className="flex w-full items-center gap-3 rounded-2xl bg-scrim p-3.5 text-left text-white active:scale-[0.98]">
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

        {/* 1. Treinar agora, seguindo a ficha */}
        <section>
          <p className="mb-2 text-sm font-bold">Treinar agora</p>
          {!workouts && <div className="h-16 animate-pulse rounded-2xl bg-soft" />}
          {workouts && ready.length === 0 && (
            <button onClick={() => go('/treinos')} className="flex w-full items-center gap-3 rounded-2xl bg-soft p-3 text-left active:scale-[0.98]">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface text-primary"><Plus className="size-5" /></span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold">Montar minha ficha</span>
                <span className="block text-xs text-muted">Treino A, B, C… com cronômetro e descanso</span>
              </span>
            </button>
          )}
          <div className="space-y-2">
            {ready.map((w) => (
              <button key={w.id} onClick={() => go(`/treinos/${w.id}/iniciar`)} className="flex w-full items-center gap-3 rounded-2xl bg-soft p-3 text-left active:scale-[0.98]">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orchid to-violet font-extrabold text-white">{letter(w.name)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{w.name}</span>
                  <span className="block text-xs text-muted">
                    {w.items.length} {w.items.length === 1 ? 'exercício' : 'exercícios'}
                    {w.last_done_on === isoDate() ? ' · feito hoje' : ''}
                  </span>
                </span>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-white">
                  <Play className="size-4 fill-current" />
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* 2. Já treinou: só registrar */}
        <section>
          <p className="text-sm font-bold">Já treinei, quero registrar</p>
          <p className="mb-2 text-xs text-muted">Escolha o que você fez. A foto é opcional.</p>
          <div className="flex flex-wrap gap-2">
            {workouts?.map((w) => (
              <button key={w.id} onClick={() => go(`/registrar-treino?treino=${w.id}`)} className="flex items-center gap-2 rounded-2xl bg-surface py-2 pr-4 pl-2 text-sm font-semibold shadow-sm active:scale-95">
                <span className="flex size-7 items-center justify-center rounded-lg bg-soft text-xs font-extrabold text-primary">{letter(w.name)}</span>
                <span className="max-w-36 truncate">{w.name}</span>
              </button>
            ))}
            <button onClick={() => go('/registrar-treino?avulso=1')} className="flex items-center gap-2 rounded-2xl border-2 border-dashed border-line py-1.5 pr-4 pl-2 text-sm font-semibold text-primary active:scale-95">
              <span className="flex size-7 items-center justify-center rounded-lg bg-soft"><Dumbbell className="size-4" /></span>
              Exercício avulso
            </button>
          </div>
          <p className="mt-1.5 text-xs text-muted">Avulso: corrida, aula, bike… sem precisar de ficha.</p>
        </section>

        <button onClick={() => go('/historico-treinos')} className="flex w-full items-center justify-center gap-2 py-1 text-sm font-semibold text-muted">
          <History className="size-4" /> Ver treinos feitos
        </button>
      </div>
    </Sheet>
  )
}
