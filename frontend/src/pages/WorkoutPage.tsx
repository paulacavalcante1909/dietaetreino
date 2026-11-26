import { ask } from '../components/Dialog'
import { motion, Reorder } from 'framer-motion'
import { HoldToDragItem } from '../components/HoldToDrag'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ExerciseImage } from '../components/ExerciseImage'
import { ExercisePicker } from '../components/ExercisePicker'
import { Sheet } from '../components/Sheet'
import { WeightChart } from '../components/WeightChart'
import { Copy, Play, Trash2, Trophy, X } from 'lucide-react'
import { SetsSheet } from '../components/SetsSheet'
import { isTimed, minutesOf, prescription } from '../lib/workout'
import { useToast } from '../components/Toast'
import { Alert, BackButton, Button, Spinner } from '../components/ui'
import { api, ApiError } from '../lib/api'
import type { Exercise, Workout, WorkoutItem } from '../lib/types'


type Item = WorkoutItem & { key: string }
const withKeys = (items: WorkoutItem[]): Item[] => items.map((i, n) => ({ ...i, key: `${i.id ?? 'n'}-${n}-${Math.random()}` }))

/** Ver um treino da ficha; no modo edição: renomear, adicionar/reordenar/editar exercícios. */
export function WorkoutPage() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const editing = params.get('editar') === '1'
  const navigate = useNavigate()
  const toast = useToast()

  const [workout, setWorkout] = useState<Workout | null>(null)
  const [name, setName] = useState('')
  const [items, setItems] = useState<Item[]>([])
  const [picking, setPicking] = useState(false)
  const [editIndex, setEditIndex] = useState<number | null>(null)
  const [pending, setPending] = useState<Exercise | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const [viewing, setViewing] = useState<Item | null>(null)

  useEffect(() => {
    api<{ workout: Workout }>(`/workouts/${id}`).then((r) => {
      setWorkout(r.workout)
      setName(r.workout.name)
      setItems(withKeys(r.workout.items))
    })
  }, [id])

  const setEditing = (on: boolean) => setParams(on ? { editar: '1' } : {}, { replace: true })

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const r = await api<{ workout: Workout }>(`/workouts/${id}`, {
        method: 'PUT',
        body: { name: name.trim(), items: items.map((i) => ({ exercise_id: i.exercise_id, sets: i.sets, reps: i.reps, notes: i.notes })) },
      })
      setWorkout(r.workout)
      setItems(withKeys(r.workout.items))
      setEditing(false)
      toast({ text: 'Treino salvo ✓' })
    } catch (e) {
      setError(e as ApiError)
    } finally {
      setSaving(false)
    }
  }

  const cancel = () => {
    if (!workout) return
    // Treino recém-criado e ainda vazio: desistir não deixa um "Treino A" vazio na ficha
    if (params.get('novo') && workout.items.length === 0 && items.length === 0) {
      api(`/workouts/${id}`, { method: 'DELETE' }).catch(() => {})
      navigate('/treinos', { replace: true })
      return
    }
    setName(workout.name)
    setItems(withKeys(workout.items))
    setEditing(false)
  }

  const duplicate = async () => {
    const r = await api<{ workout: Workout }>(`/workouts/${id}/duplicate`, { method: 'POST' })
    toast({ text: 'Treino duplicado ✓' })
    navigate(`/treinos/${r.workout.id}`, { replace: true })
  }

  const remove = async () => {
    if (!(await ask({ title: `Excluir “${workout?.name}”?`, text: 'Os treinos já feitos continuam no histórico.', confirmLabel: 'Excluir treino', danger: true }))) return
    await api(`/workouts/${id}`, { method: 'DELETE' })
    toast({ text: 'Treino excluído' })
    navigate('/treinos', { replace: true })
  }

  if (!workout) return <Spinner />

  return (
    <div className="safe-top mx-auto max-w-lg px-5 pt-4 pb-28">
      <header className="mb-5 flex items-center gap-3">
        <BackButton onClick={() => (editing ? cancel() : navigate('/treinos'))} />
        {editing ? (
          <input aria-label="Nome do treino" value={name} onChange={(e) => setName(e.target.value)} className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-xl font-bold outline-none focus:border-orchid" />
        ) : (
          <h1 className="min-w-0 flex-1 truncate text-xl font-bold">{workout.name}</h1>
        )}
        {!editing && (
          <button onClick={() => setEditing(true)} className="rounded-full bg-soft px-4 py-2 text-sm font-semibold text-link">
            Editar
          </button>
        )}
      </header>

      {error && <div className="mb-3"><Alert>{error.field('name') ?? error.message}</Alert></div>}

      {items.length === 0 && (
        <p className="py-10 text-center text-sm text-muted">{editing ? 'Adicione os exercícios deste treino.' : 'Nenhum exercício ainda. Toque em Editar.'}</p>
      )}

      {editing ? (
        <Reorder.Group axis="y" values={items} onReorder={setItems} className="space-y-2">
          {items.map((it, idx) => (
            <HoldToDragItem key={it.key} value={it}>
              <div className="flex items-center gap-3 rounded-2xl bg-surface p-2 pr-3 shadow-[0_2px_12px_-4px_rgba(31,23,36,0.08)]">
                <span className="cursor-grab pl-1 text-lg text-muted select-none" aria-hidden>⋮⋮</span>
                <ExerciseImage image={it.exercise.image} name={it.exercise.name} size={48} animate={false} />
                <button onClick={() => setEditIndex(idx)} className="min-w-0 flex-1 text-left">
                  <p className="truncate text-sm font-medium">{it.exercise.name}</p>
                  <p className="text-xs font-semibold text-link">{prescription(it)}</p>
                </button>
                <button aria-label={`Tirar ${it.exercise.name} do treino`} onClick={() => setItems((l) => l.filter((_, j) => j !== idx))} className="-mr-1 flex size-10 items-center justify-center rounded-full text-muted active:bg-soft">
                  <X className="size-5" />
                </button>
              </div>
            </HoldToDragItem>
          ))}
        </Reorder.Group>
      ) : (
        <ol className="space-y-3">
          {items.map((it, idx) => (
            <motion.li key={it.key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}>
              <button onClick={() => setViewing(it)} className="flex w-full items-center gap-3 rounded-[var(--radius-card)] bg-surface p-3 text-left shadow-[0_2px_12px_-4px_rgba(31,23,36,0.08)] active:scale-[0.99]">
                <ExerciseImage image={it.exercise.image} name={it.exercise.name} size={72} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted">{idx + 1}º exercício</p>
                  <p className="font-semibold leading-snug">{it.exercise.name}</p>
                  <p className="mt-1 inline-block rounded-full bg-orchid/15 px-2.5 py-0.5 text-sm font-bold text-link">
                    {prescription(it)}
                  </p>
                  {it.notes && <p className="mt-1 text-xs text-muted">{it.notes}</p>}
                </div>
              </button>
            </motion.li>
          ))}
        </ol>
      )}

      {editing && (
        <div className="mt-4 space-y-3">
          <button onClick={() => setPicking(true)} className="w-full rounded-2xl border-2 border-dashed border-line py-4 text-sm font-semibold text-link">
            + Adicionar exercício
          </button>
          {/* Ações secundárias longe do botão principal; excluir pede confirmação */}
          <div className="mt-10 flex justify-center gap-6 border-t border-line pt-5 text-sm font-semibold">
            {items.length > 0 && (
              <button onClick={duplicate} className="flex items-center gap-1.5 px-2 py-2 text-link">
                <Copy className="size-4" /> Duplicar treino
              </button>
            )}
            <button onClick={remove} className="flex items-center gap-1.5 px-2 py-2 text-danger">
              <Trash2 className="size-4" /> Excluir treino
            </button>
          </div>
        </div>
      )}

      {/* Barra de ação fixa */}
      <div className="safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/90 backdrop-blur-lg">
        <div className="mx-auto max-w-lg px-5 py-3">
          {editing ? (
            <Button onClick={save} loading={saving} disabled={!name.trim()}>Salvar treino</Button>
          ) : (
            <div className="flex gap-2">
              {items.length > 0 && (
                <Link to={`/treinos/${workout.id}/iniciar`} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-primary font-semibold text-white shadow-[0_6px_20px_-8px_rgba(155,63,168,0.7)] active:scale-[0.98]">
                  <Play className="size-4 fill-current" /> Iniciar treino
                </Link>
              )}
              <Link to={`/registrar-treino?treino=${workout.id}`} className={`flex h-12 items-center justify-center rounded-2xl bg-soft px-4 font-semibold text-link active:scale-[0.98] ${items.length > 0 ? '' : 'flex-1'}`}>
                Já fiz
              </Link>
            </div>
          )}
        </div>
      </div>

      <ExercisePicker
        open={picking}
        onClose={() => setPicking(false)}
        onPick={(e) => {
          setPicking(false)
          setPending(e)
        }}
      />

      {/* Séries/repetições: novo exercício ou edição */}
      <SetsSheet
        item={pending ? { exercise: pending, sets: 3, reps: '12', notes: null } : editIndex !== null ? items[editIndex] : null}
        isNew={!!pending}
        onClose={() => {
          setPending(null)
          setEditIndex(null)
        }}
        withNotes
        onSave={(v) => {
          if (pending) setItems((l) => [...l, ...withKeys([{ exercise_id: pending.id, exercise: pending, ...v }])])
          else setItems((l) => l.map((x, j) => (j === editIndex ? { ...x, ...v } : x)))
          setPending(null)
          setEditIndex(null)
        }}
      />

      <Sheet open={!!viewing} onClose={() => setViewing(null)} title={viewing?.exercise.name}>
        {viewing && (
          <div className="space-y-4">
            {viewing.exercise.image ? (
              <div className="grid grid-cols-2 gap-2">
                {[0, 1].map((i) => (
                  <img key={i} src={`${viewing.exercise.image}/${i}.webp`} alt={i === 0 ? 'Posição inicial' : 'Posição final'} className="aspect-square w-full rounded-2xl bg-white object-cover" />
                ))}
              </div>
            ) : (
              <ExerciseImage image={null} name={viewing.exercise.name} size={96} />
            )}
            <p className="text-center text-2xl font-bold text-link">
              {isTimed(viewing) ? `${minutesOf(viewing.reps)} minutos` : `${viewing.sets} séries × ${viewing.reps}`}
            </p>
            {viewing.notes && <p className="rounded-2xl bg-soft p-3 text-sm">{viewing.notes}</p>}
            {!isTimed(viewing) && <LoadHistory name={viewing.exercise.name} />}
          </div>
        )}
      </Sheet>
    </div>
  )
}

