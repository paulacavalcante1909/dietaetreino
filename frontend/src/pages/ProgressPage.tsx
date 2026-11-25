import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Sheet } from '../components/Sheet'
import { useToast } from '../components/Toast'
import { WeightChart } from '../components/WeightChart'
import { Alert, Button, Card, Field } from '../components/ui'
import { api, ApiError } from '../lib/api'
import { isoDate, parseIso } from '../lib/date'
import { num } from '../lib/nutrition'
import type { Weight, WeightSummary } from '../lib/types'

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

/** Progresso: peso atual, variação, gráfico por período e histórico. */
export function ProgressPage() {
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
    if (params.get('registrar')) setParams({}, { replace: true })
  }

  const empty = summary && summary.current === null

  return (
    <div className="safe-top space-y-4 px-5 pt-6 pb-6">
      <h1 className="text-2xl font-bold">Progresso</h1>

      {empty ? (
        <Card className="py-10 text-center">
          <p className="text-4xl">⚖️</p>
          <p className="mt-3 font-medium">Acompanhe seu peso</p>
          <p className="mt-1 text-sm text-muted">Registre hoje e veja sua evolução no gráfico.</p>
          <Button className="mt-5" onClick={() => setEditing('new')}>Registrar peso</Button>
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
              <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <Delta label="Desde o início" value={summary.change_total} hint={summary.start !== null ? `de ${kg(summary.start)} kg · ${shortDate(summary.start_date!)}` : ''} />
                <Delta label="No período" value={summary.change_range} hint={RANGES.find((r) => r[0] === range)?.[1] ?? ''} />
              </div>
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
      <p className="truncate text-[11px] text-muted">{hint}</p>
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
