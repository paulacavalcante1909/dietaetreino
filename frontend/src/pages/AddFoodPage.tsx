import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { LazyBarcodeScanner as BarcodeScanner } from '../components/LazyBarcodeScanner'
import { FoodSearch } from '../components/FoodSearch'
import { FoodSheet, type FoodTarget } from '../components/FoodSheet'
import { RecipeSheet } from '../components/RecipeSheet'
import { useToast } from '../components/Toast'
import { api } from '../lib/api'
import { isoDate } from '../lib/date'
import type { FoodDetail, Meal, RecipeSummary } from '../lib/types'

export function AddFoodPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [params] = useSearchParams()
  const date = params.get('data') ?? isoDate()
  const mealId = Number(params.get('refeicao'))

  const [meals, setMeals] = useState<Meal[]>([])
  // Volta do cadastro manual já com o alimento novo aberto
  const [target, setTarget] = useState<FoodTarget | null>(() => (Number(params.get('novo')) ? { id: Number(params.get('novo')) } : null))
  const [recipe, setRecipe] = useState<RecipeSummary | null>(null)
  const [scanning, setScanning] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const query = useRef('')

  useEffect(() => {
    api<{ meals: Meal[] }>('/meals').then((r) => setMeals(r.meals))
  }, [])

  const goHome = () => navigate(`/${date === isoDate() ? '' : `?data=${date}`}`, { replace: true })
  const createUrl = (extra: Record<string, string> = {}) =>
    `/alimentos/novo?${new URLSearchParams({ data: date, refeicao: String(mealId), ...extra })}`

  const addFood = async (food: FoodDetail, quantity: number, portionId: number | null) => {
    await api('/entries', { method: 'POST', body: { date, meal_id: mealId, food_id: food.id, quantity, portion_id: portionId } })
    toast({ text: `${food.name.split(',')[0]} adicionado ✓` })
    goHome()
  }

  const addRecipe = async (servings: number) => {
    await api('/entries', { method: 'POST', body: { date, meal_id: mealId, recipe_id: recipe!.id, quantity: servings } })
    toast({ text: `Receita “${recipe!.name}” adicionada ✓` })
    goHome()
  }

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

  const meal = meals.find((m) => m.id === mealId)

  return (
    <div className="safe-top mx-auto flex min-h-full max-w-lg flex-col px-5 pt-4 pb-8">
      <header className="mb-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} aria-label="Voltar" className="flex size-10 items-center justify-center rounded-full bg-surface text-2xl text-primary shadow-sm">
          ‹
        </button>
        <div>
          <h1 className="text-xl font-bold">Adicionar alimento</h1>
          <p className="text-sm text-muted">{meal?.name ?? '…'}</p>
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
          + Nova receita
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
    </div>
  )
}
