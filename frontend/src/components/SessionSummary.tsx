import { durationLabel } from '../lib/run'
import type { WorkoutSessionData } from '../lib/types'

/** Resumo do treino executado: tempo, exercícios e séries (no check-in e no histórico). */
export function SessionSummary({ session, compact = false }: { session: WorkoutSessionData; compact?: boolean }) {
  const done = session.exercises.filter((e) => e.done)
  const sets = session.exercises.reduce((a, e) => a + e.sets_done, 0)

  return (
    <div className="rounded-2xl bg-soft/70 p-3">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold">
        <span>⏱️ {durationLabel(session.duration_seconds)}</span>
        <span>💪 {done.length}/{session.exercises.length} exercícios</span>
        <span>🔁 {sets} séries</span>
      </div>
      {!compact && (
        <ul className="mt-2 space-y-1">
          {session.exercises.map((e, i) => (
            <li key={i} className="flex items-center justify-between gap-2 text-sm">
              <span className={`truncate ${e.done ? '' : 'text-muted line-through'}`}>
                {e.done ? '✓ ' : ''}
                {e.name}
              </span>
              <span className="shrink-0 text-muted">
                {e.sets_done}/{e.sets} × {e.reps}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
