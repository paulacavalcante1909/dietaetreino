import { fmt, fmtKcal } from './Ring'

export type NutrientKey = 'kcal' | 'carbs' | 'protein' | 'fat' | 'sodium' | 'fiber'

/** Cada nutriente usa a mesma cor das barras de macros do app */
export const NUTRIENTS: { key: NutrientKey; label: string; short: string; unit: string; color: string }[] = [
  { key: 'kcal', label: 'Calorias', short: 'Calorias', unit: 'kcal', color: 'var(--color-orchid)' },
  { key: 'carbs', label: 'Carboidratos', short: 'Carbo', unit: 'g', color: 'var(--color-lavender)' },
  { key: 'protein', label: 'Proteínas', short: 'Proteínas', unit: 'g', color: 'var(--color-pink)' },
  { key: 'fat', label: 'Gorduras', short: 'Gorduras', unit: 'g', color: 'var(--color-violet)' },
  { key: 'sodium', label: 'Sódio', short: 'Sódio', unit: 'mg', color: 'var(--color-coral)' },
  { key: 'fiber', label: 'Fibras', short: 'Fibras', unit: 'g', color: 'var(--color-fiber)' },
]

export type FoodNutrients = { name: string } & Record<NutrientKey, number>

export const fmtAmount = (v: number, unit: string) => (unit === 'g' ? `${fmt(v)} g` : `${fmtKcal(v)} ${unit}`)

/**
 * Ranking simples: quem mais contribuiu para um nutriente.
 * Uma linha por alimento (nome, % do total e quantidade) com a barra proporcional embaixo;
 * o resto vira "Outros".
 */
export function RankBars({ rows, nutrient, limit = 3 }: { rows: FoodNutrients[]; nutrient: NutrientKey; limit?: number }) {
  const n = NUTRIENTS.find((x) => x.key === nutrient)!
  const total = rows.reduce((a, r) => a + (r[nutrient] || 0), 0)
  if (total <= 0) return <p className="text-sm text-muted">Nada de {n.label.toLowerCase()} registrado.</p>

  const sorted = rows.filter((r) => r[nutrient] > 0).sort((a, b) => b[nutrient] - a[nutrient])
  const top = sorted.slice(0, limit)
  const others = sorted.slice(limit).reduce((a, r) => a + r[nutrient], 0)
  const items = [...top.map((r) => ({ name: r.name, value: r[nutrient] })), ...(others > 0 ? [{ name: 'Outros', value: others }] : [])]

  return (
    <ul className="space-y-2.5">
      {items.map((it) => {
        const pct = Math.round((it.value / total) * 100)
        return (
          <li key={it.name}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className={`min-w-0 truncate ${it.name === 'Outros' ? 'text-muted' : 'font-semibold'}`}>{it.name}</span>
              <span className="shrink-0 text-muted">
                <span className="font-bold text-ink">{pct}%</span> · {fmtAmount(it.value, n.unit)}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-soft" role="img" aria-label={`${it.name}: ${pct}% de ${n.label.toLowerCase()}`}>
              <div className="h-full rounded-full" style={{ width: `${Math.max(pct, 2)}%`, background: it.name === 'Outros' ? 'var(--color-muted)' : n.color, opacity: it.name === 'Outros' ? 0.45 : 1 }} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/** Junta itens com o mesmo nome (ex.: o mesmo alimento em duas refeições) */
export function groupByName(entries: FoodNutrients[]): FoodNutrients[] {
  const map = new Map<string, FoodNutrients>()
  for (const e of entries) {
    const name = e.name.split(',')[0]
    const cur = map.get(name) ?? { name, kcal: 0, carbs: 0, protein: 0, fat: 0, sodium: 0, fiber: 0 }
    for (const n of NUTRIENTS) cur[n.key] += e[n.key] || 0
    map.set(name, cur)
  }
  return [...map.values()]
}
