import { AnimatePresence, motion } from 'framer-motion'
import { BackButton } from '../components/ui'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { LazyBarcodeScanner as BarcodeScanner } from '../components/LazyBarcodeScanner'
import { FoodSearch, PLATE_HINT_KEY, type PlateControls } from '../components/FoodSearch'
import { MealSuggestions } from '../components/MealSuggestions'
import { askText } from '../components/Dialog'
import { newPlateItem, plateItemFrom, plateKcal, plateStep, type PlateItem } from '../lib/plate'
import { FoodSheet, type FoodTarget } from '../components/FoodSheet'
import { RecipeSheet, type RecipeAdjustment } from '../components/RecipeSheet'
import { useToast } from '../components/Toast'
import { api, ApiError } from '../lib/api'
import { isoDate } from '../lib/date'
import { fmtKcal } from '../components/Ring'
import { Check } from 'lucide-react'
import { mealForNow } from '../lib/meals'
import { useBottomInset } from '../lib/viewport'
import type { Entry, FoodDetail, FoodLite, Meal, RecipeSummary } from '../lib/types'

/**
 * "Salvar como pronta" só aparece quando o mesmo prato (mesmos alimentos) já foi registrado antes.
 * Guarda no aparelho os pratos registrados (até 30).
 */
const PLATES_KEY = 'dt_plates_seen'
function repeatedPlate(items: PlateItem[]) {
  const sig = items.map((i) => i.food.id).sort((a, b) => a - b).join(',')
  const seen: string[] = JSON.parse(localStorage.getItem(PLATES_KEY) ?? '[]')
  const repeated = seen.includes(sig)
  if (!repeated) localStorage.setItem(PLATES_KEY, JSON.stringify([sig, ...seen].slice(0, 30)))
  return repeated
}

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
  // Teclado aberto ou barra do Safari: a barra do rodapé sobe junto (sempre dá para registrar/concluir)
  const bottomInset = useBottomInset()
  // Fileira de refeições: centraliza a escolhida (só rola a fileira, não a página)
  const mealChips = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const box = mealChips.current
    const el = box?.querySelector<HTMLElement>('[aria-checked="true"]')
    if (box && el) box.scrollTo({ left: el.offsetLeft - box.clientWidth / 2 + el.offsetWidth / 2, behavior: 'smooth' })
  }, [mealId, meals.length])
  // Itens adicionados nesta visita: a tela continua aberta para adicionar o próximo
  const [added, setAdded] = useState<{ id: number; name: string; kcal: number }[]>([])
  // Montar o prato: alimentos marcados na lista, registrados juntos
  const [plate, setPlate] = useState<Record<number, PlateItem>>({})
  const [plateEdit, setPlateEdit] = useState<number | null>(null)
  const [registering, setRegistering] = useState(false)
  const [searching, setSearching] = useState(false)
  const mealName = meals.find((m) => m.id === mealId)?.name ?? 'Refeição'

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
    // Veio do prato ("Outras medidas"): só troca a medida no prato
    if (plateEdit === food.id) {
      setPlate((p) => ({ ...p, [food.id]: plateItemFrom(food, quantity, portionId) }))
      setPlateEdit(null)
      setTarget(null)
      return
    }
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

  // Recentes: refeição pronta com as mesmas porções da última vez (1 toque)
  const quickAddRecipe = async (rec: RecipeSummary) => {
    try {
      const r = await api<{ entry: Entry }>('/entries', { method: 'POST', body: { date, meal_id: mealId, recipe_id: rec.id, quantity: rec.last_quantity || 1 } })
      registerAdded(r.entry)
      toast({ text: `“${rec.name}” adicionada ✓` })
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

  const removeAdded = (ids: number[]) => {
    setAdded((l) => l.filter((a) => !ids.includes(a.id)))
    setRefreshKey((k) => k + 1)
  }

  /* ── Prato ── */
  const plateItems = Object.values(plate)
  const plateKcalTotal = plateItems.reduce((a, i) => a + plateKcal(i), 0)

  const plateControls: PlateControls = {
    items: plate,
    toggle: async (f) => {
      if (plate[f.id]) {
        setPlate(({ [f.id]: _, ...rest }) => rest)
        return
      }
      navigator.vibrate?.(15)
      const item = await newPlateItem(f)
      setPlate((p) => ({ ...p, [f.id]: item }))
    },
    bump: (id, dir) =>
      setPlate((p) => {
        const i = p[id]
        const step = plateStep(i)
        return { ...p, [id]: { ...i, quantity: Math.max(step, Math.round((i.quantity + dir * step) * 100) / 100) } }
      }),
    details: (f) => {
      setPlateEdit(f.id)
      setTarget({ id: f.id })
    },
  }

  // Salvar o prato como refeição pronta (para repetir com 1 toque)
  const savePlate = async (items: PlateItem[]) => {
    const name = await askText({
      title: 'Salvar como refeição pronta',
      text: 'Na próxima vez, registre tudo com um toque.',
      input: { label: 'Nome', value: `${mealName} de sempre`, maxLength: 120 },
      confirmLabel: 'Salvar',
    })
    if (!name) return
    try {
      await api('/recipes', { method: 'POST', body: { name, servings: 1, items: items.map((i) => ({ food_id: i.food.id, quantity: i.quantity, portion_id: i.portion_id })) } })
      setRefreshKey((k) => k + 1)
      toast({ text: `“${name}” salva em Prontas ✓` })
    } catch (e) {
      toast({ text: (e as ApiError).message })
    }
  }

  const registerPlate = async () => {
    const items = plateItems
    setRegistering(true)
    const entries: Entry[] = []
    try {
      for (const i of items) {
        const r = await api<{ entry: Entry }>('/entries', { method: 'POST', body: { date, meal_id: mealId, food_id: i.food.id, quantity: i.quantity, portion_id: i.portion_id } })
        entries.push(r.entry)
        registerAdded(r.entry)
      }
      setPlate({})
      localStorage.setItem(PLATE_HINT_KEY, '1')
      navigator.vibrate?.(30)
      toast({
        text: `${entries.length === 1 ? '1 item registrado' : `${entries.length} itens registrados`} ✓`,
        actions: [
          {
            label: 'Desfazer',
            run: () => {
              Promise.all(entries.map((e) => api(`/entries/${e.id}`, { method: 'DELETE' }))).catch(() => {})
              removeAdded(entries.map((e) => e.id))
            },
          },
          ...(items.length >= 2 && repeatedPlate(items) ? [{ label: 'Salvar como pronta', run: () => savePlate(items) }] : []),
        ],
      })
    } catch (e) {
      toast({ text: (e as ApiError).message })
    } finally {
      setRegistering(false)
    }
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
    setSearching(q.length > 0)
  }, [])


  return (
    <div className={`safe-top mx-auto flex min-h-full max-w-lg flex-col px-5 pt-4 ${added.length || plateItems.length ? 'pb-32' : 'pb-8'}`}>
      <header className="mb-3 flex items-center gap-3">
        <BackButton onClick={() => (added.length ? goHome() : navigate(-1))} />
        <h1 className="text-xl font-bold">Registrar refeição</h1>
      </header>

      {/* Em qual refeição: todas à vista, a atual destacada (a do horário já vem escolhida) */}
      <div ref={mealChips} className="relative -mx-5 mb-4 overflow-x-auto px-5 [scrollbar-width:none]" role="radiogroup" aria-label="Refeição">
        <div className="flex gap-2">
          {meals.length === 0 && [0, 1, 2].map((i) => <span key={i} className="h-10 w-28 shrink-0 animate-pulse rounded-full bg-soft" />)}
          {meals.filter((m) => m.active || m.id === mealId).map((m) => {
            const active = m.id === mealId
            return (
              <button
                key={m.id}
                role="radio"
                aria-checked={active}
                onClick={() => setMealId(m.id)}
                className={`flex h-10 shrink-0 items-center gap-1.5 rounded-full border-2 px-4 text-sm font-bold whitespace-nowrap transition-colors ${
                  active ? 'border-primary bg-primary text-white' : 'border-line bg-surface text-ink active:bg-soft'
                }`}
              >
                {active && <Check className="size-4" strokeWidth={3} />}
                {m.name}
                {m.time && <span className={`font-medium ${active ? 'text-white/80' : 'text-muted'}`}>{m.time}</span>}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        {!searching && mealId > 0 && (
          <MealSuggestions
            mealId={mealId}
            mealName={mealName}
            date={date}
            refreshKey={refreshKey}
            onAdded={(entries) => entries.forEach(registerAdded)}
            onRemoved={removeAdded}
          />
        )}
        <FoodSearch
          plate={plateControls}
          withRecipes
          refreshKey={refreshKey}
          onPickFood={setTarget}
          onPickRecipe={setRecipe}
          onScan={() => setScanning(true)}
          onQueryChange={onQueryChange}
          onQuickAdd={quickAdd}
          onQuickAddRecipe={quickAddRecipe}
        />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <button
          onClick={() => navigate(createUrl(query.current ? { nome: query.current } : {}))}
          className="rounded-2xl border-2 border-dashed border-line py-4 text-center text-sm font-semibold text-link"
        >
          + Cadastrar alimento
        </button>
        <Link to="/receitas/nova" className="rounded-2xl border-2 border-dashed border-line py-4 text-center text-sm font-semibold text-link">
          + Refeição pronta
        </Link>
      </div>

      <FoodSheet
        target={target}
        confirmLabel={plateEdit ? 'Usar no prato' : 'Adicionar'}
        onClose={() => {
          setTarget(null)
          setPlateEdit(null)
        }}
        onConfirm={addFood}
        onNotFound={onNotFound}
        onFavoriteChange={() => setRefreshKey((k) => k + 1)}
      />
      <RecipeSheet recipe={recipe} onClose={() => setRecipe(null)} onConfirm={addRecipe} onEdit={(id) => navigate(`/receitas/${id}`)} />
      <BarcodeScanner open={scanning} onClose={() => setScanning(false)} onDetected={onDetected} />

      {/* Resumo do que já entrou nesta refeição + Concluir */}
      <AnimatePresence>
        {plateItems.length > 0 && (
          <motion.div
            key="plate"
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            transition={{ type: 'spring', stiffness: 400, damping: 36 }}
            style={{ bottom: bottomInset }}
            className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur-lg"
          >
            <div className="mx-auto flex max-w-lg items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">
                  {plateItems.length} {plateItems.length === 1 ? 'item' : 'itens'} · {fmtKcal(plateKcalTotal)} kcal
                </p>
                <p className="truncate text-xs text-muted">{plateItems.map((i) => (i.food.display_name || i.food.name).split(',')[0]).join(', ')}</p>
              </div>
              <button onClick={() => setPlate({})} className="h-11 shrink-0 rounded-xl bg-soft px-3.5 text-sm font-semibold text-link active:scale-95">
                Limpar
              </button>
              <button onClick={registerPlate} disabled={registering} className="h-11 shrink-0 rounded-xl bg-primary px-5 font-semibold text-white active:scale-95 disabled:opacity-60">
                {registering ? 'Registrando…' : 'Registrar'}
              </button>
            </div>
          </motion.div>
        )}
        {added.length > 0 && plateItems.length === 0 && (
          <motion.div
            key="added"
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            transition={{ type: 'spring', stiffness: 400, damping: 36 }}
            style={{ bottom: bottomInset }}
            className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur-lg"
          >
            <div className="mx-auto flex max-w-lg items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">
                  ✓ {added.length} {added.length === 1 ? 'item' : 'itens'} · {fmtKcal(totalKcal)} kcal
                </p>
                <p className="truncate text-xs text-muted">{added.map((a) => a.name.split(',')[0]).join(', ')}</p>
              </div>
              <button onClick={undoLast} aria-label="Desfazer o último item adicionado" className="h-11 shrink-0 rounded-xl bg-soft px-3.5 text-sm font-semibold text-link active:scale-95">
                Desfazer
              </button>
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
