import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { LazyBarcodeScanner as BarcodeScanner } from '../components/LazyBarcodeScanner'
import { FoodSearch } from '../components/FoodSearch'
import { FoodSheet, type FoodTarget } from '../components/FoodSheet'
import { QuantityPicker, type QtyValue } from '../components/QuantityPicker'
import { fmt } from '../components/Ring'
import { Sheet } from '../components/Sheet'
import { useToast } from '../components/Toast'
import { Alert, Button, Card, Field, Spinner } from '../components/ui'
import { api, ApiError } from '../lib/api'
import { entryQtyLabel, fmtQty, nutrientsFor, num } from '../lib/nutrition'
import type { FoodDetail, Nutrients, RecipeDetail, RecipeItem } from '../lib/types'

const ZERO: Nutrients = { kcal: 0, carbs: 0, protein: 0, fat: 0, sodium: 0 }

function itemAmount(i: Pick<RecipeItem, 'quantity' | 'portion_id' | 'food'>) {
  const p = i.food.portions.find((x) => x.id === i.portion_id)
  return p ? i.quantity * p.qty : i.quantity
}

/** Mesmo formato do diário: "2 unidades · 100 g" ou "200 g". */
function itemLabel(i: RecipeItem) {
  const p = i.food.portions.find((x) => x.id === i.portion_id)
  return entryQtyLabel({
    quantity: i.quantity,
    unit_label: p ? `${p.label} (${fmtQty(p.qty)} ${i.food.base_unit})` : i.food.base_unit,
    amount: itemAmount(i),
    base_unit: i.food.base_unit,
  })
}

