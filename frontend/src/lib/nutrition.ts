import type { Entry, FoodLite, Nutrients, Portion } from './types'

/** Nutrientes para uma quantidade (em g/ml) de um alimento. */
export function nutrientsFor(food: FoodLite, amount: number): Nutrients {
  const f = food.base_qty > 0 ? amount / food.base_qty : 0
  const r = (n: number) => Math.round(n * f * 10) / 10
  return { kcal: r(food.kcal), carbs: r(food.carbs), protein: r(food.protein), fat: r(food.fat), sodium: r(food.sodium), fiber: r(food.fiber ?? 0) }
}

export const num = (s: string) => Number(s.replace(',', '.'))

export const fmtQty = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })

/** Plural simples da primeira palavra: unidade→unidades, colher→colheres. */
function pluralize(label: string): string {
  return label.replace(/^(\S+)/, (w) => (/[sS]$/.test(w) ? w : /[rzRZ]$/.test(w) ? `${w}es` : `${w}s`))
}

/** "1,5 unidade · 75 g", "2 fatias · 50 g" ou "150 g". */
export function entryQtyLabel(e: Pick<Entry, 'quantity' | 'unit_label' | 'amount' | 'base_unit'>): string {
  if (!e.unit_label.includes('(')) return `${fmtQty(e.quantity)} ${e.unit_label}`
  // unit_label vem como "1 unidade (50 g)": tira o "1 " e os parênteses
  const name = e.unit_label.replace(/\s*\(.*?\)/g, '').replace(/^1\s+/, '')
  return `${fmtQty(e.quantity)} ${e.quantity > 1 ? pluralize(name) : name} · ${fmtQty(e.amount)} ${e.base_unit}`
}

/** Rótulo de referência do alimento: "por 100 g" ou "por 30 g". */
export const baseLabel = (f: FoodLite) => `${fmtQty(f.base_qty)} ${f.base_unit}`

export const portionLabel = (p: Portion, unit: string) => `${p.label} (${fmtQty(p.qty)} ${unit})`
