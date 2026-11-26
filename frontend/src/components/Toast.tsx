import { AnimatePresence, motion } from 'framer-motion'
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

interface ToastData {
  id: number
  text: string
  action?: { label: string; run: () => void }
  /** Mais de uma ação (ex.: Desfazer e Ajustar) */
  actions?: { label: string; run: () => void }[]
}

const ToastContext = createContext<(t: Omit<ToastData, 'id'>) => void>(() => {})

export const useToast = () => useContext(ToastContext)

/** Aviso flutuante embaixo, acima das barras, com ações opcionais (ex.: Desfazer). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastData | null>(null)
  const timer = useRef<number>(0)

  const show = useCallback((t: Omit<ToastData, 'id'>) => {
    window.clearTimeout(timer.current)
    setToast({ ...t, id: Date.now() })
    timer.current = window.setTimeout(() => setToast(null), t.actions ? 6000 : 4000)
  }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      {/* Embaixo, acima das barras de botões: não cobre título nem o botão voltar */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex justify-center px-5 pb-[calc(env(safe-area-inset-bottom)+6.5rem)]">
        <AnimatePresence>
          {toast && (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10 }}
              className="pointer-events-auto flex max-w-sm items-center gap-3 rounded-2xl bg-scrim px-4 py-3 text-sm text-white shadow-xl"
              role="status"
            >
              <span>{toast.text}</span>
              {[...(toast.action ? [toast.action] : []), ...(toast.actions ?? [])].map((a) => (
                <button
                  key={a.label}
                  className="shrink-0 font-semibold text-orchid"
                  onClick={() => {
                    a.run()
                    setToast(null)
                  }}
                >
                  {a.label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}
