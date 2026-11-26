import { Camera, Flame } from 'lucide-react'
import { enqueue, flush, isOffline, newRef } from '../lib/outbox'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useToast } from '../components/Toast'
import { Alert, BackButton, Button, Mascot, Spinner } from '../components/ui'
import { api, ApiError, apiUpload } from '../lib/api'
import { compressImage } from '../lib/image'
import type { Exercise, Workout, WorkoutSessionData } from '../lib/types'
import { ExerciseImage } from '../components/ExerciseImage'
import { ExercisePicker } from '../components/ExercisePicker'
import { SetsSheet } from '../components/SetsSheet'
import { isTimed, minutesOf, prescription } from '../lib/workout'
import { SessionSummary } from '../components/SessionSummary'
import { letter } from './WorkoutsPage'

interface LooseItem {
  key: string
  exercise: Exercise
  sets: number
  reps: string
}

/**
 * Check-in: treino da ficha OU exercício avulso (sem precisar de treino) + foto do dia.
 * Avulso: cria um registro de treino (tempo e exercícios) para o 🔥 gasto estimado e o histórico.
 */
export function CheckinPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [params] = useSearchParams()
  const [workouts, setWorkouts] = useState<Workout[] | null>(null)
  const [workoutId, setWorkoutId] = useState<number | null>(Number(params.get('treino')) || null)
  const sessionId = Number(params.get('sessao')) || null
  const [session, setSession] = useState<WorkoutSessionData | null>(null)
  const [photo, setPhoto] = useState<Blob | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [preparing, setPreparing] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const [mode, setMode] = useState<'ficha' | 'avulso'>(params.get('avulso') ? 'avulso' : 'ficha')
  const [loose, setLoose] = useState<LooseItem[]>([])
  const [picking, setPicking] = useState(false)
  const [pending, setPending] = useState<Exercise | null>(null)
  const [minutes, setMinutes] = useState('')
  const camera = useRef<HTMLInputElement>(null)
  const gallery = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api<{ workouts: Workout[] }>('/workouts').then((r) => {
      setWorkouts(r.workouts)
      setWorkoutId((id) => id ?? r.workouts[0]?.id ?? null)
      if (r.workouts.length === 0) setMode('avulso') // sem ficha: vai direto para exercício avulso
    })
  }, [])

  // Vindo de "Iniciar treino": mostra o resumo e vincula ao check-in
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

  // Duração sugerida: soma do cardio por tempo; só musculação → 30 min
  const timedMinutes = loose.filter(isTimed).reduce((a, i) => a + minutesOf(i.reps), 0)
  const suggested = timedMinutes || 30
  const duration = Math.max(1, Math.min(360, Number(minutes) || suggested))
  const looseName = loose.map((i) => i.exercise.name).join(' + ').slice(0, 80)

  const sessionRef = params.get('ref') // treino concluído sem internet (ainda na fila)
  const canSubmit = mode === 'ficha' ? !!workoutId : loose.length > 0
  const [celebrate, setCelebrate] = useState<number | null>(null)

  const done = async (offline: boolean) => {
    navigator.vibrate?.([40, 60, 40])
    if (offline) {
      toast({ text: 'Sem internet: check-in guardado ⏳ Vai sozinho quando a conexão voltar.' })
      navigate('/treinos', { replace: true })
      return
    }
    // Marcos de sequência: comemora com o mascote
    const r = await api<{ stats: { streak: number } }>('/checkins').catch(() => null)
    const streak = r?.stats.streak ?? 0
    if ([3, 7, 14, 30, 50, 100].includes(streak)) {
      setCelebrate(streak)
      setTimeout(() => navigate('/treinos', { replace: true }), 2600)
    } else {
      toast({ text: 'Check-in feito! 🔥' })
      navigate('/treinos', { replace: true })
    }
  }

  const submit = async (withPhoto: boolean) => {
    if (!canSubmit || (withPhoto && !photo)) return
    setSending(true)
    setError(null)
    const fields: Record<string, string> = {}
    if (note.trim()) fields.note = note.trim()
    let ref: string | undefined

    if (mode === 'ficha') {
      fields.workout_id = String(workoutId)
      if (session && session.workout_id === workoutId) fields.session_id = String(session.id)
      else if (sessionRef) ref = sessionRef
    } else {
      // Exercício avulso: registra o treino (tempo + exercícios) e vincula ao check-in
      const end = Date.now()
      const body = {
        workout_id: null,
        workout_name: looseName,
        started_at: new Date(end - duration * 60_000).toISOString(),
        finished_at: new Date(end).toISOString(),
        exercises: loose.map((i) => ({
          name: i.exercise.name, muscle_group: i.exercise.muscle_group, image: i.exercise.image,
          sets: i.sets, reps: i.reps, sets_done: i.sets, done: true,
        })),
      }
      try {
        const r = await api<{ session: WorkoutSessionData }>('/workout-sessions', { method: 'POST', body })
        fields.session_id = String(r.session.id)
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

    const pic = withPhoto && photo ? photo : undefined
    const queue = async () => {
      await enqueue({ kind: 'checkin', fields, sessionRef: ref, photo: pic })
      flush()
    }

    try {
      if (ref) {
        // Depende de um treino ainda na fila: entra na fila também (ordem garantida)
        await queue()
        await done(!navigator.onLine)
        return
      }
      const form = new FormData()
      Object.entries(fields).forEach(([k, v]) => form.append(k, v))
      if (pic) form.append('photo', pic, 'checkin.jpg')
      await apiUpload('/checkins', form)
      await done(false)
    } catch (e) {
      if (isOffline(e)) {
        await queue()
        await done(true)
      } else setError(e as ApiError)
    } finally {
      setSending(false)
    }
  }

  if (!workouts) return <Spinner />

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

  return (
    <div className="safe-top mx-auto max-w-lg px-5 pt-4 pb-10">
      <header className="mb-5 flex items-center gap-3">
        <BackButton onClick={() => navigate(-1)} />
        <h1 className="text-xl font-bold">Check-in do treino</h1>
      </header>

      {(
        <div className="space-y-5">
          {error && <Alert>{error.field('photo') ?? error.message}</Alert>}

          <div>
            {session && (
              <div className="mb-4">
                <p className="mb-2 text-sm font-medium text-muted">Seu treino de hoje</p>
                <SessionSummary session={session} />
              </div>
            )}
            {!session && (
              <div className="mb-4 flex rounded-2xl bg-soft p-1" role="tablist" aria-label="Tipo de check-in">
                {([['ficha', 'Treino da ficha'], ['avulso', 'Exercício avulso']] as const).map(([k, l]) => (
                  <button key={k} role="tab" aria-selected={mode === k} onClick={() => setMode(k)} className="relative flex-1 rounded-xl py-2.5 text-sm font-semibold">
                    {mode === k && <motion.span layoutId="checkin-mode" className="absolute inset-0 rounded-xl bg-surface shadow-sm" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
                    <span className={`relative ${mode === k ? 'text-primary' : 'text-muted'}`}>{l}</span>
                  </button>
                ))}
              </div>
            )}

            {mode === 'avulso' ? (
              <div className="space-y-3">
                <p className="text-sm font-medium text-muted">O que você fez?</p>
                {loose.map((i) => (
                  <div key={i.key} className="flex items-center gap-3 rounded-2xl bg-surface p-2 pr-3 shadow-sm">
                    <ExerciseImage image={i.exercise.image} name={i.exercise.name} size={48} animate={false} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{i.exercise.name}</p>
                      <p className="text-xs font-semibold text-primary">{prescription(i)}</p>
                    </div>
                    <button aria-label={`Remover ${i.exercise.name}`} onClick={() => setLoose((l) => l.filter((x) => x.key !== i.key))} className="text-xl text-muted">×</button>
                  </div>
                ))}
                <button onClick={() => setPicking(true)} className="w-full rounded-2xl border-2 border-dashed border-line py-4 text-sm font-semibold text-primary">
                  + {loose.length ? 'Outro exercício' : 'Escolher exercício'}
                </button>
                {loose.length > 0 && (
                  <label className="flex items-center justify-between gap-3 rounded-2xl bg-soft/70 px-4 py-3">
                    <span className="text-sm">
                      <span className="block font-medium">Duração total</span>
                      <span className="text-xs text-muted">usada no gasto estimado</span>
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
                )}
              </div>
            ) : workouts.length === 0 ? (
              <p className="rounded-2xl bg-soft/70 p-4 text-sm text-muted">
                Você ainda não tem treinos na ficha. Use <strong>Exercício avulso</strong> ou <Link to="/treinos" className="font-semibold text-primary">crie sua ficha</Link>.
              </p>
            ) : (
            <>
            <p className="mb-2 text-sm font-medium text-muted">Qual treino você fez?</p>
            <div className="flex flex-wrap gap-2">
              {workouts.map((w) => (
                <button
                  key={w.id}
                  onClick={() => setWorkoutId(w.id)}
                  className={`flex items-center gap-2 rounded-2xl py-2 pr-4 pl-2 text-sm font-semibold transition-all ${workoutId === w.id ? 'bg-primary text-white shadow-md' : 'bg-surface text-ink shadow-sm'}`}
                >
                  <span className={`flex size-8 items-center justify-center rounded-xl text-sm ${workoutId === w.id ? 'bg-white/20' : 'bg-soft text-primary'}`}>{letter(w.name)}</span>
                  {w.name}
                </button>
              ))}
            </div>
            </>
            )}
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-muted">Foto do dia <span className="font-normal">(opcional)</span></p>
            <AnimatePresence mode="wait">
              {preview ? (
                <motion.div key="preview" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="relative">
                  <img src={preview} alt="Prévia da foto do check-in" className="aspect-[4/5] w-full rounded-[var(--radius-card)] object-cover shadow-lg" />
                  <button
                    onClick={() => {
                      setPhoto(null)
                      setPreview(null)
                    }}
                    className="absolute top-3 right-3 rounded-full bg-scrim/60 px-3 py-1.5 text-sm font-semibold text-white backdrop-blur"
                  >
                    Trocar foto
                  </button>
                </motion.div>
              ) : (
                <motion.div key="pick" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid aspect-[4/5] w-full place-content-center gap-3 rounded-[var(--radius-card)] border-2 border-dashed border-orchid/40 bg-soft/60 p-6 text-center">
                  {preparing ? (
                    <Spinner />
                  ) : (
                    <>
                      <Camera className="mx-auto size-12 text-primary" strokeWidth={1.5} />
                      <p className="font-semibold">Registre seu treino de hoje</p>
                      <p className="text-xs text-muted">A foto é opcional</p>
                      <div className="mt-2 grid gap-2">
                        <Button onClick={() => camera.current?.click()}>Tirar foto</Button>
                        <Button variant="ghost" onClick={() => gallery.current?.click()}>Escolher da galeria</Button>
                      </div>
                    </>
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

          {photo ? (
            <Button onClick={() => submit(true)} loading={sending} disabled={!canSubmit}>
              Fazer check-in 🔥
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => submit(false)} loading={sending} disabled={!canSubmit}>
              Fazer check-in sem foto
            </Button>
          )}
          <p className="text-center text-xs text-muted">Sua foto é privada: só você vê.</p>
        </div>
      )}

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
        onClose={() => setPending(null)}
        onSave={(v) => {
          setLoose((l) => [...l, { key: `${pending!.id}-${Date.now()}`, exercise: pending!, sets: v.sets, reps: v.reps }])
          setPending(null)
        }}
      />
    </div>
  )
}
