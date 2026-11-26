import type { Energy, Goal } from './types'

export type Objective = 'lose' | 'keep' | 'gain'

export const OBJECTIVES: { key: Objective; label: string; hint: string }[] = [
  { key: 'lose', label: 'Emagrecer', hint: 'cerca de 400 kcal abaixo do que você gasta' },
  { key: 'keep', label: 'Manter o peso', hint: 'igual ao que você gasta' },
  { key: 'gain', label: 'Ganhar massa', hint: 'cerca de 300 kcal acima do que você gasta' },
]

const KCAL_DELTA: Record<Objective, number> = { lose: -400, keep: 0, gain: 300 }
const PROTEIN_PER_KG: Record<Objective, number> = { lose: 2.0, keep: 1.6, gain: 1.8 }

const round = (n: number, step: number) => Math.round(n / step) * step

type SuggestedGoal = Pick<Goal, 'kcal' | 'carbs_g' | 'protein_g' | 'fat_g' | 'sodium_mg' | 'fiber_g' | 'water_ml'> & { kcal_mode: NonNullable<Goal['kcal_mode']> }

/** Emagrecer conta "até a meta"; ganhar, "pelo menos a meta"; manter, "perto da meta" */
const KCAL_MODE: Record<Objective, SuggestedGoal['kcal_mode']> = { lose: 'max', keep: 'range', gain: 'min' }

/**
 * Metas sugeridas a partir do gasto estimado:
 * calorias = gasto ± objetivo (nunca abaixo do gasto em repouso nem de 1.200/1.500 kcal),
 * proteína por kg de peso, gordura 25% das calorias e o resto em carboidrato.
 */
export function suggestGoals(energy: Extract<Energy, { available: true }>, objective: Objective): SuggestedGoal {
  const floor = Math.max(energy.tmb, energy.sex === 'f' ? 1200 : 1500)
  // O piso arredonda para cima, para nunca sugerir menos do que o gasto em repouso
  const kcal = Math.max(round(energy.get + KCAL_DELTA[objective], 50), Math.ceil(floor / 50) * 50)
  const protein = Math.round(energy.weight * PROTEIN_PER_KG[objective])
  const fat = Math.round((kcal * 0.25) / 9)
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4))

  return {
    kcal,
    kcal_mode: KCAL_MODE[objective],
    carbs_g: carbs,
    protein_g: protein,
    fat_g: fat,
    sodium_mg: 2000,
    fiber_g: energy.sex === 'f' ? 25 : 30,
    water_ml: round(energy.weight * 35, 100),
  }
}
