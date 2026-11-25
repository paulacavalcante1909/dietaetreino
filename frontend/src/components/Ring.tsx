import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

interface RingProps {
  value: number
  max: number
  size?: number
  stroke?: number
  color: string
  children?: ReactNode
}

/** Anel de progresso animado. Passa de 100% → cor de alerta. */
export function Ring({ value, max, size = 180, stroke = 14, color, children }: RingProps) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = max > 0 ? Math.min(value / max, 1) : 0
  const over = max > 0 && value > max

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-soft)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={over ? 'var(--color-coral)' : color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  )
}

export function Bar({ label, value, max, unit, color }: { label: string; value: number; max: number; unit: string; color: string }) {
  const pct = max > 0 ? Math.min(value / max, 1) : 0
  const over = max > 0 && value > max
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className={over ? 'font-medium text-danger' : 'text-muted'}>
          {fmt(value)} / {fmt(max)} {unit}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-soft">
        <motion.div
          className="h-full rounded-full"
          style={{ background: over ? 'var(--color-coral)' : color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct * 100}%` }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </div>
  )
}

export const fmt = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
