import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { Sheet } from './Sheet'
import { Button, Field } from './ui'
import { defaultPrescription, isTimed, minutesOf, SECONDS_RE, secondsOf } from '../lib/workout'
import type { Exercise } from '../lib/types'

const REPS_SUGGESTIONS = ['8', '10', '12', '15', '8-12', 'até a falha']
const SECONDS_SUGGESTIONS = [15, 20, 30, 45, 60, 90]
const MINUTES_SUGGESTIONS = [10, 15, 20, 30, 40, 45, 60]

export interface SetsValue {
  sets: number
  reps: string
  notes: string | null
  distance_km?: number | null
}

type Mode = 'reps' | 'seconds' | 'cardio'

interface Props {
  item: (SetsValue & { exercise: Exercise }) | null
  isNew: boolean
  withNotes?: boolean
  /** Cardio: mostra o campo de distância (treino feito / em andamento) */
  withDistance?: boolean
  saveLabel?: string
  onClose: () => void
  onSave: (v: SetsValue) => void
}

const modeOf = (reps: string, sets: number): Mode => (isTimed({ sets, reps }) ? 'cardio' : SECONDS_RE.test(reps.trim()) ? 'seconds' : 'reps')

/**
 * Como medir um exercício:
 * - Repetições: 3 × 12
 * - Segundos: 4 × 60 s (prancha, isometria)
 * - Cardio: 30 min (+ km opcional)
 * Exercícios novos já vêm configurados pelo tipo (ex.: prancha → 3 × 30 s).
 */
