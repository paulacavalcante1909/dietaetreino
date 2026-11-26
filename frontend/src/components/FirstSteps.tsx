import { Check, ChevronRight, Dumbbell, Scale, Utensils, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import type { DayData, WeightSummary } from '../lib/types'
import { openTrain } from './Layout'
import { Card } from './ui'

const KEY = 'dt_first_steps'
type Step = 'meal' | 'training' | 'weight'

/**
 * "Comece por aqui": os três primeiros passos de quem acabou de criar a conta.
 * Cada passo feito ganha ✓ (fica guardado no aparelho); some quando os três estão feitos ou se fechar.
 */
export function FirstSteps({ day }: { day: DayData }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [state, setState] = useState<{ done: Step[]; hidden?: boolean }>(() => JSON.parse(localStorage.getItem(KEY) ?? '{"done":[]}'))
  const [hasWeight, setHasWeight] = useState(false)

  const isNew = user ? Date.now() - new Date(user.created_at).getTime() < 14 * 86_400_000 : false

  useEffect(() => {
    if (isNew && !state.hidden) api<{ summary: WeightSummary }>('/weights?range=30').then((r) => setHasWeight(r.summary.current !== null)).catch(() => {})
  }, [isNew, state.hidden])

  // O que já foi feito hoje também conta (e fica guardado)
  const done = new Set(state.done)
  if (day.meals.some((m) => m.entries.length > 0)) done.add('meal')
  if (day.trainings.length > 0) done.add('training')
  if (hasWeight) done.add('weight')

  useEffect(() => {
    if (done.size !== state.done.length) {
      const next = { ...state, done: [...done] }
      localStorage.setItem(KEY, JSON.stringify(next))
      setState(next)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done.size])

  if (!isNew || state.hidden || done.size === 3) return null

  const hide = () => {
    const next = { ...state, hidden: true }
    localStorage.setItem(KEY, JSON.stringify(next))
    setState(next)
  }

  const steps: { key: Step; label: string; icon: typeof Utensils; run: () => void }[] = [
    { key: 'meal', label: 'Registre uma refeição', icon: Utensils, run: () => navigate('/adicionar') },
    { key: 'training', label: 'Registre um treino', icon: Dumbbell, run: openTrain },
    { key: 'weight', label: 'Registre seu peso', icon: Scale, run: () => navigate('/progresso?aba=peso&registrar=1') },
  ]

  return (
    <Card className="!p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="font-bold">Comece por aqui</p>
          <p className="text-xs text-muted">{done.size} de 3 feitos</p>
        </div>
        <button onClick={hide} aria-label="Fechar o guia de primeiros passos" className="flex size-9 items-center justify-center rounded-full text-muted active:bg-soft">
          <X className="size-5" />
        </button>
      </div>
      <ul className="space-y-2">
        {steps.map((s) => {
          const ok = done.has(s.key)
          return (
            <li key={s.key}>
              <button onClick={s.run} disabled={ok} className="flex w-full items-center gap-3 rounded-2xl bg-soft p-3 text-left active:scale-[0.98] disabled:active:scale-100">
                <span className={`flex size-9 shrink-0 items-center justify-center rounded-full ${ok ? 'bg-primary text-white' : 'bg-surface text-link'}`}>
                  {ok ? <Check className="size-5" strokeWidth={3} /> : <s.icon className="size-5" />}
                </span>
                <span className={`flex-1 font-semibold ${ok ? 'text-muted' : ''}`}>{s.label}</span>
                {!ok && <ChevronRight className="size-5 text-muted" />}
              </button>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
