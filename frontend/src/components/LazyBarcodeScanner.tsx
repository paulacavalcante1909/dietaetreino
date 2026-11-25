import { lazy, Suspense } from 'react'

// A biblioteca de leitura (zxing) é pesada: só baixa quando o leitor abre pela primeira vez
const Scanner = lazy(() => import('./BarcodeScanner').then((m) => ({ default: m.BarcodeScanner })))

export function LazyBarcodeScanner(props: { open: boolean; onClose: () => void; onDetected: (ean: string) => void }) {
  if (!props.open) return null
  return (
    <Suspense fallback={<div className="fixed inset-0 z-50 bg-scrim/80" />}>
      <Scanner {...props} />
    </Suspense>
  )
}
