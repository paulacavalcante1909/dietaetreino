import { AnimatePresence, motion } from 'framer-motion'
import { ChartLine, Check, Droplet, Dumbbell, House, Plus, Scale, Settings, Utensils, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate, useOutlet } from 'react-router-dom'
import { Sheet } from './Sheet'
import { TrainSheet } from './TrainSheet'
import { useToast } from './Toast'
import { api, ApiError } from '../lib/api'
import { isoDate } from '../lib/date'
import { mealForNow } from '../lib/meals'
import type { Meal } from '../lib/types'

const tabs = [
  { to: '/', label: 'Hoje', icon: House },
  { to: '/treinos', label: 'Treinos', icon: Dumbbell },
  null, // espaço do botão central "+"
  { to: '/progresso', label: 'Progresso', icon: ChartLine },
  { to: '/ajustes', label: 'Ajustes', icon: Settings },
]

/** Avisa as telas abertas que algo mudou (ex.: água adicionada pelo "+"). */
export const notifyChanged = () => window.dispatchEvent(new Event('dt:changed'))

/** Abre a folha "Treinar" de qualquer tela. */
export const openTrain = () => window.dispatchEvent(new Event('dt:train'))

/** Shell com navegação inferior, botão central de ações rápidas e transição entre abas. */
export function Layout() {
  const location = useLocation()
  const outlet = useOutlet()
  const mainRef = useRef<HTMLElement>(null)
  const [quick, setQuick] = useState(false)
  const [train, setTrain] = useState(false)

  useEffect(() => {
    const onTrain = () => setTrain(true)
    window.addEventListener('dt:train', onTrain)
    return () => window.removeEventListener('dt:train', onTrain)
  }, [])

  // Cada aba abre no topo
  useEffect(() => {
    window.scrollTo(0, 0)
    mainRef.current?.scrollTo(0, 0)
  }, [location.pathname])

  return (
    <div className="mx-auto flex h-full max-w-lg flex-col">
      <main ref={mainRef} className="relative flex-1 overflow-y-auto overflow-x-hidden pb-28">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            {outlet}
          </motion.div>
        </AnimatePresence>
      </main>

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/90 backdrop-blur-lg">
        <div className="relative mx-auto flex max-w-lg">
          {tabs.map((tab, i) =>
            tab ? (
              <NavLink key={tab.to} to={tab.to} end={tab.to === '/'} className="relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-semibold">
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <motion.span layoutId="tab-pill" className="absolute top-1.5 h-8 w-14 rounded-full bg-orchid/15" transition={{ type: 'spring', stiffness: 500, damping: 35 }} />
                    )}
                    <tab.icon className={`relative size-6 transition-colors ${isActive ? 'text-primary' : 'text-muted'}`} strokeWidth={isActive ? 2.4 : 2} />
                    <span className={isActive ? 'text-primary' : 'text-muted'}>{tab.label}</span>
                  </>
                )}
              </NavLink>
            ) : (
              <div key={i} className="flex flex-1 justify-center">
                <motion.button
                  onClick={() => setQuick(true)}
                  aria-label="Registrar: treino, alimento, água ou peso"
                  whileTap={{ scale: 0.9 }}
                  animate={{ rotate: quick ? 45 : 0 }}
                  className="-mt-6 flex size-14 items-center justify-center rounded-full bg-primary text-white shadow-lg ring-4 ring-bg"
                >
                  <Plus className="size-7" strokeWidth={2.75} />
                </motion.button>
              </div>
            ),
          )}
        </div>
      </nav>

      <QuickActions open={quick} onClose={() => setQuick(false)} />
      <TrainSheet open={train} onClose={() => setTrain(false)} />
    </div>
  )
}

