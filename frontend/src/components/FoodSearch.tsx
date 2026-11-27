import { ChevronRight, Plus, Star } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useToast } from './Toast'
import { fmtKcal } from './Ring'
import { Alert } from './ui'
import { api, ApiError } from '../lib/api'
import { baseLabel } from '../lib/nutrition'
import type { FoodLite, OffProduct, RecipeSummary } from '../lib/types'
import type { FoodTarget } from './FoodSheet'

type Tab = 'alimentos' | 'refeicoes'

interface Props {
  /** Mostra a aba "Refeições completas" */
  withRecipes?: boolean
  onPickFood: (t: FoodTarget) => void
  onPickRecipe?: (r: RecipeSummary) => void
  onScan: () => void
  onQueryChange?: (q: string) => void
  /** Nada encontrado na busca: cadastrar o alimento (recebe o que foi digitado). */
  onCreateFood?: (query: string) => void
  /** Incrementar para recarregar as listas (ex.: após registrar). */
  refreshKey?: number
  /** Recentes só desta refeição (café da manhã não mostra o jantar) */
  mealId?: number
  mealName?: string
}

/** Sem acento e minúsculo, para filtrar listas */
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const matches = (q: string) => {
  const words = norm(q).split(/\s+/).filter(Boolean)
  return (name: string) => words.every((w) => norm(name).includes(w))
}

interface Sections {
  recent: FoodLite[]
  favorites: FoodLite[]
  mine: FoodLite[]
  common: FoodLite[] | null // só para quem ainda não tem nada
}

/**
 * Escolher o que comer, em duas abas:
 * - Alimentos: sem busca, Recentes (desta refeição) → Favoritos → Criados por você
 *   (primeiros usos: alimentos comuns); com busca, a base toda + produtos de marca, e cadastrar se não achar.
 * - Refeições completas: as usadas mais recentemente primeiro, com busca e o botão de criar.
 * Tocar num item abre a ficha (quantidade e medida).
 */
