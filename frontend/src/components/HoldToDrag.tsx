import { Reorder, useDragControls } from 'framer-motion'
import { useEffect, useRef, useState, type ReactNode } from 'react'

const HOLD_MS = 350
const MOVE_TOLERANCE = 8

/**
 * Item de lista reordenável que só começa a arrastar depois de SEGURAR (~0,35 s).
 * Rolar a tela por cima dos cards não move nada; ao segurar, o card "levanta" e vibra.
 */
export function HoldToDragItem<T>({ value, children, className = '', onDragEnd }: { value: T; children: ReactNode; className?: string; onDragEnd?: () => void }) {
  const controls = useDragControls()
  const ref = useRef<HTMLLIElement>(null)
  const timer = useRef<number>(0)
  const origin = useRef<{ x: number; y: number } | null>(null)
  const draggingRef = useRef(false)
  const [dragging, setDragging] = useState(false)
  const justDragged = useRef(false)

  const cancel = () => {
    window.clearTimeout(timer.current)
    origin.current = null
  }

  // Durante o arraste, impede que o navegador role a página (precisa de listener não passivo)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onTouchMove = (e: TouchEvent) => {
      if (draggingRef.current) e.preventDefault()
    }
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => el.removeEventListener('touchmove', onTouchMove)
  }, [])

  return (
    <Reorder.Item
      ref={ref}
      value={value}
      dragListener={false}
      dragControls={controls}
      onDragEnd={() => {
        draggingRef.current = false
        setDragging(false)
        // O "soltar" não pode virar um toque no card (abrir o treino, etc.)
        justDragged.current = true
        window.setTimeout(() => (justDragged.current = false), 0)
        onDragEnd?.()
      }}
      onPointerDown={(e) => {
        if (e.button !== 0) return
        const native = e.nativeEvent
        origin.current = { x: e.clientX, y: e.clientY }
        timer.current = window.setTimeout(() => {
          draggingRef.current = true
          setDragging(true)
          navigator.vibrate?.(30)
          controls.start(native)
        }, HOLD_MS)
      }}
      onPointerMove={(e) => {
        const o = origin.current
        if (o && !draggingRef.current && Math.hypot(e.clientX - o.x, e.clientY - o.y) > MOVE_TOLERANCE) cancel()
      }}
      onPointerUp={() => {
        cancel()
        // Segurou e soltou sem mover: volta ao normal e não conta como toque
        if (draggingRef.current) {
          justDragged.current = true
          window.setTimeout(() => {
            draggingRef.current = false
            justDragged.current = false
            setDragging(false)
          }, 50)
        }
      }}
      onPointerCancel={cancel}
      onContextMenu={(e) => e.preventDefault()}
      onClickCapture={(e) => {
        if (justDragged.current || draggingRef.current) {
          e.preventDefault()
          e.stopPropagation()
        }
      }}
      animate={{ scale: dragging ? 1.03 : 1 }}
      className={`select-none [-webkit-touch-callout:none] ${dragging ? 'relative z-10 drop-shadow-xl' : ''} ${className}`}
    >
      {children}
    </Reorder.Item>
  )
}