function QuickActions({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const toast = useToast()
  const [meals, setMeals] = useState<Meal[] | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open && !meals) api<{ meals: Meal[] }>('/meals').then((r) => setMeals(r.meals)).catch(() => {})
  }, [open, meals])

  const go = (to: string) => {
    onClose()
    navigate(to)
  }

  const water = async (ml: number) => {
    setBusy(true)
    try {
      const r = await api<{ water: { id: number } }>('/water', { method: 'POST', body: { date: isoDate(), ml } })
      notifyChanged()
      toast({
        text: `+${ml} ml de água 💧`,
        action: { label: 'Desfazer', run: () => api(`/water/${r.water.id}`, { method: 'DELETE' }).then(notifyChanged).catch(() => {}) },
      })
      onClose()
    } catch (e) {
      toast({ text: (e as ApiError).message })
    } finally {
      setBusy(false)
    }
  }

  const suggested = meals ? mealForNow(meals) : undefined

  return (
    <Sheet open={open} onClose={onClose} title="Registrar">
      <div className="space-y-5">
        {/* As três ações principais, iguais aos atalhos da tela inicial */}
        <div className="grid grid-cols-3 gap-2">
          <QuickTile icon={Dumbbell} label="Treinar" hint="Ficha ou avulso" onClick={() => { onClose(); openTrain() }} />
          <QuickTile icon={Utensils} label="Alimento" hint={suggested?.name ?? 'Adicionar'} onClick={() => go(suggested ? `/adicionar?refeicao=${suggested.id}` : '/adicionar')} />
          <QuickTile icon={Droplet} label="Água" hint="+250 ml" tone="water" disabled={busy} onClick={() => water(250)} />
        </div>

        {meals && meals.filter((m) => m.active).length > 1 && (
          <div>
            <p className="mb-2 text-sm font-semibold text-muted">Outra refeição</p>
            <div className="flex flex-wrap gap-2">
              {meals
                .filter((m) => m.active && m.id !== suggested?.id)
                .map((m) => (
                  <button key={m.id} onClick={() => go(`/adicionar?refeicao=${m.id}`)} className="rounded-full bg-soft px-3.5 py-2 text-sm font-semibold active:scale-95">
                    {m.name}
                  </button>
                ))}
            </div>
          </div>
        )}

        <div>
          <p className="mb-2 text-sm font-semibold text-muted">Outra quantidade de água</p>
          <div className="grid grid-cols-3 gap-2">
            {[200, 300, 500].map((v) => (
              <button key={v} disabled={busy} onClick={() => water(v)} className="h-11 rounded-xl bg-water/15 text-sm font-bold text-water-ink active:scale-95 disabled:opacity-50">
                +{v} ml
              </button>
            ))}
          </div>
        </div>

        <button onClick={() => go('/progresso?aba=peso&registrar=1')} className="flex w-full items-center gap-3 rounded-2xl bg-soft px-4 py-3 text-left active:scale-[0.98]">
          <Scale className="size-5 text-primary" />
          <span className="flex-1 font-semibold">Registrar peso</span>
        </button>
      </div>
    </Sheet>
  )
}

/** Atalho grande (ícone + nome + dica). */
export function QuickTile({ icon: Icon, label, hint, onClick, tone = 'primary', disabled, done }: {
  icon: LucideIcon
  label: string
  hint: string
  onClick: () => void
  tone?: 'primary' | 'water'
  disabled?: boolean
  done?: boolean
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      disabled={disabled}
      className="flex min-w-0 flex-col items-center gap-1.5 rounded-2xl bg-surface px-2 py-3 text-center shadow-[0_2px_12px_-4px_rgba(31,23,36,0.08)] disabled:opacity-60"
    >
      <span className={`relative flex size-11 items-center justify-center rounded-full ${tone === 'water' ? 'bg-water/15 text-water-ink' : 'bg-orchid/15 text-primary'}`}>
        <Icon className="size-6" />
        {done && <span className="absolute -right-0.5 -bottom-0.5 flex size-5 items-center justify-center rounded-full bg-primary text-white ring-2 ring-surface"><Check className="size-3" strokeWidth={3.5} /></span>}
      </span>
      <span className="w-full truncate text-sm font-bold">{label}</span>
      <span className="w-full truncate text-xs leading-tight text-muted">{hint}</span>
    </motion.button>
  )
}