export function FoodSearch({ withRecipes, onPickFood, onPickRecipe, onScan, onQueryChange, onCreateFood, refreshKey = 0, mealId, mealName }: Props) {
  const [tab, setTab] = useState<Tab>('alimentos')
  const [query, setQuery] = useState('')
  const [sections, setSections] = useState<Sections | null>(null)
  const [results, setResults] = useState<FoodLite[] | null>(null)
  const [recipes, setRecipes] = useState<RecipeSummary[] | null>(null)
  const [off, setOff] = useState<OffProduct[] | null>(null)
  const [offLoading, setOffLoading] = useState(false)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const toast = useToast()
  const input = useRef<HTMLInputElement>(null)
  const q = query.trim()

  // Alimentos sem busca: recentes desta refeição, favoritos e os criados pela usuária
  useEffect(() => {
    if (tab !== 'alimentos') return
    setError(null)
    Promise.all([
      api<{ foods: FoodLite[] }>(`/foods/recent${mealId ? `?meal_id=${mealId}` : ''}`),
      api<{ foods: FoodLite[] }>('/foods/favorites'),
      api<{ foods: FoodLite[] }>('/foods/mine'),
    ])
      .then(async ([r, f, m]) => {
        const empty = !r.foods.length && !f.foods.length && !m.foods.length
        // Primeiros usos (nada registrado nem favoritado): alimentos comuns
        const common = empty ? (await api<{ foods: FoodLite[] }>('/foods/common').catch(() => ({ foods: [] as FoodLite[] }))).foods : null
        setSections({ recent: r.foods.slice(0, 10), favorites: f.foods, mine: m.foods, common })
      })
      .catch((e: ApiError) => setError(e.message))
  }, [tab, refreshKey, mealId])

  // Refeições completas: mais recentes primeiro (ordem do servidor)
  useEffect(() => {
    if (tab !== 'refeicoes') return
    api<{ recipes: RecipeSummary[] }>('/recipes').then((r) => setRecipes(r.recipes)).catch((e: ApiError) => setError(e.message))
  }, [tab, refreshKey])

  // Alimentos com busca: base toda (inclui os criados por ela) + produtos de marca
  useEffect(() => {
    onQueryChange?.(q)
    if (tab !== 'alimentos' || q.length < 2) {
      setResults(null)
      setOff(null)
      return
    }
    setSearching(true)
    const local = setTimeout(() => {
      api<{ foods: FoodLite[] }>(`/foods/search?q=${encodeURIComponent(q)}`)
        .then((r) => setResults(r.foods))
        .catch((e: ApiError) => setError(e.message))
        .finally(() => setSearching(false))
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
  }, [q, tab, onQueryChange])

  // Favoritar direto na lista (otimista); desfazer pelo aviso
  const toggleFavorite = async (f: FoodLite) => {
    const on = !f.favorite
    const set = (v: boolean) => {
      const mark = (list: FoodLite[]) => list.map((x) => (x.id === f.id ? { ...x, favorite: v } : x))
      setSections((s) => s && { ...s, recent: mark(s.recent), favorites: mark(s.favorites), mine: mark(s.mine), common: s.common && mark(s.common) })
      setResults((r) => r && mark(r))
    }
    set(on)
    try {
      await api(`/foods/${f.id}/favorite`, { method: on ? 'POST' : 'DELETE' })
      toast({ text: on ? '★ Adicionado aos favoritos' : 'Tirado dos favoritos', action: { label: 'Desfazer', run: () => toggleFavorite({ ...f, favorite: on }) } })
    } catch {
      set(!on)
    }
  }

  const switchTab = (t: Tab) => {
    setTab(t)
    setQuery('')
  }

  // Sem repetir: quem já está em Recentes não aparece de novo em Favoritos/Criados
  const seen = new Set(sections?.recent.map((f) => f.id))
  const favorites = sections?.favorites.filter((f) => !seen.has(f.id)) ?? []
  favorites.forEach((f) => seen.add(f.id))
  const mine = sections?.mine.filter((f) => !seen.has(f.id)) ?? []
  const shownRecipes = q && recipes ? recipes.filter((r) => matches(q)(r.name)) : recipes
  const notFound = tab === 'alimentos' && q.length >= 2 && !searching && results?.length === 0
  const nothing = sections && !sections.recent.length && !favorites.length && !mine.length && !sections.common?.length

  return (
    <div>
      {withRecipes && (
        <div className="mb-3 flex justify-center gap-8 border-b border-line px-1" role="tablist" aria-label="O que registrar">
          {/* Abas em texto com sublinhado: mais leves que pílulas (a busca é o destaque) */}
          {([['alimentos', 'Alimentos'], ['refeicoes', 'Refeições completas']] as const).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => switchTab(k)} className={`relative pt-1 pb-2.5 text-sm font-bold transition-colors ${tab === k ? 'text-ink' : 'text-muted'}`}>
              {l}
              {tab === k && <motion.span layoutId="food-tab" className="absolute inset-x-0 -bottom-px h-[3px] rounded-full bg-primary" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
            </button>
          ))}
        </div>
      )}

      <div className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <input
            ref={input}
            type="search"
            placeholder={tab === 'alimentos' ? 'Buscar alimento ou produto' : 'Buscar refeição completa'}
            aria-label={tab === 'alimentos' ? 'Buscar alimento ou produto' : 'Buscar refeição completa'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-12 w-full rounded-2xl border border-line bg-surface pr-4 pl-11 outline-none focus:border-orchid focus:ring-4 focus:ring-orchid/15"
          />
          <svg className="absolute top-3.5 left-4 size-5 text-muted" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" strokeLinecap="round" />
          </svg>
        </div>
        {tab === 'alimentos' && (
          <button onClick={onScan} aria-label="Ler código de barras" className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-white shadow-md transition-transform active:scale-90">
            <svg className="size-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" viewBox="0 0 24 24">
              <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 8v8M10 8v8M13 8v8M17 8v8" />
            </svg>
          </button>
        )}
      </div>

      {error && <Alert>{error}</Alert>}

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
          {tab === 'refeicoes' ? (
            <>
              <RecipeList recipes={shownRecipes} filtered={!!q} onPick={onPickRecipe} />
              <Link to="/receitas/nova" className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line text-sm font-bold text-link active:bg-soft">
                <Plus className="size-4" /> Criar refeição completa
              </Link>
            </>
          ) : q.length >= 2 ? (
            /* Com busca */
            <>
              {searching && !results && <ListSkeleton />}
              {results && results.length > 0 && <FoodList foods={results} onPick={(f) => onPickFood({ id: f.id })} onToggleFavorite={toggleFavorite} />}
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
              {q.length >= 3 && (
                <Section title="Produtos de marca · Open Food Facts">
                  {offLoading && !off && <ListSkeleton rows={3} />}
                  {off && off.length === 0 && <p className="px-1 text-sm text-muted">Nenhum produto encontrado.</p>}
                  {off && off.length > 0 && (
                    <>
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
                      <p className="mt-2 px-1 text-xs text-muted">
                        Dados da{' '}
                        <a href="https://world.openfoodfacts.org" target="_blank" rel="noopener noreferrer" className="underline">
                          Open Food Facts
                        </a>{' '}
                        (ODbL). Confira o rótulo.
                      </p>
                    </>
                  )}
                </Section>
              )}
            </>
          ) : !sections ? (
            <ListSkeleton />
          ) : (
            /* Sem busca: recentes desta refeição → favoritos → criados por você (ou comuns, nos primeiros usos) */
            <div>
              {sections.recent.length > 0 && (
                <Section title={mealName ? `Recentes no ${mealName.toLowerCase()}` : 'Recentes'}>
                  <FoodList foods={sections.recent} onPick={(f) => onPickFood({ id: f.id })} onToggleFavorite={toggleFavorite} showLast />
                </Section>
              )}
              {favorites.length > 0 && (
                <Section title="Favoritos">
                  <FoodList foods={favorites} onPick={(f) => onPickFood({ id: f.id })} onToggleFavorite={toggleFavorite} />
                </Section>
              )}
              {mine.length > 0 && (
                <Section title="Criados por você">
                  <FoodList foods={mine} onPick={(f) => onPickFood({ id: f.id })} onToggleFavorite={toggleFavorite} />
                </Section>
              )}
              {sections.common && sections.common.length > 0 && (
                <Section title="Alimentos comuns">
                  <FoodList foods={sections.common} onPick={(f) => onPickFood({ id: f.id })} onToggleFavorite={toggleFavorite} />
                </Section>
              )}
              {nothing && <p className="py-6 text-center text-sm text-muted">Busque um alimento acima ou leia o código de barras.</p>}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-5 first:mt-0">
      <h3 className="mb-2 px-1 text-xs font-bold tracking-wider text-muted uppercase">{title}</h3>
      {children}
    </section>
  )
}

/** Lista de alimentos (só alimentos). Tocar abre a ficha. */
function FoodList({ foods, onPick, onToggleFavorite, showLast = false }: {
  foods: FoodLite[]
  onPick: (f: FoodLite) => void
  onToggleFavorite: (f: FoodLite) => void
  showLast?: boolean
}) {
  // Fecha o teclado ao escolher (a ficha e a barra do rodapé ficam visíveis)
  const blur = () => (document.activeElement as HTMLElement | null)?.blur()

  return (
    <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] bg-surface shadow-[0_2px_12px_-4px_rgba(31,23,36,0.08)]">
      {foods.map((f) => {
        const last = showLast && f.last
        const name = f.display_name || f.name
        return (
          <li key={f.id} className="flex items-center">
            <button onClick={() => (blur(), onPick(f))} className="flex min-w-0 flex-1 items-center gap-3 py-3.5 pr-2 pl-4 text-left transition-colors active:bg-soft">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{name}</p>
                <p className="truncate text-xs text-muted">
                  {last
                    ? `${f.last!.unit_label.includes('(') ? `${f.last!.quantity} × ${f.last!.unit_label.replace(/^1\s+/, '')}` : `${f.last!.quantity} ${f.last!.unit_label}`} da última vez`
                    : `${f.brand ? `${f.brand} · ` : ''}${baseLabel(f)} · ${f.user_id ? 'meu' : f.source === 'taco' ? 'TACO' : 'Open Food Facts'}`}
                </p>
              </div>
              <span className="shrink-0 text-sm font-semibold text-ink">{fmtKcal(last ? f.last!.kcal : f.kcal)} kcal</span>
            </button>
            <button
              onClick={() => onToggleFavorite(f)}
              aria-label={f.favorite ? `Tirar ${name} dos favoritos` : `Favoritar ${name}`}
              aria-pressed={!!f.favorite}
              className="mr-1 flex size-10 shrink-0 items-center justify-center rounded-full active:scale-90"
            >
              <Star className={`size-4 ${f.favorite ? 'fill-amber-400 text-amber-400' : 'text-muted/40'}`} />
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function RecipeList({ recipes, filtered, onPick }: { recipes: RecipeSummary[] | null; filtered: boolean; onPick?: (r: RecipeSummary) => void }) {
  if (!recipes) return <ListSkeleton />
  if (!recipes.length)
    return (
      <p className="py-6 text-center text-sm text-muted">
        {filtered ? 'Nenhuma refeição completa com esse nome.' : 'Salve combinações que você repete (ex.: “Café padrão”) e registre com um toque.'}
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
            <span className="shrink-0 text-sm font-semibold text-ink">{fmtKcal(r.per_serving.kcal)} kcal</span>
          </button>
        </li>
      ))}
    </ul>
  )
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
