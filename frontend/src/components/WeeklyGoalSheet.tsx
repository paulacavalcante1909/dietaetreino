import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import type { User } from '../lib/types'
import { Sheet } from './Sheet'
import { useToast } from './Toast'
import { Mascot } from './ui'

/**
 * Escolha da meta de treinos por semana (1–7 dias). Usada em Treinos, Progresso e Ajustes.
 * Salva na conta e avisa quem chamou com o novo valor.
 */
export function WeeklyGoalSheet({ open, onClose, value, onSaved }: { open: boolean; onClose: () => void; value: number; onSaved?: (n: number) => void }) {
  const { setUser } = useAuth()
  const toast = useToast()

  const save = async (n: number) => {
    onSaved?.(n)
    onClose()
    try {
      const r = await api<{ user: User }>('/me/preferences', { method: 'PUT', body: { weekly_workout_goal: n } })
      setUser(r.user)
      toast({ text: `Meta: ${n} ${n === 1 ? 'treino' : 'treinos'} por semana ✓` })
    } catch {
      toast({ text: 'Não foi possível salvar a meta. Tente de novo.' })
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Meta de treinos por semana">
      <div className="space-y-4 text-center">
        <Mascot size={72} className="mx-auto" />
        <p className="text-sm text-muted">Quantos dias por semana você quer treinar?</p>
        <div className="grid grid-cols-7 gap-1.5" role="radiogroup" aria-label="Dias de treino por semana">
          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
            <button
              key={n}
              role="radio"
              aria-checked={value === n}
              onClick={() => save(n)}
              className={`h-12 rounded-xl text-lg font-extrabold transition-colors ${value === n ? 'bg-primary text-white' : 'bg-soft text-ink'}`}
            >
              {n}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted">Conta os dias com treino registrado, de domingo a sábado.</p>
      </div>
    </Sheet>
  )
}
