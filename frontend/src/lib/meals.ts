const minutes = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

/**
 * Refeição do momento (entre as ativas):
 * pelo horário de cada refeição, a mais próxima de agora (ex.: 11h10 → Almoço das 12h);
 * refeições sem horário seguem a ordem do dia.
 */
export function mealForNow<T extends { id: number; active?: boolean; time?: string | null }>(meals: T[], now = new Date()): T | undefined {
  const active = meals.filter((m) => m.active !== false)
  const timed = active.filter((m) => m.time)
  if (timed.length) {
    const t = now.getHours() * 60 + now.getMinutes()
    // Distância "no relógio" (23h30 fica perto de 00h10)
    const dist = (m: T) => {
      const d = Math.abs(minutes(m.time!) - t)
      return Math.min(d, 1440 - d)
    }
    return timed.reduce((best, m) => (dist(m) < dist(best) ? m : best))
  }
  const h = now.getHours()
  const order = h < 10 ? 0 : h < 12 ? 1 : h < 15 ? 2 : h < 18 ? 3 : h < 21 ? 4 : 5
  return active[Math.min(order, active.length - 1)]
}
