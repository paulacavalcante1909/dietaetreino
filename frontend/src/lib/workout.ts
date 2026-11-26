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

/** Séries por tempo (isometria): reps = "60 s" */
export const SECONDS_RE = /^(\d{1,3})\s*s$/i

export function secondsOf(reps: string): number {
  const m = reps.trim().match(SECONDS_RE)
  return m ? Number(m[1]) : 0
}

/** Isometria e exercícios parados: vêm configurados em segundos */
const ISOMETRIC_RE = /prancha|plank|isometr|wall ?sit|cadeira na parede|hollow|ponte est[aá]tica|superman|segurar|hold/i
/** Atividades de distância (corrida, caminhada, bike…): mostram o campo de km */
const DISTANCE_RE = /corrida|correr|caminhada|caminhar|trote|esteira|trilha|bicicleta|bike|ciclismo|pedal|spinning|remo|nata[cç][aã]o|el[ií]ptico/i

export const isIsometric = (e: { name: string }) => ISOMETRIC_RE.test(e.name)
export const hasDistance = (e: { name: string; muscle_group?: string | null }) => DISTANCE_RE.test(e.name) && (!e.muscle_group || e.muscle_group === 'cardio')

/** Prescrição padrão ao escolher um exercício: cardio por tempo, isometria em segundos, o resto 3 × 12. */
export function defaultPrescription(e: { name: string; muscle_group?: string | null }): { sets: number; reps: string } {
  if (e.muscle_group === 'cardio') return { sets: 1, reps: '30 min' }
  if (isIsometric(e)) return { sets: 3, reps: '30 s' }
  return { sets: 3, reps: '12' }
}

/** "4 × 10" ou "40 min" */
export function prescription(i: { sets: number; reps: string; distance_km?: number | null; distanceKm?: number | null }) {
  const km = i.distance_km ?? i.distanceKm
  return isTimed(i) ? `${minutesOf(i.reps)} min${km ? ` · ${fmtKm(km)} km` : ''}` : `${i.sets} × ${i.reps}`
}

export const fmtKm = (km: number) => km.toLocaleString('pt-BR', { maximumFractionDigits: 2 })

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
