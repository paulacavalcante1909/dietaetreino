import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef } from 'react'
import { NavLink, useLocation, useOutlet } from 'react-router-dom'

const tabs = [
  { to: '/', label: 'Hoje', icon: IconHome },
  { to: '/treinos', label: 'Treinos', icon: IconDumbbell },
  { to: '/progresso', label: 'Progresso', icon: IconChart },
  { to: '/ajustes', label: 'Ajustes', icon: IconUser },
]

/** Shell com navegação inferior e transição entre abas. */
export function Layout() {
  const location = useLocation()
  const outlet = useOutlet()
  const mainRef = useRef<HTMLElement>(null)

  // Cada aba abre no topo
  useEffect(() => {
    window.scrollTo(0, 0)
    mainRef.current?.scrollTo(0, 0)
  }, [location.pathname])

  return (
    <div className="mx-auto flex h-full max-w-lg flex-col">
      <main ref={mainRef} className="relative flex-1 overflow-y-auto overflow-x-hidden pb-24">
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
        <div className="mx-auto flex max-w-lg">
          {tabs.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} className="relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium">
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="tab-pill"
                      className="absolute top-1.5 h-8 w-14 rounded-full bg-orchid/15"
                      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    />
                  )}
                  <Icon className={`relative size-6 transition-colors ${isActive ? 'text-primary' : 'text-muted'}`} />
                  <span className={isActive ? 'text-primary' : 'text-muted'}>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}

type IconProps = { className?: string }
const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, viewBox: '0 0 24 24' }

function IconHome(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />
    </svg>
  )
}
function IconDumbbell(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M6 7v10M18 7v10M3 9.5v5M21 9.5v5M6 12h12" />
    </svg>
  )
}
function IconChart(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M3 3v18h18" />
      <path d="m7 14 4-4 3 3 5-6" />
    </svg>
  )
}
function IconUser(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  )
}
