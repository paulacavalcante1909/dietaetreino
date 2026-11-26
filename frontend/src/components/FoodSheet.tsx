import { Star } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { QuantityPicker, type QtyValue } from './QuantityPicker'
import { fmtKcal } from './Ring'
import { Sheet } from './Sheet'
import { Alert, Button } from './ui'
import { api, ApiError } from '../lib/api'
import { baseLabel, num } from '../lib/nutrition'
import type { FoodDetail } from '../lib/types'

/** O que abrir: alimento do banco (id) ou produto por código de barras (ean). */
export type FoodTarget = { id: number } | { ean: string; name?: string }

interface Props {
  target: FoodTarget | null
  confirmLabel: string
  onClose: () => void
  onConfirm: (food: FoodDetail, quantity: number, portionId: number | null) => Promise<void>
  /** Código não encontrado na Open Food Facts. */
  onNotFound?: (ean: string, name?: string) => void
  onFavoriteChange?: () => void
}

/** Detalhe do alimento + escolha de quantidade. Usado no diário e no editor de receitas. */
export function FoodSheet({ target, confirmLabel, onClose, onConfirm, onNotFound, onFavoriteChange }: Props) {
  const navigate = useNavigate()
  const [food, setFood] = useState<FoodDetail | null>(null)
  const [value, setValue] = useState<QtyValue>({ quantity: '100', portionId: null })
  const [error, setError] = useState<ApiError | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!target) return
    setFood(null)
    setError(null)
    const path = 'id' in target ? `/foods/${target.id}` : `/foods/barcode/${target.ean}`
    api<{ food: FoodDetail }>(path)
      .then((r) => {
        setFood(r.food)
        // Porção caseira como padrão quando existir (mais rápido de registrar)
        const p = r.food.portions[0]
        setValue(p ? { quantity: '1', portionId: p.id } : { quantity: String(r.food.base_qty), portionId: null })
      })
      .catch((e: ApiError) => {
        if (e.status === 404 && 'ean' in target && onNotFound) onNotFound(target.ean, target.name)
        else setError(e)
      })
  }, [target, onNotFound])

  const toggleFavorite = async () => {
    if (!food) return
    const fav = !food.is_favorite
    setFood({ ...food, is_favorite: fav })
    await api(`/foods/${food.id}/favorite`, { method: fav ? 'POST' : 'DELETE' }).catch(() => setFood({ ...food }))
    onFavoriteChange?.()
  }

  const confirm = async () => {
    if (!food) return
    setSaving(true)
    setError(null)
    try {
      await onConfirm(food, num(value.quantity), value.portionId)
    } catch (e) {
      setError(e as ApiError)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={!!target} onClose={onClose} title={food ? food.display_name || food.name : error ? 'Ops' : 'Carregando…'}>
      {error && !food && <Alert>{error.message}</Alert>}
      {!food && !error && (
        <div className="space-y-3">
          {'ean' in (target ?? {}) && <p className="text-sm text-muted">Buscando produto na Open Food Facts…</p>}
          <div className="h-56 animate-pulse rounded-2xl bg-soft" />
        </div>
      )}
      {food && (
        <div className="space-y-4">
          <div className="-mt-1 flex items-start justify-between gap-3">
            <p className="text-sm text-muted">
              {food.brand ? `${food.brand} · ` : ''}
              {fmtKcal(food.kcal)} kcal por {baseLabel(food)}
              {food.source === 'off' && ' · Open Food Facts'}
              {food.display_name && food.display_name !== food.name && <span className="block text-xs">TACO: {food.name}</span>}
            </p>
            <button onClick={toggleFavorite} aria-label={food.is_favorite ? 'Remover dos favoritos' : 'Favoritar'} className="text-2xl leading-none text-orchid transition-transform active:scale-125">
              <Star className={`size-6 ${food.is_favorite ? 'fill-current' : ''}`} />
            </button>
          </div>
          {error && <Alert>{error.message}</Alert>}
          <QuantityPicker food={food} portions={food.portions} value={value} onChange={setValue} />
          <Button onClick={confirm} loading={saving} disabled={!(num(value.quantity) > 0)}>
            {confirmLabel}
          </Button>
          {food.is_mine && (
            <button onClick={() => navigate(`/alimentos/${food.id}/editar`)} className="w-full py-2 text-sm font-medium text-link">
              Editar este alimento
            </button>
          )}
        </div>
      )}
    </Sheet>
  )
}
