import { Activity, ChevronRight, Info, X } from 'lucide-react'
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
export function DeficitCard({ energy, consumed, isToday }: { energy: Energy; consumed: number; isToday: boolean }) {
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
          <p className="font-bold">Veja seu déficit calórico</p>
          <p className="text-sm text-muted">Preencha {list(energy.missing.map((m) => MISSING_LABEL[m]))} para calcular quanto você gasta por dia.</p>
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

  const deficit = energy.deficit ?? Math.round(energy.get - consumed)
  const surplus = deficit < 0

  return (
    <>
      <Card className="!py-4">
        <button onClick={() => setInfo(true)} className="flex w-full items-center gap-3 text-left" aria-haspopup="dialog">
          <span className={`flex size-10 shrink-0 items-center justify-center rounded-full ${surplus ? 'bg-coral/15 text-coral' : 'bg-fiber/15 text-fiber'}`}>
            <Activity className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-muted">
              {surplus ? 'Superávit calórico' : 'Déficit calórico'}
              {isToday && ' até agora'}
            </p>
            <p className="text-2xl font-extrabold">
              {fmtKcal(Math.abs(deficit))} <span className="text-sm font-semibold text-muted">kcal</span>
            </p>
            <p className="truncate text-xs text-muted">
              Gasto estimado {fmtKcal(energy.get)} − consumido {fmtKcal(consumed)}
            </p>
          </div>
          <Info className="size-5 shrink-0 text-muted" />
        </button>
      </Card>

      <Sheet open={info} onClose={() => setInfo(false)} title="Como calculamos">
        <div className="space-y-4 text-sm">
          <div className="space-y-2 rounded-2xl bg-soft p-4">
            <Row label="Metabolismo basal (TMB)" value={`${fmtKcal(energy.tmb)} kcal`} />
            <Row label={`Fator de atividade · ${energy.level}`} value={`× ${energy.factor.toLocaleString('pt-BR')}`} />
            <div className="border-t border-line pt-2">
              <Row label="Gasto estimado do dia (GET)" value={`${fmtKcal(energy.get)} kcal`} strong />
            </div>
            <Row label="Consumido" value={`− ${fmtKcal(consumed)} kcal`} />
            <div className="border-t border-line pt-2">
              <Row label={surplus ? 'Superávit' : 'Déficit'} value={`${fmtKcal(Math.abs(deficit))} kcal`} strong />
            </div>
          </div>
          <p className="text-muted">
            <strong className="text-ink">TMB</strong> é o que seu corpo gasta em repouso. Usamos a fórmula de Mifflin-St Jeor com{' '}
            {energy.weight.toLocaleString('pt-BR')} kg, {energy.height_cm} cm, {energy.age} anos ({energy.sex === 'f' ? 'feminino' : 'masculino'}).
          </p>
          <p className="text-muted">
            <strong className="text-ink">Fator de atividade</strong>: {energy.checkins_per_week.toLocaleString('pt-BR')} check-in(s) por semana em média
            {energy.window_days >= 28 ? ' nas últimas 4 semanas' : ` nos últimos ${energy.window_days} dias`}. Sedentário 1,2 · 1–2×/sem 1,375 · 3–4× 1,55 · 5–6× 1,725 · todo dia 1,9.
          </p>
          <p className="text-muted">
            O gasto dos treinos já está no fator de atividade, por isso não é somado de novo.
            {isToday && ' Hoje ainda está em andamento: o déficit diminui conforme você registra as refeições.'}
          </p>
          <p className="text-xs text-muted">É uma estimativa e não substitui a orientação de um nutricionista.</p>
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
