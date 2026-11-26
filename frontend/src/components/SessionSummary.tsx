import { CheckCircle2, Dumbbell, Flame, Repeat, SkipForward, Timer } from 'lucide-react'
import { durationLabel } from '../lib/run'
import { isTimed, prescription } from '../lib/workout'
import type { SessionExercise, WorkoutSessionData } from '../lib/types'

/** "3/3 × 10 · 40–45 kg" (com carga quando registrada) */
export function exerciseLine(e: SessionExercise) {
  if (isTimed(e)) return prescription(e)
  const loads = (e.loads ?? []).filter((v): v is number => v != null && v > 0)
  const n = (v: number) => v.toLocaleString('pt-BR')
  const kg = loads.length ? ` · ${Math.min(...loads) === Math.max(...loads) ? n(Math.max(...loads)) : `${n(Math.min(...loads))}–${n(Math.max(...loads))}`} kg` : ''
  return `${e.sets_done}/${e.sets} × ${e.reps}${kg}`
}

/** Ícone de feito (✓) ou pulado (⏭) no lugar de riscar o nome */
export function ExerciseStatus({ done }: { done: boolean }) {
  return done ? (
    <CheckCircle2 className="size-4.5 shrink-0 text-primary" aria-label="Feito" />
  ) : (
    <SkipForward className="size-4.5 shrink-0 text-muted" aria-label="Pulado" />
  )
}

/** Linha de exercício de um treino feito: ícone, nome e o que foi feito (ou "pulado") */
export function ExerciseRow({ done, name, detail, className = '' }: { done: boolean; name: string; detail: string; className?: string }) {
  return (
    <li className={`flex items-center gap-2.5 text-sm ${className}`}>
      <ExerciseStatus done={done} />
      <span className={`min-w-0 flex-1 truncate ${done ? '' : 'text-muted'}`}>{name}</span>
      {done ? (
        <span className="shrink-0 text-muted">{detail}</span>
      ) : (
        <span className="shrink-0 rounded-full bg-soft px-2 py-0.5 text-xs font-semibold text-muted">pulado</span>
      )}
    </li>
  )
}

/** Resumo do treino executado: tempo, exercícios, séries e gasto (no check-in e no histórico). */
export function SessionSummary({ session, compact = false }: { session: WorkoutSessionData; compact?: boolean }) {
  const done = session.exercises.filter((e) => e.done)
  const sets = session.exercises.filter((e) => !isTimed(e)).reduce((a, e) => a + e.sets_done, 0)

  return (
    <div className="rounded-2xl bg-soft/70 p-3">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold">
        <span className="flex items-center gap-1"><Timer className="size-4 text-primary" /> {durationLabel(session.duration_seconds)}</span>
        <span className="flex items-center gap-1"><Dumbbell className="size-4 text-primary" /> {done.length}/{session.exercises.length} {session.exercises.length === 1 ? 'exercício' : 'exercícios'}</span>
        {sets > 0 && <span className="flex items-center gap-1"><Repeat className="size-4 text-primary" /> {sets} {sets === 1 ? 'série' : 'séries'}</span>}
        {session.kcal_burned != null && (
          <span className="flex items-center gap-1" title="Estimativa média (MET × peso × tempo)"><Flame className="size-4 text-coral" /> ~{session.kcal_burned} kcal</span>
        )}
      </div>
      {!compact && (
        <ul className="mt-2 space-y-1">
          {session.exercises.map((e, i) => (
            <ExerciseRow key={i} done={e.done} name={e.name} detail={exerciseLine(e)} />
          ))}
        </ul>
      )}
    </div>
  )
}
