import { Check, Plus, Star } from 'lucide-react'
import { plateKcal, plateQtyLabel, type PlateItem } from '../lib/plate'
import { useToast } from './Toast'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { fmt, fmtKcal } from './Ring'
import { Alert } from './ui'
import { api, ApiError } from '../lib/api'
import { baseLabel, fmtQty } from '../lib/nutrition'
import type { FoodLite, OffProduct, RecipeSummary } from '../lib/types'
import type { FoodTarget } from './FoodSheet'

type Tab = 'buscar' | 'recentes' | 'favoritos' | 'receitas' | 'meus'

interface Props {
  withRecipes?: boolean
  onPickFood: (t: FoodTarget) => void
  onPickRecipe?: (r: RecipeSummary) => void
  onScan: () => void
  onQueryChange?: (q: string) => void
  /** Incrementar para recarregar as abas (ex.: após favoritar). */
  refreshKey?: number
  /** Adicionar de novo com a última porção (aba Recentes). */
  onQuickAdd?: (f: FoodLite) => void
  /** Registrar de novo uma refeição pronta com as porções da última vez (aba Recentes). */
  onQuickAddRecipe?: (r: RecipeSummary) => void
  /** Montar o prato: tocar no alimento marca ✓ (em vez de abrir a ficha) */
  plate?: PlateControls
}

export interface PlateControls {
  items: Record<number, PlateItem>
  toggle: (f: FoodLite) => void
  bump: (foodId: number, dir: 1 | -1) => void
  details: (f: FoodLite) => void
}

