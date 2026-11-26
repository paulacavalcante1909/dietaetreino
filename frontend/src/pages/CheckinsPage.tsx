import { Calendar, Camera, CheckCircle2, ChevronLeft, ChevronRight, Flame, Timer, Trash2, Trophy } from 'lucide-react'
import { useTheme } from '../lib/theme'
import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sheet } from '../components/Sheet'
import { useToast } from '../components/Toast'
import { BackButton, Button, Card, EmptyState } from '../components/ui'
import { api } from '../lib/api'
import { isoDate, parseIso } from '../lib/date'
import type { Checkin, CheckinStats, WorkoutSessionData } from '../lib/types'
import { SessionSummary } from '../components/SessionSummary'
import { durationLabel } from '../lib/run'

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

const shiftMonth = (m: string, n: number) => {
  const d = parseIso(`${m}-01`)
  d.setMonth(d.getMonth() + n)
  return isoDate(d).slice(0, 7)
}

/** Item do histórico: um check-in, ou um treino feito no app que ainda não virou check-in. */
type HistoryItem = Checkin & { onlySession?: boolean }

const fromSession = (s: WorkoutSessionData): HistoryItem => ({
  id: -s.id,
  workout_id: s.workout_id,
  workout_name: s.workout_name,
  date: s.date,
  note: null,
  photo_url: null,
  created_at: s.finished_at,
  session: s,
  onlySession: true,
})

