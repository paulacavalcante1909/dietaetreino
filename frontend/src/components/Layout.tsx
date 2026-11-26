import { AnimatePresence, motion } from 'framer-motion'
import { Camera, ChartLine, Dumbbell, House, Plus, Scale, Settings, Utensils } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate, useOutlet } from 'react-router-dom'
import { Sheet } from './Sheet'
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

/** Shell com navegação inferior, botão central de ações rápidas e transição entre abas. */
export function Layout() {
  const location = useLocation()
  const outlet = useOutlet()
  const mainRef = useRef<HTMLElement>(null)
  const [quick, setQuick] = useState(false)

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
                  aria-label="Ações rápidas: registrar alimento, água, treino, check-in ou peso"
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
      await api('/water', { method: 'POST', body: { date: isoDate(), ml } })
      notifyChanged()
      toast({ text: `+${ml} ml de água 💧` })
      onClose()
    } catch (e) {
      toast({ text: (e as ApiError).message })
    } finally {
      setBusy(false)
    }
  }

  const suggested = meals ? mealForNow(meals) : undefined
  const actions = [
    { icon: Dumbbell, label: 'Treinar', hint: 'Ficha ou exercício avulso', to: '/treinos?treinar=1' },
    { icon: Camera, label: 'Check-in', hint: 'Foto do treino de hoje', to: '/checkin' },
    { icon: Scale, label: 'Peso', hint: 'Registrar o peso de hoje', to: '/progresso?aba=peso&registrar=1' },
  ]

  return (
    <Sheet open={open} onClose={onClose} title="Registrar">
      <div className="space-y-4">
        {/* Alimento: refeição sugerida pelo horário + outras */}
        <div>
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted">
            <Utensils className="size-4" /> Alimento
          </p>
          {suggested && (
            <button
              onClick={() => go(`/adicionar?refeicao=${suggested.id}`)}
              className="mb-2 flex w-full items-center justify-between rounded-2xl bg-primary px-4 py-3.5 text-left font-bold text-white shadow-md active:scale-[0.98]"
            >
              <span>
                <span className="block text-xs font-semibold text-white/80">Agora</span>
                {suggested.name}
              </span>
              <Plus className="size-5" />
            </button>
          )}
          <div className="flex flex-wrap gap-2">
            {meals
              ?.filter((m) => m.active && m.id !== suggested?.id)
              .map((m) => (
                <button key={m.id} onClick={() => go(`/adicionar?refeicao=${m.id}`)} className="rounded-full bg-soft px-3.5 py-2 text-sm font-semibold active:scale-95">
                  {m.name}
                </button>
              ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-muted">Água</p>
          <div className="grid grid-cols-3 gap-2">
            {[200, 300, 500].map((v) => (
              <button key={v} disabled={busy} onClick={() => water(v)} className="h-11 rounded-xl bg-water/15 text-sm font-bold text-water-ink active:scale-95 disabled:opacity-50">
                +{v} ml
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {actions.map((a) => (
            <button key={a.label} onClick={() => go(a.to)} className="flex flex-col items-center gap-1.5 rounded-2xl bg-soft px-2 py-3 text-center active:scale-95">
              <a.icon className="size-6 text-primary" />
              <span className="text-sm font-bold">{a.label}</span>
              <span className="text-xs leading-tight text-muted">{a.hint}</span>
            </button>
          ))}
        </div>
      </div>
    </Sheet>
  )
}
