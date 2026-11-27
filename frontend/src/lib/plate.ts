import type { RecipeAdjustment } from '../components/RecipeSheet'
import { fmtQty, pluralize } from './nutrition'
import type { FoodDetail, RecipeSummary } from './types'

/**
 * "Prato": o que vai entrar na refeição. Cada alimento (ou refeição completa) é escolhido
 * na ficha ("Usar no prato") e tudo é registrado junto no fim.
 */
export type PlateItem =
  | {
      key: string
      kind: 'food'
      food: FoodDetail
      quantity: number // em porções (portion_id) ou em g/ml
      portion_id: number | null
      unit_label: string // "1 unidade média (50 g)", "g"…
      kcalPerUnit: number
    }
  | {
      key: string
      kind: 'recipe'
      recipe: RecipeSummary
      servings: number
      items: RecipeAdjustment[] | null // ingredientes ajustados só para este registro
    }

export const plateName = (i: PlateItem) => (i.kind === 'food' ? (i.food.display_name || i.food.name).split(',')[0] : i.recipe.name)

export const plateKcal = (i: PlateItem) => (i.kind === 'food' ? i.quantity * i.kcalPerUnit : i.recipe.per_serving.kcal * i.servings)

/** "2 unidades médias", "1,5 × fatia", "150 g" ou "1 porção (ajustada)" */
export function plateQtyLabel(i: PlateItem) {
  if (i.kind === 'recipe') return `${fmtQty(i.servings)} ${i.servings > 1 ? 'porções' : 'porção'}${i.items ? ' (ajustada)' : ''}`
  if (!i.portion_id) return `${fmtQty(i.quantity)} ${i.unit_label}`
  const label = i.unit_label.replace(/\s*\(.*\)$/, '')
  const m = label.match(/^1\s+(.+)$/)
  return m ? `${fmtQty(i.quantity)} ${i.quantity > 1 ? pluralize(m[1]) : m[1]}` : `${fmtQty(i.quantity)} × ${label}`
}

/** Item de alimento a partir da ficha (quantidade e medida escolhidas) */
export function foodPlateItem(food: FoodDetail, quantity: number, portionId: number | null): PlateItem {
  const portion = food.portions.find((p) => p.id === portionId)
  return portion
    ? { key: `f-${food.id}`, kind: 'food', food, quantity, portion_id: portion.id, unit_label: `${portion.label} (${fmtQty(portion.qty)} ${food.base_unit})`, kcalPerUnit: (food.kcal * portion.qty) / food.base_qty }
    : { key: `f-${food.id}`, kind: 'food', food, quantity, portion_id: null, unit_label: food.base_unit, kcalPerUnit: food.kcal / food.base_qty }
}

/** Corpo do registro no diário */
export const entryBody = (i: PlateItem) =>
  i.kind === 'food'
    ? { food_id: i.food.id, quantity: i.quantity, portion_id: i.portion_id }
    : { recipe_id: i.recipe.id, quantity: i.servings, ...(i.items ? { items: i.items } : {}) }
