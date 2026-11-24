import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sheet } from '../components/Sheet'
import { useToast } from '../components/Toast'
import { Button, Card } from '../components/ui'
import { api } from '../lib/api'
import { isoDate, parseIso } from '../lib/date'
import type { Checkin, CheckinStats } from '../lib/types'
import { SessionSummary } from '../components/SessionSummary'
import { durationLabel } from '../lib/run'

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

const shiftMonth = (m: string, n: number) => {
  const d = parseIso(`${m}-01`)
  d.setMonth(d.getMonth() + n)
  return isoDate(d).slice(0, 7)
}

/** Histórico de check-ins: calendário do mês com as fotos + estatísticas. */
export function CheckinsPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [month, setMonth] = useState(isoDate().slice(0, 7))
  const [checkins, setCheckins] = useState<Checkin[] | null>(null)
  const [stats, setStats] = useState<CheckinStats | null>(null)
  const [open, setOpen] = useState<Checkin | null>(null)
  const [dir, setDir] = useState(0)

  const load = useCallback(() => {
    setCheckins(null)
    api<{ checkins: Checkin[]; stats: CheckinStats }>(`/checkins?month=${month}`).then((r) => {
      setCheckins(r.checkins)
      setStats(r.stats)
    })
  }, [month])

  useEffect(load, [load])

  const byDay = useMemo(() => {
    const map: Record<string, Checkin[]> = {}
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

  const remove = async (c: Checkin) => {
    if (!confirm('Excluir este check-in e a foto?')) return
    await api(`/checkins/${c.id}`, { method: 'DELETE' })
    setOpen(null)
    toast({ text: 'Check-in excluído' })
    load()
  }

  return (
    <div className="safe-top mx-auto max-w-lg px-5 pt-4 pb-10">
      <header className="mb-5 flex items-center gap-3">
        <button onClick={() => navigate(-1)} aria-label="Voltar" className="flex size-10 items-center justify-center rounded-full bg-surface text-2xl text-primary shadow-sm">
          ‹
        </button>
        <h1 className="text-xl font-bold">Meus check-ins</h1>
      </header>

      {stats && (
        <div className="mb-4 grid grid-cols-3 gap-2 text-center">
          {[
            ['🔥', stats.streak, stats.streak === 1 ? 'dia seguido' : 'dias seguidos'],
            ['📅', stats.month_count, stats.month_count === 1 ? 'check-in no mês' : 'check-ins no mês'],
            ['🏆', stats.total_count, 'no total'],
          ].map(([icon, v, l]) => (
            <Card key={String(l)} className="!p-3">
              <p className="text-xl font-bold text-primary">
                {icon} {v}
              </p>
              <p className="text-xs text-muted">{l}</p>
            </Card>
          ))}
        </div>
      )}

      <Card className="!p-4">
        <div className="mb-3 flex items-center justify-between">
          <button aria-label="Mês anterior" onClick={() => go(-1)} className="flex size-9 items-center justify-center rounded-full bg-soft text-xl text-primary">‹</button>
          <p className="font-semibold first-letter:uppercase">{title}</p>
          <button aria-label="Próximo mês" onClick={() => go(1)} disabled={month >= today.slice(0, 7)} className="flex size-9 items-center justify-center rounded-full bg-soft text-xl text-primary disabled:opacity-30">›</button>
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
                  className={`relative aspect-square overflow-hidden rounded-xl text-sm ${date === today ? 'ring-2 ring-orchid' : ''} ${c ? '' : 'bg-soft/50 text-muted'}`}
                >
                  {c && <img src={c.photo_url} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />}
                  <span className={`relative ${c ? 'font-bold text-white [text-shadow:0_1px_3px_rgba(0,0,0,.6)]' : ''}`}>{day}</span>
                </button>
              )
            })}
          </motion.div>
        </AnimatePresence>
      </Card>

      {checkins && checkins.length === 0 && <p className="py-6 text-center text-sm text-muted">Nenhum check-in neste mês.</p>}

      <div className="mt-4 grid grid-cols-3 gap-2">
        {checkins?.map((c) => (
          <button key={c.id} onClick={() => setOpen(c)} className="relative aspect-[4/5] overflow-hidden rounded-2xl">
            <img src={c.photo_url} alt={`Check-in ${c.workout_name}`} loading="lazy" className="size-full object-cover" />
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/70 to-transparent px-2 pt-6 pb-1.5 text-left text-[11px] font-semibold text-white">
              {parseIso(c.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} · {c.workout_name}
              {c.session && <span className="block font-normal text-white/85">⏱️ {durationLabel(c.session.duration_seconds)}</span>}
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
            <img src={open.photo_url} alt={`Foto do check-in ${open.workout_name}`} className="w-full rounded-2xl object-cover" />
            {open.session && <SessionSummary session={open.session} />}
            {open.note && <p className="rounded-2xl bg-soft p-3 text-sm">{open.note}</p>}
            <Button variant="danger" onClick={() => remove(open)}>Excluir check-in</Button>
          </div>
        )}
      </Sheet>
    </div>
  )
}