export function SetsSheet({ item, isNew, withNotes = false, withDistance = false, saveLabel, onClose, onSave }: Props) {
  const [mode, setMode] = useState<Mode>('reps')
  const [sets, setSets] = useState(3)
  const [reps, setReps] = useState('12')
  const [seconds, setSeconds] = useState(30)
  const [minutes, setMinutes] = useState('30')
  const [km, setKm] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!item) return
    const base = isNew ? defaultPrescription(item.exercise) : { sets: item.sets, reps: item.reps }
    const m = modeOf(base.reps, base.sets)
    setMode(m)
    setSets(m === 'cardio' ? 3 : base.sets)
    setReps(m === 'reps' ? base.reps : '12')
    setSeconds(m === 'seconds' ? secondsOf(base.reps) : 30)
    setMinutes(m === 'cardio' ? String(minutesOf(base.reps)) : '30')
    setKm(item.distance_km ? String(item.distance_km).replace('.', ',') : '')
    setNotes(item.notes ?? '')
  }, [item, isNew])

  const min = Math.max(1, Math.min(300, Number(minutes) || 0))
  const kmNum = Number(km.replace(',', '.')) || 0
  const label = mode === 'cardio' ? `${min} min` : mode === 'seconds' ? `${sets} × ${seconds} s` : `${sets} × ${reps || '12'}`

  const save = () => {
    const n = notes.trim() || null
    if (mode === 'cardio') onSave({ sets: 1, reps: `${min} min`, notes: n, distance_km: kmNum > 0 ? Math.min(kmNum, 500) : null })
    else if (mode === 'seconds') onSave({ sets, reps: `${seconds} s`, notes: n, distance_km: null })
    else onSave({ sets, reps: reps.trim() || '12', notes: n, distance_km: null })
  }

  const setsStepper = (
    <div>
      <p className="mb-2 text-sm font-medium text-muted">Séries</p>
      <div className="flex items-center justify-center gap-4">
        <button aria-label="Menos séries" onClick={() => setSets((s) => Math.max(1, s - 1))} className="flex size-14 items-center justify-center rounded-2xl bg-soft text-2xl font-semibold text-primary active:scale-90">−</button>
        <span className="w-16 text-center text-4xl font-bold">{sets}</span>
        <button aria-label="Mais séries" onClick={() => setSets((s) => Math.min(10, s + 1))} className="flex size-14 items-center justify-center rounded-2xl bg-soft text-2xl font-semibold text-primary active:scale-90">+</button>
      </div>
    </div>
  )

  const chip = (active: boolean) => `rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors ${active ? 'border-primary bg-primary text-white' : 'border-line bg-surface text-ink'}`

  return (
    <Sheet open={!!item} onClose={onClose} title={item?.exercise.name}>
      {item && (
        <div className="space-y-5">
          <div className="flex rounded-2xl bg-soft p-1" role="tablist" aria-label="Como medir">
            {([['reps', 'Repetições'], ['seconds', 'Segundos'], ['cardio', 'Cardio']] as const).map(([k, l]) => (
              <button key={k} role="tab" aria-selected={mode === k} onClick={() => setMode(k)} className="relative flex-1 rounded-xl py-2.5 text-sm font-semibold">
                {mode === k && <motion.span layoutId="sets-mode" className="absolute inset-0 rounded-xl bg-surface shadow-sm" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
                <span className={`relative ${mode === k ? 'text-primary' : 'text-muted'}`}>{l}</span>
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait" initial={false}>
            {mode === 'reps' && (
              <motion.div key="reps" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-5">
                {setsStepper}
                <div>
                  <p className="mb-2 text-sm font-medium text-muted">Repetições por série</p>
                  <div className="mb-2 flex flex-wrap gap-2">
                    {REPS_SUGGESTIONS.map((r) => (
                      <button key={r} onClick={() => setReps(r)} className={chip(reps === r)}>{r}</button>
                    ))}
                  </div>
                  <Field label="Ou digite" name="reps" maxLength={20} value={reps} onChange={(e) => setReps(e.target.value)} />
                </div>
              </motion.div>
            )}

            {mode === 'seconds' && (
              <motion.div key="seconds" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-5">
                {setsStepper}
                <div>
                  <p className="mb-2 text-sm font-medium text-muted">Tempo por série</p>
                  <div className="flex items-center justify-center gap-4">
                    <button aria-label="Menos 5 segundos" onClick={() => setSeconds((s) => Math.max(5, s - 5))} className="flex size-14 items-center justify-center rounded-2xl bg-soft text-lg font-semibold text-primary active:scale-90">−5</button>
                    <span className="w-24 text-center text-4xl font-bold">{seconds}<span className="text-lg font-semibold text-muted"> s</span></span>
                    <button aria-label="Mais 5 segundos" onClick={() => setSeconds((s) => Math.min(600, s + 5))} className="flex size-14 items-center justify-center rounded-2xl bg-soft text-lg font-semibold text-primary active:scale-90">+5</button>
                  </div>
                  <div className="mt-3 flex flex-wrap justify-center gap-2">
                    {SECONDS_SUGGESTIONS.map((s) => (
                      <button key={s} onClick={() => setSeconds(s)} className={chip(seconds === s)}>{s} s</button>
                    ))}
                  </div>
                </div>
                <p className="text-center text-xs text-muted">Para prancha e exercícios parados. No treino, cada série vira um cronômetro.</p>
              </motion.div>
            )}

            {mode === 'cardio' && (
              <motion.div key="cardio" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-4">
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
                    <button key={m} onClick={() => setMinutes(String(m))} className={chip(min === m)}>{m} min</button>
                  ))}
                </div>
                {withDistance && (
                  <Field
                    label="Distância (opcional)"
                    name="distance_km"
                    suffix="km"
                    inputMode="decimal"
                    placeholder="ex.: 5"
                    hint="Com a distância, o gasto de corrida, caminhada e bike fica mais preciso."
                    value={km}
                    onChange={(e) => setKm(e.target.value.replace(/[^\d.,]/g, '').slice(0, 6))}
                  />
                )}
                {!withDistance && <p className="text-center text-xs text-muted">Esteira, bike, escada… No treino, vira um cronômetro.</p>}
              </motion.div>
            )}
          </AnimatePresence>

          {withNotes && (
            <Field label="Observação (opcional)" name="notes" maxLength={200} placeholder={mode === 'cardio' ? 'ex.: inclinação 8, velocidade 6' : 'ex.: drop-set na última série'} value={notes} onChange={(e) => setNotes(e.target.value)} />
          )}

          <Button onClick={save}>{saveLabel ?? (isNew ? `Adicionar ${label}` : 'Salvar')}</Button>
        </div>
      )}
    </Sheet>
  )
}
