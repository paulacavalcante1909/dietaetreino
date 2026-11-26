import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useState } from 'react'
import { FoodSearch } from './FoodSearch'
import { FoodSheet, type FoodTarget } from './FoodSheet'
import { LazyBarcodeScanner as BarcodeScanner } from './LazyBarcodeScanner'
import { QuantityPicker, type QtyValue } from './QuantityPicker'
import { fmtKcal } from './Ring'
import { Sheet } from './Sheet'
import { useToast } from './Toast'
import { BackButton, Button } from './ui'
import { entryQtyLabel, fmtQty, nutrientsFor, num } from '../lib/nutrition'
import type { FoodDetail, Nutrients, RecipeItem } from '../lib/types'

export const ZERO: Nutrients = { kcal: 0, carbs: 0, protein: 0, fat: 0, sodium: 0 }

export function itemAmount(i: Pick<RecipeItem, 'quantity' | 'portion_id' | 'food'>) {
  const p = i.food.portions.find((x) => x.id === i.portion_id)
  return p ? i.quantity * p.qty : i.quantity
}

/** Mesmo formato do diário: "2 unidades · 100 g" ou "200 g". */
export function itemLabel(i: RecipeItem) {
  const p = i.food.portions.find((x) => x.id === i.portion_id)
  return entryQtyLabel({
    quantity: i.quantity,
    unit_label: p ? `${p.label} (${fmtQty(p.qty)} ${i.food.base_unit})` : i.food.base_unit,
    amount: itemAmount(i),
    base_unit: i.food.base_unit,
  })
}

/** Soma dos nutrientes dos ingredientes (receita inteira). */
export function sumItems(items: RecipeItem[]): Nutrients & { amount: number } {
  return items.reduce(
    (acc, i) => {
      const a = itemAmount(i)
      const n = nutrientsFor(i.food, a)
      return { kcal: acc.kcal + n.kcal, carbs: acc.carbs + n.carbs, protein: acc.protein + n.protein, fat: acc.fat + n.fat, sodium: acc.sodium + n.sodium, amount: acc.amount + a }
    },
    { ...ZERO, amount: 0 },
  )
}

/** Lista de ingredientes editável (tocar para ajustar quantidade ou remover). */
export function IngredientList({ items, onEdit }: { items: RecipeItem[]; onEdit: (index: number) => void }) {
  return (
    <ul className="space-y-2">
      <AnimatePresence initial={false}>
        {items.map((i, idx) => (
          <motion.li key={`${i.food_id}-${idx}`} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}>
            <button onClick={() => onEdit(idx)} className="flex w-full items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3 text-left shadow-[0_2px_12px_-4px_rgba(31,23,36,0.08)] ring-1 ring-line/60 active:bg-soft">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {i.food.name}
                  {i.food.deleted && <span className="ml-1 text-xs text-coral">(excluído)</span>}
                </p>
                <p className="truncate text-xs text-muted">{itemLabel(i)}</p>
              </div>
              <span className="shrink-0 text-sm text-muted">{fmtKcal(nutrientsFor(i.food, itemAmount(i)).kcal)} kcal</span>
            </button>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  )
}

/** Ajustar quantidade de um ingrediente ou removê-lo. */
export function ItemSheet({ item, onClose, onSave, onRemove }: { item: RecipeItem | null; onClose: () => void; onSave: (i: RecipeItem) => void; onRemove: () => void }) {
  const [value, setValue] = useState<QtyValue>({ quantity: '', portionId: null })

  useEffect(() => {
    if (item) setValue({ quantity: fmtQty(item.quantity).replace('.', ''), portionId: item.portion_id })
  }, [item])

  return (
    <Sheet open={!!item} onClose={onClose} title={item?.food.name}>
      {item && (
        <div className="space-y-4">
          <QuantityPicker food={item.food} portions={item.food.portions} value={value} onChange={setValue} />
          <Button onClick={() => onSave({ ...item, quantity: num(value.quantity), portion_id: value.portionId })} disabled={!(num(value.quantity) > 0)}>
            Salvar
          </Button>
          <Button variant="danger" onClick={onRemove}>
            Remover ingrediente
          </Button>
        </div>
      )}
    </Sheet>
  )
}

/** Busca em tela cheia para incluir um ingrediente (base, marca, código de barras). */
export function IngredientPicker({ open, onClose, onAdd, confirmLabel = 'Adicionar' }: {
  open: boolean
  onClose: () => void
  onAdd: (item: RecipeItem) => void
  confirmLabel?: string
}) {
  const toast = useToast()
  const [target, setTarget] = useState<FoodTarget | null>(null)
  const [scanning, setScanning] = useState(false)

  const confirm = async (food: FoodDetail, quantity: number, portionId: number | null) => {
    onAdd({ food_id: food.id, portion_id: portionId, quantity, amount: 0, food, nutrients: ZERO })
    setTarget(null)
    onClose()
  }

  const onDetected = useCallback((ean: string) => {
    setScanning(false)
    setTarget({ ean })
  }, [])

  const onNotFound = useCallback(() => {
    setTarget(null)
    toast({ text: 'Produto não encontrado. Cadastre-o em “Cadastrar alimento” e depois adicione aqui.' })
  }, [toast])

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[45] overflow-y-auto bg-bg"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
          >
            <div className="safe-top mx-auto max-w-lg px-5 pt-4 pb-10">
              <header className="mb-4 flex items-center gap-3">
                <BackButton onClick={onClose} label="Fechar" icon="close" />
                <h2 className="text-xl font-bold">Adicionar ingrediente</h2>
              </header>
              <FoodSearch onPickFood={setTarget} onScan={() => setScanning(true)} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <FoodSheet target={target} confirmLabel={confirmLabel} onClose={() => setTarget(null)} onConfirm={confirm} onNotFound={onNotFound} />
      <BarcodeScanner open={scanning} onClose={() => setScanning(false)} onDetected={onDetected} />
    </>
  )
}
