import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { QuantityPicker, type QtyValue } from './QuantityPicker'
import { IngredientList, IngredientPicker, ItemSheet, sumItems } from './RecipeIngredients'
import { Sheet } from './Sheet'
import { Alert, Button } from './ui'
import { api, ApiError } from '../lib/api'
import { num } from '../lib/nutrition'
import type { FoodLite, RecipeDetail, RecipeItem, RecipeSummary } from '../lib/types'

export interface RecipeAdjustment {
  food_id: number
  portion_id: number | null
  quantity: number
}

interface Props {
  recipe: RecipeSummary | null
  onClose: () => void
  /** items = ingredientes ajustados só para este registro (null = receita como está). */
  onConfirm: (servings: number, items: RecipeAdjustment[] | null) => Promise<void>
  onEdit: (id: number) => void
}

/**
 * Adicionar refeição pronta ao dia: escolhe porções e, se quiser, ajusta os ingredientes
 * só para este registro (a refeição pronta original não muda).
 */
export function RecipeSheet({ recipe, onClose, onConfirm, onEdit }: Props) {
  const [detail, setDetail] = useState<RecipeDetail | null>(null)
  const [items, setItems] = useState<RecipeItem[]>([])
  const [adjusting, setAdjusting] = useState(false)
  const [changed, setChanged] = useState(false)
  const [editIndex, setEditIndex] = useState<number | null>(null)
  const [picking, setPicking] = useState(false)
  const [value, setValue] = useState<QtyValue>({ quantity: '1', portionId: -1 })
  const [error, setError] = useState<ApiError | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setValue({ quantity: '1', portionId: -1 })
    setError(null)
    setAdjusting(false)
    setChanged(false)
    setDetail(null)
    if (!recipe) return
    api<{ recipe: RecipeDetail }>(`/recipes/${recipe.id}`).then((r) => {
      setDetail(r.recipe)
      setItems(r.recipe.items)
    })
  }, [recipe])

  const update = (fn: (l: RecipeItem[]) => RecipeItem[]) => {
    setItems(fn)
    setChanged(true)
  }

  // Valores por porção recalculados com os ingredientes atuais (ajustados ou não)
  const per = useMemo(() => {
    const s = detail && detail.servings > 0 ? detail.servings : 1
    const t = sumItems(items)
    return { kcal: t.kcal / s, carbs: t.carbs / s, protein: t.protein / s, fat: t.fat / s, sodium: t.sodium / s, fiber: t.fiber / s, amount: t.amount / s }
  }, [items, detail])

  if (!recipe) return <Sheet open={false} onClose={onClose}>{null}</Sheet>

  const p = detail ? per : recipe.per_serving
  const asFood: FoodLite = {
    id: 0, user_id: 1, source: 'manual', name: recipe.name, brand: null,
    base_qty: p.amount || 1, base_unit: 'g', kcal: p.kcal, carbs: p.carbs, protein: p.protein, fat: p.fat, sodium: p.sodium, fiber: p.fiber,
  }

  const confirm = async () => {
    setSaving(true)
    setError(null)
    try {
      const adjusted = changed ? items.map((i) => ({ food_id: i.food_id, portion_id: i.portion_id, quantity: i.quantity })) : null
      await onConfirm(num(value.quantity), adjusted)
    } catch (e) {
      setError(e as ApiError)
    } finally {
      setSaving(false)
    }
  }

  const reset = () => {
    if (detail) setItems(detail.items)
    setChanged(false)
  }

  return (
    <>
      <Sheet open onClose={onClose} title={recipe.name}>
        <p className="-mt-1 mb-4 text-sm text-muted">
          Refeição pronta · {detail ? items.length : recipe.items_count} {(detail ? items.length : recipe.items_count) === 1 ? 'ingrediente' : 'ingredientes'}
          {changed && <span className="ml-1 font-semibold text-primary">· ajustada</span>}
        </p>
        <div className="space-y-4">
          {error && <Alert>{error.field('items') ?? error.message}</Alert>}
          <QuantityPicker
            food={asFood}
            portions={[{ id: -1, label: '1 porção', qty: p.amount || 1 }]}
            value={value}
            onChange={(v) => setValue({ ...v, portionId: -1 })}
            hideGrams
          />

          {/* Ajustar ingredientes só para hoje */}
          <div className="rounded-2xl bg-soft/70 p-3">
            <button onClick={() => setAdjusting((a) => !a)} className="flex w-full items-center justify-between text-left" aria-expanded={adjusting} disabled={!detail}>
              <span>
                <span className="block text-sm font-semibold">Ajustar ingredientes</span>
                <span className="block text-xs text-muted">Muda só este registro, não a refeição pronta salva</span>
              </span>
              <motion.span animate={{ rotate: adjusting ? 90 : 0 }} className="text-xl text-primary">›</motion.span>
            </button>
            <AnimatePresence initial={false}>
              {adjusting && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="space-y-2 pt-3">
                    <IngredientList items={items} onEdit={setEditIndex} />
                    <div className="flex gap-2">
                      <button onClick={() => setPicking(true)} className="flex-1 rounded-xl border-2 border-dashed border-line py-3 text-sm font-semibold text-primary">
                        + Ingrediente
                      </button>
                      {changed && (
                        <button onClick={reset} className="rounded-xl px-3 text-sm font-medium text-muted underline-offset-2 hover:underline">
                          Desfazer ajustes
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <Button onClick={confirm} loading={saving} disabled={!(num(value.quantity) > 0) || items.length === 0}>
            {changed ? 'Adicionar com ajustes' : 'Adicionar'}
          </Button>
          <button onClick={() => onEdit(recipe.id)} className="w-full py-2 text-sm font-medium text-primary">
            Editar a refeição pronta salva
          </button>
        </div>
      </Sheet>

      <ItemSheet
        item={editIndex !== null ? items[editIndex] : null}
        onClose={() => setEditIndex(null)}
        onSave={(it) => {
          update((l) => l.map((x, j) => (j === editIndex ? it : x)))
          setEditIndex(null)
        }}
        onRemove={() => {
          update((l) => l.filter((_, j) => j !== editIndex))
          setEditIndex(null)
        }}
      />
      <IngredientPicker open={picking} onClose={() => setPicking(false)} onAdd={(it) => update((l) => [...l, it])} confirmLabel="Adicionar à refeição" />
    </>
  )
}
