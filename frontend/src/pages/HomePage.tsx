import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { EntrySheet } from '../components/EntrySheet'
import { Bar, fmt, Ring } from '../components/Ring'
import { Sheet } from '../components/Sheet'
import { useToast } from '../components/Toast'
import { Alert, Button, Card, Field } from '../components/ui'
import { api, ApiError } from '../lib/api'
import { useAuth } from '../lib/auth'
import { addDays, dayLabel, isoDate } from '../lib/date'
import { entryQtyLabel, num } from '../lib/nutrition'
import type { DayData, DayMeal, Entry, WaterLog, WeightSummary } from '../lib/types'

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } }
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.28 } } }

export function HomePage() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const date = params.get('data') ?? isoDate()
  const setDate = (d: string) => setParams(d === isoDate() ? {} : { data: d }, { replace: true })

  const [day, setDay] = useState<DayData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Entry | null>(null)
  const [direction, setDirection] = useState(0)
  const dateInput = useRef<HTMLInputElement>(null)

  const load = useCallback(() => {
    setError(null)
    return api<DayData>(`/day/${date}`)
      .then(setDay)
      .catch((e: ApiError) => setError(e.message))
  }, [date])

  useEffect(() => {
    load()
  }, [load])

  const go = (n: number) => {
    setDirection(n)
    setDate(addDays(date, n))
  }

  const goal = day?.goal
  const target = day?.kcal_target ?? goal?.kcal ?? 0
  const t = day?.totals

  return (
    <div className="safe-top px-5 pt-5">
      {/* Cabeçalho com navegação de datas */}
      <header className="mb-4 flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-3">
          {/* Mascote: dá uma "flexionada" ao tocar */}
          <motion.img
            src="/mascote.png"
            alt=""
            width={52}
            height={52}
            className="size-13 shrink-0 rounded-full shadow-[0_4px_14px_-4px_rgba(155,63,168,0.45)]"
            initial={{ scale: 0.6, rotate: -12, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 14 }}
            whileTap={{ scale: 1.15, rotate: [0, -10, 10, -6, 0] }}
          />
          <div className="min-w-0">
          <p className="text-sm text-muted">Oi, {user?.name.split(' ')[0]} 💜</p>
          <div className="relative">
            <button onClick={() => dateInput.current?.showPicker?.()} className="text-2xl font-bold first-letter:uppercase">
              {dayLabel(date)}
            </button>
            <input
              ref={dateInput}
              type="date"
              aria-label="Escolher data"
              className="pointer-events-none absolute inset-0 opacity-0"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
            />
          </div>
          </div>
        </div>
        <div className="flex gap-2">
          <NavBtn label="Dia anterior" onClick={() => go(-1)}>‹</NavBtn>
          {date !== isoDate() && (
            <button onClick={() => setDate(isoDate())} className="rounded-full bg-soft px-3 text-sm font-semibold text-primary">
              Hoje
            </button>
          )}
          <NavBtn label="Próximo dia" onClick={() => go(1)}>›</NavBtn>
        </div>
      </header>

      {error && (
        <div className="mb-4 space-y-2">
          <Alert>{error}</Alert>
          <Button variant="ghost" onClick={load}>Tentar novamente</Button>
        </div>
      )}

      <AnimatePresence mode="wait" initial={false} custom={direction}>
        {day && goal && t && (
          <motion.div
            key={date}
            custom={direction}
            initial={{ opacity: 0, x: direction * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -40 }}
            transition={{ duration: 0.22 }}
          >
            <motion.div variants={container} initial="hidden" animate="show" className="space-y-4">
              <motion.div variants={item}>
                <Card className="flex flex-col items-center gap-5">
                  <Ring value={t.kcal} max={target} color="var(--color-orchid)">
                    <span className="text-3xl font-bold">{fmt(Math.abs(target - t.kcal))}</span>
                    <span className="text-sm text-muted">{t.kcal > target ? 'kcal acima' : 'kcal restantes'}</span>
                  </Ring>
                  <div className="grid w-full grid-cols-3 text-center text-sm">
                    <Stat value={t.kcal} label="consumidas" />
                    <Stat value={target} label={day.add_burned_to_goal && day.burned > 0 ? 'meta + treino' : 'meta'} />
                    <Stat value={day.burned} label="gastas no treino" prefix="🔥 ~" />
                  </div>
                  <div className="w-full space-y-3">
                    <Bar label="Carboidratos" value={t.carbs} max={goal.carbs_g} unit="g" color="var(--color-lavender)" />
                    <Bar label="Proteínas" value={t.protein} max={goal.protein_g} unit="g" color="var(--color-pink)" />
                    <Bar label="Gorduras" value={t.fat} max={goal.fat_g} unit="g" color="var(--color-violet)" />
                    <Bar label="Sódio" value={t.sodium} max={goal.sodium_mg} unit="mg" color="var(--color-coral)" />
                  </div>
                </Card>
              </motion.div>

              <motion.div variants={item}>
                <WaterCard date={date} total={t.water} goal={goal.water_ml} logs={day.water} onChange={load} />
              </motion.div>

              <motion.div variants={item}>
                <WeightMini />
              </motion.div>

              <motion.div variants={item} className="space-y-3 pb-6">
                <div className="flex items-center justify-between px-1 pt-2">
                  <h2 className="font-semibold">Refeições do dia</h2>
                  <Link
                    to="/refeicoes"
                    aria-label="Editar refeições (renomear, reordenar, ocultar)"
                    title="Editar refeições"
                    className="flex size-9 items-center justify-center rounded-full text-primary transition-colors hover:bg-soft active:scale-90"
                  >
                    <svg className="size-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden>
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
                    </svg>
                  </Link>
                </div>
                {day.meals.map((m) => (
                  <MealCard key={m.id} meal={m} date={date} onEdit={setEditing} onChange={load} />
                ))}
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <EntrySheet entry={editing} meals={day?.meals ?? []} onClose={() => setEditing(null)} onChanged={load} />
    </div>
  )
}

/** Card resumido do peso com atalho para registrar. */
function WeightMini() {
  const [s, setS] = useState<WeightSummary | null>(null)
  useEffect(() => {
    api<{ summary: WeightSummary }>('/weights?range=30').then((r) => setS(r.summary)).catch(() => {})
  }, [])
  if (!s) return null
  const kg = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

  return (
    <Card className="flex items-center justify-between !py-4">
      <Link to="/progresso" className="min-w-0">
        <p className="text-sm text-muted">Peso</p>
        <p className="font-semibold">
          {s.current !== null ? `${kg(s.current)} kg` : 'Ainda sem registro'}
          {s.change_total !== null && s.change_total !== 0 && (
            <span className="ml-2 text-sm font-normal text-muted">
              {s.change_total > 0 ? '+' : '−'}
              {kg(Math.abs(s.change_total))} kg desde o início
            </span>
          )}
        </p>
      </Link>
      <Link to="/progresso?registrar=1" className="shrink-0 rounded-full bg-soft px-4 py-2 text-sm font-semibold text-primary active:scale-95">
        Registrar
      </Link>
    </Card>
  )
}

function NavBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button aria-label={label} onClick={onClick} className="flex size-10 items-center justify-center rounded-full bg-surface text-2xl text-primary shadow-sm transition-transform active:scale-90">
      {children}
    </button>
  )
}

