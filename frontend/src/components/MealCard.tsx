import { animate, AnimatePresence, motion, useMotionValue, type PanInfo } from 'framer-motion'
import { ChevronDown, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError } from '../lib/api'
import { addDays } from '../lib/date'
import { entryQtyLabel } from '../lib/nutrition'
import type { DayMeal, Entry } from '../lib/types'
import { fmt, fmtKcal } from './Ring'
import { useToast } from './Toast'
import { Card } from './ui'

/** Siglas dos macros e sódio de um conjunto de itens: "C 20g · P 15g · G 8g · Na 300mg" */
export function MacroLine({ entries, className = '' }: { entries: Entry[]; className?: string }) {
  const sum = (k: 'carbs' | 'protein' | 'fat' | 'sodium') => entries.reduce((a, e) => a + (e[k] ?? 0), 0)
  return (
    <span className={`flex flex-wrap gap-x-2.5 text-xs font-medium text-muted ${className}`}>
      <span>C {fmt(sum('carbs'))}g</span>
      <span>P {fmt(sum('protein'))}g</span>
      <span>G {fmt(sum('fat'))}g</span>
      <span>Na {fmtKcal(sum('sodium'))}mg</span>
    </span>
  )
}

/** Itens de uma refeição: deslizar exclui, tocar edita; com o horário do registro. */
function EntryList({ meal, onEdit, onRemove }: { meal: DayMeal; onEdit: (e: Entry) => void; onRemove: (e: Entry) => void }) {
  return (
    <motion.ul initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden border-t border-line">
      <AnimatePresence initial={false}>
        {meal.entries.map((e) => (
          <motion.li key={e.id} layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, height: 0 }}>
            <SwipeRow onTap={() => onEdit(e)} onDelete={() => onRemove(e)} label={e.name}>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{e.name}</p>
                <p className="truncate text-xs text-muted">
                  {e.time && <span className="font-semibold">{e.time} · </span>}
                  {entryQtyLabel(e)}
                </p>
              </div>
              <span className="shrink-0 text-sm text-muted">{fmtKcal(e.kcal)} kcal</span>
            </SwipeRow>
          </motion.li>
        ))}
      </AnimatePresence>
    </motion.ul>
  )
}

/**
 * Registrar refeição: o que já foi registrado nesta refeição hoje.
 * Recolhido por padrão (só o resumo); toque para ver os itens, editar ou excluir.
 */
export function MealHistory({ meal, onEdit, onChange }: { meal: DayMeal; onEdit: (e: Entry) => void; onChange: () => void }) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const empty = meal.entries.length === 0

  const remove = async (e: Entry) => {
    await api(`/entries/${e.id}`, { method: 'DELETE' }).catch(() => {})
    onChange()
    toast({ text: `${e.name.split(',')[0]} removido` })
  }

  if (empty) return <p className="px-1 text-sm text-muted">Nada registrado no {meal.name.toLowerCase()} hoje.</p>

  return (
    <Card className="!p-0">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
        <span className="min-w-0">
          <span className="block text-sm font-bold">
            Você já comeu no {meal.name.toLowerCase()}: {fmtKcal(meal.kcal)} kcal
          </span>
          <MacroLine entries={meal.entries} className="mt-0.5" />
        </span>
        <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-muted">
          {meal.entries.length} {meal.entries.length === 1 ? 'item' : 'itens'}
          <motion.span animate={{ rotate: open ? 180 : 0 }}>
            <ChevronDown className="size-5" />
          </motion.span>
        </span>
      </button>
      <AnimatePresence initial={false}>{open && <EntryList meal={meal} onEdit={onEdit} onRemove={remove} />}</AnimatePresence>
    </Card>
  )
}

