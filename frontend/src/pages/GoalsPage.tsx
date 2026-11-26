import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { AboutYouForm } from '../components/AboutYouForm'
import { ObjectivePicker, SuggestGoalsSheet } from '../components/GoalSuggestion'
import { fmtKcal } from '../components/Ring'
import { Alert, BackButton, Button, Field, Logo } from '../components/ui'
import { api, ApiError } from '../lib/api'
import { useAuth } from '../lib/auth'
import type { Objective } from '../lib/goalSuggestion'
import type { Energy, Goal, User } from '../lib/types'

const fields: { key: keyof Goal; label: string; suffix: string; placeholder: string; decimal?: boolean }[] = [
  { key: 'kcal', label: 'Calorias', suffix: 'kcal', placeholder: 'ex.: 1800' },
  { key: 'carbs_g', label: 'Carboidratos', suffix: 'g', placeholder: 'ex.: 200', decimal: true },
  { key: 'protein_g', label: 'Proteínas', suffix: 'g', placeholder: 'ex.: 120', decimal: true },
  { key: 'fat_g', label: 'Gorduras', suffix: 'g', placeholder: 'ex.: 60', decimal: true },
  { key: 'sodium_mg', label: 'Sódio', suffix: 'mg', placeholder: 'ex.: 2000' },
  { key: 'fiber_g', label: 'Fibras', suffix: 'g', placeholder: 'ex.: 25' },
  { key: 'water_ml', label: 'Água', suffix: 'ml', placeholder: 'ex.: 2500' },
]

type FormState = Record<string, string>

const toForm = (g: Goal | null): FormState =>
  Object.fromEntries(fields.map((f) => [f.key, g ? String(g[f.key] ?? '') : f.key === 'fiber_g' ? '25' : '']))

const num = (s: string) => Number(s.replace(',', '.'))

