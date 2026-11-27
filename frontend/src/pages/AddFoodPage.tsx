import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronUp, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ask, askText } from '../components/Dialog'
import { EntrySheet } from '../components/EntrySheet'
import { FoodSearch } from '../components/FoodSearch'
import { FoodSheet, type FoodTarget } from '../components/FoodSheet'
import { notifyChanged } from '../components/Layout'
import { LazyBarcodeScanner as BarcodeScanner } from '../components/LazyBarcodeScanner'
import { MealHistory } from '../components/MealCard'
import { MealSuggestions } from '../components/MealSuggestions'
import { RecipeSheet, type RecipeAdjustment } from '../components/RecipeSheet'
import { fmtKcal } from '../components/Ring'
import { useToast } from '../components/Toast'
import { BackButton } from '../components/ui'
import { api, ApiError } from '../lib/api'
import { isoDate } from '../lib/date'
import { mealForNow } from '../lib/meals'
import { entryBody, foodPlateItem, plateKcal, plateName, plateQtyLabel, type PlateItem } from '../lib/plate'
import type { DayData, Entry, FoodDetail, Meal, RecipeSummary } from '../lib/types'
import { useBottomInset } from '../lib/viewport'

/**
 * "Salvar refeição" só aparece quando o mesmo prato (mesmos alimentos) já foi registrado antes.
 * Guarda no aparelho os pratos registrados (até 30).
 */
const PLATES_KEY = 'dt_plates_seen'
function repeatedPlate(items: PlateItem[]) {
  const sig = items.map((i) => i.key).sort().join(',')
  const seen: string[] = JSON.parse(localStorage.getItem(PLATES_KEY) ?? '[]')
  const repeated = seen.includes(sig)
  if (!repeated) localStorage.setItem(PLATES_KEY, JSON.stringify([sig, ...seen].slice(0, 30)))
  return repeated
}

/**
 * Registrar refeição:
 * escolhe a refeição → vê o que já comeu nela → toca nos alimentos (ficha → "Usar no prato")
 * → confere o prato na barra de baixo (expande para cima) → Registrar (finaliza e volta).
 */