/** Evolução da carga máxima por treino (a partir dos treinos executados). */
function LoadHistory({ name }: { name: string }) {
  const [history, setHistory] = useState<{ date: string; kg: number }[] | null>(null)
  useEffect(() => {
    api<{ history: { date: string; kg: number }[] }>(`/stats/loads?name=${encodeURIComponent(name)}`)
      .then((r) => setHistory(r.history))
      .catch(() => setHistory([]))
  }, [name])

  if (!history) return <div className="h-40 animate-pulse rounded-2xl bg-soft" />
  if (history.length === 0)
    return <p className="rounded-2xl bg-soft p-3 text-center text-sm text-muted">Anote a carga das séries durante o treino para ver sua evolução aqui.</p>

  const best = Math.max(...history.map((h) => h.kg))
  return (
    <div className="rounded-2xl bg-soft/60 p-3">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-bold">Evolução de carga</span>
        <span className="flex items-center gap-1 font-semibold text-link">
          <Trophy className="size-4" /> {best.toLocaleString('pt-BR')} kg
        </span>
      </div>
      {history.length > 1 ? (
        <WeightChart data={history.map((h, i) => ({ id: i, date: h.date, kg: h.kg }))} label="carga" />
      ) : (
        <p className="text-center text-sm text-muted">1 treino registrado ({history[0].kg.toLocaleString('pt-BR')} kg). O gráfico aparece a partir do 2º.</p>
      )}
    </div>
  )
}
