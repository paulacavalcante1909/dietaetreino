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
