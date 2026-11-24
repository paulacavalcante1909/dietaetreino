import { AnimatePresence, motion } from 'framer-motion'
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

interface ToastData {
  id: number
  text: string
  action?: { label: string; run: () => void }
}

const ToastContext = createContext<(t: Omit<ToastData, 'id'>) => void>(() => {})

export const useToast = () => useContext(ToastContext)

/** Aviso flutuante acima da barra inferior, com ação opcional (ex.: Desfazer). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastData | null>(null)
  const timer = useRef<number>(0)

  const show = useCallback((t: Omit<ToastData, 'id'>) => {
    window.clearTimeout(timer.current)
    setToast({ ...t, id: Date.now() })
    timer.current = window.setTimeout(() => setToast(null), 4000)
  }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="safe-top pointer-events-none fixed inset-x-0 top-3 z-[60] flex justify-center px-5">
        <AnimatePresence>
          {toast && (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10 }}
              className="pointer-events-auto flex max-w-sm items-center gap-4 rounded-2xl bg-ink px-4 py-3 text-sm text-white shadow-xl"
              role="status"
            >
              <span>{toast.text}</span>
              {toast.action && (
                <button
                  className="shrink-0 font-semibold text-orchid"
                  onClick={() => {
                    toast.action!.run()
                    setToast(null)
                  }}
                >
                  {toast.action.label}
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}
