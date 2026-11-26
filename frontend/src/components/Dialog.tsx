import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, HelpCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button, Field } from './ui'

export interface ConfirmOptions {
  title: string
  text?: string
  confirmLabel?: string
  cancelLabel?: string
  /** Ação destrutiva (excluir, descartar): botão vermelho e ícone de alerta */
  danger?: boolean
  /** Pede um texto (ex.: nome) */
  input?: { label: string; value?: string; placeholder?: string; maxLength?: number }
}

type Pending = ConfirmOptions & { resolve: (r: { ok: boolean; value: string }) => void }

let show: ((p: Pending) => void) | null = null

/**
 * Pergunta de confirmação no visual do app (no lugar do confirm() do navegador).
 * Uso: `if (!(await ask({ title: 'Excluir?', danger: true }))) return`
 */
export function ask(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (show) show({ ...options, resolve: (r) => resolve(r.ok) })
    else resolve(window.confirm([options.title, options.text].filter(Boolean).join('\n\n')))
  })
}

/** Pede um texto no visual do app. Retorna null se cancelar. */
export function askText(options: ConfirmOptions & { input: NonNullable<ConfirmOptions['input']> }): Promise<string | null> {
  return new Promise((resolve) => {
    if (show) show({ ...options, resolve: (r) => resolve(r.ok ? r.value.trim() : null) })
    else resolve(window.prompt(options.title, options.input.value ?? ''))
  })
}

/** Monta uma vez, perto da raiz do app. */
export function DialogHost() {
  const [pending, setPending] = useState<Pending | null>(null)
  const [value, setValue] = useState('')

  useEffect(() => {
    show = (p) => {
      setValue(p.input?.value ?? '')
      setPending(p)
    }
    return () => {
      show = null
    }
  }, [])

  const close = (ok: boolean) => {
    if (ok && pending?.input && !value.trim()) return
    pending?.resolve({ ok, value })
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
            <span className={`mx-auto flex size-14 items-center justify-center rounded-full ${pending.danger ? 'bg-coral/15 text-danger' : 'bg-orchid/15 text-link'}`}>
              <Icon className="size-7" />
            </span>
            <h2 id="dialog-title" className="mt-4 text-lg font-bold">{pending.title}</h2>
            {pending.text && <p id="dialog-text" className="mt-1.5 text-sm text-muted">{pending.text}</p>}
            {pending.input && (
              <form
                className="mt-4 text-left"
                onSubmit={(e) => {
                  e.preventDefault()
                  close(true)
                }}
              >
                <Field label={pending.input.label} name="dialog_input" autoFocus maxLength={pending.input.maxLength ?? 120} placeholder={pending.input.placeholder} value={value} onChange={(e) => setValue(e.target.value)} />
              </form>
            )}
            <div className="mt-6 space-y-2">
              <Button autoFocus={!pending.input} disabled={!!pending.input && !value.trim()} variant={pending.danger ? 'danger' : undefined} onClick={() => close(true)}>
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
