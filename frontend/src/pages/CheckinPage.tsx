import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useToast } from '../components/Toast'
import { Alert, Button, Spinner } from '../components/ui'
import { api, ApiError, apiUpload } from '../lib/api'
import { compressImage } from '../lib/image'
import type { Workout } from '../lib/types'
import { letter } from './WorkoutsPage'

/** Check-in: escolher o treino da ficha + foto do dia (câmera ou galeria). */
export function CheckinPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [params] = useSearchParams()
  const [workouts, setWorkouts] = useState<Workout[] | null>(null)
  const [workoutId, setWorkoutId] = useState<number | null>(Number(params.get('treino')) || null)
  const [photo, setPhoto] = useState<Blob | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [preparing, setPreparing] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const camera = useRef<HTMLInputElement>(null)
  const gallery = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api<{ workouts: Workout[] }>('/workouts').then((r) => {
      setWorkouts(r.workouts)
      setWorkoutId((id) => id ?? r.workouts[0]?.id ?? null)
    })
  }, [])

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

  const submit = async () => {
    if (!photo || !workoutId) return
    setSending(true)
    setError(null)
    const form = new FormData()
    form.append('workout_id', String(workoutId))
    form.append('photo', photo, 'checkin.jpg')
    if (note.trim()) form.append('note', note.trim())
    try {
      await apiUpload('/checkins', form)
      navigator.vibrate?.([40, 60, 40])
      toast({ text: 'Check-in feito! 🔥' })
      navigate('/treinos', { replace: true })
    } catch (e) {
      setError(e as ApiError)
    } finally {
      setSending(false)
    }
  }

  if (!workouts) return <Spinner />

  return (
    <div className="safe-top mx-auto max-w-lg px-5 pt-4 pb-10">
      <header className="mb-5 flex items-center gap-3">
        <button onClick={() => navigate(-1)} aria-label="Voltar" className="flex size-10 items-center justify-center rounded-full bg-surface text-2xl text-primary shadow-sm">
          ‹
        </button>
        <h1 className="text-xl font-bold">Check-in do treino</h1>
      </header>

      {workouts.length === 0 ? (
        <div className="space-y-4 py-8 text-center">
          <p className="text-4xl">🏋️‍♀️</p>
          <p className="text-muted">Crie um treino na sua ficha para fazer check-in.</p>
          <Link to="/treinos" className="font-semibold text-primary">Ir para Treinos</Link>
        </div>
      ) : (
        <div className="space-y-5">
          {error && <Alert>{error.field('photo') ?? error.message}</Alert>}

          <div>
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
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-muted">Foto do dia</p>
            <AnimatePresence mode="wait">
              {preview ? (
                <motion.div key="preview" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="relative">
                  <img src={preview} alt="Prévia da foto do check-in" className="aspect-[4/5] w-full rounded-[var(--radius-card)] object-cover shadow-lg" />
                  <button
                    onClick={() => {
                      setPhoto(null)
                      setPreview(null)
                    }}
                    className="absolute top-3 right-3 rounded-full bg-ink/60 px-3 py-1.5 text-sm font-semibold text-white backdrop-blur"
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
                      <p className="text-5xl">📸</p>
                      <p className="font-medium">Registre seu treino de hoje</p>
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

          <Button onClick={submit} loading={sending} disabled={!photo || !workoutId}>
            Fazer check-in 🔥
          </Button>
          <p className="text-center text-xs text-muted">Sua foto é privada: só você vê.</p>
        </div>
      )}
    </div>
  )
}
