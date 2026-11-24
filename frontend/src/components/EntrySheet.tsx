import { useEffect, useState } from 'react'
import { QuantityPicker, type QtyValue } from './QuantityPicker'
import { Sheet } from './Sheet'
import { Alert, Button } from './ui'
import { api, ApiError } from '../lib/api'
import { fmtQty, num } from '../lib/nutrition'
import type { DayMeal, Entry, FoodDetail, FoodLite } from '../lib/types'

interface Props {
  entry: Entry | null
  meals: DayMeal[]
  onClose: () => void
  onChanged: () => void
}

/** Editar quantidade/refeição de um item do diário ou removê-lo. */
export function EntrySheet({ entry, meals, onClose, onChanged }: Props) {
  const [food, setFood] = useState<FoodDetail | null>(null)
  const [value, setValue] = useState<QtyValue>({ quantity: '', portionId: null })
  const [mealId, setMealId] = useState<number>(0)
  const [error, setError] = useState<ApiError | null>(null)
  const [busy, setBusy] = useState<'save' | 'delete' | null>(null)

  useEffect(() => {
    if (!entry) return
    setValue({ quantity: fmtQty(entry.quantity).replace('.', ''), portionId: entry.portion_id })
    setMealId(entry.meal_id)
    setError(null)
    setFood(null)
    if (entry.food_id) {
      api<{ food: FoodDetail }>(`/foods/${entry.food_id}`)
        .then((r) => setFood(r.food))
        .catch(() => setFood(null)) // alimento excluído: edita só pela proporção
    }
  }, [entry])

  if (!entry) return <Sheet open={false} onClose={onClose}>{null}</Sheet>

  // Sem o alimento original, monta um "alimento" a partir do snapshot
  const snapshotFood: FoodLite = {
    id: 0, user_id: null, source: 'manual', name: entry.name, brand: entry.brand,
    base_qty: entry.quantity, base_unit: entry.base_unit,
    kcal: entry.kcal, carbs: entry.carbs, protein: entry.protein, fat: entry.fat, sodium: entry.sodium,
  }

  const save = async () => {
    setBusy('save')
    setError(null)
    try {
      await api(`/entries/${entry.id}`, {
        method: 'PUT',
        body: { quantity: num(value.quantity), portion_id: food ? value.portionId : entry.portion_id, meal_id: mealId },
      })
      onChanged()
      onClose()
    } catch (e) {
      setError(e as ApiError)
    } finally {
      setBusy(null)
    }
  }

  const remove = async () => {
    setBusy('delete')
    try {
      await api(`/entries/${entry.id}`, { method: 'DELETE' })
      onChanged()
      onClose()
    } catch (e) {
      setError(e as ApiError)
    } finally {
      setBusy(null)
    }
  }

  return (
    <Sheet open={!!entry} onClose={onClose} title={entry.name}>
      {entry.brand && <p className="-mt-1 mb-3 text-sm text-muted">{entry.brand}</p>}
      <div className="space-y-4">
        {error && <Alert>{error.field('quantity') ?? error.message}</Alert>}
        {food ? (
          <QuantityPicker food={food} portions={food.portions} value={value} onChange={setValue} />
        ) : (
          <QuantityPicker
            food={{ ...snapshotFood, base_qty: entry.quantity, base_unit: entry.portion_id || entry.recipe_id ? ('porção' as 'g') : entry.base_unit }}
            portions={[]}
            value={{ ...value, portionId: null }}
            onChange={(v) => setValue({ ...v, portionId: entry.portion_id })}
          />
        )}

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-muted">Refeição</span>
          <select
            value={mealId}
            onChange={(e) => setMealId(Number(e.target.value))}
            className="h-12 w-full rounded-2xl border border-line bg-surface px-4 outline-none focus:border-orchid"
          >
            {meals.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>

        <Button onClick={save} loading={busy === 'save'} disabled={!(num(value.quantity) > 0)}>
          Salvar
        </Button>
        <Button variant="danger" onClick={remove} loading={busy === 'delete'}>
          Remover do dia
        </Button>
      </div>
    </Sheet>
  )
}
