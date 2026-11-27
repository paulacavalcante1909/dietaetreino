import { api } from './api'
import { fmtQty, pluralize } from './nutrition'
import type { FoodDetail, FoodLite } from './types'

/**
 * "Montar o prato": alimentos escolhidos na lista, com a quantidade ajustada ali mesmo (− e +),
 * registrados juntos com um toque.
 */
export interface PlateItem {
  food: FoodLite
  quantity: number // em porções (portion_id) ou em g/ml
  portion_id: number | null
  unit_label: string // "unidade (50 g)", "g"…
  kcalPerUnit: number
}

/** Passo do − e +: meia porção caseira, ou 10 g/ml */
export const plateStep = (i: PlateItem) => (i.portion_id ? 0.5 : 10)

export const plateKcal = (i: PlateItem) => i.quantity * i.kcalPerUnit

/** "2 unidade média", "1,5 × fatia" ou "150 g" */
export function plateQtyLabel(i: PlateItem) {
  if (!i.portion_id) return `${fmtQty(i.quantity)} ${i.unit_label}`
  const label = i.unit_label.replace(/\s*\(.*\)$/, '')
  // "1 unidade média" → "1,5 unidade média"
  const m = label.match(/^1\s+(.+)$/)
  return m ? `${fmtQty(i.quantity)} ${i.quantity > 1 ? pluralize(m[1]) : m[1]}` : `${fmtQty(i.quantity)} × ${label}`
}

/**
 * Quantidade inicial: a da última vez; sem histórico, 1 medida caseira (ex.: 1 unidade)
 * ou a porção de referência (100 g).
 */
export async function newPlateItem(food: FoodLite): Promise<PlateItem> {
  if (food.last && food.last.quantity > 0)
    return { food, quantity: food.last.quantity, portion_id: food.last.portion_id, unit_label: food.last.unit_label, kcalPerUnit: food.last.kcal / food.last.quantity }

  const detail = await api<{ food: FoodDetail }>(`/foods/${food.id}`).then((r) => r.food).catch(() => null)
  const portion = detail?.portions[0]
  if (portion) return { food, quantity: 1, portion_id: portion.id, unit_label: `${portion.label} (${fmtQty(portion.qty)} ${food.base_unit})`, kcalPerUnit: (food.kcal * portion.qty) / food.base_qty }
  return { food, quantity: food.base_qty, portion_id: null, unit_label: food.base_unit, kcalPerUnit: food.kcal / food.base_qty }
}

/** Depois de escolher outra medida na ficha do alimento */
export function plateItemFrom(food: FoodDetail, quantity: number, portionId: number | null): PlateItem {
  const portion = food.portions.find((p) => p.id === portionId)
  return portion
    ? { food, quantity, portion_id: portion.id, unit_label: `${portion.label} (${fmtQty(portion.qty)} ${food.base_unit})`, kcalPerUnit: (food.kcal * portion.qty) / food.base_qty }
    : { food, quantity, portion_id: null, unit_label: food.base_unit, kcalPerUnit: food.kcal / food.base_qty }
}