/** Busca de alimentos: base local + produtos de marca (Open Food Facts) + abas rápidas. */
export function FoodSearch({ withRecipes, onPickFood, onPickRecipe, onScan, onQueryChange, refreshKey = 0, onQuickAdd, onQuickAddRecipe, plate }: Props) {
  const tabs: { key: Tab; label: string }[] = [
    { key: 'buscar', label: 'Buscar' },
    { key: 'recentes', label: 'Recentes' },
    ...(withRecipes ? [{ key: 'receitas' as Tab, label: 'Prontas' }] : []),
    { key: 'favoritos', label: 'Favoritos' },
    { key: 'meus', label: 'Meus' },
  ]
  const [tab, setTab] = useState<Tab>('recentes')
  const [query, setQuery] = useState('')
  const [lists, setLists] = useState<Partial<Record<Tab, FoodLite[]>>>({})
  const [recipes, setRecipes] = useState<RecipeSummary[] | null>(null)
  const [recentRecipes, setRecentRecipes] = useState<RecipeSummary[]>([])
  const [off, setOff] = useState<OffProduct[] | null>(null)
  const [offLoading, setOffLoading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const toast = useToast()

  // Favoritar direto na lista (otimista), em todas as abas abertas; desfazer pelo aviso
  const toggleFavorite = async (f: FoodLite) => {
    const on = !f.favorite
    const apply = (v: boolean) =>
      setLists((all) => Object.fromEntries(Object.entries(all).map(([k, list]) => [k, list?.map((x) => (x.id === f.id ? { ...x, favorite: v } : x))])))
    apply(on)
    try {
      await api(`/foods/${f.id}/favorite`, { method: on ? 'POST' : 'DELETE' })
      if (on) setLists((all) => ({ ...all, favoritos: undefined })) // recarrega Favoritos ao abrir
      toast({
        text: on ? '★ Adicionado aos favoritos' : 'Tirado dos favoritos',
        action: { label: 'Desfazer', run: () => toggleFavorite({ ...f, favorite: on }) },
      })
    } catch {
      apply(!on)
    }
  }

  // Abas de lista: carregam ao abrir
  useEffect(() => {
    if (tab === 'buscar') return
    setLoading(true)
    setError(null)
    const req =
      tab === 'receitas'
        ? api<{ recipes: RecipeSummary[] }>('/recipes').then((r) => setRecipes(r.recipes))
        : api<{ foods: FoodLite[]; recipes?: RecipeSummary[] }>({ recentes: '/foods/recent', favoritos: '/foods/favorites', meus: '/foods/mine' }[tab]).then((r) => {
            setLists((l) => ({ ...l, [tab]: r.foods }))
            if (tab === 'recentes') setRecentRecipes(r.recipes ?? [])
          })
    req.catch((e: ApiError) => setError(e.message)).finally(() => setLoading(false))
  }, [tab, refreshKey])

  // Busca local (rápida) e de produtos de marca (mais lenta, com debounce maior)
  useEffect(() => {
    const q = query.trim()
    onQueryChange?.(q)
    if (q.length < 2) {
      setLists((l) => ({ ...l, buscar: undefined }))
      setOff(null)
      return
    }
    setLoading(true)
    const local = setTimeout(() => {
      api<{ foods: FoodLite[] }>(`/foods/search?q=${encodeURIComponent(q)}`)
        .then((r) => setLists((l) => ({ ...l, buscar: r.foods })))
        .catch((e: ApiError) => setError(e.message))
        .finally(() => setLoading(false))
    }, 250)
    const remote =
      q.length >= 3
        ? setTimeout(() => {
            setOffLoading(true)
            api<{ products: OffProduct[] }>(`/foods/search-off?q=${encodeURIComponent(q)}`)
              .then((r) => setOff(r.products))
              .catch(() => setOff([]))
              .finally(() => setOffLoading(false))
          }, 700)
        : undefined
    return () => {
      clearTimeout(local)
      clearTimeout(remote)
    }
  }, [query, onQueryChange])

  const foods = tab === 'buscar' ? lists.buscar : lists[tab]

  return (
    <div>
      <div className="mb-3 flex gap-2">
        <div className="relative flex-1">
          <input
            type="search"
            placeholder="Buscar alimento ou produto"
            aria-label="Buscar alimento"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setTab('buscar')
            }}
            className="h-12 w-full rounded-2xl border border-line bg-surface pr-4 pl-11 outline-none focus:border-orchid focus:ring-4 focus:ring-orchid/15"
          />
          <svg className="absolute top-3.5 left-4 size-5 text-muted" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" strokeLinecap="round" />
          </svg>
        </div>
        <button onClick={onScan} aria-label="Ler código de barras" className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-white shadow-md transition-transform active:scale-90">
          <svg className="size-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" viewBox="0 0 24 24">
            <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 8v8M10 8v8M13 8v8M17 8v8" />
          </svg>
        </button>
      </div>

      {/* Abas de largura igual: todas visíveis, sem rolagem lateral escondida */}
      <div className="mb-4 grid gap-1 rounded-full bg-soft p-1" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }} role="tablist" aria-label="Onde procurar">
        {tabs.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)} className="relative min-w-0 rounded-full px-1 py-2 text-xs font-semibold">
            {tab === t.key && <motion.span layoutId="food-tab" className="absolute inset-0 rounded-full bg-primary" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
            <span className={`relative block truncate ${tab === t.key ? 'text-white' : 'text-muted'}`}>{t.label}</span>
          </button>
        ))}
      </div>

      {error && <Alert>{error}</Alert>}

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
          {tab === 'receitas' ? (
            <RecipeList recipes={recipes} loading={loading} onPick={onPickRecipe} />
          ) : (
            <>
              {loading && !foods && <ListSkeleton />}
              {foods && (foods.length > 0 || (tab === 'recentes' && withRecipes && recentRecipes.length > 0)) && <FoodList
                  foods={foods}
                  recipes={tab === 'recentes' && withRecipes ? recentRecipes : []}
                  onPick={(f) => onPickFood({ id: f.id })}
                  onPickRecipe={onPickRecipe}
                  onQuickAdd={tab === 'recentes' ? onQuickAdd : undefined}
                  onQuickAddRecipe={onQuickAddRecipe}
                  onToggleFavorite={toggleFavorite}
                  plate={plate}
                />}
              {foods && foods.length === 0 && !(tab === 'recentes' && withRecipes && recentRecipes.length) && <Empty tab={tab} query={query} />}
              {!foods && !loading && tab === 'buscar' && (
                <p className="py-8 text-center text-sm text-muted">Digite o nome do alimento ou toque no leitor para escanear o código de barras.</p>
              )}

              {tab === 'buscar' && query.trim().length >= 3 && (
                <div className="mt-5">
                  <p className="mb-2 px-1 text-xs font-semibold tracking-wide text-muted uppercase">Produtos de marca · Open Food Facts</p>
                  {offLoading && !off && <ListSkeleton rows={3} />}
                  {off && off.length === 0 && <p className="px-1 text-sm text-muted">Nenhum produto encontrado.</p>}
                  {off && off.length > 0 && (
                    <p className="mt-2 px-1 text-xs text-muted">
                      Dados da{' '}
                      <a href="https://world.openfoodfacts.org" target="_blank" rel="noopener noreferrer" className="underline">
                        Open Food Facts
                      </a>{' '}
                      (ODbL). Confira o rótulo.
                    </p>
                  )}
                  {off && off.length > 0 && (
                    <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] bg-surface shadow-[0_2px_12px_-4px_rgba(31,23,36,0.08)]">
                      {off.slice(0, 15).map((p) => (
                        <li key={p.code}>
                          <button onClick={() => onPickFood({ ean: p.code, name: p.name })} className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left active:bg-soft">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{p.name}</p>
                              <p className="truncate text-xs text-muted">{p.brand ?? 'Sem marca'}</p>
                            </div>
                            <span className="shrink-0 text-xs text-primary">ver ›</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

/** Lista de alimentos; em Recentes, as refeições prontas entram junto, na ordem de uso. */
function FoodList({ foods, recipes = [], onPick, onPickRecipe, onQuickAdd, onQuickAddRecipe, onToggleFavorite, plate }: {
  foods: FoodLite[]
  recipes?: (RecipeSummary & { used_rank?: number })[]
  onPick: (f: FoodLite) => void
  onPickRecipe?: (r: RecipeSummary) => void
  onQuickAdd?: (f: FoodLite) => void
  onQuickAddRecipe?: (r: RecipeSummary) => void
  onToggleFavorite: (f: FoodLite) => void
  plate?: PlateControls
}) {
  const rows: ({ kind: 'food'; rank: number; food: FoodLite } | { kind: 'recipe'; rank: number; recipe: RecipeSummary })[] = [
    ...foods.map((food, i) => ({ kind: 'food' as const, rank: food.used_rank ?? -i, food })),
    ...recipes.map((recipe) => ({ kind: 'recipe' as const, rank: recipe.used_rank ?? 0, recipe })),
  ]
  if (recipes.length) rows.sort((a, b) => b.rank - a.rank)

  return (
    <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] bg-surface shadow-[0_2px_12px_-4px_rgba(31,23,36,0.08)]">
      {rows.map((row) => {
        if (row.kind === 'recipe') {
          const r = row.recipe
          return (
            <li key={`r-${r.id}`} className="flex items-center">
              <button onClick={() => onPickRecipe?.(r)} className="flex min-w-0 flex-1 items-center justify-between gap-3 px-4 py-3.5 text-left active:bg-soft">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{r.name}</p>
                  <p className="flex items-center gap-1.5 truncate text-xs text-muted">
                    <span className="rounded-full bg-orchid/15 px-1.5 py-px font-semibold text-primary">Refeição pronta</span>
                    {r.last_quantity && r.last_quantity !== 1 ? `${fmt(r.last_quantity)} porções` : `${r.items_count} ${r.items_count === 1 ? 'item' : 'itens'}`}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-bold text-primary">{fmtKcal(r.per_serving.kcal * (r.last_quantity || 1))} kcal</span>
              </button>
              {/* Mesmo espaço da estrela dos alimentos, para os + ficarem alinhados */}
              <span className="size-10 shrink-0" aria-hidden />
              {onQuickAddRecipe && (
                <button
                  onClick={() => onQuickAddRecipe(r)}
                  aria-label={`Adicionar ${r.name} de novo (mesmas porções)`}
                  className="mr-3 flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow active:scale-90"
                >
                  <Plus className="size-5" strokeWidth={2.75} />
                </button>
              )}
            </li>
          )
        }
        const f = row.food
        const quick = onQuickAdd && f.last
        const picked = plate?.items[f.id]
        const name = f.display_name || f.name
        return (
          <li key={f.id} className={`transition-colors ${picked ? 'bg-orchid/10' : ''}`}>
            <div className="flex items-center">
              <button
                onClick={() => (plate ? plate.toggle(f) : onPick(f))}
                aria-pressed={plate ? !!picked : undefined}
                className={`flex min-w-0 flex-1 items-center gap-3 py-3.5 pr-2 text-left transition-colors active:bg-soft ${plate ? 'pl-3' : 'pl-4'}`}
              >
                {plate && (
                  <span className={`flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${picked ? 'border-primary bg-primary text-white' : 'border-line'}`} aria-hidden>
                    {picked && <Check className="size-3.5" strokeWidth={3.5} />}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{name}</p>
                  <p className="truncate text-xs text-muted">
                    {picked
                      ? plateQtyLabel(picked)
                      : quick
                        ? `Última vez: ${f.last!.unit_label.includes('(') ? `${f.last!.quantity} × ${f.last!.unit_label}` : `${f.last!.quantity} ${f.last!.unit_label}`}`
                        : `${f.brand ? `${f.brand} · ` : ''}${baseLabel(f)} · ${f.user_id ? 'meu' : f.source === 'taco' ? 'TACO' : 'Open Food Facts'}`}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-bold text-primary">{fmtKcal(picked ? plateKcal(picked) : quick ? f.last!.kcal : f.kcal)} kcal</span>
              </button>
              <button
                onClick={() => onToggleFavorite(f)}
                aria-label={f.favorite ? `Tirar ${name} dos favoritos` : `Favoritar ${name}`}
                aria-pressed={!!f.favorite}
                className={`flex size-10 shrink-0 items-center justify-center rounded-full active:scale-90 ${quick && !picked ? '' : 'mr-1.5'}`}
              >
                <Star className={`size-5 ${f.favorite ? 'fill-amber-400 text-amber-400' : 'text-muted/70'}`} />
              </button>
              {quick && !picked && (
                <button
                  onClick={() => onQuickAdd!(f)}
                  aria-label={`Adicionar ${name} de novo (mesma porção)`}
                  className="mr-3 flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow active:scale-90"
                >
                  <Plus className="size-5" strokeWidth={2.75} />
                </button>
              )}
            </div>
            {/* No prato: quantidade ali mesmo (− e +); outras medidas na ficha */}
            {picked && (
              <div className="flex items-center gap-2 pr-4 pb-3 pl-12">
                <button onClick={() => plate!.bump(f.id, -1)} aria-label={`Menos ${name}`} className="flex size-9 items-center justify-center rounded-xl bg-surface text-lg font-bold text-primary shadow-sm active:scale-90">−</button>
                <span className="min-w-14 text-center text-base font-bold whitespace-nowrap">{picked.portion_id ? fmtQty(picked.quantity) : `${fmtQty(picked.quantity)} ${picked.unit_label}`}</span>
                <button onClick={() => plate!.bump(f.id, 1)} aria-label={`Mais ${name}`} className="flex size-9 items-center justify-center rounded-xl bg-surface text-lg font-bold text-primary shadow-sm active:scale-90">+</button>
                <button onClick={() => plate!.details(f)} className="ml-auto shrink-0 text-xs font-semibold whitespace-nowrap text-primary underline-offset-2 active:underline">Outras medidas</button>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function RecipeList({ recipes, loading, onPick }: { recipes: RecipeSummary[] | null; loading: boolean; onPick?: (r: RecipeSummary) => void }) {
  if (loading && !recipes) return <ListSkeleton />
  if (!recipes?.length) return <p className="py-8 text-center text-sm text-muted">Salve combinações que você repete (ex.: “Café padrão”) ou receitas, e adicione com um toque.</p>
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] bg-surface shadow-[0_2px_12px_-4px_rgba(31,23,36,0.08)]">
      {recipes.map((r) => (
        <li key={r.id}>
          <button onClick={() => onPick?.(r)} className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left active:bg-soft">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{r.name}</p>
              <p className="truncate text-xs text-muted">
                {r.items_count} {r.items_count === 1 ? 'ingrediente' : 'ingredientes'} · por porção
              </p>
            </div>
            <span className="shrink-0 text-sm font-semibold text-primary">{fmtKcal(r.per_serving.kcal)} kcal</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

function Empty({ tab, query }: { tab: Tab; query: string }) {
  const text = {
    buscar: `Nada na base para “${query}”. Veja os produtos de marca abaixo ou cadastre.`,
    recentes: 'Os alimentos que você registrar aparecem aqui.',
    favoritos: 'Toque na estrela de um alimento para favoritar.',
    receitas: '',
    meus: 'Você ainda não cadastrou alimentos.',
  }[tab]
  return <p className="py-8 text-center text-sm text-muted">{text}</p>
}

function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-2xl bg-soft" style={{ animationDelay: `${i * 80}ms` }} />
      ))}
    </div>
  )
}
