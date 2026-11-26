import { RotateCcw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api, ApiError } from '../lib/api'
import { isoDate, parseIso } from '../lib/date'
import type { Entry } from '../lib/types'
import { fmtKcal } from './Ring'
import { useToast } from './Toast'

interface Suggestions {
  last: { date: string; kcal: number; items: string[] } | null
}

const short = (name: string) => name.split(',')[0]

/** "ontem", "sexta-feira" ou "12/11" */
function dayName(date: string, today: string) {
  const diff = Math.round((parseIso(today).getTime() - parseIso(date).getTime()) / 86_400_000)
  if (diff === 1) return 'ontem'
  if (diff < 7) return parseIso(date).toLocaleDateString('pt-BR', { weekday: 'long' })
  return parseIso(date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

/**
 * Repetir a refeição da última vez com 1 toque (com Desfazer no aviso).
 */
export function MealSuggestions({ mealId, mealName, date, refreshKey, onAdded, onRemoved }: {
  mealId: number
  mealName: string
  date: string
  refreshKey: number
  /** Itens registrados (para a barra "itens adicionados" e o desfazer) */
  onAdded: (entries: Entry[]) => void
  /** Desfeitos pelo aviso */
  onRemoved: (ids: number[]) => void
}) {
  const toast = useToast()
  const [data, setData] = useState<Suggestions | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    if (!mealId) return
    api<Suggestions>(`/meals/${mealId}/suggestions?date=${date}`).then(setData).catch(() => setData(null))
  }, [mealId, date, refreshKey])

  if (!data?.last) return null

  const repeatLast = async () => {
    setBusy('last')
    try {
      const r = await api<{ entries: Entry[] }>('/entries/copy', { method: 'POST', body: { from_date: data.last!.date, from_meal_id: mealId, to_date: date, to_meal_id: mealId } })
      onAdded(r.entries)
      toast({
        text: `${mealName} registrado ✓`,
        action: { label: 'Desfazer', run: () => Promise.all(r.entries.map((e) => api(`/entries/${e.id}`, { method: 'DELETE' }))).then(() => onRemoved(r.entries.map((e) => e.id))).catch(() => {}) },
      })
    } catch (e) {
      toast({ text: (e as ApiError).message })
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="mb-5">
      <p className="mb-2 px-1 text-xs font-bold tracking-wide text-muted uppercase">Seu {mealName.toLowerCase()} de sempre</p>

      {(
        <div className="flex items-center gap-3 rounded-[var(--radius-card)] bg-surface p-4 shadow-[0_2px_12px_-4px_rgba(31,23,36,0.08)]">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-orchid/15 text-primary">
            <RotateCcw className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">Igual a {dayName(data.last.date, isoDate())}</p>
            <p className="truncate text-xs text-muted">{data.last.items.map(short).join(' · ')}</p>
            <p className="text-xs font-semibold text-primary">{fmtKcal(data.last.kcal)} kcal</p>
          </div>
          <button onClick={repeatLast} disabled={!!busy} className="h-10 shrink-0 rounded-xl bg-primary px-4 text-sm font-bold text-white active:scale-95 disabled:opacity-60">
            {busy === 'last' ? '…' : 'Registrar'}
          </button>
        </div>
      )}

    </section>
  )
}
