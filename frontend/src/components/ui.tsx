import { motion } from 'framer-motion'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'

export function Logo({ size = 48 }: { size?: number }) {
  return <img src="/logo.svg" width={size} height={size} alt="Dieta & Treino" className="rounded-[22%]" />
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger'
  loading?: boolean
}

export function Button({ variant = 'primary', loading, children, className = '', disabled, ...rest }: ButtonProps) {
  const styles = {
    primary: 'bg-primary text-white hover:bg-primary-hover shadow-[0_6px_20px_-8px_rgba(155,63,168,0.7)]',
    ghost: 'bg-soft text-primary hover:bg-line',
    danger: 'bg-coral/10 text-[#b0403f] hover:bg-coral/20',
  }[variant]

  return (
    <button
      className={`flex h-12 w-full items-center justify-center gap-2 rounded-2xl px-5 font-semibold transition-all duration-200 active:scale-[0.97] disabled:opacity-50 ${styles} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <span className="size-5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : children}
    </button>
  )
}

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  suffix?: string
}

export function Field({ label, error, suffix, id, className = '', ...rest }: FieldProps) {
  const inputId = id ?? rest.name
  return (
    <label htmlFor={inputId} className={`block ${className}`}>
      <span className="mb-1.5 block text-sm font-medium text-muted">{label}</span>
      <div
        className={`flex h-12 items-center rounded-2xl border bg-surface px-4 transition-colors focus-within:border-orchid focus-within:ring-4 focus-within:ring-orchid/15 ${
          error ? 'border-coral' : 'border-line'
        }`}
      >
        <input id={inputId} className="w-full min-w-0 bg-transparent text-base outline-none placeholder:text-muted/50" {...rest} />
        {suffix && <span className="ml-2 shrink-0 text-sm text-muted">{suffix}</span>}
      </div>
      {error && (
        <motion.span initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mt-1 block text-sm text-[#b0403f]">
          {error}
        </motion.span>
      )}
    </label>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-[var(--radius-card)] bg-surface p-5 shadow-[0_2px_12px_-4px_rgba(31,23,36,0.08)] ${className}`}>{children}</div>
}

export function Alert({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      className="rounded-2xl bg-coral/10 px-4 py-3 text-sm text-[#b0403f]"
      role="alert"
    >
      {children}
    </motion.div>
  )
}

export function Spinner() {
  return (
    <div className="flex h-full items-center justify-center">
      <span className="size-8 animate-spin rounded-full border-[3px] border-orchid border-t-transparent" />
    </div>
  )
}
