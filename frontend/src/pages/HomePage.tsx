import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, ChevronLeft, ChevronRight, Droplet, Dumbbell, Flame, Pencil, Scale, Utensils } from 'lucide-react'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { DeficitCard } from '../components/DeficitCard'
import { FirstSteps } from '../components/FirstSteps'
import { EntrySheet } from '../components/EntrySheet'
import { MealCard } from '../components/MealCard'
import { fmtAmount, groupByName, NUTRIENTS, RankBars } from '../components/NutrientBreakdown'
import { openTrain, QuickTile } from '../components/Layout'
import { Bar, Ring, fmt, fmtKcal } from '../components/Ring'
import { Sheet } from '../components/Sheet'
import { useToast } from '../components/Toast'
import { Alert, Button, Card, Field } from '../components/ui'
import { api, ApiError } from '../lib/api'
import { useAuth } from '../lib/auth'
import { addDays, dayLabel, isoDate, parseIso } from '../lib/date'
import { num } from '../lib/nutrition'
import { mealForNow } from '../lib/meals'
import { useTheme } from '../lib/theme'
import type { DayData, Entry, WaterLog, WeightSummary } from '../lib/types'

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } }
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.28 } } }
const MACROS_KEY = 'dt_macros_open'

export function HomePage() {
  const { theme } = useTheme()
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const date = params.get('data') ?? isoDate()
  const setDate = (d: string) => setParams(d === isoDate() ? {} : { data: d }, { replace: true })

  const [day, setDay] = useState<DayData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Entry | null>(null)
  const [direction, setDirection] = useState(0)
  const [macrosOpen, setMacrosOpen] = useState(() => localStorage.getItem(MACROS_KEY) === '1')
  const [weekRefresh, setWeekRefresh] = useState(0)
  const [breakdownOpen, setBreakdownOpen] = useState(false)

  const load = useCallback(() => {
    setError(null)
    return api<DayData>(`/day/${date}`)
      .then((d) => {
        setDay(d)
        setWeekRefresh((k) => k + 1)
      })
      .catch((e: ApiError) => setError(e.message))
  }, [date])

  useEffect(() => {
    load()
  }, [load])

  // Atualiza quando algo é registrado pelo botão "+" (ex.: água)
  useEffect(() => {
    const onChanged = () => load()
    window.addEventListener('dt:changed', onChanged)
    return () => window.removeEventListener('dt:changed', onChanged)
  }, [load])

  const go = (d: string) => {
    setDirection(d > date ? 1 : -1)
    setDate(d)
  }

  const toggleMacros = () => {
    setMacrosOpen((o) => {
      localStorage.setItem(MACROS_KEY, o ? '0' : '1')
      return !o
    })
  }

  const goal = day?.goal
  const target = day?.kcal_target ?? goal?.kcal ?? 0
  const t = day?.totals
  const loaded = day && day.date === date

  return (
    <div className="safe-top px-5 pt-5">
      {/* Cabeçalho */}
      <header className="mb-3 flex items-center gap-3">
        <Link to="/ajustes" aria-label="Seu perfil e ajustes" className="shrink-0">
          <motion.div key={`${theme.id}-${user?.avatar_url ?? ''}`} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 320, damping: 14 }} whileTap={{ scale: 1.1 }}>
            <Avatar size={52} />
          </motion.div>
        </Link>
        <div className="min-w-0">
          <p className="text-sm text-muted">
            Oi, {user?.name.split(' ')[0]} {theme.heart}
          </p>
          <h1 className="text-2xl font-extrabold first-letter:uppercase">{dayLabel(date)}</h1>
        </div>
      </header>

      {/* Faixa da semana: toque no dia; pontinho = dia com registro */}
      <WeekStrip date={date} onPick={go} refreshKey={weekRefresh} />

      {error && (
        <div className="mb-4 space-y-2">
          <Alert>{error}</Alert>
          <Button variant="ghost" onClick={load}>Tentar novamente</Button>
        </div>
      )}

      {!loaded && !error && <HomeSkeleton />}

      <AnimatePresence mode="wait" initial={false} custom={direction}>
        {loaded && goal && t && (
          <motion.div
            key={date}
            custom={direction}
            initial={{ opacity: 0, x: direction * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -40 }}
            transition={{ duration: 0.22 }}
          >
            <motion.div variants={container} initial="hidden" animate="show" className="space-y-4">
              {/* Primeiros dias: guia de 3 passos */}
              {date === isoDate() && (
                <motion.div variants={item} className="empty:hidden">
                  <FirstSteps day={day} />
                </motion.div>
              )}

              {/* Atalhos: treinar, refeição do momento e água */}
              {date <= isoDate() && (
                <motion.div variants={item}>
                  <QuickCards day={day} date={date} />
                </motion.div>
              )}

              <motion.div variants={item}>
                <Card className="flex flex-col items-center gap-5">
                  <Ring value={t.kcal} max={target} size={140} stroke={11} color="var(--color-orchid)">
                    <span className="text-3xl font-extrabold">{fmtKcal(Math.abs(target - t.kcal))}</span>
                    <span className="text-sm text-muted">{t.kcal > target ? 'kcal acima' : 'kcal restantes'}</span>
                  </Ring>
                  <div className="grid w-full grid-cols-3 text-center text-sm">
                    <Stat value={t.kcal} label="consumidas" />
                    <Stat value={target} label={day.add_burned_to_goal && day.burned > 0 ? 'meta + treino' : 'meta'} />
                    <Stat value={day.burned} label="gastas no treino" prefix="~" icon={<Flame className="size-4 text-coral" />} />
                  </div>

                  {/* Macros recolhíveis (preferência salva no aparelho) */}
                  <div className="w-full">
                    <button onClick={toggleMacros} aria-expanded={macrosOpen} className="flex w-full items-center justify-between rounded-xl px-1 py-1 text-sm font-semibold text-muted">
                      {macrosOpen ? (
                        'Macros, sódio e fibras'
                      ) : (
                        <span className="flex gap-3 text-xs font-medium">
                          <span>C {fmt(t.carbs)}g</span>
                          <span>P {fmt(t.protein)}g</span>
                          <span>G {fmt(t.fat)}g</span>
                          <span>Na {fmtKcal(t.sodium)}mg</span>
                          <span>Fib {fmt(t.fiber)}g</span>
                        </span>
                      )}
                      <motion.span animate={{ rotate: macrosOpen ? 180 : 0 }}>
                        <ChevronDown className="size-5" />
                      </motion.span>
                    </button>
                    <AnimatePresence initial={false}>
                      {macrosOpen && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                          {/* Tocar nas barras abre de onde vieram os nutrientes do dia */}
                          <button onClick={() => setBreakdownOpen(true)} className="block w-full space-y-3 rounded-2xl pt-3 text-left active:bg-soft/50">
                            <Bar label="Carboidratos" value={t.carbs} max={goal.carbs_g} unit="g" color="var(--color-lavender)" />
                            <Bar label="Proteínas" value={t.protein} max={goal.protein_g} unit="g" color="var(--color-pink)" />
                            <Bar label="Gorduras" value={t.fat} max={goal.fat_g} unit="g" color="var(--color-violet)" />
                            <Bar label="Sódio" value={t.sodium} max={goal.sodium_mg} unit="mg" color="var(--color-coral)" />
                            <Bar label="Fibras" value={t.fiber} max={goal.fiber_g || 25} unit="g" color="var(--color-fiber)" atLeast />
                            {t.kcal > 0 && (
                              <span className="flex items-center justify-center gap-1 pt-1 text-sm font-semibold text-link">
                                Ver de onde vieram <ChevronRight className="size-4" />
                              </span>
                            )}
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </Card>
              </motion.div>

              <motion.div variants={item}>
                <WaterCard date={date} total={t.water} goal={goal.water_ml} logs={day.water} onChange={load} />
              </motion.div>

              {/* Déficit calórico (gasto estimado − consumido); não faz sentido em dias futuros */}
              {day.energy && date <= isoDate() && (
                <motion.div variants={item}>
                  <DeficitCard energy={day.energy} consumed={t.kcal} isToday={date === isoDate()} goalKcal={target} burned={day.burned} />
                </motion.div>
              )}

              {/* Refeições logo após o resumo: é a ação mais usada */}
              <motion.div variants={item} className="space-y-3">
                <div className="flex items-center justify-between px-1 pt-1">
                  <h2 className="text-xs font-bold tracking-wider text-muted uppercase">Refeições do dia</h2>
                  <Link
                    to="/refeicoes"
                    aria-label="Organizar refeições do dia (renomear, reordenar, ocultar)"
                    title="Organizar refeições"
                    className="flex size-9 items-center justify-center rounded-full text-link transition-colors hover:bg-soft active:scale-90"
                  >
                    <Pencil className="size-5" />
                  </Link>
                </div>
                {day.meals.map((m) => (
                  <MealCard key={m.id} meal={m} date={date} onEdit={setEditing} onChange={load} />
                ))}
              </motion.div>


              <motion.div variants={item} className="pb-6">
                <WeightMini />
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Sheet open={breakdownOpen && !!day} onClose={() => setBreakdownOpen(false)} title="De onde vieram seus nutrientes">
        {day && <DayBreakdown day={day} />}
      </Sheet>
      <EntrySheet entry={editing} meals={day?.meals ?? []} onClose={() => setEditing(null)} onChanged={load} />
    </div>
  )
}

/* ───────────── De onde vieram os nutrientes do dia ───────────── */

function DayBreakdown({ day }: { day: DayData }) {
  const rows = groupByName(day.meals.flatMap((m) => m.entries))
  if (rows.length === 0) return <p className="py-6 text-center text-sm text-muted">Registre uma refeição para ver de onde vêm seus nutrientes.</p>
  return (
    <div className="space-y-6">
      <p className="-mt-1 text-sm text-muted">Quais alimentos mais pesaram em cada nutriente hoje.</p>
      {NUTRIENTS.map((n) => {
        const total = rows.reduce((a, r) => a + (r[n.key] || 0), 0)
        return (
          <section key={n.key}>
            <div className="mb-2 flex items-baseline justify-between">
              <h3 className="flex items-center gap-2 text-sm font-bold">
                <span className="size-2.5 rounded-full" style={{ background: n.color }} aria-hidden />
                {n.label}
              </h3>
              <span className="text-sm font-semibold text-muted">{fmtAmount(total, n.unit)}</span>
            </div>
            <RankBars rows={rows} nutrient={n.key} limit={3} />
          </section>
        )
      })}
    </div>
  )
}

/* ───────────── Atalhos ───────────── */


function QuickCards({ day, date }: { day: DayData; date: string }) {
  const navigate = useNavigate()
  const meal = mealForNow(day.meals)
  const isToday = date === isoDate()
  const trained = day.trainings.length > 0

  return (
    <div className="grid grid-cols-2 gap-2">
      <QuickTile icon={Dumbbell} label="Treinar" hint={trained ? `${day.trainings.length === 1 ? 'Feito' : `${day.trainings.length} feitos`} ✓` : isToday ? 'Agora ou já feito' : 'Registrar'} done={trained} onClick={openTrain} />
      <QuickTile
        icon={Utensils}
        label="Registrar refeição"
        hint={meal ? (meal.kcal > 0 ? `${meal.name} · ${fmtKcal(meal.kcal)} kcal` : meal.name) : 'Adicionar'}
        onClick={() => navigate(`/adicionar?${new URLSearchParams({ ...(meal ? { refeicao: String(meal.id) } : {}), ...(isToday ? {} : { data: date }) })}`)}
      />
    </div>
  )
}

/* ───────────── Faixa da semana ───────────── */

const WD = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

function WeekStrip({ date, onPick, refreshKey }: { date: string; onPick: (d: string) => void; refreshKey: number }) {
  const sel = parseIso(date)
  const start = addDays(date, -sel.getDay()) // domingo
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))
  const today = isoDate()
  const [marks, setMarks] = useState<Record<string, { entries: number; workout: boolean }>>({})

  useEffect(() => {
    api<{ days: Record<string, { entries: number; workout: boolean }> }>(`/calendar?from=${days[0]}&to=${days[6]}`)
      .then((r) => setMarks(r.days))
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, refreshKey])

  return (
    <div className="mb-4 flex items-center gap-1">
      <button aria-label="Semana anterior" onClick={() => onPick(addDays(date, -7))} className="flex size-8 shrink-0 items-center justify-center rounded-full text-link active:scale-90">
        <ChevronLeft className="size-5" />
      </button>
      <div className="grid flex-1 grid-cols-7 gap-1">
        {days.map((d, i) => {
          const active = d === date
          const m = marks[d]
          return (
            <button
              key={d}
              onClick={() => onPick(d)}
              aria-label={parseIso(d).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
              aria-current={active ? 'date' : undefined}
              className={`relative flex flex-col items-center rounded-2xl py-1.5 transition-colors ${active ? 'bg-primary text-white shadow-md' : d === today ? 'bg-soft text-link' : 'text-ink'}`}
            >
              <span className={`text-xs font-semibold ${active ? 'text-white/80' : 'text-muted'}`}>{WD[i]}</span>
              <span className="text-base font-bold">{parseIso(d).getDate()}</span>
              <span className="mt-0.5 flex h-1.5 gap-0.5" aria-hidden>
                {m?.entries ? <span className={`size-1.5 rounded-full ${active ? 'bg-white' : 'bg-orchid'}`} /> : null}
                {m?.workout ? <span className={`size-1.5 rounded-full ${active ? 'bg-white/70' : 'bg-violet'}`} /> : null}
              </span>
            </button>
          )
        })}
      </div>
      <button aria-label="Próxima semana" onClick={() => onPick(addDays(date, 7))} className="flex size-8 shrink-0 items-center justify-center rounded-full text-link active:scale-90">
        <ChevronRight className="size-5" />
      </button>
    </div>
  )
}