export function MealCard({ meal, date, onEdit, onChange }: { meal: DayMeal; date: string; onEdit: (e: Entry) => void; onChange: () => void }) {
  const navigate = useNavigate()
  const toast = useToast()
  const [copying, setCopying] = useState(false)

  const copyYesterday = async () => {
    setCopying(true)
    try {
      const r = await api<{ copied: number }>('/entries/copy', {
        method: 'POST',
        body: { from_date: addDays(date, -1), from_meal_id: meal.id, to_date: date, to_meal_id: meal.id },
      })
      onChange()
      toast({ text: `${r.copied} ${r.copied === 1 ? 'item copiado' : 'itens copiados'} de ontem` })
    } catch (e) {
      toast({ text: (e as ApiError).field('from_date') ?? (e as ApiError).message })
    } finally {
      setCopying(false)
    }
  }

  const remove = async (e: Entry) => {
    await api(`/entries/${e.id}`, { method: 'DELETE' }).catch(() => {})
    onChange()
    toast({ text: `${e.name.split(',')[0]} removido` })
  }

  const add = () => navigate(`/adicionar?data=${date}&refeicao=${meal.id}`)
  const empty = meal.entries.length === 0

  return (
    <Card className="!p-0">
      {/* Refeição vazia: linha compacta (nome + adicionar); com itens: cabeçalho com o total */}
      <div className={`flex items-center justify-between gap-3 px-5 ${empty ? 'py-2.5' : 'py-4'}`}>
        {empty ? (
          <button onClick={add} className="min-w-0 flex-1 py-1 text-left font-semibold text-muted">
            {meal.name}
          </button>
        ) : (
          <div className="min-w-0">
            <p className="font-bold">{meal.name}</p>
            <p className="flex flex-wrap items-baseline gap-x-2.5 text-sm text-muted">
              <span className="font-semibold">{fmtKcal(meal.kcal)} kcal</span>
              <MacroLine entries={meal.entries} />
            </p>
          </div>
        )}
        <div className="flex shrink-0 items-center gap-2">
          {empty && meal.yesterday_count > 0 && (
            <button onClick={copyYesterday} disabled={copying} className="flex items-center gap-1 rounded-full bg-soft px-3 py-2 text-xs font-bold text-link active:scale-95 disabled:opacity-50">
              <RotateCcw className="size-3.5" /> Repetir de ontem
            </button>
          )}
          <button
            onClick={add}
            aria-label={`Adicionar em ${meal.name}`}
            className={`flex items-center justify-center rounded-full transition-transform active:scale-90 ${empty ? 'size-9 bg-soft text-link' : 'size-10 bg-primary text-white shadow-md'}`}
          >
            <Plus className="size-5" strokeWidth={2.75} />
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>{!empty && <EntryList meal={meal} onEdit={onEdit} onRemove={remove} />}</AnimatePresence>
    </Card>
  )
}

/**
 * Linha que desliza para a esquerda e revela "Excluir". Toque abre a edição.
 * Só desliza com gesto claramente horizontal (rolar a tela não mexe na linha)
 * e sempre volta para o lugar: aberta ou fechada, nunca "presa" no meio.
 */
function SwipeRow({ children, onTap, onDelete, label }: { children: ReactNode; onTap: () => void; onDelete: () => void; label: string }) {
  const [open, setOpen] = useState(false)
  const dragged = useRef(false)
  const x = useMotionValue(0)

  const settle = (next: boolean) => {
    setOpen(next)
    animate(x, next ? -96 : 0, { type: 'spring', stiffness: 500, damping: 40 })
  }

  const onDragEnd = (_: unknown, info: PanInfo) => {
    settle(info.offset.x < -60 || info.velocity.x < -500)
    setTimeout(() => (dragged.current = false), 0)
  }

  return (
    <div className="relative overflow-hidden">
      <button
        onClick={onDelete}
        tabIndex={open ? 0 : -1}
        aria-label={`Excluir ${label}`}
        className="absolute inset-y-0 right-0 flex w-24 items-center justify-center gap-1 bg-coral text-sm font-bold text-white"
      >
        <Trash2 className="size-4" /> Excluir
      </button>
      <motion.button
        style={{ x }}
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -96, right: 0 }}
        dragElastic={0.05}
        dragMomentum={false}
        onDragStart={() => (dragged.current = true)}
        onDragEnd={onDragEnd}
        onPointerCancel={() => settle(open)}
        onClick={() => {
          if (dragged.current) return
          if (open) settle(false)
          else onTap()
        }}
        className="relative flex w-full touch-pan-y items-center justify-between gap-3 bg-surface px-5 py-3 text-left"
      >
        {children}
      </motion.button>
    </div>
  )
}
