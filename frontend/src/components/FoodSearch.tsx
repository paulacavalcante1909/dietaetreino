import { ChevronRight, Plus, Star } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useToast } from './Toast'
import { fmt, fmtKcal } from './Ring'
import { Alert } from './ui'
import { api, ApiError } from '../lib/api'
import { baseLabel } from '../lib/nutrition'
import type { FoodLite, OffProduct, RecipeSummary } from '../lib/types'
import type { FoodTarget } from './FoodSheet'

type Tab = 'buscar' | 'recentes' | 'favoritos' | 'receitas' | 'meus'

interface Props {
  withRecipes?: boolean
  onPickFood: (t: FoodTarget) => void
  onPickRecipe?: (r: RecipeSummary) => void
  onScan: () => void
  onQueryChange?: (q: string) => void
  /** Nada encontrado na busca: cadastrar o alimento (recebe o que foi digitado). */
  onCreateFood?: (query: string) => void
  /** Incrementar para recarregar as abas (ex.: após registrar). */
  refreshKey?: number
}

const PLACEHOLDER: Record<Tab, string> = {
  buscar: 'Buscar alimento ou produto',
  recentes: 'Buscar nos recentes',
  receitas: 'Buscar nas refeições prontas',
  favoritos: 'Buscar nos favoritos',
  meus: 'Buscar nos meus alimentos',
}

/** Sem acento e minúsculo, para filtrar as listas das abas */
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const matches = (q: string) => {
  const words = norm(q).split(/\s+/).filter(Boolean)
  return (name: string) => words.every((w) => norm(name).includes(w))
}

/**
 * Busca de alimentos com abas. A busca vale dentro da aba aberta (em Favoritos, só favoritos…);
 * em "Buscar", procura na base toda + produtos de marca (Open Food Facts).
 * Tocar num item abre a ficha (quantidade e medida).
 */
