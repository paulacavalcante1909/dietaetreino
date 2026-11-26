import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, HelpCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from './ui'

export interface ConfirmOptions {
  title: string
  text?: string
  confirmLabel?: string
  cancelLabel?: string
  /** Ação destrutiva (excluir, descartar): botão vermelho e ícone de alerta */
  danger?: boolean
}

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void }

let show: ((p: Pending) => void) | null = null

/**
 * Pergunta de confirmação no visual do app (no lugar do confirm() do navegador).
 * Uso: `if (!(await ask({ title: 'Excluir?', danger: true }))) return`
 */
export function ask(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (show) show({ ...options, resolve })
    else resolve(window.confirm([options.title, options.text].filter(Boolean).join('\n\n')))
  })
}

/** Monta uma vez, perto da raiz do app. */
export function DialogHost() {
  const [pending, setPending] = useState<Pending | null>(null)

  useEffect(() => {
    show = setPending
    return () => {
      show = null
    }
  }, [])

  const close = (ok: boolean) => {
    pending?.resolve(ok)
    setPending(null)
  }

  useEffect(() => {
    if (!pending) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending])

  const Icon = pending?.danger ? AlertTriangle : HelpCircle

  return (
    <AnimatePresence>
      {pending && (
        <motion.div className="fixed inset-0 z-[70] flex items-center justify-center px-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-scrim/50 backdrop-blur-[2px]" onClick={() => close(false)} />
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
            aria-describedby={pending.text ? 'dialog-text' : undefined}
            initial={{ scale: 0.9, y: 12, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
            className="relative w-full max-w-sm rounded-[var(--radius-card)] bg-surface p-6 text-center shadow-2xl"
          >
            <span className={`mx-auto flex size-14 items-center justify-center rounded-full ${pending.danger ? 'bg-coral/15 text-danger' : 'bg-orchid/15 text-primary'}`}>
              <Icon className="size-7" />
            </span>
            <h2 id="dialog-title" className="mt-4 text-lg font-bold">{pending.title}</h2>
            {pending.text && <p id="dialog-text" className="mt-1.5 text-sm text-muted">{pending.text}</p>}
            <div className="mt-6 space-y-2">
              <Button autoFocus variant={pending.danger ? 'danger' : undefined} onClick={() => close(true)}>
                {pending.confirmLabel ?? 'Confirmar'}
              </Button>
              <button onClick={() => close(false)} className="h-11 w-full rounded-2xl font-semibold text-muted active:bg-soft">
                {pending.cancelLabel ?? 'Cancelar'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
