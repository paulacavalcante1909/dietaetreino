import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { fmt } from './Ring'
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
  /** Incrementar para recarregar as abas (ex.: após favoritar). */
  refreshKey?: number
}

/** Busca de alimentos: base local + produtos de marca (Open Food Facts) + abas rápidas. */
export function FoodSearch({ withRecipes, onPickFood, onPickRecipe, onScan, onQueryChange, refreshKey = 0 }: Props) {
  const tabs: { key: Tab; label: string }[] = [
    { key: 'buscar', label: 'Buscar' },
    { key: 'recentes', label: 'Recentes' },
    { key: 'favoritos', label: 'Favoritos' },
    ...(withRecipes ? [{ key: 'receitas' as Tab, label: 'Refeições prontas' }] : []),
    { key: 'meus', label: 'Meus alimentos' },
  ]
  const [tab, setTab] = useState<Tab>('buscar')
  const [query, setQuery] = useState('')
  const [lists, setLists] = useState<Partial<Record<Tab, FoodLite[]>>>({})
  const [recipes, setRecipes] = useState<RecipeSummary[] | null>(null)
  const [off, setOff] = useState<OffProduct[] | null>(null)
  const [offLoading, setOffLoading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Abas de lista: carregam ao abrir
  useEffect(() => {
    if (tab === 'buscar') return
    setLoading(true)
    setError(null)
    const req =
      tab === 'receitas'
        ? api<{ recipes: RecipeSummary[] }>('/recipes').then((r) => setRecipes(r.recipes))
        : api<{ foods: FoodLite[] }>({ recentes: '/foods/recent', favoritos: '/foods/favorites', meus: '/foods/mine' }[tab]).then((r) =>
            setLists((l) => ({ ...l, [tab]: r.foods })),
          )
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

      <div className="-mx-5 mb-4 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className="relative shrink-0 rounded-full px-4 py-2 text-sm font-medium">
            {tab === t.key && <motion.span layoutId="food-tab" className="absolute inset-0 rounded-full bg-primary" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
            <span className={`relative ${tab === t.key ? 'text-white' : 'text-muted'}`}>{t.label}</span>
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
              {foods && foods.length > 0 && <FoodList foods={foods} onPick={(f) => onPickFood({ id: f.id })} />}
              {foods && foods.length === 0 && <Empty tab={tab} query={query} />}
              {!foods && !loading && tab === 'buscar' && (
                <p className="py-8 text-center text-sm text-muted">Digite o nome do alimento ou toque no leitor para escanear o código de barras.</p>
              )}

              {tab === 'buscar' && query.trim().length >= 3 && (
                <div className="mt-5">
                  <p className="mb-2 px-1 text-xs font-semibold tracking-wide text-muted uppercase">Produtos de marca · Open Food Facts</p>
                  {offLoading && !off && <ListSkeleton rows={3} />}
                  {off && off.length === 0 && <p className="px-1 text-sm text-muted">Nenhum produto encontrado.</p>}
                  {off && off.length > 0 && (
                    <p className="mt-2 px-1 text-[11px] text-muted">
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

function FoodList({ foods, onPick }: { foods: FoodLite[]; onPick: (f: FoodLite) => void }) {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] bg-surface shadow-[0_2px_12px_-4px_rgba(31,23,36,0.08)]">
      {foods.map((f) => (
        <li key={f.id}>
          <button onClick={() => onPick(f)} className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors active:bg-soft">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{f.name}</p>
              <p className="truncate text-xs text-muted">
                {f.brand ? `${f.brand} · ` : ''}
                {baseLabel(f)} · {f.user_id ? 'meu' : f.source === 'taco' ? 'TACO' : 'Open Food Facts'}
              </p>
            </div>
            <span className="shrink-0 text-sm font-semibold text-primary">{fmt(f.kcal)} kcal</span>
          </button>
        </li>
      ))}
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
            <span className="shrink-0 text-sm font-semibold text-primary">{fmt(r.per_serving.kcal)} kcal</span>
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
    favoritos: 'Toque na ☆ de um alimento para favoritar.',
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
