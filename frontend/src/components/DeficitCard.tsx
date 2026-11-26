import { Activity, ChevronRight, Info, TrendingDown, TrendingUp, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Energy } from '../lib/types'
import { fmtKcal } from './Ring'
import { Sheet } from './Sheet'
import { Card } from './ui'

const MISSING_LABEL: Record<string, string> = {
  sex: 'sexo',
  birth_date: 'data de nascimento',
  height_cm: 'altura',
  weight: 'peso',
}

const HIDE_KEY = 'dt_deficit_prompt_hidden'

const list = (items: string[]) => (items.length > 1 ? `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}` : items[0])

/**
 * Déficit calórico do dia: gasto estimado (TMB × fator de atividade) − consumido.
 * Sem os dados do perfil, convida a completar (pode ser dispensado).
 */
export function DeficitCard({ energy, consumed, isToday, goalKcal, burned = 0 }: { energy: Energy; consumed: number; isToday: boolean; goalKcal?: number; burned?: number }) {
  const [info, setInfo] = useState(false)
  const [hidden, setHidden] = useState(() => localStorage.getItem(HIDE_KEY) === '1')

  if (!energy.available) {
    if (hidden) return null
    const onlyWeight = energy.missing.length === 1 && energy.missing[0] === 'weight'
    return (
      <Card className="relative flex items-start gap-3 !py-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-soft text-primary">
          <Activity className="size-5" />
        </span>
        <div className="min-w-0 flex-1 pr-6">
          <p className="font-bold">Descubra quanto você gasta por dia</p>
          <p className="text-sm text-muted">Preencha {list(energy.missing.map((m) => MISSING_LABEL[m]))} para ver se está comendo mais ou menos do que gasta.</p>
          <Link
            to={onlyWeight ? '/progresso?aba=peso&registrar=1' : '/ajustes?abrir=dados'}
            className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-primary"
          >
            {onlyWeight ? 'Registrar peso' : 'Completar meus dados'} <ChevronRight className="size-4" />
          </Link>
        </div>
        <button
          aria-label="Dispensar"
          onClick={() => {
            localStorage.setItem(HIDE_KEY, '1')
            setHidden(true)
          }}
          className="absolute top-3 right-3 flex size-8 items-center justify-center rounded-full text-muted active:bg-soft"
        >
          <X className="size-4" />
        </button>
      </Card>
    )
  }

  const balance = energy.deficit ?? Math.round(energy.get - consumed) // positivo = comeu menos do que gasta
  const ateLess = balance >= 0
  const pct = Math.min(consumed / energy.get, 1)

  return (
    <>
      <Card className="!py-4">
        <button onClick={() => setInfo(true)} className="w-full text-left" aria-haspopup="dialog" aria-label="Gasto do dia: ver como calculamos">
          <div className="flex items-center gap-3">
            <span className={`flex size-10 shrink-0 items-center justify-center rounded-full ${ateLess ? 'bg-fiber/15 text-fiber' : 'bg-coral/15 text-coral'}`}>
              {isToday ? <Activity className="size-5" /> : ateLess ? <TrendingDown className="size-5" /> : <TrendingUp className="size-5" />}
            </span>
            <div className="min-w-0 flex-1">
              {isToday ? (
                <>
                  <p className="text-xs font-semibold text-muted">Seu corpo gasta hoje cerca de</p>
                  <p className="text-2xl font-extrabold">
                    {fmtKcal(energy.get)} <span className="text-sm font-semibold text-muted">kcal</span>
                  </p>
                </>
              ) : (
                <>
                  <p className="text-xs font-semibold text-muted">Balanço do dia</p>
                  <p className="text-base leading-snug font-extrabold">
                    Você comeu {fmtKcal(Math.abs(balance))} kcal {ateLess ? 'a menos' : 'a mais'} do que gastou
                  </p>
                </>
              )}
            </div>
            <Info className="size-5 shrink-0 text-muted" />
          </div>

          {isToday && (
            <div className="mt-3">
              <div className="h-2.5 overflow-hidden rounded-full bg-soft">
                <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${pct * 100}%`, background: ateLess ? 'var(--color-fiber)' : 'var(--color-coral)' }} />
              </div>
              <p className="mt-1.5 text-xs text-muted">
                {consumed <= 0
                  ? 'Registre suas refeições para ver se vai comer mais ou menos do que gasta.'
                  : ateLess
                    ? `Você comeu ${fmtKcal(consumed)} kcal até agora · ${fmtKcal(balance)} abaixo do que gasta`
                    : `Você já comeu ${fmtKcal(-balance)} kcal a mais do que gasta hoje`}
              </p>
            </div>
          )}
        </button>
      </Card>

      <Sheet open={info} onClose={() => setInfo(false)} title="Quanto você gasta por dia">
        <div className="space-y-4 text-sm text-muted [&_strong]:text-ink">
          <p>
            Estimamos quanto seu corpo gasta num dia com base no seu <strong>peso ({energy.weight.toLocaleString('pt-BR')} kg)</strong>,{' '}
            <strong>altura ({energy.height_cm} cm)</strong>, <strong>idade ({energy.age} anos)</strong> e em{' '}
            <strong>quantas vezes você treina</strong> ({energy.checkins_per_week.toLocaleString('pt-BR')}× por semana em média →{' '}
            {energy.level.toLowerCase()}).
          </p>
          <div className="space-y-2 rounded-2xl bg-soft p-4">
            <Row label="Gasto em repouso" value={`${fmtKcal(energy.tmb)} kcal`} />
            <Row label={`Atividade (${energy.level.toLowerCase()})`} value={`× ${energy.factor.toLocaleString('pt-BR')}`} />
            <div className="border-t border-line pt-2">
              <Row label="Gasto estimado do dia" value={`${fmtKcal(energy.get)} kcal`} strong />
            </div>
            <Row label={isToday ? 'Comido até agora' : 'Comido no dia'} value={`${fmtKcal(consumed)} kcal`} />
          </div>
          <p>
            <strong>Comer menos do que gasta</strong> (déficit calórico) tende a fazer perder peso. <strong>Comer mais</strong> (superávit) tende a fazer ganhar.
          </p>
          <p>
            <strong>Isso é diferente da sua meta.</strong> O anel lá em cima mostra quanto falta para a meta que você escolheu
            {goalKcal ? ` (${fmtKcal(goalKcal)} kcal)` : ''}. Este cartão mostra o que seu corpo gasta de verdade.
          </p>
          {burned > 0 && (
            <p>
              As ~{fmtKcal(burned)} kcal dos treinos de hoje já estão incluídas no seu nível de atividade, por isso não somamos de novo.
            </p>
          )}
          <p className="text-xs">Fórmula de Mifflin-St Jeor. É uma estimativa e não substitui a orientação de um nutricionista.</p>
          <Link to="/ajustes?abrir=dados" className="block text-center font-bold text-primary">
            Editar meus dados
          </Link>
        </div>
      </Sheet>
    </>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 ${strong ? 'font-bold text-ink' : 'text-muted'}`}>
      <span>{label}</span>
      <span className="shrink-0">{value}</span>
    </div>
  )
}
