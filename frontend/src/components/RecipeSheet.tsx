import { useEffect, useState } from 'react'
import { QuantityPicker, type QtyValue } from './QuantityPicker'
import { Sheet } from './Sheet'
import { Alert, Button } from './ui'
import { ApiError } from '../lib/api'
import { num } from '../lib/nutrition'
import type { FoodLite, RecipeSummary } from '../lib/types'

interface Props {
  recipe: RecipeSummary | null
  onClose: () => void
  onConfirm: (servings: number) => Promise<void>
  onEdit: (id: number) => void
}

/** Adicionar receita ao dia escolhendo o número de porções. */
export function RecipeSheet({ recipe, onClose, onConfirm, onEdit }: Props) {
  const [value, setValue] = useState<QtyValue>({ quantity: '1', portionId: -1 })
  const [error, setError] = useState<ApiError | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setValue({ quantity: '1', portionId: -1 })
    setError(null)
  }, [recipe])

  if (!recipe) return <Sheet open={false} onClose={onClose}>{null}</Sheet>

  // A receita vira um "alimento" cuja porção é 1 porção da receita
  const p = recipe.per_serving
  const asFood: FoodLite = {
    id: 0, user_id: 1, source: 'manual', name: recipe.name, brand: null,
    base_qty: p.amount || 1, base_unit: 'g', kcal: p.kcal, carbs: p.carbs, protein: p.protein, fat: p.fat, sodium: p.sodium,
  }

  const confirm = async () => {
    setSaving(true)
    setError(null)
    try {
      await onConfirm(num(value.quantity))
    } catch (e) {
      setError(e as ApiError)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open onClose={onClose} title={recipe.name}>
      <p className="-mt-1 mb-4 text-sm text-muted">
        Receita · {recipe.items_count} {recipe.items_count === 1 ? 'ingrediente' : 'ingredientes'}
      </p>
      <div className="space-y-4">
        {error && <Alert>{error.message}</Alert>}
        <QuantityPicker
          food={asFood}
          portions={[{ id: -1, label: '1 porção', qty: p.amount || 1 }]}
          value={value}
          onChange={(v) => setValue({ ...v, portionId: -1 })}
          hideGrams
        />
        <Button onClick={confirm} loading={saving} disabled={!(num(value.quantity) > 0)}>
          Adicionar receita
        </Button>
        <button onClick={() => onEdit(recipe.id)} className="w-full py-2 text-sm font-medium text-primary">
          Editar receita
        </button>
      </div>
    </Sheet>
  )
}
