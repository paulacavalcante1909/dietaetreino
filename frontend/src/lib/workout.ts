/**
 * Exercícios por tempo (cardio): guardados como sets=1 e reps="40 min".
 * Assim a API e o histórico continuam iguais; só a exibição/execução muda.
 */
export const TIMED_RE = /^(\d{1,3})\s*min$/i

export function isTimed(i: { sets: number; reps: string }) {
  return i.sets === 1 && TIMED_RE.test(i.reps.trim())
}

export function minutesOf(reps: string): number {
  const m = reps.trim().match(TIMED_RE)
  return m ? Number(m[1]) : 0
}

/** "4 × 10" ou "40 min" */
export function prescription(i: { sets: number; reps: string }) {
  return isTimed(i) ? `${minutesOf(i.reps)} min` : `${i.sets} × ${i.reps}`
}

/** "Treino A – Peito" → "A" */
export function letter(name: string) {
  const m = name.match(/treino\s+([a-z0-9])/i)
  return (m ? m[1] : name[0] ?? '?').toUpperCase()
}

/** Duração sugerida para um treino já feito: cardio pelo tempo + ~2 min por série (mínimo 20 min). */
export function suggestedMinutes(items: { sets: number; reps: string }[]) {
  const timed = items.filter(isTimed).reduce((a, i) => a + minutesOf(i.reps), 0)
  const sets = items.filter((i) => !isTimed(i)).reduce((a, i) => a + i.sets, 0)
  return Math.max(20, Math.min(240, timed + sets * 2))
}
