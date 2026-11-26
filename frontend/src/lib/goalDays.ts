import type { Goal } from './types'

/**
 * Como um dia conta na meta de calorias, conforme o objetivo:
 * - max (emagrecer): até a meta; avisa se ficou muito abaixo (menos de 75% da meta);
 * - range (manter): perto da meta, até 10% a mais ou a menos;
 * - min (ganhar massa): pelo menos a meta; avisa se passou muito (mais de 15% acima).
 */
export type KcalMode = 'max' | 'range' | 'min'

export const KCAL_MODES: { key: KcalMode; label: string; hint: string }[] = [
  { key: 'max', label: 'Até a meta', hint: 'para emagrecer' },
  { key: 'range', label: 'Perto da meta', hint: 'para manter' },
  { key: 'min', label: 'Pelo menos a meta', hint: 'para ganhar massa' },
]

export const LOW_LIMIT = 0.75
export const HIGH_LIMIT = 1.15
export const RANGE = 0.1

export const modeOf = (g: Pick<Goal, 'kcal_mode'> | null | undefined): KcalMode => g?.kcal_mode ?? 'range'

/** O dia conta como "na meta"? */
export function inGoal(kcal: number, g: Pick<Goal, 'kcal' | 'kcal_mode'>) {
  const mode = modeOf(g)
  if (mode === 'max') return kcal <= g.kcal
  if (mode === 'min') return kcal >= g.kcal
  return Math.abs(kcal - g.kcal) <= g.kcal * RANGE
}

/** Dia que merece atenção: muito abaixo (emagrecer) ou muito acima (ganhar massa). */
export function outlier(kcal: number, g: Pick<Goal, 'kcal' | 'kcal_mode'>): 'low' | 'high' | null {
  const mode = modeOf(g)
  if (mode === 'max' && kcal < g.kcal * LOW_LIMIT) return 'low'
  if (mode === 'min' && kcal > g.kcal * HIGH_LIMIT) return 'high'
  return null
}
