import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'
import { BarcodeFormat, DecodeHintType } from '@zxing/library'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Button, Field } from './ui'

interface Props {
  open: boolean
  onClose: () => void
  onDetected: (ean: string) => void
}

const hints = new Map([[DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E]]])

/** Leitor de código de barras pela câmera traseira, com digitação manual como alternativa. */
export function BarcodeScanner({ open, onClose, onDetected }: Props) {
  const video = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [manual, setManual] = useState('')

  useEffect(() => {
    if (!open) return
    setError(null)
    let controls: IScannerControls | undefined
    let done = false
    const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 120 })

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Este navegador não permite usar a câmera. Digite o código abaixo.')
      return
    }

    reader
      .decodeFromConstraints({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } } }, video.current!, (result) => {
        if (result && !done) {
          done = true
          navigator.vibrate?.(60)
          controls?.stop()
          onDetected(result.getText())
        }
      })
      .then((c) => {
        controls = c
        if (done) c.stop()
      })
      .catch((e: Error) => {
        setError(
          e.name === 'NotAllowedError'
            ? 'Sem permissão para usar a câmera. Libere o acesso nas configurações do navegador ou digite o código.'
            : 'Não foi possível abrir a câmera. Digite o código abaixo.',
        )
      })

    return () => {
      done = true
      controls?.stop()
    }
  }, [open, onDetected])

  const submitManual = (e: FormEvent) => {
    e.preventDefault()
    if (/^\d{8,14}$/.test(manual)) {
      onDetected(manual)
      setManual('')
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex flex-col bg-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="safe-top flex items-center justify-between px-5 pt-4 pb-3 text-white">
            <h2 className="text-lg font-bold">Ler código de barras</h2>
            <button onClick={onClose} aria-label="Fechar" className="flex size-10 items-center justify-center rounded-full bg-white/10 text-xl">
              ×
            </button>
          </div>

          <div className="relative flex-1 overflow-hidden">
            <video ref={video} className="absolute inset-0 size-full object-cover" muted playsInline />
            {/* Moldura com linha animada */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative h-40 w-72 rounded-3xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(31,23,36,0.55)]">
                <motion.div
                  className="absolute inset-x-4 h-0.5 rounded-full bg-orchid shadow-[0_0_12px_2px_#cc6cd7]"
                  animate={{ top: ['15%', '85%', '15%'] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                />
              </div>
            </div>
            <p className="absolute inset-x-0 bottom-6 text-center text-sm text-white/80">Aponte para o código do produto</p>
          </div>

          <form onSubmit={submitManual} className="safe-bottom space-y-3 rounded-t-[1.75rem] bg-surface px-5 pt-5 pb-6">
            {error && <p className="text-sm text-danger">{error}</p>}
            <Field label="Ou digite o código" name="ean" inputMode="numeric" placeholder="ex.: 7891000100103" value={manual} onChange={(e) => setManual(e.target.value.replace(/\D/g, '').slice(0, 14))} />
            <Button type="submit" variant="ghost" disabled={!/^\d{8,14}$/.test(manual)}>
              Buscar código
            </Button>
          </form>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