/** Formulário de metas manuais. `onboarding` = primeiro acesso. */
export function GoalsPage({ onboarding = false }: { onboarding?: boolean }) {
  const { goal, user, setGoal } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState<FormState>(() => toForm(goal))
  const [error, setError] = useState<ApiError | null>(null)
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [suggestOpen, setSuggestOpen] = useState(false)
  // Primeiro acesso: passo "Sobre você" (opcional) antes das metas
  const [step, setStep] = useState<'about' | 'goals'>(onboarding && !(user?.sex && user?.birth_date && user?.height_cm) ? 'about' : 'goals')
  const [energy, setEnergy] = useState<Energy | null>(null)
  const [objective, setObjective] = useState<Objective | null>(null)
  const [suggested, setSuggested] = useState(false)

  useEffect(() => {
    if (onboarding && step === 'goals' && !energy) api<{ energy: Energy }>('/me/energy').then((r) => setEnergy(r.energy)).catch(() => {})
  }, [onboarding, step, energy])

  const applySuggestion = (g: Partial<Goal>) => {
    setForm((f) => ({ ...f, ...Object.fromEntries(Object.entries(g).map(([k, v]) => [k, String(v)])) }))
    setSuggested(true)
  }

  // Aviso de coerência: kcal dos macros vs. meta de kcal (> 10% de diferença)
  const macroKcal = num(form.carbs_g || '0') * 4 + num(form.protein_g || '0') * 4 + num(form.fat_g || '0') * 9
  const kcal = num(form.kcal || '0')
  const mismatch = kcal > 0 && macroKcal > 0 && Math.abs(macroKcal - kcal) / kcal > 0.1

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const body = Object.fromEntries(fields.map((f) => [f.key, num(form[f.key])]))
      const r = await api<{ goal: Goal }>('/goals', { method: 'POST', body })
      setGoal(r.goal)
      if (onboarding) navigate('/', { replace: true })
      else {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    } catch (err) {
      setError(err as ApiError)
    } finally {
      setLoading(false)
    }
  }

  if (step === 'about')
    return (
      <div className="safe-top px-5 pt-6 pb-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo size={56} />
          <h1 className="mt-4 text-2xl font-bold">Olá, {user?.name.split(' ')[0]}! 💜</h1>
          <p className="mt-1 text-muted">Conte um pouco sobre você para calcularmos quanto seu corpo gasta e sugerirmos suas metas.</p>
        </div>
        <AboutYouForm
          onDone={(e) => {
            setEnergy(e)
            setStep('goals')
          }}
        />
        <button type="button" onClick={() => setStep('goals')} className="mt-3 w-full py-2 text-sm font-semibold text-muted">
          Pular por enquanto
        </button>
      </div>
    )

  return (
    <div className="safe-top px-5 pt-6 pb-8">
      {onboarding ? (
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo size={56} />
          <h1 className="mt-4 text-2xl font-bold">Olá, {user?.name.split(' ')[0]}! 💜</h1>
          <p className="mt-1 text-muted">Defina suas metas diárias. Você pode mudar quando quiser.</p>
        </div>
      ) : null}
      {onboarding && energy?.available && (
        <div className="mb-5">
          <ObjectivePicker
            energy={energy}
            selected={objective}
            onApply={(g, o) => {
              applySuggestion(g)
              setObjective(o)
            }}
          />
        </div>
      )}
      {!onboarding && (
        <div className="mb-6">
          <div className="mb-3"><BackButton onClick={() => navigate(-1)} /></div>
          <h1 className="text-2xl font-bold">Metas diárias</h1>
          <p className="mt-1 text-sm text-muted">Alterações valem a partir de hoje. Dias anteriores mantêm a meta da época.</p>
          <button type="button" onClick={() => setSuggestOpen(true)} className="mt-4 flex w-full items-center gap-3 rounded-2xl bg-soft p-3 text-left active:scale-[0.99]">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-white">
              <Sparkles className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold text-primary">Sugerir minhas metas</span>
              <span className="block text-xs text-muted">Calculadas pelo seu corpo, treinos e objetivo</span>
            </span>
          </button>
          <SuggestGoalsSheet open={suggestOpen} onClose={() => setSuggestOpen(false)} onApply={applySuggestion} />
        </div>
      )}

      <form onSubmit={submit} className="space-y-4">
        {error && !fields.some((f) => error.field(f.key)) && <Alert>{error.message}</Alert>}
        {suggested && !onboarding && (
          <p className="rounded-2xl bg-fiber/10 px-4 py-3 text-sm text-ink">Sugestão aplicada. Confira os números e toque em <strong>Salvar metas</strong>.</p>
        )}
        <div className="grid grid-cols-2 gap-3">
          {fields.map((f) => (
            <Field
              key={f.key}
              className={f.key === 'kcal' ? 'col-span-2' : ''}
              label={f.label}
              name={f.key}
              suffix={f.suffix}
              placeholder={f.placeholder}
              inputMode={f.decimal ? 'decimal' : 'numeric'}
              required
              value={form[f.key]}
              onChange={(e) => setForm({ ...form, [f.key]: e.target.value.replace(/[^\d.,]/g, '') })}
              error={error?.field(f.key)}
            />
          ))}
        </div>

        <AnimatePresence>
          {mismatch && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="rounded-2xl bg-lavender/10 px-4 py-3 text-sm text-violet"
            >
              Seus macros somam <strong>{fmtKcal(macroKcal)} kcal</strong>, diferente da meta de {fmtKcal(kcal)} kcal. Tudo bem se for intencional.
            </motion.p>
          )}
        </AnimatePresence>

        {!onboarding && <BurnedToggle />}

        <Button type="submit" loading={loading}>
          {saved ? 'Metas salvas ✓' : onboarding ? 'Começar' : 'Salvar metas'}
        </Button>
      </form>
    </div>
  )
}

/** Preferência: somar as calorias gastas no treino à meta do dia. */
function BurnedToggle() {
  const { user, setUser } = useAuth()
  const [on, setOn] = useState(!!user?.add_burned_to_goal)
  const [saving, setSaving] = useState(false)

  const toggle = async () => {
    const next = !on
    setOn(next)
    setSaving(true)
    try {
      const r = await api<{ user: User }>('/me/preferences', { method: 'PUT', body: { add_burned_to_goal: next } })
      setUser(r.user)
    } catch {
      setOn(!next)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl bg-soft/70 p-4">
      <div>
        <p className="text-sm font-semibold">Somar calorias do treino à meta do dia</p>
        <p className="mt-0.5 text-xs text-muted">
          Desligado: o gasto aparece só como informação (na tela inicial). Ligado: a meta de calorias do dia aumenta com o gasto estimado do treino.
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Somar calorias do treino à meta do dia"
        onClick={toggle}
        disabled={saving}
        className={`relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors ${on ? 'bg-primary' : 'bg-line'}`}
      >
        <motion.span layout transition={{ type: 'spring', stiffness: 600, damping: 35 }} className={`absolute top-1 size-5 rounded-full bg-white shadow ${on ? 'right-1' : 'left-1'}`} />
      </button>
    </div>
  )
}