function Stat({ value, label, prefix = '' }: { value: number; label: string; prefix?: string }) {
  return (
    <div>
      <p className="font-semibold">
        {value > 0 ? prefix : ''}
        {fmt(value)}
      </p>
      <p className="text-muted">{label}</p>
    </div>
  )
}

function WaterCard({ date, total, goal, logs, onChange }: { date: string; total: number; goal: number; logs: WaterLog[]; onChange: () => void }) {
  const toast = useToast()
  const [custom, setCustom] = useState(false)
  const [ml, setMl] = useState('')
  const [busy, setBusy] = useState(false)
  const pct = goal > 0 ? Math.min(total / goal, 1) : 0

  const add = async (amount: number) => {
    if (!(amount > 0)) return
    setBusy(true)
    try {
      const r = await api<{ water: WaterLog }>('/water', { method: 'POST', body: { date, ml: amount } })
      onChange()
      toast({ text: `+${amount} ml de água`, action: { label: 'Desfazer', run: () => undo(r.water.id) } })
    } catch (e) {
      toast({ text: (e as ApiError).message })
    } finally {
      setBusy(false)
    }
  }

  const undo = async (id: number) => {
    await api(`/water/${id}`, { method: 'DELETE' }).catch(() => {})
    onChange()
  }

  const last = logs[logs.length - 1]

  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Água</h2>
          <p className="text-sm text-muted">
            {fmt(total)} / {fmt(goal)} ml
          </p>
        </div>
        <span className="text-2xl" aria-hidden>💧</span>
      </div>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-soft">
        <motion.div className="h-full rounded-full bg-water" animate={{ width: `${pct * 100}%` }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} />
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2">
        {[200, 300, 500].map((v) => (
          <button key={v} disabled={busy} onClick={() => add(v)} className="h-11 rounded-xl bg-water/10 text-sm font-semibold text-[#4a63a8] transition-transform active:scale-95 disabled:opacity-50">
            +{v}
          </button>
        ))}
        <button onClick={() => setCustom(true)} className="h-11 rounded-xl bg-soft text-sm font-semibold text-primary active:scale-95">
          Outro
        </button>
      </div>
      {last && (
        <button onClick={() => undo(last.id)} className="mt-3 text-xs font-medium text-muted underline-offset-2 hover:underline">
          Desfazer último (+{last.ml} ml)
        </button>
      )}

      <Sheet open={custom} onClose={() => setCustom(false)} title="Adicionar água">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            add(Math.round(num(ml)))
            setCustom(false)
            setMl('')
          }}
        >
          <Field label="Quantidade" name="water_ml" suffix="ml" inputMode="numeric" autoFocus value={ml} onChange={(e) => setMl(e.target.value.replace(/\D/g, ''))} />
          <Button type="submit" disabled={!(num(ml) > 0)}>Adicionar</Button>
        </form>
      </Sheet>
    </Card>
  )
}

