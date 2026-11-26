import { ask } from '../components/Dialog'
import { Camera, Download, Dumbbell, Flame, Pencil, Route, Share2, Timer, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { notifyChanged } from '../components/Layout'
import { SessionEditor } from '../components/SessionEditor'
import { ExerciseRow, exerciseLine } from '../components/SessionSummary'
import { useToast } from '../components/Toast'
import { Alert, BackButton, Button, Spinner } from '../components/ui'
import { api, ApiError, apiUpload } from '../lib/api'
import { parseIso } from '../lib/date'
import { compressImage } from '../lib/image'
import { renderShareCard, saveImage, sessionStats, shareImage } from '../lib/shareCard'
import type { WorkoutSessionData } from '../lib/types'
import { fmtKm } from '../lib/workout'

/**
 * Resumo de um treino feito: imagem para compartilhar (foto + números, estilo Strava),
 * exercícios, anotação, editar e remover. A foto é opcional.
 */
export function TrainingPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [session, setSession] = useState<WorkoutSessionData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [card, setCard] = useState<{ blob: Blob; url: string } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [params] = useSearchParams()
  // "Ajustar" (vindo do registro rápido) já abre a edição
  const [editing, setEditing] = useState(params.get('editar') === '1')
  const [note, setNote] = useState('')
  const [sharing, setSharing] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  const leave = () => ((window.history.state?.idx ?? 0) > 0 ? navigate(-1) : navigate('/historico-treinos', { replace: true }))

  const load = useCallback(
    () =>
      api<{ session: WorkoutSessionData }>(`/workout-sessions/${id}`)
        .then((r) => {
          setSession(r.session)
          setNote(r.session.checkin?.note ?? '')
        })
        .catch((e: ApiError) => setError(e.message)),
    [id],
  )

  useEffect(() => {
    load()
  }, [load])

  // A imagem de compartilhar é a própria prévia: o que você vê é o que vai
  const photoUrl = session?.checkin?.photo_url ?? null
  useEffect(() => {
    if (!session) return
    let url = ''
    renderShareCard(session, photoUrl, 'Dieta & Treino').then((blob) => {
      url = URL.createObjectURL(blob)
      setCard((old) => {
        if (old) URL.revokeObjectURL(old.url)
        return { blob, url }
      })
    })
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [session, photoUrl])

  const sendCheckin = async (fields: Record<string, string>, photo?: Blob) => {
    const form = new FormData()
    form.append('session_id', String(session!.id))
    Object.entries(fields).forEach(([k, v]) => form.append(k, v))
    if (photo) form.append('photo', photo, 'treino.jpg')
    await apiUpload('/checkins', form)
    await load()
  }

  const onPhoto = async (file: File | undefined) => {
    if (!file || !session) return
    setUploading(true)
    try {
      await sendCheckin({}, await compressImage(file))
      toast({ text: 'Foto adicionada 📸' })
    } catch (e) {
      toast({ text: (e as ApiError).message })
    } finally {
      setUploading(false)
      if (input.current) input.current.value = ''
    }
  }

  const removePhoto = async () => {
    if (!(await ask({ title: 'Remover a foto?', text: 'O treino continua registrado.', confirmLabel: 'Remover foto', danger: true }))) return
    await sendCheckin({ remove_photo: '1' }).catch(() => {})
    toast({ text: 'Foto removida' })
  }

  const saveNote = async () => {
    if (!session || note.trim() === (session.checkin?.note ?? '')) return
    await sendCheckin({ note: note.trim() }).catch(() => {})
    toast({ text: 'Anotação salva ✓' })
  }

  const share = async () => {
    if (!card || !session) return
    setSharing(true)
    const result = await shareImage(card.blob, `treino-${session.date}.jpg`, session.workout_name)
    setSharing(false)
    if (result === 'saved') toast({ text: 'Imagem salva ✓' })
  }

  const remove = async () => {
    if (!session || !(await ask({ title: `Remover “${session.workout_name}”?`, text: 'Ele sai do histórico, com a foto, e as calorias gastas são removidas.', confirmLabel: 'Remover treino', danger: true }))) return
    await api(`/workout-sessions/${session.id}`, { method: 'DELETE' })
    notifyChanged()
    toast({ text: 'Treino removido' })
    leave()
  }

  if (error) return <div className="p-6"><Alert>{error}</Alert></div>
  if (!session) return <Spinner />

  const st = sessionStats(session)
  const date = parseIso(session.date).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="safe-top mx-auto max-w-lg px-5 pt-4 pb-10">
      <header className="mb-4 flex items-center gap-3">
        <BackButton onClick={leave} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold">{session.workout_name}</h1>
          <p className="text-sm text-muted first-letter:uppercase">{date}</p>
        </div>
        <button onClick={() => setEditing(true)} className="flex shrink-0 items-center gap-1.5 rounded-full bg-soft px-4 py-2 text-sm font-semibold text-primary">
          <Pencil className="size-4" /> Editar
        </button>
      </header>

      {/* Prévia da imagem de compartilhar */}
      <div className="relative overflow-hidden rounded-[var(--radius-card)] bg-soft shadow-lg">
        {card ? <img src={card.url} alt={`Resumo do treino ${session.workout_name}`} className="aspect-[4/5] w-full object-cover" /> : <div className="aspect-[4/5] w-full animate-pulse" />}
        {uploading && <div className="absolute inset-0 flex items-center justify-center bg-scrim/40"><Spinner /></div>}
        <div className="absolute top-3 right-3 flex gap-2">
          <button onClick={() => input.current?.click()} className="flex items-center gap-1.5 rounded-full bg-scrim/60 px-3.5 py-2 text-sm font-semibold text-white backdrop-blur active:scale-95">
            <Camera className="size-4" /> {photoUrl ? 'Trocar foto' : 'Adicionar foto'}
          </button>
          {photoUrl && (
            <button onClick={removePhoto} aria-label="Remover foto" className="flex size-9 items-center justify-center rounded-full bg-scrim/60 text-white backdrop-blur active:scale-95">
              <Trash2 className="size-4" />
            </button>
          )}
        </div>
      </div>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => onPhoto(e.target.files?.[0])} />

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button onClick={share} loading={sharing} disabled={!card}>
          <Share2 className="size-5" /> Compartilhar
        </Button>
        <Button variant="ghost" onClick={() => card && (saveImage(card.blob, `treino-${session.date}.jpg`), toast({ text: 'Imagem salva ✓' }))} disabled={!card}>
          <Download className="size-5" /> Salvar
        </Button>
      </div>

      {/* Números */}
      <div className={`mt-5 grid gap-2 text-center ${st.km > 0 ? 'grid-cols-4' : 'grid-cols-3'}`}>
        <Stat icon={<Timer className="size-5 text-primary" />} value={st.duration} label="tempo" />
        {st.km > 0 && <Stat icon={<Route className="size-5 text-primary" />} value={fmtKm(st.km)} label="km" />}
        <Stat icon={<Flame className="size-5 text-coral" />} value={st.kcal > 0 ? `~${st.kcal}` : '—'} label="kcal gastas" />
        <Stat icon={<Dumbbell className="size-5 text-primary" />} value={`${st.done}/${session.exercises.length}`} label="exercícios" />
      </div>
      {session.weight_estimated && <p className="mt-2 text-center text-xs text-muted">Registre seu peso em Progresso para uma estimativa de calorias melhor.</p>}

      {/* Exercícios */}
      <ul className="mt-4 space-y-1.5">
        {session.exercises.map((e, i) => (
          <ExerciseRow key={i} done={e.done} name={e.name} detail={exerciseLine(e)} className="rounded-xl bg-surface px-4 py-2.5" />
        ))}
      </ul>

      {/* Anotação */}
      <label className="mt-4 block">
        <span className="mb-1.5 block text-sm font-medium text-muted">Como foi? (opcional)</span>
        <textarea
          value={note}
          maxLength={280}
          rows={2}
          onChange={(e) => setNote(e.target.value)}
          onBlur={saveNote}
          placeholder="ex.: bati recorde no hip thrust!"
          className="w-full rounded-2xl border border-line bg-surface px-4 py-3 outline-none focus:border-orchid focus:ring-4 focus:ring-orchid/15"
        />
      </label>

      <button onClick={remove} className="mt-6 flex w-full items-center justify-center gap-2 py-2 text-sm font-semibold text-danger">
        <Trash2 className="size-4" /> Remover este treino
      </button>

      <SessionEditor
        session={session}
        open={editing}
        onClose={() => setEditing(false)}
        onSaved={(s) => {
          setSession((old) => ({ ...s, checkin: s.checkin ?? old?.checkin ?? null }))
          notifyChanged()
        }}
      />
    </div>
  )
}

function Stat({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
  return (
    <div className="rounded-2xl bg-surface p-2.5 shadow-[0_2px_12px_-4px_rgba(31,23,36,0.08)]">
      <p className="flex justify-center">{icon}</p>
      <p className="truncate font-bold">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  )
}
