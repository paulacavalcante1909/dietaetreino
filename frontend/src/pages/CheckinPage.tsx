import { useBottomInset } from '../lib/viewport'
import { Camera, Flame, X } from 'lucide-react'
import { enqueue, flush, isOffline, newRef } from '../lib/outbox'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { notifyChanged } from '../components/Layout'
import { useToast } from '../components/Toast'
import { Alert, BackButton, Button, Mascot, Spinner } from '../components/ui'
import { api, ApiError, apiUpload } from '../lib/api'
import { compressImage } from '../lib/image'
import type { Exercise, Workout, WorkoutSessionData } from '../lib/types'
import { ExerciseImage } from '../components/ExerciseImage'
import { ExercisePicker } from '../components/ExercisePicker'
import { SetsSheet } from '../components/SetsSheet'
import { letter, prescription, suggestedMinutes } from '../lib/workout'
import { SessionSummary } from '../components/SessionSummary'

interface LooseItem {
  key: string
  exercise: Exercise
  sets: number
  reps: string
  distance_km?: number | null
}

/** Volta para a tela de onde veio (início, treinos…); sem histórico, vai para o início. */
const useLeave = () => {
  const navigate = useNavigate()
  return () => ((window.history.state?.idx ?? 0) > 0 ? navigate(-1) : navigate('/', { replace: true }))
}

/**
 * Registrar treino.
 * - Treino já feito: da ficha (A, B, C…) ou exercícios avulsos, com duração, dia e foto opcional.
 * - `?sessao=` / `?ref=`: treino feito no app; só adiciona a foto (opcional) e a anotação.
 */
