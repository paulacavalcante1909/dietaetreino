import { Check } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { OBJECTIVES, suggestGoals, type Objective } from '../lib/goalSuggestion'
import type { Energy, Goal } from '../lib/types'
import { AboutYouForm } from './AboutYouForm'
import { fmtKcal } from './Ring'
import { Sheet } from './Sheet'

type Suggested = ReturnType<typeof suggestGoals>
type AvailableEnergy = Extract<Energy, { available: true }>

/** Escolha do objetivo: mostra as calorias de cada opção e aplica a sugestão escolhida. */
export function ObjectivePicker({ energy, selected, onApply }: { energy: AvailableEnergy; selected?: Objective | null; onApply: (goal: Suggested, objective: Objective) => void }) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted">
        Seu corpo gasta cerca de <strong className="text-ink">{fmtKcal(energy.get)} kcal</strong> por dia. Qual é o seu objetivo?
      </p>
      {OBJECTIVES.map((o) => {
        const g = suggestGoals(energy, o.key)
        const active = selected === o.key
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onApply(g, o.key)}
            aria-pressed={active}
            className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left transition ${active ? 'bg-primary text-white' : 'bg-surface shadow-sm active:scale-[0.99]'}`}
          >
            <div className="min-w-0 flex-1">
              <p className="font-bold">{o.label}</p>
              <p className={`text-xs ${active ? 'text-white/85' : 'text-muted'}`}>{o.hint}</p>
            </div>
            <span className="shrink-0 text-right">
              <span className="block font-extrabold">{fmtKcal(g.kcal)} kcal</span>
              <span className={`block text-xs ${active ? 'text-white/85' : 'text-muted'}`}>{g.protein_g} g de proteína</span>
            </span>
            {active && <Check className="size-5 shrink-0" strokeWidth={3} />}
          </button>
        )
      })}
      <p className="pt-1 text-xs text-muted">Gordura em 25% das calorias e o restante em carboidrato. Você pode ajustar qualquer número depois.</p>
    </div>
  )
}

/** "Sugerir minhas metas": pede os dados do corpo se faltarem e depois o objetivo. */
export function SuggestGoalsSheet({ open, onClose, onApply }: { open: boolean; onClose: () => void; onApply: (goal: Partial<Goal>) => void }) {
  const [energy, setEnergy] = useState<Energy | null>(null)

  useEffect(() => {
    if (!open) return
    setEnergy(null)
    api<{ energy: Energy }>('/me/energy').then((r) => setEnergy(r.energy)).catch(() => setEnergy({ available: false, missing: [] }))
  }, [open])

  return (
    <Sheet open={open} onClose={onClose} title="Sugerir minhas metas">
      {!energy && <div className="h-48 animate-pulse rounded-2xl bg-soft" />}
      {energy && !energy.available && (
        <div className="space-y-3">
          <p className="text-sm text-muted">Para sugerir, precisamos de alguns dados seus. Eles ficam só na sua conta.</p>
          <AboutYouForm askWeight={energy.missing.length === 0 || energy.missing.includes('weight')} onDone={setEnergy} submitLabel="Ver sugestões" />
        </div>
      )}
      {energy?.available && (
        <ObjectivePicker
          energy={energy}
          onApply={(g) => {
            onApply(g)
            onClose()
          }}
        />
      )}
    </Sheet>
  )
}
