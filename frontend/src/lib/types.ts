export interface User {
  id: number
  name: string
  email: string
  created_at: string
  add_burned_to_goal?: boolean
  weekly_workout_goal?: number
  sex?: 'f' | 'm' | null
  birth_date?: string | null
  height_cm?: number | null
  avatar_url?: string | null // foto de perfil (link temporário)
}

export interface Goal {
  id?: number
  valid_from?: string
  kcal: number
  carbs_g: number
  protein_g: number
  fat_g: number
  sodium_mg: number
  fiber_g: number
  water_ml: number
}

export interface Session {
  token: string
  user: User
  goal: Goal | null
}

export interface Nutrients {
  kcal: number
  carbs: number
  protein: number
  fat: number
  sodium: number
  fiber: number
}

export interface Portion {
  id: number
  label: string
  qty: number
}

export interface FoodLite extends Omit<Nutrients, 'fiber'> {
  fiber: number | null // nem todo alimento informa fibra
  id: number
  user_id: number | null
  source: 'taco' | 'off' | 'manual'
  name: string
  display_name?: string | null // nome amigável (TACO)
  brand: string | null
  base_qty: number
  base_unit: 'g' | 'ml'
  /** Última porção usada (aba Recentes) */
  last?: { quantity: number; portion_id: number | null; unit_label: string; kcal: number } | null
}

export interface FoodDetail extends FoodLite {
  ean: string | null
  category: string | null
  portions: Portion[]
  is_mine: boolean
  is_favorite: boolean
}

export interface OffProduct {
  code: string
  name: string
  brand: string | null
}

export interface RecipeSummary {
  id: number
  name: string
  servings: number
  items_count: number
  per_serving: Nutrients & { amount: number }
}

export interface RecipeItem {
  id?: number
  food_id: number
  portion_id: number | null
  quantity: number
  amount: number
  food: FoodLite & { portions: Portion[]; deleted?: boolean }
  nutrients: Nutrients
}

export interface RecipeDetail extends RecipeSummary {
  totals: Nutrients & { amount: number }
  items: RecipeItem[]
}

export interface Entry extends Nutrients {
  id: number
  date: string
  meal_id: number
  food_id: number | null
  recipe_id: number | null
  portion_id: number | null
  name: string
  brand: string | null
  quantity: number
  unit_label: string
  amount: number
  base_unit: 'g' | 'ml'
}

export interface Meal {
  id: number
  name: string
  position: number
  active: boolean
}

export interface DayMeal {
  id: number
  name: string
  kcal: number
  entries: Entry[]
  yesterday_count: number // itens nesta refeição ontem (botão "Repetir de ontem")
}

export interface WaterLog {
  id: number
  date: string
  ml: number
}

export interface DayData {
  date: string
  goal: Goal | null
  totals: Nutrients & { water: number }
  burned: number // kcal estimadas gastas nos treinos do dia
  energy: Energy
  add_burned_to_goal: boolean
  kcal_target: number | null // meta + treino (se a preferência estiver ligada)
  meals: DayMeal[]
  water: WaterLog[]
  trainings: DayTraining[] // treinos feitos no dia
}

export interface DayTraining {
  session_id: number | null // treino registrado (null = check-in antigo sem registro)
  checkin_id: number | null // foto/anotação ligada ao treino
  name: string
  kcal: number
  photo_url: string | null
}

export interface Exercise {
  id: number
  user_id: number | null
  name: string
  muscle_group: string
  image: string | null
  favorite?: boolean // marcado com estrela pela usuária
}

export interface WorkoutItem {
  id?: number
  exercise_id: number
  sets: number
  reps: string
  notes: string | null
  exercise: Exercise
}

export interface Workout {
  id: number
  name: string
  position: number
  items: WorkoutItem[]
  last_done_on?: string | null
}

export interface Checkin {
  id: number
  workout_id: number | null
  workout_name: string
  date: string
  note: string | null
  photo_url: string | null // check-in pode ser sem foto
  created_at: string
  session: WorkoutSessionData | null
}

export interface CheckinStats {
  streak: number
  month_count: number
  total_count: number
  today: boolean
  week_days: number // dias treinados nesta semana
  weekly_goal: number // meta de dias por semana
}

export interface SessionExercise {
  name: string
  muscle_group: string | null
  image: string | null
  sets: number
  reps: string
  sets_done: number
  done: boolean
  loads?: (number | null)[] // carga (kg) por série
  distance_km?: number | null // cardio: distância percorrida
}

export interface WorkoutSessionData {
  id: number
  workout_id: number | null
  workout_name: string
  date: string
  started_at: string
  finished_at: string
  duration_seconds: number
  kcal_burned: number | null
  weight_estimated?: boolean
  exercises: SessionExercise[]
  checkin?: { id: number; note: string | null; photo_url: string | null } | null // foto/anotação
}

export interface Weight {
  id: number
  date: string
  kg: number
}

export interface WeightSummary {
  current: number | null
  current_date: string | null
  start: number | null
  start_date: string | null
  change_total: number | null
  change_range: number | null
}

/** Gasto estimado do dia (TMB × fator de atividade) e déficit. Sem perfil completo: só `missing`. */
export type Energy =
  | { available: false; missing: ('sex' | 'birth_date' | 'height_cm' | 'weight')[] }
  | {
      available: true
      missing: []
      weight: number
      height_cm: number
      age: number
      sex: 'f' | 'm'
      tmb: number
      factor: number
      level: string
      checkins_per_week: number
      window_days: number
      get: number
      deficit?: number // GET − consumido (negativo = superávit)
    }
