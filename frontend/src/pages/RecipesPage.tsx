import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { fmt } from '../components/Ring'
import { Card } from '../components/ui'
import { api } from '../lib/api'
import type { RecipeSummary } from '../lib/types'

/** Lista de receitas da usuária. */
export function RecipesPage() {
  const navigate = useNavigate()
  const [recipes, setRecipes] = useState<RecipeSummary[] | null>(null)

  useEffect(() => {
    api<{ recipes: RecipeSummary[] }>('/recipes').then((r) => setRecipes(r.recipes))
  }, [])

  return (
    <div className="safe-top mx-auto max-w-lg px-5 pt-4 pb-10">
      <header className="mb-5 flex items-center gap-3">
        <button onClick={() => navigate(-1)} aria-label="Voltar" className="flex size-10 items-center justify-center rounded-full bg-surface text-2xl text-primary shadow-sm">
          ‹
        </button>
        <h1 className="text-xl font-bold">Receitas</h1>
      </header>

      {!recipes && <div className="h-40 animate-pulse rounded-2xl bg-soft" />}
      {recipes?.length === 0 && (
        <Card className="py-10 text-center">
          <p className="text-4xl">🥣</p>
          <p className="mt-3 font-medium">Monte suas combinações do dia a dia</p>
          <p className="mt-1 text-sm text-muted">Ex.: “Café padrão” com pão, ovos e leite. Depois é só adicionar com um toque.</p>
        </Card>
      )}

      <div className="space-y-2">
        {recipes?.map((r, i) => (
          <motion.div key={r.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
            <Link to={`/receitas/${r.id}`}>
              <Card className="flex items-center justify-between !py-4 transition-transform active:scale-[0.98]">
                <div className="min-w-0">
                  <p className="truncate font-medium">{r.name}</p>
                  <p className="text-sm text-muted">
                    {r.items_count} {r.items_count === 1 ? 'ingrediente' : 'ingredientes'} · {fmt(r.servings)} {r.servings === 1 ? 'porção' : 'porções'}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-semibold text-primary">{fmt(r.per_serving.kcal)} kcal</p>
                  <p className="text-xs text-muted">por porção</p>
                </div>
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>

      <Link to="/receitas/nova" className="mt-6 block rounded-2xl bg-primary py-4 text-center font-semibold text-white shadow-[0_6px_20px_-8px_rgba(155,63,168,0.7)] active:scale-[0.98]">
        + Nova receita
      </Link>
    </div>
  )
}