function MealCard({ meal, date, onEdit, onChange }: { meal: DayMeal; date: string; onEdit: (e: Entry) => void; onChange: () => void }) {
  const navigate = useNavigate()
  const toast = useToast()
  const [menu, setMenu] = useState(false)
  const [copyError, setCopyError] = useState<string | null>(null)

  const copyYesterday = async () => {
    setCopyError(null)
    try {
      const r = await api<{ copied: number }>('/entries/copy', {
        method: 'POST',
        body: { from_date: addDays(date, -1), from_meal_id: meal.id, to_date: date, to_meal_id: meal.id },
      })
      setMenu(false)
      onChange()
      toast({ text: `${r.copied} ${r.copied === 1 ? 'item copiado' : 'itens copiados'} de ontem` })
    } catch (e) {
      setCopyError((e as ApiError).field('from_date') ?? (e as ApiError).message)
    }
  }

  const add = () => navigate(`/adicionar?data=${date}&refeicao=${meal.id}`)

  return (
    <Card className="!p-0">
      <div className="flex items-center justify-between px-5 py-4">
        <button onClick={() => setMenu(true)} className="text-left">
          <p className="font-semibold">{meal.name}</p>
          <p className="text-sm text-muted">{fmt(meal.kcal)} kcal</p>
        </button>
        <button onClick={add} aria-label={`Adicionar em ${meal.name}`} className="flex size-10 items-center justify-center rounded-full bg-primary text-2xl leading-none text-white shadow-md transition-transform active:scale-90">
          +
        </button>
      </div>

      <AnimatePresence initial={false}>
        {meal.entries.length > 0 && (
          <motion.ul initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden border-t border-line">
            <AnimatePresence initial={false}>
              {meal.entries.map((e) => (
                <motion.li key={e.id} layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, height: 0 }}>
                  <button onClick={() => onEdit(e)} className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left transition-colors hover:bg-soft/60 active:bg-soft">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{e.name}</p>
                      <p className="truncate text-xs text-muted">{entryQtyLabel(e)}</p>
                    </div>
                    <span className="shrink-0 text-sm text-muted">{fmt(e.kcal)} kcal</span>
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
          </motion.ul>
        )}
      </AnimatePresence>

      <Sheet open={menu} onClose={() => setMenu(false)} title={meal.name}>
        <div className="space-y-3">
          {copyError && <Alert>{copyError}</Alert>}
          <Button variant="ghost" onClick={add}>Adicionar alimento</Button>
          <Button variant="ghost" onClick={copyYesterday}>Repetir de ontem</Button>
        </div>
      </Sheet>
    </Card>
  )
}