/** Criar/editar receita: nome, rendimento (porções) e ingredientes. */
export function RecipeEditorPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()

  const [name, setName] = useState('')
  const [servings, setServings] = useState('1')
  const [items, setItems] = useState<RecipeItem[]>([])
  const [loading, setLoading] = useState(!!id)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)

  const [picking, setPicking] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [target, setTarget] = useState<FoodTarget | null>(null)
  const [editIndex, setEditIndex] = useState<number | null>(null)

  useEffect(() => {
    if (!id) return
    api<{ recipe: RecipeDetail }>(`/recipes/${id}`).then(({ recipe }) => {
      setName(recipe.name)
      setServings(fmtQty(recipe.servings))
      setItems(recipe.items)
      setLoading(false)
    })
  }, [id])

  const totals = useMemo(
    () =>
      items.reduce((acc, i) => {
        const n = nutrientsFor(i.food, itemAmount(i))
        return { kcal: acc.kcal + n.kcal, carbs: acc.carbs + n.carbs, protein: acc.protein + n.protein, fat: acc.fat + n.fat, sodium: acc.sodium + n.sodium }
      }, ZERO),
    [items],
  )
  const s = num(servings) > 0 ? num(servings) : 1
  const per = { kcal: totals.kcal / s, carbs: totals.carbs / s, protein: totals.protein / s, fat: totals.fat / s, sodium: totals.sodium / s }

  const addItem = async (food: FoodDetail, quantity: number, portionId: number | null) => {
    const item: RecipeItem = { food_id: food.id, portion_id: portionId, quantity, amount: 0, food, nutrients: ZERO }
    setItems((list) => [...list, item])
    setTarget(null)
    setPicking(false)
  }

  const onDetected = useCallback((ean: string) => {
    setScanning(false)
    setTarget({ ean })
  }, [])

  const onNotFound = useCallback(() => {
    setTarget(null)
    toast({ text: 'Produto não encontrado. Cadastre-o em “Cadastrar alimento” e depois adicione aqui.' })
  }, [toast])

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const body = {
        name: name.trim(),
        servings: num(servings),
        items: items.map((i) => ({ food_id: i.food_id, portion_id: i.portion_id, quantity: i.quantity })),
      }
      await api(id ? `/recipes/${id}` : '/recipes', { method: id ? 'PUT' : 'POST', body })
      toast({ text: id ? 'Receita atualizada ✓' : 'Receita criada ✓' })
      navigate(-1)
    } catch (e) {
      setError(e as ApiError)
    } finally {
      setSaving(false)
    }
  }

  const duplicate = async () => {
    const r = await api<{ recipe: RecipeDetail }>(`/recipes/${id}/duplicate`, { method: 'POST' })
    toast({ text: 'Receita duplicada ✓' })
    navigate(`/receitas/${r.recipe.id}`, { replace: true })
  }

  const remove = async () => {
    if (!confirm('Excluir esta receita? O que você já registrou no diário continua no histórico.')) return
    await api(`/recipes/${id}`, { method: 'DELETE' })
    toast({ text: 'Receita excluída' })
    navigate(-1)
  }

  if (loading) return <Spinner />

  return (
    <div className="safe-top mx-auto max-w-lg px-5 pt-4 pb-10">
      <header className="mb-5 flex items-center gap-3">
        <button onClick={() => navigate(-1)} aria-label="Voltar" className="flex size-10 items-center justify-center rounded-full bg-surface text-2xl text-primary shadow-sm">
          ‹
        </button>
        <h1 className="text-xl font-bold">{id ? 'Editar receita' : 'Nova receita'}</h1>
      </header>

      <div className="space-y-4">
        {error && <Alert>{error.field('items') ?? error.field('name') ?? error.message}</Alert>}
        <div className="grid grid-cols-[1fr_7rem] gap-3">
          <Field label="Nome" name="recipe_name" placeholder="ex.: Café padrão" value={name} onChange={(e) => setName(e.target.value)} error={error?.field('name')} />
          <Field label="Rende" name="servings" suffix={s === 1 ? 'porção' : 'porções'} inputMode="decimal" value={servings} onChange={(e) => setServings(e.target.value.replace(/[^\d.,]/g, ''))} error={error?.field('servings')} />
        </div>

        <Card className="!p-4">
          <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Por porção</p>
          <div className="grid grid-cols-5 text-center">
            <Mini label="kcal" value={per.kcal} className="text-primary" />
            <Mini label="carb" value={per.carbs} className="text-lavender" />
            <Mini label="prot" value={per.protein} className="text-pink" />
            <Mini label="gord" value={per.fat} className="text-violet" />
            <Mini label="sódio" value={per.sodium} className="text-coral" />
          </div>
          {s !== 1 && <p className="mt-2 text-center text-xs text-muted">Receita inteira: {fmt(totals.kcal)} kcal</p>}
        </Card>

        <div>
          <p className="mb-2 px-1 font-semibold">Ingredientes</p>
          <ul className="space-y-2">
            <AnimatePresence initial={false}>
              {items.map((i, idx) => (
                <motion.li key={`${i.food_id}-${idx}`} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}>
                  <button onClick={() => setEditIndex(idx)} className="flex w-full items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3 text-left shadow-[0_2px_12px_-4px_rgba(31,23,36,0.08)] active:bg-soft">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {i.food.name}
                        {i.food.deleted && <span className="ml-1 text-xs text-coral">(excluído)</span>}
                      </p>
                      <p className="truncate text-xs text-muted">{itemLabel(i)}</p>
                    </div>
                    <span className="shrink-0 text-sm text-muted">{fmt(nutrientsFor(i.food, itemAmount(i)).kcal)} kcal</span>
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
          <button onClick={() => setPicking(true)} className="mt-3 w-full rounded-2xl border-2 border-dashed border-line py-4 text-sm font-semibold text-primary">
            + Adicionar ingrediente
          </button>
        </div>

        <Button onClick={save} loading={saving} disabled={!name.trim() || items.length === 0}>
          {id ? 'Salvar receita' : 'Criar receita'}
        </Button>
        {id && (
          <div className="grid grid-cols-2 gap-3">
            <Button variant="ghost" onClick={duplicate}>Duplicar</Button>
            <Button variant="danger" onClick={remove}>Excluir</Button>
          </div>
        )}
      </div>

      {/* Escolher ingrediente: busca em tela cheia */}
      <AnimatePresence>
        {picking && (
          <motion.div
            className="fixed inset-0 z-40 overflow-y-auto bg-bg"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
          >
            <div className="safe-top mx-auto max-w-lg px-5 pt-4 pb-10">
              <header className="mb-4 flex items-center gap-3">
                <button onClick={() => setPicking(false)} aria-label="Fechar" className="flex size-10 items-center justify-center rounded-full bg-surface text-xl text-primary shadow-sm">
                  ×
                </button>
                <h2 className="text-xl font-bold">Adicionar ingrediente</h2>
              </header>
              <FoodSearch onPickFood={setTarget} onScan={() => setScanning(true)} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <FoodSheet target={target} confirmLabel="Adicionar à receita" onClose={() => setTarget(null)} onConfirm={addItem} onNotFound={onNotFound} />
      <BarcodeScanner open={scanning} onClose={() => setScanning(false)} onDetected={onDetected} />
      <ItemSheet
        item={editIndex !== null ? items[editIndex] : null}
        onClose={() => setEditIndex(null)}
        onSave={(it) => {
          setItems((list) => list.map((x, j) => (j === editIndex ? it : x)))
          setEditIndex(null)
        }}
        onRemove={() => {
          setItems((list) => list.filter((_, j) => j !== editIndex))
          setEditIndex(null)
        }}
      />
    </div>
  )
}

function Mini({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <div>
      <p className={`font-bold ${className}`}>{fmt(Math.round(value * 10) / 10)}</p>
      <p className="text-[11px] text-muted">{label}</p>
    </div>
  )
}

/** Ajustar quantidade de um ingrediente ou removê-lo. */
function ItemSheet({ item, onClose, onSave, onRemove }: { item: RecipeItem | null; onClose: () => void; onSave: (i: RecipeItem) => void; onRemove: () => void }) {
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