export function AddFoodPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [params] = useSearchParams()
  const date = params.get('data') ?? isoDate()
  // Sem refeição válida no link: usa a do horário (dá para trocar na fileira)
  const [mealId, setMealId] = useState(() => Number(params.get('refeicao')) || 0)
  const [meals, setMeals] = useState<Meal[]>([])
  const [day, setDay] = useState<DayData | null>(null)
  // Volta do cadastro manual já com o alimento novo aberto
  const [target, setTarget] = useState<FoodTarget | null>(() => (Number(params.get('novo')) ? { id: Number(params.get('novo')) } : null))
  const [recipe, setRecipe] = useState<RecipeSummary | null>(null)
  const [scanning, setScanning] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [searching, setSearching] = useState(false)
  const [editing, setEditing] = useState<Entry | null>(null)
  // Prato: o que vai entrar na refeição (registrado tudo junto)
  const [plate, setPlate] = useState<PlateItem[]>([])
  const [plateOpen, setPlateOpen] = useState(false)
  const [registering, setRegistering] = useState(false)
  // Toque num item do prato: reabre a ficha para trocar a quantidade
  const [replacing, setReplacing] = useState<string | null>(null)
  const bottomInset = useBottomInset()
  const mealName = meals.find((m) => m.id === mealId)?.name ?? 'Refeição'

  // Fileira de refeições: centraliza a escolhida (só rola a fileira, não a página)
  const mealChips = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const box = mealChips.current
    const el = box?.querySelector<HTMLElement>('[aria-checked="true"]')
    if (box && el) box.scrollTo({ left: el.offsetLeft - box.clientWidth / 2 + el.offsetWidth / 2, behavior: 'smooth' })
  }, [mealId, meals.length])

  useEffect(() => {
    api<{ meals: Meal[] }>('/meals').then((r) => {
      setMeals(r.meals)
      setMealId((id) => (r.meals.some((m) => m.id === id) ? id : (mealForNow(r.meals)?.id ?? r.meals[0]?.id ?? 0)))
    })
  }, [])

  // O que já foi registrado no dia (para "Você já comeu")
  const loadDay = useCallback(() => api<DayData>(`/day/${date}`).then(setDay).catch(() => {}), [date])
  useEffect(() => {
    loadDay()
  }, [loadDay, refreshKey])
  const dayMeal = day?.meals.find((m) => m.id === mealId)

  const goHome = () => navigate(`/${date === isoDate() ? '' : `?data=${date}`}`, { replace: true })

  /* ── Prato ── */
  const plateKcalTotal = plate.reduce((a, i) => a + plateKcal(i), 0)

  const putOnPlate = (item: PlateItem) => {
    navigator.vibrate?.(15)
    setPlate((list) => {
      const without = list.filter((x) => x.key !== (replacing ?? item.key) && x.key !== item.key)
      const at = list.findIndex((x) => x.key === (replacing ?? item.key))
      const next = [...without]
      next.splice(at === -1 ? next.length : at, 0, item)
      return next
    })
    setReplacing(null)
  }

  const useFood = async (food: FoodDetail, quantity: number, portionId: number | null) => {
    putOnPlate(foodPlateItem(food, quantity, portionId))
    setTarget(null)
  }

  const useRecipe = async (servings: number, items: RecipeAdjustment[] | null) => {
    putOnPlate({ key: `r-${recipe!.id}`, kind: 'recipe', recipe: recipe!, servings, items })
    setRecipe(null)
  }

  const editPlateItem = (i: PlateItem) => {
    setReplacing(i.key)
    if (i.kind === 'food') setTarget({ id: i.food.id })
    else setRecipe(i.recipe)
  }

  // Salvar o prato como refeição completa (só alimentos; para repetir com 1 toque)
  const savePlate = async (items: PlateItem[]) => {
    const foods = items.filter((i): i is Extract<PlateItem, { kind: 'food' }> => i.kind === 'food')
    const name = await askText({
      title: 'Salvar como refeição completa',
      text: 'Na próxima vez, registre tudo com um toque.',
      input: { label: 'Nome', value: `${mealName} de sempre`, maxLength: 120 },
      confirmLabel: 'Salvar',
    })
    if (!name) return
    try {
      await api('/recipes', { method: 'POST', body: { name, servings: 1, items: foods.map((i) => ({ food_id: i.food.id, quantity: i.quantity, portion_id: i.portion_id })) } })
      toast({ text: `“${name}” salva em Refeições completas ✓` })
    } catch (e) {
      toast({ text: (e as ApiError).message })
    }
  }

  // Registrar: grava tudo, volta para a tela inicial e oferece desfazer
  const registerPlate = async () => {
    const items = plate
    setRegistering(true)
    const entries: Entry[] = []
    try {
      for (const i of items) {
        const r = await api<{ entry: Entry }>('/entries', { method: 'POST', body: { date, meal_id: mealId, ...entryBody(i) } })
        entries.push(r.entry)
      }
      navigator.vibrate?.(30)
      const canSave = items.filter((i) => i.kind === 'food').length >= 2 && repeatedPlate(items)
      toast({
        text: `${entries.length === 1 ? '1 item registrado' : `${entries.length} itens registrados`} no ${mealName.toLowerCase()} ✓`,
        actions: [
          {
            label: 'Desfazer',
            run: () => {
              Promise.all(entries.map((e) => api(`/entries/${e.id}`, { method: 'DELETE' })))
                .then(notifyChanged)
                .catch(() => {})
            },
          },
          ...(canSave ? [{ label: 'Salvar refeição', run: () => savePlate(items) }] : []),
        ],
      })
      goHome()
    } catch (e) {
      toast({ text: (e as ApiError).message })
      setRegistering(false)
    }
  }

  const onDetected = useCallback((ean: string) => {
    setScanning(false)
    setTarget({ ean })
  }, [])

  // Código de barras não encontrado: cadastrar (memorizado: o FoodSheet refaz a busca se mudar)
  const onNotFound = useCallback(
    (ean: string, name?: string) => {
      setTarget(null)
      toast({ text: 'Produto não encontrado. Cadastre com os dados do rótulo.' })
      const p = new URLSearchParams({ data: date, refeicao: String(mealId), ean, ...(name ? { nome: name } : {}) })
      navigate(`/alimentos/novo?${p}`)
    },
    [date, mealId, navigate, toast],
  )

  const onQueryChange = useCallback((q: string) => setSearching(q.length > 0), [])

  const leave = async () => {
    if (plate.length && !(await ask({ title: 'Sair sem registrar?', text: 'O que está no prato não será registrado.', confirmLabel: 'Sair sem registrar', cancelLabel: 'Continuar aqui', danger: true }))) return
    navigate(-1)
  }

  return (
    <div className={`safe-top mx-auto flex min-h-full max-w-lg flex-col px-5 pt-4 ${plate.length ? 'pb-36' : 'pb-8'}`}>
      <header className="mb-3 flex items-center gap-3">
        <BackButton onClick={leave} />
        <h1 className="text-xl font-bold">Registrar refeição</h1>
      </header>

      {/* Em qual refeição: todas à vista, a atual destacada (a do horário já vem escolhida) */}
      <div ref={mealChips} className="relative -mx-5 mb-3 overflow-x-auto px-5 [scrollbar-width:none]" role="radiogroup" aria-label="Refeição">
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

      {/* O que já foi registrado nesta refeição hoje (recolhido) */}
      {dayMeal && !searching && (
        <div className="mb-4">
          <MealHistory meal={dayMeal} onEdit={setEditing} onChange={() => setRefreshKey((k) => k + 1)} />
        </div>
      )}

      {/* "Igual a ontem" só enquanto a refeição de hoje ainda está vazia */}
      {!searching && mealId > 0 && day && !dayMeal?.entries.length && (
        <MealSuggestions mealId={mealId} mealName={mealName} date={date} refreshKey={refreshKey} onAdded={() => setRefreshKey((k) => k + 1)} onRemoved={() => setRefreshKey((k) => k + 1)} />
      )}

      {mealId === 0 && <div className="h-40 animate-pulse rounded-[var(--radius-card)] bg-soft" />}
      {mealId > 0 && <FoodSearch
        withRecipes
        refreshKey={refreshKey}
        mealId={mealId || undefined}
        mealName={mealName}
        onPickFood={(t) => {
          setReplacing(null)
          setTarget(t)
        }}
        onPickRecipe={(r) => {
          setReplacing(null)
          setRecipe(r)
        }}
        onScan={() => setScanning(true)}
        onQueryChange={onQueryChange}
        onCreateFood={(q) => navigate(`/alimentos/novo?${new URLSearchParams({ data: date, refeicao: String(mealId), ...(q ? { nome: q } : {}) })}`)}
      />}

      <FoodSheet
        target={target}
        confirmLabel={replacing ? 'Atualizar no prato' : 'Usar no prato'}
        onClose={() => {
          setTarget(null)
          setReplacing(null)
        }}
        onConfirm={useFood}
        onNotFound={onNotFound}
        onFavoriteChange={() => setRefreshKey((k) => k + 1)}
      />
      <RecipeSheet
        recipe={recipe}
        confirmLabel={replacing ? 'Atualizar no prato' : 'Usar no prato'}
        onClose={() => {
          setRecipe(null)
          setReplacing(null)
        }}
        onConfirm={useRecipe}
        onEdit={(id) => navigate(`/receitas/${id}`)}
      />
      <EntrySheet entry={editing} meals={day?.meals ?? []} onClose={() => setEditing(null)} onChanged={() => setRefreshKey((k) => k + 1)} />
      <BarcodeScanner open={scanning} onClose={() => setScanning(false)} onDetected={onDetected} />

      {/* Prato: barra de baixo; toque no resumo para ver (e ajustar) tudo que vai entrar */}
      <AnimatePresence>
        {plate.length > 0 && (
          <motion.div
            key="plate"
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            transition={{ type: 'spring', stiffness: 400, damping: 36 }}
            style={{ bottom: bottomInset }}
            className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 shadow-[0_-8px_30px_-12px_rgba(0,0,0,0.35)] backdrop-blur-lg"
          >
            <div className="mx-auto max-w-lg">
              <AnimatePresence initial={false}>
                {plateOpen && (
                  <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                    <div className="max-h-[50dvh] overflow-y-auto overscroll-contain px-5 pt-4">
                      <div className="mb-1 flex items-center justify-between">
                        <p className="text-xs font-bold tracking-wider text-muted uppercase">No prato do {mealName.toLowerCase()}</p>
                        <button
                          onClick={() => {
                            setPlate([])
                            setPlateOpen(false)
                          }}
                          className="h-9 rounded-xl bg-soft px-3 text-sm font-semibold text-link active:scale-95"
                        >
                          Limpar prato
                        </button>
                      </div>
                      <ul className="divide-y divide-line">
                        {plate.map((i) => (
                          <li key={i.key} className="flex items-center gap-2">
                            <button onClick={() => editPlateItem(i)} className="flex min-w-0 flex-1 items-center justify-between gap-3 py-3 text-left">
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-semibold">{plateName(i)}</span>
                                <span className="block truncate text-xs text-muted">{plateQtyLabel(i)} · toque para ajustar</span>
                              </span>
                              <span className="shrink-0 text-sm font-bold text-link">{fmtKcal(plateKcal(i))} kcal</span>
                            </button>
                            <button
                              onClick={() => setPlate((l) => l.filter((x) => x.key !== i.key))}
                              aria-label={`Tirar ${plateName(i)} do prato`}
                              className="flex size-10 shrink-0 items-center justify-center rounded-full text-muted active:bg-soft"
                            >
                              <X className="size-5" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="flex items-center gap-3 px-5 py-3">
                <button onClick={() => setPlateOpen((o) => !o)} aria-expanded={plateOpen} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                  <motion.span animate={{ rotate: plateOpen ? 180 : 0 }} className="flex size-8 shrink-0 items-center justify-center rounded-full bg-soft text-link">
                    <ChevronUp className="size-5" />
                  </motion.span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">
                      {plate.length} {plate.length === 1 ? 'item' : 'itens'} · {fmtKcal(plateKcalTotal)} kcal
                    </span>
                    <span className="block truncate text-xs text-muted">{plateOpen ? 'Toque para recolher' : 'Toque para ver o prato'}</span>
                  </span>
                </button>
                <button onClick={registerPlate} disabled={registering} className="h-11 shrink-0 rounded-xl bg-primary px-5 font-semibold text-white active:scale-95 disabled:opacity-60">
                  {registering ? 'Registrando…' : 'Registrar'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