export function CheckinPage() {
  const toast = useToast()
  const leave = useLeave()
  const [params] = useSearchParams()
  const sessionId = Number(params.get('sessao')) || null
  const sessionRef = params.get('ref') // treino concluído sem internet (ainda na fila)
  const photoOnly = !!(sessionId || sessionRef)

  const [workouts, setWorkouts] = useState<Workout[] | null>(null)
  const [workoutId, setWorkoutId] = useState<number | null>(Number(params.get('treino')) || null)
  const [session, setSession] = useState<WorkoutSessionData | null>(null)
  const [mode, setMode] = useState<'ficha' | 'avulso'>(params.get('avulso') ? 'avulso' : 'ficha')
  const [loose, setLoose] = useState<LooseItem[]>([])
  // Avulso: a lista de exercícios abre direto
  const [picking, setPicking] = useState(!!params.get('avulso'))
  const [pending, setPending] = useState<Exercise | null>(null)
  const [minutes, setMinutes] = useState('')
  const [yesterday, setYesterday] = useState(false)
  const [photo, setPhoto] = useState<Blob | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [preparing, setPreparing] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const [celebrate, setCelebrate] = useState<number | null>(null)
  const camera = useRef<HTMLInputElement>(null)
  const bottomInset = useBottomInset()
  const gallery = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (photoOnly) return
    api<{ workouts: Workout[] }>('/workouts').then((r) => {
      setWorkouts(r.workouts)
      setWorkoutId((id) => id ?? r.workouts.find((w) => w.items.length > 0)?.id ?? null)
      if (r.workouts.length === 0) setMode('avulso') // sem ficha: vai direto para exercício avulso
    })
  }, [photoOnly])

  useEffect(() => {
    if (sessionId) api<{ session: WorkoutSessionData }>(`/workout-sessions/${sessionId}`).then((r) => setSession(r.session)).catch(() => {})
  }, [sessionId])

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview)
  }, [preview])

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setPreparing(true)
    setError(null)
    const blob = await compressImage(file)
    setPhoto(blob)
    setPreview(URL.createObjectURL(blob))
    setPreparing(false)
  }

  const workout = workouts?.find((w) => w.id === workoutId) ?? null
  const items = mode === 'ficha' ? (workout?.items ?? []) : loose
  const suggested = suggestedMinutes(items)
  const duration = Math.max(1, Math.min(360, Number(minutes) || suggested))
  const canSubmit = photoOnly || (mode === 'ficha' ? !!workout && workout.items.length > 0 : loose.length > 0)

  /** Depois de salvar: comemora marcos de sequência e oferece desfazer. */
  const finish = async (savedSessionId: number | null, offline: boolean) => {
    navigator.vibrate?.([40, 60, 40])
    if (offline) {
      toast({ text: 'Sem internet: treino guardado ⏳ Vai sozinho quando a conexão voltar.' })
      leave()
      return
    }
    const r = await api<{ stats: { streak: number } }>('/checkins').catch(() => null)
    const streak = r?.stats.streak ?? 0
    const undo = !photoOnly && savedSessionId
      ? { label: 'Desfazer', run: () => api(`/workout-sessions/${savedSessionId}`, { method: 'DELETE' }).then(() => {
          notifyChanged()
          toast({ text: 'Treino removido' })
        }).catch(() => {}) }
      : undefined
    if ([3, 7, 14, 30, 50, 100].includes(streak) && !photoOnly) {
      setCelebrate(streak)
      setTimeout(leave, 2600)
    } else {
      toast({ text: photoOnly ? (photo ? 'Foto adicionada ao treino 📸' : 'Anotação salva ✓') : 'Treino registrado! 🔥', action: undo })
      leave()
    }
  }

  const submit = async () => {
    if (!canSubmit) return
    setSending(true)
    setError(null)
    const fields: Record<string, string> = {}
    if (note.trim()) fields.note = note.trim()
    const withExtras = !!photo || !!fields.note
    let ref: string | undefined = sessionRef ?? undefined
    let savedId: number | null = sessionId

    if (!photoOnly) {
      // Todo treino vira um registro (tempo + exercícios): conta na semana e estima o gasto
      const end = Date.now() - (yesterday ? 24 * 3600_000 : 0)
      const body = {
        workout_id: mode === 'ficha' ? workout!.id : null,
        workout_name: mode === 'ficha' ? workout!.name : loose.map((i) => i.exercise.name).join(' + ').slice(0, 80),
        started_at: new Date(end - duration * 60_000).toISOString(),
        finished_at: new Date(end).toISOString(),
        exercises: items.map((i) => ({
          name: i.exercise.name, muscle_group: i.exercise.muscle_group, image: i.exercise.image,
          sets: i.sets, reps: i.reps, sets_done: i.sets, done: true,
          distance_km: 'distance_km' in i ? (i.distance_km ?? null) : null,
        })),
      }
      try {
        const r = await api<{ session: WorkoutSessionData }>('/workout-sessions', { method: 'POST', body })
        savedId = r.session.id
      } catch (e) {
        if (!isOffline(e)) {
          setError(e as ApiError)
          setSending(false)
          return
        }
        ref = newRef()
        await enqueue({ kind: 'session', ref, body })
      }
    }

    // Sem foto e sem anotação: o treino já está salvo
    if (!withExtras) {
      setSending(false)
      await finish(savedId, !savedId)
      return
    }

    if (savedId) fields.session_id = String(savedId)
    const queue = async () => {
      await enqueue({ kind: 'checkin', fields, sessionRef: savedId ? undefined : ref, photo: photo ?? undefined })
      flush()
    }
    try {
      if (!savedId) {
        await queue()
        await finish(null, !navigator.onLine)
        return
      }
      const form = new FormData()
      Object.entries(fields).forEach(([k, v]) => form.append(k, v))
      if (photo) form.append('photo', photo, 'treino.jpg')
      await apiUpload('/checkins', form)
      await finish(savedId, false)
    } catch (e) {
      if (isOffline(e)) {
        await queue()
        await finish(savedId, true)
      } else setError(e as ApiError)
    } finally {
      setSending(false)
    }
  }

  // Treino já salvo: a foto e o resumo ficam na tela do treino
  if (sessionId) return <Navigate to={`/treino/${sessionId}`} replace />
  if (!photoOnly && !workouts) return <Spinner />

  if (celebrate) {
    return (
      <div className="safe-top mx-auto flex min-h-full max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
        <motion.div initial={{ scale: 0.3, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 220, damping: 12 }}>
          <Mascot size={160} />
        </motion.div>
        <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="flex items-center gap-2 text-3xl font-extrabold">
          <Flame className="size-8 text-coral" /> {celebrate} dias seguidos!
        </motion.p>
        <p className="text-muted">Que sequência! Continue assim 💪</p>
      </div>
    )
  }

  const submitLabel = photoOnly ? (photo ? 'Salvar foto' : note.trim() ? 'Salvar anotação' : 'Concluir sem foto') : 'Registrar treino 🔥'

  return (
    <div className="safe-top mx-auto max-w-lg px-5 pt-4 pb-28">
      <header className="mb-5 flex items-center gap-3">
        <BackButton onClick={leave} />
        <h1 className="text-xl font-bold">{photoOnly ? 'Foto do treino' : 'Registrar treino'}</h1>
      </header>

      <div className="space-y-5">
        {error && <Alert>{error.field('photo') ?? error.message}</Alert>}

        {photoOnly ? (
          session && <SessionSummary session={session} />
        ) : (
          <div>
            <div className="mb-4 flex rounded-2xl bg-soft p-1" role="tablist" aria-label="O que você fez">
              {([['ficha', 'Treino da ficha'], ['avulso', 'Exercício avulso']] as const).map(([k, l]) => (
                <button key={k} role="tab" aria-selected={mode === k} onClick={() => setMode(k)} className="relative flex-1 rounded-xl py-2.5 text-sm font-semibold">
                  {mode === k && <motion.span layoutId="checkin-mode" className="absolute inset-0 rounded-xl bg-surface shadow-sm" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
                  <span className={`relative ${mode === k ? 'text-link' : 'text-muted'}`}>{l}</span>
                </button>
              ))}
            </div>

            {mode === 'avulso' ? (
              <div className="space-y-3">
                <p className="text-sm font-medium text-muted">O que você fez?</p>
                {loose.map((i) => (
                  <div key={i.key} className="flex items-center gap-3 rounded-2xl bg-surface p-2 pr-1 shadow-sm">
                    <ExerciseImage image={i.exercise.image} name={i.exercise.name} size={48} animate={false} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{i.exercise.name}</p>
                      <p className="text-xs font-semibold text-link">{prescription(i)}</p>
                    </div>
                    <button aria-label={`Remover ${i.exercise.name}`} onClick={() => setLoose((l) => l.filter((x) => x.key !== i.key))} className="flex size-10 items-center justify-center rounded-full text-muted active:bg-soft">
                      <X className="size-5" />
                    </button>
                  </div>
                ))}
                <button onClick={() => setPicking(true)} className="w-full rounded-2xl border-2 border-dashed border-line py-4 text-sm font-semibold text-link">
                  + {loose.length ? 'Outro exercício' : 'Escolher exercício'}
                </button>
              </div>
            ) : workouts!.length === 0 ? (
              <p className="rounded-2xl bg-soft/70 p-4 text-sm text-muted">
                Você ainda não tem treinos na ficha. Use <strong>Exercício avulso</strong> ou <Link to="/treinos" className="font-semibold text-link">crie sua ficha</Link>.
              </p>
            ) : (
              <>
                <p className="mb-2 text-sm font-medium text-muted">Qual treino você fez?</p>
                <div className="flex flex-wrap gap-2">
                  {workouts!.map((w) => (
                    <button
                      key={w.id}
                      onClick={() => setWorkoutId(w.id)}
                      aria-pressed={workoutId === w.id}
                      className={`flex items-center gap-2 rounded-2xl py-2 pr-4 pl-2 text-sm font-semibold transition-all ${workoutId === w.id ? 'bg-primary text-white shadow-md' : 'bg-surface text-ink shadow-sm'}`}
                    >
                      <span className={`flex size-8 items-center justify-center rounded-xl text-sm ${workoutId === w.id ? 'bg-white/20' : 'bg-soft text-link'}`}>{letter(w.name)}</span>
                      {w.name}
                    </button>
                  ))}
                </div>
                {workout && workout.items.length === 0 && (
                  <p className="mt-2 text-sm text-muted">Este treino ainda não tem exercícios. <Link to={`/treinos/${workout.id}?editar=1`} className="font-semibold text-link">Adicionar exercícios</Link></p>
                )}
                {workout && workout.items.length > 0 && <p className="mt-2 text-xs text-muted">{workout.items.map((i) => i.exercise.name).join(' · ')}</p>}
              </>
            )}

            {items.length > 0 && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between gap-3 rounded-2xl bg-soft/70 px-4 py-3">
                  <span className="text-sm font-medium">Quando?</span>
                  <span className="flex gap-1.5">
                    {([[false, 'Hoje'], [true, 'Ontem']] as const).map(([v, l]) => (
                      <button key={l} onClick={() => setYesterday(v)} aria-pressed={yesterday === v} className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${yesterday === v ? 'bg-primary text-white' : 'bg-surface text-ink'}`}>
                        {l}
                      </button>
                    ))}
                  </span>
                </div>
                <label className="flex items-center justify-between gap-3 rounded-2xl bg-soft/70 px-4 py-3">
                  <span className="text-sm">
                    <span className="block font-medium">Duração</span>
                    <span className="text-xs text-muted">usada para estimar as calorias gastas</span>
                  </span>
                  <span className="flex items-baseline gap-1">
                    <input
                      aria-label="Duração em minutos"
                      inputMode="numeric"
                      value={minutes}
                      placeholder={String(suggested)}
                      onChange={(e) => setMinutes(e.target.value.replace(/\D/g, '').slice(0, 3))}
                      className="w-14 rounded-xl border border-line bg-surface py-1.5 text-center font-semibold outline-none focus:border-orchid"
                    />
                    <span className="text-sm text-muted">min</span>
                  </span>
                </label>
              </div>
            )}
          </div>
        )}

        <div>
          <p className="mb-2 text-sm font-medium text-muted">Foto <span className="font-normal">(opcional, só você vê)</span></p>
          <AnimatePresence mode="wait">
            {preview ? (
              <motion.div key="preview" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="relative">
                <img src={preview} alt="Prévia da foto do treino" className="aspect-[4/5] w-full rounded-[var(--radius-card)] object-cover shadow-lg" />
                <button
                  onClick={() => {
                    setPhoto(null)
                    setPreview(null)
                  }}
                  className="absolute top-3 right-3 rounded-full bg-scrim/60 px-3 py-1.5 text-sm font-semibold text-white backdrop-blur"
                >
                  Remover foto
                </button>
              </motion.div>
            ) : (
              <motion.div key="pick" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="rounded-[var(--radius-card)] border-2 border-dashed border-orchid/40 bg-soft/60 p-4">
                {preparing ? (
                  <div className="flex justify-center py-3"><Spinner /></div>
                ) : (
                  <div className="flex items-center gap-3">
                    <Camera className="size-9 shrink-0 text-link" strokeWidth={1.5} />
                    <div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
                      <button type="button" onClick={() => camera.current?.click()} className="h-11 rounded-xl bg-primary text-sm font-bold text-white active:scale-[0.98]">
                        Câmera
                      </button>
                      <button type="button" onClick={() => gallery.current?.click()} className="h-11 rounded-xl bg-surface text-sm font-bold text-link shadow-sm active:scale-[0.98]">
                        Galeria
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
          {/* capture abre direto a câmera no celular; o segundo input abre a galeria */}
          <input ref={camera} type="file" accept="image/*" capture="user" hidden onChange={(e) => onFile(e.target.files?.[0])} />
          <input ref={gallery} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-muted">Como foi? (opcional)</span>
          <textarea
            value={note}
            maxLength={280}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="ex.: bati recorde no hip thrust!"
            className="w-full rounded-2xl border border-line bg-surface px-4 py-3 outline-none focus:border-orchid focus:ring-4 focus:ring-orchid/15"
          />
        </label>

        {/* Ação principal sempre visível no rodapé */}
        <div style={{ bottom: bottomInset }} className="safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/90 backdrop-blur-lg">
          <div className="mx-auto max-w-lg px-5 py-3">
            <Button onClick={submit} loading={sending} disabled={!canSubmit}>
              {submitLabel}
            </Button>
          </div>
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
      <SetsSheet
        item={pending ? { exercise: pending, sets: 3, reps: '12', notes: null } : null}
        isNew
        withDistance
        onClose={() => setPending(null)}
        onSave={(v) => {
          setLoose((l) => [...l, { key: `${pending!.id}-${Date.now()}`, exercise: pending!, sets: v.sets, reps: v.reps, distance_km: v.distance_km }])
          setPending(null)
        }}
      />
    </div>
  )
}