/* ───────────── Carregamento ───────────── */

function HomeSkeleton() {
  const block = 'animate-pulse rounded-[var(--radius-card)] bg-soft'
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Carregando">
      <div className={`${block} flex h-80 flex-col items-center justify-center gap-4`}>
        <div className="size-44 rounded-full border-[14px] border-line" />
        <div className="h-3 w-2/3 rounded-full bg-line" />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className={`${block} h-20`} style={{ animationDelay: `${i * 120}ms` }} />
      ))}
    </div>
  )
}

/* ───────────── Peso ───────────── */

function WeightMini() {
  const [s, setS] = useState<WeightSummary | null>(null)
  useEffect(() => {
    api<{ summary: WeightSummary }>('/weights?range=30').then((r) => setS(r.summary)).catch(() => {})
  }, [])
  if (!s) return null
  const kg = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

  return (
    <Card className="flex items-center justify-between gap-3 !py-4">
      <Link to="/progresso?aba=peso" className="flex min-w-0 items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-soft text-link">
          <Scale className="size-5" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm text-muted">Peso</span>
          <span className="block font-semibold">
            {s.current !== null ? `${kg(s.current)} kg` : 'Ainda sem registro'}
            {s.change_total !== null && s.change_total !== 0 && (
              <span className="ml-2 text-sm font-normal text-muted">
                {s.change_total > 0 ? '+' : '−'}
                {kg(Math.abs(s.change_total))} kg
              </span>
            )}
          </span>
        </span>
      </Link>
      <Link to="/progresso?aba=peso&registrar=1" className="shrink-0 rounded-full bg-soft px-4 py-2 text-sm font-semibold text-link active:scale-95">
        Registrar
      </Link>
    </Card>
  )
}

function Stat({ value, label, prefix = '', icon }: { value: number; label: string; prefix?: string; icon?: ReactNode }) {
  return (
    <div>
      <p className="flex items-center justify-center gap-1 font-bold">
        {icon}
        {value > 0 ? prefix : ''}
        {fmtKcal(value)}
      </p>
      <p className="text-muted">{label}</p>
    </div>
  )
}

/* ───────────── Água ───────────── */

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
          <h2 className="font-bold">Água</h2>
          <p className="text-sm text-muted">
            {fmt(total)} / {fmt(goal)} ml
          </p>
        </div>
        <Droplet className="size-7 fill-water/25 text-water" aria-hidden />
      </div>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-soft">
        <motion.div className="h-full rounded-full bg-water" animate={{ width: `${pct * 100}%` }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} />
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2">
        {[200, 300, 500].map((v) => (
          <button key={v} disabled={busy} onClick={() => add(v)} className="h-11 rounded-xl bg-water/15 text-sm font-bold text-water-ink transition-transform active:scale-95 disabled:opacity-50">
            +{v}
          </button>
        ))}
        <button onClick={() => setCustom(true)} className="h-11 rounded-xl bg-soft text-sm font-bold text-link active:scale-95">
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