export function FoodSearch({ withRecipes, onPickFood, onPickRecipe, onScan, onQueryChange, onCreateFood, refreshKey = 0 }: Props) {
  const tabs: { key: Tab; label: string }[] = [
    { key: 'buscar', label: 'Buscar' },
    { key: 'recentes', label: 'Recentes' },
    ...(withRecipes ? [{ key: 'receitas' as Tab, label: 'Refeições prontas' }] : []),
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
  const searchInput = useRef<HTMLInputElement>(null)
  const firstLoad = useRef(false)

  // Favoritar direto na lista (otimista); desfazer pelo aviso
  const toggleFavorite = async (f: FoodLite) => {
    const on = !f.favorite
    const apply = (v: boolean) =>
      setLists((all) => Object.fromEntries(Object.entries(all).map(([k, list]) => [k, list?.map((x) => (x.id === f.id ? { ...x, favorite: v } : x))])))
    apply(on)
    try {
      await api(`/foods/${f.id}/favorite`, { method: on ? 'POST' : 'DELETE' })
      toast({ text: on ? '★ Adicionado aos favoritos' : 'Tirado dos favoritos', action: { label: 'Desfazer', run: () => toggleFavorite({ ...f, favorite: on }) } })
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
            // Primeira vez (nada recente): vai direto para a busca, com o teclado aberto
            if (tab === 'recentes' && !firstLoad.current && r.foods.length === 0 && !(r.recipes ?? []).length) {
              setTab('buscar')
              searchInput.current?.focus()
            }
            firstLoad.current = true
          })
    req.catch((e: ApiError) => setError(e.message)).finally(() => setLoading(false))
  }, [tab, refreshKey])

  // Aba "Buscar": base local (rápida) + produtos de marca (mais lenta)
  useEffect(() => {
    const q = query.trim()
    onQueryChange?.(q)
    if (tab !== 'buscar') return
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
  }, [query, tab, onQueryChange])

  // Nas outras abas, a busca filtra a lista da própria aba
  const q = query.trim()
  const filter = q && tab !== 'buscar' ? matches(q) : null
  const rawFoods = tab === 'buscar' ? lists.buscar : lists[tab]
  const foods = filter ? rawFoods?.filter((f) => filter(f.display_name || f.name)) : rawFoods
  const shownRecipes = filter ? recipes?.filter((r) => filter(r.name)) ?? null : recipes
  const shownRecent = tab === 'recentes' && withRecipes ? (filter ? recentRecipes.filter((r) => filter(r.name)) : recentRecipes) : []
  const notFound = tab === 'buscar' && q.length >= 2 && !loading && foods?.length === 0

  return (
    <div>
      <div className="mb-3 flex gap-2">
        <div className="relative flex-1">
          <input
            ref={searchInput}
            type="search"
            placeholder={PLACEHOLDER[tab]}
            aria-label={PLACEHOLDER[tab]}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
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

      {/* Abas: rolam de lado se não couberem */}
      <div className="-mx-5 mb-4 overflow-x-auto px-5 [scrollbar-width:none]">
        <div className="flex min-w-full gap-1 rounded-full bg-soft p-1" role="tablist" aria-label="Onde procurar">
          {tabs.map((t) => (
            <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)} className="relative flex-1 shrink-0 rounded-full px-3 py-2 text-[13px] font-semibold whitespace-nowrap">
              {tab === t.key && <motion.span layoutId="food-tab" className="absolute inset-0 rounded-full bg-primary" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
              <span className={`relative block ${tab === t.key ? 'text-white' : 'text-muted'}`}>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {error && <Alert>{error}</Alert>}

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
          {tab === 'receitas' ? (
            <>
              <RecipeList recipes={shownRecipes} loading={loading} filtered={!!filter} onPick={onPickRecipe} />
              <Link to="/receitas/nova" className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line text-sm font-bold text-link active:bg-soft">
                <Plus className="size-4" /> Criar refeição pronta
              </Link>
            </>
          ) : (
            <>
              {loading && !foods && <ListSkeleton />}
              {foods && (foods.length > 0 || shownRecent.length > 0) && (
                <FoodList foods={foods} recipes={shownRecent} onPick={(f) => onPickFood({ id: f.id })} onPickRecipe={onPickRecipe} onToggleFavorite={toggleFavorite} showLast={tab === 'recentes'} />
              )}
              {foods && foods.length === 0 && shownRecent.length === 0 && !notFound && <Empty tab={tab} filtered={!!filter} />}
              {!foods && !loading && tab === 'buscar' && (
                <p className="py-8 text-center text-sm text-muted">Digite o nome do alimento ou toque no leitor para escanear o código de barras.</p>
              )}

              {/* Não achou na base: cadastrar (só aparece quando nada foi encontrado) */}
              {notFound && (
                <div className="rounded-[var(--radius-card)] bg-surface p-4 text-center shadow-[0_2px_12px_-4px_rgba(31,23,36,0.08)]">
                  <p className="text-sm text-muted">Não encontramos “{q}” na nossa base{off && off.length > 0 ? '. Veja os produtos de marca abaixo ou cadastre.' : '.'}</p>
                  {onCreateFood && (
                    <button onClick={() => onCreateFood(q)} className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-soft text-sm font-bold text-link active:scale-[0.98]">
                      <Plus className="size-4" /> Cadastrar “{q}”
                    </button>
                  )}
                </div>
              )}

              {tab === 'buscar' && q.length >= 3 && (
                <div className="mt-5">
                  <p className="mb-2 px-1 text-xs font-semibold tracking-wider text-muted uppercase">Produtos de marca · Open Food Facts</p>
                  {offLoading && !off && <ListSkeleton rows={3} />}
                  {off && off.length === 0 && <p className="px-1 text-sm text-muted">Nenhum produto encontrado.</p>}
                  {off && off.length > 0 && (
                    <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] bg-surface shadow-[0_2px_12px_-4px_rgba(31,23,36,0.08)]">
                      {off.slice(0, 15).map((p) => (
                        <li key={p.code}>
                          <button onClick={() => onPickFood({ ean: p.code, name: p.name })} className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left active:bg-soft">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{p.name}</p>
                              <p className="truncate text-xs text-muted">{p.brand ?? 'Sem marca'}</p>
                            </div>
                            <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {off && off.length > 0 && (
                    <p className="mt-2 px-1 text-xs text-muted">
                      Dados da{' '}
                      <a href="https://world.openfoodfacts.org" target="_blank" rel="noopener noreferrer" className="underline">
                        Open Food Facts
                      </a>{' '}
                      (ODbL). Confira o rótulo.
                    </p>
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

/** Lista de alimentos; em Recentes, as refeições prontas entram junto, na ordem de uso. Tocar abre a ficha. */
function FoodList({ foods, recipes = [], onPick, onPickRecipe, onToggleFavorite, showLast }: {
  foods: FoodLite[]
  recipes?: (RecipeSummary & { used_rank?: number })[]
  onPick: (f: FoodLite) => void
  onPickRecipe?: (r: RecipeSummary) => void
  onToggleFavorite: (f: FoodLite) => void
  showLast: boolean
}) {
  const rows: ({ kind: 'food'; rank: number; food: FoodLite } | { kind: 'recipe'; rank: number; recipe: RecipeSummary })[] = [
    ...foods.map((food, i) => ({ kind: 'food' as const, rank: food.used_rank ?? -i, food })),
    ...recipes.map((recipe) => ({ kind: 'recipe' as const, rank: recipe.used_rank ?? 0, recipe })),
  ]
  if (recipes.length) rows.sort((a, b) => b.rank - a.rank)

  // Fecha o teclado ao escolher (a ficha e a barra do rodapé ficam visíveis)
  const blur = () => (document.activeElement as HTMLElement | null)?.blur()

  return (
    <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] bg-surface shadow-[0_2px_12px_-4px_rgba(31,23,36,0.08)]">
      {rows.map((row) => {
        if (row.kind === 'recipe') {
          const r = row.recipe
          return (
            <li key={`r-${r.id}`}>
              <button onClick={() => (blur(), onPickRecipe?.(r))} className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left active:bg-soft">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{r.name}</p>
                  <p className="flex items-center gap-1.5 truncate text-xs text-muted">
                    <span className="rounded-full bg-orchid/15 px-1.5 py-px font-semibold text-link">Refeição pronta</span>
                    {r.last_quantity && r.last_quantity !== 1 ? `${fmt(r.last_quantity)} porções` : `${r.items_count} ${r.items_count === 1 ? 'item' : 'itens'}`}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-bold text-link">{fmtKcal(r.per_serving.kcal * (r.last_quantity || 1))} kcal</span>
              </button>
            </li>
          )
        }
        const f = row.food
        const last = showLast && f.last
        const name = f.display_name || f.name
        return (
          <li key={f.id} className="flex items-center">
            <button onClick={() => (blur(), onPick(f))} className="flex min-w-0 flex-1 items-center gap-3 py-3.5 pr-2 pl-4 text-left transition-colors active:bg-soft">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{name}</p>
                <p className="truncate text-xs text-muted">
                  {last
                    ? `Última vez: ${f.last!.unit_label.includes('(') ? `${f.last!.quantity} × ${f.last!.unit_label}` : `${f.last!.quantity} ${f.last!.unit_label}`}`
                    : `${f.brand ? `${f.brand} · ` : ''}${baseLabel(f)} · ${f.user_id ? 'meu' : f.source === 'taco' ? 'TACO' : 'Open Food Facts'}`}
                </p>
              </div>
              <span className="shrink-0 text-sm font-bold text-link">{fmtKcal(last ? f.last!.kcal : f.kcal)} kcal</span>
            </button>
            <button
              onClick={() => onToggleFavorite(f)}
              aria-label={f.favorite ? `Tirar ${name} dos favoritos` : `Favoritar ${name}`}
              aria-pressed={!!f.favorite}
              className="mr-1.5 flex size-10 shrink-0 items-center justify-center rounded-full active:scale-90"
            >
              <Star className={`size-5 ${f.favorite ? 'fill-amber-400 text-amber-400' : 'text-muted/70'}`} />
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function RecipeList({ recipes, loading, filtered, onPick }: { recipes: RecipeSummary[] | null; loading: boolean; filtered: boolean; onPick?: (r: RecipeSummary) => void }) {
  if (loading && !recipes) return <ListSkeleton />
  if (!recipes?.length)
    return (
      <p className="py-6 text-center text-sm text-muted">
        {filtered ? 'Nenhuma refeição pronta com esse nome.' : 'Salve combinações que você repete (ex.: “Café padrão”) e registre com um toque.'}
      </p>
    )
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] bg-surface shadow-[0_2px_12px_-4px_rgba(31,23,36,0.08)]">
      {recipes.map((r) => (
        <li key={r.id}>
          <button onClick={() => onPick?.(r)} className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left active:bg-soft">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{r.name}</p>
              <p className="truncate text-xs text-muted">
                {r.items_count} {r.items_count === 1 ? 'item' : 'itens'} · por porção
              </p>
            </div>
            <span className="shrink-0 text-sm font-bold text-link">{fmtKcal(r.per_serving.kcal)} kcal</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

function Empty({ tab, filtered }: { tab: Tab; filtered: boolean }) {
  const text = filtered
    ? 'Nada com esse nome nesta aba. Tente em Buscar.'
    : {
        buscar: '',
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
