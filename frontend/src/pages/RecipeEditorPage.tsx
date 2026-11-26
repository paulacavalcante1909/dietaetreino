import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { IngredientList, IngredientPicker, ItemSheet, sumItems } from '../components/RecipeIngredients'
import { fmt, fmtKcal } from '../components/Ring'
import { useToast } from '../components/Toast'
import { Alert, BackButton, Button, Card, Field, Spinner } from '../components/ui'
import { api, ApiError } from '../lib/api'
import { fmtQty, num } from '../lib/nutrition'
import type { RecipeDetail, RecipeItem } from '../lib/types'

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

  const totals = useMemo(() => sumItems(items), [items])
  const s = num(servings) > 0 ? num(servings) : 1
  const per = { kcal: totals.kcal / s, carbs: totals.carbs / s, protein: totals.protein / s, fat: totals.fat / s, sodium: totals.sodium / s, fiber: totals.fiber / s }

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
      toast({ text: id ? 'Refeição pronta atualizada ✓' : 'Refeição pronta criada ✓' })
      navigate(-1)
    } catch (e) {
      setError(e as ApiError)
    } finally {
      setSaving(false)
    }
  }

  const duplicate = async () => {
    const r = await api<{ recipe: RecipeDetail }>(`/recipes/${id}/duplicate`, { method: 'POST' })
    toast({ text: 'Duplicada ✓' })
    navigate(`/receitas/${r.recipe.id}`, { replace: true })
  }

  const remove = async () => {
    if (!confirm('Excluir esta refeição pronta? O que você já registrou no diário continua no histórico.')) return
    await api(`/recipes/${id}`, { method: 'DELETE' })
    toast({ text: 'Excluída' })
    navigate(-1)
  }

  if (loading) return <Spinner />

  return (
    <div className="safe-top mx-auto max-w-lg px-5 pt-4 pb-10">
      <header className="mb-5 flex items-center gap-3">
        <BackButton onClick={() => navigate(-1)} />
        <h1 className="text-xl font-bold">{id ? 'Editar refeição pronta' : 'Nova refeição pronta'}</h1>
      </header>

      <div className="space-y-4">
        {error && <Alert>{error.field('items') ?? error.field('name') ?? error.message}</Alert>}
        <div className="grid grid-cols-[1fr_7rem] gap-3">
          <Field label="Nome" name="recipe_name" placeholder="ex.: Café padrão, Bolo de banana" value={name} onChange={(e) => setName(e.target.value)} error={error?.field('name')} />
          <Field label="Rende" name="servings" suffix={s === 1 ? 'porção' : 'porções'} inputMode="decimal" value={servings} onChange={(e) => setServings(e.target.value.replace(/[^\d.,]/g, ''))} error={error?.field('servings')} />
        </div>

        <Card className="!p-4">
          <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Por porção</p>
          <div className="grid grid-cols-6 text-center">
            <Mini label="kcal" value={Math.round(per.kcal)} className="text-primary" />
            <Mini label="carb" value={per.carbs} className="text-lavender" />
            <Mini label="prot" value={per.protein} className="text-pink" />
            <Mini label="gord" value={per.fat} className="text-violet" />
            <Mini label="sódio" value={per.sodium} className="text-coral" />
            <Mini label="fibras" value={per.fiber} className="text-fiber" />
          </div>
          {s !== 1 && <p className="mt-2 text-center text-xs text-muted">Receita inteira: {fmtKcal(totals.kcal)} kcal</p>}
        </Card>

        <div>
          <p className="mb-2 px-1 font-semibold">Ingredientes</p>
          <IngredientList items={items} onEdit={setEditIndex} />
          <button onClick={() => setPicking(true)} className="mt-3 w-full rounded-2xl border-2 border-dashed border-line py-4 text-sm font-semibold text-primary">
            + Adicionar ingrediente
          </button>
        </div>

        <Button onClick={save} loading={saving} disabled={!name.trim() || items.length === 0}>
          {id ? 'Salvar' : 'Criar refeição pronta'}
        </Button>
        {id && (
          <div className="grid grid-cols-2 gap-3">
            <Button variant="ghost" onClick={duplicate}>Duplicar</Button>
            <Button variant="danger" onClick={remove}>Excluir</Button>
          </div>
        )}
      </div>

      <IngredientPicker open={picking} onClose={() => setPicking(false)} onAdd={(it) => setItems((l) => [...l, it])} confirmLabel="Adicionar à refeição pronta" />
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
