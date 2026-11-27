import type { Entry, FoodLite, Nutrients, Portion } from './types'

/** Nutrientes para uma quantidade (em g/ml) de um alimento. */
export function nutrientsFor(food: FoodLite, amount: number): Nutrients {
  const f = food.base_qty > 0 ? amount / food.base_qty : 0
  const r = (n: number) => Math.round(n * f * 10) / 10
  return { kcal: r(food.kcal), carbs: r(food.carbs), protein: r(food.protein), fat: r(food.fat), sodium: r(food.sodium), fiber: r(food.fiber ?? 0) }
}

export const num = (s: string) => Number(s.replace(',', '.'))

export const fmtQty = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })

/** Plural de uma palavra em português: porção→porções, colher→colheres, unidade→unidades. */
function pluralWord(w: string): string {
  if (/[sx]$/i.test(w) || !/[a-zà-ú]$/i.test(w) || w.length <= 2 || /^(und|kcal)$/i.test(w)) return w // já no plural, número ou abreviação (g, ml, kg, un)
  if (/ão$/i.test(w)) return w.replace(/ão$/i, 'ões')
  if (/[rz]$/i.test(w)) return `${w}es`
  if (/al$/i.test(w)) return w.replace(/al$/i, 'ais')
  if (/el$/i.test(w)) return w.replace(/el$/i, 'éis')
  if (/ol$/i.test(w)) return w.replace(/ol$/i, 'óis')
  if (/m$/i.test(w)) return w.replace(/m$/i, 'ns')
  return `${w}s`
}

const PREPOSITIONS = new Set(['de', 'da', 'do', 'das', 'dos', 'com', 'sem', 'em', 'para', 'p/', 'c/'])

/**
 * Plural de uma medida caseira: as palavras até a primeira preposição.
 * "unidade média" → "unidades médias", "fatia de pão" → "fatias de pão", "porção" → "porções".
 */
export function pluralize(label: string): string {
  const words = label.split(/\s+/)
  const stop = words.findIndex((w) => PREPOSITIONS.has(w.toLowerCase()))
  return words.map((w, i) => (stop === -1 || i < stop ? pluralWord(w) : w)).join(' ')
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
