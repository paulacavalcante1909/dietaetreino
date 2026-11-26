import { AnimatePresence, motion } from 'framer-motion'
import { Component, useEffect, useState, type ReactNode } from 'react'
import { useTheme } from '../lib/theme'
import { flush } from '../lib/outbox'
import { useToast } from './Toast'
import { CloudOff } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'dt_install_dismissed'

/** Convite para instalar o app (Android/desktop) ou instruções no iPhone. */
export function InstallBanner() {
  const { theme } = useTheme()
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [ios, setIos] = useState(false)
  const [hidden, setHidden] = useState(() => !!localStorage.getItem(DISMISS_KEY))

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone
    if (standalone) return
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setEvent(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    // Safari no iPhone não tem prompt: mostra como adicionar à tela de início
    if (/iphone|ipad|ipod/i.test(navigator.userAgent)) setIos(true)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1')
    setHidden(true)
  }

  const install = async () => {
    if (!event) return
    await event.prompt()
    await event.userChoice
    setEvent(null)
    dismiss()
  }

  const show = !hidden && (event || ios)

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          className="safe-top fixed inset-x-0 top-0 z-[55] flex justify-center px-3 pt-3"
        >
          <div className="flex w-full max-w-lg items-center gap-3 rounded-2xl bg-surface p-3 shadow-xl ring-1 ring-line">
            <img src={`${theme.assets}/logo.png`} alt="" className="size-10 rounded-xl" />
            <p className="min-w-0 flex-1 text-sm">
              {event ? (
                <>Instale o app para abrir direto da tela inicial.</>
              ) : (
                <>Para instalar: toque em <strong>Compartilhar</strong> e depois em <strong>Adicionar à Tela de Início</strong>.</>
              )}
            </p>
            {event && (
              <button onClick={install} className="rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-white">
                Instalar
              </button>
            )}
            <button onClick={dismiss} aria-label="Fechar" className="px-1 text-xl text-muted">
              ×
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Aviso quando o aparelho fica sem internet. */
export function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine)
  useEffect(() => {
    const on = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  return (
    <AnimatePresence>
      {offline && (
        <motion.div
          initial={{ y: -40 }}
          animate={{ y: 0 }}
          exit={{ y: -40 }}
          className="fixed inset-x-0 top-0 z-[60] bg-scrim py-2 text-center text-sm text-white"
          role="status"
        >
          Sem internet. Treinos e fotos ficam guardados e são enviados quando a conexão voltar.
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Evita tela branca: mostra uma mensagem amigável se algo quebrar. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false }

  static getDerivedStateFromError() {
    return { error: true }
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-4 p-8 text-center">
        <CloudOff className="size-12 text-link" aria-hidden />
        <p className="text-lg font-semibold">Ops, algo deu errado.</p>
        <button onClick={() => location.reload()} className="rounded-2xl bg-primary px-6 py-3 font-semibold text-white">
          Recarregar
        </button>
      </div>
    )
  }
}

/** Envia a fila offline ao abrir, ao voltar a internet, ao voltar ao app e a cada minuto. */
export function OutboxSync() {
  const toast = useToast()
  useEffect(() => {
    const run = () =>
      flush().then((n) => {
        if (n > 0) toast({ text: n === 1 ? 'Envio pendente concluído ✓' : `${n} envios pendentes concluídos ✓` })
      })
    run()
    const onVisible = () => document.visibilityState === 'visible' && run()
    window.addEventListener('online', run)
    document.addEventListener('visibilitychange', onVisible)
    const id = setInterval(run, 60_000)
    return () => {
      window.removeEventListener('online', run)
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(id)
    }
  }, [toast])
  return null
}
