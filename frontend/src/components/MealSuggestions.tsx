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

  // Uma linha só, estilo secundário: o único botão cheio da tela é o "Registrar" do prato
  return (
    <button
      onClick={repeatLast}
      disabled={!!busy}
      title={data.last.items.map(short).join(' · ')}
      className="mb-4 flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-line px-4 py-3 text-left active:bg-soft disabled:opacity-60"
    >
      <RotateCcw className="size-5 shrink-0 text-link" />
      <span className="min-w-0 flex-1 truncate text-sm font-semibold">
        {busy === 'last' ? 'Repetindo…' : `Repetir o ${mealName.toLowerCase()} de ${dayName(data.last.date, isoDate())}`}
      </span>
      <span className="shrink-0 text-sm text-muted">{fmtKcal(data.last.kcal)} kcal</span>
    </button>
  )
}
