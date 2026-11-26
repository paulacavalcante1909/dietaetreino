import { ask } from '../components/Dialog'
import { Reorder } from 'framer-motion'
import { HoldToDragItem } from '../components/HoldToDrag'
import { Eye, EyeOff, GripVertical, Trash2 } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../components/Toast'
import { BackButton, Button, Card, Field } from '../components/ui'
import { api, ApiError } from '../lib/api'
import type { Meal } from '../lib/types'

/** Renomear, reordenar (arrastar), ocultar e criar refeições. */
export function MealsPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [meals, setMeals] = useState<Meal[]>([])
  const [newName, setNewName] = useState('')
  const [newTime, setNewTime] = useState('')
  const [error, setError] = useState<ApiError | null>(null)

  useEffect(() => {
    api<{ meals: Meal[] }>('/meals').then((r) => setMeals(r.meals))
  }, [])

  const saveOrder = () => api('/meals/order', { method: 'PUT', body: { ids: meals.map((m) => m.id) } }).catch(() => {})

  const patch = async (m: Meal, data: Partial<Meal>) => {
    setMeals((list) => list.map((x) => (x.id === m.id ? { ...x, ...data } : x)))
    await api(`/meals/${m.id}`, { method: 'PUT', body: data }).catch(() => {})
  }

  const remove = async (m: Meal) => {
    if (!(await ask({ title: `Excluir “${m.name}”?`, text: 'Se ela tiver alimentos registrados, será só ocultada.', confirmLabel: 'Excluir refeição', danger: true }))) return
    const r = await api<{ hidden?: boolean }>(`/meals/${m.id}`, { method: 'DELETE' })
    if (r.hidden) {
      setMeals((list) => list.map((x) => (x.id === m.id ? { ...x, active: false } : x)))
      toast({ text: 'Essa refeição tem registros, então foi ocultada.' })
    } else setMeals((list) => list.filter((x) => x.id !== m.id))
  }

  const add = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      const r = await api<{ meal: Meal }>('/meals', { method: 'POST', body: { name: newName.trim(), time: newTime || null } })
      setMeals((list) => [...list, r.meal])
      setNewName('')
      setNewTime('')
    } catch (err) {
      setError(err as ApiError)
    }
  }

  return (
    <div className="safe-top mx-auto max-w-lg px-5 pt-4 pb-10">
      <header className="mb-2 flex items-center gap-3">
        <BackButton onClick={() => navigate(-1)} />
        <h1 className="text-xl font-bold">Refeições do dia</h1>
      </header>
      <p className="mb-4 text-sm text-muted">
        O horário decide qual refeição já vem escolhida ao registrar. Toque no nome para renomear; segure e arraste para reordenar. Ocultar tira a refeição da tela inicial sem apagar nada.
      </p>

      <Reorder.Group axis="y" values={meals} onReorder={setMeals} className="space-y-2">
        {meals.map((m) => (
          <HoldToDragItem key={m.id} value={m} onDragEnd={saveOrder}>
            <Card className={`flex items-center gap-3 !py-3 ${m.active ? '' : 'opacity-50'}`}>
              <GripVertical className="size-5 shrink-0 cursor-grab text-muted" aria-hidden />
              <div className="min-w-0 flex-1">
                <input
                  aria-label="Nome da refeição"
                  defaultValue={m.name}
                  onBlur={(e) => e.target.value.trim() && e.target.value !== m.name && patch(m, { name: e.target.value.trim() })}
                  className="w-full bg-transparent font-semibold outline-none focus:text-link"
                />
                <label className="mt-0.5 flex items-center gap-1.5 text-sm text-muted">
                  <input
                    type="time"
                    aria-label={`Horário de ${m.name}`}
                    defaultValue={m.time ?? ''}
                    onBlur={(e) => e.target.value !== (m.time ?? '') && patch(m, { time: e.target.value || null })}
                    className="rounded-lg bg-soft px-2 py-1 font-semibold text-ink outline-none focus:ring-2 focus:ring-orchid/40"
                  />
                </label>
              </div>
              <button
                onClick={() => patch(m, { active: !m.active })}
                aria-label={m.active ? `Ocultar ${m.name}` : `Mostrar ${m.name}`}
                className="flex h-10 shrink-0 items-center gap-1 rounded-full bg-soft px-3 text-xs font-semibold text-link"
              >
                {m.active ? <EyeOff className="size-4" /> : <Eye className="size-4" />} {m.active ? 'Ocultar' : 'Mostrar'}
              </button>
              <button onClick={() => remove(m)} aria-label={`Excluir ${m.name}`} className="ml-1 flex size-10 shrink-0 items-center justify-center rounded-full text-muted active:bg-soft">
                <Trash2 className="size-4" />
              </button>
            </Card>
          </HoldToDragItem>
        ))}
      </Reorder.Group>

      <form onSubmit={add} className="mt-6 space-y-3">
        <div className="grid grid-cols-[1fr_8rem] gap-3">
          <Field label="Nova refeição" name="meal_name" placeholder="ex.: Pré-treino" value={newName} onChange={(e) => setNewName(e.target.value)} error={error?.field('name')} />
          <Field label="Horário" name="meal_time" type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} error={error?.field('time')} />
        </div>
        <Button type="submit" variant="ghost" disabled={!newName.trim()}>
          Adicionar refeição
        </Button>
      </form>
    </div>
  )
}
