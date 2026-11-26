import { AnimatePresence, motion } from 'framer-motion'
import { BackButton } from '../components/ui'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { LazyBarcodeScanner as BarcodeScanner } from '../components/LazyBarcodeScanner'
import { FoodSearch } from '../components/FoodSearch'
import { FoodSheet, type FoodTarget } from '../components/FoodSheet'
import { RecipeSheet, type RecipeAdjustment } from '../components/RecipeSheet'
import { useToast } from '../components/Toast'
import { api, ApiError } from '../lib/api'
import { isoDate } from '../lib/date'
import { fmtKcal } from '../components/Ring'
import { ChevronDown } from 'lucide-react'
import { mealForNow } from '../lib/meals'
import type { Entry, FoodDetail, FoodLite, Meal, RecipeSummary } from '../lib/types'

const QUICK_ADD_MAX_KCAL = 600
const QUICK_ADD_MAX_AMOUNT = 400 // g ou ml sem porção caseira

export function AddFoodPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [params] = useSearchParams()
  const date = params.get('data') ?? isoDate()
  // Sem refeição válida no link: usa a sugerida pelo horário (dá para trocar no cabeçalho)
  const [mealId, setMealId] = useState(() => Number(params.get('refeicao')) || 0)

  const [meals, setMeals] = useState<Meal[]>([])
  // Volta do cadastro manual já com o alimento novo aberto
  const [target, setTarget] = useState<FoodTarget | null>(() => (Number(params.get('novo')) ? { id: Number(params.get('novo')) } : null))
  const [recipe, setRecipe] = useState<RecipeSummary | null>(null)
  const [scanning, setScanning] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const query = useRef('')
  // Itens adicionados nesta visita: a tela continua aberta para adicionar o próximo
  const [added, setAdded] = useState<{ id: number; name: string; kcal: number }[]>([])

  useEffect(() => {
    api<{ meals: Meal[] }>('/meals').then((r) => {
      setMeals(r.meals)
      setMealId((id) => (r.meals.some((m) => m.id === id) ? id : (mealForNow(r.meals)?.id ?? r.meals[0]?.id ?? 0)))
    })
  }, [])

  const goHome = () => navigate(`/${date === isoDate() ? '' : `?data=${date}`}`, { replace: true })
  const createUrl = (extra: Record<string, string> = {}) =>
    `/alimentos/novo?${new URLSearchParams({ data: date, refeicao: String(mealId), ...extra })}`

  const addFood = async (food: FoodDetail, quantity: number, portionId: number | null) => {
    const r = await api<{ entry: Entry }>('/entries', { method: 'POST', body: { date, meal_id: mealId, food_id: food.id, quantity, portion_id: portionId } })
    registerAdded(r.entry)
    setTarget(null)
    toast({ text: `${food.name.split(',')[0]} adicionado ✓` })
  }

  // Recentes: adiciona de novo com a mesma porção da última vez (1 toque)
  const quickAdd = async (f: FoodLite) => {
    if (!f.last) return
    // Porção grande (ex.: 1000 g): abre a ficha para confirmar em vez de adicionar direto
    if (f.last.kcal > QUICK_ADD_MAX_KCAL || (!f.last.portion_id && f.last.quantity > QUICK_ADD_MAX_AMOUNT)) {
      setTarget({ id: f.id })
      return
    }
    try {
      const r = await api<{ entry: Entry }>('/entries', {
        method: 'POST',
        body: { date, meal_id: mealId, food_id: f.id, quantity: f.last.quantity, portion_id: f.last.portion_id },
      })
      registerAdded(r.entry)
      toast({ text: `${(f.display_name || f.name).split(',')[0]} adicionado ✓` })
    } catch (e) {
      toast({ text: (e as ApiError).message })
    }
  }

  const addRecipe = async (servings: number, items: RecipeAdjustment[] | null) => {
    const r = await api<{ entry: Entry }>('/entries', { method: 'POST', body: { date, meal_id: mealId, recipe_id: recipe!.id, quantity: servings, ...(items ? { items } : {}) } })
    registerAdded(r.entry)
    toast({ text: `“${recipe!.name}”${items ? ' (ajustada)' : ''} adicionada ✓` })
    setRecipe(null)
  }

  const registerAdded = (e: Entry) => {
    setAdded((l) => [...l, { id: e.id, name: e.name, kcal: e.kcal }])
    setRefreshKey((k) => k + 1) // atualiza "Recentes"
  }

  const undoLast = async () => {
    const last = added[added.length - 1]
    if (!last) return
    await api(`/entries/${last.id}`, { method: 'DELETE' }).catch(() => {})
    setAdded((l) => l.slice(0, -1))
    toast({ text: `${last.name.split(',')[0]} removido` })
  }

  const totalKcal = added.reduce((a, i) => a + i.kcal, 0)

  const onDetected = useCallback((ean: string) => {
    setScanning(false)
    setTarget({ ean })
  }, [])

  // Memorizado: o FoodSheet refaz a busca se esta função mudar
  const onNotFound = useCallback(
    (ean: string, name?: string) => {
      setTarget(null)
      toast({ text: 'Produto não encontrado. Cadastre com os dados do rótulo.' })
      const p = new URLSearchParams({ data: date, refeicao: String(mealId), ean, ...(name ? { nome: name } : {}) })
      navigate(`/alimentos/novo?${p}`)
    },
    [date, mealId, navigate, toast],
  )

  const onQueryChange = useCallback((q: string) => {
    query.current = q
  }, [])


  return (
    <div className={`safe-top mx-auto flex min-h-full max-w-lg flex-col px-5 pt-4 ${added.length ? 'pb-32' : 'pb-8'}`}>
      <header className="mb-4 flex items-center gap-3">
        <BackButton onClick={() => (added.length ? goHome() : navigate(-1))} />
        <div>
          <h1 className="text-xl font-bold">Adicionar alimento</h1>
          {meals.length > 0 ? (
            <label className="relative -ml-1 inline-flex items-center gap-1 rounded-lg px-1 text-sm font-semibold text-primary">
              <span className="sr-only">Refeição</span>
              <select value={mealId} onChange={(e) => setMealId(Number(e.target.value))} className="appearance-none bg-transparent pr-5 outline-none">
                {meals.filter((m) => m.active || m.id === mealId).map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-0 size-4" aria-hidden />
            </label>
          ) : (
            <p className="h-5 w-24 animate-pulse rounded bg-soft" />
          )}
        </div>
      </header>

      <div className="flex-1">
        <FoodSearch
          withRecipes
          refreshKey={refreshKey}
          onPickFood={setTarget}
          onPickRecipe={setRecipe}
          onScan={() => setScanning(true)}
          onQueryChange={onQueryChange}
          onQuickAdd={quickAdd}
        />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <button
          onClick={() => navigate(createUrl(query.current ? { nome: query.current } : {}))}
          className="rounded-2xl border-2 border-dashed border-line py-4 text-center text-sm font-semibold text-primary"
        >
          + Cadastrar alimento
        </button>
        <Link to="/receitas/nova" className="rounded-2xl border-2 border-dashed border-line py-4 text-center text-sm font-semibold text-primary">
          + Refeição pronta
        </Link>
      </div>

      <FoodSheet
        target={target}
        confirmLabel="Adicionar"
        onClose={() => setTarget(null)}
        onConfirm={addFood}
        onNotFound={onNotFound}
        onFavoriteChange={() => setRefreshKey((k) => k + 1)}
      />
      <RecipeSheet recipe={recipe} onClose={() => setRecipe(null)} onConfirm={addRecipe} onEdit={(id) => navigate(`/receitas/${id}`)} />
      <BarcodeScanner open={scanning} onClose={() => setScanning(false)} onDetected={onDetected} />

      {/* Resumo do que já entrou nesta refeição + Concluir */}
      <AnimatePresence>
        {added.length > 0 && (
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            transition={{ type: 'spring', stiffness: 400, damping: 36 }}
            className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur-lg"
          >
            <div className="mx-auto flex max-w-lg items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">
                  ✓ {added.length} {added.length === 1 ? 'item adicionado' : 'itens adicionados'} · {fmtKcal(totalKcal)} kcal
                </p>
                <p className="truncate text-xs text-muted">
                  {added.map((a) => a.name.split(',')[0]).join(', ')} ·{' '}
                  <button onClick={undoLast} className="font-semibold text-primary underline-offset-2 hover:underline">desfazer último</button>
                </p>
              </div>
              <button onClick={goHome} className="h-11 shrink-0 rounded-xl bg-primary px-5 font-semibold text-white active:scale-95">
                Concluir
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
