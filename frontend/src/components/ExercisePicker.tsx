import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState, type FormEvent } from 'react'
import { ExerciseImage } from './ExerciseImage'
import { Sheet } from './Sheet'
import { Alert, BackButton, Button, Field } from './ui'
import { api, ApiError } from '../lib/api'
import type { Exercise } from '../lib/types'

interface Props {
  open: boolean
  onClose: () => void
  onPick: (e: Exercise) => void
}

/** Biblioteca de exercícios em tela cheia: filtro por grupo muscular + busca + criar personalizado. */
export function ExercisePicker({ open, onClose, onPick }: Props) {
  const [groups, setGroups] = useState<Record<string, string>>({})
  const [group, setGroup] = useState<string>('')
  const [q, setQ] = useState('')
  const [list, setList] = useState<Exercise[] | null>(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!open) return
    const id = setTimeout(() => {
      const params = new URLSearchParams({ ...(group ? { group } : {}), ...(q.trim() ? { q: q.trim() } : {}) })
      api<{ groups: Record<string, string>; exercises: Exercise[] }>(`/exercises?${params}`).then((r) => {
        setGroups(r.groups)
        setList(r.exercises)
      })
    }, 200)
    return () => clearTimeout(id)
  }, [open, group, q])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-40 overflow-y-auto bg-bg"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 380, damping: 38 }}
        >
          <div className="safe-top mx-auto max-w-lg px-5 pt-4 pb-10">
            <header className="mb-4 flex items-center gap-3">
              <BackButton onClick={onClose} label="Fechar" icon="close" />
              <h2 className="text-xl font-bold">Adicionar exercício</h2>
            </header>

            <input
              type="search"
              placeholder="Buscar exercício (ex.: supino, agachamento)"
              aria-label="Buscar exercício"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="mb-3 h-12 w-full rounded-2xl border border-line bg-surface px-4 outline-none focus:border-orchid focus:ring-4 focus:ring-orchid/15"
            />

            <div className="-mx-5 mb-4 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
              {[['', 'Todos'], ...Object.entries(groups)].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setGroup(key)}
                  className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${group === key ? 'bg-primary text-white' : 'bg-surface text-muted'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {!list && <div className="h-64 animate-pulse rounded-2xl bg-soft" />}
            {list && list.length === 0 && <p className="py-8 text-center text-sm text-muted">Nenhum exercício encontrado.</p>}
            <ul className="space-y-2">
              {list?.map((e) => (
                <li key={e.id}>
                  <button onClick={() => onPick(e)} className="flex w-full items-center gap-3 rounded-2xl bg-surface p-2 pr-4 text-left shadow-[0_2px_12px_-4px_rgba(31,23,36,0.08)] active:bg-soft">
                    <ExerciseImage image={e.image} name={e.name} size={56} animate={false} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{e.name}</p>
                      <p className="text-xs text-muted">
                        {groups[e.muscle_group] ?? e.muscle_group}
                        {e.user_id ? ' · meu' : ''}
                      </p>
                    </div>
                    <span className="text-xl text-primary">+</span>
                  </button>
                </li>
              ))}
            </ul>

            <button onClick={() => setCreating(true)} className="mt-6 w-full rounded-2xl border-2 border-dashed border-line py-4 text-sm font-semibold text-primary">
              + Criar exercício personalizado
            </button>
          </div>

          <CreateExerciseSheet
            open={creating}
            groups={groups}
            initialName={q}
            initialGroup={group}
            onClose={() => setCreating(false)}
            onCreated={(e) => {
              setCreating(false)
              onPick(e)
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function CreateExerciseSheet({ open, groups, initialName, initialGroup, onClose, onCreated }: {
  open: boolean
  groups: Record<string, string>
  initialName: string
  initialGroup: string
  onClose: () => void
  onCreated: (e: Exercise) => void
}) {
  const [name, setName] = useState('')
  const [group, setGroup] = useState('')
  const [error, setError] = useState<ApiError | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setName(initialName)
      setGroup(initialGroup || 'gluteos')
      setError(null)
    }
  }, [open, initialName, initialGroup])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const r = await api<{ exercise: Exercise }>('/exercises', { method: 'POST', body: { name: name.trim(), muscle_group: group } })
      onCreated(r.exercise)
    } catch (err) {
      setError(err as ApiError)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Novo exercício">
      <form onSubmit={submit} className="space-y-4">
        {error && !error.field('name') && <Alert>{error.message}</Alert>}
        <Field label="Nome" name="exercise_name" required value={name} onChange={(e) => setName(e.target.value)} error={error?.field('name')} />
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-muted">Grupo muscular</span>
          <select value={group} onChange={(e) => setGroup(e.target.value)} className="h-12 w-full rounded-2xl border border-line bg-surface px-4 outline-none focus:border-orchid">
            {Object.entries(groups).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>
        <Button type="submit" loading={saving} disabled={!name.trim()}>Criar e adicionar</Button>
      </form>
    </Sheet>
  )
}
