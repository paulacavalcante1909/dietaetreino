/** Refeição sugerida pelo horário (entre as ativas, na ordem do dia). */
export function mealForNow<T extends { id: number; active?: boolean }>(meals: T[]): T | undefined {
  const h = new Date().getHours()
  const order = h < 10 ? 0 : h < 12 ? 1 : h < 15 ? 2 : h < 18 ? 3 : h < 21 ? 4 : 5
  const active = meals.filter((m) => m.active !== false)
  return active[Math.min(order, active.length - 1)]
}