/** Histórico de treinos: calendário do mês (check-ins com foto e treinos feitos no app) + estatísticas. */
export function CheckinsPage() {
  const { theme } = useTheme()
  const navigate = useNavigate()
  const toast = useToast()
  const [month, setMonth] = useState(isoDate().slice(0, 7))
  const [checkins, setCheckins] = useState<HistoryItem[] | null>(null)
  const [stats, setStats] = useState<CheckinStats | null>(null)
  const [open, setOpen] = useState<HistoryItem | null>(null)
  const [dir, setDir] = useState(0)

  const load = useCallback(() => {
    setCheckins(null)
    api<{ checkins: Checkin[]; sessions: WorkoutSessionData[]; stats: CheckinStats }>(`/checkins?month=${month}`).then((r) => {
      const items: HistoryItem[] = [...r.checkins, ...r.sessions.map(fromSession)]
      setCheckins(items.sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at)))
      setStats(r.stats)
    })
  }, [month])

  useEffect(load, [load])

  const byDay = useMemo(() => {
    const map: Record<string, HistoryItem[]> = {}
    checkins?.forEach((c) => (map[c.date] ??= []).push(c))
    return map
  }, [checkins])

  const first = parseIso(`${month}-01`)
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  const cells = [...Array(first.getDay()).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  const title = first.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  const today = isoDate()

  const go = (n: number) => {
    setDir(n)
    setMonth((m) => shiftMonth(m, n))
  }

  // Remover o treino: apaga o registro, a foto e as calorias gastas
  const remove = async (c: HistoryItem) => {
    if (!confirm(`Remover “${c.workout_name}”? Ele sai do histórico${c.session ? ' e as calorias gastas são removidas' : ''}.`)) return
    if (c.session) await api(`/workout-sessions/${c.session.id}`, { method: 'DELETE' })
    else await api(`/checkins/${c.id}`, { method: 'DELETE' })
    setOpen(null)
    toast({ text: 'Treino removido' })
    load()
  }

  // Só a foto/anotação: o treino continua contando
  const removePhoto = async (c: HistoryItem) => {
    if (!confirm('Remover só a foto? O treino continua no histórico.')) return
    await api(`/checkins/${c.id}`, { method: 'DELETE' })
    setOpen(null)
    toast({ text: 'Foto removida' })
    load()
  }

  return (
    <div className="safe-top mx-auto max-w-lg px-5 pt-4 pb-10">
      <header className="mb-5 flex items-center gap-3">
        <BackButton onClick={() => navigate(-1)} />
        <h1 className="text-xl font-bold">Treinos feitos</h1>
      </header>

      {stats && (
        <div className="mb-4 grid grid-cols-3 gap-2 text-center">
          {([
            [Flame, stats.streak, stats.streak === 1 ? 'dia seguido' : 'dias seguidos'],
            [Calendar, stats.month_count, stats.month_count === 1 ? 'treino no mês' : 'treinos no mês'],
            [Trophy, stats.total_count, stats.total_count === 1 ? 'treino no total' : 'treinos no total'],
          ] as const).map(([Icon, v, l]) => (
            <Card key={String(l)} className="!p-3">
              <p className="flex items-center justify-center gap-1 text-xl font-extrabold text-primary">
                <Icon className="size-5" /> {v}
              </p>
              <p className="text-xs text-muted">{l}</p>
            </Card>
          ))}
        </div>
      )}

      <Card className="!p-4">
        <div className="mb-3 flex items-center justify-between">
          <button aria-label="Mês anterior" onClick={() => go(-1)} className="flex size-9 items-center justify-center rounded-full bg-soft text-primary"><ChevronLeft className="size-5" /></button>
          <p className="font-semibold first-letter:uppercase">{title}</p>
          <button aria-label="Próximo mês" onClick={() => go(1)} disabled={month >= today.slice(0, 7)} className="flex size-9 items-center justify-center rounded-full bg-soft text-primary disabled:opacity-30"><ChevronRight className="size-5" /></button>
        </div>
        <div className="mb-1 grid grid-cols-7 text-center text-xs font-medium text-muted">
          {WEEKDAYS.map((d, i) => <span key={i}>{d}</span>)}
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={month}
            initial={{ opacity: 0, x: dir * 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -30 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-7 gap-1"
          >
            {cells.map((day, i) => {
              if (!day) return <span key={i} />
              const date = `${month}-${String(day).padStart(2, '0')}`
              const c = byDay[date]?.[0]
              return (
                <button
                  key={i}
                  disabled={!c}
                  onClick={() => c && setOpen(c)}
                  className={`relative aspect-square overflow-hidden rounded-xl text-sm ${date === today ? 'ring-2 ring-orchid' : ''} ${c ? (c.photo_url ? '' : 'bg-gradient-to-br from-orchid to-violet') : 'bg-soft/50 text-muted'}`}
                >
                  {c?.photo_url && <img src={c.photo_url} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />}
                  <span className={`relative ${c ? 'font-bold text-white [text-shadow:0_1px_3px_rgba(0,0,0,.6)]' : ''}`}>{day}</span>
                  {c && !c.photo_url && <CheckCircle2 className="absolute right-0.5 bottom-0.5 size-3 text-white" aria-hidden />}
                </button>
              )
            })}
          </motion.div>
        </AnimatePresence>
      </Card>

      {checkins && checkins.length === 0 && <EmptyState title="Nenhum treino neste mês" text="Treinou? Registre pelo botão Treinar ou pelo “+” da barra." />}

      <div className="mt-4 grid grid-cols-3 gap-2">
        {checkins?.map((c) => (
          <button key={c.id} onClick={() => setOpen(c)} className="relative aspect-[4/5] overflow-hidden rounded-2xl">
            {c.photo_url ? (
              <img src={c.photo_url} alt={`Foto do treino ${c.workout_name}`} loading="lazy" className="size-full object-cover" />
            ) : (
              <span className="flex size-full items-start justify-center bg-gradient-to-br from-orchid to-violet pt-4">
                <img src={`${theme.assets}/mascote.png`} alt="" className="size-14 rounded-full ring-2 ring-white/70" />
              </span>
            )}
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-scrim/70 to-transparent px-2 pt-6 pb-1.5 text-left text-xs font-semibold text-white">
              {parseIso(c.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} · {c.workout_name}
              {c.session && <span className="flex items-center gap-1 font-normal text-white/85"><Timer className="size-3" /> {durationLabel(c.session.duration_seconds)}</span>}
            </span>
          </button>
        ))}
      </div>

      <Sheet open={!!open} onClose={() => setOpen(null)} title={open?.workout_name}>
        {open && (
          <div className="space-y-4">
            <p className="-mt-1 text-sm text-muted first-letter:uppercase">
              {parseIso(open.date).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
              {' · '}
              {new Date(open.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </p>
            {open.photo_url && <img src={open.photo_url} alt={`Foto do treino ${open.workout_name}`} className="w-full rounded-2xl object-cover" />}
            {open.session && <SessionSummary session={open.session} />}
            {open.note && <p className="rounded-2xl bg-soft p-3 text-sm">{open.note}</p>}
            {open.onlySession && (
              <Button onClick={() => navigate(`/registrar-treino?sessao=${open.session!.id}`)}>
                <Camera className="size-5" /> Adicionar foto
              </Button>
            )}
            {!open.onlySession && open.session && open.photo_url && (
              <button onClick={() => removePhoto(open)} className="w-full py-1 text-sm font-semibold text-muted">Remover só a foto</button>
            )}
            <Button variant="danger" onClick={() => remove(open)}>
              <Trash2 className="size-5" /> Remover este treino
            </Button>
          </div>
        )}
      </Sheet>
    </div>
  )
}
