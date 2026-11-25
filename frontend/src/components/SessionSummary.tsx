import { durationLabel } from '../lib/run'
import { isTimed, prescription } from '../lib/workout'
import type { WorkoutSessionData } from '../lib/types'

/** Resumo do treino executado: tempo, exercícios e séries (no check-in e no histórico). */
export function SessionSummary({ session, compact = false }: { session: WorkoutSessionData; compact?: boolean }) {
  const done = session.exercises.filter((e) => e.done)
  const sets = session.exercises.filter((e) => !isTimed(e)).reduce((a, e) => a + e.sets_done, 0)

  return (
    <div className="rounded-2xl bg-soft/70 p-3">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold">
        <span>⏱️ {durationLabel(session.duration_seconds)}</span>
        <span>💪 {done.length}/{session.exercises.length} {session.exercises.length === 1 ? 'exercício' : 'exercícios'}</span>
        {sets > 0 && <span>🔁 {sets} {sets === 1 ? 'série' : 'séries'}</span>}
        {session.kcal_burned != null && <span title="Estimativa média (MET × peso × tempo)">🔥 ~{session.kcal_burned} kcal</span>}
      </div>
      {!compact && (
        <ul className="mt-2 space-y-1">
          {session.exercises.map((e, i) => (
            <li key={i} className="flex items-center justify-between gap-2 text-sm">
              <span className={`truncate ${e.done ? '' : 'text-muted line-through'}`}>
                {e.done ? '✓ ' : ''}
                {e.name}
              </span>
              <span className="shrink-0 text-muted">{isTimed(e) ? prescription(e) : `${e.sets_done}/${e.sets} × ${e.reps}`}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
