import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Sheet } from '../components/Sheet'
import { useToast } from '../components/Toast'
import { WeeklyGoalSheet } from '../components/WeeklyGoalSheet'
import { WeightChart } from '../components/WeightChart'
import { Bar, Ring, fmt, fmtKcal } from '../components/Ring'
import { Activity, CalendarCheck, ChevronLeft, ChevronRight, Droplet, Flame, Info, Pencil, Target, Timer, TrendingDown, TrendingUp } from 'lucide-react'
import { Alert, Button, Card, EmptyState, Field } from '../components/ui'
import { api, ApiError } from '../lib/api'
import { addDays, isoDate, parseIso } from '../lib/date'
import { num } from '../lib/nutrition'
import type { Energy, Goal, Weight, WeightSummary } from '../lib/types'
import { HIGH_LIMIT, inGoal as inGoalDay, LOW_LIMIT, modeOf, outlier, RANGE } from '../lib/goalDays'

const RANGES = [
  ['30', '30 dias'],
  ['90', '90 dias'],
  ['365', '1 ano'],
  ['all', 'Tudo'],
] as const

const kg = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${kg(Math.abs(n))} kg`
const shortDate = (s: string) => parseIso(s).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace('.', '')
const longDate = (s: string) => parseIso(s).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' }).replace('.', '')

/** Aba Peso: peso atual, variação, gráfico por período e histórico. */
function WeightTab() {
  const [params, setParams] = useSearchParams()
  const [range, setRange] = useState<string>('90')
  const [weights, setWeights] = useState<Weight[] | null>(null)
  const [summary, setSummary] = useState<WeightSummary | null>(null)
  const [editing, setEditing] = useState<Weight | 'new' | null>(params.get('registrar') ? 'new' : null)

  const load = useCallback(() => {
    api<{ weights: Weight[]; summary: WeightSummary }>(`/weights?range=${range}`).then((r) => {
      setWeights(r.weights)
      setSummary(r.summary)
    })
  }, [range])

  useEffect(load, [load])

  const close = () => {
    setEditing(null)
    if (params.get('registrar')) setParams({ aba: 'peso' }, { replace: true })
  }

  const empty = summary && summary.current === null

  return (
    <div className="space-y-4">
      {empty ? (
        <Card>
          <EmptyState title="Acompanhe seu peso" text="Registre hoje e veja sua evolução no gráfico.">
            <Button onClick={() => setEditing('new')}>Registrar peso</Button>
          </EmptyState>
        </Card>
      ) : (
        summary && (
          <>
            {/* Número em destaque + variações */}
            <Card>
              <p className="text-sm text-muted">Peso atual</p>
              <div className="flex items-end justify-between gap-3">
                <p className="text-4xl font-bold tracking-tight">
                  {kg(summary.current!)} <span className="text-lg font-semibold text-muted">kg</span>
                </p>
                <Button className="!h-10 !w-auto !px-4 text-sm" onClick={() => setEditing('new')}>+ Registrar</Button>
              </div>
              <p className="mt-1 text-xs text-muted">em {longDate(summary.current_date!)}</p>
              {summary.start_date === summary.current_date ? (
                // Só um registro: comparar não faz sentido ainda
                <p className="mt-4 rounded-2xl bg-soft p-3 text-sm text-muted">Primeiro registro feito! Registre de novo em alguns dias para ver sua evolução aqui.</p>
              ) : (
                <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                  <Delta label="Desde o início" value={summary.change_total} hint={summary.start !== null ? `de ${kg(summary.start)} kg · ${shortDate(summary.start_date!)}` : ''} />
                  <Delta label="No período" value={summary.change_range} hint={RANGES.find((r) => r[0] === range)?.[1] ?? ''} />
                </div>
              )}
            </Card>

            <Card>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold">Evolução do peso</h2>
              </div>
              <div className="mb-4 flex gap-1 rounded-2xl bg-soft p-1" role="tablist" aria-label="Período">
                {RANGES.map(([k, label]) => (
                  <button key={k} role="tab" aria-selected={range === k} onClick={() => setRange(k)} className="relative flex-1 rounded-xl py-2 text-xs font-semibold">
                    {range === k && <motion.span layoutId="range-pill" className="absolute inset-0 rounded-xl bg-surface shadow-sm" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
                    <span className={`relative ${range === k ? 'text-primary' : 'text-muted'}`}>{label}</span>
                  </button>
                ))}
              </div>
              {weights && weights.length > 0 ? (
                <WeightChart key={range} data={weights} />
              ) : (
                <p className="py-10 text-center text-sm text-muted">Sem registros neste período.</p>
              )}
            </Card>

            {/* Histórico (também serve de visão em tabela do gráfico) */}
            <div>
              <h2 className="mb-2 px-1 font-semibold">Histórico</h2>
              <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] bg-surface shadow-[0_2px_12px_-4px_rgba(31,23,36,0.08)]">
                <AnimatePresence initial={false}>
                  {[...(weights ?? [])].reverse().map((w, i, arr) => {
                    const prev = arr[i + 1]
                    const diff = prev ? Math.round((w.kg - prev.kg) * 10) / 10 : null
                    return (
                      <motion.li key={w.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }}>
                        <button onClick={() => setEditing(w)} className="flex w-full items-center justify-between px-4 py-3.5 text-left active:bg-soft">
                          <span className="text-sm">{longDate(w.date)}</span>
                          <span className="flex items-baseline gap-3">
                            {diff !== null && diff !== 0 && <span className="text-xs text-muted">{signed(diff)}</span>}
                            <span className="font-semibold">{kg(w.kg)} kg</span>
                          </span>
                        </button>
                      </motion.li>
                    )
                  })}
                </AnimatePresence>
              </ul>
            </div>
          </>
        )
      )}

      <WeightSheet
        weight={editing}
        onClose={close}
        onSaved={() => {
          close()
          load()
        }}
      />
    </div>
  )
}

function Delta({ label, value, hint }: { label: string; value: number | null; hint: string }) {
  return (
    <div className="rounded-2xl bg-soft p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-lg font-bold">{value === null ? '—' : signed(value)}</p>
      <p className="truncate text-xs text-muted">{hint}</p>
    </div>
  )
}

/** Registrar/editar peso (um por dia: registrar de novo no mesmo dia substitui). */
function WeightSheet({ weight, onClose, onSaved }: { weight: Weight | 'new' | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [value, setValue] = useState('')
  const [date, setDate] = useState(isoDate())
  const [error, setError] = useState<ApiError | null>(null)
  const [busy, setBusy] = useState<'save' | 'delete' | null>(null)
  const existing = weight && weight !== 'new' ? weight : null

  useEffect(() => {
    if (!weight) return
    setError(null)
    setValue(existing ? String(existing.kg).replace('.', ',') : '')
    setDate(existing ? existing.date : isoDate())
  }, [weight, existing])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy('save')
    setError(null)
    try {
      await api(existing ? `/weights/${existing.id}` : '/weights', { method: existing ? 'PUT' : 'POST', body: { date, kg: num(value) } })
      toast({ text: 'Peso registrado ✓' })
      onSaved()
    } catch (err) {
      setError(err as ApiError)
    } finally {
      setBusy(null)
    }
  }

  const remove = async () => {
    if (!existing) return
    setBusy('delete')
    await api(`/weights/${existing.id}`, { method: 'DELETE' }).catch(() => {})
    setBusy(null)
    toast({ text: 'Registro excluído' })
    onSaved()
  }

  return (
    <Sheet open={!!weight} onClose={onClose} title={existing ? 'Editar peso' : 'Registrar peso'}>
      <form onSubmit={submit} className="space-y-4">
        {error && !error.field('kg') && !error.field('date') && <Alert>{error.message}</Alert>}
        <div className="flex h-20 items-center justify-center rounded-2xl border border-line bg-surface focus-within:border-orchid focus-within:ring-4 focus-within:ring-orchid/15">
          <input
            aria-label="Peso em quilos"
            inputMode="decimal"
            autoFocus
            placeholder="0,0"
            className="w-32 bg-transparent text-center text-4xl font-bold outline-none placeholder:text-line"
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/[^\d.,]/g, '').slice(0, 5))}
          />
          <span className="text-xl font-semibold text-muted">kg</span>
        </div>
        {error?.field('kg') && <p className="-mt-2 text-center text-sm text-danger">{error.field('kg')}</p>}
        <Field label="Data" name="weight_date" type="date" max={isoDate()} value={date} onChange={(e) => setDate(e.target.value)} error={error?.field('date')} />
        <Button type="submit" loading={busy === 'save'} disabled={!(num(value) > 0)}>
          Salvar
        </Button>
        {existing && (
          <Button type="button" variant="danger" onClick={remove} loading={busy === 'delete'}>
            Excluir registro
          </Button>
        )}
      </form>
    </Sheet>
  )
}

/* ───────────────────────── Página ───────────────────────── */

const TABS = [
  ['semana', 'Semana'],
  ['treinos', 'Treinos'],
  ['peso', 'Peso'],
] as const

/** Progresso: resumo da semana (alimentação), treinos e peso. */
export function ProgressPage() {
  const [params, setParams] = useSearchParams()
  const tab = (TABS.find((t) => t[0] === params.get('aba'))?.[0] ?? 'semana') as (typeof TABS)[number][0]

  return (
    <div className="safe-top space-y-4 px-5 pt-6 pb-6">
      <h1 className="text-2xl font-extrabold">Progresso</h1>
      <div className="flex gap-1 rounded-2xl bg-soft p-1" role="tablist" aria-label="Seções do progresso">
        {TABS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setParams({ aba: k }, { replace: true })} className="relative flex-1 rounded-xl py-2.5 text-sm font-bold">
            {tab === k && <motion.span layoutId="progress-tab" className="absolute inset-0 rounded-xl bg-surface shadow-sm" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
            <span className={`relative ${tab === k ? 'text-primary' : 'text-muted'}`}>{label}</span>
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
          {tab === 'semana' ? <WeekTab /> : tab === 'treinos' ? <WorkoutsTab /> : <WeightTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

/* ───────────────────────── Semana (alimentação) ───────────────────────── */

interface WeekDay {
  date: string
  logged: boolean
  kcal: number
  carbs: number
  protein: number
  fat: number
  sodium: number
  fiber: number
  water: number
  burned: number
  get: number | null // gasto estimado do dia (se o perfil estiver completo)
  goal: { kcal: number; carbs_g: number; protein_g: number; fat_g: number; sodium_mg: number; fiber_g: number; water_ml: number } | null
}

const WD = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

function WeekTab() {
  const [start, setStart] = useState(() => {
    const t = isoDate()
    return addDays(t, -parseIso(t).getDay())
  })
  const [days, setDays] = useState<WeekDay[] | null>(null)
  const [energy, setEnergy] = useState<Energy | null>(null)

  useEffect(() => {
    setDays(null)
    api<{ days: WeekDay[]; energy: Energy }>(`/stats/week?start=${start}`)
      .then((r) => {
        setDays(r.days)
        setEnergy(r.energy)
      })
      .catch(() => setDays([]))
  }, [start])

  const thisWeek = start === addDays(isoDate(), -parseIso(isoDate()).getDay())
  const end = addDays(start, 6)
  const title = thisWeek ? 'Esta semana' : `${shortDate(start)} – ${shortDate(end)}`

  const logged = days?.filter((d) => d.logged) ?? []
  const avg = (k: keyof Pick<WeekDay, 'kcal' | 'carbs' | 'protein' | 'fat' | 'sodium' | 'fiber' | 'water'>) =>
    logged.length ? logged.reduce((a, d) => a + d[k], 0) / logged.length : 0
  const goal = days?.find((d) => d.goal)?.goal ?? null
  // Só dias encerrados: hoje ainda está em andamento (ex.: de manhã sempre estaria "até a meta")
  const closed = logged.filter((d) => d.goal && d.date < isoDate())
  const goalDays = closed.filter((d) => inGoalDay(d.kcal, d.goal!)).length
  const outliers = closed.filter((d) => outlier(d.kcal, d.goal!)).length
  const burned = days?.reduce((a, d) => a + d.burned, 0) ?? 0
  const max = Math.max(goal?.kcal ?? 0, ...(days ?? []).map((d) => d.kcal), 1)
  const waterDays = days?.filter((d) => d.water > 0) ?? []
  // Só dias já encerrados: hoje ainda está em andamento e inflaria o déficit
  const withGet = logged.filter((d) => d.get != null && d.date < isoDate())
  const todayPending = logged.some((d) => d.get != null && d.date === isoDate())
  const deficitTotal = withGet.reduce((a, d) => a + (d.get! - d.kcal), 0)
  const waterAvg = waterDays.length ? waterDays.reduce((a, d) => a + d.water, 0) / waterDays.length : 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button aria-label="Semana anterior" onClick={() => setStart(addDays(start, -7))} className="flex size-9 items-center justify-center rounded-full bg-surface text-primary shadow-sm active:scale-90">
          <ChevronLeft className="size-5" />
        </button>
        <p className="font-bold">{title}</p>
        <button aria-label="Próxima semana" disabled={thisWeek} onClick={() => setStart(addDays(start, 7))} className="flex size-9 items-center justify-center rounded-full bg-surface text-primary shadow-sm active:scale-90 disabled:opacity-30">
          <ChevronRight className="size-5" />
        </button>
      </div>

      {!days && <div className="h-64 animate-pulse rounded-[var(--radius-card)] bg-soft" />}
      {days && logged.length === 0 && (
        <Card>
          <EmptyState title="Nada registrado nesta semana" text="Registre suas refeições para ver médias e quantos dias você ficou dentro da meta." />
        </Card>
      )}

      {days && logged.length > 0 && (
        <>
          {goal && closed.length > 0 && <GoalDaysCard inGoal={goalDays} logged={closed.length} outliers={outliers} goal={days!.filter((d) => d.goal).at(-1)!.goal!} />}

          <div className="grid grid-cols-2 gap-2 text-center">
            <MiniStat icon={<Flame className="size-4 text-orchid" />} value={`${fmtKcal(avg('kcal'))} kcal`} label="comidas por dia, em média" />
            <MiniStat icon={<Flame className="size-4 text-coral" />} value={`~${fmtKcal(burned)} kcal`} label="gastas nos treinos da semana" />
          </div>

          {/* Balanço da semana: soma de (gasto estimado − consumido) nos dias já encerrados */}
          {withGet.length > 0 ? (
            <WeekBalanceCard balance={deficitTotal} days={withGet.length} />
          ) : todayPending ? (
            <p className="rounded-2xl bg-soft p-3 text-sm text-muted">O balanço da semana usa só os dias que já terminaram. O de hoje você acompanha na tela inicial.</p>
          ) : (
            energy && !energy.available && (
              <Link to="/ajustes?abrir=dados" className="flex items-center gap-2 rounded-2xl bg-soft p-3 text-sm font-semibold text-primary">
                <Activity className="size-4" /> Complete seus dados para ver se comeu mais ou menos do que gastou <ChevronRight className="ml-auto size-4 shrink-0" />
              </Link>
            )
          )}

          {/* Calorias por dia × meta */}
          <Card>
            <p className="mb-3 text-sm font-bold">Calorias por dia</p>
            <div className="relative flex h-40 items-end gap-2" role="img" aria-label={`Calorias por dia; meta ${goal ? fmtKcal(goal.kcal) : '-'} kcal`}>
              {goal && (
                <div className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-muted/40" style={{ bottom: `${(goal.kcal / max) * 100}%` }}>
                  <span className="absolute -top-5 right-0 text-xs font-semibold text-muted">meta {fmtKcal(goal.kcal)}</span>
                </div>
              )}
              {days.map((d, i) => {
                const over = d.goal && d.kcal > d.goal.kcal * 1.1
                return (
                  <div key={d.date} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                    <motion.div
                      className="w-full rounded-t-lg"
                      style={{ background: over ? 'var(--color-coral)' : 'var(--color-orchid)', opacity: d.logged ? 1 : 0.15 }}
                      initial={{ height: 0 }}
                      animate={{ height: `${Math.max((d.kcal / max) * 100, d.logged ? 3 : 2)}%` }}
                      transition={{ duration: 0.6, delay: i * 0.04 }}
                      title={`${fmtKcal(d.kcal)} kcal`}
                    />
                  </div>
                )
              })}
            </div>
            <div className="mt-1 flex gap-2">
              {days.map((d, i) => (
                <span key={d.date} className={`flex-1 text-center text-xs font-semibold ${d.date === isoDate() ? 'text-primary' : 'text-muted'}`}>{WD[i]}</span>
              ))}
            </div>
          </Card>

          {/* Médias dos macros nos dias registrados */}
          {goal && (
            <Card className="space-y-3">
              <p className="text-sm font-bold">Média por dia registrado</p>
              <Bar label="Carboidratos" value={Math.round(avg('carbs'))} max={goal.carbs_g} unit="g" color="var(--color-lavender)" />
              <Bar label="Proteínas" value={Math.round(avg('protein'))} max={goal.protein_g} unit="g" color="var(--color-pink)" />
              <Bar label="Gorduras" value={Math.round(avg('fat'))} max={goal.fat_g} unit="g" color="var(--color-violet)" />
              <Bar label="Sódio" value={Math.round(avg('sodium'))} max={goal.sodium_mg} unit="mg" color="var(--color-coral)" />
              <Bar label="Fibras" value={Math.round(avg('fiber') * 10) / 10} max={goal.fiber_g || 25} unit="g" color="var(--color-fiber)" atLeast />
              <div className="flex items-center gap-2 pt-1 text-sm text-muted">
                <Droplet className="size-4 text-water" /> Água: {fmt(Math.round(waterAvg))} ml/dia em média (meta {fmt(goal.water_ml)} ml)
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

/* ───────────────────────── Treinos ───────────────────────── */

interface WeekWorkouts {
  week_start: string
  days: number
  minutes: number
  kcal: number
}

function WorkoutsTab() {
  const [data, setData] = useState<{ weeks: WeekWorkouts[]; weekly_goal: number } | null>(null)
  const [goalOpen, setGoalOpen] = useState(false)

  useEffect(() => {
    api<{ weeks: WeekWorkouts[]; weekly_goal: number }>('/stats/workouts?weeks=8').then(setData).catch(() => setData({ weeks: [], weekly_goal: 3 }))
  }, [])

  if (!data) return <div className="h-64 animate-pulse rounded-[var(--radius-card)] bg-soft" />
  const current = data.weeks[data.weeks.length - 1]
  const total = data.weeks.reduce((a, w) => ({ days: a.days + w.days, minutes: a.minutes + w.minutes, kcal: a.kcal + w.kcal }), { days: 0, minutes: 0, kcal: 0 })
  const max = Math.max(data.weekly_goal, ...data.weeks.map((w) => w.days), 1)
  const hit = data.weeks.filter((w) => w.days >= data.weekly_goal).length

  if (total.days === 0)
    return (
      <Card>
        <EmptyState title="Seus treinos aparecem aqui" text="Use “Treinar” na aba Treinos para registrar e acompanhar sua frequência.">
          <Link to="/treinos?treinar=1" className="flex h-11 items-center justify-center rounded-2xl bg-primary font-bold text-white">Treinar</Link>
          <button onClick={() => setGoalOpen(true)} className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-soft px-3 py-1 text-xs font-bold text-primary">
            Meta: {data.weekly_goal} {data.weekly_goal === 1 ? 'treino' : 'treinos'} por semana <Pencil className="size-3" />
          </button>
        </EmptyState>
        <WeeklyGoalSheet open={goalOpen} onClose={() => setGoalOpen(false)} value={data.weekly_goal} onSaved={(n) => setData((d) => (d ? { ...d, weekly_goal: n } : d))} />
      </Card>
    )

  return (
    <div className="space-y-4">
      <Card className="flex items-center gap-4">
        <Ring value={Math.min(current?.days ?? 0, data.weekly_goal)} max={data.weekly_goal} size={96} stroke={10} color="var(--color-orchid)">
          <span className="text-xl font-extrabold">{current?.days ?? 0}/{data.weekly_goal}</span>
          <span className="text-xs text-muted">treinos</span>
        </Ring>
        <div className="min-w-0">
          <p className="font-bold">{(current?.days ?? 0) >= data.weekly_goal ? 'Meta da semana batida! 🎉' : `Faltam ${data.weekly_goal - (current?.days ?? 0)} treino(s) nesta semana`}</p>
          {hit > 0 && <p className="text-sm text-muted">Meta batida em {hit} das últimas {data.weeks.length} semanas.</p>}
          <button onClick={() => setGoalOpen(true)} className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-soft px-3 py-1 text-xs font-bold text-primary">
            Meta: {data.weekly_goal} {data.weekly_goal === 1 ? 'treino' : 'treinos'} por semana <Pencil className="size-3" />
          </button>
        </div>
      </Card>
      <WeeklyGoalSheet open={goalOpen} onClose={() => setGoalOpen(false)} value={data.weekly_goal} onSaved={(n) => setData((d) => (d ? { ...d, weekly_goal: n } : d))} />

      <div className="grid grid-cols-3 gap-2 text-center">
        <MiniStat icon={<CalendarCheck className="size-4 text-primary" />} value={String(total.days)} label="dias em 8 semanas" />
        <MiniStat icon={<Timer className="size-4 text-primary" />} value={total.minutes < 60 ? `${Math.round(total.minutes)} min` : `${(total.minutes / 60).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h`} label="de treino" />
        <MiniStat icon={<Flame className="size-4 text-coral" />} value={`~${fmtKcal(total.kcal)}`} label="kcal gastas" />
      </div>

      <Card>
        <p className="mb-3 text-sm font-bold">Dias treinados por semana</p>
        <div className="relative flex h-36 items-end gap-2" role="img" aria-label={`Dias treinados por semana nas últimas ${data.weeks.length} semanas; meta ${data.weekly_goal}`}>
          <div className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-muted/40" style={{ bottom: `${(data.weekly_goal / max) * 100}%` }}>
            <span className="absolute -top-5 right-0 text-xs font-semibold text-muted">meta {data.weekly_goal}</span>
          </div>
          {data.weeks.map((w, i) => (
            <div key={w.week_start} className="flex h-full flex-1 flex-col items-center justify-end">
              <span className="mb-1 text-xs font-bold">{w.days || ''}</span>
              <motion.div
                className="w-full rounded-t-lg"
                style={{ background: w.days >= data.weekly_goal ? 'var(--color-orchid)' : 'var(--color-lavender)', opacity: w.days ? 1 : 0.15 }}
                initial={{ height: 0 }}
                animate={{ height: `${Math.max((w.days / max) * 100, 3)}%` }}
                transition={{ duration: 0.6, delay: i * 0.04 }}
              />
            </div>
          ))}
        </div>
        <div className="mt-1 flex gap-2">
          {data.weeks.map((w, i) => (
            <span key={w.week_start} className={`flex-1 text-center text-xs font-semibold ${i === data.weeks.length - 1 ? 'text-primary' : 'text-muted'}`}>
              {i === data.weeks.length - 1 ? 'esta' : shortDate(w.week_start)}
            </span>
          ))}
        </div>
      </Card>

      <Link to="/historico-treinos" className="block text-center text-sm font-bold text-primary">Ver histórico de treinos</Link>
    </div>
  )
}

function MiniStat({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
  return (
    <Card className="!p-3">
      <p className="flex items-center justify-center gap-1 text-lg font-extrabold">{icon}{value}</p>
      <p className="text-xs leading-tight text-muted">{label}</p>
    </Card>
  )
}

/** Botão ⓘ que abre uma explicação em linguagem simples. */
function InfoButton({ title, children, label }: { title: string; children: ReactNode; label: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)} aria-label={label} className="-m-2 flex size-10 shrink-0 items-center justify-center rounded-full text-muted active:bg-soft">
        <Info className="size-5" />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={title}>
        <div className="space-y-3 text-sm text-muted [&_strong]:text-ink">{children}</div>
        <Button className="mt-5" onClick={() => setOpen(false)}>Entendi</Button>
      </Sheet>
    </>
  )
}

/** Quantos dias (já encerrados) ficaram na meta de calorias, do jeito que a meta conta o dia. */
function GoalDaysCard({ inGoal, logged, outliers, goal }: { inGoal: number; logged: number; outliers: number; goal: Goal }) {
  const mode = modeOf(goal)
  const k = goal.kcal
  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-soft text-primary">
          <Target className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xl font-extrabold">
            {inGoal} de {logged} {logged === 1 ? 'dia' : 'dias'}
          </p>
          <p className="text-sm text-muted">
            {mode === 'max' ? 'até a meta de calorias' : mode === 'min' ? 'com pelo menos a meta de calorias' : 'com calorias perto da meta'}
          </p>
        </div>
        <InfoButton title="Dias na meta de calorias" label="O que são dias na meta de calorias?">
          {mode === 'max' && (
            <>
              <p>Sua meta é para <strong>emagrecer</strong>: o dia conta quando você comeu <strong>até {fmtKcal(k)} kcal</strong>.</p>
              <p>Comer bem menos que isso não é melhor: abaixo de <strong>{fmtKcal(k * LOW_LIMIT)} kcal</strong> avisamos, porque atrapalha a energia, os treinos e a massa muscular.</p>
            </>
          )}
          {mode === 'min' && (
            <>
              <p>Sua meta é para <strong>ganhar massa</strong>: o dia conta quando você comeu <strong>pelo menos {fmtKcal(k)} kcal</strong>.</p>
              <p>Passar muito também não ajuda: acima de <strong>{fmtKcal(k * HIGH_LIMIT)} kcal</strong> avisamos, porque o excesso tende a virar gordura.</p>
            </>
          )}
          {mode === 'range' && (
            <p>
              Sua meta é para <strong>manter o peso</strong>: o dia conta quando você comeu perto dela, entre <strong>{fmtKcal(k * (1 - RANGE))}</strong> e{' '}
              <strong>{fmtKcal(k * (1 + RANGE))} kcal</strong>.
            </p>
          )}
          <p>Só entram os dias já encerrados em que você registrou alguma refeição. Dá para mudar o jeito de contar em Metas diárias.</p>
        </InfoButton>
      </div>
      {outliers > 0 && (
        <p className="rounded-2xl bg-coral/10 px-3 py-2 text-sm">
          {mode === 'max'
            ? `${outliers} ${outliers === 1 ? 'dia ficou' : 'dias ficaram'} bem abaixo da meta (menos de ${fmtKcal(k * LOW_LIMIT)} kcal). Comer pouco demais atrapalha o resultado.`
            : `${outliers} ${outliers === 1 ? 'dia passou' : 'dias passaram'} bem da meta (mais de ${fmtKcal(k * HIGH_LIMIT)} kcal).`}
        </p>
      )}
    </Card>
  )
}

/** Comeu mais ou menos do que gastou na semana, sem jargão. Positivo = comeu menos (déficit). */
function WeekBalanceCard({ balance, days }: { balance: number; days: number }) {
  const ateLess = balance >= 0
  const kg = (Math.abs(balance) / 7700).toLocaleString('pt-BR', { maximumFractionDigits: 2 })
  return (
    <Card className="space-y-3">
      <div className="flex items-start gap-3">
        <span className={`flex size-11 shrink-0 items-center justify-center rounded-full ${ateLess ? 'bg-fiber/15 text-fiber' : 'bg-coral/15 text-coral'}`}>
          {ateLess ? <TrendingDown className="size-5" /> : <TrendingUp className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-muted">Balanço da semana</p>
          <p className="text-lg leading-snug font-extrabold">
            Você comeu {fmtKcal(Math.abs(balance))} kcal {ateLess ? 'a menos' : 'a mais'} do que gastou
          </p>
        </div>
        <InfoButton title="Balanço da semana" label="Como funciona o balanço da semana?">
          <p>
            Comparamos <strong>o que você comeu</strong> com <strong>o quanto seu corpo gastou</strong>. O gasto é estimado pelo seu peso, altura,
            idade e por quantas vezes você treina por semana.
          </p>
          <p>
            <strong>Comeu menos do que gastou</strong> (déficit calórico): o corpo usa reservas e a tendência é <strong>perder peso</strong>.
          </p>
          <p>
            <strong>Comeu mais do que gastou</strong> (superávit calórico): a tendência é <strong>ganhar peso</strong>, ou massa muscular se você
            treina força.
          </p>
          <p>
            Só entram os dias que já terminaram e têm refeições registradas. Cerca de 7.700 kcal equivalem a 1 kg de gordura.
          </p>
          <p className="text-xs">É uma estimativa e não substitui a orientação de um nutricionista.</p>
        </InfoButton>
      </div>
      <p className="rounded-xl bg-soft px-3 py-2 text-sm text-muted">
        {ateLess ? 'Isso ajuda a perder' : 'Isso tende a somar'} cerca de <strong className="text-ink">{kg} kg</strong> de gordura · média de{' '}
        {fmtKcal(Math.abs(balance) / days)} kcal por dia em {days} {days === 1 ? 'dia completo' : 'dias completos'}
      </p>
    </Card>
  )
}
