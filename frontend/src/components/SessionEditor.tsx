import { useBottomInset } from '../lib/viewport'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api, ApiError } from '../lib/api'
import type { Exercise, SessionExercise, WorkoutSessionData } from '../lib/types'
import { isTimed, prescription } from '../lib/workout'
import { ExercisePicker } from './ExercisePicker'
import { SetsSheet } from './SetsSheet'
import { useToast } from './Toast'
import { Alert, BackButton, Button, Field } from './ui'

type Row = SessionExercise & { key: string }

/** Corpo do PUT a partir de um treino (também usado para desfazer a edição). */
const bodyOf = (name: string, minutes: number, rows: SessionExercise[]) => ({
  workout_name: name,
  duration_minutes: minutes,
  exercises: rows.map(({ name, muscle_group, image, sets, reps, sets_done, done, loads, distance_km }) => ({ name, muscle_group, image, sets, reps, sets_done, done, loads: loads ?? [], distance_km: distance_km ?? null })),
})

/**
 * Corrigir um treino já finalizado: nome, duração, séries feitas, tempo e km do cardio,
 * tirar ou incluir exercícios. O gasto estimado é recalculado. Dá para desfazer.
 */
export function SessionEditor({ session, open, onClose, onSaved }: { session: WorkoutSessionData; open: boolean; onClose: () => void; onSaved: (s: WorkoutSessionData) => void }) {
  const toast = useToast()
  const [name, setName] = useState(session.workout_name)
  const [minutes, setMinutes] = useState(String(Math.max(1, Math.round(session.duration_seconds / 60))))
  const [rows, setRows] = useState<Row[]>([])
  const [picking, setPicking] = useState(false)
  const [editing, setEditing] = useState<{ row: Row; index: number | null } | null>(null)
  const [saving, setSaving] = useState(false)
  const bottomInset = useBottomInset()
  const [error, setError] = useState<ApiError | null>(null)

  useEffect(() => {
    if (!open) return
    setName(session.workout_name)
    setMinutes(String(Math.max(1, Math.round(session.duration_seconds / 60))))
    setRows(session.exercises.map((e, i) => ({ ...e, key: `${i}-${e.name}` })))
    setError(null)
  }, [open, session])

  const update = (i: number, patch: Partial<Row>) => setRows((l) => l.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const min = Math.max(1, Math.min(360, Number(minutes) || 1))

  const save = async () => {
    setSaving(true)
    setError(null)
    const before = bodyOf(session.workout_name, Math.max(1, Math.round(session.duration_seconds / 60)), session.exercises)
    try {
      const r = await api<{ session: WorkoutSessionData }>(`/workout-sessions/${session.id}`, { method: 'PUT', body: bodyOf(name.trim() || session.workout_name, min, rows) })
      onSaved(r.session)
      onClose()
      toast({
        text: 'Treino atualizado ✓',
        action: {
          label: 'Desfazer',
          run: () => api<{ session: WorkoutSessionData }>(`/workout-sessions/${session.id}`, { method: 'PUT', body: before }).then((x) => onSaved(x.session)).catch(() => {}),
        },
      })
    } catch (e) {
      setError(e as ApiError)
    } finally {
      setSaving(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-40 overflow-y-auto bg-bg" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 380, damping: 38 }}>
          <div className="safe-top mx-auto max-w-lg px-5 pt-4 pb-32">
            <header className="mb-4 flex items-center gap-3">
              <BackButton onClick={onClose} label="Fechar sem salvar" icon="close" />
              <h2 className="text-xl font-bold">Editar treino</h2>
            </header>

            {error && <div className="mb-3"><Alert>{error.message}</Alert></div>}

            <div className="mb-5 grid grid-cols-3 gap-3">
              <Field className="col-span-2" label="Nome" name="workout_name" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
              <Field label="Duração" name="duration_minutes" suffix="min" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value.replace(/\D/g, '').slice(0, 3))} />
            </div>

            <p className="mb-2 text-sm font-medium text-muted">Exercícios</p>
            <ul className="space-y-2">
              {rows.map((r, i) => (
                <li key={r.key} className={`flex items-center gap-3 rounded-2xl p-2 pr-1 shadow-[0_2px_12px_-4px_rgba(31,23,36,0.08)] ${r.done ? 'bg-surface' : 'bg-soft/70'}`}>
                  <button
                    onClick={() => update(i, isTimed(r) ? { done: !r.done, sets_done: r.done ? 0 : 1 } : { done: !r.done, sets_done: r.done ? 0 : r.sets })}
                    aria-label={r.done ? `Marcar ${r.name} como não feito` : `Marcar ${r.name} como feito`}
                    aria-pressed={r.done}
                    className={`flex size-9 shrink-0 items-center justify-center rounded-full border-2 ${r.done ? 'border-primary bg-primary text-white' : 'border-line text-transparent'}`}
                  >
                    <Check className="size-5" strokeWidth={3} />
                  </button>
                  <button onClick={() => setEditing({ row: r, index: i })} className="min-w-0 flex-1 text-left">
                    <p className={`truncate text-sm font-medium ${r.done ? '' : 'text-muted'}`}>{r.name}</p>
                    <p className="text-xs font-semibold text-link">{prescription(r)}</p>
                  </button>
                  {!isTimed(r) && r.done && (
                    <span className="flex shrink-0 items-center gap-1" aria-label="Séries feitas">
                      <button aria-label="Menos uma série feita" onClick={() => update(i, { sets_done: Math.max(0, r.sets_done - 1), done: r.sets_done - 1 > 0 })} className="flex size-8 items-center justify-center rounded-lg bg-soft font-bold text-link">−</button>
                      <span className="w-9 text-center text-sm font-bold">{r.sets_done}/{r.sets}</span>
                      <button aria-label="Mais uma série feita" onClick={() => update(i, { sets_done: Math.min(r.sets, r.sets_done + 1), done: true })} className="flex size-8 items-center justify-center rounded-lg bg-soft font-bold text-link">+</button>
                    </span>
                  )}
                  <button aria-label={`Tirar ${r.name}`} onClick={() => setRows((l) => l.filter((_, j) => j !== i))} disabled={rows.length === 1} className="flex size-10 shrink-0 items-center justify-center rounded-full text-muted active:bg-soft disabled:opacity-30">
                    <X className="size-5" />
                  </button>
                </li>
              ))}
            </ul>
            <button onClick={() => setPicking(true)} className="mt-3 w-full rounded-2xl border-2 border-dashed border-line py-4 text-sm font-semibold text-link">
              + Incluir exercício
            </button>
            <p className="mt-3 text-center text-xs text-muted">As calorias gastas são recalculadas ao salvar.</p>
          </div>

          <div style={{ bottom: bottomInset }} className="safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/90 backdrop-blur-lg">
            <div className="mx-auto max-w-lg px-5 py-3">
              <Button onClick={save} loading={saving} disabled={rows.length === 0}>Salvar alterações</Button>
            </div>
          </div>

          <ExercisePicker
            open={picking}
            onClose={() => setPicking(false)}
            onPick={(e: Exercise) => {
              setPicking(false)
              setEditing({ row: { key: `n-${Date.now()}`, name: e.name, muscle_group: e.muscle_group, image: e.image, sets: 3, reps: '12', sets_done: 3, done: true, loads: [] }, index: null })
            }}
          />
          <SetsSheet
            item={editing ? { exercise: { id: 0, user_id: null, name: editing.row.name, muscle_group: editing.row.muscle_group ?? '', image: editing.row.image }, sets: editing.row.sets, reps: editing.row.reps, notes: null, distance_km: editing.row.distance_km ?? null } : null}
            isNew={editing?.index === null}
            withDistance
            onClose={() => setEditing(null)}
            onSave={(v) => {
              const old = editing!.row
              const timed = isTimed(v)
              const row: Row = {
                ...old,
                sets: v.sets,
                reps: v.reps,
                distance_km: v.distance_km ?? null,
                sets_done: timed ? 1 : editing!.index === null ? v.sets : Math.min(old.sets_done, v.sets),
                done: editing!.index === null ? true : old.done,
              }
              if (editing!.index === null) setRows((l) => [...l, row])
              else setRows((l) => l.map((x, j) => (j === editing!.index ? row : x)))
              setEditing(null)
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
