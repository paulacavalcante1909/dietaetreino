import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { Sheet } from './Sheet'
import { Button, Field } from './ui'
import { isTimed, minutesOf } from '../lib/workout'
import type { Exercise } from '../lib/types'

const REPS_SUGGESTIONS = ['8', '10', '12', '15', '8-12', 'até a falha', '30 s']
const MINUTES_SUGGESTIONS = [10, 15, 20, 30, 40, 45, 60]

export interface SetsValue {
  sets: number
  reps: string
  notes: string | null
}

interface Props {
  item: (SetsValue & { exercise: Exercise }) | null
  isNew: boolean
  withNotes?: boolean
  saveLabel?: string
  onClose: () => void
  onSave: (v: SetsValue) => void
}

/** Definir "séries × repetições" ou "tempo" (cardio) de um exercício. */
export function SetsSheet({ item, isNew, withNotes = false, saveLabel, onClose, onSave }: Props) {
  const [mode, setMode] = useState<'series' | 'time'>('series')
  const [sets, setSets] = useState(3)
  const [reps, setReps] = useState('12')
  const [minutes, setMinutes] = useState('30')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!item) return
    const timed = isTimed(item) || (isNew && item.exercise.muscle_group === 'cardio')
    setMode(timed ? 'time' : 'series')
    setSets(timed ? 3 : item.sets)
    setReps(timed ? '12' : item.reps)
    setMinutes(isTimed(item) ? String(minutesOf(item.reps)) : '30')
    setNotes(item.notes ?? '')
  }, [item, isNew])

  const min = Math.max(1, Math.min(300, Number(minutes) || 0))
  const label = mode === 'time' ? `${min} min` : `${sets} × ${reps || '12'}`

  const save = () =>
    onSave(
      mode === 'time'
        ? { sets: 1, reps: `${min} min`, notes: notes.trim() || null }
        : { sets, reps: reps.trim() || '12', notes: notes.trim() || null },
    )

  return (
    <Sheet open={!!item} onClose={onClose} title={item?.exercise.name}>
      {item && (
        <div className="space-y-5">
          {/* Modo */}
          <div className="flex rounded-2xl bg-soft p-1" role="tablist" aria-label="Como medir">
            {([['series', 'Séries × repetições'], ['time', 'Tempo']] as const).map(([k, l]) => (
              <button key={k} role="tab" aria-selected={mode === k} onClick={() => setMode(k)} className="relative flex-1 rounded-xl py-2.5 text-sm font-semibold">
                {mode === k && <motion.span layoutId="sets-mode" className="absolute inset-0 rounded-xl bg-surface shadow-sm" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
                <span className={`relative ${mode === k ? 'text-primary' : 'text-muted'}`}>{l}</span>
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait" initial={false}>
            {mode === 'series' ? (
              <motion.div key="series" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-5">
                <div>
                  <p className="mb-2 text-sm font-medium text-muted">Séries</p>
                  <div className="flex items-center justify-center gap-4">
                    <button aria-label="Menos séries" onClick={() => setSets((s) => Math.max(1, s - 1))} className="flex size-14 items-center justify-center rounded-2xl bg-soft text-2xl font-semibold text-primary active:scale-90">−</button>
                    <span className="w-16 text-center text-4xl font-bold">{sets}</span>
                    <button aria-label="Mais séries" onClick={() => setSets((s) => Math.min(10, s + 1))} className="flex size-14 items-center justify-center rounded-2xl bg-soft text-2xl font-semibold text-primary active:scale-90">+</button>
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium text-muted">Repetições</p>
                  <div className="mb-2 flex flex-wrap gap-2">
                    {REPS_SUGGESTIONS.map((r) => (
                      <button key={r} onClick={() => setReps(r)} className={`rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${reps === r ? 'bg-primary text-white' : 'bg-soft'}`}>{r}</button>
                    ))}
                  </div>
                  <Field label="Ou digite" name="reps" maxLength={20} value={reps} onChange={(e) => setReps(e.target.value)} />
                </div>
              </motion.div>
            ) : (
              <motion.div key="time" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-4">
                <div className="flex items-center justify-center gap-4">
                  <button aria-label="Menos 5 minutos" onClick={() => setMinutes(String(Math.max(1, min - 5)))} className="flex size-14 items-center justify-center rounded-2xl bg-soft text-lg font-semibold text-primary active:scale-90">−5</button>
                  <div className="flex items-baseline gap-1">
                    <input
                      aria-label="Minutos"
                      inputMode="numeric"
                      value={minutes}
                      onChange={(e) => setMinutes(e.target.value.replace(/\D/g, '').slice(0, 3))}
                      onFocus={(e) => e.target.select()}
                      className="w-20 bg-transparent text-center text-4xl font-bold outline-none"
                    />
                    <span className="text-lg font-semibold text-muted">min</span>
                  </div>
                  <button aria-label="Mais 5 minutos" onClick={() => setMinutes(String(Math.min(300, min + 5)))} className="flex size-14 items-center justify-center rounded-2xl bg-soft text-lg font-semibold text-primary active:scale-90">+5</button>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {MINUTES_SUGGESTIONS.map((m) => (
                    <button key={m} onClick={() => setMinutes(String(m))} className={`rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${min === m ? 'bg-primary text-white' : 'bg-soft'}`}>{m} min</button>
                  ))}
                </div>
                <p className="text-center text-xs text-muted">Ideal para cardio (esteira, bike, escada…). No treino, vira um cronômetro.</p>
              </motion.div>
            )}
          </AnimatePresence>

          {withNotes && (
            <Field label="Observação (opcional)" name="notes" maxLength={200} placeholder={mode === 'time' ? 'ex.: inclinação 8, velocidade 6' : 'ex.: drop-set na última série'} value={notes} onChange={(e) => setNotes(e.target.value)} />
          )}

          <Button onClick={save}>{saveLabel ?? (isNew ? `Adicionar ${label}` : 'Salvar')}</Button>
        </div>
      )}
    </Sheet>
  )
}
