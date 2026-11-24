export interface User {
  id: number
  name: string
  email: string
  created_at: string
}

export interface Goal {
  id?: number
  valid_from?: string
  kcal: number
  carbs_g: number
  protein_g: number
  fat_g: number
  sodium_mg: number
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
}

export interface Portion {
  id: number
  label: string
  qty: number
}

export interface FoodLite extends Nutrients {
  id: number
  user_id: number | null
  source: 'taco' | 'off' | 'manual'
  name: string
  brand: string | null
  base_qty: number
  base_unit: 'g' | 'ml'
}

export interface FoodDetail extends FoodLite {
  ean: string | null
  category: string | null
  fiber: number | null
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
  meals: DayMeal[]
  water: WaterLog[]
}

export interface Exercise {
  id: number
  user_id: number | null
  name: string
  muscle_group: string
  image: string | null
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
}

export interface Checkin {
  id: number
  workout_id: number | null
  workout_name: string
  date: string
  note: string | null
  photo_url: string
  created_at: string
}

export interface CheckinStats {
  streak: number
  month_days: number
  total_days: number
  today: boolean
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
