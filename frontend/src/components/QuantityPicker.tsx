import { motion } from 'framer-motion'
import { fmt } from './Ring'
import { fmtQty, nutrientsFor, num, portionLabel } from '../lib/nutrition'
import type { FoodLite, Portion } from '../lib/types'

export interface QtyValue {
  quantity: string
  portionId: number | null
}

interface Props {
  food: FoodLite
  portions: Portion[]
  value: QtyValue
  onChange: (v: QtyValue) => void
  /** Esconde a opção em gramas (ex.: receitas, que são sempre por porção). */
  hideGrams?: boolean
}

/** Escolha da unidade (g/ml ou porções) + quantidade, com nutrientes ao vivo. */
export function QuantityPicker({ food, portions, value, onChange, hideGrams }: Props) {
  const portion = portions.find((p) => p.id === value.portionId) ?? null
  const q = num(value.quantity || '0')
  const amount = portion ? q * portion.qty : q
  const n = nutrientsFor(food, isFinite(amount) ? amount : 0)
  const step = portion ? 0.5 : food.base_unit === 'ml' ? 50 : 10

  const setUnit = (p: Portion | null) => {
    // Converte a quantidade para a nova unidade mantendo a "mesma comida"
    if (p && !portion) onChange({ portionId: p.id, quantity: '1' })
    else if (!p && portion) onChange({ portionId: null, quantity: fmtQty(amount).replace('.', '') })
    else onChange({ ...value, portionId: p?.id ?? null })
  }

  const bump = (d: number) => {
    const next = Math.max(0, Math.round((q + d) * 100) / 100)
    onChange({ ...value, quantity: fmtQty(next).replace('.', '') })
  }

  return (
    <div className="space-y-4">
      <div className={`flex flex-wrap gap-2 ${hideGrams ? 'hidden' : ''}`}>
        <Chip active={!portion} onClick={() => setUnit(null)}>
          {food.base_unit === 'ml' ? 'mililitros (ml)' : 'gramas (g)'}
        </Chip>
        {portions.map((p) => (
          <Chip key={p.id} active={portion?.id === p.id} onClick={() => setUnit(p)}>
            {portionLabel(p, food.base_unit)}
          </Chip>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <StepButton onClick={() => bump(-step)} label="Diminuir">
          −
        </StepButton>
        <div className="flex h-14 flex-1 items-center justify-center rounded-2xl border border-line bg-surface px-4 focus-within:border-orchid focus-within:ring-4 focus-within:ring-orchid/15">
          <input
            aria-label="Quantidade"
            inputMode="decimal"
            className="w-24 bg-transparent text-center text-2xl font-bold outline-none"
            value={value.quantity}
            onChange={(e) => onChange({ ...value, quantity: e.target.value.replace(/[^\d.,]/g, '') })}
            onFocus={(e) => e.target.select()}
          />
          <span className="text-muted">{portion ? (q === 1 ? 'porção' : 'porções') : food.base_unit}</span>
        </div>
        <StepButton onClick={() => bump(step)} label="Aumentar">
          +
        </StepButton>
      </div>

      <motion.div layout className="grid grid-cols-5 gap-1 rounded-2xl bg-soft p-3 text-center">
        <Nut label="kcal" value={n.kcal} color="text-primary" strong />
        <Nut label="carb" value={n.carbs} unit="g" color="text-lavender" />
        <Nut label="prot" value={n.protein} unit="g" color="text-pink" />
        <Nut label="gord" value={n.fat} unit="g" color="text-violet" />
        <Nut label="sódio" value={n.sodium} unit="mg" color="text-coral" />
      </motion.div>
      {portion && (
        <p className="-mt-2 text-center text-xs text-muted">
          Total: {fmt(amount)} {food.base_unit}
        </p>
      )}
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${active ? 'bg-primary text-white' : 'bg-soft text-ink hover:bg-line'}`}
    >
      {children}
    </button>
  )
}

function StepButton({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className="flex size-14 items-center justify-center rounded-2xl bg-soft text-2xl font-semibold text-primary transition-transform active:scale-90">
      {children}
    </button>
  )
}

function Nut({ label, value, unit = '', color, strong }: { label: string; value: number; unit?: string; color: string; strong?: boolean }) {
  return (
    <div>
      <p className={`${strong ? 'text-lg' : 'text-base'} font-bold ${color}`}>
        {fmt(value)}
        <span className="text-[10px] font-medium">{unit}</span>
      </p>
      <p className="text-[11px] text-muted">{label}</p>
    </div>
  )
}
