import { useState, type FormEvent } from 'react'
import { api, ApiError } from '../lib/api'
import { useAuth } from '../lib/auth'
import { num } from '../lib/nutrition'
import type { Energy, User } from '../lib/types'
import { Alert, Button, Field } from './ui'

/**
 * Dados do corpo (sexo, nascimento, altura e peso de hoje) para estimar o gasto calórico.
 * Usado no primeiro acesso e ao sugerir metas.
 */
export function AboutYouForm({ onDone, submitLabel = 'Continuar', askWeight = true }: { onDone: (energy: Energy) => void; submitLabel?: string; askWeight?: boolean }) {
  const { user, setUser } = useAuth()
  const [form, setForm] = useState({
    sex: user?.sex ?? '',
    birth_date: user?.birth_date ?? '',
    height_cm: user?.height_cm ? String(user.height_cm) : '',
    weight_kg: '',
  })
  const [error, setError] = useState<ApiError | null>(null)
  const [saving, setSaving] = useState(false)
  const complete = form.sex && form.birth_date && form.height_cm && (!askWeight || form.weight_kg)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const r = await api<{ user: User; energy: Energy }>('/me/body', {
        method: 'PUT',
        body: {
          sex: form.sex || null,
          birth_date: form.birth_date || null,
          height_cm: form.height_cm ? Number(form.height_cm) : null,
          ...(form.weight_kg ? { weight_kg: num(form.weight_kg) } : {}),
        },
      })
      setUser(r.user)
      onDone(r.energy)
    } catch (err) {
      setError(err as ApiError)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && !['sex', 'birth_date', 'height_cm', 'weight_kg'].some((f) => error.field(f)) && <Alert>{error.message}</Alert>}
      <div>
        <p className="mb-1.5 text-sm font-medium">Sexo (usado na fórmula)</p>
        <div className="flex gap-2" role="radiogroup" aria-label="Sexo">
          {([['f', 'Feminino'], ['m', 'Masculino']] as const).map(([k, l]) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={form.sex === k}
              onClick={() => setForm({ ...form, sex: k })}
              className={`h-12 flex-1 rounded-2xl font-semibold transition ${form.sex === k ? 'bg-primary text-white' : 'bg-surface text-ink shadow-sm'}`}
            >
              {l}
            </button>
          ))}
        </div>
        {error?.field('sex') && <p className="mt-1 text-xs text-danger">{error.field('sex')}</p>}
      </div>
      <Field label="Data de nascimento" name="birth_date" type="date" max={new Date().toISOString().slice(0, 10)} value={form.birth_date} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} error={error?.field('birth_date')} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Altura" name="height_cm" suffix="cm" inputMode="numeric" placeholder="ex.: 165" value={form.height_cm} onChange={(e) => setForm({ ...form, height_cm: e.target.value.replace(/\D/g, '').slice(0, 3) })} error={error?.field('height_cm')} />
        {askWeight && (
          <Field label="Peso hoje" name="weight_kg" suffix="kg" inputMode="decimal" placeholder="ex.: 65" value={form.weight_kg} onChange={(e) => setForm({ ...form, weight_kg: e.target.value.replace(/[^\d.,]/g, '') })} error={error?.field('weight_kg')} />
        )}
      </div>
      <Button type="submit" loading={saving} disabled={!complete}>
        {submitLabel}
      </Button>
    </form>
  )
}
